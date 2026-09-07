/* Bawkward — 화면 · 해시 라우터 · 이벤트 위임 */
(function () {
  'use strict';
  const NS = window.BW, S = NS.store, AI = NS.ai;
  const $ = (s, r = document) => r.querySelector(s);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const DOW = ['일', '월', '화', '수', '목', '금', '토'];
  const fmt = {
    date: (i) => { const d = new Date(i); return `${d.getMonth() + 1}월 ${d.getDate()}일`; },
    ago: (i) => { const s = (Date.now() - new Date(i)) / 1e3; if (s < 60) return '방금'; if (s < 3600) return `${s / 60 | 0}분 전`; if (s < 86400) return `${s / 3600 | 0}시간 전`; if (s < 6048e2) return `${s / 86400 | 0}일 전`; return fmt.date(i); },
    dt: (i) => { const d = new Date(i); return `${d.getMonth() + 1}.${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; },
  };
  NS.fmt = fmt;
  const initials = (n) => (n || '?').trim().slice(0, 1);
  const avatar = (u, sz = '') => `<span class="avatar ${sz}" style="background:${u.color || '#9ca3af'}" title="${esc(u.name)}">${esc(initials(u.name))}</span>`;
  const roleChip = (u) => `<span class="chip ${u.role}">${u.role === 'teacher' ? '교사' : '학생'}</span>`;

  const ui = { route: {}, aiMsgs: [], aiBusy: false, statTab: 'retrieval' };

  // ---- toast / modal ----
  function toast(m, k = '') { const w = $('#toasts'); const e = document.createElement('div'); e.className = `toast ${k}`; e.textContent = m; w.appendChild(e); setTimeout(() => { e.style.opacity = '0'; e.style.transition = 'opacity .3s'; setTimeout(() => e.remove(), 300); }, 2200); }
  function openModal(html, o = {}) { const r = $('#modal-root'); r.innerHTML = `<div class="modal-back" data-action="modal-back"><div class="modal ${o.wide ? 'wide' : ''}" role="dialog">${html}</div></div>`; r.hidden = false; document.body.style.overflow = 'hidden'; const f = r.querySelector('input:not([type=hidden]),textarea,select'); if (f) setTimeout(() => f.focus(), 30); }
  function closeModal() { const r = $('#modal-root'); r.innerHTML = ''; r.hidden = true; document.body.style.overflow = ''; }
  const mHead = (t) => `<div class="modal-head"><h3>${t}</h3><button class="icon-btn" data-action="close-modal">✕</button></div>`;

  // ---- router ----
  function parse() {
    const h = (location.hash || '#/').replace(/^#\/?/, ''); const [p, qs] = h.split('?');
    const seg = p.split('/').filter(Boolean); const q = Object.fromEntries(new URLSearchParams(qs || ''));
    if (!seg.length) return { name: 'home', q };
    return { name: seg[0], id: seg[1], sub: seg[2], q };
  }
  const go = (p) => { location.hash = p; };

  function render() {
    ui.route = parse(); const r = ui.route; let html = '';
    try {
      switch (r.name) {
        case 'home': html = viewHome(); break;
        case 'units': html = viewUnits(); break;
        case 'unit': html = viewUnit(r.id); break;
        case 'write': html = viewWrite(r.id); break;
        case 'retrieve': html = viewRetrieve(r.id); break;
        case 'transfer': html = viewTransfer(r.id); break;
        case 'board': html = viewBoard(r.id); break;
        case 'stats': html = viewStats(); break;
        case 'vault': html = viewVault(); break;
        case 'ai': html = viewAI(); break;
        case 'me': html = viewMe(); break;
        default: html = `<div class="card empty"><div class="big">🧭</div>없는 화면이에요. <a href="#/">홈으로</a></div>`;
      }
    } catch (e) { console.error(e); html = `<div class="card empty"><div class="big">⚠️</div>화면 오류: <span class="small">${esc(e.message)}</span><div class="mt-12"><button class="btn" data-action="reset">볼트 초기화</button></div></div>`; }
    $('#view').innerHTML = html;
    $('#sidebar').innerHTML = sidebar();
    $('#rail').innerHTML = rail();
    $('#bottom-nav').innerHTML = bottomNav();
    const m = S.me();
    $('#user-chip').innerHTML = `${avatar(m, 'sm')}<span><div class="name">${esc(m.name)}</div><div class="role">${m.role === 'teacher' ? '교사' : '학생'}</div></span>`;
    window.scrollTo({ top: 0 });
    if (r.name === 'ai') { const b = $('#ai-chat'); if (b) b.scrollTop = b.scrollHeight; }
  }

  function navItem(href, ic, label, active, badge) { return `<a href="${href}" class="${active ? 'active' : ''}"><span class="ic">${ic}</span>${label}${badge ? `<span class="badge">${badge}</span>` : ''}</a>`; }
  function sidebar() {
    const r = ui.route, m = S.me(), teacher = m.role === 'teacher';
    const todo = todoItems().length;
    return `<nav class="nav">
      ${navItem('#/', '🏠', '오늘', r.name === 'home', todo)}
      ${navItem('#/units', '📚', teacher ? '단원 설계' : '내 단원', r.name === 'unit' || r.name === 'units' || r.name === 'write' || r.name === 'retrieve' || r.name === 'transfer' || r.name === 'board')}
      ${navItem('#/stats', '📈', 'STATEtistics', r.name === 'stats')}
      ${navItem('#/ai', '🐣', 'Bawk 질문조교', r.name === 'ai')}
      <div class="nav-section">데이터 주권</div>
      ${navItem('#/vault', '🔐', '볼트 · 원장', r.name === 'vault')}
      ${navItem('#/me', '👤', '마이페이지', r.name === 'me')}
    </nav>
    <div class="note mt-16">원본은 <b>이 브라우저 볼트</b>에만 있습니다. 외부 모델에는 이름을 가린 뒤 <b>질문 초안</b>만 오갑니다.</div>`;
  }
  function bottomNav() { const r = ui.route; const it = (h, i, l, a) => `<a href="${h}" class="${a ? 'active' : ''}"><span class="ic">${i}</span>${l}</a>`; return it('#/', '🏠', '오늘', r.name === 'home') + it('#/units', '📚', '단원', ['units', 'unit', 'write', 'retrieve', 'transfer', 'board'].includes(r.name)) + it('#/stats', '📈', '통계', r.name === 'stats') + it('#/ai', '🐣', 'Bawk', r.name === 'ai') + it('#/me', '👤', '나', r.name === 'me'); }

  function todoItems() {
    const m = S.me(), out = [];
    S.myUnits().forEach((u) => {
      if (m.role === 'student') {
        const w = S.myWork(u.id);
        if (!S.workDone(w)) out.push({ ic: '✍️', t: '일견쓰 이어쓰기', s: `${u.subject} · ${u.domain}`, go: `#/write/${u.id}` });
        if (!(S.retrievalOf(u.id)?.attempts?.[m.id]) && S.retrievalOf(u.id)?.keywords?.length) out.push({ ic: '🎯', t: '인출 점검', s: u.domain, go: `#/retrieve/${u.id}` });
      } else {
        if (!S.inquiriesOf(u.id).length) out.push({ ic: '🧭', t: '탐구질문 설계', s: `${u.subject} · ${u.domain}`, go: `#/unit/${u.id}` });
        const pend = S.worksOf(u.id).filter((w) => S.workDone(w)).length;
        if (pend) out.push({ ic: '📖', t: `학급 일견쓰 ${pend}편 보기`, s: u.domain, go: `#/board/${u.id}` });
      }
    });
    return out.slice(0, 6);
  }
  function rail() {
    const m = S.me();
    const series = S.semesterSeries(); const last = series[series.length - 1];
    return `<div class="card">
      <div class="card-title">🧭 백워드 설계</div>
      <div class="small muted mb-8">도달점에서 거꾸로 질문을 세우고, 학생은 먼저 써 본 뒤 배웁니다.</div>
      <div class="steps" style="flex-direction:column;align-items:stretch;gap:6px">
        <div class="step"><span class="n">1</span> 핵심아이디어 · 도달점</div>
        <div class="step"><span class="n">2</span> 탐구질문 연역</div>
        <div class="step"><span class="n">3</span> 일견쓰(먼저 쓰기)</div>
        <div class="step"><span class="n">4</span> 인출 · 갭</div>
        <div class="step"><span class="n">5</span> 전이</div>
      </div>
    </div>
    <div class="card">
      <div class="card-title">✅ 할 일</div>
      ${todoItems().length ? todoItems().map((t) => `<div class="todo" data-action="goto" data-go="${t.go}"><span class="ic">${t.ic}</span><div><div class="t">${esc(t.t)}</div><div class="s">${esc(t.s)}</div></div></div>`).join('') : '<div class="small muted">모두 마쳤어요 🎉</div>'}
    </div>
    ${last ? `<div class="card"><div class="card-title">📈 이번 주 신호</div><div class="small muted mb-8">비식별 숫자만 · <a href="#/stats">추이 보기</a></div>
      <div class="stat-grid" style="grid-template-columns:1fr 1fr"><div class="stat"><div class="n">${last.retrieval}%</div><div class="l">인출 적중</div></div><div class="stat"><div class="n">${last.transfer}%</div><div class="l">전이 성공</div></div></div></div>` : ''}`;
  }

  // ---------------- Home ----------------
  function viewHome() {
    const m = S.me(), teacher = m.role === 'teacher';
    const h = new Date().getHours(); const g = h < 12 ? '좋은 아침이에요' : h < 18 ? '좋은 오후예요' : '편안한 저녁이에요';
    const units = S.myUnits();
    return `<div class="page-head"><div>
      <div class="section-title">${g}, ${esc(m.name)} ${teacher ? '선생님' : '학생'} 👋</div>
      <div class="muted small">${new Date().toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'long' })} · Backward Design 학습 볼트</div>
    </div>${teacher ? `<button class="btn primary" data-action="new-unit">+ 단원 설계</button>` : ''}</div>

    <div class="card" style="background:var(--ink);color:var(--paper);border-color:var(--ink)">
      <div class="row between wrap" style="gap:12px">
        <div style="max-width:560px">
          <div class="tiny" style="opacity:.6;letter-spacing:.12em;font-weight:800">BACKWARD + AWKWARD</div>
          <div style="font-size:19px;font-weight:800;margin-top:6px;line-height:1.5">도달점에서 거꾸로 질문을 세우고,<br>학생은 <span style="color:#f6b9a0">먼저 어색하게 써 본 뒤</span> 배웁니다.</div>
          <div class="small" style="opacity:.75;margin-top:8px">쓴 글의 원본은 볼트에 남고, AI에는 이름을 가린 질문 초안만 오갑니다.</div>
        </div>
        <a class="btn soft" href="#/units">${teacher ? '단원 설계로' : '내 단원으로'} →</a>
      </div>
    </div>

    <div class="card-title mt-24">${teacher ? '설계한 단원' : '배정된 단원'} <a class="small" href="#/units">전체</a></div>
    ${units.length ? units.map(unitCard).join('') : `<div class="card empty"><div class="big">📚</div>${teacher ? '첫 단원을 설계해 보세요.' : '아직 배정된 단원이 없어요.'}</div>`}`;
  }

  function unitCard(u) {
    const m = S.me(), teacher = S.isTeacherOf(u.classId);
    const inqN = S.inquiriesOf(u.id).length;
    const works = S.worksOf(u.id);
    const doneN = works.filter((w) => S.workDone(w)).length;
    const total = S.classmates(u.classId).length;
    let status = '';
    if (teacher) status = `<span class="chip line">탐구질문 ${inqN}</span> <span class="chip line">일견쓰 ${doneN}/${total}</span>`;
    else { const w = S.myWork(u.id); status = S.workDone(w) ? '<span class="chip ok">일견쓰 완료</span>' : w ? '<span class="chip warn">쓰는 중</span>' : '<span class="chip line">시작 전</span>'; }
    return `<div class="card unit-hero" style="cursor:pointer" data-action="goto" data-go="#/unit/${u.id}">
      <div class="row between wrap mb-8">
        <div class="row wrap"><span class="chip subject">${esc(u.subject)}</span><span class="chip grade">${esc(u.grade)}</span><span class="chip domain">${esc(u.domain)}</span></div>
        <div class="row">${status}</div>
      </div>
      <div class="core-idea">${esc(u.coreIdea)}</div>
      <div class="goal-box mt-12"><div class="lbl">도달점 (GOAL)</div><div class="txt">${esc(u.goal)}</div></div>
    </div>`;
  }

  // ---------------- Units list ----------------
  function viewUnits() {
    const teacher = S.me().role === 'teacher';
    const units = S.myUnits();
    return `<div class="page-head"><div class="section-title">📚 ${teacher ? '단원 설계' : '내 단원'}</div>${teacher ? `<button class="btn primary" data-action="new-unit">+ 단원 설계</button>` : ''}</div>
    <div class="note mb-16">백워드 설계 순서: <b>①도달점 → ②탐구질문 → ③평가(인출·전이) → ④활동(일견쓰)</b>. 진도가 아니라 도달점에서 시작합니다.</div>
    ${units.length ? units.map(unitCard).join('') : `<div class="card empty"><div class="big">📚</div>단원이 없어요.</div>`}`;
  }

  // ---------------- Unit detail (backward design) ----------------
  function viewUnit(id) {
    const u = S.unit(id), m = S.me();
    if (!u) return `<div class="card empty"><div class="big">🔍</div>단원을 찾을 수 없어요.</div>`;
    if (!S.canAccessUnit(u)) return `<div class="card empty"><div class="big">🔒</div>이 단원에 접근 권한이 없어요.</div>`;
    const teacher = S.isTeacherOf(u.classId);
    const inqs = S.inquiriesOf(u.id);
    const ce = u.contentElements || { know: [], skill: [], value: [] };
    const r = S.retrievalOf(u.id);
    return `<div class="crumb"><a href="#/units">단원</a> › ${esc(u.subject)}</div>
    <div class="unit-hero mb-16">
      <div class="row between wrap mb-8"><div class="row wrap"><span class="chip subject">${esc(u.subject)}</span><span class="chip grade">${esc(u.grade)}</span><span class="chip domain">${esc(u.domain)}</span></div>
      ${teacher ? `<button class="btn ghost sm" data-action="del-unit" data-id="${u.id}">🗑 삭제</button>` : ''}</div>
      <div class="core-idea">${esc(u.coreIdea)}</div>
      <div class="goal-box mt-12"><div class="lbl">도달점 (GOAL) — 여기서 거꾸로 설계합니다</div><div class="txt">${esc(u.goal)}</div></div>
    </div>

    <div class="card">
      <div class="card-title">📋 내용 체계 <span class="tiny muted">2022 개정 · 세 범주</span></div>
      <div class="ce-grid">
        <div class="ce know"><div class="h">🧩 지식·이해</div><ul>${ce.know.map((x) => `<li>${esc(x)}</li>`).join('') || '<li class="muted">—</li>'}</ul></div>
        <div class="ce skill"><div class="h">🛠 과정·기능</div><ul>${ce.skill.map((x) => `<li>${esc(x)}</li>`).join('') || '<li class="muted">—</li>'}</ul></div>
        <div class="ce value"><div class="h">🌱 가치·태도</div><ul>${ce.value.map((x) => `<li>${esc(x)}</li>`).join('') || '<li class="muted">—</li>'}</ul></div>
      </div>
      ${u.standards?.length ? `<div class="mt-16"><div class="small bold mb-8">성취기준</div>${u.standards.map((s) => `<div class="inq" style="margin-bottom:6px"><span class="mono small" style="color:var(--accent-600)">${esc(s.code || '')}</span> ${esc(s.text)}${s.note ? `<div class="child">해설: ${esc(s.note)}</div>` : ''}</div>`).join('')}</div>` : ''}
    </div>

    <div class="card">
      <div class="card-title">🧭 탐구질문 <span class="tiny muted">도달점에 닿기 위해 연역한 질문</span> ${teacher ? `<button class="btn soft sm" data-action="add-inq" data-id="${u.id}">+ 질문</button>` : ''}</div>
      ${inqs.length ? inqs.map((q) => `<div class="inq"><div class="row between"><div class="q">${q.source === 'ai-accepted' ? '<span class="chip ai">🐣 AI초안 채택</span> ' : ''}${esc(q.question)}</div>${teacher ? `<button class="btn ghost sm" data-action="del-inq" data-id="${q.id}">✕</button>` : ''}</div>${(q.children || []).map((c) => `<div class="child">${esc(c)}</div>`).join('')}</div>`).join('') : '<div class="small muted">아직 탐구질문이 없어요. 도달점을 보고 “무엇을 알아야 도달할까?”로 시작하세요.</div>'}
    </div>

    <div class="card">
      <div class="card-title">🎓 학습 루프</div>
      <div class="grid-3">
        ${loopTile('✍️', '일견쓰', '먼저 써 본다', teacher ? `#/board/${u.id}` : `#/write/${u.id}`, teacher ? `학급 ${S.worksOf(u.id).filter(S.workDone).length}편` : (S.workDone(S.myWork(u.id)) ? '완료' : '이어쓰기'))}
        ${loopTile('🎯', '인출 · 갭', '키워드로 도달점 점검', `#/retrieve/${u.id}`, r?.keywords?.length ? `키워드 ${r.keywords.length}` : (teacher ? '설정 필요' : '대기'))}
        ${loopTile('🔀', '전이', '도구교과 · 실생활로', teacher ? `#/board/${u.id}` : (S.myWork(u.id) ? `#/transfer/${S.myWork(u.id).id}` : `#/write/${u.id}`), '연결')}
      </div>
    </div>`;
  }
  const loopTile = (ic, t, d, href, badge) => `<div class="ce" style="cursor:pointer;text-align:left" data-action="goto" data-go="${href}"><div class="h" style="color:var(--accent-600)">${ic} ${t}</div><div class="small muted" style="margin-bottom:6px">${d}</div><span class="chip line">${esc(badge)}</span></div>`;

  // ---------------- Firstwrite (일견쓰) ----------------
  function viewWrite(unitId) {
    const u = S.unit(unitId), m = S.me();
    if (!u || !S.canAccessUnit(u)) return `<div class="card empty"><div class="big">🔒</div>접근 권한이 없어요.</div>`;
    const w = S.myWork(unitId) || {};
    const inqs = S.inquiriesOf(unitId);
    const done = NS.STAGES.filter((s) => (w[s.key] || '').trim()).length;
    return `<div class="crumb"><a href="#/unit/${u.id}">${esc(u.domain)}</a> › 일견쓰</div>
    <div class="page-head"><div><div class="section-title">✍️ 일견쓰</div><div class="small muted">${esc(u.coreIdea)}</div></div><div class="chip ${done === 4 ? 'ok' : 'line'}">${done}/4 단계</div></div>
    ${inqs.length ? `<div class="note mb-16">오늘의 탐구질문: <b>${esc(inqs[0].question)}</b></div>` : ''}
    <div class="note mb-16" style="border-color:var(--accent);background:var(--accent-50)">먼저 <b>스스로</b> 씁니다. 네 글을 다 쓴 뒤에야 Bawk 조교가 <b>다음 질문</b>을 제안해요 — 답을 대신 쓰지 않습니다.</div>
    <form data-form="write" data-id="${unitId}">
      ${NS.STAGES.map((st) => `<div class="fw-stage"><div class="h"><span class="ic">${st.icon}</span>${st.label}</div><div class="desc">${st.desc}</div><textarea name="${st.key}" placeholder="${st.desc}">${esc(w[st.key] || '')}</textarea></div>`).join('')}
      <div class="row between wrap"><button class="btn primary lg" type="submit">저장 (볼트에만 기록)</button>
      <button class="btn soft" type="button" data-action="ai-from-work" data-id="${unitId}" ${done < 4 ? 'disabled title="네 단계를 모두 쓴 뒤 열려요"' : ''}>🐣 다 썼어요 — 다음 질문 받기</button></div>
    </form>
    <div id="ai-inline" class="mt-16"></div>`;
  }

  // ---------------- Retrieval / Gap ----------------
  function viewRetrieve(unitId) {
    const u = S.unit(unitId), m = S.me();
    if (!u || !S.canAccessUnit(u)) return `<div class="card empty"><div class="big">🔒</div>접근 권한이 없어요.</div>`;
    const teacher = S.isTeacherOf(u.classId);
    const r = S.ensureRetrieval(unitId);
    if (teacher) {
      return `<div class="crumb"><a href="#/unit/${u.id}">${esc(u.domain)}</a> › 인출</div>
      <div class="section-title mb-16">🎯 인출 키워드 설계</div>
      <div class="note mb-16">도달점에 닿았다면 학생이 스스로 떠올려야 할 <b>핵심 키워드</b>와 배점(가중치)을 정하세요. 학생은 빈칸에서 이 키워드를 인출합니다.</div>
      <div class="card"><div class="card-title">키워드 <button class="btn soft sm" data-action="add-kw" data-id="${unitId}">+ 추가</button></div>
        ${r.keywords.length ? r.keywords.map((k, i) => `<div class="row between" style="padding:6px 0;border-bottom:1px solid var(--line)"><span class="kw">${esc(k.term)} <span class="w">가중치 ${k.weight}</span></span><button class="btn ghost sm" data-action="del-kw" data-id="${unitId}" data-i="${i}">✕</button></div>`).join('') : '<div class="small muted">키워드를 추가하세요.</div>'}
      </div>
      <div class="card"><div class="card-title">📊 학급 인출 현황</div>
        ${S.classmates(u.classId).map((s) => { const sc = S.retrievalScore(unitId, s.id); return `<div class="bar-row"><span>${esc(s.name)}</span><div class="bar" style="width:${sc ? sc.pct : 0}%;background:${sc && sc.pct >= 60 ? 'var(--ok)' : 'var(--accent)'}"></div><span class="small">${sc ? sc.pct + '%' : '—'}</span></div>`; }).join('')}
      </div>`;
    }
    // student
    const a = r.attempts[m.id];
    const gap = S.gapFor(unitId);
    const sc = S.retrievalScore(unitId);
    return `<div class="crumb"><a href="#/unit/${u.id}">${esc(u.domain)}</a> › 인출</div>
    <div class="section-title mb-16">🎯 인출 점검</div>
    <div class="note mb-16">도달점: <b>${esc(u.goal)}</b><br>배운 내용에서 <b>스스로 떠오르는</b> 키워드를 눌러 표시하세요. 안 떠오른 것이 곧 보충할 <b>갭</b>입니다.</div>
    ${r.keywords.length ? `<div class="card"><div class="card-title">키워드를 눌러 인출</div>
      <div class="row wrap" style="gap:8px">${r.keywords.map((k) => { const hit = a && a.hits.includes(k.term); return `<button class="kw ${a ? (hit ? 'hit' : 'miss') : ''}" data-action="toggle-kw" data-id="${unitId}" data-term="${esc(k.term)}" ${a ? 'disabled' : ''}>${esc(k.term)} <span class="w">${k.weight}점</span></button>`; }).join('')}</div>
      ${a ? `<div class="mt-16"><div class="row between small"><span>인출 점수</span><span class="bold">${sc.got}/${sc.total}점 · ${sc.pct}%</span></div><div class="meter mt-8"><span style="width:${sc.pct}%"></span></div>
        ${gap.missing.length ? `<div class="mt-12"><div class="small bold mb-8">🔧 보충할 갭 (안 떠오른 키워드)</div>${gap.missing.map((t) => `<span class="gap-tag missing">${esc(t)}</span>`).join('')}<div class="small muted mt-8">이 키워드로 교과서·자료를 다시 보고, 일견쓰의 ‘탐구’에 보충해 보세요.</div></div>` : '<div class="chip ok mt-12">모든 키워드를 인출했어요! 🎉</div>'}` : `<button class="btn primary block mt-16" data-action="submit-kw" data-id="${unitId}">인출 제출</button>`}
    </div>` : '<div class="card empty"><div class="big">🕐</div>선생님이 아직 키워드를 정하지 않았어요.</div>'}`;
  }

  // ---------------- Transfer ----------------
  function viewTransfer(workId) {
    const w = S.work(workId); if (!w) return `<div class="card empty"><div class="big">🔍</div>작업을 찾을 수 없어요.</div>`;
    const u = S.unit(w.unitId);
    if (!S.canAccessUnit(u)) return `<div class="card empty"><div class="big">🔒</div>권한이 없어요.</div>`;
    const x = S.transferOf(workId) || { fromSubject: u.subject + '(' + u.domain + ')', toSubject: '', realLife: '', checks: [{ label: '내용교과 개념을 정확히 옮겼나', ok: false }, { label: '도구교과 형식을 갖췄나', ok: false }, { label: '실생활 맥락에 연결됐나', ok: false }] };
    return `<div class="crumb"><a href="#/unit/${u.id}">${esc(u.domain)}</a> › 전이</div>
    <div class="section-title mb-16">🔀 전이</div>
    <div class="note mb-16">배운 <b>내용교과</b> 개념을 <b>도구교과</b>(표현 방법)와 <b>실생활</b>로 옮깁니다. 예) 사회의 민주주의 → 국어의 주장하는 글 → 학급 회의 제안서.</div>
    <form data-form="transfer" data-id="${workId}">
      <div class="xfer mb-16">
        <div class="box"><div class="k">내용교과 (무엇을)</div><input name="fromSubject" value="${esc(x.fromSubject)}"></div>
        <div class="arrow">→</div>
        <div class="box"><div class="k">도구교과 (어떻게 표현)</div><input name="toSubject" value="${esc(x.toSubject)}" placeholder="예) 국어 · 주장하는 글"></div>
      </div>
      <div class="field"><label>실생활 연결</label><input name="realLife" value="${esc(x.realLife)}" placeholder="예) 학급 회의 규칙 제안서 쓰기"></div>
      <div class="card"><div class="card-title">전이 체크 (3칸)</div>
        ${x.checks.map((c, i) => `<label class="row" style="padding:7px 0;cursor:pointer"><input type="checkbox" name="c${i}" ${c.ok ? 'checked' : ''}> <span>${esc(c.label)}</span></label>`).join('')}
      </div>
      <button class="btn primary lg block mt-12" type="submit">전이 저장</button>
    </form>`;
  }

  // ---------------- Board (학급 문집) ----------------
  function viewBoard(unitId) {
    const u = S.unit(unitId); if (!u) return `<div class="card empty"><div class="big">🔍</div>단원 없음</div>`;
    if (!S.isTeacherOf(u.classId)) return `<div class="card empty"><div class="big">🔒</div>교사만 학급 문집을 볼 수 있어요.</div>`;
    const works = S.worksOf(unitId);
    return `<div class="crumb"><a href="#/unit/${u.id}">${esc(u.domain)}</a> › 학급 일견쓰</div>
    <div class="page-head"><div class="section-title">📖 학급 일견쓰 <span class="small muted">${works.filter(S.workDone).length}/${S.classmates(u.classId).length}편 완성</span></div><button class="btn" data-action="export-md">📄 볼트 .md 내보내기</button></div>
    <div class="note mb-16">이 문집은 <b>학급 내부</b>에만 있습니다. 학부모·외부 공개 링크는 기본으로 만들지 않습니다(방법론: 공개 기본값 금지).</div>
    ${works.length ? works.map((w) => { const st = S.user(w.studentId); const t = S.transferOf(w.id); return `<div class="work">
      <div class="head">${avatar(st, 'sm')}<div class="grow"><div class="bold">${esc(st.name)}</div><div class="tiny muted">${fmt.ago(w.updatedAt || w.createdAt)}${S.workDone(w) ? '' : ' · 작성 중'}</div></div>${t && t.checks.every((c) => c.ok) ? '<span class="chip ok">전이 완료</span>' : ''}</div>
      <div class="small"><b>관찰</b> ${esc(w.observe || '—')}<br><b>질문</b> ${esc(w.question || '—')}<br><b>탐구</b> ${esc(w.explore || '—')}<br><b>사유</b> ${esc(w.reflect || '—')}</div>
    </div>`; }).join('') : '<div class="card empty"><div class="big">🍃</div>아직 제출된 일견쓰가 없어요.</div>'}`;
  }

  // ---------------- STATEtistics ----------------
  function viewStats() {
    const series = S.semesterSeries();
    const m = S.me();
    const tabs = [['retrieval', '인출 적중률', '%', 'var(--accent)'], ['transfer', '전이 성공률', '%', 'var(--teal)'], ['rhythm', '일견쓰 리듬', '%', 'var(--indigo)'], ['gap', '평균 갭(개)', '', 'var(--plum)']];
    const cur = tabs.find((t) => t[0] === ui.statTab) || tabs[0];
    const first = series[0], last = series[series.length - 1];
    const delta = last && first ? (last[cur[0]] - first[cur[0]]) : 0;
    return `<div class="page-head"><div><div class="section-title">📈 STATEtistics</div><div class="small muted">학기초 → 학기말, 비식별 <b>숫자 신호</b>만. 원문·이름은 볼트에 남습니다.</div></div></div>
    <div class="note mb-16">이 그래프는 학생 글을 담지 않습니다. 볼트가 매주 내보낸 <b>주간 신호</b>(적중·갭·전이·리듬)만 그립니다. 학기말에 신호·코드표·원문을 함께 파기할 수 있어요(볼트 → 원장).</div>
    <div class="tabs mb-16">${tabs.map((t) => `<button class="tab ${ui.statTab === t[0] ? 'active' : ''}" data-action="stat-tab" data-id="${t[0]}">${t[1]}</button>`).join('')}</div>
    <div class="chartbox mb-16">
      <div class="h">${cur[1]} <span class="chip ${delta >= 0 ? 'ok' : 'bad'}" style="float:right">${delta >= 0 ? '▲' : '▼'} ${Math.abs(delta).toFixed(cur[0] === 'gap' ? 1 : 0)}${cur[2]}</span></div>
      <div class="sub">학기초 ${first ? first[cur[0]] : 0}${cur[2]} → 최근 ${last ? last[cur[0]] : 0}${cur[2]} · 학급 평균 ${last ? last.n : 0}명</div>
      ${lineChart(series.map((s) => s[cur[0]]), series.map((s) => s.week.replace(/^\d+-/, '')), cur[3], cur[0] === 'gap')}
    </div>
    <div class="grid-2">
      <div class="chartbox"><div class="h">이번 학기 4대 신호</div><div class="sub">최근 주 기준</div>
        <div class="stat-grid" style="grid-template-columns:1fr 1fr">
          <div class="stat"><div class="n" style="color:var(--accent)">${last ? last.retrieval : 0}%</div><div class="l">인출 적중</div></div>
          <div class="stat"><div class="n" style="color:var(--teal)">${last ? last.transfer : 0}%</div><div class="l">전이 성공</div></div>
          <div class="stat"><div class="n" style="color:var(--indigo)">${last ? last.rhythm : 0}%</div><div class="l">일견쓰 리듬</div></div>
          <div class="stat"><div class="n" style="color:var(--plum)">${last ? last.gap : 0}</div><div class="l">평균 갭</div></div>
        </div>
      </div>
      <div class="chartbox"><div class="h">데이터 최소화 원칙</div><div class="sub">이 페이지가 가진 것 / 갖지 않은 것</div>
        <div class="sov-item"><span class="ic">✅</span><div><div class="t">가진 것</div><div class="s">주차, 학급 내 가명 코드, 적중·갭·전이·리듬 숫자</div></div></div>
        <div class="sov-item"><span class="ic">🚫</span><div><div class="t">갖지 않은 것</div><div class="s">학생 이름, 글 원문, 외부 전송</div></div></div>
      </div>
    </div>`;
  }
  // 간단한 SVG 라인차트 (0~100 또는 0~max). 접근성: 값은 위 텍스트로도 제공.
  function lineChart(vals, labels, color, isCount) {
    const W = 640, H = 200, pad = { l: 34, r: 12, t: 14, b: 24 };
    if (!vals.length) return '<div class="empty small">데이터 없음</div>';
    const max = isCount ? Math.max(6, Math.ceil(Math.max(...vals))) : 100;
    const iw = W - pad.l - pad.r, ih = H - pad.t - pad.b;
    const x = (i) => pad.l + (vals.length === 1 ? iw / 2 : (i / (vals.length - 1)) * iw);
    const y = (v) => pad.t + ih - (v / max) * ih;
    const pts = vals.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
    const grid = [0, 0.25, 0.5, 0.75, 1].map((f) => { const gy = pad.t + ih - f * ih; return `<line class="grid-line" x1="${pad.l}" y1="${gy}" x2="${W - pad.r}" y2="${gy}"/><text class="axis-lbl" x="4" y="${gy + 3}">${Math.round(f * max)}</text>`; }).join('');
    const step = Math.ceil(labels.length / 6);
    const xlabels = labels.map((l, i) => i % step === 0 ? `<text class="axis-lbl" x="${x(i)}" y="${H - 6}" text-anchor="middle">${esc(l)}</text>` : '').join('');
    const dots = vals.map((v, i) => `<circle class="dot" cx="${x(i).toFixed(1)}" cy="${y(v).toFixed(1)}" r="3.5" fill="${color}"/>`).join('');
    const area = `${pad.l},${pad.t + ih} ${pts} ${x(vals.length - 1)},${pad.t + ih}`;
    return `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="추이 그래프" style="overflow:visible">
      <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${color}" stop-opacity=".18"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></linearGradient></defs>
      ${grid}<polygon points="${area}" fill="url(#g)"/><polyline class="ln" points="${pts}" stroke="${color}"/>${dots}${xlabels}</svg>`;
  }

  // ---------------- Vault / sovereignty ledger ----------------
  function viewVault() {
    const m = S.me();
    const runs = S.runs(), log = S.accessLog();
    const demo = AI.maskPII('오진우가 한들초등학교 6학년 3반에서 3명과 다퉜다. 010-1234-5678', { names: S.state.users.map((u) => u.name) });
    let maskedHtml = esc(demo.masked);
    Object.keys(demo.mapping).forEach((tok) => { maskedHtml = maskedHtml.split(esc(tok)).join(`<span class="tok">${esc(tok)}</span>`); });
    return `<div class="page-head"><div><div class="section-title">🔐 볼트 · 주권 원장</div><div class="small muted">원본은 어디에, 무엇이 외부로 나갔는지 한눈에</div></div></div>

    <div class="card"><div class="card-title">🛡 데이터 주권 원칙</div>
      <div class="sov-item"><span class="ic">📁</span><div><div class="t">원본은 로컬 볼트</div><div class="s">일견쓰·전이 원문은 이 브라우저 localStorage에만. 서버로 원문을 보내지 않습니다. (.md/.json으로 이사 가능)</div></div></div>
      <div class="sov-item"><span class="ic">🧑‍🏫</span><div><div class="t">학생이 먼저, AI는 나중</div><div class="s">네 단계를 다 쓴 뒤에만 AI가 질문 초안을 제안. 답을 대신 쓰지 않습니다.</div></div></div>
      <div class="sov-item"><span class="ic">🎭</span><div><div class="t">외부에는 비식별 텍스트만</div><div class="s">이름·학번·학교·전화를 토큰으로 치환한 뒤 전송. 아래가 실제 마스킹 예시입니다.</div></div></div>
      <div class="mask-demo mt-8" style="margin-left:34px">${maskedHtml}</div>
    </div>

    <div class="card"><div class="card-title">🐣 AI 호출 원장 (Run) <span class="tiny muted">원문 없음 · 마스킹 입력과 질문 초안만</span></div>
      ${runs.length ? `<table class="ledger"><thead><tr><th>시각</th><th>목적</th><th>마스킹 입력</th><th>질문 초안</th><th>채택</th></tr></thead><tbody>
      ${runs.slice(0, 12).map((r) => `<tr><td class="mono tiny">${fmt.dt(r.at)}</td><td><span class="chip ai">${esc(r.purpose)}</span></td><td class="tiny">${esc((r.maskedInput || '').slice(0, 60))}${(r.maskedInput || '').length > 60 ? '…' : ''}</td><td class="tiny">${esc((r.questionDraft || '').slice(0, 70))}</td><td>${r.acceptedBy ? '<span class="chip ok">채택</span>' : '<span class="chip line">—</span>'}</td></tr>`).join('')}
      </tbody></table>` : '<div class="small muted">아직 AI 호출이 없어요.</div>'}
    </div>

    <div class="card"><div class="card-title">🗂 볼트 관리</div>
      <div class="row wrap"><button class="btn" data-action="export-json">전체 .json 내보내기</button><button class="btn" data-action="export-md">일견쓰 .md 내보내기</button><label class="btn">.json 가져오기<input type="file" accept="application/json" data-action="import-json" hidden></label></div>
      <div class="small muted mt-8">볼트가 앱보다 오래 살도록: .md는 어떤 편집기로도 열립니다.</div>
    </div>

    ${m.role === 'teacher' ? `<div class="card"><div class="card-title" style="color:var(--bad)">🧨 학기말 파기</div>
      <div class="small muted mb-12">학기가 끝나면 원문·코드표·신호를 함께 지웁니다. 되돌릴 수 없습니다.</div>
      <button class="btn danger" data-action="purge">학기말 파기…</button></div>` : ''}

    <div class="card"><div class="card-title">📜 접근 로그 <span class="tiny muted">누가·언제·무엇을</span></div>
      ${log.slice(0, 14).map((l) => `<div class="row between small" style="padding:5px 0;border-bottom:1px solid var(--line)"><span>${esc(S.user(l.who).name)} · <span class="mono">${esc(l.what)}</span>${l.ref ? ` <span class="muted">${esc(l.ref)}</span>` : ''}</span><span class="muted tiny">${fmt.ago(l.at)}</span></div>`).join('')}
    </div>`;
  }

  // ---------------- Bawk 질문조교 ----------------
  function viewAI() {
    const m = S.me(), s = AI.settings();
    return `<div class="card" style="background:var(--ink);color:var(--paper);border-color:var(--ink)"><div class="row between wrap">
      <div><div class="section-title" style="color:var(--paper)">🐣 Bawk 질문조교</div><div class="small" style="opacity:.75">${s.apiKey ? `OpenRouter · ${esc(s.model)} 연결됨` : '데모 모드 — <a href="#/me" style="color:#f6b9a0">키 등록</a>'}</div></div>
      <button class="btn soft sm" data-action="ai-clear">대화 지우기</button></div></div>
    <div class="note mb-16">Bawk는 <b>답을 주지 않습니다.</b> 학생이 쓴 글이나 질문에서 출발해 <b>다음 탐구질문</b>만 제안합니다. 보내는 내용은 이름을 가린 뒤 전송됩니다.</div>
    <div class="card">
      <div id="ai-chat" style="min-height:260px;max-height:56vh;overflow:auto">${ui.aiMsgs.length ? ui.aiMsgs.map(aiMsg).join('') : `<div class="empty"><div class="big">🐣</div>${esc(m.name)}님, 지금까지 관찰하거나 궁금한 것을 적어 보세요.<br><span class="small">Bawk가 더 깊이 생각할 다음 질문을 제안할게요.</span></div>`}</div>
      <form class="row mt-12" data-form="ai" style="gap:8px"><input name="q" placeholder="예) 급식 당번을 다수결로 정했는데 불만이 많았다…" autocomplete="off" required style="flex:1;border:1px solid var(--line-2);border-radius:999px;padding:10px 14px" ${ui.aiBusy ? 'disabled' : ''}><button class="btn primary" ${ui.aiBusy ? 'disabled' : ''}>${ui.aiBusy ? '생성 중…' : '질문 받기'}</button></form>
      <div class="tiny muted mt-8">전송 전 마스킹: 이름→[학생A], 학교→[학교], 번호→[N]. 모든 호출은 볼트 원장에 기록됩니다.</div>
    </div>`;
  }
  const aiMsg = (mm) => `<div class="ai-msg ${mm.role}">${mm.role === 'user' ? avatar(S.me(), 'sm') : '<span class="avatar sm" style="background:var(--accent)">🐣</span>'}<div class="body ${mm.err ? 'err' : ''} ${mm.streaming ? 'cursor' : ''}">${esc(mm.content)}</div></div>`;

  async function askAI(qRaw) {
    if (ui.aiBusy || !qRaw.trim()) return;
    const names = S.state.users.map((u) => u.name);
    const { masked, mapping } = AI.maskPII(qRaw.trim(), { names });
    ui.aiMsgs.push({ role: 'user', content: qRaw.trim() });
    const reply = { role: 'assistant', content: '', streaming: true }; ui.aiMsgs.push(reply);
    ui.aiBusy = true; render();
    const paint = () => { const el = $('#ai-chat'); if (el) { el.innerHTML = ui.aiMsgs.map(aiMsg).join(''); el.scrollTop = el.scrollHeight; } };
    const ctx = aiCtx();
    let draft = '';
    try {
      if (!AI.hasKey()) { await new Promise((r) => setTimeout(r, 450)); draft = AI.demoInquiries({ observe: masked, question: '', explore: '', reflect: '' }, ctx); reply.content = draft; }
      else { draft = await AI.chat([{ role: 'system', content: AI.SYS }, { role: 'user', content: `학생이 쓴 내용(실명 가림): ${masked}\n\n이 학생이 스스로 더 깊이 생각하도록 다음 탐구질문 2~3개만 제안해줘. 각 한 줄, 답은 쓰지 마.` }], { onToken: (t, f) => { reply.content = f; paint(); } }); }
    } catch (e) { reply.err = true; reply.content = e.code === 'NO_KEY' ? '키가 필요해요. 마이페이지에서 등록하세요.' : e.message; }
    reply.streaming = false;
    if (!reply.err) S.logRun({ purpose: 'inquiry-draft', maskedInput: masked, questionDraft: draft, model: AI.hasKey() ? AI.settings().model : 'demo' });
    ui.aiBusy = false; render();
  }
  function aiCtx() { const u = S.myUnits()[0]; return u ? { subject: u.subject, coreIdea: u.coreIdea, goal: u.goal } : null; }

  // ---------------- Me ----------------
  function viewMe() {
    const m = S.me(), s = AI.settings();
    const units = S.myUnits();
    return `<div class="page-head"><div class="section-title">👤 마이페이지</div></div>
    <div class="card"><div class="row" style="gap:16px">${avatar(m, 'lg')}<div class="grow"><div style="font-size:20px;font-weight:800">${esc(m.name)} ${roleChip(m)}</div><div class="muted">${esc(m.title || (m.code ? `학급 코드 ${m.code}` : ''))}</div></div></div>
      <div class="stat-grid mt-16"><div class="stat"><div class="n">${units.length}</div><div class="l">${m.role === 'teacher' ? '설계 단원' : '내 단원'}</div></div><div class="stat"><div class="n">${S.runs().length}</div><div class="l">AI 호출</div></div><div class="stat"><div class="n">${S.runs().filter((r) => r.acceptedBy).length}</div><div class="l">채택된 질문</div></div><div class="stat"><div class="n">${S.accessLog().length}</div><div class="l">접근 기록</div></div></div>
    </div>
    <div class="card"><div class="card-title">🔄 데모 계정 전환 <span class="small muted">교사·학생 화면을 비교</span></div>
      <div class="row wrap">${S.state.users.map((u) => `<button class="btn ${u.id === m.id ? 'dark' : ''}" data-action="switch" data-id="${u.id}">${avatar(u, 'xs')} ${esc(u.name)} <span class="tiny" style="opacity:.7">${u.role === 'teacher' ? '교사' : '학생'}</span></button>`).join('')}</div>
    </div>
    <div class="card"><div class="card-title">🐣 Bawk / OpenRouter 설정 <span class="row small"><span class="pill-vault"><span class="dot"></span>${s.apiKey ? '키 등록됨' : '데모 모드'}</span></span></div>
      <form data-form="ai-settings">
        <div class="field"><label>OpenRouter API 키 (BYOK)</label><input type="password" name="apiKey" value="${esc(s.apiKey)}" placeholder="sk-or-v1-…" autocomplete="off"><div class="hint">이 브라우저에만 저장 · openrouter.ai 로만 전송. <a href="https://openrouter.ai/settings/keys" target="_blank" rel="noopener">키 발급 →</a></div></div>
        <div class="grid-2"><div class="field"><label>모델</label><select name="modelSelect">${AI.SUGGESTED.map((x) => `<option value="${x.id}" ${x.id === s.model ? 'selected' : ''}>${x.label}</option>`).join('')}<option value="__c" ${AI.SUGGESTED.some((x) => x.id === s.model) ? '' : 'selected'}>직접 입력…</option></select></div>
        <div class="field"><label>모델 슬러그</label><input name="model" value="${esc(s.model)}" placeholder="provider/model"></div></div>
        <div class="row wrap"><button class="btn primary" type="submit">저장</button><button class="btn" type="button" data-action="ai-test">연결 테스트</button><span class="small muted" id="ai-test-r"></span></div>
      </form>
    </div>
    <div class="card"><div class="card-title">ℹ️ Bawkward란</div><div class="small muted"><b>B</b>ackward Design(이해중심 교육과정: 도달점에서 거꾸로 설계) + a<b>wkward</b>(학생이 먼저 어색하게 써 보는 것). 원본은 볼트에 남고, 학기 신호만 숫자로 관리합니다.</div></div>`;
  }

  // ---------------- modals ----------------
  function unitModal() {
    openModal(`${mHead('📚 단원 설계 — 도달점에서 거꾸로')}<form class="modal-body" data-form="unit">
      <div class="grid-2"><div class="field"><label>교과</label><select name="subject">${NS.SUBJECTS.map((s) => `<option>${s}</option>`).join('')}</select></div><div class="field"><label>학년</label><input name="grade" value="초6"></div></div>
      <div class="field"><label>영역</label><input name="domain" required placeholder="예) 정치·민주주의"></div>
      <div class="field"><label>핵심 아이디어</label><textarea name="coreIdea" required placeholder="이 단원이 결국 이해하게 하려는 큰 생각"></textarea></div>
      <div class="field"><label>도달점 (GOAL)</label><textarea name="goal" required placeholder="학생이 무엇을 할 수 있으면 도달한 것인가"></textarea></div>
      <div class="grid-3"><div class="field"><label>지식·이해 (줄바꿈)</label><textarea name="know" style="min-height:70px"></textarea></div><div class="field"><label>과정·기능</label><textarea name="skill" style="min-height:70px"></textarea></div><div class="field"><label>가치·태도</label><textarea name="value" style="min-height:70px"></textarea></div></div>
      <div class="modal-foot" style="padding:8px 0 0"><button type="button" class="btn" data-action="close-modal">취소</button><button class="btn primary" type="submit">단원 만들기</button></div>
    </form>`, { wide: true });
  }
  function inqModal(unitId) {
    openModal(`${mHead('🧭 탐구질문 추가')}<form class="modal-body" data-form="inq" data-id="${unitId}">
      <div class="note mb-12">도달점을 보고 “여기 닿으려면 무엇을 알아야/생각해야 할까?”를 <b>연역</b>하세요.</div>
      <div class="field"><label>탐구질문</label><input name="question" required placeholder="예) ‘함께 결정한다’는 실제로 어떤 모습일까?"></div>
      <div class="field"><label>차시 질문 (선택, 줄바꿈)</label><textarea name="children" placeholder="세부 질문을 한 줄에 하나씩"></textarea></div>
      <div class="modal-foot" style="padding:8px 0 0"><button type="button" class="btn" data-action="close-modal">취소</button><button class="btn primary" type="submit">추가</button></div>
    </form>`);
  }
  function kwModal(unitId) {
    openModal(`${mHead('🎯 인출 키워드 추가')}<form class="modal-body" data-form="kw" data-id="${unitId}">
      <div class="grid-2"><div class="field"><label>키워드</label><input name="term" required placeholder="예) 소수 존중"></div><div class="field"><label>가중치(배점)</label><input type="number" name="weight" value="2" min="1" max="5"></div></div>
      <div class="modal-foot" style="padding:8px 0 0"><button type="button" class="btn" data-action="close-modal">취소</button><button class="btn primary" type="submit">추가</button></div>
    </form>`);
  }
  function purgeModal() {
    openModal(`${mHead('🧨 학기말 파기')}<form class="modal-body" data-form="purge">
      <div class="note mb-12" style="border-color:var(--bad);background:#fdf3f3">되돌릴 수 없습니다. 지울 항목을 고르세요.</div>
      ${[['works', '일견쓰 원문'], ['retrievals', '인출 기록'], ['transfers', '전이 기록'], ['signals', '주간 신호(그래프)'], ['runs', 'AI 호출 원장'], ['codes', '학생 코드표(가명 해제)']].map(([k, l]) => `<label class="row" style="padding:6px 0"><input type="checkbox" name="${k}" checked> ${l}</label>`).join('')}
      <div class="modal-foot" style="padding:8px 0 0"><button type="button" class="btn" data-action="close-modal">취소</button><button class="btn danger" type="submit">영구 파기</button></div>
    </form>`);
  }
  function download(name, text, type) { const b = new Blob([text], { type }); const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = name; a.click(); URL.revokeObjectURL(a.href); }

  async function aiFromWork(unitId) {
    const btn = $(`[data-action=ai-from-work][data-id="${unitId}"]`); const box = $('#ai-inline');
    const w = S.myWork(unitId); if (!S.workDone(w)) { toast('네 단계를 모두 쓴 뒤에 열려요', 'bad'); return; }
    const names = S.state.users.map((u) => u.name);
    const masked = { observe: AI.maskPII(w.observe, { names }).masked, question: AI.maskPII(w.question, { names }).masked, explore: AI.maskPII(w.explore, { names }).masked, reflect: AI.maskPII(w.reflect, { names }).masked };
    if (btn) { btn.disabled = true; btn.textContent = '생성 중…'; }
    box.innerHTML = `<div class="card"><div class="card-title">🐣 Bawk의 다음 질문 제안</div><div id="draft" class="cursor"></div></div>`;
    const u = S.unit(unitId); const ctx = { subject: u.subject, coreIdea: u.coreIdea, goal: u.goal };
    let out = '';
    try {
      if (!AI.hasKey()) { await new Promise((r) => setTimeout(r, 500)); out = AI.demoInquiries(masked, ctx); $('#draft').textContent = out; }
      else { out = await AI.draftInquiries(ctx, masked, (t, f) => { const d = $('#draft'); if (d) d.textContent = f; }); }
      $('#draft').classList.remove('cursor');
      S.logRun({ purpose: 'inquiry-draft', unitId, maskedInput: `관찰:${masked.observe.slice(0, 30)}…`, questionDraft: out.slice(0, 120), model: AI.hasKey() ? AI.settings().model : 'demo' });
      box.querySelector('.card').insertAdjacentHTML('beforeend', `<div class="small muted mt-8">이 질문들은 <b>제안</b>일 뿐이에요. 마음에 드는 걸 골라 ‘탐구’에 이어 써 보세요. (원장에 기록됨)</div>`);
    } catch (e) { $('#draft').textContent = e.message; $('#draft').classList.add('err'); }
    if (btn) { btn.disabled = false; btn.textContent = '🐣 다시 질문 받기'; }
  }

  // ---------------- events ----------------
  document.addEventListener('click', async (ev) => {
    const el = ev.target.closest('[data-action]'); if (!el) return;
    const a = el.dataset.action, id = el.dataset.id;
    switch (a) {
      case 'modal-back': if (ev.target === el) closeModal(); break;
      case 'close-modal': closeModal(); break;
      case 'goto': ev.preventDefault(); go(el.dataset.go); break;
      case 'new-unit': unitModal(); break;
      case 'del-unit': if (confirm('이 단원과 하위 기록을 삭제할까요?')) { S.removeUnit(id); toast('삭제했어요'); go('#/units'); } break;
      case 'add-inq': inqModal(id); break;
      case 'del-inq': S.removeInquiry(id); render(); break;
      case 'add-kw': kwModal(id); break;
      case 'del-kw': { const r = S.ensureRetrieval(id); r.keywords.splice(+el.dataset.i, 1); S.save(); render(); break; }
      case 'toggle-kw': { el.classList.toggle('sel-pending'); el.style.borderColor = el.classList.contains('sel-pending') ? 'var(--ok)' : ''; el.style.background = el.classList.contains('sel-pending') ? 'var(--ok-50)' : ''; break; }
      case 'submit-kw': {
        const chosen = [...document.querySelectorAll('.kw.sel-pending')].map((k) => k.dataset.term);
        const r = S.retrievalOf(id); const wrong = r.keywords.filter((k) => false).map((k) => k.term);
        S.recordAttempt(id, chosen, wrong); toast('인출 제출 완료', 'ok'); render(); break;
      }
      case 'ai-from-work': aiFromWork(id); break;
      case 'ai-clear': ui.aiMsgs = []; render(); break;
      case 'stat-tab': ui.statTab = id; render(); break;
      case 'switch': S.setUser(id); ui.aiMsgs = []; toast(`${S.me().name} 계정으로 전환`); go('#/'); render(); break;
      case 'reset': if (confirm('볼트를 초기 상태로 되돌릴까요?')) { S.reset(); ui.aiMsgs = []; go('#/'); render(); } break;
      case 'export-json': download(`bawkward-${NS.util.today()}.json`, S.exportJSON(), 'application/json'); toast('내보냈어요'); break;
      case 'export-md': download(`bawkward-${NS.util.today()}.md`, S.exportMarkdown(), 'text/markdown'); toast('일견쓰 .md 내보냄'); break;
      case 'purge': purgeModal(); break;
      case 'ai-test': { const o = $('#ai-test-r'); o.textContent = '확인 중…'; try { const f = el.closest('form'); AI.saveSettings({ apiKey: f.apiKey.value.trim(), model: f.model.value.trim() }); const r = await AI.testConnection(); o.textContent = '✅ ' + r; toast('연결 성공', 'ok'); render(); } catch (e) { o.textContent = '❌ ' + (e.code === 'NO_KEY' ? '키를 입력하세요' : e.message); } break; }
      case 'add-student': { const n = prompt('학생 이름'); if (n && n.trim()) { S.addStudent(el.dataset.class, n.trim()); toast('추가했어요', 'ok'); render(); } break; }
      default: break;
    }
  });
  document.addEventListener('input', (ev) => { const el = ev.target; if (el.name === 'modelSelect') { const f = el.closest('form'); if (el.value !== '__c') f.model.value = el.value; } });
  document.addEventListener('change', (ev) => { const el = ev.target; if (el.dataset.action === 'import-json' && el.files?.[0]) { const fr = new FileReader(); fr.onload = () => { try { S.importJSON(fr.result); toast('가져왔어요', 'ok'); render(); } catch (e) { toast('실패: ' + e.message, 'bad'); } }; fr.readAsText(el.files[0]); } });

  document.addEventListener('submit', (ev) => {
    const form = ev.target.closest('form[data-form]'); if (!form) return; ev.preventDefault();
    const kind = form.dataset.form, id = form.dataset.id, f = new FormData(form), v = (k) => (f.get(k) || '').toString().trim();
    const lines = (k) => v(k).split('\n').map((x) => x.trim()).filter(Boolean);
    switch (kind) {
      case 'unit': { const u = S.addUnit({ classId: S.myClasses()[0].id, subject: v('subject'), grade: v('grade'), domain: v('domain'), coreIdea: v('coreIdea'), goal: v('goal'), contentElements: { know: lines('know'), skill: lines('skill'), value: lines('value') } }); closeModal(); toast('단원을 만들었어요 🎉', 'ok'); go(`#/unit/${u.id}`); break; }
      case 'inq': S.addInquiry(id, v('question'), 'teacher', lines('children')); closeModal(); render(); toast('탐구질문 추가', 'ok'); break;
      case 'kw': { const r = S.ensureRetrieval(id); r.keywords.push({ term: v('term'), weight: +v('weight') || 1 }); S.save(); closeModal(); render(); break; }
      case 'write': { S.saveWork(id, S.inquiriesOf(id)[0]?.id, { observe: v('observe'), question: v('question'), explore: v('explore'), reflect: v('reflect') }); toast('볼트에 저장했어요 (외부 전송 없음)', 'ok'); render(); break; }
      case 'transfer': { const checks = [0, 1, 2].map((i) => ({ label: form.querySelector(`[name=c${i}]`).closest('label').textContent.trim(), ok: f.get('c' + i) === 'on' })); S.saveTransfer({ id: S.transferOf(id)?.id, workId: id, unitId: S.work(id).unitId, fromSubject: v('fromSubject'), toSubject: v('toSubject'), realLife: v('realLife'), checks }); toast('전이 저장', 'ok'); go(`#/unit/${S.work(id).unitId}`); break; }
      case 'ai-settings': { AI.saveSettings({ apiKey: v('apiKey'), model: v('model') || v('modelSelect') }); toast('저장했어요', 'ok'); render(); break; }
      case 'ai': { const q = v('q'); form.reset(); askAI(q); break; }
      case 'purge': { const opts = {}; ['works', 'retrievals', 'transfers', 'signals', 'runs', 'codes'].forEach((k) => opts[k] = f.get(k) === 'on'); S.purgeTerm(opts); closeModal(); toast('학기말 파기 완료', 'ok'); go('#/vault'); break; }
      default: break;
    }
  });
  document.addEventListener('keydown', (ev) => { if (ev.key === 'Escape' && !$('#modal-root').hidden) closeModal(); });
  window.addEventListener('hashchange', render);

  S.load(); render();
  NS.app = { render, toast, go, ui };
})();
