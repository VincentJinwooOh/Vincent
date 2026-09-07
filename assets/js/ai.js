/* ClassRing — OpenRouter API 연동 (AI 보조교사 "링고")
 * - 사용자가 직접 입력한 OpenRouter API 키를 브라우저 localStorage에만 저장 (BYOK)
 * - OpenAI 호환 Chat Completions 엔드포인트 + SSE 스트리밍
 * - 키가 없으면 "데모 모드"로 규칙 기반 초안을 생성해 화면 흐름을 체험할 수 있게 한다
 */
(function () {
  'use strict';
  const NS = (window.CR = window.CR || {});
  const KEY = 'classring.settings.v1';
  const ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';
  const MODELS_ENDPOINT = 'https://openrouter.ai/api/v1/models';

  const DEFAULTS = {
    apiKey: '',
    model: 'openai/gpt-4o-mini',
    temperature: 0.7,
  };
  // 교육 현장에서 무난한 가성비/품질 모델 목록 (사용자가 직접 입력도 가능)
  const SUGGESTED_MODELS = [
    { id: 'openai/gpt-4o-mini', label: 'GPT-4o mini · 빠르고 저렴' },
    { id: 'anthropic/claude-sonnet-4.5', label: 'Claude Sonnet 4.5 · 균형' },
    { id: 'google/gemini-2.5-flash', label: 'Gemini 2.5 Flash · 빠름' },
    { id: 'deepseek/deepseek-chat-v3.1', label: 'DeepSeek V3.1 · 저렴' },
    { id: 'meta-llama/llama-3.3-70b-instruct:free', label: 'Llama 3.3 70B · 무료 엔드포인트' },
    { id: 'openrouter/auto', label: 'Auto · OpenRouter 자동 라우팅' },
  ];

  function settings() {
    try { return Object.assign({}, DEFAULTS, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) { return Object.assign({}, DEFAULTS); }
  }
  function saveSettings(patch) {
    const next = Object.assign(settings(), patch);
    try { localStorage.setItem(KEY, JSON.stringify(next)); } catch (e) { /* ignore */ }
    return next;
  }
  const hasKey = () => !!settings().apiKey;

  function headers() {
    const s = settings();
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${s.apiKey}`,
      'HTTP-Referer': location.origin || 'https://classring.local',
      'X-Title': 'ClassRing',
    };
  }

  /**
   * chat(messages, { onToken, signal, model }) → 전체 텍스트
   * onToken 이 있으면 스트리밍, 없으면 단건 응답.
   */
  async function chat(messages, opts = {}) {
    const s = settings();
    if (!s.apiKey) { const e = new Error('NO_KEY'); e.code = 'NO_KEY'; throw e; }
    const body = {
      model: opts.model || s.model,
      messages,
      temperature: opts.temperature ?? s.temperature,
      max_tokens: opts.maxTokens || 1200,
      stream: !!opts.onToken,
    };
    const res = await fetch(ENDPOINT, { method: 'POST', headers: headers(), body: JSON.stringify(body), signal: opts.signal });
    if (!res.ok) {
      let detail = '';
      try { const j = await res.json(); detail = j.error?.message || JSON.stringify(j); } catch (e) { detail = await res.text().catch(() => ''); }
      const err = new Error(`OpenRouter 오류 (${res.status}): ${detail || res.statusText}`);
      err.status = res.status; throw err;
    }
    if (!body.stream) {
      const j = await res.json();
      return j.choices?.[0]?.message?.content || '';
    }
    // SSE 스트림 파싱
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = '', full = '';
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      let idx;
      while ((idx = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, idx).trim(); buf = buf.slice(idx + 1);
        if (!line.startsWith('data:')) continue; // OpenRouter는 ': OPENROUTER PROCESSING' 주석 라인을 보낼 수 있음
        const data = line.slice(5).trim();
        if (data === '[DONE]') return full;
        try {
          const j = JSON.parse(data);
          const delta = j.choices?.[0]?.delta?.content || '';
          if (delta) { full += delta; opts.onToken(delta, full); }
          if (j.error) throw new Error(j.error.message || 'stream error');
        } catch (e) { if (e.message && e.message !== 'Unexpected end of JSON input') { /* partial chunk */ } }
      }
    }
    return full;
  }

  async function listModels() {
    const res = await fetch(MODELS_ENDPOINT, { headers: hasKey() ? { Authorization: `Bearer ${settings().apiKey}` } : {} });
    if (!res.ok) throw new Error(`모델 목록 조회 실패 (${res.status})`);
    const j = await res.json();
    return (j.data || []).map((m) => ({ id: m.id, name: m.name, context: m.context_length, pricing: m.pricing }));
  }

  async function testConnection() {
    const text = await chat([{ role: 'user', content: '한국어로 "연결 성공" 이라고만 답해줘.' }], { maxTokens: 20, temperature: 0 });
    return text.trim();
  }

  /** 현재 사용자 컨텍스트를 요약해 시스템 프롬프트를 만든다 (개인정보 최소화: 이름·역할·일정만) */
  function systemPrompt(ctx) {
    const lines = [
      '당신은 한국 초·중등 학급 소통 플랫폼 "ClassRing"에 내장된 AI 보조교사 "링고"입니다.',
      '항상 따뜻하고 간결한 한국어 존댓말로 답하고, 교사·학생·학부모 각각의 입장을 고려합니다.',
      '알림장·가정통신문·과제 안내·학부모 답장 초안을 요청받으면 바로 복사해 쓸 수 있는 완성된 문장으로 작성합니다.',
      '학생에게는 답을 직접 알려주기보다 스스로 생각하도록 힌트를 주는 방식을 우선합니다.',
      '확실하지 않은 사실은 지어내지 말고 모른다고 말하세요.',
    ];
    if (ctx) {
      lines.push('', '--- 현재 사용자 컨텍스트 ---');
      lines.push(`사용자: ${ctx.userName} (${ctx.roleLabel})`);
      if (ctx.classes?.length) lines.push(`소속 클래스: ${ctx.classes.join(', ')}`);
      if (ctx.upcoming?.length) lines.push(`다가오는 일정: ${ctx.upcoming.join(' / ')}`);
      if (ctx.recent?.length) lines.push(`최근 게시물: ${ctx.recent.join(' / ')}`);
      lines.push(`오늘 날짜: ${new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })}`);
    }
    return lines.join('\n');
  }

  /** 키가 없을 때 사용하는 규칙 기반 데모 응답 */
  function demoReply(prompt, ctx) {
    const p = prompt.toLowerCase();
    const cls = ctx?.classes?.[0] || '우리 반';
    if (/알림장/.test(p)) {
      return `📒 ${cls} 알림장 초안 (데모)\n\n1. 오늘 배운 내용 복습하기\n2. 내일 준비물 챙기기\n3. 안내장 서명 후 제출\n4. 일찍 자고 건강하게 등교하기 🌙\n\n※ OpenRouter API 키를 등록하면 실제 AI가 맥락에 맞게 작성해 드려요.`;
    }
    if (/과제|숙제/.test(p)) {
      return `📝 과제 안내 초안 (데모)\n\n제목: (과제명)\n목표: 이번 단원의 핵심 개념을 스스로 정리합니다.\n방법: 교과서 해당 쪽을 읽고, 배운 내용을 5문장으로 요약해 제출하세요.\n제출: 이번 주 금요일 오후 6시까지 ClassRing 과제 탭\n\n※ 데모 모드입니다. API 키를 등록하면 학년·과목에 맞춘 안내문을 생성합니다.`;
    }
    if (/학부모|가정통신|답장/.test(p)) {
      return `✉️ 학부모 안내 초안 (데모)\n\n안녕하세요, ${cls} 담임입니다.\n항상 학급 활동에 관심 가져 주셔서 감사합니다.\n(안내 내용)\n궁금한 점은 언제든 쪽지로 연락 주세요.\n감사합니다.\n\n※ 데모 모드입니다.`;
    }
    if (/피드백|채점/.test(p)) {
      return `🏅 과제 피드백 초안 (데모)\n\n잘한 점: 자신의 생각을 구체적인 장면과 연결해 표현했어요.\n보완할 점: 이유를 한 문장 더 덧붙이면 설득력이 커져요.\n다음 목표: 문장 끝을 다양하게 바꿔 보기.\n\n※ 데모 모드입니다.`;
    }
    return `안녕하세요, 저는 ClassRing의 AI 보조교사 링고예요 🤖\n지금은 데모 모드라 정해진 예시만 보여드릴 수 있어요.\n\n마이페이지 → AI 설정에서 OpenRouter API 키를 등록하면\n• 알림장·공지 초안 작성\n• 과제 피드백 제안\n• 학부모 안내문 작성\n• 학습 내용 요약·퀴즈 생성\n을 실제 AI 모델로 도와드릴게요.`;
  }

  NS.ai = { settings, saveSettings, hasKey, chat, listModels, testConnection, systemPrompt, demoReply, SUGGESTED_MODELS, ENDPOINT };
})();
