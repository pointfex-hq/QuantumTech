// Regression test for GitHub Issue #7: "Fix Add to Cart and Quantity Decrement Behaviour".
// Requires the dev server: `npm run dev` (http://localhost:3000), then `npm run test:cart`.
//
// Acceptance criteria covered (desktop 1366px and mobile 375px):
//  1. Adding to cart (product page, product card) does NOT open the cart drawer.
//  2. Header cart badge count updates after adding.
//  3. Minus button works in the cart drawer and on the cart page.
//  4. Minus at quantity 1 removes the item (same as the bin icon).
//  5. Cart count and subtotal update automatically after every change.
//  6. Product page quantity picker still cannot go below 1.
import puppeteer from 'puppeteer';

const BASE_URL = 'http://localhost:3000';
const PRODUCT_SLUG = 'q-charge-20w-fast-charger';
const DRAWER = '[role="dialog"][aria-labelledby="cart-drawer-title"]';
const CART_BUTTON = 'button[aria-label^="Shopping cart with"]';

let failures = 0;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function check(condition, message) {
  if (condition) {
    console.log(`  ✓ ${message}`);
  } else {
    failures++;
    console.log(`  ✗ FAIL: ${message}`);
  }
}

async function resetCart(page) {
  await page.goto(BASE_URL, { waitUntil: 'networkidle0' });
  await page.evaluate(() => localStorage.removeItem('qt_cart'));
}

async function cartState(page) {
  return page.evaluate(() => {
    const items = JSON.parse(localStorage.getItem('qt_cart') || '[]');
    return {
      lines: items.length,
      count: items.reduce((n, i) => n + i.quantity, 0),
      subtotal: items.reduce((n, i) => n + i.lineTotal, 0),
    };
  });
}

async function badgeCount(page) {
  const label = await page.$eval(CART_BUTTON, (b) => b.getAttribute('aria-label'));
  return Number((label.match(/(\d+)/) || [0, 0])[1]);
}

const drawerOpen = (page) => page.$(DRAWER).then(Boolean);
const formatBdt = (n) => `৳${Math.round(n).toLocaleString('en-IN')}`;

async function clickIn(page, rootSelector, buttonSelector) {
  return page.evaluate((root, btn) => {
    const scope = root ? document.querySelector(root) : document;
    const el = scope && scope.querySelector(btn);
    if (!el || el.disabled) return false;
    el.click();
    return true;
  }, rootSelector, buttonSelector);
}

async function runViewport(browser, name, viewport, addButtonTestId) {
  console.log(`\n=== ${name} (${viewport.width}px) ===`);
  const page = await browser.newPage();
  await page.setViewport(viewport);
  await resetCart(page);

  // [1] Product page add-to-cart keeps the customer on the page.
  console.log('[1] Add to cart from product page');
  await page.goto(`${BASE_URL}/product/${PRODUCT_SLUG}`, { waitUntil: 'networkidle0' });
  const pdpMinusDisabled = await page.$eval('[data-testid="qty-decrease"]', (b) => b.disabled);
  check(pdpMinusDisabled, 'product page quantity picker cannot go below 1');

  const added = await clickIn(page, null, `[data-testid="${addButtonTestId}"]`);
  check(added, `"${addButtonTestId}" button found and clicked`);
  await sleep(600);
  check(!(await drawerOpen(page)), 'cart drawer did NOT open after adding');
  check(page.url().includes(`/product/${PRODUCT_SLUG}`), 'customer stays on the product page');
  let state = await cartState(page);
  check(state.count === 1, `cart has 1 item (got ${state.count})`);
  check((await badgeCount(page)) === 1, 'header cart badge shows 1');

  // [2] Product card quick-add on the shop page.
  console.log('[2] Add to cart from a product card (shop page)');
  await page.goto(`${BASE_URL}/shop`, { waitUntil: 'networkidle0' });
  const cardAdded = await page.evaluate((skipSlug) => {
    const buttons = Array.from(document.querySelectorAll('main button[aria-label]'))
      .filter((b) => /add to cart/i.test(b.getAttribute('aria-label')) && !b.disabled);
    // Pick a card for a different product so the cart has two separate lines.
    const btn = buttons.find((b) => {
      let el = b.parentElement;
      while (el && !el.querySelector('a[href*="/product/"]')) el = el.parentElement;
      const link = el && el.querySelector('a[href*="/product/"]');
      return link && !link.getAttribute('href').includes(skipSlug);
    });
    if (!btn) return false;
    btn.click();
    return true;
  }, PRODUCT_SLUG);
  check(cardAdded, 'product card add button found and clicked');
  await sleep(600);
  check(!(await drawerOpen(page)), 'cart drawer did NOT open after quick add');
  state = await cartState(page);
  check(state.count === 2 && state.lines === 2, `cart now has 2 lines / 2 units (got ${state.lines} / ${state.count})`);
  check((await badgeCount(page)) === 2, 'header cart badge shows 2');

  // [3] Drawer opens only from the cart icon; minus/plus work and totals update.
  console.log('[3] Cart drawer quantity controls');
  await page.click(CART_BUTTON);
  await sleep(400);
  check(await drawerOpen(page), 'drawer opens when the cart icon is clicked');

  const before = await cartState(page);
  await clickIn(page, DRAWER, '[data-testid="qty-increase"]');
  await sleep(300);
  let after = await cartState(page);
  check(after.count === before.count + 1, `plus increases count (${before.count} → ${after.count})`);
  let drawerText = await page.$eval(DRAWER, (d) => d.innerText);
  check(drawerText.includes(formatBdt(after.subtotal)), `drawer subtotal updated to ${formatBdt(after.subtotal)}`);
  check((await badgeCount(page)) === after.count, 'header badge follows the drawer count');

  await clickIn(page, DRAWER, '[data-testid="qty-decrease"]');
  await sleep(300);
  after = await cartState(page);
  check(after.count === before.count, `minus decreases count (back to ${after.count})`);

  // Step the first line down to quantity 1 (the shop card may have added the same product).
  const firstLineQty = () =>
    page.$eval(`${DRAWER} [role="group"][aria-label="Quantity selector"] [aria-live]`, (s) => Number(s.textContent.trim()));
  let steps = 0;
  while ((await firstLineQty()) > 1 && steps++ < 10) {
    await clickIn(page, DRAWER, '[data-testid="qty-decrease"]');
    await sleep(300);
  }
  check((await firstLineQty()) === 1, 'first cart line stepped down to quantity 1 with the minus button');

  // First line is at quantity 1 now: minus must be enabled and remove it.
  const firstMinus = await page.$eval(`${DRAWER} [data-testid="qty-decrease"]`, (b) => ({
    disabled: b.disabled,
    label: b.getAttribute('aria-label'),
  }));
  check(!firstMinus.disabled, 'minus button is enabled at quantity 1');
  check(firstMinus.label === 'Remove item', 'minus at quantity 1 is labelled "Remove item" for screen readers');
  const linesBefore = (await cartState(page)).lines;
  await clickIn(page, DRAWER, '[data-testid="qty-decrease"]');
  await sleep(400);
  after = await cartState(page);
  check(after.lines === linesBefore - 1, `minus at 1 removed the line (${linesBefore} → ${after.lines} lines)`);
  drawerText = await page.$eval(DRAWER, (d) => d.innerText);
  check(drawerText.includes(formatBdt(after.subtotal)), `drawer subtotal updated to ${formatBdt(after.subtotal)}`);
  const toastShown = await page.evaluate(() => document.body.innerText.includes('Item removed from your cart'));
  check(toastShown, '"Item removed" toast shown, same as the bin icon');

  // [4] Cart page: same behaviour, down to an empty cart.
  console.log('[4] Cart page quantity controls');
  await page.goto(`${BASE_URL}/cart`, { waitUntil: 'networkidle0' });
  let guard = 0;
  while ((await cartState(page)).lines > 0 && guard++ < 10) {
    const clicked = await clickIn(page, 'main', '[data-testid="qty-decrease"]');
    if (!clicked) break;
    await sleep(300);
  }
  after = await cartState(page);
  check(guard > 0, 'cart page had items to remove');
  check(after.lines === 0, 'minus on the cart page removes items until the cart is empty');
  check((await badgeCount(page)) === 0, 'header badge shows 0 after the cart is emptied');
  await page.click(CART_BUTTON);
  await sleep(400);
  const emptyDrawer = await page.$eval(DRAWER, (d) => !d.querySelector('[data-testid="qty-decrease"]'));
  check(emptyDrawer, 'empty cart drawer shows the empty state (no item rows)');

  await page.close();
}

async function run() {
  console.log('=== Issue #7 — Add to Cart & Quantity Decrement Regression Test ===');
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  try {
    await runViewport(browser, 'Desktop', { width: 1366, height: 768 }, 'add-to-cart-btn');
    await runViewport(browser, 'Mobile', { width: 375, height: 812, isMobile: true, hasTouch: true }, 'add-to-cart-mobile-btn');
  } finally {
    await browser.close();
  }
  if (failures > 0) {
    console.log(`\n✗ ${failures} check(s) failed`);
    process.exit(1);
  }
  console.log('\n✓ All Issue #7 checks passed');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
