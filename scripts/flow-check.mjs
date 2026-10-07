// Interaction check across desktop (1366), tablet (820) and phone (390): seed, trace, blocked, review, assumption change, export, reset.
// Usage: npm run build && npm run preview, then npm run flow [url]. Screenshots and downloads go to test-results/.
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright';
const b = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined, headless: !process.env.CHROME_PATH, args: process.env.CHROME_PATH ? ['--headless=new'] : [] });
const url = process.argv[2] || 'http://localhost:4173/';
const dir = process.env.SHOTS_DIR || 'test-results';
mkdirSync(dir, { recursive: true });
for (const [name,w,h,m] of [['desk',1366,900,false],['tab',820,1180,false],['mob',390,844,true]]) {
  const c = await b.newContext({ viewport:{width:w,height:h}, isMobile:m, hasTouch:m, deviceScaleFactor: m?2:1, acceptDownloads:true });
  const p = await c.newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push(String(e)));
  await p.goto(url, { waitUntil:'load' });
  await p.waitForTimeout(600);
  await p.screenshot({ path:`${dir}/flow-${name}-1-top.png` });
  // successful path: select a bar and trace
  await p.locator('.bar[data-sp="35"]').first().scrollIntoViewIfNeeded();
  await p.locator('.bar[data-sp="35"]').first().click();
  await p.getByRole('tab', { name: /Demand spike/ }).click();
  await p.locator('#s3').scrollIntoViewIfNeeded();
  await p.evaluate(() => document.querySelector('#s3').scrollIntoView());
  await p.waitForTimeout(200);
  await p.screenshot({ path:`${dir}/flow-${name}-2-scenarios.png` });
  await p.evaluate(() => document.querySelector('.trace').scrollIntoView());
  await p.screenshot({ path:`${dir}/flow-${name}-3-trace.png` });
  // keyboard: arrow to next bar
  await p.locator('.bar[data-sp="35"]').first().focus();
  await p.keyboard.press('ArrowRight');
  const traced = await p.locator('.trace-head').innerText();
  // blocked path
  await p.getByRole('button', { name: /Missing meter batch/ }).click();
  await p.locator('.bar[data-sp="36"]').first().click();
  await p.evaluate(() => document.querySelector('#s3').scrollIntoView());
  await p.screenshot({ path:`${dir}/flow-${name}-4-blocked.png` });
  await p.evaluate(() => document.querySelector('.trace').scrollIntoView());
  await p.screenshot({ path:`${dir}/flow-${name}-5-blocked-trace.png` });
  // review path
  await p.getByRole('button', { name: /Resend \+ model change/ }).click();
  await p.evaluate(() => document.querySelector('[aria-labelledby="s2"] .panel[aria-live]').scrollIntoView());
  await p.screenshot({ path:`${dir}/flow-${name}-6-review.png` });
  await p.getByLabel(/Acknowledge split by version/).check();
  await p.getByLabel(/Accept for this analysis/).check();
  await p.getByLabel(/Use RSD-0020/).check();
  const statuses = await p.locator('.scard .chip').allInnerTexts();
  await p.evaluate(() => document.querySelector('#s5').scrollIntoView());
  await p.screenshot({ path:`${dir}/flow-${name}-7-tradeoffs.png` });
  await p.evaluate(() => document.querySelector('#s4').scrollIntoView());
  await p.screenshot({ path:`${dir}/flow-${name}-8-assumptions.png` });
  // assumption change
  await p.getByLabel('Detection lag').fill('1');
  const outageCost = await p.locator('.scard').nth(2).locator('.big').innerText();
  // export
  await p.evaluate(() => document.querySelector('#s6').scrollIntoView());
  await p.getByLabel(/Reviewer name/).fill('A. Reviewer');
  const [d1] = await Promise.all([p.waitForEvent('download'), p.getByRole('button', { name: /Download decision memo/ }).click()]);
  const [d2] = await Promise.all([p.waitForEvent('download'), p.getByRole('button', { name: /Download scenario CSV/ }).click()]);
  await d1.saveAs(`${dir}/dl-${name}-${d1.suggestedFilename()}`);
  await d2.saveAs(`${dir}/dl-${name}-${d2.suggestedFilename()}`);
  await p.screenshot({ path:`${dir}/flow-${name}-9-export.png` });
  // reset
  await p.getByRole('button', { name: 'Reset', exact: true }).click();
  const after = await p.locator('.sample.active strong').innerText();
  const ov = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  const fail = [];
  if (!/^SP 36 /.test(traced)) fail.push('keyboard trace did not move to SP 36');
  if (statuses.join() !== 'Ready,Ready,Ready') fail.push('review decisions did not conclude scenarios: ' + statuses.join());
  if (ov > 0) fail.push('horizontal page overflow ' + ov + 'px');
  if (errs.length) fail.push('page errors: ' + errs.join(' | '));
  if (after !== 'Clean day') fail.push('reset did not restore clean day');
  if (fail.length) { process.exitCode = 1; console.error('FAIL', name, fail.join('; ')); }
  console.log(fail.length ? 'FAIL' : 'PASS', name, JSON.stringify({ traced, statuses, outageCost, files: [d1.suggestedFilename(), d2.suggestedFilename()], after, overflowPx: ov, errs }));
  await c.close();
}
await b.close();
