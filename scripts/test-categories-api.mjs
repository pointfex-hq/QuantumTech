// Test Categories REST API against live backend & MongoDB Atlas
const BASE_URL = process.env.VITE_API_URL || 'http://localhost:8080';

async function runTest() {
  console.log(`\n==================================================`);
  console.log(`[TEST] CATEGORIES REST API & MONGODB ATLAS TEST`);
  console.log(`Target: ${BASE_URL}`);
  console.log(`==================================================\n`);

  // Step 1: Public GET /api/categories
  console.log(`[1] Testing GET /api/categories (Public)...`);
  const publicRes = await fetch(`${BASE_URL}/api/categories`);
  if (!publicRes.ok) {
    throw new Error(`Failed to fetch public categories: HTTP ${publicRes.status}`);
  }
  const publicCategories = await publicRes.json();
  console.log(`✔ Public categories retrieved successfully: ${publicCategories.length} categories found.`);
  console.log(`   Sample category: "${publicCategories[0]?.nameEn}" (ID: ${publicCategories[0]?.id})`);

  // Step 2: Login Admin to get JWT token
  console.log(`\n[2] Logging in as Admin to obtain JWT token...`);
  const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'admin@quantumtech.com',
      password: 'admin123',
      rememberMe: true,
    }),
  });
  if (!loginRes.ok) {
    throw new Error(`Admin login failed: HTTP ${loginRes.status}`);
  }
  const { token, role } = await loginRes.json();
  console.log(`✔ Admin logged in successfully! Role: ${role}, JWT length: ${token?.length}`);

  // Step 3: GET /api/admin/categories with Bearer token
  console.log(`\n[3] Testing GET /api/admin/categories (Admin Protected)...`);
  const adminRes = await fetch(`${BASE_URL}/api/admin/categories`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!adminRes.ok) {
    throw new Error(`Failed to fetch admin categories: HTTP ${adminRes.status}`);
  }
  const adminCategories = await adminRes.json();
  console.log(`✔ Admin categories retrieved: ${adminCategories.length} categories.`);

  // Step 4: POST /api/admin/categories (Create new category)
  console.log(`\n[4] Testing POST /api/admin/categories (Create category in MongoDB Atlas)...`);
  const newCatPayload = {
    nameEn: 'Smart Wearables Test',
    nameBn: 'স্মার্ট পরিধানযোগ্য টেস্ট',
    slug: 'smart-wearables-test',
    iconName: 'smartwatch',
    sortOrder: 99,
  };
  const createRes = await fetch(`${BASE_URL}/api/admin/categories`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(newCatPayload),
  });
  if (!createRes.ok) {
    throw new Error(`Failed to create category: HTTP ${createRes.status}`);
  }
  const createdCategory = await createRes.json();
  console.log(`✔ Category created in MongoDB Atlas! ID: ${createdCategory.id}, Name: ${createdCategory.nameEn}`);

  // Step 5: PUT /api/admin/categories/:id (Update category)
  console.log(`\n[5] Testing PUT /api/admin/categories/${createdCategory.id} (Update in MongoDB Atlas)...`);
  const updatePayload = {
    ...createdCategory,
    nameEn: 'Smart Wearables (Updated)',
  };
  const updateRes = await fetch(`${BASE_URL}/api/admin/categories/${createdCategory.id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(updatePayload),
  });
  if (!updateRes.ok) {
    throw new Error(`Failed to update category: HTTP ${updateRes.status}`);
  }
  const updatedCategory = await updateRes.json();
  console.log(`✔ Category updated in MongoDB Atlas! New Name: "${updatedCategory.nameEn}"`);

  // Step 6: DELETE /api/admin/categories/:id (Delete category)
  console.log(`\n[6] Testing DELETE /api/admin/categories/${createdCategory.id} (Delete from MongoDB Atlas)...`);
  const deleteRes = await fetch(`${BASE_URL}/api/admin/categories/${createdCategory.id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!deleteRes.ok && deleteRes.status !== 204) {
    throw new Error(`Failed to delete category: HTTP ${deleteRes.status}`);
  }
  console.log(`✔ Category successfully deleted from MongoDB Atlas (HTTP ${deleteRes.status})!`);

  // Step 7: Verify it's gone
  const verifyRes = await fetch(`${BASE_URL}/api/categories`);
  const verifyCategories = await verifyRes.json();
  const exists = verifyCategories.some((c) => c.id === createdCategory.id);
  if (exists) {
    throw new Error(`Category was not deleted from database!`);
  }
  console.log(`✔ Verified: Deleted category is no longer present in MongoDB Atlas.`);

  console.log(`\n==================================================`);
  console.log(`🎉 ALL CATEGORY REST API TESTS PASSED 100%!`);
  console.log(`==================================================\n`);
}

runTest().catch((err) => {
  console.error(`\n❌ TEST FAILED:`, err.message);
  process.exit(1);
});
