import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { startShop, project } from './browser_helpers.mjs';

const shop = await startShop();
let browser;
try {
  browser = await chromium.launch({ headless: true,
    ...(process.env.CHROMIUM_EXECUTABLE ? { executablePath: process.env.CHROMIUM_EXECUTABLE } : {}) });
} catch (error) { await shop.close(); throw error; }
const out = path.join(project, 'verification');
await fs.mkdir(path.join(out, 'screenshots'), { recursive: true });
const checks = [], errors = [];
async function check(name, action) { await action(); checks.push(name); console.log(`PASS ${name}`); }
async function pageFor(viewport = { width: 1280, height: 900 }) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  return page;
}
async function go(page, hash, selector) {
  await page.goto(`${shop.url}/${hash}`);
  await page.locator(selector).first().waitFor();
}
async function badge(page, count) {
  await page.waitForFunction(n => document.querySelector('#cart-count').textContent === String(n), count);
}
async function frames(page) { await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))); }
async function screenshot(page, name) { await page.screenshot({ path: path.join(out, 'screenshots', name), fullPage: true }); }

try {
  await check('Late product response cannot add a previously viewed book', async () => {
    const page = await pageFor();
    let release, seen;
    const gate = new Promise(resolve => { release = resolve; });
    const requested = new Promise(resolve => { seen = resolve; });
    await page.route('**/api/products/1', async route => {
      const response = await route.fetch(); seen(); await gate; await route.fulfill({ response });
    });
    await page.goto(`${shop.url}/#product/1`, { waitUntil: 'domcontentloaded' });
    await requested;
    await page.evaluate(() => { location.hash = 'product/2'; });
    await page.locator('#add-form').waitFor();
    const response = page.waitForResponse(r => r.url().endsWith('/api/products/1'));
    release(); await response; await frames(page);
    const posts = [];
    page.on('request', r => { if (r.method() === 'POST' && r.url().endsWith('/api/cart')) posts.push(r.postDataJSON()); });
    const added = page.waitForResponse(r => r.url().endsWith('/api/cart') && r.request().method() === 'POST');
    await page.locator('#add-form button').click(); await added; await frames(page);
    assert.deepEqual(posts, [{ product_id: 2, quantity: 1 }]);
    await badge(page, 1);
    const cart = await (await page.request.get(`${shop.url}/api/cart`)).json();
    assert.deepEqual(cart.items.map(item => [item.id, item.quantity]), [[2, 1]]);
    await page.context().close();
  });

  await check('Opening the bag waits for an unfinished AJAX add', async () => {
    const page = await pageFor();
    await go(page, '#product/1', '#add-form');
    let release, seen;
    const gate = new Promise(resolve => { release = resolve; });
    const requested = new Promise(resolve => { seen = resolve; });
    await page.route('**/api/cart', async route => {
      if (route.request().method() !== 'POST') return route.continue();
      seen(); await gate; await route.continue();
    });
    await page.locator('#add-form button').click(); await requested;
    await page.locator('[data-nav="cart"]').click();
    release(); await page.locator('.cart-row').waitFor();
    assert.equal(await page.locator('[data-quantity]').inputValue(), '1');
    await badge(page, 1); await page.context().close();
  });

  await check('Checkout waits for quantity updates and preserves entered fields', async () => {
    const page = await pageFor();
    await go(page, '#product/1', '#add-form');
    await page.locator('#add-form button').click(); await badge(page, 1);
    await page.locator('[data-nav="cart"]').click(); await page.locator('.cart-row').waitFor();
    let release, seen;
    const gate = new Promise(resolve => { release = resolve; });
    const requested = new Promise(resolve => { seen = resolve; });
    await page.route('**/api/cart/1', async route => { seen(); await gate; await route.continue(); });
    await page.locator('[data-quantity]').fill('3'); await page.locator('[data-quantity]').press('Tab');
    await requested; await page.locator('a[href="#checkout"]').click();
    release(); await page.locator('#checkout-form').waitFor();
    assert.match(await page.locator('.sum-total').innerText(), /56.70/);
    await page.locator('#customer_name').fill('Demo Reader'); await frames(page);
    assert.equal(await page.locator('#customer_name').inputValue(), 'Demo Reader');
    await badge(page, 3); await page.context().close();
  });

  await check('A rejected quantity update does not block the next valid cart write', async () => {
    const page = await pageFor(); await go(page, '#product/1', '#add-form');
    await page.locator('#add-form button').click(); await badge(page, 1);
    await page.locator('[data-nav="cart"]').click(); await page.locator('.cart-row').waitFor();
    await page.locator('[data-quantity]').fill('25'); await page.locator('[data-quantity]').press('Tab');
    await page.locator('#toast.fail').waitFor();
    await page.waitForFunction(() => document.querySelector('[data-quantity]')?.value === '1' && !document.querySelector('[data-quantity]').disabled);
    await page.locator('[data-quantity]').fill('2'); await page.locator('[data-quantity]').press('Tab');
    await badge(page, 2); await page.context().close();
  });

  const page = await pageFor();
  await check('Catalogue, author search, genre filter and both price sorts', async () => {
    await go(page, '#catalog', '.book-card'); assert.equal(await page.locator('.book-card').count(), 12);
    await screenshot(page, '01-catalogue.png');
    await page.locator('#search').fill('Mira'); await page.locator('#search').press('Enter');
    await page.waitForFunction(() => document.querySelectorAll('.book-card').length === 1);
    assert.match(await page.locator('.book-card').innerText(), /Quiet Atlas/);
    await go(page, '#catalog', '.book-card'); await page.locator('#category').selectOption('Nature');
    await page.waitForFunction(() => document.querySelectorAll('.book-card').length === 3);
    for (const sort of ['low', 'high']) {
      await page.locator('#sort').selectOption(sort); await page.waitForURL(`**/*sort=${sort}`);
      await page.waitForFunction(s => {
        const prices = [...document.querySelectorAll('.book-card .price')].map(el => Number(el.textContent.replace(/[^\d.]/g, '')));
        return document.querySelector('#sort').value === s && prices.every((v,i) => !i || (s === 'low' ? prices[i-1] <= v : prices[i-1] >= v));
      }, sort);
      const prices = await page.locator('.book-card .price').allTextContents();
      const values = prices.map(p => Number(p.replace(/[^\d.]/g, '')));
      assert.deepEqual(values, [...values].sort((a,b) => sort === 'low' ? a-b : b-a));
    }
  });
  await check('Detail, duplicate AJAX additions, editable cart and reload persistence', async () => {
    await go(page, '#catalog', '.book-card');
    await page.getByRole('heading', { name: 'The Quiet Atlas', exact: true }).getByRole('link').click();
    await page.locator('#add-form').waitFor(); await screenshot(page, '02-product-detail.png');
    const marker = await page.evaluate(() => (window.documentMarker = crypto.randomUUID()));
    for (const count of [1, 2]) { await page.locator('#add-form button').click(); await badge(page, count); }
    assert.equal(await page.evaluate(() => window.documentMarker), marker);
    await page.locator('[data-nav="cart"]').click(); await page.locator('.cart-row').waitFor();
    assert.equal(await page.locator('.cart-row').count(), 1);
    assert.equal(await page.locator('[data-quantity]').inputValue(), '2');
    assert.match(await page.locator('.sum-total').innerText(), /37.80/);
    await screenshot(page, '03-cart.png');
    for (const quantity of [3, 2]) {
      await page.locator('[data-quantity]').fill(String(quantity)); await page.locator('[data-quantity]').press('Tab');
      await badge(page, quantity); await page.reload(); await page.locator('.cart-row').waitFor();
      assert.equal(await page.locator('[data-quantity]').inputValue(), String(quantity));
    }
  });
  let order;
  await check('Guest checkout, server-calculated order and persistent confirmation', async () => {
    await page.locator('a[href="#checkout"]').click(); await page.locator('#checkout-form').waitFor();
    for (const [field,value] of Object.entries({ customer_name:'Demo Reader', email:'reader@example.test', address:'12 Fiction Lane', postal_code:'12345', city:'Sample Town' })) {
      await page.locator('#'+field).fill(value);
    }
    await page.locator('[name="acknowledge_demo"]').check(); await screenshot(page, '04-checkout.png');
    const response = page.waitForResponse(r => r.url().endsWith('/api/checkout') && r.request().method() === 'POST');
    await page.locator('#checkout-form button').click(); order = await (await response).json();
    await page.locator('.confirm-heading').waitFor(); await badge(page, 0);
    assert.equal(order.total_cents, 3780); assert.equal(order.items.length, 1); assert.equal(order.items[0].quantity, 2);
    await screenshot(page, '05-order-confirmation.png');
    await page.reload(); await page.locator('.confirm-heading').waitFor();
    assert.match(await page.locator('.confirm-heading').innerText(), new RegExp(order.id));
    const python = process.env.PYTHON_COMMAND || (process.platform === 'win32' ? 'python' : 'python3');
    const sql = 'import json,sqlite3,sys; d=sqlite3.connect(sys.argv[1]); print(json.dumps([d.execute("SELECT COUNT(*) FROM orders WHERE id=?",(sys.argv[2],)).fetchone()[0],d.execute("SELECT quantity,unit_price_cents FROM order_items WHERE order_id=?",(sys.argv[2],)).fetchone(),d.execute("SELECT COUNT(*) FROM cart_items WHERE session_id=(SELECT session_id FROM orders WHERE id=?)",(sys.argv[2],)).fetchone()[0]]))';
    assert.deepEqual(JSON.parse(execFileSync(python, ['-c', sql, shop.database, order.id], { encoding:'utf8' })), [1,[2,1890],0]);
  });
  await check('Guest isolation, empty states, out-of-stock state and removal', async () => {
    const other = await pageFor(); await go(other, '#cart', '.empty');
    const response = await other.request.get(`${shop.url}/api/orders/${order.id}`); assert.equal(response.status(), 404);
    await go(other, '#product/12', '#add-form'); assert.equal(await other.locator('#add-form button').isDisabled(), true);
    await go(other, '#product/1', '#add-form'); await other.locator('#add-form button').click(); await badge(other, 1);
    await other.locator('[data-nav="cart"]').click(); await other.locator('.cart-row').waitFor();
    await other.locator('[data-remove]').click(); await other.locator('.empty').waitFor(); await badge(other, 0);
    await go(other, '#checkout', '.empty'); await other.context().close();
  });
  await check('Mobile catalogue, detail, cart and checkout without horizontal overflow', async () => {
    const mobile = await pageFor({ width:390, height:844 });
    for (const [hash,selector,name] of [['#catalog','.book-card','06-mobile-catalogue.png'],['#product/1','#add-form','07-mobile-detail.png']]) {
      await go(mobile, hash, selector); assert.ok(await mobile.evaluate(() => document.documentElement.scrollWidth <= innerWidth)); await screenshot(mobile, name);
    }
    await mobile.locator('#add-form button').click(); await badge(mobile, 1);
    for (const [hash,selector,name] of [['#cart','.cart-row','08-mobile-cart.png'],['#checkout','#checkout-form','09-mobile-checkout.png']]) {
      await go(mobile, hash, selector); assert.ok(await mobile.evaluate(() => document.documentElement.scrollWidth <= innerWidth)); await screenshot(mobile, name);
    }
    await mobile.context().close();
  });
  assert.deepEqual(errors, []);
  await fs.writeFile(path.join(out,'browser-results.json'), JSON.stringify({ result:'PASS', checkedAt:new Date().toISOString(), desktopViewport:'1280x900', mobileViewport:'390x844', checks, pageErrors:errors, orderId:order.id },null,2)+'\n');
  console.log(`${checks.length} browser scenarios passed; screenshots and results saved in verification/.`);
} finally { await browser.close(); await shop.close(); }
