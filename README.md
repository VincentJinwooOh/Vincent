# ⌐B Bawkward — 이해중심 교육과정 학습 볼트

**Backward Design**(도달점에서 거꾸로 설계) + **(a)wkward**(학생이 먼저 어색하게 써 본다).
2022 개정 교육과정의 이해중심 설계를, **데이터 주권**을 지키며 돌리는 정적 웹앱입니다.

- 서버·DB 없이 **순수 정적 HTML/CSS/JS** 로 동작 — 원본은 브라우저 **로컬 볼트**(localStorage)에만
- 외부 모델(OpenRouter)에는 **이름을 가린 뒤 “다음 탐구질문 초안”만** 오갑니다 — 답을 대신 쓰지 않습니다
- Jekyll / GitHub Pages 로 그대로 배포 (하위 경로에서도 상대 경로로 동작)
- 설계 근거: [`docs/BAWKWARD_METHOD.md`](docs/BAWKWARD_METHOD.md)

## 왜 Bawkward

진도가 아니라 **도달점에서 거꾸로** 설계합니다. 그리고 학생은 배우기 전에 **먼저 써 봅니다**.
로고의 `B`가 뒤집힌 것도 같은 뜻입니다. 이 어색함(awkward)이 이해를 만듭니다.

## 학습 루프

```
① 도달점(GOAL)  →  ② 탐구질문(연역)  →  ③ 일걷쓰(먼저 쓰기: 관찰·질문·탐구·사유)
                                              ↓
                    ⑤ 전이(도구교과·실생활)  ←  ④ 인출·갭(키워드로 도달 점검)
```

| 화면 | 설명 | 역할 |
|---|---|---|
| `#/units`, `#/unit/:id` | 핵심아이디어·내용체계·성취기준·**도달점**·탐구질문 | 교사가 설계 |
| `#/write/:unitId` | 일걷쓰 4단. 다 쓴 뒤에만 Bawk 조교가 **다음 질문** 제안 | 학생 |
| `#/retrieve/:unitId` | 키워드 인출 → 안 떠오른 것 = 보충할 **갭** | 교사(설계)/학생(인출) |
| `#/transfer/:workId` | 내용교과 → 도구교과 → 실생활, 체크 3칸 | 학생 |
| `#/board/:unitId` | 학급 일걷쓰 문집(**내부만**, 공개 링크 없음) | 교사 |
| `#/stats` | STATEtistics — 학기초→학기말 **비식별 숫자 신호**만 | 모두 |
| `#/vault` | 볼트·주권 원장: 마스킹 예시, AI 호출 원장, export/import, 학기말 파기, 접근 로그 | — |
| `#/me` | 데모 계정 전환(교사/학생), OpenRouter 설정 | — |

데모 계정: **오진우(교사)**, 김서준·이하윤·박도현·최지아(학생). 마이페이지에서 전환해 두 화면을 비교하세요.

## 데이터 주권 원칙 (화면으로 강제)

1. **원본은 로컬 볼트** — 원문은 서버로 나가지 않고 `.md/.json`으로 이사 가능
2. **학생이 먼저, AI는 나중** — 4단을 다 쓴 뒤에만 AI 버튼이 열림, 답 대신 질문만
3. **외부엔 비식별 텍스트만** — 이름→`[학생A]`, 학교→`[학교]`, 번호→`[N]` 치환 후 전송
4. **호출은 원장에 기록** — masked_input·question_draft·accepted_by만 (원문 컬럼 없음)
5. **학기말 파기** — 원문·코드표·신호를 함께 삭제
6. **인가는 객체 단위** — 반·역할·배정 재검증(학생은 학급 문집 접근 불가)

## 실행

```bash
# 정적 서버 (Jekyll 없이)
sed 's/{{ content }}//' _layouts/app.html > /tmp/index.html && cp -r assets /tmp/ && (cd /tmp && python3 -m http.server 8000)
# → http://localhost:8000/index.html

# Jekyll
bundle install && bundle exec jekyll serve   # → http://localhost:4000
```

GitHub Pages: Settings → Pages 에서 브랜치만 지정하면 됩니다. `baseurl` 은 비워도 상대 경로로 동작합니다.

## OpenRouter 연결 (선택)

키가 없으면 **데모 모드**로 규칙 기반 질문이 나옵니다. 실제 모델을 쓰려면:
1. https://openrouter.ai/settings/keys 에서 키 발급
2. 마이페이지 → Bawk 설정에 키·모델 입력 → “연결 테스트”

키는 브라우저에만 저장되고 `openrouter.ai` 로만 전송됩니다. (BYOK)

## 구조

```
_layouts/app.html      앱 셸 (Liquid 는 {{ content }} 한 줄)
assets/css/app.css     디자인 토큰(종이·잉크·테라코타) · 반응형
assets/js/data.js      볼트 스토어 · 스키마 · 인가 · 마스킹 신호 · export/파기
assets/js/ai.js        OpenRouter 프록시(브라우저판) · PII 마스킹 · 질문 초안 전용
assets/js/app.js       해시 라우터 · 뷰 · SVG 차트 · 이벤트 위임
docs/BAWKWARD_METHOD.md  방법론 → 구현 설계 노트 (사실/판단/미검증 구분)
```

이 앱은 특정 서비스를 크롤링·복제한 것이 아니라, 공개된 교육과정·보안 상식과 방법론에서
**더 나은 컨셉을 귀추해 새로 지은** 결과입니다. `CNAME`(예전 도메인)은 본인 것이 아니면 삭제하세요.

## 라이선스

저장소 LICENSE 를 따릅니다.
