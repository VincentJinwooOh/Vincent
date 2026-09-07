/* Bawkward — AI 계층 (OpenRouter)
 * 원칙(방법론):
 *  1) 학생이 먼저 관찰·질문·탐구·사유를 쓴 뒤에만 AI가 등장한다. AI는 답이 아니라 "다음 탐구질문"의 초안만 낸다.
 *  2) 외부 모델에는 원문을 보내지 않는다. 이름·학번·학교·지역을 [학생A]·[N]·[학교]로 치환(PII 최소화)한 뒤 보낸다.
 *  3) 모든 호출은 Run 레코드로 남는다 — masked_input · question_draft · accepted_by. 원문 컬럼은 없다.
 *  4) 키는 이 브라우저에만 저장(BYOK)되고 openrouter.ai 로만 전송된다.
 * 이 파일이 곧 "서버 LLM 프록시"의 브라우저 시연판이다. 실서비스에선 이 마스킹·로깅을 교내 서버로 옮긴다.
 */
(function () {
  'use strict';
  const NS = (window.BW = window.BW || {});
  const KEY = 'bawkward.ai.v1';
  const ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';
  const MODELS_ENDPOINT = 'https://openrouter.ai/api/v1/models';
  const DEFAULTS = { apiKey: '', model: 'openai/gpt-4o-mini', temperature: 0.6 };
  const SUGGESTED = [
    { id: 'openai/gpt-4o-mini', label: 'GPT-4o mini · 빠르고 저렴' },
    { id: 'anthropic/claude-sonnet-4.5', label: 'Claude Sonnet 4.5 · 균형' },
    { id: 'google/gemini-2.5-flash', label: 'Gemini 2.5 Flash · 빠름' },
    { id: 'deepseek/deepseek-chat-v3.1', label: 'DeepSeek V3.1 · 저렴' },
    { id: 'meta-llama/llama-3.3-70b-instruct:free', label: 'Llama 3.3 70B · 무료' },
  ];

  function settings() { try { return Object.assign({}, DEFAULTS, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) { return Object.assign({}, DEFAULTS); } }
  function saveSettings(patch) { const n = Object.assign(settings(), patch); try { localStorage.setItem(KEY, JSON.stringify(n)); } catch (e) {} return n; }
  const hasKey = () => !!settings().apiKey;

  // -------- PII 마스킹 --------
  // 알려진 학급 구성원 이름 + 일반 패턴(학번, 학교, N명, 전화)을 토큰으로 치환.
  function maskPII(text, opts = {}) {
    let masked = String(text || '');
    const mapping = {};
    let ai = 0;
    // 1) 구성원 이름 (긴 이름부터)
    (opts.names || []).slice().sort((a, b) => b.length - a.length).forEach((name) => {
      if (!name || name.length < 2) return;
      if (masked.includes(name)) {
        const tok = `[학생${String.fromCharCode(65 + ai++)}]`;
        mapping[tok] = name;
        masked = masked.split(name).join(tok);
      }
    });
    // 2) 학교명
    masked = masked.replace(/([가-힣]{2,}(?:초등학교|중학교|고등학교|초|중|고))/g, (m) => { const tok = '[학교]'; mapping[tok] = mapping[tok] || m; return tok; });
    // 3) 학년 반 번호 / N번 / N명 / N학년
    masked = masked.replace(/\d+\s*(?:학년|반|번|명|교시|모둠)/g, (m) => m.replace(/\d+/, '[N]'));
    // 4) 전화번호
    masked = masked.replace(/01[016789]-?\d{3,4}-?\d{4}/g, '[전화]');
    return { masked, mapping };
  }
  function restorePII(text, mapping) { let out = String(text || ''); Object.entries(mapping || {}).forEach(([tok, orig]) => { out = out.split(tok).join(orig); }); return out; }

  function headers() { const s = settings(); return { 'Content-Type': 'application/json', Authorization: `Bearer ${s.apiKey}`, 'HTTP-Referer': location.origin || 'https://bawkward.local', 'X-Title': 'Bawkward' }; }

  async function chat(messages, opts = {}) {
    const s = settings();
    if (!s.apiKey) { const e = new Error('NO_KEY'); e.code = 'NO_KEY'; throw e; }
    const body = { model: opts.model || s.model, messages, temperature: opts.temperature ?? s.temperature, max_tokens: opts.maxTokens || 700, stream: !!opts.onToken };
    const res = await fetch(ENDPOINT, { method: 'POST', headers: headers(), body: JSON.stringify(body), signal: opts.signal });
    if (!res.ok) { let d = ''; try { d = (await res.json()).error?.message; } catch (e) { d = await res.text().catch(() => ''); } const err = new Error(`OpenRouter 오류 (${res.status}): ${d || res.statusText}`); err.status = res.status; throw err; }
    if (!body.stream) { const j = await res.json(); return j.choices?.[0]?.message?.content || ''; }
    const reader = res.body.getReader(), dec = new TextDecoder(); let buf = '', full = '';
    for (;;) {
      const { value, done } = await reader.read(); if (done) break;
      buf += dec.decode(value, { stream: true }); let idx;
      while ((idx = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, idx).trim(); buf = buf.slice(idx + 1);
        if (!line.startsWith('data:')) continue;
        const data = line.slice(5).trim(); if (data === '[DONE]') return full;
        try { const j = JSON.parse(data); const d = j.choices?.[0]?.delta?.content || ''; if (d) { full += d; opts.onToken(d, full); } } catch (e) {}
      }
    }
    return full;
  }

  async function listModels() {
    const res = await fetch(MODELS_ENDPOINT, { headers: hasKey() ? { Authorization: `Bearer ${settings().apiKey}` } : {} });
    if (!res.ok) throw new Error(`모델 목록 실패 (${res.status})`);
    return ((await res.json()).data || []).map((m) => ({ id: m.id, name: m.name, context: m.context_length, pricing: m.pricing }));
  }
  async function testConnection() { return (await chat([{ role: 'user', content: '한국어로 "연결 성공"만 답해줘.' }], { maxTokens: 20, temperature: 0 })).trim(); }

  const SYS = [
    '당신은 이해중심 교육과정(백워드 설계)을 돕는 조교 "Bawk"입니다.',
    '학생이 이미 스스로 관찰·질문·탐구·사유를 쓴 뒤에만 개입합니다.',
    '절대 정답이나 완성된 글을 대신 써 주지 않습니다. 대신 학생이 한 걸음 더 깊이 생각하도록 "다음 탐구질문"의 초안을 제안합니다.',
    '질문은 도달점(성취기준)에 가까워지게 하되, 학생의 언어를 존중합니다.',
    '입력에 [학생A]·[N]·[학교] 같은 토큰이 있으면 실명이 가려진 것이니 그대로 둡니다.',
    '한국어 존댓말로, 짧고 따뜻하게. 확실치 않으면 모른다고 말합니다.',
  ].join('\n');

  function contextLine(ctx) {
    if (!ctx) return '';
    return `\n[맥락] 교과: ${ctx.subject || '-'} · 핵심아이디어: ${ctx.coreIdea || '-'} · 도달점: ${ctx.goal || '-'}`;
  }

  // 질문 초안 생성: 학생 일견쓰(마스킹 후)를 근거로 다음 탐구질문 2~3개.
  async function draftInquiries(ctx, maskedWork, onToken) {
    const prompt = `${contextLine(ctx)}\n\n학생이 쓴 내용(실명은 가려짐):\n관찰: ${maskedWork.observe}\n질문: ${maskedWork.question}\n탐구: ${maskedWork.explore}\n사유: ${maskedWork.reflect}\n\n이 학생이 도달점에 더 가까워지도록, 스스로 답을 찾게 만드는 "다음 탐구질문" 2~3개를 제안해줘. 각 질문은 한 줄. 답이나 설명은 쓰지 마.`;
    return chat([{ role: 'system', content: SYS }, { role: 'user', content: prompt }], { onToken, maxTokens: 400 });
  }

  // 키 없을 때 규칙 기반 데모 (질문만).
  function demoInquiries(maskedWork, ctx) {
    const q = [];
    if (maskedWork.observe) q.push('네가 관찰한 그 장면에서, 겉으로 드러나지 않은 원인은 무엇일까?');
    if (maskedWork.question) q.push(`"${maskedWork.question.slice(0, 24)}…" — 이 질문에 반대되는 입장은 뭐라고 말할까?`);
    q.push(ctx?.goal ? `이 생각을 "${ctx.goal}"에 연결하려면 무엇을 더 알아야 할까?` : '이 생각을 다른 상황에도 적용할 수 있을까? 언제 안 통할까?');
    return q.slice(0, 3).map((x) => '• ' + x).join('\n') + '\n\n※ 데모 모드입니다. 마이페이지에서 OpenRouter 키를 등록하면 실제 모델이 학생 글에 맞춰 제안합니다.';
  }

  NS.ai = { settings, saveSettings, hasKey, chat, listModels, testConnection, maskPII, restorePII, draftInquiries, demoInquiries, SUGGESTED, SYS, ENDPOINT };
})();
