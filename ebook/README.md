# 제너럴리스트 전자책: 다중 봇 자동 검토 시스템

주제 "넓게 파는 사람 — 제너럴리스트의 심리학, 학습과학, 자아실현"을 위해, 서로 다른 회사의 모델을 역할별 봇으로 배정하고 **수집 → 검토 → 수정 → 판정**을 자동 반복하는 파이프라인이다. 모든 호출은 OpenRouter 를 거친다.

## 설계 원칙

- **저자와 검토자는 다른 회사 모델.** 같은 모델이 자기 글을 검토하면 같은 맹점을 공유한다.
- **반증가는 문서를 좋아할 필요가 없다.** 검토자 여덟 역할 중 다섯이 검토자이고, 그중 반증가와 사실검증가는 통과시키는 것이 아니라 떨어뜨리는 것이 임무다.
- **판정은 기계가 읽는다.** 모든 검토 보고서는 마지막 줄에 `VERDICT: {"score", "pass", "blocking"}` 을 남기고, 파이프라인은 임계값(기본 8점) 미달이면 검토자가 pass 라고 적어도 불합격 처리한다.
- **원문 보존.** 봇의 산출물은 편집 없이 저장한다. 모델이 존재하지 않는 인물을 만들다 철회한 흔적까지 남겨 검토자가 보게 한다.

## 역할과 기본 모델 (`config.json`)

| 역할 | 임무 | 기본 모델 |
|---|---|---|
| researcher | 학술 도시에 수집. 출처·증거강도·반박 상태·쓰임 | openai/gpt-5.6-luna |
| storyteller | 실존 인물 사례. 과장된 통념 표시 | google/gemini-3.8-flash |
| skeptic | 인과·편향·재현·반대증거 누락 공격 | x-ai/grok-4.6 |
| fact_checker | 서지·숫자·일화 실재 확인 | deepseek/deepseek-v4-pro |
| learning_scientist | 전이·연습·전문성 문헌 정합성 | upstage/solar-pro4 |
| psychologist | 동기·정체성·자아실현 이론 정합성 | z-ai/glm-5.3 |
| reader_advocate | 독자로서 읽고 반응 | google/gemini-2.5-flash-lite |
| chief_editor | 지적 병합, 충돌 판정, 개요·원고·변경기록 | anthropic/claude-sonnet-5 |

역할별 지시문은 `roles/*.md` 에 있다. 모델은 `config.json` 에서 바꾼다.

## 실행

```bash
export OPENROUTER_API_KEY=sk-or-...
python ebook/pipeline.py research                 # 연구원 + 이야기 수집가 (병렬)
python ebook/pipeline.py review  ebook/output/round-01/dossier.md   # 검토자 5명 병렬 + 판정
python ebook/pipeline.py loop    ebook/output/round-01/dossier.md   # 통과할 때까지 review→revise 반복 (최대 3회)
python ebook/pipeline.py outline                  # 편집장이 개요 작성
python ebook/pipeline.py chapter 1                # 1장 초고 작성 후 자동 검토 루프
python ebook/pipeline.py ask skeptic "이 주장을 공격하라: ..."   # 봇 하나에게 직접 묻기
python ebook/pipeline.py research --dry-run       # 호출 없이 프롬프트만 확인
```

산출물은 `output/round-NN/` 아래에 쌓인다: `dossier.md`, `stories.md`, `reviews/<문서>.<역할>.md`, `reviews/<문서>.verdicts.json`, `outline.md`, `chapter-NN.vN.md`.

## 라운드 1 결과 (2026-09-06)

`output/round-01/` 에 실제 가동 결과가 있다. 학술 문헌 31건, 사례 22건을 수집했고 다섯 검토자 전원이 불합격 판정을 내렸다. 핵심 발견은 `outline.md` 0절에 있다. 요약하면, 서로 조율 없는 다섯 모델이 같은 급소("명제가 증거보다 크다")를 찔렀고, 사실검증가는 서지 오류 8건과 허위 진술 2건을 잡아냈다.

## 알아둘 제약

- claude.ai 커넥터를 통해 MCP 로 호출할 때는 약 60초 상한이 있다. 라운드 1은 이 경로로 돌렸기 때문에 호출을 2,500토큰 안팎으로 쪼갰고, 추론이 긴 모델(solar, deepseek, glm)은 시간 초과로 다른 모델로 교체했다. 로컬에서 `pipeline.py` 를 직접 돌리면 이 제약이 없어 `config.json` 의 기본 모델을 그대로 쓸 수 있다.
- 추론 모델에 `max_tokens` 를 짧게 걸면 내부 추론에 전부 소진되어 빈 답이 온다. 과금은 된다. `config.json` 의 토큰 상한은 그것을 감안해 넉넉히 잡았다.
