// Test Store Settings REST API against live backend & MongoDB Atlas
const BASE_URL = process.env.VITE_API_URL || 'http://localhost:8080';

async function runTest() {
  console.log(`\n==================================================`);
  console.log(`[TEST] STORE SETTINGS REST API TEST`);
  console.log(`Target: ${BASE_URL}`);
  console.log(`==================================================\n`);

  // Step 1: Public GET /api/settings
  console.log(`[1] Testing GET /api/settings...`);
  const settingsRes = await fetch(`${BASE_URL}/api/settings`);
  if (!settingsRes.ok) throw new Error(`Settings GET failed: HTTP ${settingsRes.status}`);
  const settings = await settingsRes.json();
  console.log(`✔ Store settings retrieved from MongoDB Atlas:`);
  console.log(`   Store Name: "${settings.storeName}"`);
  console.log(`   Inside Dhaka Delivery: ৳${settings.deliveryChargeInsideDhaka}`);
  console.log(`   Outside Dhaka Delivery: ৳${settings.deliveryChargeOutsideDhaka}`);
  console.log(`   Support Phone: "${settings.phone}"`);

  // Step 2: Admin PUT /api/admin/settings
  console.log(`\n[2] Testing PUT /api/admin/settings...`);
  const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@quantumtech.com', password: 'admin123' }),
  });
  const { token } = await loginRes.json();

  const updateRes = await fetch(`${BASE_URL}/api/admin/settings`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      ...settings,
      tagline: 'Quality tech accessories at fair prices, delivered across Bangladesh (Live DB).',
    }),
  });
  if (!updateRes.ok) throw new Error(`Settings PUT failed: HTTP ${updateRes.status}`);
  const updated = await updateRes.json();
  console.log(`✔ Store settings updated in MongoDB Atlas! New tagline: "${updated.tagline}"`);

  console.log(`\n==================================================`);
  console.log(`🎉 ALL STORE SETTINGS REST API TESTS PASSED 100%!`);
  console.log(`==================================================\n`);
}

runTest().catch((err) => {
  console.error(`\n❌ TEST FAILED:`, err.message);
  process.exit(1);
});
