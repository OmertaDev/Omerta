import fs from 'node:fs';
import path from 'node:path';
const root = process.cwd();
let source = fs.readFileSync('test/rc1-mobile-postgres.js', 'utf8');
function replace(before, after) {
  if (!source.includes(before)) throw new Error(`Expected exact harness seam: ${before}`);
  source = source.replace(before, after);
}
replace("await import('../src/server.js')", "await import('file:///C:/Users/Jorge/.codex/worktrees/omerta-rc1-proof/src/server.js')");
replace("path.resolve('docs/release/evidence/mobile')", `path.resolve(${JSON.stringify(path.join(root, 'docs/release/evidence/mobile-network'))})`);
replace("await page.goto(origin, { waitUntil: 'networkidle' });", `const network = await context.newCDPSession(page);
    await network.send('Network.enable');
    await network.send('Network.emulateNetworkConditions', { offline: false, latency: 750,
      downloadThroughput: 160000, uploadThroughput: 64000, connectionType: 'cellular3g' });
    await page.goto(origin, { waitUntil: 'networkidle', timeout: 60000 });`);
replace("await page.locator('#new-name').fill(`RC1 Phone ${viewport.width}`);", `await page.setViewportSize({ width: viewport.width, height: 500 });
    await page.locator('#new-name').click();
    await page.locator('#new-name').pressSequentially(('RC1 Network Phone ' + viewport.width).padEnd(24, 'x'));
    assert.equal(await page.locator('#new-name').inputValue().then(v => v.length), 24);
    assert.equal(await page.locator('#new-name').evaluate(el => document.activeElement === el), true);
    await page.locator('#btn-create').scrollIntoViewIfNeeded();`);
replace("await page.locator('#screen-main:not(.hidden)').waitFor();", "await page.locator('#screen-main:not(.hidden)').waitFor();\n    await page.setViewportSize(viewport);");
replace("const resultPromise = page.waitForResponse((response) => new URL(response.url()).pathname === '/v1/commands/execute');", `let droppedReceipt, committedCensus, dropped = false;
    const census = async () => {
      const counts = {};
      for (const table of ['coordination_instances', 'coordination_commands', 'content_instances', 'content_instance_nodes', 'content_instance_effects',
        'mystery_instances', 'item_events', 'world_kernel_events', 'world_operation_events']) {
        counts[table] = Number((await app.pool.query('SELECT count(*) FROM ' + table)).rows[0].count);
      }
      return counts;
    };
    await page.route('**/v1/commands/execute', async route => {
      if (dropped) return route.continue();
      dropped = true;
      const committed = await route.fetch();
      assert.equal(committed.status(), 200);
      droppedReceipt = await committed.json();
      assert.equal(droppedReceipt.status, 'COMPLETED');
      committedCensus = await census();
      await route.abort('failed'); // Lose the response after the real server committed.
    });
    const resultPromise = page.waitForResponse((response) => new URL(response.url()).pathname === '/v1/commands/execute', { timeout: 60000 });`);
replace("const commandResponse = await resultPromise, response = await commandResponse.json();", `const retry = page.locator('#world-retry');
    await retry.waitFor({ state: 'visible', timeout: 30000 });
    await retry.click();
    const commandResponse = await resultPromise, response = await commandResponse.json();
    assert.equal(response.replayed, true, 'lost committed response must replay, not execute twice');
    assert.equal(response.executionId, droppedReceipt.executionId, 'retry preserves exact issued identity');
    assert.deepEqual(await census(), committedCensus, 'retry must not duplicate any captured canonical domain rows');
    assert.equal(committedCensus.coordination_instances, results.length + 1,
      'discovery.start creates exactly one canonical coordination instance per new player');`);
replace("await page.screenshot({ path: path.join(directory, `command-center-${viewport.width}.png`), fullPage: true });",
  "await page.screenshot({ path: path.join(directory, `command-center-${viewport.width}.png`), fullPage: false });");
replace("javascriptErrors: errors });", "javascriptErrors: errors, lostCommittedResponse: true, exactIdentityReplay: true, committedCensus, latencyMs: 750, nameLength: 24, reducedViewportInput: true });");
replace("Object.values(response.feedback)", "Object.values(droppedReceipt.feedback)");
replace("scope: 'Chromium phone emulation; local real PostgreSQL; no human cohort or native wallet proof'", "source: '21d0589a8b1f15cbb712e574becd507b813e4b0c', scope: 'Real PostgreSQL; Chromium network throttling and lost committed response. Reduced viewport is a keyboard geometry proxy, not native virtual keyboard proof.'");
fs.writeFileSync(path.join(root, 'docs/release/evidence/mobile-network-proof.mjs'), source);
console.log('Generated evidence-local network proof from the checked-in phone harness.');
