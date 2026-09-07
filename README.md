# 🎒 ClassRing — 클래스팅 스타일 학급 소통 플랫폼

교사·학생·학부모가 함께 쓰는 학급 소통 플랫폼 데모입니다. [클래스팅(Classting)](https://www.classting.com)의
핵심 구조(클래스 피드 · 알림장 · 과제 · 출석 · 설문 · 앨범 · 쪽지 · 캘린더 · 알림)를 벤치마크했고,
**OpenRouter API**로 연결되는 AI 보조교사 "링고"를 내장했습니다.

- 서버·DB 없이 **순수 정적 HTML/CSS/JS** 로 동작 (상태는 브라우저 localStorage)
- Jekyll / GitHub Pages 로 그대로 배포 가능 (프로젝트 페이지 하위 경로에서도 동작)
- 조사 노트: [`docs/CLASSTING_RESEARCH.md`](docs/CLASSTING_RESEARCH.md)

## 실행

```bash
# 1) 가장 간단: 정적 서버로 열기 (Jekyll 없이)
sed 's/{{ content }}//' _layouts/app.html > /tmp/index.html && cp -r assets /tmp/ && (cd /tmp && python3 -m http.server 8000)
# → http://localhost:8000/index.html

# 2) Jekyll 로 실행
bundle install && bundle exec jekyll serve
# → http://localhost:4000
```

GitHub Pages: 저장소 Settings → Pages → 브랜치 선택만 하면 됩니다. `_config.yml` 의 `baseurl` 은 비워 두어도
상대 경로를 쓰기 때문에 `https://<user>.github.io/<repo>/` 에서도 동작합니다.

## 둘러보기

| 화면 | 설명 |
|---|---|
| 홈 `#/` | 내 모든 클래스 소식 통합 피드, 유형 필터(공지/알림장/과제/설문/앨범/소식), 작성기 |
| 클래스 `#/class/c1` | 커버(초대 코드) + 소식 · 알림장 · 과제 · 앨범 · 출석 · 구성원 탭 |
| 캘린더 `#/calendar` | 월간 달력, 학급/평가/행사 일정 + 과제 마감 자동 표시 |
| 알림 `#/notifications` | 새 글 · 미확인 알림장 · 마감 임박 · 댓글 · 제출 · 쪽지를 상태에서 파생 |
| 쪽지 `#/messages` | 교사↔학부모/학생 1:1 스레드 |
| AI 보조교사 `#/ai` | OpenRouter 모델과 대화, 알림장·과제·피드백·안내문 초안 (스트리밍) |
| 마이페이지 `#/me` | **데모 계정 전환(교사/학생/학부모)**, OpenRouter 설정, JSON 내보내기/가져오기, 초기화 |

데모 계정: 김하늘(교사) · 오진우/이서연/… (학생) · 김미영/이정훈 (학부모). 초대 코드 `HB32-2026`, `CODE-AFT`.

## OpenRouter 연결

1. https://openrouter.ai/settings/keys 에서 키 발급
2. 마이페이지 → **AI 설정** 에 키 입력, 모델 선택(또는 슬러그 직접 입력 · "모델 목록 불러오기")
3. "연결 테스트" → AI 보조교사 / 작성기의 "AI 초안 채우기" / 채점 모달의 "AI 피드백" 사용

키는 브라우저 localStorage 에만 저장되고 `openrouter.ai` 로만 전송됩니다. 키가 없으면 데모 모드로 동작합니다.

## 구조

```
_layouts/app.html      앱 셸 (Jekyll 레이아웃, Liquid 는 {{ content }} 한 줄뿐)
index.markdown         layout: app
assets/css/app.css     디자인 토큰 · 반응형 레이아웃
assets/js/data.js      데이터 모델 · 시드 · localStorage 스토어 (API 로 치환할 계층)
assets/js/ai.js        OpenRouter 클라이언트 (BYOK, SSE 스트리밍, 데모 폴백)
assets/js/app.js       해시 라우터 · 뷰 렌더링 · 이벤트 위임
docs/                  벤치마크 조사 노트
```

이전 ToyStore 튜토리얼의 `_products`, `_includes`, `_layouts/default.html`, `_layouts/product.html` 은 더 이상 사용하지 않으며
`_config.yml` 에서 상품 컬렉션 출력을 껐습니다. `CNAME`(toystore.lewagon.com) 도 남아 있으니 본인 도메인이 아니면 지워 주세요.

## 라이선스

기존 저장소 LICENSE 를 따릅니다.
