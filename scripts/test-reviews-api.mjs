// Test Reviews REST API & Moderation Workflow against live backend
const BASE_URL = process.env.VITE_API_URL || 'http://localhost:8080';

async function runTest() {
  console.log(`\n==================================================`);
  console.log(`[TEST] REVIEWS REST API & MODERATION TEST`);
  console.log(`Target: ${BASE_URL}`);
  console.log(`==================================================\n`);

  // Step 1: Submit a customer review
  console.log(`[1] Testing POST /api/reviews (Customer submits review)...`);
  const reviewPayload = {
    productId: 'prod-01',
    productName: 'Q-Charge 20W Fast Charger',
    reviewerName: 'Sakib Reviewer',
    customerEmail: 'sakib.reviewer@example.com',
    rating: 5,
    title: 'Outstanding quality and fast charging!',
    comment: 'Charging speed is very impressive, charges my device quickly without heating up.',
    images: [],
  };

  const submitRes = await fetch(`${BASE_URL}/api/reviews`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(reviewPayload),
  });

  if (!submitRes.ok) {
    const err = await submitRes.text();
    throw new Error(`Review submission failed: HTTP ${submitRes.status} - ${err}`);
  }

  const submitted = await submitRes.json();
  console.log(`✔ Review submitted successfully! ID: ${submitted.id}`);
  console.log(`   Initial status: "${submitted.status}" (Should be Pending)`);

  // Step 2: Verify pending review is NOT public
  console.log(`\n[2] Verifying pending review is hidden from public storefront...`);
  const publicRes = await fetch(`${BASE_URL}/api/reviews?productId=prod-01`);
  const publicReviews = await publicRes.json();
  const isFoundPublicly = publicReviews.some((r) => r.id === submitted.id);
  console.log(`✔ Pending review in public list: ${isFoundPublicly} (Expected: false)`);
  if (isFoundPublicly) throw new Error(`Pending review must not be public!`);

  // Step 3: Admin Moderation (Approve)
  console.log(`\n[3] Admin approves review in MongoDB Atlas...`);
  const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@quantumtech.com', password: 'admin123' }),
  });
  const { token } = await loginRes.json();

  const approveRes = await fetch(`${BASE_URL}/api/admin/reviews/${submitted.id}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ status: 'Approved' }),
  });

  if (!approveRes.ok) throw new Error(`Moderation failed: HTTP ${approveRes.status}`);
  const approved = await approveRes.json();
  console.log(`✔ Review status updated to: "${approved.status}"`);

  // Step 4: Verify approved review is now visible publicly
  console.log(`\n[4] Verifying approved review is now visible on storefront...`);
  const publicAfterRes = await fetch(`${BASE_URL}/api/reviews?productId=prod-01`);
  const publicAfterReviews = await publicAfterRes.json();
  const isNowPublic = publicAfterReviews.some((r) => r.id === submitted.id);
  console.log(`✔ Approved review in public list: ${isNowPublic} (Expected: true)`);
  if (!isNowPublic) throw new Error(`Approved review should now be visible publicly!`);

  // Step 5: Clean up (Delete test review)
  console.log(`\n[5] Cleaning up test review (DELETE /api/admin/reviews/:id)...`);
  const deleteRes = await fetch(`${BASE_URL}/api/admin/reviews/${submitted.id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (deleteRes.status === 204 || deleteRes.ok) {
    console.log(`✔ Test review deleted successfully (HTTP ${deleteRes.status}).`);
  }

  console.log(`\n==================================================`);
  console.log(`🎉 ALL REVIEWS REST API TESTS PASSED 100%!`);
  console.log(`==================================================\n`);
}

runTest().catch((err) => {
  console.error(`\n❌ TEST FAILED:`, err.message);
  process.exit(1);
});
