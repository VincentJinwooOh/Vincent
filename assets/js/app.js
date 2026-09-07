/* ClassRing — 화면(뷰) · 해시 라우터 · 이벤트 처리 */
(function () {
  'use strict';
  const NS = window.CR;
  const S = NS.store;
  const AI = NS.ai;
  const $ = (sel, root = document) => root.querySelector(sel);

  // ---------- 포맷 유틸 ----------
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const DOW = ['일', '월', '화', '수', '목', '금', '토'];
  const fmt = {
    time(iso) {
      const d = new Date(iso);
      const h = d.getHours(), m = String(d.getMinutes()).padStart(2, '0');
      return `${h < 12 ? '오전' : '오후'} ${h % 12 || 12}:${m}`;
    },
    date(iso) { const d = new Date(iso); return `${d.getMonth() + 1}월 ${d.getDate()}일 (${DOW[d.getDay()]})`; },
    dateTime(iso) { return `${fmt.date(iso)} ${fmt.time(iso)}`; },
    ago(iso) {
      const diff = (Date.now() - new Date(iso)) / 1000;
      if (diff < 60) return '방금 전';
      if (diff < 3600) return `${Math.floor(diff / 60)}분 전`;
      if (diff < 86400) return `${Math.floor(diff / 3600)}시간 전`;
      if (diff < 86400 * 7) return `${Math.floor(diff / 86400)}일 전`;
      return fmt.date(iso);
    },
    dday(iso) {
      const t = new Date(iso); t.setHours(0, 0, 0, 0);
      const n = new Date(); n.setHours(0, 0, 0, 0);
      const d = Math.round((t - n) / 864e5);
      return d === 0 ? 'D-Day' : d > 0 ? `D-${d}` : `마감 ${-d}일 지남`;
    },
    ymd(date) { return NS.util.toISODate(date); },
  };
  NS.fmt = fmt;
  const nl2br = (s) => esc(s);
  const initials = (name) => (name || '?').trim().slice(0, 1);
  const avatar = (u, size = '') => `<span class="avatar ${size}" style="background:${u.color || '#9ca3af'}" title="${esc(u.name)}">${esc(initials(u.name))}</span>`;
  const roleChip = (u) => `<span class="chip ${u.role}">${NS.ROLE[u.role]}</span>`;
  const typeChip = (t) => `<span class="chip ${t}">${NS.TYPE[t].icon} ${NS.TYPE[t].label}</span>`;

  // ---------- UI 상태 ----------
  const ui = { route: { name: 'home' }, filter: 'all', openComments: new Set(), calMonth: null, calSel: null, attDate: NS.util.today(), aiMessages: [], aiBusy: false, search: '' };

  // ---------- 토스트 / 모달 ----------
  function toast(msg, kind = '') {
    const wrap = $('#toasts');
    const el = document.createElement('div');
    el.className = `toast ${kind}`; el.textContent = msg;
    wrap.appendChild(el);
    setTimeout(() => { el.style.opacity = '0'; el.style.transition = 'opacity .3s'; setTimeout(() => el.remove(), 300); }, 2200);
  }
  function openModal(html, { wide = false } = {}) {
    const root = $('#modal-root');
    root.innerHTML = `<div class="modal-back" data-action="modal-back"><div class="modal ${wide ? 'wide' : ''}" role="dialog" aria-modal="true">${html}</div></div>`;
    root.hidden = false;
    document.body.style.overflow = 'hidden';
    const first = root.querySelector('input:not([type=hidden]), textarea, select');
    if (first) setTimeout(() => first.focus(), 30);
  }
  function closeModal() { const root = $('#modal-root'); root.innerHTML = ''; root.hidden = true; document.body.style.overflow = ''; }
  const modalHead = (title) => `<div class="modal-head"><h3>${title}</h3><button class="icon-btn" data-action="close-modal" aria-label="닫기">✕</button></div>`;

  // ---------- 라우터 ----------
  function parseHash() {
    const h = (location.hash || '#/').replace(/^#\/?/, '');
    const [path, qs] = h.split('?');
    const seg = path.split('/').filter(Boolean);
    const q = Object.fromEntries(new URLSearchParams(qs || ''));
    if (!seg.length) return { name: 'home', q };
    if (seg[0] === 'class' && seg[1]) return { name: 'class', id: seg[1], tab: seg[2] || 'feed', q };
    if (seg[0] === 'post' && seg[1]) return { name: 'post', id: seg[1], q };
    return { name: seg[0], id: seg[1], q };
  }
  const go = (path) => { location.hash = path; };

  function render() {
    ui.route = parseHash();
    const me = S.me();
    const r = ui.route;
    let html = '';
    try {
      switch (r.name) {
        case 'home': html = viewHome(); break;
        case 'class': html = viewClass(r.id, r.tab); break;
        case 'post': html = viewPost(r.id); break;
        case 'calendar': html = viewCalendar(); break;
        case 'notifications': html = viewNotifications(); break;
        case 'messages': html = viewMessages(r.id); break;
        case 'me': html = viewMe(); break;
        case 'ai': html = viewAI(); break;
        case 'search': html = viewSearch(r.q.q || ''); break;
        default: html = `<div class="card empty"><div class="big">🧭</div>페이지를 찾을 수 없어요. <a href="#/">홈으로</a></div>`;
      }
    } catch (e) {
      console.error(e);
      html = `<div class="card empty"><div class="big">⚠️</div>화면을 그리는 중 문제가 생겼어요.<br><span class="small">${esc(e.message)}</span><div class="mt-12"><button class="btn" data-action="reset-data">데이터 초기화</button></div></div>`;
    }
    $('#view').innerHTML = html;
    $('#sidebar').innerHTML = renderSidebar(me);
    $('#rail').innerHTML = renderRail(me);
    $('#bottom-nav').innerHTML = renderBottomNav();
    renderTopbar(me);
    window.scrollTo({ top: 0 });
    if (r.name === 'messages') { const b = $('.chat-body'); if (b) b.scrollTop = b.scrollHeight; }
    if (r.name === 'ai') { const b = $('.ai-chat'); if (b) b.scrollTop = b.scrollHeight; }
  }

  // ---------- 공통 프레임 ----------
  function renderTopbar(me) {
    const n = S.notifications().filter((x) => x.unread).length;
    $('#noti-badge').textContent = n; $('#noti-badge').hidden = !n;
    $('#user-chip').innerHTML = `${avatar(me, 'sm')}<span><div class="name">${esc(me.name)}</div><div class="role">${NS.ROLE[me.role]}</div></span>`;
  }
  function navItem(href, icon, label, active, count) {
    return `<a href="${href}" class="${active ? 'active' : ''}"><span class="ic">${icon}</span>${label}${count ? `<span class="count">${count}</span>` : ''}</a>`;
  }
  function renderSidebar(me) {
    const r = ui.route;
    const unreadMsgs = S.myThreads().reduce((a, t) => a + S.unreadCount(t), 0);
    const notis = S.notifications().filter((x) => x.unread).length;
    const classes = S.myClasses();
    return `
      <nav class="nav">
        ${navItem('#/', '🏠', '홈', r.name === 'home')}
        ${navItem('#/notifications', '🔔', '알림', r.name === 'notifications', notis)}
        ${navItem('#/messages', '✉️', '쪽지', r.name === 'messages', unreadMsgs)}
        ${navItem('#/calendar', '📅', '캘린더', r.name === 'calendar')}
        ${navItem('#/ai', '🤖', 'AI 보조교사', r.name === 'ai')}
        ${navItem('#/me', '👤', '마이페이지', r.name === 'me')}
        <div class="nav-section">내 클래스</div>
        ${classes.map((c) => `<a href="#/class/${c.id}" class="${r.name === 'class' && r.id === c.id ? 'active' : ''}"><span class="class-dot" style="background:${c.color}">${c.emoji}</span>${esc(c.name)}</a>`).join('')}
        <a href="#" data-action="open-join"><span class="ic">➕</span>${me.role === 'teacher' ? '클래스 만들기 · 참여' : '초대 코드로 참여'}</a>
      </nav>`;
  }
  function renderBottomNav() {
    const r = ui.route;
    const notis = S.notifications().filter((x) => x.unread).length;
    const item = (href, icon, label, active, count) => `<a href="${href}" class="${active ? 'active' : ''}"><span class="ic">${icon}</span>${label}${count ? `<span class="count">${count}</span>` : ''}</a>`;
    return item('#/', '🏠', '홈', r.name === 'home') + item('#/calendar', '📅', '캘린더', r.name === 'calendar') + item('#/ai', '🤖', 'AI', r.name === 'ai') + item('#/notifications', '🔔', '알림', r.name === 'notifications', notis) + item('#/me', '👤', '마이', r.name === 'me');
  }
  function renderRail(me) {
    const classes = S.myClasses();
    const ids = classes.map((c) => c.id);
    const todayStr = NS.util.today();
    const upcoming = S.allEvents(ids).filter((e) => e.date >= todayStr).slice(0, 5);
    const todos = todoItems(me);
    return `
      <div class="card">
        <div class="card-title">📅 다가오는 일정 <a class="small" href="#/calendar">전체</a></div>
        ${upcoming.length ? upcoming.map((e) => `<div class="event-item" data-action="${e.postId ? 'open-post' : 'go-calendar'}" data-id="${e.postId || e.date}" style="cursor:pointer"><span class="dot ev ${e.kind}"></span><div><div class="bold small">${esc(e.title)}</div><div class="small muted">${fmt.date(e.date)} · ${esc(S.cls(e.classId)?.name || '')}</div></div></div>`).join('') : '<div class="small muted">예정된 일정이 없어요.</div>'}
      </div>
      <div class="card">
        <div class="card-title">✅ 할 일</div>
        ${todos.length ? todos.map((t) => `<div class="todo" data-action="open-post" data-id="${t.postId}"><span class="ic">${t.icon}</span><div><div class="t">${esc(t.title)}</div><div class="s">${esc(t.sub)}</div></div></div>`).join('') : '<div class="small muted">모두 완료했어요! 🎉</div>'}
      </div>
      <div class="card">
        <div class="card-title">🤖 AI 보조교사 링고</div>
        <p class="small muted">${AI.hasKey() ? 'OpenRouter 연결됨. 알림장·과제·피드백 초안을 도와드려요.' : 'OpenRouter API 키를 등록하면 알림장·과제 초안을 AI가 써 드려요.'}</p>
        <a class="btn soft block mt-12" href="#/ai">링고에게 물어보기</a>
      </div>`;
  }
  function todoItems(me) {
    const ids = S.myClasses().map((c) => c.id);
    const out = [];
    S.postsFor(ids).forEach((p) => {
      const c = S.cls(p.classId);
      if (p.type === 'letter' && me.role !== 'teacher' && !(p.reads || []).includes(me.id)) out.push({ icon: '📒', title: '알림장 확인하기', sub: `${c.name} · ${fmt.ago(p.createdAt)}`, postId: p.id });
      if (p.type === 'assignment' && me.role === 'student' && !p.submissions[me.id] && (!p.due || new Date(p.due) > new Date())) out.push({ icon: '📝', title: p.title, sub: `${c.name} · ${p.due ? fmt.dday(p.due) : '기한 없음'}`, postId: p.id });
      if (p.type === 'assignment' && me.role === 'parent') {
        S.childrenOf(me).forEach((ch) => { if (c.studentIds.includes(ch.id) && !p.submissions[ch.id] && p.due && new Date(p.due) > new Date()) out.push({ icon: '📝', title: `${ch.name} 미제출: ${p.title}`, sub: `${c.name} · ${fmt.dday(p.due)}`, postId: p.id }); });
      }
      if (p.type === 'poll' && !p.votes[me.id] && (!p.closesAt || new Date(p.closesAt) > new Date())) out.push({ icon: '📊', title: p.title, sub: `${c.name} · 설문 참여`, postId: p.id });
      if (p.type === 'assignment' && me.role === 'teacher' && p.authorId === me.id) {
        const ungraded = Object.values(p.submissions).filter((s) => s.score == null).length;
        if (ungraded) out.push({ icon: '🏅', title: `채점 대기 ${ungraded}건`, sub: `${c.name} · ${p.title}`, postId: p.id });
      }
    });
    return out.slice(0, 6);
  }

  // ---------- 홈 ----------
  function viewHome() {
    const me = S.me();
    const classes = S.myClasses();
    const ids = classes.map((c) => c.id);
    const posts = S.postsFor(ids, ui.filter);
    const hour = new Date().getHours();
    const greet = hour < 12 ? '좋은 아침이에요' : hour < 18 ? '좋은 오후예요' : '편안한 저녁이에요';
    return `
      <div class="page-head">
        <div><div class="section-title">${greet}, ${esc(me.name)} ${me.role === 'teacher' ? '선생님' : me.role === 'parent' ? '학부모님' : '학생'} 👋</div>
        <div class="muted small">${new Date().toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'long' })} · ${classes.length}개 클래스 소식을 모아봤어요</div></div>
      </div>
      <div class="row wrap mb-16" style="gap:8px">
        ${classes.map((c) => `<a href="#/class/${c.id}" class="btn" style="border-color:${c.color}33;background:${c.color}14;color:${c.color}"><span>${c.emoji}</span>${esc(c.name)}</a>`).join('')}
      </div>
      ${composerCard(me)}
      <div class="tabs mt-16 mb-12">
        ${[['all', '전체'], ['notice', '📢 공지'], ['letter', '📒 알림장'], ['assignment', '📝 과제'], ['poll', '📊 설문'], ['album', '📷 앨범'], ['general', '💬 소식']].map(([k, l]) => `<button class="tab ${ui.filter === k ? 'active' : ''}" data-action="filter" data-id="${k}">${l}</button>`).join('')}
      </div>
      ${posts.length ? posts.map((p) => postCard(p, { showClass: true })).join('') : `<div class="card empty"><div class="big">🍃</div>아직 게시물이 없어요.</div>`}`;
  }

  function composerCard(me, classId) {
    const canRich = me.role === 'teacher';
    const types = canRich ? ['notice', 'letter', 'assignment', 'poll', 'album', 'general'] : ['general'];
    return `<div class="card">
      <div class="composer">${avatar(me)}<button class="fake-input" data-action="compose" data-type="${canRich ? 'notice' : 'general'}" data-class="${classId || ''}">${canRich ? '학급에 공지, 알림장, 과제를 올려보세요…' : '우리 반 친구들과 선생님께 이야기를 남겨보세요…'}</button></div>
      <div class="composer-types">
        ${types.map((t) => `<button class="type-btn" data-action="compose" data-type="${t}" data-class="${classId || ''}">${NS.TYPE[t].icon} ${NS.TYPE[t].label}</button>`).join('')}
        ${canRich ? `<button class="type-btn" data-action="ai-draft-open" data-class="${classId || ''}">✨ AI 초안</button>` : ''}
      </div>
    </div>`;
  }

  // ---------- 게시물 카드 ----------
  function postCard(p, { showClass = false, full = false } = {}) {
    const me = S.me();
    const a = S.user(p.authorId);
    const c = S.cls(p.classId);
    const liked = (p.reactions?.like || []).includes(me.id);
    const canManage = p.authorId === me.id || S.isTeacherOf(c);
    const open = full || ui.openComments.has(p.id);
    return `<article class="card post" id="post-${p.id}">
      <div class="post-head">
        ${avatar(a)}
        <div class="meta grow">
          <div class="who">${esc(a.name)} ${roleChip(a)} ${typeChip(p.type)} ${p.pinned ? '<span class="pin" title="고정됨">📌</span>' : ''}</div>
          <div class="sub">${showClass ? `<a href="#/class/${c.id}">${c.emoji} ${esc(c.name)}</a> · ` : ''}${fmt.ago(p.createdAt)}</div>
        </div>
        ${canManage ? `<div class="row">${S.isTeacherOf(c) ? `<button class="btn ghost sm" data-action="pin" data-id="${p.id}" title="상단 고정">${p.pinned ? '📌 해제' : '📌'}</button>` : ''}<button class="btn ghost sm" data-action="delete-post" data-id="${p.id}" title="삭제">🗑</button></div>` : ''}
      </div>
      <div class="post-body">
        ${p.title ? `<div class="post-title"><a href="#/post/${p.id}" style="color:inherit">${esc(p.title)}</a></div>` : ''}
        ${p.type === 'letter' ? '' : `<div class="post-text ${full ? '' : 'clamp'}">${nl2br(p.body)}</div>`}
      </div>
      ${blockFor(p, me, c, full)}
      <div class="post-foot">
        <button class="react-btn ${liked ? 'on' : ''}" data-action="like" data-id="${p.id}">👍 좋아요${p.reactions.like.length ? ` ${p.reactions.like.length}` : ''}</button>
        <button class="react-btn ${open ? 'on' : ''}" data-action="toggle-comments" data-id="${p.id}">💬 댓글${p.comments.length ? ` ${p.comments.length}` : ''}</button>
        <span class="stat">${fmt.dateTime(p.createdAt)}</span>
      </div>
      ${open ? commentsBlock(p, me) : ''}
    </article>`;
  }

  function blockFor(p, me, c, full) {
    if (p.type === 'letter') {
      const items = p.body.split('\n').map((l) => l.replace(/^\s*(\d+[.)]|[-•*])\s*/, '').trim()).filter(Boolean);
      const audience = [...c.studentIds, ...c.parentIds];
      const readers = (p.reads || []).filter((id) => audience.includes(id));
      const mine = (p.reads || []).includes(me.id);
      const isT = S.isTeacherOf(c);
      return `<div class="post-block">
        <ul class="check-list">${items.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>
        <div class="row between mt-12 wrap">
          <div class="row"><div class="avatar-stack">${readers.slice(0, 5).map((id) => avatar(S.user(id), 'xs')).join('')}</div><span class="small muted">${readers.length}/${audience.length}명 확인</span></div>
          ${isT ? `<button class="btn sm" data-action="read-status" data-id="${p.id}">확인 현황 보기</button>` : mine ? '<span class="chip ok">✅ 확인 완료</span>' : `<button class="btn primary sm" data-action="mark-read" data-id="${p.id}">알림장 확인했어요</button>`}
        </div>
      </div>`;
    }
    if (p.type === 'assignment') {
      const total = c.studentIds.length;
      const done = Object.keys(p.submissions).filter((id) => c.studentIds.includes(id)).length;
      const isT = S.isTeacherOf(c);
      const soon = p.due && new Date(p.due) - Date.now() < 2 * 864e5;
      const over = p.due && new Date(p.due) < new Date();
      let action = '';
      if (isT) action = `<button class="btn sm" data-action="submissions" data-id="${p.id}">제출 현황 · 채점</button>`;
      else if (me.role === 'student') {
        const s = p.submissions[me.id];
        action = s ? `<span class="chip ok">✅ 제출 완료 ${s.score != null ? `· ${s.score}/${p.points || 10}점` : ''}</span> <button class="btn sm" data-action="submit-open" data-id="${p.id}">다시 제출</button>` : `<button class="btn primary sm" data-action="submit-open" data-id="${p.id}">과제 제출하기</button>`;
      } else if (me.role === 'parent') {
        action = S.childrenOf(me).filter((ch) => c.studentIds.includes(ch.id)).map((ch) => p.submissions[ch.id] ? `<span class="chip ok">${esc(ch.name)} 제출 완료</span>` : `<span class="chip warn">${esc(ch.name)} 미제출</span>`).join(' ');
      }
      return `<div class="post-block">
        <div class="row between wrap">
          <div class="due">${p.due ? `<span class="dday ${over ? 'done' : soon ? 'soon' : ''}">${fmt.dday(p.due)}</span> <span class="muted small">마감 ${fmt.dateTime(p.due)}</span>` : '<span class="muted small">마감 기한 없음</span>'} ${p.points ? `<span class="chip">${p.points}점</span>` : ''}</div>
          <div class="row">${action}</div>
        </div>
        <div class="mt-12"><div class="row between small muted"><span>제출 ${done}/${total}명</span><span>${total ? Math.round((done / total) * 100) : 0}%</span></div><div class="progress mt-8"><span style="width:${total ? (done / total) * 100 : 0}%"></span></div></div>
      </div>`;
    }
    if (p.type === 'poll') {
      const total = Object.keys(p.votes).length;
      const closed = p.closesAt && new Date(p.closesAt) < new Date();
      const mine = p.votes[me.id];
      return `<div class="post-block">
        ${p.options.map((o) => { const n = Object.values(p.votes).filter((v) => v === o.id).length; const pct = total ? Math.round((n / total) * 100) : 0; return `<div class="poll-opt ${mine === o.id ? 'mine' : ''}" data-action="${closed ? '' : 'vote'}" data-id="${p.id}" data-opt="${o.id}"><span class="bar" style="width:${pct}%"></span><span>${mine === o.id ? '✔ ' : ''}${esc(o.text)}</span><span class="small muted">${n}표 · ${pct}%</span></div>`; }).join('')}
        <div class="small muted mt-8">${total}명 참여 · ${closed ? '마감됨' : p.closesAt ? `${fmt.dateTime(p.closesAt)} 마감` : '진행 중'} ${mine ? '· 다른 항목을 누르면 변경돼요' : ''}</div>
      </div>`;
    }
    if (p.type === 'album') {
      const photos = full ? p.photos : p.photos.slice(0, 6);
      return `<div class="album-grid">${photos.map((ph, i) => `<div class="photo" style="background:${ph.bg}" data-action="photo" data-id="${p.id}" data-idx="${i}">${ph.emoji}<span class="cap">${esc(ph.label)}</span></div>`).join('')}</div>`;
    }
    return '';
  }

  function commentsBlock(p, me) {
    return `<div class="comments">
      ${p.comments.map((cm) => { const u = S.user(cm.authorId); return `<div class="comment">${avatar(u, 'sm')}<div class="bubble"><span class="name">${esc(u.name)}</span><span class="small muted">${fmt.ago(cm.createdAt)}</span><div class="txt">${nl2br(cm.body)}</div></div></div>`; }).join('')}
      <form class="comment-form" data-form="comment" data-id="${p.id}">${avatar(me, 'sm')}<input name="body" placeholder="댓글을 입력하세요" autocomplete="off" required><button class="btn primary sm" type="submit">등록</button></form>
    </div>`;
  }

  // ---------- 게시물 상세 ----------
  function viewPost(id) {
    const p = S.post(id);
    if (!p) return `<div class="card empty"><div class="big">🔍</div>게시물이 삭제되었거나 존재하지 않아요. <a href="#/">홈으로</a></div>`;
    const c = S.cls(p.classId);
    return `<div class="row mb-12"><a class="btn ghost sm" href="#/class/${c.id}">← ${c.emoji} ${esc(c.name)}</a></div>${postCard(p, { showClass: true, full: true })}`;
  }

  // ---------- 클래스 ----------
  function viewClass(id, tab) {
    const c = S.cls(id);
    const me = S.me();
    if (!c) return `<div class="card empty"><div class="big">🏫</div>클래스를 찾을 수 없어요.</div>`;
    if (!S.isMember(c, me.id)) return `<div class="card empty"><div class="big">🔒</div>이 클래스의 구성원이 아니에요.<div class="mt-12"><button class="btn primary" data-action="open-join">초대 코드로 참여</button></div></div>`;
    const tabs = [['feed', '소식'], ['letter', '알림장'], ['assignment', '과제'], ['album', '앨범'], ['attendance', '출석'], ['members', '구성원']];
    const teachers = c.teacherIds.map(S.user);
    let body = '';
    switch (tab) {
      case 'letter': case 'assignment': case 'album': {
        const posts = S.postsFor(c.id, tab);
        body = (S.isTeacherOf(c) ? `<div class="row between mb-12"><span class="muted small">${posts.length}개</span><button class="btn primary sm" data-action="compose" data-type="${tab}" data-class="${c.id}">${NS.TYPE[tab].icon} ${NS.TYPE[tab].label} 올리기</button></div>` : '') + (posts.length ? posts.map((p) => postCard(p)).join('') : `<div class="card empty"><div class="big">${NS.TYPE[tab].icon}</div>아직 ${NS.TYPE[tab].label}이(가) 없어요.</div>`);
        break;
      }
      case 'attendance': body = attendanceTab(c, me); break;
      case 'members': body = membersTab(c, me); break;
      default: {
        const posts = S.postsFor(c.id);
        body = composerCard(me, c.id) + '<div class="mt-16"></div>' + (posts.length ? posts.map((p) => postCard(p)).join('') : `<div class="card empty"><div class="big">🍃</div>첫 게시물을 올려보세요!</div>`);
      }
    }
    return `
      <div class="class-cover" style="background:${c.cover}">
        <div class="row between wrap">
          <div><div class="small" style="opacity:.9">${esc(c.school)} · ${c.year}학년도</div><h2>${c.emoji} ${esc(c.name)}</h2><div class="sub">${esc(c.description || '')}</div></div>
          <div class="stack" style="gap:6px;align-items:flex-end">
            <div class="row small">담임 ${teachers.map((t) => esc(t.name)).join(', ')} 선생님</div>
            <div class="row small">👥 학생 ${c.studentIds.length} · 학부모 ${c.parentIds.length}</div>
            <div class="row small">초대코드 <span class="code">${esc(c.code)}</span> <button class="btn sm" data-action="copy" data-text="${esc(c.code)}" style="padding:2px 8px">복사</button></div>
          </div>
        </div>
      </div>
      <div class="tabs class-tabs">${tabs.map(([k, l]) => `<a class="tab ${tab === k ? 'active' : ''}" href="#/class/${c.id}/${k}">${l}</a>`).join('')}</div>
      ${body}`;
  }

  function attendanceTab(c, me) {
    const isT = S.isTeacherOf(c);
    const date = ui.attDate;
    const day = (S.state.attendance[c.id] || {})[date] || {};
    let students = c.studentIds.map(S.user).sort((a, b) => (a.number || 0) - (b.number || 0));
    if (me.role === 'student') students = students.filter((s) => s.id === me.id);
    if (me.role === 'parent') students = students.filter((s) => (me.childIds || []).includes(s.id));
    const counts = { present: 0, late: 0, absent: 0, excused: 0 };
    c.studentIds.forEach((id) => { if (day[id]) counts[day[id]] += 1; });
    const unmarked = c.studentIds.length - Object.values(counts).reduce((a, b) => a + b, 0);
    return `<div class="card">
      <div class="row between wrap mb-12">
        <div class="row"><button class="btn sm" data-action="att-date" data-id="-1">‹</button><input type="date" value="${date}" data-action="att-date-input" style="border:1px solid var(--line);border-radius:8px;padding:6px 10px"><button class="btn sm" data-action="att-date" data-id="1">›</button><button class="btn ghost sm" data-action="att-date" data-id="0">오늘</button></div>
        ${isT ? `<button class="btn primary sm" data-action="att-all-present">전원 출석 처리</button>` : ''}
      </div>
      ${isT || me.role !== 'student' ? `<div class="stat-grid mb-16"><div class="stat"><div class="n" style="color:var(--brand-600)">${counts.present}</div><div class="l">출석</div></div><div class="stat"><div class="n" style="color:#b45309">${counts.late}</div><div class="l">지각</div></div><div class="stat"><div class="n" style="color:#b91c1c">${counts.absent}</div><div class="l">결석</div></div><div class="stat"><div class="n" style="color:#4338ca">${counts.excused}</div><div class="l">공결·기타</div></div></div>${unmarked && isT ? `<div class="small muted mb-12">미체크 ${unmarked}명</div>` : ''}` : ''}
      <table class="table"><thead><tr><th>번호</th><th>이름</th><th>${fmt.date(date)}</th><th>최근 30일 출석률</th></tr></thead><tbody>
        ${students.map((s) => { const st = day[s.id]; const rate = S.attendanceRate(c.id, s.id); return `<tr><td class="muted">${s.number || '-'}</td><td><div class="row">${avatar(s, 'sm')}<span class="bold">${esc(s.name)}</span></div></td><td>${isT ? `<div class="att-btns">${Object.keys(NS.ATT).map((k) => `<button class="att-btn ${k} ${st === k ? 'on' : ''}" data-action="att-set" data-id="${s.id}" data-status="${k}">${NS.ATT[k].split('(')[0]}</button>`).join('')}</div>` : st ? `<span class="chip ${st === 'present' ? 'ok' : st === 'late' ? 'warn' : st === 'absent' ? 'bad' : ''}">${NS.ATT[st]}</span>` : '<span class="muted small">미체크</span>'}</td><td>${rate == null ? '<span class="muted small">기록 없음</span>' : `<div class="row"><div class="progress grow" style="max-width:120px"><span style="width:${rate}%"></span></div><span class="small bold">${rate}%</span></div>`}</td></tr>`; }).join('')}
      </tbody></table>
    </div>`;
  }

  function membersTab(c, me) {
    const isT = S.isTeacherOf(c);
    const teachers = c.teacherIds.map(S.user);
    const students = c.studentIds.map(S.user).sort((a, b) => (a.number || 0) - (b.number || 0));
    const parents = c.parentIds.map(S.user);
    const row = (u, sub) => `<div class="member">${avatar(u)}<div class="grow"><div class="nm">${esc(u.name)} ${roleChip(u)}</div><div class="sub">${esc(sub || '')}</div></div>${u.id !== me.id ? `<button class="btn sm" data-action="dm" data-id="${u.id}">✉️ 쪽지</button>` : '<span class="chip">나</span>'}</div>`;
    return `<div class="card">
      <div class="card-title">👩‍🏫 교사 ${teachers.length}</div>${teachers.map((t) => row(t, t.title)).join('')}
    </div>
    <div class="card">
      <div class="card-title">🎒 학생 ${students.length} ${isT ? `<button class="btn sm" data-action="add-student" data-class="${c.id}">+ 학생 추가</button>` : ''}</div>
      ${students.map((s) => row(s, `${s.number || '-'}번 · 보호자 ${S.parentsOf(s.id).map((p) => p.name).join(', ') || '미연결'}`)).join('')}
    </div>
    <div class="card">
      <div class="card-title">👪 학부모 ${parents.length}</div>${parents.length ? parents.map((p) => row(p, p.title)).join('') : '<div class="small muted">아직 참여한 학부모가 없어요. 초대 코드를 공유해 주세요.</div>'}
    </div>
    <div class="card"><div class="card-title">🔗 초대하기</div><p class="small muted">학생·학부모에게 아래 초대 코드를 알려주세요. 마이페이지에서 계정을 전환한 뒤 "초대 코드로 참여"로 체험할 수 있어요.</p><div class="row mt-12"><span class="kbd" style="font-size:16px;padding:6px 12px">${esc(c.code)}</span><button class="btn sm" data-action="copy" data-text="${esc(c.code)}">복사</button></div></div>`;
  }

  // ---------- 캘린더 ----------
  function viewCalendar() {
    const me = S.me();
    const classes = S.myClasses();
    const ids = classes.map((c) => c.id);
    const now = new Date();
    if (!ui.calMonth) ui.calMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    if (!ui.calSel) ui.calSel = NS.util.today();
    const m = ui.calMonth;
    const first = new Date(m.getFullYear(), m.getMonth(), 1);
    const start = new Date(first); start.setDate(1 - first.getDay());
    const events = S.allEvents(ids);
    const byDate = {};
    events.forEach((e) => { (byDate[e.date] = byDate[e.date] || []).push(e); });
    const cells = [];
    for (let i = 0; i < 42; i++) {
      const d = new Date(start); d.setDate(start.getDate() + i);
      const key = fmt.ymd(d);
      const evs = byDate[key] || [];
      const cls = [d.getMonth() !== m.getMonth() ? 'other' : '', key === NS.util.today() ? 'today' : '', key === ui.calSel ? 'sel' : ''].join(' ');
      cells.push(`<div class="cal-cell ${cls}" data-action="cal-select" data-id="${key}"><span class="d ${d.getDay() === 0 ? 'sun' : d.getDay() === 6 ? 'sat' : ''}">${d.getDate()}</span>${evs.slice(0, 3).map((e) => `<div class="ev ${e.kind}">${esc(e.title)}</div>`).join('')}${evs.length > 3 ? `<div class="small muted">+${evs.length - 3}</div>` : ''}<div class="dots">${evs.slice(0, 4).map((e) => `<i class="ev ${e.kind}"></i>`).join('')}</div></div>`);
    }
    const sel = byDate[ui.calSel] || [];
    const canAdd = me.role === 'teacher';
    return `<div class="page-head"><div class="section-title">📅 캘린더</div>${canAdd ? `<button class="btn primary sm" data-action="event-open" data-date="${ui.calSel}">+ 일정 추가</button>` : ''}</div>
      <div class="card">
        <div class="row between mb-12"><button class="btn sm" data-action="cal-month" data-id="-1">‹ 이전</button><div class="bold" style="font-size:17px">${m.getFullYear()}년 ${m.getMonth() + 1}월</div><button class="btn sm" data-action="cal-month" data-id="1">다음 ›</button></div>
        <div class="cal-grid">${DOW.map((d, i) => `<div class="cal-dow ${i === 0 ? 'sun' : i === 6 ? 'sat' : ''}">${d}</div>`).join('')}${cells.join('')}</div>
        <div class="row wrap mt-12 small muted" style="gap:12px"><span><i class="status-dot" style="background:var(--brand)"></i> 학급 일정</span><span><i class="status-dot" style="background:var(--danger)"></i> 평가</span><span><i class="status-dot" style="background:var(--info)"></i> 과제 마감</span><span><i class="status-dot" style="background:var(--violet)"></i> 학교 행사</span></div>
      </div>
      <div class="card">
        <div class="card-title">${fmt.date(ui.calSel)} 일정 <span class="small muted">${sel.length}건</span></div>
        ${sel.length ? sel.map((e) => `<div class="event-item"><span class="dot ev ${e.kind}"></span><div class="grow"><div class="bold">${esc(e.title)}</div><div class="small muted">${esc(S.cls(e.classId)?.name || '')}</div></div>${e.postId ? `<button class="btn sm" data-action="open-post" data-id="${e.postId}">과제 보기</button>` : canAdd ? `<button class="btn ghost sm" data-action="event-delete" data-id="${e.id}">삭제</button>` : ''}</div>`).join('') : '<div class="small muted">일정이 없어요.</div>'}
      </div>`;
  }

  // ---------- 알림 ----------
  function viewNotifications() {
    const list = S.notifications();
    return `<div class="page-head"><div class="section-title">🔔 알림</div><button class="btn sm" data-action="seen-all">모두 읽음</button></div>
      <div class="card">${list.length ? list.map((n) => `<div class="noti ${n.unread ? 'unread' : ''}" data-action="${n.threadId ? 'open-thread' : 'open-post'}" data-id="${n.threadId || n.postId}"><div class="ic">${n.icon}</div><div class="grow"><div class="t">${esc(n.title)}</div><div class="s">${esc(n.sub)}</div></div><div class="when">${fmt.ago(n.at)}</div></div>`).join('') : '<div class="empty"><div class="big">🔕</div>새 알림이 없어요.</div>'}</div>`;
  }

  // ---------- 쪽지 ----------
  function viewMessages(threadId) {
    const me = S.me();
    const threads = S.myThreads();
    const active = threads.find((t) => t.id === threadId);
    if (active) S.markThreadRead(active.id);
    const list = threads.map((t) => { const other = S.user(t.participantIds.find((x) => x !== me.id)); const last = S.lastMsg(t); const n = S.unreadCount(t); return `<div class="thread ${active?.id === t.id ? 'active' : ''}" data-action="open-thread" data-id="${t.id}">${avatar(other)}<div class="grow"><div class="row between"><span class="nm">${esc(other.name)} <span class="small muted">${NS.ROLE[other.role]}</span></span>${last ? `<span class="small muted">${fmt.ago(last.at)}</span>` : ''}</div><div class="last">${last ? esc(last.body) : '대화를 시작해보세요'}</div></div>${n ? `<span class="count chip bad">${n}</span>` : ''}</div>`; }).join('');
    let chat = `<div class="empty" style="padding-top:120px"><div class="big">✉️</div>쪽지를 선택하거나 새 쪽지를 보내보세요.<div class="mt-12"><button class="btn primary sm" data-action="new-dm">새 쪽지</button></div></div>`;
    if (active) {
      const other = S.user(active.participantIds.find((x) => x !== me.id));
      chat = `<div class="chat">
        <div class="chat-head"><a class="btn ghost sm" href="#/messages">←</a>${avatar(other, 'sm')}<div><div class="bold">${esc(other.name)}</div><div class="small muted">${esc(other.title || NS.ROLE[other.role])}</div></div></div>
        <div class="chat-body">${active.messages.map((m) => `<div class="bubble-row ${m.from === me.id ? 'me' : ''}"><div class="msg-bubble">${nl2br(m.body)}</div><span class="when">${fmt.time(m.at)}</span></div>`).join('') || '<div class="small muted center">첫 쪽지를 보내보세요.</div>'}</div>
        <form class="chat-form" data-form="dm" data-id="${active.id}"><input name="body" placeholder="메시지를 입력하세요" autocomplete="off" required><button class="btn primary" type="submit">보내기</button></form>
      </div>`;
    }
    return `<div class="page-head"><div class="section-title">✉️ 쪽지</div><button class="btn primary sm" data-action="new-dm">+ 새 쪽지</button></div>
      <div class="card msg-layout"><div class="thread-list ${active ? 'has-active' : ''}">${list || '<div class="empty">대화가 없어요.</div>'}</div><div>${chat}</div></div>`;
  }

  // ---------- 마이페이지 ----------
  function viewMe() {
    const me = S.me();
    const classes = S.myClasses();
    const myPosts = S.state.posts.filter((p) => p.authorId === me.id).length;
    const s = AI.settings();
    let extra = '';
    if (me.role === 'student') {
      const asg = S.postsFor(classes.map((c) => c.id), 'assignment');
      const done = asg.filter((p) => p.submissions[me.id]).length;
      extra = `<div class="stat"><div class="n">${asg.length ? Math.round((done / asg.length) * 100) : 0}%</div><div class="l">과제 제출률</div></div>`;
    } else if (me.role === 'parent') {
      extra = `<div class="stat"><div class="n">${S.childrenOf(me).map((c) => c.name).join(', ') || '-'}</div><div class="l">자녀</div></div>`;
    } else {
      const total = classes.reduce((a, c) => a + c.studentIds.length, 0);
      extra = `<div class="stat"><div class="n">${total}</div><div class="l">담당 학생</div></div>`;
    }
    return `<div class="page-head"><div class="section-title">👤 마이페이지</div></div>
      <div class="card"><div class="row" style="gap:16px">${avatar(me, 'lg')}<div class="grow"><div style="font-size:20px;font-weight:800">${esc(me.name)} ${roleChip(me)}</div><div class="muted">${esc(me.title || (me.number ? `${me.number}번` : ''))}</div></div></div>
        <div class="stat-grid mt-16"><div class="stat"><div class="n">${classes.length}</div><div class="l">내 클래스</div></div><div class="stat"><div class="n">${myPosts}</div><div class="l">작성한 글</div></div>${extra}<div class="stat"><div class="n">${S.notifications().filter((n) => n.unread).length}</div><div class="l">안 읽은 알림</div></div></div>
      </div>
      <div class="card"><div class="card-title">🔄 데모 계정 전환 <span class="small muted">교사·학생·학부모 화면을 비교해보세요</span></div>
        <div class="row wrap" style="gap:8px">${S.state.users.map((u) => `<button class="btn ${u.id === me.id ? 'active' : ''}" data-action="switch-user" data-id="${u.id}">${avatar(u, 'xs')} ${esc(u.name)} <span class="small" style="opacity:.7">${NS.ROLE[u.role]}</span></button>`).join('')}</div>
      </div>
      <div class="card" id="ai-settings"><div class="card-title">🤖 AI 설정 (OpenRouter) <span class="row small"><i class="status-dot ${s.apiKey ? 'on' : ''}"></i>${s.apiKey ? '키 등록됨' : '미연결 · 데모 모드'}</span></div>
        <form data-form="ai-settings">
          <div class="field"><label>OpenRouter API 키</label><input type="password" name="apiKey" value="${esc(s.apiKey)}" placeholder="sk-or-v1-..." autocomplete="off"><div class="hint">키는 이 브라우저의 localStorage에만 저장되며 openrouter.ai 로만 전송됩니다. <a href="https://openrouter.ai/settings/keys" target="_blank" rel="noopener">키 발급 →</a></div></div>
          <div class="grid-2">
            <div class="field"><label>모델</label><select name="modelSelect">${AI.SUGGESTED_MODELS.map((m) => `<option value="${m.id}" ${m.id === s.model ? 'selected' : ''}>${m.label}</option>`).join('')}<option value="__custom" ${AI.SUGGESTED_MODELS.some((m) => m.id === s.model) ? '' : 'selected'}>직접 입력…</option></select></div>
            <div class="field"><label>모델 슬러그 (직접 입력)</label><input name="model" value="${esc(s.model)}" placeholder="provider/model-name"></div>
          </div>
          <div class="field"><label>창의성 (temperature: <span id="temp-val">${s.temperature}</span>)</label><input type="range" name="temperature" min="0" max="1.5" step="0.1" value="${s.temperature}" oninput="document.getElementById('temp-val').textContent=this.value"></div>
          <div class="row wrap"><button class="btn primary" type="submit">저장</button><button class="btn" type="button" data-action="ai-test">연결 테스트</button><button class="btn ghost" type="button" data-action="ai-models">모델 목록 불러오기</button><span class="small muted" id="ai-test-result"></span></div>
        </form>
      </div>
      <div class="card"><div class="card-title">🗂 데이터</div>
        <p class="small muted">모든 데이터는 브라우저(localStorage)에만 저장되는 데모입니다. 서버·DB 없이 동작하며 초기화하면 시드 데이터로 돌아갑니다.</p>
        <div class="row wrap mt-12"><button class="btn" data-action="export">JSON 내보내기</button><label class="btn">JSON 가져오기<input type="file" accept="application/json" data-action="import" hidden></label><button class="btn danger" data-action="reset-data">데이터 초기화</button></div>
      </div>`;
  }

  // ---------- 검색 ----------
  function viewSearch(q) {
    const ids = S.myClasses().map((c) => c.id);
    const needle = q.trim().toLowerCase();
    const posts = needle ? S.postsFor(ids).filter((p) => (p.title + ' ' + p.body + ' ' + S.user(p.authorId).name).toLowerCase().includes(needle)) : [];
    return `<div class="page-head"><div class="section-title">🔍 "${esc(q)}" 검색 결과 <span class="small muted">${posts.length}건</span></div></div>${posts.length ? posts.map((p) => postCard(p, { showClass: true })).join('') : '<div class="card empty"><div class="big">🔎</div>일치하는 게시물이 없어요.</div>'}`;
  }

  // ---------- AI 보조교사 ----------
  function aiContext() {
    const me = S.me();
    const classes = S.myClasses();
    const ids = classes.map((c) => c.id);
    const todayStr = NS.util.today();
    return {
      userName: me.name, roleLabel: NS.ROLE[me.role],
      classes: classes.map((c) => `${c.name}(${c.school})`),
      upcoming: S.allEvents(ids).filter((e) => e.date >= todayStr).slice(0, 5).map((e) => `${e.date} ${e.title}`),
      recent: S.postsFor(ids).slice(0, 5).map((p) => `[${NS.TYPE[p.type].label}] ${p.title || p.body.slice(0, 30)}`),
    };
  }
  const QUICK = {
    teacher: ['오늘 알림장 초안 써줘 (준비물·숙제 포함)', '독서록 과제에 대한 격려 피드백 3가지 버전', '현장체험학습 안내 가정통신문 작성', '이번 주 학급 소식 요약해서 학부모용 공지 만들어줘'],
    student: ['독서록 쓸 때 첫 문장 어떻게 시작하면 좋아?', '분수 덧셈이 헷갈려. 힌트만 줘', '내일 준비물 정리해줘', '받아쓰기 연습 방법 알려줘'],
    parent: ['선생님께 상담 요청 쪽지 정중하게 써줘', '아이 과제 도와줄 때 팁', '이번 주 우리 반 일정 정리해줘', '가정에서 독서 습관 만드는 방법'],
  };
  function viewAI() {
    const me = S.me();
    const s = AI.settings();
    const msgs = ui.aiMessages;
    return `<div class="card ai-hero"><div class="row between wrap"><div><div class="section-title">🤖 AI 보조교사 링고</div><div class="small" style="opacity:.8">OpenRouter API로 연결된 ${esc(s.model)} · ${s.apiKey ? '<span class="status-dot on"></span> 연결됨' : '<span class="status-dot"></span> 데모 모드 (<a href="#/me" style="color:#6ee7b7">키 등록</a>)'}</div></div><button class="btn sm" data-action="ai-clear">대화 지우기</button></div></div>
      <div class="card">
        <div class="quick mb-12">${QUICK[me.role].map((q) => `<button data-action="ai-quick" data-text="${esc(q)}">${esc(q)}</button>`).join('')}</div>
        <div class="ai-chat" id="ai-chat">${msgs.length ? msgs.map(aiMsgHtml).join('') : `<div class="empty"><div class="big">✨</div>${esc(me.name)}님, 무엇을 도와드릴까요?<br><span class="small">알림장 초안, 과제 피드백, 학부모 안내문, 학습 힌트 등을 요청해보세요.</span></div>`}</div>
        <form class="comment-form mt-12" data-form="ai"><input name="q" placeholder="링고에게 물어보기…" autocomplete="off" required ${ui.aiBusy ? 'disabled' : ''}><button class="btn primary" type="submit" ${ui.aiBusy ? 'disabled' : ''}>${ui.aiBusy ? '생성 중…' : '보내기'}</button></form>
        <div class="small muted mt-8">학생 개인정보는 전송하지 않으며, 이름·역할·일정·최근 게시물 제목만 컨텍스트로 제공됩니다.</div>
      </div>`;
  }
  const aiMsgHtml = (m, i) => `<div class="ai-msg ${m.role}" data-idx="${i}">${m.role === 'user' ? avatar(S.me(), 'sm') : '<span class="avatar sm" style="background:#111827">링</span>'}<div class="body ${m.error ? 'err' : ''} ${m.streaming ? 'cursor' : ''}">${esc(m.content)}${m.role === 'assistant' && !m.streaming && !m.error ? `<div class="mt-8"><button class="btn sm" data-action="copy" data-text="${esc(m.content)}">복사</button></div>` : ''}</div></div>`;

  async function askAI(question) {
    if (ui.aiBusy || !question.trim()) return;
    ui.aiMessages.push({ role: 'user', content: question.trim() });
    const reply = { role: 'assistant', content: '', streaming: true };
    ui.aiMessages.push(reply);
    ui.aiBusy = true; render();
    const ctx = aiContext();
    const paint = () => { const el = $('#ai-chat'); if (el) { el.innerHTML = ui.aiMessages.map(aiMsgHtml).join(''); el.scrollTop = el.scrollHeight; } };
    try {
      if (!AI.hasKey()) {
        await new Promise((r) => setTimeout(r, 500));
        reply.content = AI.demoReply(question, ctx);
      } else {
        const history = ui.aiMessages.filter((m) => !m.streaming && !m.error).slice(-10).map((m) => ({ role: m.role, content: m.content }));
        await AI.chat([{ role: 'system', content: AI.systemPrompt(ctx) }, ...history], { onToken: (t, full) => { reply.content = full; paint(); } });
      }
    } catch (e) {
      reply.error = true; reply.content = e.code === 'NO_KEY' ? 'OpenRouter API 키가 필요해요. 마이페이지에서 등록해 주세요.' : e.message;
    }
    reply.streaming = false; ui.aiBusy = false; render();
  }

  // ---------- 작성 모달 ----------
  function composeModal(type, classId, prefill = {}) {
    const me = S.me();
    const classes = S.myClasses().filter((c) => type === 'general' || S.isTeacherOf(c));
    if (!classes.length) { toast('글을 올릴 수 있는 클래스가 없어요', 'bad'); return; }
    const t = NS.TYPE[type];
    const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 3); tomorrow.setHours(18, 0, 0, 0);
    const local = (d) => { const p = (n) => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`; };
    const placeholders = { notice: '학급 공지 내용을 입력하세요', letter: '한 줄에 하나씩 적으면 체크리스트로 보여요\n1. 수학익힘책 42쪽\n2. 내일 준비물: 색종이', assignment: '과제 내용과 제출 방법을 안내하세요', poll: '설문 안내 문구', album: '사진과 함께 남길 이야기', general: '무슨 이야기를 나눌까요?' };
    const typeFields = {
      assignment: `<div class="grid-2"><div class="field"><label>마감일시</label><input type="datetime-local" name="due" value="${local(tomorrow)}"></div><div class="field"><label>배점</label><input type="number" name="points" value="10" min="0"></div></div>`,
      poll: `<div class="field"><label>선택지 (한 줄에 하나)</label><textarea name="options" style="min-height:80px" placeholder="예)&#10;주먹밥&#10;김밥&#10;샌드위치">${esc(prefill.options || '')}</textarea></div><div class="field"><label>마감일시</label><input type="datetime-local" name="closesAt" value="${local(tomorrow)}"></div>`,
      album: `<div class="field"><label>사진 (데모: 이모지로 대체, 콤마로 구분)</label><input name="photos" value="🎨,🏃,📚,🎵" placeholder="🎨,🏃,📚"><div class="hint">실제 서비스에서는 파일 업로드가 들어갈 자리예요.</div></div>`,
    };
    openModal(`${modalHead(`${t.icon} ${t.label} 올리기`)}
      <form data-form="post" class="modal-body">
        <input type="hidden" name="type" value="${type}">
        <div class="field"><label>클래스</label><select name="classId">${classes.map((c) => `<option value="${c.id}" ${c.id === classId ? 'selected' : ''}>${c.emoji} ${esc(c.name)}</option>`).join('')}</select></div>
        ${type !== 'general' ? `<div class="field"><label>제목</label><input name="title" required value="${esc(prefill.title || (type === 'letter' ? `${new Date().getMonth() + 1}월 ${new Date().getDate()}일 알림장` : ''))}" placeholder="제목"></div>` : ''}
        <div class="field"><label>내용</label><textarea name="body" required placeholder="${placeholders[type]}">${esc(prefill.body || '')}</textarea>${me.role === 'teacher' ? `<div class="row between"><span class="hint">✨ AI가 초안을 써줄 수 있어요</span><button type="button" class="btn sm soft" data-action="ai-fill" data-type="${type}">AI 초안 채우기</button></div>` : ''}</div>
        ${typeFields[type] || ''}
        ${me.role === 'teacher' && type !== 'general' ? `<label class="row small"><input type="checkbox" name="pinned"> 상단에 고정</label>` : ''}
        <div class="modal-foot" style="padding:16px 0 0"><button type="button" class="btn" data-action="close-modal">취소</button><button class="btn primary" type="submit">게시하기</button></div>
      </form>`);
  }

  function readStatusModal(p) {
    const c = S.cls(p.classId);
    const rows = c.studentIds.map(S.user).sort((a, b) => (a.number || 0) - (b.number || 0)).map((s) => {
      const parents = S.parentsOf(s.id);
      const sRead = (p.reads || []).includes(s.id);
      const pRead = parents.some((pp) => (p.reads || []).includes(pp.id));
      return `<tr><td>${s.number || '-'}</td><td class="bold">${esc(s.name)}</td><td>${sRead ? '<span class="chip ok">확인</span>' : '<span class="chip">미확인</span>'}</td><td>${parents.length ? (pRead ? '<span class="chip ok">확인</span>' : '<span class="chip warn">미확인</span>') : '<span class="small muted">미연결</span>'}</td></tr>`;
    }).join('');
    openModal(`${modalHead('📒 알림장 확인 현황')}<div class="modal-body"><div class="bold mb-8">${esc(p.title)}</div><table class="table"><thead><tr><th>번호</th><th>학생</th><th>학생 확인</th><th>학부모 확인</th></tr></thead><tbody>${rows}</tbody></table></div>`);
  }

  function submissionsModal(p) {
    const c = S.cls(p.classId);
    const rows = c.studentIds.map(S.user).sort((a, b) => (a.number || 0) - (b.number || 0)).map((s) => {
      const sub = p.submissions[s.id];
      return `<div class="member" style="align-items:flex-start">${avatar(s, 'sm')}<div class="grow"><div class="nm">${esc(s.name)} ${sub ? `<span class="small muted">${fmt.dateTime(sub.at)} 제출</span>` : '<span class="chip warn">미제출</span>'}</div>
        ${sub ? `<div class="post-text small mt-8" style="background:#fafafa;border-radius:8px;padding:8px 10px">${nl2br(sub.body)}</div>
        <form class="row mt-8 wrap" data-form="grade" data-id="${p.id}" data-student="${s.id}"><input name="score" type="number" min="0" max="${p.points || 10}" value="${sub.score ?? ''}" placeholder="점수" style="width:70px;border:1px solid var(--line);border-radius:8px;padding:6px 8px"><span class="small muted">/ ${p.points || 10}</span><input name="feedback" value="${esc(sub.feedback || '')}" placeholder="피드백" class="grow" style="border:1px solid var(--line);border-radius:8px;padding:6px 10px;min-width:140px"><button class="btn primary sm" type="submit">저장</button>${AI.hasKey() ? `<button class="btn sm soft" type="button" data-action="ai-feedback" data-id="${p.id}" data-student="${s.id}">✨ AI 피드백</button>` : ''}</form>` : ''}
      </div></div>`;
    }).join('');
    openModal(`${modalHead('📝 제출 현황 · 채점')}<div class="modal-body"><div class="bold mb-12">${esc(p.title)} <span class="small muted">· 제출 ${Object.keys(p.submissions).length}/${c.studentIds.length}</span></div>${rows}</div>`, { wide: true });
  }

  function submitModal(p) {
    const me = S.me();
    const prev = p.submissions[me.id];
    openModal(`${modalHead('📝 과제 제출')}<form class="modal-body" data-form="submit" data-id="${p.id}"><div class="bold mb-8">${esc(p.title)}</div><div class="post-text small muted mb-12">${nl2br(p.body)}</div>${p.due ? `<div class="small mb-12"><span class="dday">${fmt.dday(p.due)}</span> 마감 ${fmt.dateTime(p.due)}</div>` : ''}<div class="field"><label>제출 내용</label><textarea name="body" required placeholder="과제 내용을 작성하세요">${esc(prev?.body || '')}</textarea><div class="hint">실제 서비스에서는 파일·사진 첨부가 가능해요.</div></div><div class="modal-foot" style="padding:8px 0 0"><button type="button" class="btn" data-action="close-modal">취소</button><button class="btn primary" type="submit">${prev ? '다시 제출' : '제출하기'}</button></div></form>`);
  }

  function joinModal() {
    const me = S.me();
    openModal(`${modalHead('➕ 클래스 참여')}<div class="modal-body">
      <form data-form="join"><div class="field"><label>초대 코드</label><input name="code" placeholder="예) HB32-2026" required style="text-transform:uppercase"><div class="hint">데모 코드: HB32-2026 (3학년 2반), CODE-AFT (방과후 코딩반)</div></div><button class="btn primary block" type="submit">참여하기</button></form>
      ${me.role === 'teacher' ? `<hr style="border:0;border-top:1px solid var(--line);margin:18px 0"><form data-form="create-class"><div class="bold mb-8">새 클래스 만들기</div><div class="grid-2"><div class="field"><label>클래스 이름</label><input name="name" required placeholder="예) 4학년 1반"></div><div class="field"><label>학교</label><input name="school" required placeholder="예) 서울한빛초등학교"></div></div><div class="grid-2"><div class="field"><label>이모지</label><input name="emoji" value="🏫" maxlength="4"></div><div class="field"><label>색상</label><input type="color" name="color" value="#10b981" style="height:42px"></div></div><div class="field"><label>소개</label><input name="description" placeholder="한 줄 소개"></div><button class="btn block" type="submit">클래스 만들기</button></form>` : ''}
    </div>`);
  }

  function newDmModal() {
    const me = S.me();
    const people = new Map();
    S.myClasses().forEach((c) => S.memberIds(c).forEach((id) => { if (id !== me.id) people.set(id, S.user(id)); }));
    openModal(`${modalHead('✉️ 새 쪽지')}<div class="modal-body">${[...people.values()].map((u) => `<div class="member" style="cursor:pointer" data-action="dm" data-id="${u.id}">${avatar(u)}<div class="grow"><div class="nm">${esc(u.name)} ${roleChip(u)}</div><div class="sub">${esc(u.title || (u.number ? `${u.number}번` : ''))}</div></div><span class="btn sm">쪽지</span></div>`).join('')}</div>`);
  }

  function eventModal(date) {
    const classes = S.myClasses().filter((c) => S.isTeacherOf(c));
    openModal(`${modalHead('📅 일정 추가')}<form class="modal-body" data-form="event"><div class="field"><label>클래스</label><select name="classId">${classes.map((c) => `<option value="${c.id}">${c.emoji} ${esc(c.name)}</option>`).join('')}</select></div><div class="grid-2"><div class="field"><label>날짜</label><input type="date" name="date" value="${date}" required></div><div class="field"><label>종류</label><select name="kind"><option value="event">학급 일정</option><option value="exam">평가</option><option value="school">학교 행사</option></select></div></div><div class="field"><label>제목</label><input name="title" required placeholder="예) 현장체험학습"></div><div class="modal-foot" style="padding:8px 0 0"><button type="button" class="btn" data-action="close-modal">취소</button><button class="btn primary" type="submit">추가</button></div></form>`);
  }

  async function aiDraftInto(form, type) {
    const btn = form.querySelector('[data-action="ai-fill"]');
    const ta = form.querySelector('textarea[name=body]');
    const titleEl = form.querySelector('input[name=title]');
    const cls = S.cls(form.classId.value);
    const ask = { notice: '학급 공지문', letter: '오늘의 알림장(번호 목록 4~5줄, 준비물·숙제 포함)', assignment: '과제 안내문(목표·방법·제출·유의사항)', poll: '학부모 대상 설문 안내 문구 2~3문장', album: '학급 사진 앨범에 붙일 따뜻한 소개글 2~3문장', general: '학급 소식 글' }[type];
    const hint = ta.value.trim() ? `참고 메모: ${ta.value.trim()}` : '';
    btn.disabled = true; btn.textContent = '작성 중…';
    try {
      const ctx = aiContext();
      let text;
      if (!AI.hasKey()) text = AI.demoReply(type === 'letter' ? '알림장' : type === 'assignment' ? '과제' : type === 'poll' ? '학부모' : '알림장', ctx).replace(/\n\n※.*$/s, '');
      else text = await AI.chat([{ role: 'system', content: AI.systemPrompt(ctx) }, { role: 'user', content: `${cls?.name || '우리 반'}에 올릴 ${ask}을 작성해줘. ${titleEl?.value ? `제목: ${titleEl.value}.` : ''} ${hint} 본문만 출력하고 다른 설명은 붙이지 마.` }], { onToken: (t, full) => { ta.value = full; } });
      ta.value = text; toast(AI.hasKey() ? 'AI 초안을 채웠어요 ✨' : '데모 초안을 채웠어요 (API 키 등록 시 실제 AI 사용)');
    } catch (e) { toast(e.message, 'bad'); }
    btn.disabled = false; btn.textContent = 'AI 초안 채우기';
  }

  // ---------- 이벤트 처리 ----------
  document.addEventListener('click', async (ev) => {
    const el = ev.target.closest('[data-action]');
    if (!el) return;
    const action = el.dataset.action, id = el.dataset.id;
    if (!action) return;
    if (el.tagName === 'A' && el.getAttribute('href') === '#') ev.preventDefault();
    if (el.tagName === 'A' && action !== 'open-join') { /* 링크는 기본 동작 유지 */ }
    switch (action) {
      case 'modal-back': if (ev.target === el) closeModal(); break;
      case 'close-modal': closeModal(); break;
      case 'filter': ui.filter = id; render(); break;
      case 'compose': ev.preventDefault(); composeModal(el.dataset.type, el.dataset.class || undefined); break;
      case 'ai-draft-open': composeModal('letter', el.dataset.class || undefined, { body: '' }); setTimeout(() => { const f = $('form[data-form=post]'); if (f) aiDraftInto(f, 'letter'); }, 50); break;
      case 'ai-fill': aiDraftInto(el.closest('form'), el.dataset.type); break;
      case 'like': S.toggleLike(id); render(); break;
      case 'toggle-comments': ui.openComments.has(id) ? ui.openComments.delete(id) : ui.openComments.add(id); render(); setTimeout(() => { const i = $(`#post-${id} .comment-form input`); if (i && ui.openComments.has(id)) i.focus({ preventScroll: true }); }, 0); break;
      case 'pin': S.togglePin(id); render(); break;
      case 'delete-post': if (confirm('이 게시물을 삭제할까요?')) { S.removePost(id); toast('삭제했어요'); if (ui.route.name === 'post') go('#/'); else render(); } break;
      case 'mark-read': S.markRead(id); toast('알림장을 확인했어요 ✅', 'ok'); render(); break;
      case 'read-status': readStatusModal(S.post(id)); break;
      case 'submissions': submissionsModal(S.post(id)); break;
      case 'submit-open': submitModal(S.post(id)); break;
      case 'vote': S.vote(id, el.dataset.opt); render(); break;
      case 'photo': { const p = S.post(id); const ph = p.photos[+el.dataset.idx]; openModal(`${modalHead(esc(ph.label))}<div class="modal-body"><div class="photo" style="background:${ph.bg};font-size:120px;aspect-ratio:4/3;border-radius:12px">${ph.emoji}</div><p class="small muted mt-12">${esc(p.title)} · ${fmt.date(p.createdAt)}</p></div>`); break; }
      case 'open-post': { const p = S.post(id); if (p) go(`#/post/${id}`); break; }
      case 'go-calendar': ui.calSel = id; ui.calMonth = new Date(id.slice(0, 7) + '-01T00:00:00'); go('#/calendar'); break;
      case 'open-thread': go(`#/messages/${id}`); break;
      case 'new-dm': newDmModal(); break;
      case 'dm': { const t = S.openThread(id); closeModal(); go(`#/messages/${t.id}`); break; }
      case 'open-join': ev.preventDefault(); joinModal(); break;
      case 'copy': try { await navigator.clipboard.writeText(el.dataset.text); toast('복사했어요'); } catch (e) { toast('복사 실패: ' + el.dataset.text, 'bad'); } break;
      case 'att-date': { if (id === '0') ui.attDate = NS.util.today(); else { const d = new Date(ui.attDate + 'T00:00:00'); d.setDate(d.getDate() + +id); ui.attDate = fmt.ymd(d); } render(); break; }
      case 'att-set': { const c = S.cls(ui.route.id); const cur = (S.state.attendance[c.id]?.[ui.attDate] || {})[id]; S.setAttendance(c.id, ui.attDate, id, cur === el.dataset.status ? null : el.dataset.status); render(); break; }
      case 'att-all-present': { const c = S.cls(ui.route.id); c.studentIds.forEach((sid) => { if (!(S.state.attendance[c.id]?.[ui.attDate] || {})[sid]) S.setAttendance(c.id, ui.attDate, sid, 'present'); }); toast('전원 출석 처리했어요', 'ok'); render(); break; }
      case 'add-student': { const name = prompt('추가할 학생 이름'); if (name && name.trim()) { S.addStudent(el.dataset.class, name.trim()); toast(`${name.trim()} 학생을 추가했어요`, 'ok'); render(); } break; }
      case 'cal-month': ui.calMonth = new Date(ui.calMonth.getFullYear(), ui.calMonth.getMonth() + +id, 1); render(); break;
      case 'cal-select': ui.calSel = id; render(); break;
      case 'event-open': eventModal(el.dataset.date || ui.calSel); break;
      case 'event-delete': S.removeEvent(id); render(); break;
      case 'seen-all': S.markAllSeen(); render(); break;
      case 'switch-user': S.setUser(id); ui.aiMessages = []; toast(`${S.me().name} 계정으로 전환했어요`); go('#/'); render(); break;
      case 'reset-data': if (confirm('모든 데이터를 초기 상태로 되돌릴까요?')) { S.reset(); ui.aiMessages = []; toast('초기화했어요'); go('#/'); render(); } break;
      case 'export': { const blob = new Blob([S.exportJSON()], { type: 'application/json' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `classring-${NS.util.today()}.json`; a.click(); URL.revokeObjectURL(a.href); break; }
      case 'ai-quick': askAI(el.dataset.text); break;
      case 'ai-clear': ui.aiMessages = []; render(); break;
      case 'ai-test': {
        const out = $('#ai-test-result'); out.textContent = '연결 확인 중…';
        try { const form = el.closest('form'); AI.saveSettings({ apiKey: form.apiKey.value.trim(), model: form.model.value.trim() }); const r = await AI.testConnection(); out.textContent = `✅ 응답: ${r}`; toast('OpenRouter 연결 성공', 'ok'); render(); } catch (e) { out.textContent = `❌ ${e.code === 'NO_KEY' ? 'API 키를 입력하세요' : e.message}`; }
        break;
      }
      case 'ai-models': {
        const out = $('#ai-test-result'); out.textContent = '모델 목록 불러오는 중…';
        try { const list = await AI.listModels(); out.textContent = `${list.length}개 모델 사용 가능`; openModal(`${modalHead('OpenRouter 모델 목록')}<div class="modal-body"><input placeholder="검색…" data-action="none" oninput="[...this.parentNode.querySelectorAll('.member')].forEach(r=>r.hidden=!r.textContent.toLowerCase().includes(this.value.toLowerCase()))" style="width:100%;border:1px solid var(--line);border-radius:8px;padding:8px 10px;margin-bottom:8px">${list.slice(0, 400).map((m) => `<div class="member" style="cursor:pointer" data-action="pick-model" data-id="${esc(m.id)}"><div class="grow"><div class="nm small">${esc(m.name)}</div><div class="sub">${esc(m.id)} · ctx ${m.context || '-'} · $${(parseFloat(m.pricing?.prompt || 0) * 1e6).toFixed(2)}/M in</div></div></div>`).join('')}</div>`, { wide: true }); } catch (e) { out.textContent = `❌ ${e.message}`; }
        break;
      }
      case 'pick-model': { const f = $('form[data-form=ai-settings]'); if (f) { f.model.value = id; f.modelSelect.value = '__custom'; } closeModal(); toast(`모델 선택: ${id}`); break; }
      case 'ai-feedback': {
        const p = S.post(id); const sub = p.submissions[el.dataset.student]; const form = el.closest('form'); el.disabled = true; el.textContent = '생성 중…';
        try { const text = await AI.chat([{ role: 'system', content: AI.systemPrompt(aiContext()) }, { role: 'user', content: `초등학생 과제 "${p.title}"에 대한 학생 제출물입니다:\n"""${sub.body}"""\n격려 중심으로 잘한 점 1가지, 보완할 점 1가지를 담아 2문장, 80자 이내의 피드백을 써줘. 피드백 문장만 출력.` }], { maxTokens: 200 }); form.feedback.value = text.trim().replace(/^"|"$/g, ''); } catch (e) { toast(e.message, 'bad'); }
        el.disabled = false; el.textContent = '✨ AI 피드백'; break;
      }
      default: break;
    }
  });

  document.addEventListener('input', (ev) => {
    const el = ev.target;
    if (el.dataset.action === 'att-date-input' && el.value) { ui.attDate = el.value; render(); }
    if (el.name === 'modelSelect') { const f = el.closest('form'); if (el.value !== '__custom') f.model.value = el.value; }
  });
  document.addEventListener('change', (ev) => {
    const el = ev.target;
    if (el.dataset.action === 'import' && el.files?.[0]) {
      const fr = new FileReader();
      fr.onload = () => { try { S.importJSON(fr.result); toast('가져왔어요', 'ok'); render(); } catch (e) { toast('가져오기 실패: ' + e.message, 'bad'); } };
      fr.readAsText(el.files[0]);
    }
  });

  document.addEventListener('submit', (ev) => {
    const form = ev.target.closest('form[data-form]');
    if (!form) return;
    ev.preventDefault();
    const kind = form.dataset.form, id = form.dataset.id;
    const f = new FormData(form);
    const v = (k) => (f.get(k) || '').toString().trim();
    switch (kind) {
      case 'comment': S.addComment(id, v('body')); ui.openComments.add(id); render(); break;
      case 'dm': S.sendMessage(id, v('body')); render(); break;
      case 'submit': S.submit(id, v('body')); closeModal(); toast('과제를 제출했어요 🎉', 'ok'); render(); break;
      case 'grade': { const sc = v('score'); S.grade(id, form.dataset.student, sc === '' ? null : +sc, v('feedback')); toast('저장했어요', 'ok'); render(); break; }
      case 'join': { const r = S.joinByCode(v('code')); if (r.error) toast(r.error, 'bad'); else { closeModal(); toast(`${r.cls.name}에 참여했어요 🎉`, 'ok'); go(`#/class/${r.cls.id}`); } render(); break; }
      case 'create-class': { const c = S.addClass({ name: v('name'), school: v('school'), emoji: v('emoji') || '🏫', color: v('color'), cover: `linear-gradient(135deg,${v('color')},${v('color')}aa)`, description: v('description') }); closeModal(); toast('클래스를 만들었어요 🎉', 'ok'); go(`#/class/${c.id}`); break; }
      case 'event': S.addEvent({ classId: v('classId'), date: v('date'), kind: v('kind'), title: v('title') }); ui.calSel = v('date'); closeModal(); toast('일정을 추가했어요', 'ok'); render(); break;
      case 'ai-settings': { const model = v('model') || v('modelSelect'); AI.saveSettings({ apiKey: v('apiKey'), model, temperature: +v('temperature') }); toast('AI 설정을 저장했어요', 'ok'); render(); break; }
      case 'ai': { const q = v('q'); form.reset(); askAI(q); break; }
      case 'post': {
        const type = v('type');
        const data = { type, classId: v('classId'), title: v('title'), body: v('body'), pinned: f.get('pinned') === 'on' };
        if (type === 'assignment') { data.due = v('due') ? new Date(v('due')).toISOString() : null; data.points = +v('points') || 0; }
        if (type === 'poll') {
          const opts = v('options').split('\n').map((s) => s.trim()).filter(Boolean);
          if (opts.length < 2) { toast('선택지를 2개 이상 입력하세요', 'bad'); return; }
          data.options = opts.map((t, i) => ({ id: `o${i + 1}`, text: t })); data.closesAt = v('closesAt') ? new Date(v('closesAt')).toISOString() : null;
        }
        if (type === 'album') {
          const bgs = ['linear-gradient(135deg,#34d399,#059669)', 'linear-gradient(135deg,#60a5fa,#1d4ed8)', 'linear-gradient(135deg,#fbbf24,#d97706)', 'linear-gradient(135deg,#a78bfa,#6d28d9)', 'linear-gradient(135deg,#f472b6,#be185d)', 'linear-gradient(135deg,#4ade80,#16a34a)'];
          data.photos = v('photos').split(',').map((s) => s.trim()).filter(Boolean).map((e, i) => ({ emoji: e, label: `사진 ${i + 1}`, bg: bgs[i % bgs.length] }));
        }
        const p = S.addPost(data); closeModal(); toast(`${NS.TYPE[type].label}을(를) 게시했어요 🎉`, 'ok');
        if (ui.route.name === 'class' && ui.route.id !== p.classId) go(`#/class/${p.classId}`); else render();
        break;
      }
      case 'search': go(`#/search?q=${encodeURIComponent(v('q'))}`); break;
      default: break;
    }
  });

  document.addEventListener('keydown', (ev) => { if (ev.key === 'Escape' && !$('#modal-root').hidden) closeModal(); });
  window.addEventListener('hashchange', render);

  // ---------- 부팅 ----------
  S.load();
  render();
  NS.app = { render, toast, go, ui };
})();
