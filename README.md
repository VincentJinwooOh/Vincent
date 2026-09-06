# ToyStore

Jekyll 기반 정적 사이트입니다. 로컬 실행은 `bundle install` 후 `bundle exec jekyll serve` 입니다.

## OpenRouter MCP 연결

이 저장소에는 프로젝트 범위 MCP 설정 파일 `.mcp.json` 이 포함되어 있습니다.
Claude Code로 이 저장소를 열면 OpenRouter의 공식 원격 MCP 서버
(`https://mcp.openrouter.ai/mcp`)가 자동으로 등록됩니다.

이 방식은 Claude의 두뇌를 바꾸는 것이 아니라, Claude에게 OpenRouter를 통해
다른 모델(DeepSeek, Gemini 등 500여 개)을 호출하는 **도구**를 쥐여주는 것입니다.
여러 모델의 답을 교차 검증하거나 이미지 생성을 시킬 때 씁니다.

### 최초 1회 인증

인증 정보는 저장소에 저장되지 않으며, 사용자 본인의 브라우저 OAuth 로그인으로 발급됩니다.

```bash
# 방법 1: 셸에서 바로 로그인
claude mcp login openrouter

# 방법 2: Claude Code 세션 안에서
/mcp   →  openrouter 선택  →  Authenticate
```

OAuth 승인 시 7일 만료, 10달러 한도의 전용 API 키가 자동 발급됩니다.
한도는 승인 화면에서 조정할 수 있습니다. 7일이 지나면 같은 명령으로 재인증하면 됩니다.

### 참고

- 로컬 대화형 세션에서는 최초 1회 `.mcp.json` 사용 승인 프롬프트가 뜹니다.
  초기화하려면 `claude mcp reset-project-choices` 를 실행하십시오.
- Claude Code 클라우드 세션에서 쓰려면 해당 환경의 네트워크 정책이
  `openrouter.ai` 와 `mcp.openrouter.ai` 로의 아웃바운드 접속을 허용해야 합니다.
- 서버 목록과 사용법: https://openrouter.ai/docs/guides/overview/mcp-server

## 전자책 다중 봇 검토 시스템

`ebook/` 에 "제너럴리스트" 주제 전자책을 위한 역할별 봇(연구원, 이야기 수집가, 반증가, 사실검증가, 학습과학자, 심리학자, 독자 대변인, 편집장)과 자동 검토 루프가 있다. 서로 다른 회사의 모델을 OpenRouter 로 호출한다. 사용법과 라운드 1 결과는 `ebook/README.md` 참조.
