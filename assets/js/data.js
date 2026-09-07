/* Bawkward — 볼트 데이터 계층
 * 원본은 로컬(localStorage)에 남는 볼트. 서버·회사 클라우드로 원문을 보내지 않는다.
 * 이 계층만 파일 동기화(교내 NAS/Git)나 자체 API로 치환하면 된다. 스키마는 방법론 노트 그대로:
 *   Unit(핵심아이디어) → Inquiry(탐구질문) → Work(일걷쓰) → Retrieval(인출) → Gap(파생) → Transfer(전이)
 *   Run(AI 호출 로그, 원문 없음) · Signal(주간 비식별 신호) · AccessLog
 */
(function () {
  'use strict';
  const NS = (window.BW = window.BW || {});
  const KEY = 'bawkward.vault.v1';
  const USER_KEY = 'bawkward.user.v1';

  const pad = (n) => String(n).padStart(2, '0');
  const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const today = () => iso(new Date());
  const uid = (p) => `${p}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  function daysAgo(n, h = 15) { const d = new Date(); d.setDate(d.getDate() - n); d.setHours(h, 0, 0, 0); return d.toISOString(); }
  // ISO week key, e.g. 2026-W36
  function weekKey(date) {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const day = d.getUTCDay() || 7; d.setUTCDate(d.getUTCDate() + 4 - day);
    const yStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const wk = Math.ceil(((d - yStart) / 864e5 + 1) / 7);
    return `${d.getUTCFullYear()}-W${pad(wk)}`;
  }
  const thisWeek = () => weekKey(new Date());
  function weekAgo(n) { const d = new Date(); d.setDate(d.getDate() - n * 7); return weekKey(d); }

  // ---------------- Seed ----------------
  function seed() {
    const users = [
      { id: 't1', name: '오진우', role: 'teacher', title: '6학년 3반 담임 · 사회/국어', color: '#b1471e' },
      { id: 's1', name: '김서준', role: 'student', code: 'A7', color: '#4338ca' },
      { id: 's2', name: '이하윤', role: 'student', code: 'B3', color: '#0f766e' },
      { id: 's3', name: '박도현', role: 'student', code: 'C1', color: '#b7791f' },
      { id: 's4', name: '최지아', role: 'student', code: 'D9', color: '#86198f' },
    ];
    const classes = [
      { id: 'c1', name: '6학년 3반', school: '한들초등학교', year: 2026, term: '2026-2', emoji: '📓', color: '#b1471e', code: 'HANDLE-63' },
    ];
    const members = [
      { userId: 't1', classId: 'c1', role: 'teacher' },
      { userId: 's1', classId: 'c1', role: 'student' },
      { userId: 's2', classId: 'c1', role: 'student' },
      { userId: 's3', classId: 'c1', role: 'student' },
      { userId: 's4', classId: 'c1', role: 'student' },
    ];
    // 2022 개정 교육과정의 내용체계 구조(영역·핵심아이디어·지식이해/과정기능/가치태도·성취기준)를
    // 수업 시연용으로 재구성한 예시. 실제 교육과정 문서를 그대로 가져온 것이 아니라 공개된 교육과정 지식 수준의 샘플.
    const units = [
      {
        id: 'u1', classId: 'c1', subject: '사회', grade: '초6', domain: '정치·민주주의',
        coreIdea: '민주주의는 시민이 권력의 주인으로서 함께 결정하고 그 결정에 책임지는 삶의 방식이다.',
        contentElements: {
          know: ['민주주의의 의미', '국민 주권', '삼권 분립', '생활 속 민주주의'],
          skill: ['공적 문제 탐구하기', '근거 들어 주장하기', '합의 절차로 결정하기'],
          value: ['참여와 책임', '다수결과 소수 존중', '공동체 의식'],
        },
        standards: [
          { code: '[6사08-01]', text: '생활 속 사례에서 민주주의의 의미와 중요성을 설명한다.', note: '학급·지역의 실제 문제와 연결한다.' },
          { code: '[6사08-02]', text: '민주적 의사결정 원리(다수결·소수 존중·대화와 타협)를 적용해 문제를 해결한다.' },
        ],
        goal: '학급의 실제 갈등을 민주적 절차로 해결하고, 그 과정을 근거를 들어 설명할 수 있다.',
        createdAt: daysAgo(12), assigned: ['s1', 's2', 's3', 's4'],
      },
      {
        id: 'u2', classId: 'c1', subject: '국어', grade: '초6', domain: '쓰기 — 주장하는 글',
        coreIdea: '필자는 독자와 목적을 고려해 타당한 근거로 주장을 구성하며, 글쓰기는 생각을 다듬는 과정이다.',
        contentElements: {
          know: ['주장과 근거의 관계', '글의 목적과 독자', '문단의 짜임'],
          skill: ['근거의 타당성 점검', '고쳐쓰기', '자료를 인용하기'],
          value: ['책임 있는 표현', '독자에 대한 예의', '자기 점검 태도'],
        },
        standards: [
          { code: '[6국03-04]', text: '적절한 근거를 들어 주장하는 글을 쓴다.', note: '사회과에서 탐구한 문제를 소재로 삼을 수 있다.' },
        ],
        goal: '사회 시간에 탐구한 학급 문제에 대해, 타당한 근거를 갖춘 주장하는 글 한 편을 쓰고 스스로 고쳐 쓴다.',
        createdAt: daysAgo(5), assigned: ['s1', 's2', 's3', 's4'],
      },
    ];
    // 탐구질문 = 도달점에 닿기 위해 연역한 질문 (교사 작성). 차시질문은 children.
    const inquiries = [
      { id: 'q1', unitId: 'u1', order: 1, source: 'teacher', question: '우리 반에서 ‘함께 결정한다’는 것은 실제로 어떤 모습일까?', children: ['다수결만으로 정하면 무엇이 남을까?', '소수의 의견은 왜, 어떻게 지켜야 할까?'] },
      { id: 'q2', unitId: 'u1', order: 2, source: 'teacher', question: '결정에 ‘책임진다’는 것은 무엇을 뜻할까?', children: ['내가 낸 의견이 채택되면 나는 무엇을 해야 하나?'] },
      { id: 'q3', unitId: 'u2', order: 1, source: 'teacher', question: '같은 주장도 왜 어떤 글은 설득되고 어떤 글은 설득되지 않을까?', children: ['근거가 ‘타당하다’는 것을 어떻게 알 수 있을까?'] },
    ];
    // 일걷쓰(Work): 관찰→질문→탐구→사유. 학생이 먼저 쓴 원본. 볼트에만 존재.
    const works = [
      {
        id: 'w1', unitId: 'u1', inquiryId: 'q1', classId: 'c1', studentId: 's1',
        observe: '지난주 자리 바꾸기를 다수결로 정했는데, 세 명이 계속 불만이었다.',
        question: '다수가 정했는데도 왜 반이 편하지 않았을까?',
        explore: '책과 선생님 설명을 보니, 민주주의는 다수결‘만’이 아니라 소수의 이유도 듣는 것이라고 했다. 우리는 이유를 안 들었다.',
        reflect: '다음엔 정하기 전에 반대하는 사람의 이유부터 물어봐야겠다. 결정보다 과정이 반을 편하게 한다.',
        createdAt: daysAgo(9), updatedAt: daysAgo(9),
      },
      {
        id: 'w2', unitId: 'u1', inquiryId: 'q1', classId: 'c1', studentId: 's2',
        observe: '급식 당번 순서를 투표로 정했다.',
        question: '투표는 공정한가?',
        explore: '', reflect: '',
        createdAt: daysAgo(8), updatedAt: daysAgo(8),
      },
    ];
    // 인출(Retrieval): 단원 키워드(가중치=배점). 학생 시도는 hits.
    const retrievals = [
      {
        id: 'r1', unitId: 'u1',
        keywords: [
          { term: '국민 주권', weight: 3 }, { term: '다수결', weight: 2 }, { term: '소수 존중', weight: 3 },
          { term: '대화와 타협', weight: 2 }, { term: '책임', weight: 2 }, { term: '삼권 분립', weight: 1 },
        ],
        attempts: {
          s1: { hits: ['국민 주권', '소수 존중', '책임'], wrong: ['삼권 분립'], at: daysAgo(7) },
          s2: { hits: ['다수결'], wrong: [], at: daysAgo(6) },
        },
      },
    ];
    // 전이(Transfer): 내용교과 → 도구교과, 실생활. 체크 3칸.
    const transfers = [
      {
        id: 'x1', workId: 'w1', studentId: 's1', unitId: 'u1',
        fromSubject: '사회(민주주의)', toSubject: '국어(주장하는 글)',
        realLife: '학급 회의 규칙 제안서 쓰기',
        checks: [
          { label: '내용교과 개념을 정확히 옮겼나', ok: true },
          { label: '도구교과 형식(주장-근거)을 갖췄나', ok: true },
          { label: '실생활 맥락에 연결됐나', ok: false },
        ],
        createdAt: daysAgo(4),
      },
    ];
    // AI 호출 로그: 원문 없음. 마스킹된 입력과 질문 초안, 학생 수용 여부만.
    const runs = [
      { id: 'run1', purpose: 'inquiry-draft', unitId: 'u1', maskedInput: '[학생A]의 관찰: 다수결로 정했으나 [수]명이 불만…', questionDraft: '다수가 정한 결정이 모두를 편하게 하지 못한 까닭은 무엇일까?', acceptedBy: 't1', model: 'demo', at: daysAgo(9), purgedAt: null },
    ];
    // 주간 신호(비식별): STATEtistics가 학기초→학기말로 그린다. studentCode는 학급 내 가명.
    const signals = seedSignals();
    return {
      version: 1, createdAt: new Date().toISOString(),
      users, classes, members, units, inquiries, works, retrievals, transfers, runs, signals,
      accessLog: [{ who: 't1', what: 'vault:open', at: new Date().toISOString() }],
    };
  }
  function seedSignals() {
    const out = [];
    const codes = ['A7', 'B3', 'C1', 'D9'];
    // 학기초(8주 전) → 현재까지, 인출 적중률·전이 성공이 서서히 오르는 곡선
    for (let w = 8; w >= 0; w--) {
      const wk = weekAgo(w);
      const progress = (8 - w) / 8; // 0 → 1
      codes.forEach((code, i) => {
        const base = 0.35 + progress * 0.5 + (i - 1.5) * 0.03;
        const total = 6;
        const hit = Math.max(0, Math.min(total, Math.round(base * total + (Math.random() - 0.5))));
        out.push({
          week: wk, studentCode: code, unitId: w > 4 ? 'u1' : 'u2',
          inquiryDone: Math.random() < 0.6 + progress * 0.3 ? 1 : 0,
          draftDone: Math.random() < 0.5 + progress * 0.4 ? 1 : 0,
          keywordHit: hit, keywordTotal: total,
          gapMissing: total - hit, gapRepeat: Math.round(Math.random() * (1 - progress) * 2), gapWrong: Math.round(Math.random() * (1 - progress) * 2),
          transferOk: Math.random() < 0.2 + progress * 0.6 ? 1 : 0,
          teacherOverride: 0,
        });
      });
    }
    return out;
  }

  // ---------------- Store ----------------
  let state = null, currentUserId = null;
  function load() {
    try { const raw = localStorage.getItem(KEY); if (raw) state = JSON.parse(raw); } catch (e) { state = null; }
    if (!state || state.version !== 1) { state = seed(); save(); }
    try { currentUserId = localStorage.getItem(USER_KEY) || 't1'; } catch (e) { currentUserId = 't1'; }
    if (!state.users.some((u) => u.id === currentUserId)) currentUserId = 't1';
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {} }
  function reset() { state = seed(); save(); setUser('t1'); }
  function setUser(id) { currentUserId = id; try { localStorage.setItem(USER_KEY, id); } catch (e) {} }

  const me = () => state.users.find((u) => u.id === currentUserId);
  const user = (id) => state.users.find((u) => u.id === id) || { id, name: '?', role: 'student', color: '#9ca3af' };
  const cls = (id) => state.classes.find((c) => c.id === id);
  const unit = (id) => state.units.find((u) => u.id === id);
  const work = (id) => state.works.find((w) => w.id === id);

  // ---- Authorization: class_members가 원장. 객체 단위 재검증. ----
  function myClasses(userId = currentUserId) {
    const ids = state.members.filter((m) => m.userId === userId).map((m) => m.classId);
    return state.classes.filter((c) => ids.includes(c.id));
  }
  function roleIn(classId, userId = currentUserId) { const m = state.members.find((x) => x.classId === classId && x.userId === userId); return m ? m.role : null; }
  const isTeacherOf = (classId, userId = currentUserId) => roleIn(classId, userId) === 'teacher';
  function canAccessUnit(u, userId = currentUserId) {
    if (!u) return false;
    if (isTeacherOf(u.classId, userId)) return true;
    return (u.assigned || []).includes(userId) && roleIn(u.classId, userId) === 'student';
  }
  function myUnits(userId = currentUserId) {
    const classIds = myClasses(userId).map((c) => c.id);
    return state.units.filter((u) => classIds.includes(u.classId) && canAccessUnit(u, userId))
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }
  function classmates(classId) { return state.members.filter((m) => m.classId === classId && m.role === 'student').map((m) => user(m.userId)); }

  // ---- Units / Inquiries ----
  function addUnit(data) {
    const u = Object.assign({ id: uid('u'), createdAt: new Date().toISOString(), assigned: classmates(data.classId).map((s) => s.id), contentElements: { know: [], skill: [], value: [] }, standards: [] }, data);
    state.units.unshift(u); logAccess('unit:create', u.id); save(); return u;
  }
  function removeUnit(id) {
    state.units = state.units.filter((u) => u.id !== id);
    state.inquiries = state.inquiries.filter((q) => q.unitId !== id);
    state.works = state.works.filter((w) => w.unitId !== id);
    state.retrievals = state.retrievals.filter((r) => r.unitId !== id);
    save();
  }
  const inquiriesOf = (unitId) => state.inquiries.filter((q) => q.unitId === unitId).sort((a, b) => a.order - b.order);
  function addInquiry(unitId, question, source = 'teacher', children = []) {
    const q = { id: uid('q'), unitId, order: inquiriesOf(unitId).length + 1, source, question, children };
    state.inquiries.push(q); save(); return q;
  }
  function removeInquiry(id) { state.inquiries = state.inquiries.filter((q) => q.id !== id); save(); }

  // ---- Works (일걷쓰) ----
  const worksOf = (unitId) => state.works.filter((w) => w.unitId === unitId).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  function myWork(unitId, studentId = currentUserId) { return state.works.find((w) => w.unitId === unitId && w.studentId === studentId); }
  function saveWork(unitId, inquiryId, fields) {
    let w = myWork(unitId);
    if (!w) { w = { id: uid('w'), unitId, inquiryId, classId: unit(unitId).classId, studentId: currentUserId, observe: '', question: '', explore: '', reflect: '', createdAt: new Date().toISOString() }; state.works.push(w); }
    Object.assign(w, fields, { inquiryId: inquiryId || w.inquiryId, updatedAt: new Date().toISOString() });
    recordSignal(w); logAccess('work:save', w.id); save(); return w;
  }
  const workDone = (w) => !!(w && w.observe && w.question && w.explore && w.reflect);

  // ---- Retrieval / Gap ----
  const retrievalOf = (unitId) => state.retrievals.find((r) => r.unitId === unitId);
  function ensureRetrieval(unitId) { let r = retrievalOf(unitId); if (!r) { r = { id: uid('r'), unitId, keywords: [], attempts: {} }; state.retrievals.push(r); save(); } return r; }
  function setKeywords(unitId, kws) { const r = ensureRetrieval(unitId); r.keywords = kws; save(); }
  function recordAttempt(unitId, hits, wrong) {
    const r = ensureRetrieval(unitId);
    r.attempts[currentUserId] = { hits, wrong: wrong || [], at: new Date().toISOString() };
    recordSignal(myWork(unitId) || { unitId, classId: unit(unitId).classId, studentId: currentUserId });
    logAccess('retrieval:attempt', unitId); save();
  }
  function gapFor(unitId, studentId = currentUserId) {
    const r = retrievalOf(unitId); if (!r) return { missing: [], repeat: [], wrong: [] };
    const a = r.attempts[studentId] || { hits: [], wrong: [] };
    const missing = r.keywords.filter((k) => !a.hits.includes(k.term)).map((k) => k.term);
    return { missing, repeat: [], wrong: a.wrong || [] };
  }
  function retrievalScore(unitId, studentId = currentUserId) {
    const r = retrievalOf(unitId); if (!r || !r.keywords.length) return null;
    const a = r.attempts[studentId]; if (!a) return null;
    const total = r.keywords.reduce((s, k) => s + k.weight, 0);
    const got = r.keywords.filter((k) => a.hits.includes(k.term)).reduce((s, k) => s + k.weight, 0);
    return { got, total, pct: Math.round((got / total) * 100) };
  }

  // ---- Transfer ----
  const transferOf = (workId) => state.transfers.find((x) => x.workId === workId);
  function saveTransfer(data) {
    let x = data.id ? state.transfers.find((t) => t.id === data.id) : transferOf(data.workId);
    if (!x) { x = { id: uid('x'), createdAt: new Date().toISOString(), studentId: currentUserId }; state.transfers.push(x); }
    Object.assign(x, data);
    const w = work(x.workId); if (w) recordSignal(w);
    logAccess('transfer:save', x.id); save(); return x;
  }

  // ---- AI Run ledger (원문 없음) ----
  function logRun(entry) {
    const r = Object.assign({ id: uid('run'), at: new Date().toISOString(), acceptedBy: null, purgedAt: null }, entry);
    state.runs.unshift(r); save(); return r;
  }
  function acceptRun(id, userId = currentUserId) { const r = state.runs.find((x) => x.id === id); if (r) { r.acceptedBy = userId; save(); } }
  const runs = () => state.runs;

  // ---- Access log ----
  function logAccess(what, ref) {
    state.accessLog = state.accessLog || [];
    state.accessLog.unshift({ who: currentUserId, what, ref, at: new Date().toISOString() });
    if (state.accessLog.length > 200) state.accessLog.length = 200;
  }
  const accessLog = () => state.accessLog || [];

  // ---- Weekly signals (비식별) ----
  function studentCode(userId) { const u = user(userId); return u.code || u.id.toUpperCase(); }
  function recordSignal(w) {
    if (!w || !w.studentId) return;
    const wk = thisWeek(), code = studentCode(w.studentId), unitId = w.unitId;
    let s = state.signals.find((x) => x.week === wk && x.studentCode === code && x.unitId === unitId);
    if (!s) { s = { week: wk, studentCode: code, unitId, inquiryDone: 0, draftDone: 0, keywordHit: 0, keywordTotal: 0, gapMissing: 0, gapRepeat: 0, gapWrong: 0, transferOk: 0, teacherOverride: 0 }; state.signals.push(s); }
    const full = myWork(unitId, w.studentId);
    s.draftDone = workDone(full) ? 1 : (full ? 0 : s.draftDone);
    s.inquiryDone = full && full.question ? 1 : s.inquiryDone;
    const sc = retrievalScore(unitId, w.studentId);
    if (sc) { const r = retrievalOf(unitId); s.keywordTotal = r.keywords.length; s.keywordHit = r.keywords.filter((k) => (r.attempts[w.studentId]?.hits || []).includes(k.term)).length; s.gapMissing = s.keywordTotal - s.keywordHit; }
    const x = state.transfers.find((t) => t.studentId === w.studentId && t.unitId === unitId);
    if (x) s.transferOk = x.checks.every((c) => c.ok) ? 1 : 0;
  }
  // 학기 시계열: 주별 평균. 원문·이름 없이 숫자만.
  function semesterSeries() {
    const byWeek = {};
    state.signals.forEach((s) => { (byWeek[s.week] = byWeek[s.week] || []).push(s); });
    const weeks = Object.keys(byWeek).sort();
    return weeks.map((wk) => {
      const arr = byWeek[wk];
      const avg = (f) => arr.reduce((a, s) => a + f(s), 0) / arr.length;
      const hitPct = avg((s) => s.keywordTotal ? s.keywordHit / s.keywordTotal : 0) * 100;
      return {
        week: wk,
        retrieval: Math.round(hitPct),
        gap: Math.round(avg((s) => s.gapMissing + s.gapRepeat + s.gapWrong) * 10) / 10,
        transfer: Math.round(avg((s) => s.transferOk) * 100),
        rhythm: Math.round(avg((s) => s.draftDone) * 100),
        n: arr.length,
      };
    });
  }

  // ---- Members / join ----
  function addStudent(classId, name) {
    const colors = ['#4338ca', '#0f766e', '#b7791f', '#86198f', '#b1471e', '#0369a1'];
    const n = classmates(classId).length;
    const u = { id: uid('s'), name, role: 'student', code: String.fromCharCode(65 + (n % 26)) + (n + 1), color: colors[n % colors.length] };
    state.users.push(u); state.members.push({ userId: u.id, classId, role: 'student' });
    state.units.filter((x) => x.classId === classId).forEach((x) => { x.assigned = x.assigned || []; if (!x.assigned.includes(u.id)) x.assigned.push(u.id); });
    save(); return u;
  }

  // ---- Sovereignty: export / import / purge ----
  function exportJSON() { return JSON.stringify(state, null, 2); }
  function importJSON(text) {
    const s = JSON.parse(text);
    if (!s || !Array.isArray(s.units) || !Array.isArray(s.users) || !Array.isArray(s.classes) || !Array.isArray(s.members)) throw new Error('볼트 형식이 아니에요');
    if (s.version !== 1) throw new Error(`볼트 버전(${s.version ?? '?'})이 달라요`);
    ['inquiries', 'works', 'retrievals', 'transfers', 'runs', 'signals', 'accessLog'].forEach((k) => { if (!Array.isArray(s[k])) s[k] = []; });
    state = s;
    if (!state.users.some((u) => u.id === currentUserId)) setUser((state.users.find((u) => u.role === 'teacher') || state.users[0]).id);
    logAccess('vault:import', `${state.units.length} units`); save();
  }
  // 학생 원본(일걷쓰)만 Markdown 번들로. 볼트가 앱보다 오래 살도록 — 어떤 앱으로도 읽힌다.
  function exportMarkdown() {
    let md = `# Bawkward 볼트 내보내기\n> ${new Date().toLocaleString('ko-KR')} · 원본은 학생·교사의 것입니다.\n\n`;
    myUnits().forEach((u) => {
      md += `\n## [${u.subject}] ${u.domain}\n**핵심 아이디어:** ${u.coreIdea}\n\n**도달점:** ${u.goal}\n\n`;
      inquiriesOf(u.id).forEach((q) => { md += `- 탐구질문: ${q.question}\n`; });
      worksOf(u.id).filter((w) => isTeacherOf(u.classId) || w.studentId === currentUserId).forEach((w) => {
        md += `\n### 일걷쓰 — ${user(w.studentId).name}\n- 관찰: ${w.observe}\n- 질문: ${w.question}\n- 탐구: ${w.explore}\n- 사유: ${w.reflect}\n`;
      });
    });
    return md;
  }
  // 학기말 파기: 원문·코드표·신호를 함께 지운다.
  function purgeTerm(opts) {
    if (opts.works) state.works = [];
    if (opts.retrievals) state.retrievals.forEach((r) => (r.attempts = {}));
    if (opts.transfers) state.transfers = [];
    if (opts.signals) state.signals = [];
    if (opts.runs) state.runs = [];
    if (opts.codes) state.users.forEach((u) => { if (u.role === 'student') delete u.code; });
    logAccess('vault:purge', Object.keys(opts).filter((k) => opts[k]).join(','));
    save();
  }

  // ---- 교육과정 템플릿: docs/curriculum/*.md 의 "Bawkward 단원 매핑 제안"을 그대로 옮긴 시드 후보.
  // 성취기준 문장은 상태([검색확인]/[대조필요])를 note 에 남겨, 원문 확정 전엔 초안임이 화면에 보이게 한다.
  NS.TEMPLATES = [
    {
      id: 'tpl-eng3', label: '초3 영어 · 소리로 만나는 영어 (2022 개정 3~4학년군)', subject: '영어', grade: '초3', domain: '이해·표현 — 소리·인사·자기소개',
      coreIdea: '쉽고 친숙한 영어는 소리로 먼저 만나고, 흥미를 가지고 듣고 따라 말하며 익힌다.',
      goal: '친숙한 소재의 쉬운 영어 노래·이야기를 흥미를 갖고 듣고, 인사·자기소개를 말과 글로 표현할 수 있다.',
      contentElements: { know: ['알파벳과 소리', '기초 낱말', '인사·자기소개 표현'], skill: ['듣고 따라 말하기', '세부정보 파악', '낱말 쓰기'], value: ['흥미·자신감', '공감하며 듣기'] },
      standards: [
        { code: '[4영01-03]', text: '쉽고 간단한 단어, 어구, 문장을 듣고 강세, 리듬, 억양을 식별한다.', note: '검색확인' },
        { code: '[4영01-08]', text: '다양한 매체로 표현된 담화나 문장을 흥미를 가지고 듣거나 읽는다.', note: '검색확인' },
        { code: '[4영01-09]', text: '시, 노래, 이야기를 공감하며 듣는다.', note: '검색확인' },
        { code: '[4영02-09]', text: '적절한 매체나 전략을 활용하여 창의적으로 의미를 표현한다.', note: '검색확인' },
      ],
      inquiries: [
        { question: '같은 인사도 왜 상황마다 다르게 말할까?', children: ['아침·저녁·처음 만났을 때 인사는 어떻게 다를까?'] },
        { question: '노래로 배우면 왜 더 잘 외워질까?', children: ['리듬이 있으면 어떤 낱말이 더 잘 들릴까?'] },
      ],
      keywords: [{ term: '알파벳', weight: 1 }, { term: '강세·리듬', weight: 2 }, { term: '인사', weight: 2 }, { term: '자기소개', weight: 3 }],
    },
    {
      id: 'tpl-sci6-energy', label: '초6 과학 · 에너지의 전환 (2022 개정 5~6학년군)', subject: '과학', grade: '초6', domain: '운동과 에너지 — 에너지와 생활',
      coreIdea: '에너지는 형태를 바꾸며 이동하고, 우리 생활은 그 전환을 이용해 이루어진다.',
      goal: '생활 속 에너지 전환 사례를 찾아, 어떤 형태에서 어떤 형태로 바뀌는지 근거를 들어 설명할 수 있다.',
      contentElements: { know: ['에너지의 형태(열·빛·전기·운동·화학)', '에너지 전환'], skill: ['사례 관찰·분류하기', '전환 과정 추리하기', '자료로 설명하기'], value: ['에너지 절약의 필요성 인식'] },
      standards: [
        { code: '[6과□□-□□]', text: '(에너지 형태와 전환 관련 성취기준 — 교육부 고시 별책9 원문으로 확정)', note: '대조필요' },
      ],
      inquiries: [
        { question: '전등이 켜지기까지 에너지는 몇 번 모습을 바꿀까?', children: ['발전소에서 우리 집까지 에너지는 어떤 길을 지날까?'] },
        { question: '에너지는 사라지지 않는다는데 왜 우리는 ‘아껴’ 써야 할까?', children: [] },
      ],
      keywords: [{ term: '에너지 형태', weight: 2 }, { term: '전환', weight: 3 }, { term: '열에너지', weight: 1 }, { term: '전기에너지', weight: 1 }, { term: '절약', weight: 2 }],
    },
    {
      id: 'tpl-sci6-season', label: '초6 과학 · 계절의 변화 (2022 개정 5~6학년군)', subject: '과학', grade: '초6', domain: '지구와 우주 — 계절의 변화',
      coreIdea: '지구와 달·태양의 규칙적인 운동이 낮과 밤, 계절, 달의 모양 변화를 만든다.',
      goal: '계절의 변화가 지구 자전축의 기울기와 공전으로 생김을 모형으로 설명할 수 있다.',
      contentElements: { know: ['태양의 남중 고도', '낮의 길이', '자전축의 기울기와 공전'], skill: ['고도·그림자 길이 측정', '모형 실험 설계', '자료 해석'], value: ['증거에 기반한 판단', '오개념 점검 태도'] },
      standards: [
        { code: '[6과□□-□□]', text: '(계절의 변화 원인 관련 성취기준 — 교육부 고시 별책9 원문으로 확정)', note: '대조필요' },
      ],
      inquiries: [
        { question: '여름이 더운 건 태양이 가까워져서일까?', children: ['남중 고도가 높으면 왜 더 더울까?', '낮의 길이는 계절마다 왜 달라질까?'] },
      ],
      keywords: [{ term: '남중 고도', weight: 3 }, { term: '자전축 기울기', weight: 3 }, { term: '공전', weight: 2 }, { term: '낮의 길이', weight: 1 }],
    },
  ];
  // 템플릿 → 단원 + 탐구질문 + 인출 키워드 한 번에 생성.
  function addUnitFromTemplate(tplId, classId) {
    const t = NS.TEMPLATES.find((x) => x.id === tplId); if (!t) throw new Error('템플릿이 없어요');
    const u = addUnit({ classId, subject: t.subject, grade: t.grade, domain: t.domain, coreIdea: t.coreIdea, goal: t.goal, contentElements: JSON.parse(JSON.stringify(t.contentElements)), standards: JSON.parse(JSON.stringify(t.standards)), templateId: t.id });
    (t.inquiries || []).forEach((q) => addInquiry(u.id, q.question, 'teacher', (q.children || []).slice()));
    if (t.keywords?.length) setKeywords(u.id, t.keywords.map((k) => Object.assign({}, k)));
    return u;
  }

  NS.util = { uid, today, iso, thisWeek };
  NS.SUBJECTS = ['국어', '사회', '수학', '과학', '도덕', '영어', '실과', '미술', '음악', '체육', '창의적 체험활동'];
  NS.STAGES = [
    { key: 'observe', label: '관찰', icon: '👁', desc: '무엇을 보았나. 사실만 적는다.' },
    { key: 'question', label: '질문', icon: '❓', desc: '그것에서 무엇이 궁금해졌나.' },
    { key: 'explore', label: '탐구', icon: '🔍', desc: '자료·수업에서 무엇을 알아냈나.' },
    { key: 'reflect', label: '사유', icon: '💭', desc: '그래서 나는 무엇을 하기로 했나(행동·전이).' },
  ];
  NS.store = {
    load, save, reset, setUser, me, user, cls, unit, work, get state() { return state; },
    myClasses, roleIn, isTeacherOf, canAccessUnit, myUnits, classmates,
    addUnit, removeUnit, inquiriesOf, addInquiry, removeInquiry,
    worksOf, myWork, saveWork, workDone,
    retrievalOf, ensureRetrieval, setKeywords, recordAttempt, gapFor, retrievalScore,
    transferOf, saveTransfer, logRun, acceptRun, runs, accessLog, studentCode,
    semesterSeries, addStudent, exportJSON, importJSON, exportMarkdown, purgeTerm, addUnitFromTemplate,
  };
})();
