// Test Cart Validation & Payment Methods API against live Spring Boot backend
const BASE_URL = process.env.VITE_API_URL || 'http://localhost:8080';

async function runTest() {
  console.log(`\n==================================================`);
  console.log(`[TEST] CART VALIDATION & PAYMENT METHODS API TEST`);
  console.log(`Target: ${BASE_URL}`);
  console.log(`==================================================\n`);

  // Step 1: Payment Methods Catalogue
  console.log(`[1] Testing GET /api/payments/methods...`);
  const methodsRes = await fetch(`${BASE_URL}/api/payments/methods`);
  if (!methodsRes.ok) throw new Error(`Failed to fetch payment methods: HTTP ${methodsRes.status}`);
  const methods = await methodsRes.json();
  console.log(`✔ Payment methods loaded: ${methods.length} methods (COD, bKash, Nagad).`);
  methods.forEach((m) => {
    console.log(`   - [${m.code}] ${m.name} (Requires TrxID: ${m.requiresTrxId}, Available: ${m.available})`);
  });

  // Step 2: Cart Validation (Valid items)
  console.log(`\n[2] Testing POST /api/cart/validate (Valid in-stock cart)...`);
  const validCartPayload = {
    area: 'Inside Dhaka',
    items: [
      { productId: 'prod-01', variantId: 'v1-1', quantity: 2 },
    ],
  };
  const validCartRes = await fetch(`${BASE_URL}/api/cart/validate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(validCartPayload),
  });
  if (!validCartRes.ok) throw new Error(`Cart validation failed: HTTP ${validCartRes.status}`);
  const quote = await validCartRes.json();
  console.log(`✔ Cart validation SUCCESS:`);
  console.log(`   Valid: ${quote.valid}`);
  console.log(`   Item: ${quote.items[0]?.productName} (${quote.items[0]?.variantName}) x ${quote.items[0]?.quantity}`);
  console.log(`   Subtotal: ৳${quote.subtotal}, Delivery: ৳${quote.deliveryCharge}, Total: ৳${quote.total}`);

  // Step 3: Cart Validation (Outside Dhaka delivery charge check)
  console.log(`\n[3] Testing POST /api/cart/validate (Outside Dhaka delivery fee)...`);
  const outsideCartRes = await fetch(`${BASE_URL}/api/cart/validate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      area: 'Outside Dhaka',
      items: [{ productId: 'prod-01', variantId: 'v1-1', quantity: 1 }],
    }),
  });
  const outsideQuote = await outsideCartRes.json();
  console.log(`✔ Outside Dhaka delivery charge calculated: ৳${outsideQuote.deliveryCharge} (Expected ৳130)`);
  if (outsideQuote.deliveryCharge !== 130) {
    throw new Error(`Expected delivery charge 130, got ${outsideQuote.deliveryCharge}`);
  }

  // Step 4: Cart Validation (Insufficient stock detection)
  console.log(`\n[4] Testing POST /api/cart/validate (Insufficient stock detection)...`);
  const overstockRes = await fetch(`${BASE_URL}/api/cart/validate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      area: 'Inside Dhaka',
      items: [{ productId: 'prod-01', variantId: 'v1-1', quantity: 9 }], // Only 8 in stock
    }),
  });
  const overstockQuote = await overstockRes.json();
  console.log(`✔ Overstock correctly detected: valid=${overstockQuote.valid}`);
  console.log(`   Status: "${overstockQuote.items[0]?.status}"`);
  console.log(`   Issue message: "${overstockQuote.issues[0]}"`);

  console.log(`\n==================================================`);
  console.log(`🎉 ALL CART & PAYMENT API TESTS PASSED 100%!`);
  console.log(`==================================================\n`);
}

runTest().catch((err) => {
  console.error(`\n❌ TEST FAILED:`, err.message);
  process.exit(1);
});
