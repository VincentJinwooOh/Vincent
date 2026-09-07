/* ClassRing — 데이터 모델 · 시드 데이터 · localStorage 저장소
 * 서버 없이 동작하는 데모용 스토어. 실제 서비스에서는 이 계층만 API 호출로 교체하면 된다.
 */
(function () {
  'use strict';
  const NS = (window.CR = window.CR || {});
  const KEY = 'classring.state.v1';
  const USER_KEY = 'classring.user.v1';

  // ---------- 날짜 유틸 ----------
  const pad = (n) => String(n).padStart(2, '0');
  const toISODate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const today = () => toISODate(new Date());
  function at(dayOffset, hour = 9, minute = 0) {
    const d = new Date();
    d.setDate(d.getDate() + dayOffset);
    d.setHours(hour, minute, 0, 0);
    return d.toISOString();
  }
  function dateOffset(dayOffset) {
    const d = new Date();
    d.setDate(d.getDate() + dayOffset);
    return toISODate(d);
  }
  const uid = (p = 'id') => `${p}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

  // ---------- 시드 데이터 ----------
  function seed() {
    const users = [
      { id: 't1', name: '김하늘', role: 'teacher', title: '3학년 2반 담임교사', color: '#0ea5e9' },
      { id: 't2', name: '박도윤', role: 'teacher', title: '방과후 코딩 강사', color: '#8b5cf6' },
      { id: 's1', name: '오진우', role: 'student', number: 12, color: '#f59e0b', parentIds: ['p1'] },
      { id: 's2', name: '이서연', role: 'student', number: 15, color: '#ec4899', parentIds: ['p2'] },
      { id: 's3', name: '박민준', role: 'student', number: 7, color: '#14b8a6' },
      { id: 's4', name: '최지우', role: 'student', number: 21, color: '#6366f1' },
      { id: 's5', name: '정하은', role: 'student', number: 19, color: '#f97316' },
      { id: 'p1', name: '김미영', role: 'parent', title: '오진우 학생 보호자', childIds: ['s1'], color: '#a855f7' },
      { id: 'p2', name: '이정훈', role: 'parent', title: '이서연 학생 보호자', childIds: ['s2'], color: '#84cc16' },
    ];

    const classes = [
      {
        id: 'c1', name: '3학년 2반', school: '서울한빛초등학교', year: 2026, emoji: '🌱', color: '#10b981',
        cover: 'linear-gradient(135deg,#059669,#34d399)', teacherIds: ['t1'],
        studentIds: ['s1', 's2', 's3', 's4', 's5'], parentIds: ['p1', 'p2'], code: 'HB32-2026',
        description: '서로 존중하고 함께 자라는 3학년 2반입니다. 알림장과 과제는 매일 오후 3시에 올라갑니다.',
      },
      {
        id: 'c2', name: '방과후 코딩반', school: '서울한빛초등학교', year: 2026, emoji: '💻', color: '#8b5cf6',
        cover: 'linear-gradient(135deg,#6d28d9,#a78bfa)', teacherIds: ['t2', 't1'],
        studentIds: ['s1', 's3', 's5'], parentIds: ['p1'], code: 'CODE-AFT',
        description: '매주 화·목 방과후 엔트리와 스크래치로 게임을 만듭니다.',
      },
    ];

    const posts = [
      {
        id: 'po1', classId: 'c1', authorId: 't1', type: 'notice', pinned: true,
        title: '9월 학급 운영 안내',
        body: '안녕하세요, 3학년 2반 학부모님과 친구들!\n\n2학기가 시작되었습니다. 이번 달 주요 일정을 안내드립니다.\n\n• 현장체험학습: 서울숲 생태 탐방\n• 학부모 상담주간: 3주차\n• 받아쓰기 평가: 매주 금요일\n\n알림장은 매일 오후 3시에 올라오니 꼭 확인 부탁드립니다. 궁금한 점은 쪽지로 언제든 연락 주세요 😊',
        createdAt: at(-6, 15), reactions: { like: ['s1', 's2', 'p1', 'p2', 's4'] },
        comments: [
          { id: 'cm1', authorId: 'p1', body: '안내 감사합니다 선생님! 상담주간 신청은 어떻게 하나요?', createdAt: at(-6, 18, 12) },
          { id: 'cm2', authorId: 't1', body: '다음 주 알림장에 신청 링크를 올려드릴게요 :)', createdAt: at(-6, 19, 2) },
        ],
      },
      {
        id: 'po2', classId: 'c1', authorId: 't1', type: 'letter',
        title: '오늘의 알림장',
        body: '1. 수학익힘책 42~43쪽 풀어오기\n2. 현장체험학습 동의서 서명해서 내일까지 제출\n3. 내일 미술 시간 준비물: 색종이, 풀, 가위\n4. 금요일 받아쓰기 7급 연습하기',
        createdAt: at(0, 15), reads: ['s2', 'p2', 's4'], reactions: { like: ['p2'] }, comments: [],
      },
      {
        id: 'po3', classId: 'c1', authorId: 't1', type: 'letter',
        title: '알림장',
        body: '1. 국어 교과서 56쪽 소리 내어 읽기\n2. 줄넘기 2단 뛰기 연습 (주 3회)\n3. 도서관 책 반납일 확인하기',
        createdAt: at(-1, 15, 5), reads: ['s1', 'p1', 's2', 'p2', 's3', 's4', 's5'], reactions: { like: ['s1', 's3'] }, comments: [],
      },
      {
        id: 'po4', classId: 'c1', authorId: 't1', type: 'assignment',
        title: '독서록 쓰기 — 『마당을 나온 암탉』',
        body: '책을 읽고 가장 인상 깊은 장면과 그 이유를 5문장 이상으로 써 주세요. 그림을 함께 그려도 좋아요!',
        createdAt: at(-3, 14), due: at(2, 23, 59), points: 10,
        submissions: {
          s2: { body: '잎싹이 알을 품기로 결심하는 장면이 가장 인상 깊었어요. 자기 알이 아닌데도 끝까지 지켜주는 모습이 멋졌기 때문이에요...', at: at(-1, 20), score: 10, feedback: '느낀 점이 잘 드러났어요. 훌륭합니다!' },
          s4: { body: '족제비와 마주치는 장면이 무서웠지만 잎싹이 용감했어요.', at: at(0, 8, 30) },
        },
        reactions: { like: ['s1'] }, comments: [
          { id: 'cm3', authorId: 's3', body: '선생님 그림은 몇 장까지 그려도 돼요?', createdAt: at(-2, 16) },
          { id: 'cm4', authorId: 't1', body: '원하는 만큼 그려도 좋아요 🎨', createdAt: at(-2, 16, 20) },
        ],
      },
      {
        id: 'po5', classId: 'c1', authorId: 't1', type: 'poll',
        title: '현장체험학습 점심 메뉴 선호 조사',
        body: '서울숲 현장체험학습 단체 도시락 메뉴를 정하려고 합니다. 아이와 상의 후 하나만 골라주세요!',
        createdAt: at(-2, 10), closesAt: at(3, 18),
        options: [
          { id: 'o1', text: '🍙 주먹밥 + 돈가스' },
          { id: 'o2', text: '🍱 김밥 + 유부초밥' },
          { id: 'o3', text: '🥪 샌드위치 + 과일' },
        ],
        votes: { s2: 'o1', p2: 'o1', s3: 'o2', s5: 'o3', s4: 'o2' },
        reactions: { like: [] }, comments: [],
      },
      {
        id: 'po6', classId: 'c1', authorId: 't1', type: 'album',
        title: '과학 시간 — 식물의 한살이 관찰 🌱',
        body: '강낭콩 싹이 드디어 났어요! 아이들이 직접 심고 관찰 일지를 쓰고 있습니다.',
        createdAt: at(-4, 13, 30),
        photos: [
          { emoji: '🌱', label: '싹이 났어요', bg: 'linear-gradient(135deg,#34d399,#059669)' },
          { emoji: '🔬', label: '관찰 중', bg: 'linear-gradient(135deg,#60a5fa,#1d4ed8)' },
          { emoji: '📓', label: '관찰 일지', bg: 'linear-gradient(135deg,#fbbf24,#d97706)' },
          { emoji: '🧑‍🌾', label: '물 주기', bg: 'linear-gradient(135deg,#a78bfa,#6d28d9)' },
          { emoji: '🌿', label: '떡잎 관찰', bg: 'linear-gradient(135deg,#4ade80,#16a34a)' },
          { emoji: '🏫', label: '우리 교실', bg: 'linear-gradient(135deg,#f472b6,#be185d)' },
        ],
        reactions: { like: ['p1', 'p2', 's1', 's2', 's3', 's4', 's5'] },
        comments: [{ id: 'cm5', authorId: 'p2', body: '아이가 집에 와서 강낭콩 얘기만 해요 ㅎㅎ 감사합니다!', createdAt: at(-4, 19) }],
      },
      {
        id: 'po7', classId: 'c1', authorId: 's1', type: 'general',
        title: '',
        body: '선생님 내일 미술 시간에 색종이 대신 한지 가져가도 되나요?',
        createdAt: at(0, 16, 40), reactions: { like: ['s3'] },
        comments: [{ id: 'cm6', authorId: 't1', body: '물론이지! 한지도 좋아 👍', createdAt: at(0, 16, 55) }],
      },
      {
        id: 'po8', classId: 'c2', authorId: 't2', type: 'notice',
        title: '이번 주 코딩반: 미로 탈출 게임 만들기',
        body: '이번 주에는 엔트리로 미로 탈출 게임을 완성합니다. 지난 시간 프로젝트 파일을 꼭 저장해서 오세요!',
        createdAt: at(-2, 17), reactions: { like: ['s1', 's5'] }, comments: [],
      },
      {
        id: 'po9', classId: 'c2', authorId: 't2', type: 'assignment',
        title: '캐릭터 움직이기 블록 코딩 과제',
        body: '방향키로 캐릭터가 상하좌우로 움직이도록 만들고, 벽에 닿으면 처음 위치로 돌아가게 해보세요. 완성 화면을 설명과 함께 제출!',
        createdAt: at(-1, 17), due: at(5, 18), points: 5, submissions: {}, reactions: { like: [] }, comments: [],
      },
    ];

    const attendance = {
      c1: {
        [dateOffset(-2)]: { s1: 'present', s2: 'present', s3: 'late', s4: 'present', s5: 'present' },
        [dateOffset(-1)]: { s1: 'present', s2: 'present', s3: 'present', s4: 'absent', s5: 'present' },
        [today()]: { s1: 'present', s2: 'present', s3: 'present', s5: 'excused' },
      },
      c2: {},
    };

    const events = [
      { id: 'ev1', classId: 'c1', date: dateOffset(4), title: '현장체험학습 (서울숲)', kind: 'event' },
      { id: 'ev2', classId: 'c1', date: dateOffset(1), title: '미술 준비물: 색종이·풀·가위', kind: 'event' },
      { id: 'ev3', classId: 'c1', date: dateOffset(11), title: '학부모 상담주간 시작', kind: 'school' },
      { id: 'ev4', classId: 'c1', date: dateOffset(((5 - new Date().getDay()) + 7) % 7 || 7), title: '받아쓰기 7급', kind: 'exam' },
      { id: 'ev5', classId: 'c2', date: dateOffset(8), title: '코딩반 작품 발표회', kind: 'event' },
      { id: 'ev6', classId: 'c1', date: dateOffset(18), title: '2학기 중간 학력 진단', kind: 'exam' },
    ];

    const threads = [
      {
        id: 'th1', participantIds: ['t1', 'p1'],
        messages: [
          { id: 'm1', from: 'p1', body: '선생님 안녕하세요, 진우 어머니입니다. 진우가 요즘 수학을 어려워하는 것 같은데 수업 시간엔 어떤가요?', at: at(-1, 20, 10) },
          { id: 'm2', from: 't1', body: '안녕하세요 어머님! 진우는 개념 이해는 잘 하는데 계산 실수가 조금 있어요. 익힘책 복습을 꾸준히 하면 금방 좋아질 거예요 :)', at: at(-1, 20, 40) },
          { id: 'm3', from: 'p1', body: '감사합니다! 집에서도 신경 쓰겠습니다.', at: at(-1, 20, 45) },
          { id: 'm4', from: 't1', body: '네, 내일 알림장에 복습 범위 올려드릴게요. 편안한 밤 되세요!', at: at(0, 8, 5) },
        ],
        reads: { t1: at(0, 8, 5), p1: at(-1, 20, 45) },
      },
      {
        id: 'th2', participantIds: ['t1', 's1'],
        messages: [
          { id: 'm5', from: 's1', body: '선생님 독서록 그림 크레파스로 그려도 돼요?', at: at(-2, 18) },
          { id: 'm6', from: 't1', body: '그럼~ 진우가 좋아하는 재료로 그려봐 😊', at: at(-2, 18, 30) },
        ],
        reads: { t1: at(-2, 18, 30), s1: at(-2, 18, 31) },
      },
    ];

    return { version: 1, createdAt: new Date().toISOString(), users, classes, posts, attendance, events, threads, seenAt: {} };
  }

  // ---------- 스토어 ----------
  let state = null;
  let currentUserId = null;

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) state = JSON.parse(raw);
    } catch (e) { state = null; }
    if (!state || state.version !== 1) { state = seed(); save(); }
    try { currentUserId = localStorage.getItem(USER_KEY) || 't1'; } catch (e) { currentUserId = 't1'; }
    if (!state.users.some((u) => u.id === currentUserId)) currentUserId = 't1';
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* 저장 불가 환경 */ }
  }
  function reset() { state = seed(); save(); setUser('t1'); }
  function setUser(id) {
    currentUserId = id;
    try { localStorage.setItem(USER_KEY, id); } catch (e) { /* ignore */ }
  }

  const me = () => state.users.find((u) => u.id === currentUserId);
  const user = (id) => state.users.find((u) => u.id === id) || { id, name: '알 수 없음', role: 'student', color: '#9ca3af' };
  const cls = (id) => state.classes.find((c) => c.id === id);
  const post = (id) => state.posts.find((p) => p.id === id);

  function memberIds(c) { return [...c.teacherIds, ...c.studentIds, ...c.parentIds]; }
  function isMember(c, userId) { return memberIds(c).includes(userId); }
  function isTeacherOf(c, userId = currentUserId) { return c.teacherIds.includes(userId); }
  function myClasses(userId = currentUserId) { return state.classes.filter((c) => isMember(c, userId)); }
  function childrenOf(u) { return (u.childIds || []).map(user); }
  function parentsOf(studentId) { return state.users.filter((u) => u.role === 'parent' && (u.childIds || []).includes(studentId)); }

  function postsFor(classIds, type) {
    const ids = Array.isArray(classIds) ? classIds : [classIds];
    return state.posts
      .filter((p) => ids.includes(p.classId) && (!type || type === 'all' || p.type === type))
      .sort((a, b) => (b.pinned === true) - (a.pinned === true) || new Date(b.createdAt) - new Date(a.createdAt));
  }

  function addPost(data) {
    const p = Object.assign({
      id: uid('po'), authorId: currentUserId, createdAt: new Date().toISOString(), reactions: { like: [] }, comments: [], pinned: false,
    }, data);
    if (p.type === 'letter') p.reads = p.reads || [];
    if (p.type === 'assignment') p.submissions = p.submissions || {};
    if (p.type === 'poll') p.votes = p.votes || {};
    state.posts.unshift(p);
    save();
    return p;
  }
  function removePost(id) { state.posts = state.posts.filter((p) => p.id !== id); save(); }
  function togglePin(id) { const p = post(id); if (p) { p.pinned = !p.pinned; save(); } }
  function toggleLike(id) {
    const p = post(id); if (!p) return;
    p.reactions = p.reactions || { like: [] };
    const i = p.reactions.like.indexOf(currentUserId);
    if (i >= 0) p.reactions.like.splice(i, 1); else p.reactions.like.push(currentUserId);
    save();
  }
  function addComment(postId, body) {
    const p = post(postId); if (!p) return;
    p.comments.push({ id: uid('cm'), authorId: currentUserId, body, createdAt: new Date().toISOString() });
    save();
  }
  function markRead(postId) {
    const p = post(postId); if (!p || p.type !== 'letter') return;
    p.reads = p.reads || [];
    if (!p.reads.includes(currentUserId)) { p.reads.push(currentUserId); save(); }
  }
  function submit(postId, body) {
    const p = post(postId); if (!p || p.type !== 'assignment') return;
    p.submissions[currentUserId] = Object.assign({}, p.submissions[currentUserId], { body, at: new Date().toISOString() });
    save();
  }
  function grade(postId, studentId, score, feedback) {
    const p = post(postId); if (!p || !p.submissions[studentId]) return;
    Object.assign(p.submissions[studentId], { score, feedback });
    save();
  }
  function vote(postId, optionId) {
    const p = post(postId); if (!p || p.type !== 'poll') return;
    if (p.closesAt && new Date(p.closesAt) < new Date()) return;
    p.votes[currentUserId] = optionId; save();
  }
  function setAttendance(classId, date, studentId, status) {
    state.attendance[classId] = state.attendance[classId] || {};
    state.attendance[classId][date] = state.attendance[classId][date] || {};
    if (status) state.attendance[classId][date][studentId] = status; else delete state.attendance[classId][date][studentId];
    save();
  }
  function attendanceRate(classId, studentId, days = 30) {
    const byDate = state.attendance[classId] || {};
    let total = 0, present = 0;
    Object.keys(byDate).forEach((d) => {
      if (new Date(d) < new Date(Date.now() - days * 864e5)) return;
      const s = byDate[d][studentId];
      if (!s) return;
      total += 1;
      if (s === 'present' || s === 'late') present += 1;
    });
    return total ? Math.round((present / total) * 100) : null;
  }
  function addEvent(data) { const ev = Object.assign({ id: uid('ev'), kind: 'event' }, data); state.events.push(ev); save(); return ev; }
  function removeEvent(id) { state.events = state.events.filter((e) => e.id !== id); save(); }
  function allEvents(classIds) {
    const evs = state.events.filter((e) => classIds.includes(e.classId)).map((e) => Object.assign({}, e));
    state.posts.filter((p) => p.type === 'assignment' && classIds.includes(p.classId) && p.due).forEach((p) => {
      evs.push({ id: 'due_' + p.id, classId: p.classId, date: p.due.slice(0, 10), title: `과제 마감: ${p.title}`, kind: 'deadline', postId: p.id });
    });
    return evs.sort((a, b) => a.date.localeCompare(b.date));
  }

  function addClass(data) {
    const c = Object.assign({
      id: uid('c'), emoji: '🏫', color: '#10b981', cover: 'linear-gradient(135deg,#059669,#34d399)', year: new Date().getFullYear(),
      teacherIds: [], studentIds: [], parentIds: [], code: Math.random().toString(36).slice(2, 6).toUpperCase() + '-' + Math.random().toString(36).slice(2, 6).toUpperCase(),
      description: '',
    }, data);
    const m = me();
    if (m.role === 'teacher') c.teacherIds.push(m.id); else if (m.role === 'student') c.studentIds.push(m.id); else c.parentIds.push(m.id);
    state.classes.push(c); save(); return c;
  }
  function joinByCode(code) {
    const c = state.classes.find((x) => x.code.toLowerCase() === code.trim().toLowerCase());
    if (!c) return { error: '초대 코드를 찾을 수 없어요.' };
    if (isMember(c, currentUserId)) return { error: '이미 참여 중인 클래스예요.', cls: c };
    const m = me();
    (m.role === 'teacher' ? c.teacherIds : m.role === 'student' ? c.studentIds : c.parentIds).push(m.id);
    save(); return { cls: c };
  }
  function addStudent(classId, name) {
    const c = cls(classId); if (!c) return;
    const colors = ['#f59e0b', '#ec4899', '#14b8a6', '#6366f1', '#f97316', '#0ea5e9', '#84cc16'];
    const u = { id: uid('s'), name, role: 'student', number: c.studentIds.length + 1, color: colors[c.studentIds.length % colors.length] };
    state.users.push(u); c.studentIds.push(u.id); save(); return u;
  }

  // 쪽지
  function myThreads(userId = currentUserId) {
    return state.threads
      .filter((t) => t.participantIds.includes(userId))
      .sort((a, b) => new Date(lastMsg(b)?.at || 0) - new Date(lastMsg(a)?.at || 0));
  }
  const lastMsg = (t) => t.messages[t.messages.length - 1];
  function unreadCount(t, userId = currentUserId) {
    const seen = t.reads?.[userId] ? new Date(t.reads[userId]) : new Date(0);
    return t.messages.filter((m) => m.from !== userId && new Date(m.at) > seen).length;
  }
  function openThread(otherId) {
    let t = state.threads.find((x) => x.participantIds.length === 2 && x.participantIds.includes(otherId) && x.participantIds.includes(currentUserId));
    if (!t) { t = { id: uid('th'), participantIds: [currentUserId, otherId], messages: [], reads: {} }; state.threads.push(t); save(); }
    return t;
  }
  function sendMessage(threadId, body) {
    const t = state.threads.find((x) => x.id === threadId); if (!t) return;
    const m = { id: uid('m'), from: currentUserId, body, at: new Date().toISOString() };
    t.messages.push(m); t.reads[currentUserId] = m.at; save(); return m;
  }
  function markThreadRead(threadId) {
    const t = state.threads.find((x) => x.id === threadId); if (!t) return;
    t.reads[currentUserId] = new Date().toISOString(); save();
  }

  // 알림 (파생 데이터)
  function notifications(userId = currentUserId) {
    const u = user(userId);
    const classes = myClasses(userId);
    const ids = classes.map((c) => c.id);
    const list = [];
    const seen = state.seenAt[userId] ? new Date(state.seenAt[userId]) : new Date(0);
    const now = Date.now();
    postsFor(ids).forEach((p) => {
      const c = cls(p.classId);
      const author = user(p.authorId);
      if (p.authorId !== userId && now - new Date(p.createdAt) < 14 * 864e5) {
        const label = { notice: '새 공지', letter: '알림장', assignment: '새 과제', poll: '설문 요청', album: '새 사진', general: '새 글' }[p.type] || '새 글';
        list.push({ id: 'np_' + p.id, icon: NS.TYPE[p.type].icon, title: `[${c.name}] ${label}: ${p.title || p.body.slice(0, 30)}`, sub: `${author.name} · ${c.name}`, at: p.createdAt, postId: p.id, unread: new Date(p.createdAt) > seen });
      }
      if (p.type === 'letter' && u.role !== 'teacher' && !(p.reads || []).includes(userId)) {
        list.push({ id: 'nl_' + p.id, icon: '✅', title: '아직 확인하지 않은 알림장이 있어요', sub: `${c.name} · ${p.title || '알림장'}`, at: p.createdAt, postId: p.id, unread: true, action: true });
      }
      if (p.type === 'assignment' && u.role === 'student' && !p.submissions[userId] && p.due) {
        const left = new Date(p.due) - now;
        if (left > 0 && left < 3 * 864e5) list.push({ id: 'nd_' + p.id, icon: '⏰', title: `과제 마감 임박: ${p.title}`, sub: `${c.name} · ${NS.fmt.dday(p.due)}`, at: new Date(now).toISOString(), postId: p.id, unread: true, action: true });
      }
      if (p.type === 'assignment' && u.role === 'student' && p.submissions[userId]?.score != null) {
        const s = p.submissions[userId];
        list.push({ id: 'ng_' + p.id, icon: '🏅', title: `과제 채점 완료: ${p.title}`, sub: `${s.score}/${p.points || 10}점 · ${s.feedback || ''}`, at: s.at, postId: p.id, unread: new Date(s.at) > seen });
      }
      if (p.authorId === userId) {
        p.comments.filter((cm) => cm.authorId !== userId).forEach((cm) => {
          list.push({ id: 'nc_' + cm.id, icon: '💬', title: `${user(cm.authorId).name}님이 내 글에 댓글을 남겼어요`, sub: cm.body.slice(0, 60), at: cm.createdAt, postId: p.id, unread: new Date(cm.createdAt) > seen });
        });
      }
      if (u.role === 'teacher' && p.type === 'assignment' && p.authorId === userId) {
        Object.entries(p.submissions).forEach(([sid, s]) => {
          list.push({ id: 'ns_' + p.id + sid, icon: '📥', title: `${user(sid).name} 학생이 과제를 제출했어요`, sub: p.title, at: s.at, postId: p.id, unread: new Date(s.at) > seen });
        });
      }
    });
    myThreads(userId).forEach((t) => {
      const n = unreadCount(t, userId);
      if (n) {
        const other = user(t.participantIds.find((x) => x !== userId));
        list.push({ id: 'nm_' + t.id, icon: '✉️', title: `${other.name}님의 새 쪽지 ${n}건`, sub: lastMsg(t).body.slice(0, 60), at: lastMsg(t).at, threadId: t.id, unread: true });
      }
    });
    return list.sort((a, b) => new Date(b.at) - new Date(a.at));
  }
  function markAllSeen() { state.seenAt[currentUserId] = new Date().toISOString(); save(); }

  function exportJSON() { return JSON.stringify(state, null, 2); }
  function importJSON(text) { const s = JSON.parse(text); if (!s.users || !s.classes) throw new Error('형식 오류'); state = s; save(); }

  NS.TYPE = {
    notice: { label: '공지', icon: '📢' },
    letter: { label: '알림장', icon: '📒' },
    assignment: { label: '과제', icon: '📝' },
    poll: { label: '설문', icon: '📊' },
    album: { label: '앨범', icon: '📷' },
    general: { label: '소식', icon: '💬' },
  };
  NS.ROLE = { teacher: '교사', student: '학생', parent: '학부모' };
  NS.ATT = { present: '출석', late: '지각', absent: '결석', excused: '기타(공결)' };

  NS.util = { uid, today, toISODate, dateOffset };
  NS.store = {
    load, save, reset, setUser, me, user, cls, post, get state() { return state; },
    memberIds, isMember, isTeacherOf, myClasses, childrenOf, parentsOf,
    postsFor, addPost, removePost, togglePin, toggleLike, addComment, markRead, submit, grade, vote,
    setAttendance, attendanceRate, addEvent, removeEvent, allEvents, addClass, joinByCode, addStudent,
    myThreads, lastMsg, unreadCount, openThread, sendMessage, markThreadRead,
    notifications, markAllSeen, exportJSON, importJSON,
  };
})();
