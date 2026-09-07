# Bawkward — 인수인계 (새 세션에서 이어가기)

> 이 문서 하나로 새 대화방에서 작업을 그대로 이어갈 수 있게 정리한 것.
> 새 방을 열면 이 파일과 저장소를 통째로 주고 "여기서 이어가자"고 하면 된다.

## 1. 이게 뭔가

**Bawkward** = **Backward Design**(도달점에서 거꾸로 설계, 이해중심 교육과정) + **(a)wkward**(학생이 배우기 전에 먼저 써 본다).
2022 개정 교육과정을 **데이터 주권**(원본은 로컬 볼트, 외부엔 이름 가린 질문 초안만)을 지키며 돌리는 **순수 정적 웹앱**.

핵심 루프: `핵심아이디어 → 도달점(GOAL) → 탐구질문(연역) → 일걷쓰(관찰·질문·탐구·사유, 먼저 쓰기) → 인출·갭 → 전이`

## 2. 파일 구조

```
_layouts/app.html          앱 셸 (Jekyll; Liquid는 {{ content }} 한 줄뿐)
index.markdown, 404.html, _config.yml, CNAME, Gemfile*, LICENSE
assets/css/app.css         디자인(종이·잉크·테라코타), 반응형
assets/js/data.js          볼트 스토어·스키마·인가·주간신호·export/파기  (전역 window.BW.store)
assets/js/ai.js            OpenRouter 연동(브라우저판)·PII 마스킹·질문 초안 전용 (window.BW.ai)
assets/js/app.js           해시 라우터·모든 화면·SVG 차트·이벤트 위임 (window.BW.app)
docs/BAWKWARD_METHOD.md     방법론→구현 설계 노트 (사실/판단/미검증 구분)
docs/curriculum/           2022 개정 초3영어·초6과학 정리 (형님 문서로 대조할 골격)
  ├─ README.md             신뢰도 규칙([확인]/[검색확인]/[대조필요]) + 원문 출처
  ├─ english_3-4_2022.md
  └─ science_5-6_2022.md
README.md, HANDOFF.md
```

## 3. 아키텍처 요점 (코드 이어받을 때)

- 서버·빌드 없음. `window.BW` 네임스페이스 아래 `store`(data.js) / `ai`(ai.js) / `app`(app.js).
- 상태는 브라우저 `localStorage` 키: `bawkward.vault.v1`(볼트), `bawkward.user.v1`(현재 계정), `bawkward.ai.v1`(AI 설정).
- 라우팅은 해시(`#/units`, `#/unit/:id`, `#/write/:unitId`, `#/retrieve/:id`, `#/transfer/:workId`, `#/board/:id`, `#/stats`, `#/vault`, `#/ai`, `#/me`).
- 데모 계정: 오진우(교사), 김서준·이하윤·박도현·최지아(학생). 마이페이지에서 전환.
- **불변식**: 일걷쓰 4단을 다 써야 AI 버튼이 열림 / AI엔 마스킹 텍스트만 / 모든 호출은 Run 원장에 원문 없이 기록 / 학생은 학급 문집 접근 불가.
- 용어 주의: 3단계 이름은 **일걷쓰**(일견쓰 아님).

## 4. 실행 / 검증

```bash
# 정적 미리보기 (Jekyll 없이)
sed 's/{{ content }}//' _layouts/app.html > /tmp/index.html && cp -r assets /tmp/ && (cd /tmp && python3 -m http.server 8000)
# → http://localhost:8000/index.html

# 문법 체크
node --check assets/js/data.js && node --check assets/js/ai.js && node --check assets/js/app.js

# 스모크 테스트 (저장소에 포함, 24건)
PLAYWRIGHT_MODULE=/opt/node22/lib/node_modules/playwright node tests/smoke.cjs   # 전역 playwright 사용 시
node tests/smoke.cjs                                                            # npm i -D playwright 했다면
```

`tests/smoke.cjs`가 내장 정적 서버를 띄우고 교사·학생 전 흐름과 데이터 주권 불변식을 검사한다. 이 환경(원격 컨테이너)에서는 폰트 CDN(jsdelivr)이 차단돼 `Failed to load resource` 콘솔 메시지 하나가 뜨는데, 테스트는 이를 제외한다.

## 5. Git

- 저장소: `VincentJinwooOh/Vincent`
- 작업 브랜치: `claude/continue-session-3k5f9l` (2차 세션. 1차 브랜치 `claude/openrouter-classing-site-yvsuwa`를 그대로 이어받음)
- 로컬로 받기: `git clone -b claude/continue-session-3k5f9l <repo-url> BAWKWARD`
- 주요 커밋 흐름: ClassRing 초기 → **Bawkward 전면 재작성** → 일견쓰→일걷쓰 리네임 → 문구 순화 → 교육과정 정리(docs/curriculum) → **2차: 교육과정 템플릿·접근성·스모크 테스트**.

## 6. 2차 세션에서 한 일 (2026-09-07)

- **교육과정 템플릿** `BW.TEMPLATES`(data.js): 초3 영어 / 초6 과학 에너지 / 초6 과학 계절. 단원 설계 모달의 “교육과정 템플릿” 선택 → 단원·탐구질문·인출 키워드 생성. 성취기준 칸(한 줄에 `[코드] 문장`) 신설, 단원 화면에 **검색확인/대조필요** 칩.
- **접근성**: 모달 `aria-modal`·제목 연결·Tab 포커스 트랩·닫을 때 포커스 복원. 차트 `<title>/<desc>`(학기초→최근·최고·최저 문장) + 화면낭독기용 주별 값 표(`.sr-only`). 인출 키워드 `aria-pressed`, 통계 탭 `role=tab`.
- **버그**: 모바일(≤760px)에서 통계 탭 때문에 가로 스크롤 생기던 것(`.shell` 열을 `minmax(0,1fr)`) · import 시 형식/버전 검증 및 현재 계정 정합성 · 인출 0개 제출 시 확인창.
- **테스트**: `tests/smoke.cjs` 24건 통과.
- **교육과정 문서**: `[4영01-03]` 문장 검색확인 추가. 검색에 잡히는 `[4영02-02/03]` 문장은 **2015 개정 코드**로 보여 혼동 경고를 남김. 과학과는 이번에도 원문 사이트 전부 프록시 차단(문장 확인 0건).

## 7. 다음 할 일 (형님 지시 대기 중)

1. **형님 원문 문서 반영**: 2022 개정 초3영어·초6과학 성취기준을 `docs/curriculum/*`의 [대조필요] 표에 채워 확정 → `BW.TEMPLATES`의 `note`를 지우고 문장 교체. (이 환경은 한국 교육 도메인 egress가 막혀 있어 원문은 형님이 직접 주셔야 함.)
2. `data.js` 스토어를 교내 서버 API로 치환 (인증·권한·감사 로그 서버 재검증).
3. `ai.js` 마스킹·Run 로깅을 서버 LLM 프록시로 이전.
4. 볼트 동기화(교내 NAS/Git). 접근성 잔여: 명도 대비 재점검, 상단 아이콘 링크 레이블.
5. 미결정: CNAME(예전 도메인 toystore.lewagon.com) 삭제 여부 — 형님 도메인 아니면 GitHub Pages 배포 위해 삭제 필요.
6. 브랜치 정리: 1차 브랜치와 2차 브랜치 중 main 으로 합칠 것을 형님이 정하면 PR 생성.

## 8. 지켜온 원칙

- 타사 사이트를 직접 조사·복제하지 않음. 공개된 교육과정과 개인정보 보호 원칙에서 컨셉을 새로 설계.
- 문서·코드·커밋에 공격적/침해적 어휘를 쓰지 않음(교육·개인정보 보호 언어만).
- 사실 / 설계 판단 / 미검증을 구분해 표기.
