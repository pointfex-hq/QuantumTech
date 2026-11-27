// Test Products REST API against live Spring Boot backend & MongoDB Atlas
const BASE_URL = process.env.VITE_API_URL || 'http://localhost:8080';

async function runTest() {
  console.log(`\n==================================================`);
  console.log(`[TEST] PRODUCTS REST API & MONGODB ATLAS TEST`);
  console.log(`Target: ${BASE_URL}`);
  console.log(`==================================================\n`);

  // Step 1: Public GET /api/products
  console.log(`[1] Testing GET /api/products (Public Storefront Catalog)...`);
  const publicRes = await fetch(`${BASE_URL}/api/products`);
  if (!publicRes.ok) {
    throw new Error(`Failed to fetch public products: HTTP ${publicRes.status}`);
  }
  const publicProducts = await publicRes.json();
  console.log(`✔ Public products retrieved: ${publicProducts.length} active products in MongoDB Atlas.`);
  if (publicProducts.length === 0) {
    throw new Error(`Expected products in database, but found 0!`);
  }

  const sample = publicProducts[0];
  console.log(`   Sample product: "${sample.name}" (Slug: ${sample.slug}, Price: ৳${sample.price}, Stock: ${sample.stock})`);
  
  // Verify variant stock sum
  if (sample.variants && sample.variants.length > 0) {
    const variantSum = sample.variants.reduce((sum, v) => sum + (v.stock || 0), 0);
    if (sample.stock !== variantSum) {
      console.warn(`   ⚠ Note: Main stock (${sample.stock}) vs variant sum (${variantSum})`);
    } else {
      console.log(`✔ Variant stock integrity verified: Variant sum (${variantSum}) == Product stock (${sample.stock})`);
    }
  }

  // Step 2: Lookup by ID and Slug
  console.log(`\n[2] Testing GET /api/products/{idOrSlug}...`);
  const byIdRes = await fetch(`${BASE_URL}/api/products/${sample.id}`);
  if (!byIdRes.ok) {
    throw new Error(`Failed to fetch product by ID ${sample.id}: HTTP ${byIdRes.status}`);
  }
  const byIdProduct = await byIdRes.json();
  console.log(`✔ Lookup by ID ("${sample.id}") SUCCESS: "${byIdProduct.name}"`);

  const bySlugRes = await fetch(`${BASE_URL}/api/products/${sample.slug}`);
  if (!bySlugRes.ok) {
    throw new Error(`Failed to fetch product by slug "${sample.slug}": HTTP ${bySlugRes.status}`);
  }
  const bySlugProduct = await bySlugRes.json();
  console.log(`✔ Lookup by Slug ("${sample.slug}") SUCCESS: "${bySlugProduct.name}"`);

  // Step 3: Search products
  console.log(`\n[3] Testing GET /api/products?search=charger...`);
  const searchRes = await fetch(`${BASE_URL}/api/products?search=charger`);
  if (!searchRes.ok) {
    throw new Error(`Search failed: HTTP ${searchRes.status}`);
  }
  const searchResults = await searchRes.json();
  console.log(`✔ Search "charger" returned: ${searchResults.length} matching products.`);
  if (searchResults.length > 0) {
    console.log(`   Top match: "${searchResults[0].name}"`);
  }

  // Step 4: Admin Authentication
  console.log(`\n[4] Authenticating as Admin for Product CRUD...`);
  const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'admin@quantumtech.com',
      password: 'admin123',
      rememberMe: true,
    }),
  });
  if (!loginRes.ok) throw new Error(`Admin login failed: HTTP ${loginRes.status}`);
  const { token } = await loginRes.json();
  console.log(`✔ Admin Bearer token obtained.`);

  // Step 5: Admin GET /api/admin/products
  console.log(`\n[5] Testing GET /api/admin/products...`);
  const adminListRes = await fetch(`${BASE_URL}/api/admin/products`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!adminListRes.ok) throw new Error(`Admin products list failed: HTTP ${adminListRes.status}`);
  const adminProducts = await adminListRes.json();
  console.log(`✔ Admin products retrieved: ${adminProducts.length} products.`);

  // Step 6: Create new product in MongoDB Atlas
  console.log(`\n[6] Testing POST /api/admin/products (Create Product with Variants)...`);
  const testProductPayload = {
    name: 'Quantum HyperCharge 65W GaN Test',
    nameBn: 'কোয়ান্টাম হাইপারচার্জ ৬৫ ওয়াট টেস্ট',
    slug: `hypercharge-test-${Date.now()}`,
    categoryId: sample.categoryId,
    categoryName: sample.categoryName,
    categoryNameBn: sample.categoryNameBn,
    description: 'Ultra-fast GaN III dual-port compact travel charger.',
    descriptionBn: 'আল্ট্রা-ফাস্ট জিএএন ৩ ডুয়াল পোর্ট ট্রাভেল চার্জার।',
    price: 2950,
    oldPrice: 3500,
    images: [
      'https://images.unsplash.com/photo-1583863788434-e58a36330cf0?auto=format&fit=crop&w=800&q=80',
    ],
    variants: [
      {
        attribute: 'colour',
        value: 'Matte Black',
        valueBn: 'ম্যাট ব্ল্যাক',
        price: 2950,
        stock: 12,
      },
      {
        attribute: 'colour',
        value: 'Arctic White',
        valueBn: 'আর্কটিক হোয়াইট',
        price: 2950,
        stock: 8,
      },
    ],
    specifications: { Power: '65W GaN III', Ports: '2x Type-C' },
    specificationsBn: { পাওয়ার: '৬৫ ওয়াট জিএএন ৩' },
    isFeatured: true,
    isNew: true,
    status: 'Active',
    tags: ['charger', 'gan', 'fast', 'test'],
  };

  const createRes = await fetch(`${BASE_URL}/api/admin/products`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(testProductPayload),
  });
  if (!createRes.ok) {
    const errorBody = await createRes.text();
    throw new Error(`Failed to create product: HTTP ${createRes.status} - ${errorBody}`);
  }
  const createdProduct = await createRes.json();
  console.log(`✔ Product created in MongoDB Atlas! ID: ${createdProduct.id}, Name: "${createdProduct.name}"`);
  console.log(`✔ Automatic stock calculation verified: ${createdProduct.stock} (12 + 8 = 20)`);
  if (createdProduct.stock !== 20) {
    throw new Error(`Expected calculated stock 20, but got ${createdProduct.stock}`);
  }

  // Step 7: Update product
  console.log(`\n[7] Testing PUT /api/admin/products/${createdProduct.id}...`);
  const updatePayload = {
    ...createdProduct,
    price: 3100,
    name: 'Quantum HyperCharge 65W GaN (Updated)',
  };
  const updateRes = await fetch(`${BASE_URL}/api/admin/products/${createdProduct.id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(updatePayload),
  });
  if (!updateRes.ok) {
    throw new Error(`Failed to update product: HTTP ${updateRes.status}`);
  }
  const updatedProduct = await updateRes.json();
  console.log(`✔ Product updated in MongoDB Atlas! New price: ৳${updatedProduct.price}, Name: "${updatedProduct.name}"`);

  // Step 8: Soft delete product
  console.log(`\n[8] Testing DELETE /api/admin/products/${createdProduct.id}...`);
  const deleteRes = await fetch(`${BASE_URL}/api/admin/products/${createdProduct.id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!deleteRes.ok && deleteRes.status !== 204) {
    throw new Error(`Failed to soft-delete product: HTTP ${deleteRes.status}`);
  }
  console.log(`✔ Soft delete returned HTTP ${deleteRes.status} NO_CONTENT.`);

  // Step 9: Verify deleted product is hidden from storefront
  const verifyRes = await fetch(`${BASE_URL}/api/products/${createdProduct.id}`);
  if (verifyRes.status === 404) {
    console.log(`✔ Verified: Deleted product is hidden from public storefront (HTTP 404).`);
  } else {
    throw new Error(`Expected HTTP 404 for deleted product, but got ${verifyRes.status}`);
  }

  console.log(`\n==================================================`);
  console.log(`🎉 ALL PRODUCTS REST API TESTS PASSED 100%!`);
  console.log(`==================================================\n`);
}

runTest().catch((err) => {
  console.error(`\n❌ PRODUCTS TEST FAILED:`, err.message);
  process.exit(1);
});
