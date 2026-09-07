/* Bawkward 스모크 테스트 (Playwright, 서버·빌드 없음)
 * 실행: node tests/smoke.cjs            (playwright 가 npm 으로 설치돼 있거나 전역에 있으면 됨)
 *      PLAYWRIGHT_MODULE=/path/to/node_modules/playwright node tests/smoke.cjs
 * 검증: 교사·학생 전 흐름 + 데이터 주권 불변식(4단 완성 전 AI 잠금, 마스킹, 원장에 원문 없음, 학생 문집 차단, 파기).
 */
const fs = require('fs'), path = require('path'), http = require('http');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const ROOT = path.resolve(__dirname, '..');
const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml' };

// _layouts/app.html 의 {{ content }} 만 비운 정적 서버 (Jekyll 대체)
function serve() {
  const index = fs.readFileSync(path.join(ROOT, '_layouts/app.html'), 'utf8').replace('{{ content }}', '');
  return new Promise((res) => {
    const srv = http.createServer((req, r) => {
      const u = decodeURIComponent(req.url.split('?')[0]);
      if (u === '/' || u === '/index.html') { r.writeHead(200, { 'Content-Type': MIME['.html'] }); return r.end(index); }
      const f = path.join(ROOT, u); if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end(); }
      r.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r);
    }).listen(0, '127.0.0.1', () => res({ srv, base: `http://127.0.0.1:${srv.address().port}` }));
  });
}

let pass = 0, fail = 0; const failures = [];
async function t(name, fn) { try { await fn(); pass++; console.log('  ✓', name); } catch (e) { fail++; failures.push(name + ': ' + e.message); console.log('  ✗', name, '—', e.message); } }
const ok = (c, m) => { if (!c) throw new Error(m || 'assertion failed'); };

(async () => {
  const { srv, base } = await serve();
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1200, height: 900 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errs.push('console: ' + m.text()); });
  page.on('dialog', (d) => d.accept());
  const goto = async (h) => { await page.goto(`${base}/#${h}`); await page.waitForTimeout(120); };
  const text = async (sel = '#view') => (await page.locator(sel).innerText());
  const vault = () => page.evaluate(() => JSON.parse(localStorage.getItem('bawkward.vault.v1')));

  console.log('교사 흐름');
  await goto('/'); await page.evaluate(() => localStorage.clear()); await page.reload(); await page.waitForTimeout(150);
  await t('홈: 교사로 시작, 단원 카드 2개', async () => { ok((await text('#user-chip')).includes('오진우')); ok((await page.locator('#view .unit-hero').count()) === 2); });
  await t('단원 상세: 도달점·내용체계·성취기준·탐구질문', async () => { await goto('/unit/u1'); const v = await text(); ['도달점 (GOAL)', '지식·이해', '과정·기능', '가치·태도', '[6사08-01]', '탐구질문'].forEach((k) => ok(v.includes(k), k)); });
  await t('모달: aria-modal·제목 연결·첫 필드 포커스·Tab 트랩·Esc 닫힘·포커스 복원', async () => {
    await goto('/units'); await page.click('[data-action=new-unit]'); await page.waitForTimeout(80);
    const dlg = page.locator('#modal-root [role=dialog]'); ok(await dlg.count() === 1);
    ok((await dlg.getAttribute('aria-modal')) === 'true'); ok((await dlg.getAttribute('aria-labelledby')) === 'modal-title'); ok(await page.locator('#modal-title').count() === 1);
    ok(await page.evaluate(() => document.activeElement.closest('#modal-root') !== null), 'focus inside modal');
    for (let i = 0; i < 40; i++) { await page.keyboard.press('Tab'); ok(await page.evaluate(() => document.activeElement.closest('#modal-root') !== null), 'Tab escaped modal'); }
    for (let i = 0; i < 5; i++) { await page.keyboard.press('Shift+Tab'); ok(await page.evaluate(() => document.activeElement.closest('#modal-root') !== null), 'Shift+Tab escaped modal'); }
    await page.keyboard.press('Escape'); ok(await page.locator('#modal-root').isHidden());
    ok(await page.evaluate(() => document.activeElement?.dataset.action === 'new-unit'), 'focus restored to opener');
  });
  await t('단원 설계 모달: 템플릿 선택 → 필드 자동 채움 → 단원+탐구질문+키워드 생성', async () => {
    await page.click('[data-action=new-unit]'); await page.selectOption('select[name=template]', 'tpl-sci6-energy'); await page.waitForTimeout(50);
    ok((await page.inputValue('textarea[name=goal]')).includes('에너지 전환')); ok((await page.inputValue('textarea[name=standards]')).includes('[6과'));
    await page.click('#modal-root button[type=submit]'); await page.waitForTimeout(150);
    ok(/#\/unit\/u_/.test(page.url()), 'navigated to new unit'); const v = await text();
    ok(v.includes('에너지는 형태를 바꾸며')); ok(v.includes('대조필요')); ok(v.includes('전등이 켜지기까지'));
    const s = await vault(); const u = s.units[0]; ok(u.templateId === 'tpl-sci6-energy'); ok(s.inquiries.filter((q) => q.unitId === u.id).length === 2); ok(s.retrievals.find((r) => r.unitId === u.id).keywords.length === 5);
  });
  await t('단원 설계 모달: 직접 입력 + 성취기준 파싱', async () => {
    await goto('/units'); await page.click('[data-action=new-unit]');
    await page.fill('input[name=domain]', '테스트 영역'); await page.fill('textarea[name=coreIdea]', '핵심'); await page.fill('textarea[name=goal]', '도달점');
    await page.fill('textarea[name=standards]', '[6과01-01] 문장 하나\n코드 없는 줄'); await page.click('#modal-root button[type=submit]'); await page.waitForTimeout(150);
    const u = (await vault()).units[0]; ok(u.standards.length === 2); ok(u.standards[0].code === '[6과01-01]' && u.standards[0].text === '문장 하나'); ok(u.standards[1].code === '' && u.standards[1].text === '코드 없는 줄');
    await page.click('[data-action=del-unit]'); await page.waitForTimeout(100); ok((await vault()).units.every((x) => x.domain !== '테스트 영역'));
  });
  await t('탐구질문 추가/삭제', async () => {
    await goto('/unit/u2'); await page.click('[data-action=add-inq]'); await page.fill('input[name=question]', '테스트 질문?'); await page.fill('textarea[name=children]', '차시1\n차시2');
    await page.click('#modal-root button[type=submit]'); await page.waitForTimeout(100); ok((await text()).includes('테스트 질문?')); ok((await text()).includes('차시2'));
    const btns = page.locator('[data-action=del-inq]'); const n = await btns.count(); await btns.nth(n - 1).click(); await page.waitForTimeout(80); ok(!(await text()).includes('테스트 질문?'));
  });
  await t('인출 키워드 설계 + 학급 현황', async () => {
    await goto('/retrieve/u1'); ok((await text()).includes('인출 키워드 설계')); await page.click('[data-action=add-kw]'); await page.fill('input[name=term]', '테스트키워드'); await page.click('#modal-root button[type=submit]'); await page.waitForTimeout(80);
    ok((await text()).includes('테스트키워드')); const d = page.locator('[data-action=del-kw]'); await d.nth(await d.count() - 1).click(); await page.waitForTimeout(80); ok(!(await text()).includes('테스트키워드'));
  });
  await t('학급 문집: 교사는 열람, 원문 표시', async () => { await goto('/board/u1'); const v = await text(); ok(v.includes('학급 일걷쓰')); ok(v.includes('자리 바꾸기')); });
  await t('STATEtistics: 탭 4개, 차트 title/desc/sr-only 표, 이름·원문 없음', async () => {
    await goto('/stats'); ok(await page.locator('[role=tab]').count() === 4);
    for (const id of ['transfer', 'rhythm', 'gap', 'retrieval']) { await page.click(`[data-action=stat-tab][data-id=${id}]`); await page.waitForTimeout(60); ok((await page.locator('[role=tab][aria-selected=true]').getAttribute('data-id')) === id); ok(await page.locator('svg title').count() === 1); ok((await page.locator('svg desc').textContent()).includes('주 동안')); ok(await page.locator('table.sr-only tr').count() > 2); }
    const v = await text(); ok(!v.includes('김서준') && !v.includes('자리 바꾸기'));
  });
  await t('볼트: 마스킹 예시(이름·학교·번호·전화), 원장 원문 없음, 접근 로그', async () => {
    await goto('/vault'); const m = await page.locator('.mask-demo').innerText();
    ok(m.includes('[학생A]') && m.includes('[학교]') && m.includes('[N]명') && m.includes('[전화]'), m); ok(!m.includes('오진우') && !m.includes('한들'));
    const s = await vault(); s.runs.forEach((r) => ok(!('observe' in r) && !('rawInput' in r) && !('input' in r), 'run has raw column'));
    ok((await text()).includes('접근 로그'));
  });
  await t('볼트 import: 잘못된 형식·버전 거부', async () => {
    const r = await page.evaluate(() => { const out = []; for (const j of ['{"a":1}', '{"units":[],"users":[],"classes":[],"members":[],"version":2}']) { try { BW.store.importJSON(j); out.push('accepted'); } catch (e) { out.push(e.message); } } return out; });
    ok(r[0].includes('형식')); ok(r[1].includes('버전'));
  });
  await t('마이페이지: OpenRouter 설정 저장(브라우저에만)', async () => {
    await goto('/me'); await page.fill('input[name=apiKey]', ''); await page.selectOption('select[name=modelSelect]', 'google/gemini-2.5-flash'); await page.waitForTimeout(30);
    await page.click('form[data-form=ai-settings] button[type=submit]'); await page.waitForTimeout(50);
    ok((await page.evaluate(() => JSON.parse(localStorage.getItem('bawkward.ai.v1')).model)) === 'google/gemini-2.5-flash');
  });

  console.log('학생 흐름');
  await t('계정 전환 → 학생 홈', async () => { await goto('/me'); await page.click('[data-action=switch][data-id=s2]'); await page.waitForTimeout(150); ok((await text('#user-chip')).includes('이하윤')); ok((await text()).includes('배정된 단원')); });
  await t('학생은 학급 문집 접근 불가', async () => { await goto('/board/u1'); ok((await text()).includes('교사만')); ok(!(await text()).includes('자리 바꾸기')); });
  await t('일걷쓰: 4단 완성 전 AI 버튼 잠금, 저장 후 열림', async () => {
    await goto('/write/u1'); ok(await page.locator('[data-action=ai-from-work]').isDisabled(), 'should be locked at 2/4');
    await page.fill('textarea[name=explore]', '자료에서 투표는 공정하지만 이유를 듣는 과정이 필요함을 알았다.'); await page.fill('textarea[name=reflect]', '다음엔 이유를 먼저 묻자.');
    await page.click('form[data-form=write] button[type=submit]'); await page.waitForTimeout(150);
    ok((await text()).includes('4/4')); ok(await page.locator('[data-action=ai-from-work]').isEnabled(), 'should unlock at 4/4');
  });
  await t('AI(데모): 질문만 제안, 원장에 마스킹 입력·초안만 기록, 이름 미포함', async () => {
    const before = (await vault()).runs.length; await page.click('[data-action=ai-from-work]'); await page.waitForTimeout(900);
    const d = await page.locator('#draft').innerText(); ok(d.includes('•') && d.includes('데모 모드'), d);
    const s = await vault(); ok(s.runs.length === before + 1); const r = s.runs[0]; ok(r.model === 'demo' && r.purpose === 'inquiry-draft'); ok(typeof r.maskedInput === 'string' && typeof r.questionDraft === 'string');
    ok(!/김서준|이하윤|박도현|최지아|오진우/.test(r.maskedInput + r.questionDraft), 'name leaked into ledger');
  });
  await t('AI 조교 화면(데모): 마스킹 후 질문 제안', async () => {
    await goto('/ai'); await page.fill('input[name=q]', '오진우 선생님이 한들초등학교 3반에서 5명과 이야기했다'); await page.click('form[data-form=ai] button'); await page.waitForTimeout(900);
    const r = (await vault()).runs[0]; ok(r.maskedInput.includes('[학생A]') && r.maskedInput.includes('[학교]') && r.maskedInput.includes('[N]반'), r.maskedInput); ok(!r.maskedInput.includes('오진우'));
  });
  await t('인출: 키워드 토글(aria-pressed) → 제출 → 점수·갭', async () => {
    await page.evaluate(() => { const s = JSON.parse(localStorage.getItem('bawkward.vault.v1')); delete s.retrievals[0].attempts.s2; localStorage.setItem('bawkward.vault.v1', JSON.stringify(s)); });
    await page.reload(); await goto('/retrieve/u1'); await page.waitForTimeout(100);
    const kws = page.locator('button.kw'); ok(await kws.count() === 6); await kws.nth(0).click(); await kws.nth(2).click(); ok((await kws.nth(0).getAttribute('aria-pressed')) === 'true');
    await page.click('[data-action=submit-kw]'); await page.waitForTimeout(120); const v = await text(); ok(v.includes('인출 점수')); ok(v.includes('보충할 갭')); ok(v.includes('다수결'));
  });
  await t('전이: 3칸 체크 저장 → 신호 반영', async () => {
    const w = (await vault()).works.find((x) => x.studentId === 's2'); await goto(`/transfer/${w.id}`);
    await page.fill('input[name=toSubject]', '국어'); await page.fill('input[name=realLife]', '급식 규칙 제안'); for (const i of [0, 1, 2]) await page.check(`input[name=c${i}]`);
    await page.click('form[data-form=transfer] button[type=submit]'); await page.waitForTimeout(150);
    const s = await vault(); const x = s.transfers.find((t) => t.workId === w.id); ok(x && x.checks.every((c) => c.ok)); ok(s.signals.some((g) => g.studentCode === 'B3' && g.transferOk === 1));
  });
  await t('학생 볼트: 파기 버튼 없음 / 내보내기 있음', async () => { await goto('/vault'); ok(await page.locator('[data-action=purge]').count() === 0); ok(await page.locator('[data-action=export-md]').count() === 1); });
  await t('일걷쓰 .md 내보내기: 학생은 본인 글만', async () => { const md = await page.evaluate(() => BW.store.exportMarkdown()); ok(md.includes('이하윤')); ok(!md.includes('김서준')); });

  console.log('학기말 파기');
  await t('교사 파기: 원문·코드표·신호·원장 동시 삭제', async () => {
    await goto('/me'); await page.click('[data-action=switch][data-id=t1]'); await page.waitForTimeout(120); await goto('/vault'); await page.click('[data-action=purge]'); await page.click('#modal-root button[type=submit]'); await page.waitForTimeout(150);
    const s = await vault(); ok(s.works.length === 0 && s.transfers.length === 0 && s.signals.length === 0 && s.runs.length === 0); ok(s.users.filter((u) => u.role === 'student').every((u) => !u.code)); ok(s.retrievals.every((r) => Object.keys(r.attempts).length === 0));
    ok(s.accessLog[0].what === 'vault:purge');
  });
  await t('모바일 뷰포트에서 가로 스크롤 없음', async () => {
    await page.setViewportSize({ width: 390, height: 800 }); for (const h of ['/', '/unit/u1', '/stats', '/vault']) { await goto(h); ok((await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)), 'horizontal overflow at ' + h); }
  });
  await t('콘솔·페이지 오류 없음', async () => ok(errs.length === 0, errs.join(' | ')));

  await browser.close(); srv.close();
  console.log(`\n${pass} passed, ${fail} failed`); if (fail) { console.log(failures.join('\n')); process.exit(1); }
})().catch((e) => { console.error(e); process.exit(1); });
