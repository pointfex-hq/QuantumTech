// Test Checkout & Orders REST API against Spring Boot backend & MongoDB Atlas
const BASE_URL = process.env.VITE_API_URL || 'http://localhost:8080';

async function runTest() {
  console.log(`\n==================================================`);
  console.log(`[TEST] CHECKOUT & ORDERS REST API TEST`);
  console.log(`Target: ${BASE_URL}`);
  console.log(`==================================================\n`);

  // Step 1: Check initial stock of target product & variant
  console.log(`[1] Fetching product stock before checkout...`);
  const prodRes = await fetch(`${BASE_URL}/api/products/prod-01`);
  if (!prodRes.ok) throw new Error(`Product fetch failed`);
  const prodBefore = await prodRes.json();
  const variantBefore = prodBefore.variants.find((v) => v.id === 'v1-1');
  const initialStock = variantBefore.stock;
  console.log(`✔ Product: "${prodBefore.name}" (${variantBefore.value}) - Stock before: ${initialStock}`);

  // Step 2: Guest Checkout (COD)
  console.log(`\n[2] Testing POST /api/orders (Guest Checkout - Cash on Delivery)...`);
  const idempotencyKey = `test-order-${Date.now()}`;
  const checkoutPayload = {
    customerName: 'Test Customer',
    phone: '01712345678',
    area: 'Inside Dhaka',
    address: 'House 42, Road 11, Dhanmondi, Dhaka',
    note: 'Please deliver after 3 PM',
    paymentMethod: 'COD',
    language: 'en',
    items: [
      { productId: 'prod-01', variantId: 'v1-1', quantity: 2 },
    ],
  };

  const orderRes = await fetch(`${BASE_URL}/api/orders`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Idempotency-Key': idempotencyKey,
    },
    body: JSON.stringify(checkoutPayload),
  });

  if (!orderRes.ok) {
    const errText = await orderRes.text();
    throw new Error(`Order creation failed: HTTP ${orderRes.status} - ${errText}`);
  }

  const order = await orderRes.json();
  console.log(`✔ Order placed successfully! HTTP 201 Created`);
  console.log(`   Order Number: ${order.orderNumber}`);
  console.log(`   Status: ${order.status}`);
  console.log(`   Payment Method: ${order.paymentMethod} (${order.paymentStatus})`);
  console.log(`   Subtotal: ৳${order.subtotal}, Delivery: ৳${order.deliveryCharge}, Total: ৳${order.total}`);

  // Step 3: Verify atomic stock reservation
  console.log(`\n[3] Verifying atomic stock reduction in MongoDB Atlas...`);
  const prodAfterRes = await fetch(`${BASE_URL}/api/products/prod-01`);
  const prodAfter = await prodAfterRes.json();
  const variantAfter = prodAfter.variants.find((v) => v.id === 'v1-1');
  console.log(`✔ Variant stock after ordering 2 units: ${variantAfter.stock} (Was: ${initialStock})`);
  if (variantAfter.stock !== initialStock - 2) {
    throw new Error(`Expected stock ${initialStock - 2}, but got ${variantAfter.stock}`);
  }

  // Step 4: Track Order
  console.log(`\n[4] Testing GET /api/orders/track?orderNumber=${order.orderNumber}&phone=01712345678...`);
  const trackRes = await fetch(
    `${BASE_URL}/api/orders/track?orderNumber=${encodeURIComponent(order.orderNumber)}&phone=01712345678`
  );
  if (!trackRes.ok) {
    throw new Error(`Order tracking failed: HTTP ${trackRes.status}`);
  }
  const tracked = await trackRes.json();
  console.log(`✔ Order tracking successful! Current status: "${tracked.status}"`);
  console.log(`   Customer address: "${tracked.address}"`);
  console.log(`   Timeline events: ${tracked.timeline?.length || 0} event(s) recorded.`);

  // Step 5: Admin Order Management
  console.log(`\n[5] Testing Admin Order lifecycle (Confirm & Cancel)...`);
  const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@quantumtech.com', password: 'admin123' }),
  });
  const { token } = await loginRes.json();

  // Status transition to Confirmed
  const confirmRes = await fetch(`${BASE_URL}/api/admin/orders/${order.id}/status`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      status: 'Confirmed',
      note: 'Order confirmed with customer over phone',
    }),
  });
  if (!confirmRes.ok) throw new Error(`Status update to Confirmed failed: HTTP ${confirmRes.status}`);
  const confirmedOrder = await confirmRes.json();
  console.log(`✔ Admin updated status to: "${confirmedOrder.status}"`);

  // Cancel order with automatic stock restoration
  console.log(`\n[6] Cancelling order & testing stock restoration...`);
  const cancelRes = await fetch(`${BASE_URL}/api/admin/orders/${order.id}/status`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      status: 'Cancelled',
      reason: 'Customer requested cancellation (Test)',
      note: 'Automated test cancellation',
    }),
  });
  if (!cancelRes.ok) throw new Error(`Cancellation failed: HTTP ${cancelRes.status}`);
  const cancelledOrder = await cancelRes.json();
  console.log(`✔ Order successfully cancelled. Status: "${cancelledOrder.status}", Reason: "${cancelledOrder.cancellationReason}"`);

  // Verify stock restoration
  const prodRestoredRes = await fetch(`${BASE_URL}/api/products/prod-01`);
  const prodRestored = await prodRestoredRes.json();
  const variantRestored = prodRestored.variants.find((v) => v.id === 'v1-1');
  console.log(`✔ Stock restored in MongoDB Atlas: ${variantRestored.stock} (Back to initial: ${initialStock})`);
  if (variantRestored.stock !== initialStock) {
    throw new Error(`Expected stock ${initialStock}, but got ${variantRestored.stock}`);
  }

  console.log(`\n==================================================`);
  console.log(`🎉 ALL CHECKOUT & ORDERS REST API TESTS PASSED 100%!`);
  console.log(`==================================================\n`);
}

runTest().catch((err) => {
  console.error(`\n❌ TEST FAILED:`, err.message);
  process.exit(1);
});
