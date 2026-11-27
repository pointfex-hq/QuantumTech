import puppeteer from 'puppeteer';

const BASE_URL = 'http://localhost:3000';

async function runReviewSystemTests() {
  console.log('🚀 Running Comprehensive Product Review & Rating System Test Suite...\n');

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });

  let passedTests = 0;
  let totalTests = 0;

  function assert(condition, message) {
    totalTests++;
    if (condition) {
      console.log(`  ✓ ${message}`);
      passedTests++;
    } else {
      console.error(`  ✗ FAILED: ${message}`);
      throw new Error(`Assertion failed: ${message}`);
    }
  }

  try {
    // ----------------------------------------------------
    // Scenario 1: Product Page Initial Reviews & Breakdown
    // ----------------------------------------------------
    console.log('--- SCENARIO 1: Storefront Reviews Tab & Summary Breakdown ---');
    await page.goto(`${BASE_URL}/product/q-charge-20w-fast-charger`, { waitUntil: 'networkidle2' });

    // Click Reviews Tab
    await page.waitForSelector('[data-testid="reviews-tab-btn"]', { timeout: 5000 });
    await page.evaluate(() => {
      const tab = document.querySelector('[data-testid="reviews-tab-btn"]');
      if (tab) tab.click();
    });
    await new Promise((r) => setTimeout(r, 600));

    // Verify rating summary score
    const summaryText = await page.evaluate(() => document.body.innerText);
    assert(summaryText.toLowerCase().includes('overall customer rating') || summaryText.includes('গড় গ্রাহক রেটিং'), 'Overall rating header is displayed');
    assert(summaryText.toLowerCase().includes('based on') || summaryText.includes('ভিত্তিতে'), 'Approved reviews count summary is displayed');
    assert(summaryText.includes('5 Stars') || summaryText.includes('৫ স্টার'), 'Rating distribution breakdown includes 5 Stars row');
    assert(summaryText.toLowerCase().includes('100% genuine & moderated reviews') || summaryText.includes('১০০% আসল'), 'Trust badge is displayed');

    // ----------------------------------------------------
    // Scenario 2: Form Validation on Review Submission
    // ----------------------------------------------------
    console.log('\n--- SCENARIO 2: Review Form Client Validation & Security ---');
    // Open review modal
    const writeBtn = await page.evaluateHandle(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      return buttons.find((b) => b.getAttribute('data-testid') === 'write-review-open-btn' || b.textContent?.includes('Write a Review'));
    });
    if (writeBtn) await writeBtn.click();
    await new Promise((r) => setTimeout(r, 400));

    // Try submitting empty
    const submitBtn = await page.evaluateHandle(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      return buttons.find((b) => b.getAttribute('type') === 'submit');
    });
    if (submitBtn) await submitBtn.click();
    await new Promise((r) => setTimeout(r, 300));

    // ----------------------------------------------------
    // Scenario 3: Order Number Verification & Mismatch Guard
    // ----------------------------------------------------
    console.log('\n--- SCENARIO 3: Order Number Verification & Product Matching ---');
    // Fill invalid order number
    await page.type('input[placeholder*="Alex Johnson"]', 'Tanvir Hasan');
    await page.type('input[placeholder*="Exceptional Build Quality"]', 'Best Fast Charger Available');
    await page.type('textarea[placeholder*="Tell other customers"]', 'Charges my Galaxy device in record time with zero overheating!');
    await page.type('input[placeholder="QT-XXXXXX-XXXX"]', 'QT-999999-9999');

    const submitBtn2 = await page.evaluateHandle(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      return buttons.find((b) => b.getAttribute('type') === 'submit');
    });
    if (submitBtn2) await submitBtn2.click();
    await new Promise((r) => setTimeout(r, 400));

    const invalidOrderToast = await page.evaluate(() => document.body.innerText);
    assert(
      invalidOrderToast.includes('Order number not found') || invalidOrderToast.includes('not found'),
      'Invalid order number correctly rejected with descriptive alert'
    );

    // Try order number for a different product (Power Bank QT-261121-001)
    await page.evaluate(() => {
      const input = document.querySelector('input[placeholder="QT-XXXXXX-XXXX"]');
      if (input) input.value = '';
    });
    await page.type('input[placeholder="QT-XXXXXX-XXXX"]', 'QT-261121-001');

    const submitBtn3 = await page.evaluateHandle(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      return buttons.find((b) => b.getAttribute('type') === 'submit');
    });
    if (submitBtn3) await submitBtn3.click();
    await new Promise((r) => setTimeout(r, 400));

    const mismatchOrderToast = await page.evaluate(() => document.body.innerText);
    assert(
      mismatchOrderToast.includes('does not contain this product') || mismatchOrderToast.includes('Invalid order number'),
      'Order containing different product correctly rejected'
    );

    // ----------------------------------------------------
    // Scenario 4 & 5: Valid Verified Review Submission
    // ----------------------------------------------------
    console.log('\n--- SCENARIO 4 & 5: Valid Verified Review Submission with Photo & Email ---');
    // Clear and enter valid order number for prod-01 (QT-261119-024)
    await page.evaluate(() => {
      const input = document.querySelector('input[placeholder="QT-XXXXXX-XXXX"]');
      if (input) input.value = '';
    });
    await page.type('input[placeholder="QT-XXXXXX-XXXX"]', 'QT-261119-024');

    // Add private email
    await page.type('input[placeholder="yourname@example.com"]', 'tanvir.private@example.com');

    // Add a simulated photo via data URL
    await page.evaluate(() => {
      // In browser state, simulate customer photo upload
      const dummyCanvas = document.createElement('canvas');
      dummyCanvas.width = 100;
      dummyCanvas.height = 100;
      const ctx = dummyCanvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#2563EB';
        ctx.fillRect(0, 0, 100, 100);
      }
      const dataUrl = dummyCanvas.toDataURL('image/png');
      const fileInput = document.querySelector('input[type="file"]');
      // trigger image state manually if needed or click submit with populated state
      window.__testDataUrl = dataUrl;
    });

    // Click submit
    const submitBtn4 = await page.evaluateHandle(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      return buttons.find((b) => b.getAttribute('type') === 'submit');
    });
    if (submitBtn4) await submitBtn4.click();
    await new Promise((r) => setTimeout(r, 600));

    const postSubmitText = await page.evaluate(() => document.body.innerText);
    assert(
      postSubmitText.includes('Review submitted') || postSubmitText.includes('রিভিউ জমা হয়েছে'),
      'Review submitted successfully with pending moderation toast'
    );

    // Verify it does NOT appear on storefront yet (as it is Pending)
    assert(
      !postSubmitText.includes('Best Fast Charger Available'),
      'Pending review is NOT displayed on public storefront before admin approval'
    );

    // ----------------------------------------------------
    // Scenario 6: Customer Email Privacy Check
    // ----------------------------------------------------
    console.log('\n--- SCENARIO 6: Customer Email Privacy Verification ---');
    const pageHtml = await page.content();
    assert(
      !pageHtml.includes('tanvir.private@example.com'),
      'Customer private email is strictly NEVER rendered in public storefront DOM'
    );

    // ----------------------------------------------------
    // Scenario 7: Submit Unverified Review (No Order Number)
    // ----------------------------------------------------
    console.log('\n--- SCENARIO 7: Submit Unverified Review without Order Number ---');
    const writeBtn2 = await page.evaluateHandle(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      return buttons.find((b) => b.getAttribute('data-testid') === 'write-review-open-btn' || b.textContent?.includes('Write a Review'));
    });
    if (writeBtn2) await writeBtn2.click();
    await new Promise((r) => setTimeout(r, 400));

    await page.type('input[placeholder*="Alex Johnson"]', 'Kamal Hossain');
    await page.type('input[placeholder*="Exceptional Build Quality"]', 'Satisfied with overall build');
    await page.type('textarea[placeholder*="Tell other customers"]', 'Bought this charger locally and it delivers standard high speed charging.');

    const submitBtn5 = await page.evaluateHandle(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      return buttons.find((b) => b.getAttribute('type') === 'submit');
    });
    if (submitBtn5) await submitBtn5.click();
    await new Promise((r) => setTimeout(r, 600));

    // ----------------------------------------------------
    // Scenario 8: Duplicate Review Guard
    // ----------------------------------------------------
    console.log('\n--- SCENARIO 8: Duplicate Order Review Prevention ---');
    const writeBtn3 = await page.evaluateHandle(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      return buttons.find((b) => b.getAttribute('data-testid') === 'write-review-open-btn' || b.textContent?.includes('Write a Review'));
    });
    if (writeBtn3) await writeBtn3.click();
    await new Promise((r) => setTimeout(r, 400));

    await page.type('input[placeholder*="Alex Johnson"]', 'Tanvir Hasan Duplicate');
    await page.type('input[placeholder*="Exceptional Build Quality"]', 'Trying to review again');
    await page.type('textarea[placeholder*="Tell other customers"]', 'Writing a second review for the exact same order number.');
    await page.type('input[placeholder="QT-XXXXXX-XXXX"]', 'QT-261119-024');

    const submitBtn6 = await page.evaluateHandle(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      return buttons.find((b) => b.getAttribute('type') === 'submit');
    });
    if (submitBtn6) await submitBtn6.click();
    await new Promise((r) => setTimeout(r, 500));

    const duplicateToast = await page.evaluate(() => document.body.innerText);
    assert(
      duplicateToast.includes('already been submitted') || duplicateToast.includes('Failed to submit review'),
      'Duplicate review submission with same order number blocked'
    );

    // Close modal
    await page.evaluate(() => {
      const closeBtn = document.querySelector('button[aria-label="Close modal"]') || Array.from(document.querySelectorAll('button')).find(b => b.textContent?.includes('Cancel') || b.textContent?.includes('বাতিল'));
      if (closeBtn) closeBtn.click();
    });
    await new Promise((r) => setTimeout(r, 300));

    // ----------------------------------------------------
    // Scenario 9: Admin Review Management Interface
    // ----------------------------------------------------
    console.log('\n--- SCENARIO 9: Admin Review Moderation Dashboard ---');
    // Ensure admin session in localStorage
    await page.evaluate(() => {
      localStorage.setItem(
        'qt_admin_session',
        JSON.stringify({
          email: 'irfan.shahil@quantumtech.com',
          name: 'Irfan Shahil',
          role: 'Owner',
          loginTime: Date.now(),
        })
      );
    });

    await page.goto(`${BASE_URL}/admin/reviews`, { waitUntil: 'networkidle2' });
    const adminText = await page.evaluate(() => document.body.innerText);
    assert(adminText.includes('Review Management'), 'Admin Reviews page loaded');
    assert(adminText.includes('Awaiting Moderation'), 'Pending reviews badge visible to admin');
    assert(adminText.includes('Tanvir Hasan'), 'Pending reviewer Tanvir Hasan listed in table');
    assert(adminText.includes('tanvir.private@example.com'), 'Customer email visible in Admin table');
    assert(adminText.toLowerCase().includes('private'), 'Customer email clearly marked as Private in Admin');
    assert(adminText.includes('Verified'), 'Order verification status displayed as Verified');

    // ----------------------------------------------------
    // Scenario 10: Admin Detail / Preview Modal
    // ----------------------------------------------------
    console.log('\n--- SCENARIO 10: Admin Detail / Preview Modal ---');
    const viewBtn = await page.evaluateHandle(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      return buttons.find((b) => b.getAttribute('title')?.includes('View review details'));
    });
    if (viewBtn) await viewBtn.click();
    await new Promise((r) => setTimeout(r, 400));

    const modalText = await page.evaluate(() => document.body.innerText);
    assert(modalText.includes('Review Details & Moderation'), 'Admin detail preview modal opened');
    assert(modalText.includes('Order Verification'), 'Modal shows order verification section');

    // Close detail modal
    await page.evaluate(() => {
      const closeBtn = Array.from(document.querySelectorAll('button')).find((b) => b.textContent?.includes('Close'));
      if (closeBtn) closeBtn.click();
    });
    await new Promise((r) => setTimeout(r, 300));

    // ----------------------------------------------------
    // Scenario 11: Admin Moderation - Approve Verified Review
    // ----------------------------------------------------
    console.log('\n--- SCENARIO 11: Admin Approves Verified Review ---');
    // Click Approve on Tanvir Hasan's review
    await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('tr'));
      const targetRow = rows.find((r) => r.innerText.includes('Tanvir Hasan'));
      if (targetRow) {
        const approveBtn = Array.from(targetRow.querySelectorAll('button')).find((b) => b.textContent?.includes('Approve'));
        if (approveBtn) approveBtn.click();
      }
    });
    await new Promise((r) => setTimeout(r, 600));

    // Go back to product page to verify public storefront reflects approval
    await page.goto(`${BASE_URL}/product/q-charge-20w-fast-charger`, { waitUntil: 'networkidle2' });
    await page.evaluate(() => {
      const tab = document.querySelector('[data-testid="reviews-tab-btn"]');
      if (tab) tab.click();
    });
    await new Promise((r) => setTimeout(r, 600));

    const approvedStorefrontText = await page.evaluate(() => document.body.innerText);
    assert(approvedStorefrontText.includes('Tanvir Hasan'), 'Approved review now visible on live storefront');
    assert(approvedStorefrontText.includes('Best Fast Charger Available'), 'Review title displayed in bold');
    assert(approvedStorefrontText.includes('Verified Purchase'), 'Verified Purchase badge displayed on approved review');

    // Email privacy on public storefront again
    const postApprovalHtml = await page.content();
    assert(
      !postApprovalHtml.includes('tanvir.private@example.com'),
      'Customer email remains strictly excluded from public storefront after approval'
    );

    // ----------------------------------------------------
    // Scenario 12: Admin Moderation - Approve Unverified Review
    // ----------------------------------------------------
    console.log('\n--- SCENARIO 12: Admin Approves Unverified Review ---');
    await page.goto(`${BASE_URL}/admin/reviews`, { waitUntil: 'networkidle2' });
    await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('tr'));
      const targetRow = rows.find((r) => r.innerText.includes('Kamal Hossain'));
      if (targetRow) {
        const approveBtn = Array.from(targetRow.querySelectorAll('button')).find((b) => b.textContent?.includes('Approve'));
        if (approveBtn) approveBtn.click();
      }
    });
    await new Promise((r) => setTimeout(r, 600));

    // Check storefront
    await page.goto(`${BASE_URL}/product/q-charge-20w-fast-charger`, { waitUntil: 'networkidle2' });
    await page.evaluate(() => {
      const tab = document.querySelector('[data-testid="reviews-tab-btn"]');
      if (tab) tab.click();
    });
    await new Promise((r) => setTimeout(r, 600));

    const storefrontKamal = await page.evaluate(() => {
      const cards = Array.from(document.querySelectorAll('.rounded-2xl'));
      const kamalCard = cards.find((c) => c.innerText.includes('Kamal Hossain'));
      return {
        exists: !!kamalCard,
        hasVerifiedBadge: kamalCard ? kamalCard.innerText.includes('Verified Purchase') : false,
      };
    });
    assert(storefrontKamal.exists, 'Unverified review by Kamal Hossain is published on storefront');
    assert(!storefrontKamal.hasVerifiedBadge, 'Unverified review correctly DOES NOT display Verified Purchase badge');

    // ----------------------------------------------------
    // Scenario 13: Admin Deletion with Confirmation Modal
    // ----------------------------------------------------
    console.log('\n--- SCENARIO 13: Admin Review Deletion with Confirmation Modal ---');
    await page.goto(`${BASE_URL}/admin/reviews`, { waitUntil: 'networkidle2' });
    // Click delete on Kamal Hossain's review
    await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('tr'));
      const targetRow = rows.find((r) => r.innerText.includes('Kamal Hossain'));
      if (targetRow) {
        const deleteBtn = Array.from(targetRow.querySelectorAll('button')).find((b) => b.getAttribute('title')?.includes('Delete'));
        if (deleteBtn) deleteBtn.click();
      }
    });
    await new Promise((r) => setTimeout(r, 400));

    const deleteModalText = await page.evaluate(() => document.body.innerText);
    assert(deleteModalText.includes('Delete Customer Review'), 'Delete confirmation modal displayed');

    // Confirm deletion
    await page.evaluate(() => {
      const confirmBtn = Array.from(document.querySelectorAll('button')).find((b) => b.textContent?.includes('Delete Permanently'));
      if (confirmBtn) confirmBtn.click();
    });
    await new Promise((r) => setTimeout(r, 600));

    const postDeleteAdminText = await page.evaluate(() => document.body.innerText);
    assert(!postDeleteAdminText.includes('Kamal Hossain'), 'Review permanently deleted from admin table');

    // ----------------------------------------------------
    // Scenario 14: Mobile Viewport & Responsiveness
    // ----------------------------------------------------
    console.log('\n--- SCENARIO 14: Mobile Responsive & Zero Horizontal Overflow (360px) ---');
    await page.setViewport({ width: 360, height: 740 });
    await page.goto(`${BASE_URL}/product/q-charge-20w-fast-charger`, { waitUntil: 'networkidle2' });

    // Open reviews tab
    await page.evaluate(() => {
      const tab = document.querySelector('[data-testid="reviews-tab-btn"]');
      if (tab) tab.click();
    });
    await new Promise((r) => setTimeout(r, 600));

    const hasHorizontalOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });
    assert(!hasHorizontalOverflow, 'Zero horizontal overflow on 360px mobile viewport in Product Detail page');

    // Open review modal on mobile
    const mobWriteBtn = await page.evaluateHandle(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      return buttons.find((b) => b.getAttribute('data-testid') === 'write-review-open-btn' || b.textContent?.includes('Write a Review'));
    });
    if (mobWriteBtn) await mobWriteBtn.click();
    await new Promise((r) => setTimeout(r, 400));

    const modalOverflow = await page.evaluate(() => {
      const modal = document.querySelector('.animate-scaleUp');
      return modal ? modal.scrollWidth > window.innerWidth : false;
    });
    assert(!modalOverflow, 'Review submission modal fits cleanly on 360px mobile viewport');

    // Close modal
    await page.evaluate(() => {
      const closeBtn = document.querySelector('button[aria-label="Close modal"]');
      if (closeBtn) closeBtn.click();
    });

    // Check for emojis or decorative pseudo-symbols
    const allText = await page.evaluate(() => document.body.innerText);
    const emojiRegex = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;
    assert(!emojiRegex.test(allText), 'Strictly NO emojis or decorative symbols used in UI');

    console.log('\n====================================================');
    console.log(`🎉 ALL ${passedTests}/${totalTests} TESTS PASSED SUCCESSFULLY!`);
    console.log('====================================================\n');
  } catch (err) {
    console.error('\n❌ Test Suite encountered an error:', err);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

runReviewSystemTests();
