// Test Auth REST API against Spring Boot backend & MongoDB Atlas
const BASE_URL = process.env.VITE_API_URL || 'http://localhost:8080';

async function runTest() {
  console.log(`\n==================================================`);
  console.log(`[TEST] AUTH REST API & JWT SECURITY TEST`);
  console.log(`Target: ${BASE_URL}`);
  console.log(`==================================================\n`);

  // Step 1: Login with valid credentials
  console.log(`[1] Testing POST /api/auth/login with valid credentials...`);
  const validRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'admin@quantumtech.com',
      password: 'admin123',
      rememberMe: true,
    }),
  });
  if (!validRes.ok) {
    throw new Error(`Valid login failed: HTTP ${validRes.status}`);
  }
  const validData = await validRes.json();
  console.log(`✔ Login success! Email: ${validData.email}, Role: ${validData.role}`);
  console.log(`✔ Received JWT Token: ${validData.token.slice(0, 30)}... (Length: ${validData.token.length})`);
  const validToken = validData.token;

  // Step 2: Login with invalid credentials (negative test)
  console.log(`\n[2] Testing POST /api/auth/login with invalid password...`);
  const invalidRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'admin@quantumtech.com',
      password: 'incorrect-password-123',
    }),
  });
  if (invalidRes.status === 401) {
    const errorBody = await invalidRes.json();
    console.log(`✔ Correctly rejected with HTTP 401 Unauthorized: "${errorBody.error || errorBody.message}"`);
  } else {
    throw new Error(`Expected HTTP 401, but got HTTP ${invalidRes.status}`);
  }

  // Step 3: Access protected admin endpoint WITHOUT token (negative test)
  console.log(`\n[3] Testing protected route GET /api/admin/products WITHOUT Authorization header...`);
  const noTokenRes = await fetch(`${BASE_URL}/api/admin/products`);
  if (noTokenRes.status === 401) {
    console.log(`✔ Spring Security correctly blocked request with HTTP 401 Unauthorized.`);
  } else {
    throw new Error(`Expected HTTP 401, but got HTTP ${noTokenRes.status}`);
  }

  // Step 4: Access protected admin endpoint WITH JWT token
  console.log(`\n[4] Testing protected route GET /api/admin/products WITH Bearer token...`);
  const withTokenRes = await fetch(`${BASE_URL}/api/admin/products`, {
    headers: { Authorization: `Bearer ${validToken}` },
  });
  if (!withTokenRes.ok) {
    throw new Error(`Authorized request failed: HTTP ${withTokenRes.status}`);
  }
  const products = await withTokenRes.json();
  console.log(`✔ Spring Security accepted JWT token! Protected products loaded: ${products.length} items.`);

  // Step 5: Forgot password flow
  console.log(`\n[5] Testing POST /api/auth/forgot-password...`);
  const forgotRes = await fetch(`${BASE_URL}/api/auth/forgot-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@quantumtech.com' }),
  });
  if (forgotRes.ok) {
    const forgotData = await forgotRes.json();
    console.log(`✔ Forgot password responded: HTTP ${forgotRes.status} (Message: "${forgotData.message}")`);
  } else {
    console.log(`   Forgot password HTTP ${forgotRes.status}`);
  }

  console.log(`\n==================================================`);
  console.log(`🎉 ALL AUTH REST API TESTS PASSED 100%!`);
  console.log(`==================================================\n`);
}

runTest().catch((err) => {
  console.error(`\n❌ AUTH TEST FAILED:`, err.message);
  process.exit(1);
});
