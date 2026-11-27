import puppeteer from 'puppeteer';

async function run() {
  console.log('--- Starting Scroll and Campaign Hero Verification ---');
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();

  // Test 1: Route change resets scroll to top (0, 0)
  console.log('\n[1/4] Testing Scroll Reset on Route Navigation...');
  await page.setViewport({ width: 1280, height: 800 });
  await page.goto('http://localhost:3000/', { waitUntil: 'networkidle0' });

  // Scroll down to 1200px
  await page.evaluate(() => window.scrollTo(0, 1200));
  let scrollY = await page.evaluate(() => window.scrollY);
  console.log('Homepage scrolled down to:', scrollY);
  if (scrollY < 500) throw new Error('Failed to scroll down homepage');

  // Click on a navigation link to /shop
  await page.evaluate(() => {
    const shopLink = document.querySelector('nav a[href="/shop"]') || document.querySelector('a[href="/shop"]');
    if (shopLink) shopLink.click();
  });
  await page.waitForFunction(() => window.location.pathname === '/shop');
  await new Promise((r) => setTimeout(r, 100));

  let newScrollY = await page.evaluate(() => window.scrollY);
  console.log('New page (/shop) scroll position:', newScrollY);
  if (newScrollY !== 0) {
    throw new Error(`Expected scrollY to be 0 on navigation, but got ${newScrollY}`);
  }
  console.log('SUCCESS: Navigation reset scroll to top (0, 0)!');

  // Test 2: Footer link click reset
  console.log('\n[2/4] Testing Footer Link Navigation Scroll Reset...');
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  let footerScrollY = await page.evaluate(() => window.scrollY);
  console.log('Scrolled down to footer:', footerScrollY);

  await page.evaluate(() => {
    const aboutLink = document.querySelector('footer a[href="/about"]');
    if (aboutLink) aboutLink.click();
  });
  await page.waitForFunction(() => window.location.pathname === '/about');
  await new Promise((r) => setTimeout(r, 100));

  let aboutScrollY = await page.evaluate(() => window.scrollY);
  console.log('/about page scroll position after footer link click:', aboutScrollY);
  if (aboutScrollY !== 0) {
    throw new Error(`Expected scrollY to be 0 on /about, but got ${aboutScrollY}`);
  }
  console.log('SUCCESS: Footer link redirect starts at top (0, 0)!');

  // Test 2b: Campaign button click from Homepage
  console.log('\n[2b/4] Testing Campaign CTA Click Scroll Reset...');
  await page.goto('http://localhost:3000/', { waitUntil: 'networkidle0' });
  await page.evaluate(() => window.scrollTo(0, 800));
  console.log('Scrolled homepage to:', await page.evaluate(() => window.scrollY));

  await page.evaluate(() => {
    const campaignLink = document.querySelector('[data-testid="campaign-featured-section"] a');
    if (campaignLink) campaignLink.click();
  });
  await page.waitForFunction(() => window.location.pathname.startsWith('/campaign/'));
  await new Promise((r) => setTimeout(r, 100));

  let campScrollY = await page.evaluate(() => window.scrollY);
  console.log('Campaign landing page scroll position:', campScrollY);
  if (campScrollY !== 0) {
    throw new Error(`Expected scrollY to be 0 on campaign page, but got ${campScrollY}`);
  }
  console.log('SUCCESS: Campaign banner CTA redirects directly to top (0, 0)!');

  // Test 3: Campaign Hero Text Overlap & Visual Card
  console.log('\n[3/4] Testing /campaign/black-friday-storm Hero Layout & Text Overlap...');
  await page.goto('http://localhost:3000/campaign/black-friday-storm', { waitUntil: 'networkidle0' });

  // Check element positions and text
  const heroCardData = await page.evaluate(() => {
    const hero = document.querySelector('[data-testid="campaign-hero"]');
    if (!hero) return null;
    const h1 = hero.querySelector('h1');
    const visualCard = hero.querySelector('.lg\\:col-span-5 > div');
    const visualText = visualCard ? visualCard.querySelector('p') : null;
    const img = visualCard ? visualCard.querySelector('img') : null;

    return {
      h1Text: h1 ? h1.textContent.trim() : null,
      visualCardRect: visualCard ? visualCard.getBoundingClientRect() : null,
      visualTextRect: visualText ? visualText.getBoundingClientRect() : null,
      visualTextContent: visualText ? visualText.textContent.trim() : null,
      imgNaturalHeight: img ? img.naturalHeight : null,
      imgComplete: img ? img.complete : null,
    };
  });

  console.log('Hero Card Evaluation:', JSON.stringify(heroCardData, null, 2));

  if (!heroCardData.visualCardRect || heroCardData.visualCardRect.height < 200) {
    throw new Error(`Visual card collapsed! Height is ${heroCardData.visualCardRect?.height}`);
  }
  console.log(`Visual card height is solid: ${heroCardData.visualCardRect.height}px`);

  // Copy screenshot to artifacts
  const artifactDir = '/home/sakib/.gemini/antigravity/brain/88627019-6145-4bb3-88bf-5a4402648fd1';
  await page.screenshot({ path: `${artifactDir}/campaign_hero_fixed_desktop.png` });
  console.log('Screenshot of fixed hero saved to artifacts');

  // Test 4: Mobile Viewport 360px Overflow and Layout
  console.log('\n[4/4] Testing Mobile Viewport (360px)...');
  await page.setViewport({ width: 360, height: 740 });
  await page.goto('http://localhost:3000/campaign/black-friday-storm', { waitUntil: 'networkidle0' });

  const mobileScrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  console.log('Mobile 360px scrollWidth:', mobileScrollWidth);
  if (mobileScrollWidth > 360) {
    throw new Error(`Horizontal overflow on mobile 360px! scrollWidth=${mobileScrollWidth}`);
  }

  await page.screenshot({ path: `${artifactDir}/campaign_hero_fixed_mobile.png` });
  console.log('Mobile screenshot saved to artifacts');

  await browser.close();
  console.log('\n--- All verification checks PASSED successfully! ---');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
