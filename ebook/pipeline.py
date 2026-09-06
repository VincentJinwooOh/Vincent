#!/usr/bin/env python3
"""
제너럴리스트 전자책 다중 봇 검토 파이프라인.

역할(봇)마다 서로 다른 회사의 모델을 OpenRouter로 호출해, 수집 → 검토 → 수정 → 판정을
자동으로 반복한다. 표준 라이브러리만 사용한다.

사용법:
  export OPENROUTER_API_KEY=sk-or-...
  python ebook/pipeline.py research                    # 연구원 + 이야기 수집가 (병렬)
  python ebook/pipeline.py review  <문서.md>            # 검토자 5명 병렬 검토 + 판정
  python ebook/pipeline.py revise  <문서.md>            # 편집장이 검토 반영해 수정본 작성
  python ebook/pipeline.py loop    <문서.md>            # review → revise 를 통과할 때까지 반복
  python ebook/pipeline.py outline                     # 편집장이 도시에+사례+검토로 개요 작성
  python ebook/pipeline.py chapter <번호>              # 개요의 N장 초고 작성 후 loop
  python ebook/pipeline.py ask <역할> "<질문>"          # 봇 하나에게 직접 묻기

옵션: --round N (출력 폴더 번호), --dry-run (호출 없이 프롬프트만 출력)
"""
import argparse, concurrent.futures as cf, datetime as dt, json, os, re, sys, time, urllib.error, urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent
CFG = json.loads((ROOT / "config.json").read_text(encoding="utf-8"))
BRIEF = (ROOT / "brief.md").read_text(encoding="utf-8")
VERDICT_RE = re.compile(r"VERDICT:\s*(\{.*\})\s*$", re.S | re.M)


def role_prompt(role: str) -> str:
    return (ROOT / "roles" / f"{role}.md").read_text(encoding="utf-8")


def call(role: str, user: str, *, dry: bool = False, retries: int = 3) -> dict:
    """OpenRouter chat completion. 역할별 모델/토큰/추론 설정은 config.json 을 따른다."""
    spec = CFG["roles"][role]
    body = {
        "model": spec["model"],
        "messages": [
            {"role": "system", "content": role_prompt(role) + "\n\n---\n# 브리프\n" + BRIEF},
            {"role": "user", "content": user},
        ],
        "max_tokens": spec.get("max_tokens", 4000),
    }
    if spec.get("reasoning_effort"):
        body["reasoning"] = {"effort": spec["reasoning_effort"]}
    if dry:
        print(f"\n===== [{role}] {spec['model']} =====\n{user[:2000]}\n")
        return {"role": role, "model": spec["model"], "text": "(dry-run)", "usage": {}}

    key = os.environ.get("OPENROUTER_API_KEY")
    if not key:
        sys.exit("OPENROUTER_API_KEY 환경변수가 필요합니다.")
    req = urllib.request.Request(
        CFG["base_url"] + "/chat/completions",
        data=json.dumps(body).encode(),
        headers={
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json",
            "HTTP-Referer": "https://github.com/VincentJinwooOh/Vincent",
            "X-Title": "generalist-ebook-pipeline",
        },
    )
    for attempt in range(retries):
        try:
            with urllib.request.urlopen(req, timeout=600) as r:
                data = json.load(r)
            text = data["choices"][0]["message"]["content"] or ""
            return {"role": role, "model": data.get("model", spec["model"]), "text": text,
                    "usage": data.get("usage", {}), "id": data.get("id")}
        except (urllib.error.URLError, TimeoutError, KeyError) as e:
            if attempt == retries - 1:
                raise
            time.sleep(2 ** attempt * 2)


def parse_verdict(text: str) -> dict:
    m = VERDICT_RE.search(text)
    if not m:
        return {"score": None, "pass": False, "blocking": ["VERDICT 줄 누락"]}
    try:
        v = json.loads(m.group(1))
        # 검토자가 점수와 모순되게 pass 를 적는 경우가 있어 임계값이 항상 우선한다.
        v["pass"] = (v.get("score") or 0) >= CFG["pass_threshold"] and bool(v.get("pass", True))
        return v
    except json.JSONDecodeError:
        return {"score": None, "pass": False, "blocking": ["VERDICT JSON 파싱 실패"]}


def out_dir(round_no: int) -> Path:
    d = ROOT / "output" / f"round-{round_no:02d}"
    d.mkdir(parents=True, exist_ok=True)
    return d


def save(path: Path, res: dict) -> None:
    stamp = dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds")
    header = f"<!-- role: {res['role']} | model: {res['model']} | at: {stamp} | usage: {json.dumps(res.get('usage', {}))} -->\n\n"
    path.write_text(header + res["text"], encoding="utf-8")
    print(f"저장: {path.relative_to(ROOT)}  ({res['model']}, {res.get('usage', {}).get('completion_tokens', '?')} out tokens)")


def parallel(jobs: list[tuple[str, str]], dry: bool) -> list[dict]:
    with cf.ThreadPoolExecutor(max_workers=len(jobs)) as ex:
        futs = [ex.submit(call, role, prompt, dry=dry) for role, prompt in jobs]
        return [f.result() for f in futs]


# ---------- 단계 ----------

def stage_research(rnd: int, dry: bool) -> None:
    d = out_dir(rnd)
    ask = "브리프의 주제에 대해 당신의 역할에 맞는 산출물을 작성하라."
    res = parallel([("researcher", ask), ("storyteller", ask)], dry)
    save(d / "dossier.md", res[0])
    save(d / "stories.md", res[1])


def stage_review(doc: Path, rnd: int, dry: bool) -> dict:
    d = out_dir(rnd) / "reviews"
    d.mkdir(exist_ok=True)
    text = doc.read_text(encoding="utf-8")
    ask = f"다음 문서를 당신의 역할에 따라 검토하라.\n\n<document name=\"{doc.name}\">\n{text}\n</document>"
    res = parallel([(r, ask) for r in CFG["reviewers"]], dry)
    verdicts = {}
    for r in res:
        save(d / f"{doc.stem}.{r['role']}.md", r)
        verdicts[r["role"]] = parse_verdict(r["text"]) | {"model": r["model"]}
    summary = {"document": doc.name, "verdicts": verdicts,
               "all_pass": all(v["pass"] for v in verdicts.values())}
    (d / f"{doc.stem}.verdicts.json").write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8")
    print("\n판정:", json.dumps({k: (v["score"], v["pass"]) for k, v in verdicts.items()}, ensure_ascii=False))
    return summary


def collect_reviews(doc: Path, rnd: int) -> str:
    d = out_dir(rnd) / "reviews"
    parts = []
    for r in CFG["reviewers"]:
        p = d / f"{doc.stem}.{r}.md"
        if p.exists():
            parts.append(f"<review role=\"{r}\">\n{p.read_text(encoding='utf-8')}\n</review>")
    return "\n\n".join(parts)


def stage_revise(doc: Path, rnd: int, dry: bool) -> Path:
    text = doc.read_text(encoding="utf-8")
    ask = ("다음 문서와 다섯 검토자의 보고서를 받아, blocking 항목을 모두 반영한 수정본을 작성하라. "
           "문서 전체를 다시 쓰고, 끝에 변경 기록을 붙여라.\n\n"
           f"<document name=\"{doc.name}\">\n{text}\n</document>\n\n{collect_reviews(doc, rnd)}")
    res = call("chief_editor", ask, dry=dry)
    m = re.search(r"\.v(\d+)$", doc.stem)
    ver = int(m.group(1)) + 1 if m else 2
    base = re.sub(r"\.v\d+$", "", doc.stem)
    new = out_dir(rnd) / f"{base}.v{ver}.md"
    save(new, res)
    return new


def stage_loop(doc: Path, rnd: int, dry: bool) -> None:
    for i in range(CFG["max_rounds"]):
        print(f"\n--- 검토 라운드 {i + 1}/{CFG['max_rounds']}: {doc.name} ---")
        summary = stage_review(doc, rnd, dry)
        if summary["all_pass"]:
            print(f"\n통과: {doc.name}")
            return
        doc = stage_revise(doc, rnd, dry)
    print(f"\n최대 라운드 도달. 마지막 판본: {doc.name}. 남은 blocking 항목은 verdicts.json 참조.")


def latest(rnd: int, base: str) -> Path:
    cands = sorted(out_dir(rnd).glob(f"{base}*.md"), key=lambda p: p.stat().st_mtime)
    if not cands:
        sys.exit(f"{base} 문서가 없습니다. 먼저 research 를 실행하십시오.")
    return cands[-1]


def stage_outline(rnd: int, dry: bool) -> None:
    dossier, stories = latest(rnd, "dossier"), latest(rnd, "stories")
    ask = ("다음 학술 자료 도시에와 사례 모음, 그리고 그에 대한 검토 보고서를 바탕으로 책의 장별 개요를 작성하라.\n\n"
           f"<dossier>\n{dossier.read_text(encoding='utf-8')}\n</dossier>\n\n"
           f"<stories>\n{stories.read_text(encoding='utf-8')}\n</stories>\n\n"
           f"{collect_reviews(dossier, rnd)}\n\n{collect_reviews(stories, rnd)}")
    save(out_dir(rnd) / "outline.md", call("chief_editor", ask, dry=dry))


def stage_chapter(n: int, rnd: int, dry: bool) -> None:
    outline, dossier, stories = latest(rnd, "outline"), latest(rnd, "dossier"), latest(rnd, "stories")
    ask = (f"개요의 {n}장 초고를 작성하라. 분량은 한국어 6000~9000자. 개요에 정한 출발 현상, 이론, 반박 조건, 사례, 문헌을 모두 담아라.\n\n"
           f"<outline>\n{outline.read_text(encoding='utf-8')}\n</outline>\n\n"
           f"<dossier>\n{dossier.read_text(encoding='utf-8')}\n</dossier>\n\n"
           f"<stories>\n{stories.read_text(encoding='utf-8')}\n</stories>")
    p = out_dir(rnd) / f"chapter-{n:02d}.v1.md"
    save(p, call("chief_editor", ask, dry=dry))
    stage_loop(p, rnd, dry)


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("cmd", choices=["research", "review", "revise", "loop", "outline", "chapter", "ask"])
    ap.add_argument("args", nargs="*")
    ap.add_argument("--round", type=int, default=1)
    ap.add_argument("--dry-run", action="store_true")
    a = ap.parse_args()
    if a.cmd == "research":
        stage_research(a.round, a.dry_run)
    elif a.cmd in ("review", "revise", "loop"):
        if not a.args:
            sys.exit("문서 경로가 필요합니다.")
        doc = Path(a.args[0]).resolve()
        {"review": stage_review, "revise": stage_revise, "loop": stage_loop}[a.cmd](doc, a.round, a.dry_run)
    elif a.cmd == "outline":
        stage_outline(a.round, a.dry_run)
    elif a.cmd == "chapter":
        stage_chapter(int(a.args[0]), a.round, a.dry_run)
    elif a.cmd == "ask":
        role, q = a.args[0], " ".join(a.args[1:])
        print(call(role, q, dry=a.dry_run)["text"])


if __name__ == "__main__":
    main()
