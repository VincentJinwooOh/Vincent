/* ==================================================================
 * app.js — 계절별 태양의 남중 고도와 낮의 길이 수업 웹앱
 * 의존: solar.js (전역 Solar)
 * ================================================================== */
(function () {
  'use strict';
  const $ = s => document.querySelector(s);
  const $$ = s => Array.from(document.querySelectorAll(s));
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const YEAR = new Date().getFullYear();

  /* ---------------- 위치 목록 ---------------- */
  const LOCATIONS = [
    { id: 'incheon', name: '인천', lat: 37.4563, lon: 126.7052, tz: 9, korea: true },
    { id: 'seoul', name: '서울', lat: 37.5665, lon: 126.9780, tz: 9, korea: true },
    { id: 'gangneung', name: '강릉', lat: 37.7519, lon: 128.8761, tz: 9, korea: true },
    { id: 'daejeon', name: '대전', lat: 36.3504, lon: 127.3845, tz: 9, korea: true },
    { id: 'daegu', name: '대구', lat: 35.8714, lon: 128.6014, tz: 9, korea: true },
    { id: 'gwangju', name: '광주', lat: 35.1595, lon: 126.8526, tz: 9, korea: true },
    { id: 'busan', name: '부산', lat: 35.1796, lon: 129.0756, tz: 9, korea: true },
    { id: 'jeju', name: '제주', lat: 33.4996, lon: 126.5312, tz: 9, korea: true },
    { id: 'singapore', name: '싱가포르 (적도 부근)', lat: 1.3521, lon: 103.8198, tz: 8,
      note: '적도 근처: 남중 고도가 1년 내내 매우 높고, 어떤 달에는 태양이 북쪽 하늘에서 남중합니다. 낮의 길이는 거의 12시간으로 일정합니다. → “고도가 높을수록 낮이 길다”는 관계가 거의 사라집니다.' },
    { id: 'sydney', name: '시드니 (남반구)', lat: -33.8688, lon: 151.2093, tz: 10,
      note: '남반구: 12월에 태양 고도가 가장 높고 낮이 가장 길며, 6월에 가장 낮고 짧습니다. 우리나라와 계절이 반대이고, 태양은 북쪽 하늘에서 가장 높이 뜹니다(북중). → 규칙 자체는 성립하지만 “여름=6월”은 아닙니다.' },
    { id: 'tromso', name: '트롬쇠 (북극권)', lat: 69.6496, lon: 18.9560, tz: 1,
      note: '북극권: 여름에는 해가 지지 않는 백야, 겨울에는 해가 뜨지 않는 극야가 나타납니다. 낮의 길이가 0시간~24시간까지 극단적으로 변합니다.' },
  ];
  const KOREA_NOTE = '북반구 중위도(우리나라): 6월에 남중 고도가 가장 높고 낮이 가장 길며, 12월에 가장 낮고 짧습니다. → 규칙이 성립합니다.';
  const MONTHS = [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 1, 2];
  const OBS_DAY = 21;
  const SEASON_DATES = { equinox: [3, 21], summer: [6, 21], autumn: [9, 23], winter: [12, 22] };
  const seasonOfMonth = m => (m >= 3 && m <= 5) ? '봄' : (m >= 6 && m <= 8) ? '여름' : (m >= 9 && m <= 11) ? '가을' : '겨울';

  const state = {
    loc: LOCATIONS[0],
    monthly: [],                 // [{m, info}]
    obs: { mi: 0, minutes: 750, playing: false },
    records: {},                 // locId -> { m: {alt, day} }
    graph: { series: 'alt', alt: {}, day: {}, example: false },
    path: { season: null, overlay: false, minutes: null, playing: false },
  };

  /* ---------------- 저장/불러오기 ---------------- */
  const LS_KEY = 'sunAltitudeApp.v1';
  function save() {
    try { localStorage.setItem(LS_KEY, JSON.stringify({ locId: state.loc.id, records: state.records, graph: { alt: state.graph.alt, day: state.graph.day } })); } catch (e) { /* ignore */ }
  }
  function load() {
    try {
      const d = JSON.parse(localStorage.getItem(LS_KEY) || 'null');
      if (!d) return;
      const loc = LOCATIONS.find(l => l.id === d.locId && l.korea);
      if (loc) state.loc = loc;
      if (d.records) state.records = d.records;
      if (d.graph) { state.graph.alt = d.graph.alt || {}; state.graph.day = d.graph.day || {}; }
    } catch (e) { /* ignore */ }
  }

  /* ---------------- 계산 ---------------- */
  function dayInfoFor(loc, m, d) { return Solar.dayInfo(YEAR, m, d, loc.lat, loc.lon, loc.tz); }
  function posFor(loc, m, d, minutes) { return Solar.position(YEAR, m, d, minutes, loc.lat, loc.lon, loc.tz); }
  function computeMonthly() { state.monthly = MONTHS.map(m => ({ m, info: dayInfoFor(state.loc, m, OBS_DAY) })); }
  const fmtDeg = (v, n = 1) => (v == null ? '—' : v.toFixed(n) + '°');
  const fmtHours = min => (min == null ? '—' : (min / 60).toFixed(1) + '시간');
  const fmtDayLen = info => info.dayLength >= 1440 ? '24시간 (백야)' : info.dayLength <= 0 ? '0시간 (극야)' : Solar.fmtDuration(info.dayLength);
  const monthName = m => m + '월';
  function recordsOfLoc() { return state.records[state.loc.id] || (state.records[state.loc.id] = {}); }

  /* ================================================================
   * 내비게이션
   * ================================================================ */
  const PANELS = ['s-intro', 's-goal', 's-method', 's-observe', 's-inquiry', 's-path', 's-wrap'];
  let current = 0;
  function showPanel(i) {
    current = clamp(i, 0, PANELS.length - 1);
    $$('.panel').forEach((p, k) => p.classList.toggle('active', k === current));
    $$('.tab').forEach((t, k) => t.classList.toggle('active', k === current));
    $('#pageInfo').textContent = (current + 1) + ' / ' + PANELS.length;
    window.scrollTo({ top: 0, behavior: 'smooth' });
    if (PANELS[current] === 's-observe') drawSky();
    if (PANELS[current] === 's-inquiry') drawGraph();
    if (PANELS[current] === 's-path') drawPath();
  }
  $$('.tab').forEach((t, k) => t.addEventListener('click', () => showPanel(k)));
  $('#btnPrev').addEventListener('click', () => showPanel(current - 1));
  $('#btnNext').addEventListener('click', () => showPanel(current + 1));
  document.addEventListener('keydown', e => {
    if (['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement.tagName)) return;
    if (e.key === 'ArrowRight') showPanel(current + 1);
    if (e.key === 'ArrowLeft') showPanel(current - 1);
  });

  // 탐구 활동 서브 탭
  $$('#inqTabs .sub').forEach(b => b.addEventListener('click', () => {
    $$('#inqTabs .sub').forEach(x => x.classList.toggle('active', x === b));
    $$('.subpanel').forEach(p => p.classList.toggle('active', p.id === b.dataset.sub));
    if (b.dataset.sub === 'inq1') drawGraph();
  }));

  /* ---------------- 위치 선택 ---------------- */
  const locSelect = $('#locSelect');
  LOCATIONS.filter(l => l.korea).forEach(l => { const o = document.createElement('option'); o.value = l.id; o.textContent = l.name; locSelect.appendChild(o); });
  locSelect.addEventListener('change', () => { state.loc = LOCATIONS.find(l => l.id === locSelect.value); onLocationChange(); save(); });
  function onLocationChange() {
    computeMonthly();
    renderIntro(); renderCalc(); renderMonthButtons(); renderRecords(); drawSky();
    drawGraph(); renderDataTable(); buildCmpOptions(); renderFalsify(); drawPath(); renderSummary();
  }

  /* ================================================================
   * 1. 도입 — 여름/겨울 오후 6시 장면
   * ================================================================ */
  const SKY_KEYS = [ // [고도, 하늘 위, 하늘 아래]
    [25, '#4aa3ea', '#c7ecff'], [10, '#5ea9e4', '#ffe0a8'], [3, '#5d84c4', '#ffb46a'],
    [0, '#4a5ea6', '#ff8d55'], [-5, '#2a3676', '#c85e63'], [-10, '#141c4a', '#4a2f63'], [-18, '#070b26', '#141737'],
  ];
  function hexLerp(a, b, t) {
    const pa = [1, 3, 5].map(i => parseInt(a.substr(i, 2), 16)), pb = [1, 3, 5].map(i => parseInt(b.substr(i, 2), 16));
    return '#' + pa.map((v, i) => Math.round(lerp(v, pb[i], t)).toString(16).padStart(2, '0')).join('');
  }
  function skyColors(alt) {
    if (alt >= SKY_KEYS[0][0]) return [SKY_KEYS[0][1], SKY_KEYS[0][2]];
    for (let i = 0; i < SKY_KEYS.length - 1; i++) {
      const [a1, t1, b1] = SKY_KEYS[i], [a2, t2, b2] = SKY_KEYS[i + 1];
      if (alt <= a1 && alt >= a2) { const t = (a1 - alt) / (a1 - a2); return [hexLerp(t1, t2, t), hexLerp(b1, b2, t)]; }
    }
    const last = SKY_KEYS[SKY_KEYS.length - 1]; return [last[1], last[2]];
  }
  function sceneSVG(season) {
    const id = season;
    const trees = [180, 420];
    let tree = '';
    if (season === 'summer') {
      trees.forEach(x => { tree += `<rect x="${x - 9}" y="240" width="18" height="50" rx="4" fill="#8a5a2b"/><circle cx="${x}" cy="215" r="48" fill="#6cc25a"/><circle cx="${x - 30}" cy="230" r="30" fill="#7fd06a"/><circle cx="${x + 30}" cy="230" r="30" fill="#7fd06a"/><circle cx="${x - 12}" cy="205" r="6" fill="#e8443a"/><circle cx="${x + 18}" cy="222" r="6" fill="#e8443a"/><circle cx="${x + 2}" cy="238" r="6" fill="#e8443a"/>`; });
      [90, 300, 560, 640, 720].forEach((x, i) => { const c = ['#ff7eb3', '#ffd23f', '#c48cff', '#ff7eb3', '#ffd23f'][i]; tree += `<rect x="${x - 2}" y="300" width="4" height="26" fill="#3f9c3a"/><circle cx="${x}" cy="298" r="9" fill="${c}"/><circle cx="${x}" cy="298" r="3.5" fill="#fff8c0"/>`; });
    } else {
      trees.forEach(x => { tree += `<path d="M${x} 290 L${x} 215 M${x} 250 L${x - 36} 218 M${x} 240 L${x + 34} 206 M${x} 262 L${x + 20} 245 M${x - 36} 218 L${x - 46} 195 M${x + 34} 206 L${x + 44} 182" stroke="#7a5233" stroke-width="9" stroke-linecap="round" fill="none"/><ellipse cx="${x - 40}" cy="206" rx="14" ry="6" fill="#fff"/><ellipse cx="${x + 38}" cy="194" rx="14" ry="6" fill="#fff"/><ellipse cx="${x}" cy="212" rx="12" ry="6" fill="#fff"/>`; });
      tree += `<ellipse cx="120" cy="330" rx="70" ry="18" fill="#fff"/><ellipse cx="600" cy="345" rx="90" ry="20" fill="#fff"/><ellipse cx="740" cy="325" rx="60" ry="16" fill="#fff"/>`;
    }
    const groundTop = season === 'summer' ? '#9be08a' : '#f4f8ff';
    const groundBot = season === 'summer' ? '#5fb551' : '#d9e6f7';
    return `<svg viewBox="0 0 800 400" preserveAspectRatio="xMidYMid slice">
      <defs>
        <linearGradient id="sky-${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4aa3ea" class="sky-top"/><stop offset="1" stop-color="#c7ecff" class="sky-bot"/></linearGradient>
        <linearGradient id="ground-${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${groundTop}"/><stop offset="1" stop-color="${groundBot}"/></linearGradient>
        <radialGradient id="glow-${id}"><stop offset="0" stop-color="#fff3a0" stop-opacity=".9"/><stop offset="1" stop-color="#ffb347" stop-opacity="0"/></radialGradient>
      </defs>
      <rect class="sky" width="800" height="400" fill="url(#sky-${id})"/>
      <g class="stars" opacity="0">${Array.from({ length: 40 }, (_, i) => `<circle cx="${(i * 197) % 800}" cy="${(i * 83) % 230}" r="${1 + (i % 3) * .6}" fill="#fff"/>`).join('')}<circle cx="700" cy="70" r="24" fill="#fff8d6"/><circle cx="688" cy="62" r="20" fill="#141c4a"/></g>
      <g class="sun"><circle class="sun-glow" cx="0" cy="0" r="80" fill="url(#glow-${id})"/><circle class="sun-body" cx="0" cy="0" r="30" fill="#ffd93b" stroke="#ffb700" stroke-width="4"/></g>
      <g class="ground-group"><rect class="ground" x="0" y="260" width="800" height="140" fill="url(#ground-${id})"/>${tree}</g>
      <text class="alt-label" x="16" y="392" font-size="16" fill="#fff" font-family="Noto Sans KR, sans-serif" opacity=".9"></text>
    </svg>`;
  }
  const sceneEls = {};
  function buildScenes() {
    $('#sceneSummer').innerHTML = sceneSVG('summer');
    $('#sceneWinter').innerHTML = sceneSVG('winter');
    sceneEls.summer = $('#sceneSummer svg'); sceneEls.winter = $('#sceneWinter svg');
    $('#introClock').innerHTML = `<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="46" fill="#fff" stroke="#f08a24" stroke-width="5"/>${[12, 3, 6, 9].map((n, i) => `<text x="${[50, 84, 50, 16][i]}" y="${[20, 55, 88, 55][i]}" text-anchor="middle" font-size="12" font-weight="700" fill="#333">${n}</text>`).join('')}<line class="hand-h" x1="50" y1="50" x2="50" y2="26" stroke="#3b6fd6" stroke-width="5" stroke-linecap="round"/><line class="hand-m" x1="50" y1="50" x2="50" y2="18" stroke="#3b6fd6" stroke-width="3" stroke-linecap="round"/><circle cx="50" cy="50" r="3.5" fill="#333"/></svg>`;
  }
  function updateScene(svg, alt, az) {
    const [top, bot] = skyColors(alt);
    svg.querySelector('.sky-top').setAttribute('stop-color', top);
    svg.querySelector('.sky-bot').setAttribute('stop-color', bot);
    const x = 80 + ((az - 180) / 180) * 640, y = 260 - alt * (260 / 45);
    svg.querySelector('.sun').setAttribute('transform', `translate(${x.toFixed(1)} ${y.toFixed(1)})`);
    const bright = clamp(lerp(1, 0.32, (8 - alt) / 20), 0.32, 1);
    svg.querySelector('.ground-group').setAttribute('style', `filter: brightness(${bright.toFixed(2)})`);
    svg.querySelector('.stars').setAttribute('opacity', clamp((-alt - 2) / 6, 0, 1).toFixed(2));
    svg.querySelector('.alt-label').textContent = alt >= 0 ? `태양 고도 ${alt.toFixed(1)}°` : `태양이 지평선 아래 ${(-alt).toFixed(1)}° (해가 진 뒤)`;
  }
  function renderIntro() {
    const minutes = +$('#introTime').value;
    const h = Math.floor(minutes / 60), mm = minutes % 60;
    $('#introTimeLabel').textContent = (h >= 12 ? '오후 ' : '오전 ') + (h > 12 ? h - 12 : h) + ':' + String(mm).padStart(2, '0');
    const ps = posFor(state.loc, 6, 21, minutes), pw = posFor(state.loc, 12, 22, minutes);
    updateScene(sceneEls.summer, ps.altApparent, ps.az);
    updateScene(sceneEls.winter, pw.altApparent, pw.az);
    $('#introAltSummer').textContent = fmtDeg(ps.altApparent);
    $('#introAltWinter').textContent = fmtDeg(pw.altApparent);
    const clock = $('#introClock');
    clock.querySelector('.hand-h').setAttribute('transform', `rotate(${(h % 12) * 30 + mm * 0.5} 50 50)`);
    clock.querySelector('.hand-m').setAttribute('transform', `rotate(${mm * 6} 50 50)`);
  }
  $('#introTime').addEventListener('input', renderIntro);
  // 좌우 비교 슬라이더
  (function () {
    const box = $('#compare'), top = $('#sceneWinter'), div = $('#divider');
    let dragging = false;
    const setX = clientX => {
      const r = box.getBoundingClientRect();
      const p = clamp((clientX - r.left) / r.width * 100, 2, 98);
      top.style.clipPath = `inset(0 0 0 ${p}%)`; div.style.left = p + '%';
    };
    box.addEventListener('pointerdown', e => { dragging = true; box.setPointerCapture(e.pointerId); setX(e.clientX); });
    box.addEventListener('pointermove', e => { if (dragging) setX(e.clientX); });
    box.addEventListener('pointerup', () => dragging = false);
    box.addEventListener('pointercancel', () => dragging = false);
  })();
  $$('.ex-btn').forEach(b => b.addEventListener('click', () => { const inp = b.previousElementSibling; inp.value = b.dataset.example; }));

  /* ================================================================
   * 3. 조사 방법 — 계산기
   * ================================================================ */
  function renderCalc() {
    const dv = $('#calcDate').value, tv = $('#calcTime').value;
    if (!dv || !tv) return;
    const [y, m, d] = dv.split('-').map(Number), [hh, mm] = tv.split(':').map(Number);
    const loc = state.loc;
    const p = Solar.position(y, m, d, hh * 60 + mm, loc.lat, loc.lon, loc.tz);
    const info = Solar.dayInfo(y, m, d, loc.lat, loc.lon, loc.tz);
    $('#calcAlt').textContent = fmtDeg(p.altApparent, 2);
    $('#calcAz').textContent = fmtDeg(p.az, 2);
    $('#calcNoon').textContent = Solar.fmtTime(info.noon);
    $('#calcMerAlt').textContent = fmtDeg(info.meridianAlt, 2);
    $('#calcRise').textContent = Solar.fmtTime(info.sunrise);
    $('#calcSet').textContent = Solar.fmtTime(info.sunset);
    $('#calcDay').textContent = fmtDayLen(info);
  }
  $('#calcDate').value = `${YEAR}-03-21`;
  $('#calcDate').addEventListener('input', renderCalc);
  $('#calcTime').addEventListener('input', renderCalc);

  /* ================================================================
   * 4. 가상 관측 — 남쪽 하늘 캔버스
   * ================================================================ */
  const sky = $('#skyCanvas'), skyCtx = sky.getContext('2d');
  const SW = 1000, SH = 520, S_SCALE = 2;
  sky.width = SW * S_SCALE; sky.height = SH * S_SCALE;
  const AZ0 = 60, AZ1 = 300, SX0 = 50, SX1 = 970, HORIZON = SH - 64, TOP = 34;
  const azX = az => SX0 + (az - AZ0) / (AZ1 - AZ0) * (SX1 - SX0);
  const altY = alt => HORIZON - alt / 90 * (HORIZON - TOP);
  function renderMonthButtons() {
    const row = $('#monthRow'); row.innerHTML = '';
    const rec = recordsOfLoc();
    MONTHS.forEach((m, i) => {
      const b = document.createElement('button'); b.textContent = monthName(m);
      b.classList.toggle('active', i === state.obs.mi); b.classList.toggle('done', !!rec[m]);
      b.addEventListener('click', () => { state.obs.mi = i; renderMonthButtons(); drawSky(); });
      row.appendChild(b);
    });
  }
  function currentObs() {
    const { m } = state.monthly[state.obs.mi];
    const info = state.monthly[state.obs.mi].info;
    const p = posFor(state.loc, m, OBS_DAY, state.obs.minutes);
    return { m, info, p };
  }
  function drawSky() {
    if (!state.monthly.length) return;
    const { m, info, p } = currentObs();
    const c = skyCtx; c.setTransform(S_SCALE, 0, 0, S_SCALE, 0, 0); c.clearRect(0, 0, SW, SH);
    // 하늘
    const [top, bot] = skyColors(p.altApparent);
    const g = c.createLinearGradient(0, 0, 0, HORIZON); g.addColorStop(0, top); g.addColorStop(1, bot);
    c.fillStyle = g; c.fillRect(0, 0, SW, HORIZON);
    // 땅
    const bright = clamp(lerp(1, 0.4, (8 - p.altApparent) / 20), 0.4, 1);
    c.fillStyle = `rgba(${Math.round(120 * bright)}, ${Math.round(190 * bright)}, ${Math.round(95 * bright)}, 1)`; c.fillRect(0, HORIZON, SW, SH - HORIZON);
    // 고도 눈금선
    c.font = '14px "Noto Sans KR", sans-serif'; c.textAlign = 'left'; c.textBaseline = 'middle';
    for (let a = 10; a <= 80; a += 10) {
      c.strokeStyle = 'rgba(255,255,255,.35)'; c.lineWidth = 1; c.setLineDash(a % 30 === 0 ? [] : [4, 6]);
      c.beginPath(); c.moveTo(SX0, altY(a)); c.lineTo(SX1, altY(a)); c.stroke();
      c.fillStyle = 'rgba(255,255,255,.9)'; c.fillText(a + '°', 8, altY(a));
    }
    c.setLineDash([]);
    // 방위 눈금
    const AZ_LABELS = { 90: '동', 120: '', 135: '남동', 150: '', 180: '남', 210: '', 225: '남서', 240: '', 270: '서' };
    c.textAlign = 'center';
    Object.keys(AZ_LABELS).forEach(k => {
      const az = +k, x = azX(az);
      c.strokeStyle = 'rgba(255,255,255,.35)'; c.beginPath(); c.moveTo(x, TOP); c.lineTo(x, HORIZON); c.stroke();
      if (AZ_LABELS[k]) { c.fillStyle = '#fff'; c.font = (az === 180 ? '700 22px' : '600 17px') + ' "Noto Sans KR", sans-serif'; c.fillText(AZ_LABELS[k], x, HORIZON + 22); c.font = '13px "Noto Sans KR", sans-serif'; c.fillText(az + '°', x, HORIZON + 44); }
    });
    // 남중선
    c.strokeStyle = '#ffe66e'; c.lineWidth = 2; c.setLineDash([8, 6]); c.beginPath(); c.moveTo(azX(180), TOP); c.lineTo(azX(180), HORIZON); c.stroke(); c.setLineDash([]);
    c.fillStyle = '#ffe66e'; c.font = '700 15px "Noto Sans KR", sans-serif'; c.fillText('남중선 (방위각 180°)', azX(180), TOP - 14);
    // 지평선
    c.strokeStyle = '#2d5a1f'; c.lineWidth = 3; c.beginPath(); c.moveTo(0, HORIZON); c.lineTo(SW, HORIZON); c.stroke();
    // 태양 경로 (하루)
    let prev = null;
    for (let t = 0; t <= 1440; t += 4) {
      const q = posFor(state.loc, m, OBS_DAY, t);
      if (q.az < AZ0 || q.az > AZ1 || q.altApparent < -12) { prev = null; continue; }
      const x = azX(q.az), y = altY(q.altApparent);
      if (prev) {
        c.strokeStyle = q.altApparent >= 0 ? 'rgba(255,190,60,.95)' : 'rgba(255,255,255,.35)'; c.lineWidth = q.altApparent >= 0 ? 4 : 2;
        c.setLineDash(q.altApparent >= 0 ? [] : [3, 6]); c.beginPath(); c.moveTo(prev[0], prev[1]); c.lineTo(x, y); c.stroke();
      }
      prev = [x, y];
    }
    c.setLineDash([]);
    // 남중 위치 표시
    const noonP = posFor(state.loc, m, OBS_DAY, info.noon);
    const nx = azX(noonP.az), ny = altY(noonP.altApparent);
    c.strokeStyle = '#fff'; c.lineWidth = 2; c.setLineDash([5, 5]); c.beginPath(); c.moveTo(nx, ny); c.lineTo(nx, HORIZON); c.stroke(); c.setLineDash([]);
    c.strokeStyle = '#fff'; c.lineWidth = 2.5; c.beginPath(); c.arc(nx, ny, 22, 0, Math.PI * 2); c.stroke();
    c.fillStyle = '#fff'; c.font = '700 16px "Noto Sans KR", sans-serif'; c.textAlign = 'left';
    c.fillText(`남중 고도 ${info.meridianAlt.toFixed(1)}°`, nx + 30, ny);
    c.font = '14px "Noto Sans KR", sans-serif'; c.fillText(`남중 시각 ${Solar.fmtTime(info.noon)}`, nx + 30, ny + 20);
    // 현재 태양
    const sx = azX(p.az), sy = altY(p.altApparent);
    const visible = p.az >= AZ0 && p.az <= AZ1;
    if (visible) {
      if (p.altApparent >= 0) {
        const rg = c.createRadialGradient(sx, sy, 10, sx, sy, 70); rg.addColorStop(0, 'rgba(255,240,150,.9)'); rg.addColorStop(1, 'rgba(255,180,60,0)');
        c.fillStyle = rg; c.beginPath(); c.arc(sx, sy, 70, 0, Math.PI * 2); c.fill();
        c.fillStyle = '#ffd93b'; c.strokeStyle = '#ff9a00'; c.lineWidth = 4; c.beginPath(); c.arc(sx, sy, 22, 0, Math.PI * 2); c.fill(); c.stroke();
        // 고도 표시선
        c.strokeStyle = 'rgba(255,255,255,.8)'; c.lineWidth = 2; c.beginPath(); c.moveTo(sx, sy + 26); c.lineTo(sx, HORIZON); c.stroke();
        c.fillStyle = '#1f2233'; c.font = '700 15px "Noto Sans KR", sans-serif'; c.textAlign = 'center';
        const lx = sx, ly = clamp((sy + HORIZON) / 2, sy + 40, HORIZON - 14);
        c.fillStyle = 'rgba(255,255,255,.85)'; c.fillRect(lx - 40, ly - 11, 80, 22); c.fillStyle = '#1f2233'; c.fillText(`고도 ${p.altApparent.toFixed(1)}°`, lx, ly);
      } else {
        c.globalAlpha = .35; c.fillStyle = '#ffd93b'; c.beginPath(); c.arc(sx, clamp(sy, HORIZON + 10, SH - 10), 16, 0, Math.PI * 2); c.fill(); c.globalAlpha = 1;
        c.fillStyle = '#fff'; c.font = '700 15px "Noto Sans KR", sans-serif'; c.textAlign = 'center'; c.fillText('지평선 아래', sx, clamp(sy, HORIZON + 10, SH - 10) - 24);
      }
    } else {
      c.fillStyle = 'rgba(255,255,255,.85)'; c.font = '700 16px "Noto Sans KR", sans-serif'; c.textAlign = 'center';
      c.fillText(p.az < AZ0 ? '◀ 태양이 화면 왼쪽(북동쪽) 바깥에 있어요' : '태양이 화면 오른쪽(북서쪽) 바깥에 있어요 ▶', SW / 2, TOP + 30);
    }
    // 판독 패널
    $('#roDate').textContent = `${monthName(m)} ${OBS_DAY}일 · ${state.loc.name}`;
    $('#obsTimeLabel').textContent = Solar.fmtTime(state.obs.minutes);
    $('#roAlt').textContent = fmtDeg(p.altApparent);
    $('#roAz').textContent = fmtDeg(p.az);
    $('#roNoon').textContent = Solar.fmtTime(info.noon);
    $('#roMerAlt').textContent = fmtDeg(info.meridianAlt);
    $('#roRise').textContent = Solar.fmtTime(info.sunrise);
    $('#roSet').textContent = Solar.fmtTime(info.sunset);
    $('#roDay').textContent = fmtDayLen(info);
  }
  $('#obsTime').addEventListener('input', () => { state.obs.minutes = +$('#obsTime').value; drawSky(); });
  $('#btnNoon').addEventListener('click', () => { const { info } = currentObs(); state.obs.minutes = Math.round(info.noon); $('#obsTime').value = state.obs.minutes; drawSky(); });
  $('#btnPlay').addEventListener('click', () => {
    if (state.obs.playing) { state.obs.playing = false; $('#btnPlay').textContent = '▶ 하루 재생'; return; }
    state.obs.playing = true; $('#btnPlay').textContent = '⏸ 멈춤';
    if (state.obs.minutes >= 1255) state.obs.minutes = 240;
    const step = () => {
      if (!state.obs.playing) return;
      state.obs.minutes += 3;
      if (state.obs.minutes > 1260) { state.obs.minutes = 1260; state.obs.playing = false; $('#btnPlay').textContent = '▶ 하루 재생'; }
      $('#obsTime').value = state.obs.minutes; drawSky();
      if (state.obs.playing) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  });
  function recordMonth(mi) {
    const { m, info } = state.monthly[mi];
    recordsOfLoc()[m] = { alt: +info.meridianAlt.toFixed(1), day: Math.round(info.dayLength) };
  }
  $('#btnRecord').addEventListener('click', () => { recordMonth(state.obs.mi); renderMonthButtons(); renderRecords(); save(); });
  $('#btnRecordAll').addEventListener('click', () => { MONTHS.forEach((_, i) => recordMonth(i)); renderMonthButtons(); renderRecords(); save(); });
  $('#btnClearRecords').addEventListener('click', () => { state.records[state.loc.id] = {}; renderMonthButtons(); renderRecords(); save(); });
  function renderRecords() {
    const rec = recordsOfLoc(); const tb = $('#recTable tbody'); tb.innerHTML = '';
    let n = 0;
    MONTHS.forEach(m => {
      const r = rec[m]; if (r) n++;
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${monthName(m)}</td><td class="${r ? '' : 'empty'}">${r ? r.alt.toFixed(1) + '°' : '·'}</td><td class="${r ? '' : 'empty'}">${r ? Solar.fmtDuration(r.day) : '·'}</td>`;
      tb.appendChild(tr);
    });
    $('#recCount').textContent = `(${n}/12)`;
  }

  /* ================================================================
   * 5-1. 꺾은선그래프
   * ================================================================ */
  const gc = $('#graphCanvas'), gctx = gc.getContext('2d');
  const GW = 1100, GH = 620, G_SCALE = 2;
  gc.width = GW * G_SCALE; gc.height = GH * G_SCALE;
  const G = { x0: 190, x1: 1070, yTop: 40, yBot: 520, yBreak: 545, yZero: 570, cols: 12, rows: 70 };
  G.colW = (G.x1 - G.x0) / G.cols; G.rowH = (G.yBot - G.yTop) / G.rows;
  const altToY = a => G.yBot - (a - 10) / 70 * (G.yBot - G.yTop);
  const dayToY = h => G.yBot - (h - 9) / 7 * (G.yBot - G.yTop);
  const monthX = i => G.x0 + (i + 0.5) * G.colW;
  function drawGraph() {
    if (!state.monthly.length) return;
    const c = gctx; c.setTransform(G_SCALE, 0, 0, G_SCALE, 0, 0); c.clearRect(0, 0, GW, GH);
    c.fillStyle = '#fff'; c.fillRect(0, 0, GW, GH);
    // 축 띠
    c.fillStyle = '#d8ecfb'; c.fillRect(40, G.yTop - 30, 70, G.yZero - G.yTop + 70);
    c.fillStyle = '#fbeccb'; c.fillRect(112, G.yTop - 30, 70, G.yZero - G.yTop + 70);
    // 세로 축 제목
    c.save(); c.fillStyle = '#4a6a8a'; c.font = '700 15px "Noto Sans KR", sans-serif'; c.textAlign = 'center';
    c.translate(56, G.yTop + 90); c.rotate(-Math.PI / 2); c.fillText('낮의 길이(시간) · 1칸 = 6분', 0, 0); c.restore();
    c.save(); c.fillStyle = '#9a6a1a'; c.font = '700 15px "Noto Sans KR", sans-serif'; c.textAlign = 'center';
    c.translate(128, G.yTop + 90); c.rotate(-Math.PI / 2); c.fillText('태양의 남중 고도(°) · 1칸 = 1°', 0, 0); c.restore();
    // 모눈
    for (let r = 0; r <= G.rows; r++) {
      const y = G.yTop + r * G.rowH; c.strokeStyle = r % 10 === 0 ? '#9fb3d6' : r % 5 === 0 ? '#c9d6ea' : '#e6ecf6'; c.lineWidth = r % 10 === 0 ? 1.4 : 1;
      c.beginPath(); c.moveTo(G.x0, y); c.lineTo(G.x1, y); c.stroke();
    }
    for (let k = 0; k <= G.cols * 5; k++) {
      const x = G.x0 + k * G.colW / 5; c.strokeStyle = k % 5 === 0 ? '#c9d6ea' : '#e6ecf6'; c.lineWidth = 1;
      c.beginPath(); c.moveTo(x, G.yTop); c.lineTo(x, G.yBot); c.stroke();
    }
    // 눈금 숫자
    c.font = '15px "Noto Sans KR", sans-serif'; c.textBaseline = 'middle'; c.textAlign = 'right';
    for (let k = 0; k <= 7; k++) {
      const y = G.yBot - k * 10 * G.rowH;
      c.fillStyle = '#4a6a8a'; c.fillText(String(9 + k), 104, y);
      c.fillStyle = '#9a6a1a'; c.fillText(String(10 + k * 10), 176, y);
    }
    // 축 끊김(물결)과 0
    c.strokeStyle = '#9fb3d6'; c.lineWidth = 1.4; c.beginPath(); c.moveTo(G.x0, G.yBot); c.lineTo(G.x0, G.yZero); c.lineTo(G.x1, G.yZero); c.stroke();
    c.strokeStyle = '#fff'; c.lineWidth = 6; c.beginPath();
    for (let x = G.x0 - 10; x <= G.x1; x += 4) { const y = G.yBreak + Math.sin(x / 9) * 4; x === G.x0 - 10 ? c.moveTo(x, y) : c.lineTo(x, y); }
    c.stroke(); c.strokeStyle = '#9fb3d6'; c.lineWidth = 1.2; c.stroke();
    c.fillStyle = '#4a6a8a'; c.fillText('0', 104, G.yZero); c.fillStyle = '#9a6a1a'; c.fillText('0', 176, G.yZero);
    // 월 라벨
    c.textAlign = 'center'; c.textBaseline = 'top'; c.fillStyle = '#4a4a5a'; c.font = '16px "Noto Sans KR", sans-serif';
    MONTHS.forEach((m, i) => c.fillText(String(m), monthX(i), G.yZero + 8));
    c.font = '14px "Noto Sans KR", sans-serif'; c.textAlign = 'right'; c.fillText('측정 시기(월)', G.x1, G.yZero + 30);
    // 범례
    c.textAlign = 'left'; c.textBaseline = 'middle'; c.font = '700 15px "Noto Sans KR", sans-serif';
    c.fillStyle = '#f08a24'; c.beginPath(); c.arc(G.x0 + 12, 18, 6, 0, Math.PI * 2); c.fill(); c.fillStyle = '#333'; c.fillText('태양의 남중 고도', G.x0 + 24, 18);
    c.fillStyle = '#2f7fe0'; c.beginPath(); c.arc(G.x0 + 190, 18, 6, 0, Math.PI * 2); c.fill(); c.fillStyle = '#333'; c.fillText('낮의 길이', G.x0 + 202, 18);
    if (state.graph.example) { c.fillStyle = '#888'; c.font = '14px "Noto Sans KR", sans-serif'; c.fillText('- - - 예시(계산값)', G.x0 + 330, 18); }
    // 예시(계산값)
    if (state.graph.example) {
      const drawEx = (vals, color, toY, fmt) => {
        c.strokeStyle = color; c.lineWidth = 2.5; c.setLineDash([7, 6]); c.beginPath();
        vals.forEach((v, i) => { const x = monthX(i), y = toY(v); i ? c.lineTo(x, y) : c.moveTo(x, y); }); c.stroke(); c.setLineDash([]);
        vals.forEach((v, i) => { const x = monthX(i), y = toY(v); c.fillStyle = '#fff'; c.beginPath(); c.arc(x, y, 5, 0, Math.PI * 2); c.fill(); c.strokeStyle = color; c.lineWidth = 2; c.stroke();
          c.fillStyle = color; c.font = '700 12px "Noto Sans KR", sans-serif'; c.textAlign = 'center'; c.fillText(fmt(v), x, y - 14); });
      };
      drawEx(state.monthly.map(o => o.info.meridianAlt), 'rgba(240,138,36,.8)', altToY, v => v.toFixed(1) + '°');
      drawEx(state.monthly.map(o => o.info.dayLength / 60), 'rgba(47,127,224,.8)', dayToY, v => fmtHM(v));
    }
    // 학생 점
    const drawSeries = (obj, color, toY) => {
      const pts = MONTHS.map((m, i) => obj[m] != null ? [monthX(i), toY(obj[m])] : null);
      c.strokeStyle = color; c.lineWidth = 3.5; c.beginPath(); let started = false;
      pts.forEach(p => { if (!p) { started = false; return; } started ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1]); started = true; }); c.stroke();
      pts.forEach(p => { if (!p) return; c.fillStyle = color; c.beginPath(); c.arc(p[0], p[1], 7, 0, Math.PI * 2); c.fill(); c.strokeStyle = '#fff'; c.lineWidth = 2; c.stroke(); });
    };
    drawSeries(state.graph.day, '#2f7fe0', dayToY);
    drawSeries(state.graph.alt, '#f08a24', altToY);
  }
  const fmtHM = h => { const t = Math.round(h * 60); return Math.floor(t / 60) + '시간 ' + (t % 60 ? (t % 60) + '분' : ''); };
  function graphHit(evt) {
    const r = gc.getBoundingClientRect();
    const x = (evt.clientX - r.left) / r.width * GW, y = (evt.clientY - r.top) / r.height * GH;
    if (x < G.x0 || x > G.x1 || y < G.yTop - 6 || y > G.yBot + 6) return null;
    const i = clamp(Math.floor((x - G.x0) / G.colW), 0, 11);
    const rowsUp = clamp(Math.round((G.yBot - y) / G.rowH), 0, G.rows);
    return { i, m: MONTHS[i], alt: 10 + rowsUp, day: 9 + rowsUp / 10 };
  }
  gc.addEventListener('click', e => {
    const h = graphHit(e); if (!h) return;
    const s = state.graph.series;
    const val = s === 'alt' ? h.alt : Math.round(h.day * 10) / 10;
    if (state.graph[s][h.m] === val) delete state.graph[s][h.m]; else state.graph[s][h.m] = val;
    drawGraph(); renderDataTable(); save();
  });
  gc.addEventListener('mousemove', e => {
    const h = graphHit(e); const st = $('#graphStatus');
    if (!h) { st.textContent = '그래프 위를 클릭하여 점을 찍으세요. 같은 점을 다시 클릭하면 지워집니다. (한 칸 = 1° / 6분)'; return; }
    st.textContent = state.graph.series === 'alt' ? `${monthName(h.m)} · 남중 고도 ${h.alt}°  ← 클릭하면 여기에 찍혀요` : `${monthName(h.m)} · 낮의 길이 ${fmtHM(h.day)}  ← 클릭하면 여기에 찍혀요`;
  });
  $$('.seg-btn').forEach(b => b.addEventListener('click', () => { state.graph.series = b.dataset.series; $$('.seg-btn').forEach(x => x.classList.toggle('active', x === b)); }));
  $('#btnExample').addEventListener('click', () => { state.graph.example = !state.graph.example; $('#btnExample').textContent = state.graph.example ? '✔ 예시 숨기기' : '✔ 예시 보기'; drawGraph(); renderDataTable(); });
  $('#btnGraphClear').addEventListener('click', () => { state.graph.alt = {}; state.graph.day = {}; drawGraph(); renderDataTable(); save(); });
  $('#btnFromRecords').addEventListener('click', () => {
    const rec = recordsOfLoc(); let n = 0;
    MONTHS.forEach(m => { if (rec[m]) { state.graph.alt[m] = Math.round(rec[m].alt); state.graph.day[m] = Math.round(rec[m].day / 6) / 10; n++; } });
    $('#graphStatus').textContent = n ? `관측 기록 ${n}개를 불러와 점을 찍었습니다. (1°, 6분 단위로 반올림)` : '관측 기록이 없어요. ‘4. 가상 관측’에서 먼저 기록해 보세요.';
    drawGraph(); renderDataTable(); save();
  });
  function renderDataTable() {
    const head = $('#dataTable thead tr'), rowA = $('#dataTable .row-alt'), rowD = $('#dataTable .row-day');
    head.innerHTML = '<th>측정 시기(월)</th>'; rowA.innerHTML = '<th>남중 고도(°)</th>'; rowD.innerHTML = '<th>낮의 길이</th>';
    state.monthly.forEach(({ m, info }) => {
      head.insertAdjacentHTML('beforeend', `<th>${m}</th>`);
      if (state.graph.example) {
        rowA.insertAdjacentHTML('beforeend', `<td>${info.meridianAlt.toFixed(1)}</td>`);
        rowD.insertAdjacentHTML('beforeend', `<td>${Solar.fmtDuration(info.dayLength)}</td>`);
      } else {
        const a = state.graph.alt[m], d = state.graph.day[m];
        rowA.insertAdjacentHTML('beforeend', a != null ? `<td>${a}</td>` : '<td class="empty">·</td>');
        rowD.insertAdjacentHTML('beforeend', d != null ? `<td>${fmtHM(d)}</td>` : '<td class="empty">·</td>');
      }
    });
  }

  /* ================================================================
   * 5-2. 비교 표
   * ================================================================ */
  function extremes() {
    const byAlt = [...state.monthly].sort((a, b) => b.info.meridianAlt - a.info.meridianAlt);
    const byDay = [...state.monthly].sort((a, b) => b.info.dayLength - a.info.dayLength);
    return { altMaxMonth: byAlt[0].m, altMinMonth: byAlt[byAlt.length - 1].m, dayMaxMonth: byDay[0].m, dayMinMonth: byDay[byDay.length - 1].m };
  }
  function buildCmpOptions() {
    $$('#cmpTable select').forEach(sel => {
      sel.innerHTML = '<option value="">?</option>';
      if (sel.dataset.kind === 'month') for (let m = 1; m <= 12; m++) sel.insertAdjacentHTML('beforeend', `<option value="${m}">${m}월</option>`);
      else ['봄', '여름', '가을', '겨울'].forEach(s => sel.insertAdjacentHTML('beforeend', `<option value="${s}">${s}</option>`));
      sel.parentElement.classList.remove('ok', 'bad');
    });
    $('#cmpFeedback').textContent = ''; $('#cmpFeedback').className = 'feedback';
  }
  $('#btnCmpCheck').addEventListener('click', () => {
    const ex = extremes();
    const answers = { altMaxMonth: String(ex.altMaxMonth), altMinMonth: String(ex.altMinMonth), dayMaxMonth: String(ex.dayMaxMonth), dayMinMonth: String(ex.dayMinMonth),
      altMaxSeason: seasonOfMonth(ex.altMaxMonth), altMinSeason: seasonOfMonth(ex.altMinMonth), dayMaxSeason: seasonOfMonth(ex.dayMaxMonth), dayMinSeason: seasonOfMonth(ex.dayMinMonth) };
    let ok = 0, total = 0;
    $$('#cmpTable select').forEach(sel => {
      total++; const good = sel.value === answers[sel.dataset.key];
      sel.parentElement.classList.toggle('ok', good); sel.parentElement.classList.toggle('bad', !good); if (good) ok++;
    });
    const fb = $('#cmpFeedback');
    fb.textContent = ok === total ? `🎉 모두 맞았어요! 남중 고도가 가장 높은 달과 낮이 가장 긴 달이 같은 ${ex.altMaxMonth}월(${seasonOfMonth(ex.altMaxMonth)})이에요.` : `${ok} / ${total} 맞았어요. 그래프를 다시 보고 빨간 칸을 고쳐 보세요.`;
    fb.className = 'feedback ' + (ok === total ? 'ok' : 'bad');
  });
  $('#btnCmpReset').addEventListener('click', buildCmpOptions);

  /* ================================================================
   * 5-3. 추론 + 반례 탐색
   * ================================================================ */
  const inferState = {};
  $$('.blank .pick').forEach(p => p.addEventListener('click', () => {
    const blank = p.parentElement; inferState[blank.dataset.blank] = p.dataset.v;
    blank.querySelectorAll('.pick').forEach(x => { x.classList.remove('correct', 'wrong'); x.classList.toggle('on', x === p); });
    const blanks = $$('.blank'); const done = blanks.every(b => inferState[b.dataset.blank]);
    const res = $('#inferResult');
    if (!done) { res.textContent = ''; return; }
    const allOk = blanks.every(b => inferState[b.dataset.blank] === b.dataset.answer);
    blanks.forEach(b => { const on = b.querySelector('.pick.on'); on.classList.add(inferState[b.dataset.blank] === b.dataset.answer ? 'correct' : 'wrong'); });
    res.textContent = allOk ? '⇒ 태양의 남중 고도가 높을수록 낮의 길이가 길다. (여름 ↑ ↔ 겨울 ↓)' : '⇒ 그래프를 다시 살펴보고 빨간 칸을 고쳐 보세요.';
    res.style.color = allOk ? 'var(--green)' : 'var(--red)';
  }));
  const fSel = $('#falsifyLoc');
  LOCATIONS.forEach(l => { const o = document.createElement('option'); o.value = l.id; o.textContent = l.name; fSel.appendChild(o); });
  fSel.addEventListener('change', renderFalsify);
  function renderFalsify() {
    const loc = LOCATIONS.find(l => l.id === fSel.value) || state.loc;
    if (loc.korea) fSel.value = state.loc.id;
    const useLoc = LOCATIONS.find(l => l.id === fSel.value) || state.loc;
    $('#falsifyNote').textContent = useLoc.note || KOREA_NOTE;
    const tb = $('#falsifyTable tbody'); tb.innerHTML = '';
    const rows = [['3월 21일 (춘분)', 3, 21, 'spring'], ['6월 21일 (하지)', 6, 21, 'summer'], ['9월 23일 (추분)', 9, 23, 'autumn'], ['12월 22일 (동지)', 12, 22, 'winter']];
    const infos = rows.map(r => dayInfoFor(useLoc, r[1], r[2]));
    const maxAlt = Math.max(...infos.map(i => i.meridianAlt)), maxDay = Math.max(...infos.map(i => i.dayLength));
    rows.forEach((r, k) => {
      const info = infos[k];
      const northTransit = info.decl > useLoc.lat;
      const flipAlt = info.meridianAlt === maxAlt && r[3] !== 'summer';
      const flipDay = info.dayLength === maxDay && r[3] !== 'summer';
      tb.insertAdjacentHTML('beforeend', `<tr class="${r[3]}"><td>${r[0]}</td><td class="${flipAlt ? 'flip' : ''}">${info.meridianAlt.toFixed(1)}°${info.meridianAlt === maxAlt ? ' ▲' : ''}</td><td>${northTransit ? '북쪽 ⚠' : '남쪽'}</td><td>${info.sunrise == null ? '—' : Solar.fmtTime(info.sunrise)}</td><td>${info.sunset == null ? '—' : Solar.fmtTime(info.sunset)}</td><td class="${flipDay ? 'flip' : ''}">${fmtDayLen(info)}${info.dayLength === maxDay ? ' ▲' : ''}</td></tr>`);
    });
  }

  /* ================================================================
   * 6. 계절에 따른 태양의 남중 고도 변화 (태양 경로 그림)
   * ================================================================ */
  const PATH = { cx: 500, cy: 410, rx: 400, ry: 165, up: 250 };
  const SEASON_INFO = {
    summer: { name: '여름', date: [6, 21], color: '#35a853', text: '태양의 남중 고도가<br><b>높다</b>.' },
    winter: { name: '겨울', date: [12, 22], color: '#f08a24', text: '태양의 남중 고도가<br><b>낮다</b>.' },
    equinox: { name: '봄,가을', date: [3, 21], color: '#e86aa6', text: '태양의 남중 고도가<br>여름과 겨울의 <b>중간</b>이다.' },
  };
  function project(alt, az) {
    const n = Math.cos(alt * Math.PI / 180) * Math.cos(az * Math.PI / 180);
    const e = Math.cos(alt * Math.PI / 180) * Math.sin(az * Math.PI / 180);
    const u = Math.sin(alt * Math.PI / 180);
    return [PATH.cx + n * PATH.rx, PATH.cy + e * PATH.ry - u * PATH.up, n, e, u];
  }
  function pathData(season) {
    const [m, d] = SEASON_INFO[season].date; let above = '', below = '';
    let prevAbove = null;
    for (let t = 0; t <= 1440; t += 6) {
      const p = posFor(state.loc, m, d, t); const [x, y] = project(p.alt, p.az);
      const isAbove = p.alt >= 0;
      const seg = `${x.toFixed(1)} ${y.toFixed(1)}`;
      if (isAbove) above += (prevAbove === true ? ' L ' : ' M ') + seg; else below += (prevAbove === false ? ' L ' : ' M ') + seg;
      prevAbove = isAbove;
    }
    return { above, below };
  }
  function buildPathScene() {
    const s = state.loc;
    const svg = `<svg viewBox="0 0 1000 640">
      <defs><radialGradient id="pglow"><stop offset="0" stop-color="#fff3a0"/><stop offset=".5" stop-color="#ffd93b"/><stop offset="1" stop-color="#ffb347" stop-opacity="0"/></radialGradient>
      <marker id="arrow" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0 L10 5 L0 10 z" fill="#e0453a"/></marker></defs>
      <rect width="1000" height="640" fill="#fbfcff"/>
      <ellipse cx="${PATH.cx}" cy="${PATH.cy}" rx="${PATH.rx}" ry="${PATH.ry}" class="ground" fill="#b9e3a0" stroke="#8cc27a" stroke-width="3"/>
      <line x1="${PATH.cx - PATH.rx}" y1="${PATH.cy}" x2="${PATH.cx + PATH.rx}" y2="${PATH.cy}" stroke="#7a9a6a" stroke-width="1" stroke-dasharray="6 6"/>
      <line x1="${PATH.cx}" y1="${PATH.cy - PATH.ry}" x2="${PATH.cx}" y2="${PATH.cy + PATH.ry}" stroke="#7a9a6a" stroke-width="1" stroke-dasharray="6 6"/>
      <g class="deco"></g>
      <g class="paths"></g>
      <line class="shadow" x1="${PATH.cx}" y1="${PATH.cy}" x2="${PATH.cx}" y2="${PATH.cy}" stroke="rgba(40,60,40,.45)" stroke-width="14" stroke-linecap="round"/>
      <g class="observer" transform="translate(${PATH.cx} ${PATH.cy})"><line x1="0" y1="0" x2="0" y2="-45" stroke="#5a4ac0" stroke-width="10" stroke-linecap="round"/><line x1="0" y1="-20" x2="-18" y2="0" stroke="#5a4ac0" stroke-width="7" stroke-linecap="round"/><line x1="0" y1="-20" x2="18" y2="0" stroke="#5a4ac0" stroke-width="7" stroke-linecap="round"/><circle cx="0" cy="-58" r="14" fill="#ffd9b0" stroke="#5a3a2a" stroke-width="3"/></g>
      <g class="angle"></g>
      <g class="sun"><circle class="sun-glow" r="46" fill="url(#pglow)"/><circle class="sun-body" r="18" fill="#ffd93b" stroke="#ff9a00" stroke-width="4"/></g>
      ${[['남', PATH.cx - PATH.rx - 8, PATH.cy], ['북', PATH.cx + PATH.rx + 8, PATH.cy], ['동', PATH.cx, PATH.cy + PATH.ry + 10], ['서', PATH.cx, PATH.cy - PATH.ry - 8]].map(([t, x, y]) => `<g><circle cx="${x}" cy="${y}" r="20" fill="#1d3a8a"/><text x="${x}" y="${y + 1}" text-anchor="middle" dominant-baseline="middle" fill="#fff" font-size="20" font-weight="700" font-family="Noto Sans KR, sans-serif">${t}</text></g>`).join('')}
      <text class="caption" x="20" y="36" font-size="20" font-family="Jua, Noto Sans KR, sans-serif" fill="#5a3fb3"></text>
      <text class="caption2" x="20" y="60" font-size="15" font-family="Noto Sans KR, sans-serif" fill="#6b6f85"></text>
    </svg>`;
    $('#pathScene').innerHTML = svg;
  }
  function drawPath() {
    if (!state.monthly.length) return;
    const svg = $('#pathScene svg'); if (!svg) return;
    const season = state.path.season;
    const paths = svg.querySelector('.paths'); paths.innerHTML = '';
    const seasons = state.path.overlay ? ['summer', 'equinox', 'winter'] : (season ? [season] : []);
    seasons.forEach(sn => {
      const { above, below } = pathData(sn); const col = SEASON_INFO[sn].color; const isMain = sn === season || !season;
      if (isMain || !state.path.overlay) paths.insertAdjacentHTML('beforeend', `<path d="${below}" fill="none" stroke="${col}" stroke-width="2" stroke-dasharray="6 7" opacity=".6"/>`);
      paths.insertAdjacentHTML('beforeend', `<path d="${above}" fill="none" stroke="${col}" stroke-width="${isMain ? 5 : 3}" opacity="${isMain ? 1 : .55}" stroke-linecap="round"/>`);
      const [m, d] = SEASON_INFO[sn].date; const info = dayInfoFor(state.loc, m, d);
      const np = posFor(state.loc, m, d, info.noon); const [x, y] = project(np.alt, np.az);
      if (state.path.overlay) paths.insertAdjacentHTML('beforeend', `<text x="${x}" y="${y - (isMain ? 44 : 26)}" text-anchor="middle" font-size="18" font-weight="700" fill="${col}" font-family="Noto Sans KR, sans-serif">${SEASON_INFO[sn].name} ${info.meridianAlt.toFixed(0)}°</text>`);
      // 진행 방향 화살표(오전 중간쯤)
      const tArrow = info.sunrise != null ? (info.sunrise + info.noon) / 2 : info.noon - 180;
      const a1 = posFor(state.loc, m, d, tArrow), a2 = posFor(state.loc, m, d, tArrow + 6);
      const [ax1, ay1] = project(a1.alt, a1.az), [ax2, ay2] = project(a2.alt, a2.az);
      if (isMain) paths.insertAdjacentHTML('beforeend', `<line x1="${ax1}" y1="${ay1}" x2="${ax2}" y2="${ay2}" stroke="${col}" stroke-width="5" marker-end="url(#arrow)"/>`);
    });
    // 장식(계절별 나무)
    const deco = svg.querySelector('.deco'); const sn = season || 'equinox';
    const leaf = sn === 'summer' ? '#57b24a' : sn === 'winter' ? null : '#f7a6c8';
    const tree = (x, y, sc) => leaf ? `<rect x="${x - 5 * sc}" y="${y - 30 * sc}" width="${10 * sc}" height="${30 * sc}" fill="#8a5a2b"/><circle cx="${x}" cy="${y - 42 * sc}" r="${22 * sc}" fill="${leaf}"/>` : `<path d="M${x} ${y} L${x} ${y - 34 * sc} M${x} ${y - 20 * sc} L${x - 14 * sc} ${y - 36 * sc} M${x} ${y - 16 * sc} L${x + 14 * sc} ${y - 32 * sc}" stroke="#8a5a2b" stroke-width="${5 * sc}" stroke-linecap="round" fill="none"/><ellipse cx="${x}" cy="${y - 34 * sc}" rx="${8 * sc}" ry="${3 * sc}" fill="#fff"/>`;
    deco.innerHTML = [[170, 350, 1], [860, 360, 1.1], [800, 310, .8], [760, 520, 1], [250, 510, 1.05]].map(t => tree(...t)).join('');
    svg.querySelector('.ground').setAttribute('fill', sn === 'winter' ? '#eef4f8' : sn === 'summer' ? '#a9dd8a' : '#c6e8b5');
    // 태양 · 그림자 · 각
    const sunG = svg.querySelector('.sun'), shadow = svg.querySelector('.shadow'), angle = svg.querySelector('.angle');
    const cap = svg.querySelector('.caption'), cap2 = svg.querySelector('.caption2');
    if (!season) { sunG.setAttribute('opacity', '0'); shadow.setAttribute('x2', PATH.cx); shadow.setAttribute('y2', PATH.cy); angle.innerHTML = ''; cap.textContent = '계절 버튼을 눌러 보세요'; cap2.textContent = ''; $('#pathReadout').innerHTML = ''; return; }
    const [m, d] = SEASON_INFO[season].date; const info = dayInfoFor(state.loc, m, d);
    const t = state.path.minutes == null ? info.noon : state.path.minutes;
    const p = posFor(state.loc, m, d, t); const [x, y, n, e, u] = project(p.alt, p.az);
    sunG.setAttribute('opacity', p.alt >= 0 ? '1' : '.25'); sunG.setAttribute('transform', `translate(${x.toFixed(1)} ${y.toFixed(1)})`);
    if (p.alt > 0.5) {
      const len = Math.min(1, 0.12 / Math.tan(p.alt * Math.PI / 180));
      shadow.setAttribute('x2', (PATH.cx - n * len * PATH.rx).toFixed(1)); shadow.setAttribute('y2', (PATH.cy - e * len * PATH.ry).toFixed(1)); shadow.setAttribute('opacity', 1);
    } else shadow.setAttribute('opacity', 0);
    // 남중 고도 각 표시(남중 위치 기준)
    const np = posFor(state.loc, m, d, info.noon); const [nx, ny] = project(np.alt, np.az);
    const col = SEASON_INFO[season].color;
    const r = 110, a = Math.atan2(PATH.cy - ny, PATH.cx - nx); // 각(화면 기준)
    const ex = PATH.cx - r * Math.cos(a), ey = PATH.cy - r * Math.sin(a);
    angle.innerHTML = `<line x1="${PATH.cx}" y1="${PATH.cy}" x2="${nx}" y2="${ny}" stroke="${col}" stroke-width="2" stroke-dasharray="5 5"/>
      <path d="M ${PATH.cx - r} ${PATH.cy} A ${r} ${r} 0 0 1 ${ex.toFixed(1)} ${ey.toFixed(1)}" fill="none" stroke="${col}" stroke-width="3"/>
      <rect x="${PATH.cx - r - 60}" y="${PATH.cy - 62}" width="${info.meridianAlt >= 100 ? 130 : 118}" height="28" rx="8" fill="#fff" stroke="${col}" stroke-width="2"/>
      <text x="${PATH.cx - r - 1}" y="${PATH.cy - 42}" text-anchor="middle" font-size="17" font-weight="700" fill="${col}" font-family="Noto Sans KR, sans-serif">남중 고도 ${info.meridianAlt.toFixed(1)}°</text>`;
    cap.textContent = `${SEASON_INFO[season].name} · ${m}월 ${d}일 · ${state.loc.name}`;
    cap2.textContent = `남중 고도 ${info.meridianAlt.toFixed(1)}°  ·  낮의 길이 ${fmtDayLen(info)}  (일출 ${Solar.fmtTime(info.sunrise)} → 일몰 ${Solar.fmtTime(info.sunset)})`;
    $('#pathReadout').innerHTML = `<div><span>시각</span><b>${Solar.fmtTime(t)}</b></div><div><span>태양 고도</span><b>${p.alt >= 0 ? p.altApparent.toFixed(1) + '°' : '지평선 아래'}</b></div><div><span>방위각</span><b>${p.az.toFixed(0)}°</b></div>`;
  }
  $$('.sbtn').forEach(b => b.addEventListener('click', () => {
    state.path.season = b.dataset.season; state.path.minutes = null; state.path.playing = false; $('#btnPathPlay').textContent = '▶ 태양 움직이기';
    $$('.sbtn').forEach(x => x.classList.toggle('active', x === b));
    const card = $('#pathCard'); card.className = 'path-card ' + state.path.season;
    const [m, d] = SEASON_INFO[state.path.season].date; const info = dayInfoFor(state.loc, m, d);
    card.innerHTML = `<div class="path-card-text">${SEASON_INFO[state.path.season].text}<small>${state.loc.name} ${m}월 ${d}일 남중 고도 ${info.meridianAlt.toFixed(1)}° · 낮의 길이 ${fmtDayLen(info)}</small></div>`;
    drawPath();
  }));
  $('#chkOverlay').addEventListener('change', () => { state.path.overlay = $('#chkOverlay').checked; drawPath(); });
  $('#btnPathPlay').addEventListener('click', () => {
    if (!state.path.season) { $('#pathCard').querySelector('.path-card-text').textContent = '먼저 계절을 선택하세요!'; return; }
    if (state.path.playing) { state.path.playing = false; $('#btnPathPlay').textContent = '▶ 태양 움직이기'; return; }
    const [m, d] = SEASON_INFO[state.path.season].date; const info = dayInfoFor(state.loc, m, d);
    const t0 = (info.sunrise == null ? info.noon - 720 : info.sunrise) - 40, t1 = (info.sunset == null ? info.noon + 720 : info.sunset) + 40;
    state.path.playing = true; state.path.minutes = t0; $('#btnPathPlay').textContent = '⏸ 멈춤';
    const step = () => {
      if (!state.path.playing) return;
      state.path.minutes += 3;
      if (state.path.minutes >= t1) { state.path.minutes = null; state.path.playing = false; $('#btnPathPlay').textContent = '▶ 태양 움직이기'; }
      drawPath(); if (state.path.playing) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  });

  /* ================================================================
   * 7. 정리 + 퀴즈
   * ================================================================ */
  function renderSummary() {
    const f = k => { const [m, d] = SEASON_DATES[k]; const i = dayInfoFor(state.loc, m, d); return `${state.loc.name} ${m}/${d} · 남중 고도 ${i.meridianAlt.toFixed(1)}° · 낮 ${fmtDayLen(i)}`; };
    $('#sumSummer').textContent = f('summer'); $('#sumWinter').textContent = f('winter'); $('#sumEquinox').textContent = f('equinox') + ' / ' + (() => { const [m, d] = SEASON_DATES.autumn; const i = dayInfoFor(state.loc, m, d); return `${m}/${d} · ${i.meridianAlt.toFixed(1)}° · ${fmtDayLen(i)}`; })();
  }
  const QUIZ = [
    { q: '태양이 하루 중 정남쪽에 왔을 때의 고도를 무엇이라고 할까요?', opts: ['남중 고도', '방위각', '일출 고도'], a: 0, why: '태양이 정남쪽에 오는 것을 남중이라 하고, 이때의 고도가 남중 고도입니다.' },
    { q: '우리나라에서 태양의 남중 고도가 가장 높은 계절은?', opts: ['봄', '여름', '가을', '겨울'], a: 1, why: '6월(하지) 무렵 남중 고도가 약 76°로 가장 높습니다.' },
    { q: '우리나라에서 낮의 길이가 가장 짧은 달은?', opts: ['3월', '6월', '9월', '12월'], a: 3, why: '12월(동지) 무렵 낮의 길이가 약 9시간 34분으로 가장 짧습니다.' },
    { q: '태양의 남중 고도가 높아지면 낮의 길이는 어떻게 될까요?', opts: ['길어진다', '짧아진다', '변하지 않는다'], a: 0, why: '남중 고도와 낮의 길이는 함께 커지고 함께 작아집니다.' },
    { q: '봄(3월)과 가을(9월)의 남중 고도와 낮의 길이는?', opts: ['여름과 비슷하다', '겨울과 비슷하다', '여름과 겨울의 중간이다'], a: 2, why: '춘분·추분 무렵 남중 고도는 약 52°, 낮의 길이는 약 12시간으로 중간입니다.' },
  ];
  const quizPick = {};
  function buildQuiz() {
    const box = $('#quiz'); box.innerHTML = '';
    QUIZ.forEach((item, i) => {
      const div = document.createElement('div'); div.className = 'quiz-item';
      div.innerHTML = `<div class="qt">${i + 1}. ${item.q}</div><div class="opts">${item.opts.map((o, k) => `<button class="opt" data-q="${i}" data-k="${k}">${o}</button>`).join('')}</div><div class="why">💡 ${item.why}</div>`;
      box.appendChild(div);
    });
    $$('.quiz .opt').forEach(b => b.addEventListener('click', () => {
      quizPick[b.dataset.q] = +b.dataset.k;
      b.parentElement.querySelectorAll('.opt').forEach(x => { x.classList.remove('correct', 'wrong'); x.classList.toggle('on', x === b); });
      b.closest('.quiz-item').classList.remove('checked');
    }));
    $('#quizFeedback').textContent = ''; $('#quizFeedback').className = 'feedback';
  }
  $('#btnQuizCheck').addEventListener('click', () => {
    let ok = 0;
    $$('.quiz-item').forEach((div, i) => {
      div.classList.add('checked');
      div.querySelectorAll('.opt').forEach((o, k) => { o.classList.remove('correct', 'wrong'); if (k === QUIZ[i].a) o.classList.add('correct'); else if (quizPick[i] === k) o.classList.add('wrong'); });
      if (quizPick[i] === QUIZ[i].a) ok++;
    });
    const fb = $('#quizFeedback'); fb.textContent = ok === QUIZ.length ? `🏆 ${ok} / ${QUIZ.length} 만점! 계절과 태양의 관계를 완벽히 이해했어요.` : `${ok} / ${QUIZ.length} 맞았어요. 설명을 읽고 다시 풀어 보세요.`;
    fb.className = 'feedback ' + (ok === QUIZ.length ? 'ok' : 'bad');
  });
  $('#btnQuizReset').addEventListener('click', () => { Object.keys(quizPick).forEach(k => delete quizPick[k]); buildQuiz(); });

  /* ================================================================
   * 시작
   * ================================================================ */
  load();
  locSelect.value = state.loc.id;
  buildScenes(); buildPathScene(); buildQuiz();
  computeMonthly();
  renderIntro(); renderCalc(); renderMonthButtons(); renderRecords(); drawSky();
  drawGraph(); renderDataTable(); buildCmpOptions(); renderFalsify(); drawPath(); renderSummary();
  showPanel(0);
})();
