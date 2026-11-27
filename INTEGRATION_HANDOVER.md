# QuantumTech Frontend & Backend Integration Handover Document

> **Last Updated:** 2026-11-25  
> **Status:** All REST APIs Fully Integrated, Tested, and Verified with Live MongoDB Atlas  
> **Architecture:** Spring Boot 3.4 (Java 21) REST Backend + React 18 (TypeScript, Vite) Frontend + MongoDB Atlas Cloud Database

---

## 1. System Architecture & Environment

- **Frontend:** React 18, TypeScript, Vite, Tailwind CSS (runs on `http://localhost:3000` or `:5173`)
- **Backend:** Java 21 (`/usr/lib/jvm/java-21-openjdk-amd64`), Spring Boot 3.4.1, Spring Data MongoDB, Spring Security (JWT) (runs on `http://localhost:8080`)
- **Database:** MongoDB Atlas (Cloud)
  - Database Name: `qtechdb`
  - Host: `cluster0.ekcgb3l.mongodb.net`
  - Auth Config: Configured in `backend/.env` and `application.properties`
- **Maven Location:** `/home/sakib/.local/bin/mvn` (`/home/sakib/.tools/apache-maven-3.9.9/bin/mvn`)

### Environment Files
1. **`backend/.env`**:
   - `MONGODB_URI`: Configured with MongoDB Atlas credentials
   - `MONGODB_DATABASE`: `qtechdb`
   - `PORT`: `8080`
   - `JWT_SECRET`: Configured for token signing
   - `ADMIN_EMAIL`: `admin@quantumtech.com`
   - `ADMIN_PASSWORD`: `admin123`
2. **`/.env` (Root Frontend)**:
   - `VITE_API_URL=http://localhost:8080`

---

## 2. API Integration & Test Results (All 7 Suites Passing 100%)

| Step | API Module | Endpoints | Status | Test Script & Verification |
|---|---|---|:---:|---|
| **0** | **Environment & DB Setup** | Maven setup, `backend/.env`, Atlas connection | **DONE** | Java 21, Maven 3.9.9 configured |
| **1** | **Backend Build & Boot** | Spring Boot startup on `:8080`, Swagger check | **DONE** | Connected to Atlas `atlas-3mezzj-shard-0` |
| **2** | **Frontend HTTP Client** | `src/services/backend.ts` (`api<T>()`, `API_BASE`) | **DONE** | Dynamic `VITE_API_URL` & Bearer token handling |
| **3** | **Categories API** | `GET /api/categories`<br>`GET /api/admin/categories`<br>`POST/PUT/DELETE /api/admin/categories` | **DONE** | `node scripts/test-categories-api.mjs` (100% PASS) |
| **4** | **Products API** | `GET /api/products`<br>`GET /api/products/{idOrSlug}`<br>`GET /api/admin/products`<br>`POST/PUT/DELETE /api/admin/products/{id}` | **DONE** | `node scripts/test-products-api.mjs` (100% PASS) |
| **5** | **Auth API** | `POST /api/auth/login`<br>`POST /api/auth/forgot-password`<br>`POST /api/auth/reset-password` | **DONE** | `node scripts/test-auth-api.mjs` (100% PASS) |
| **6** | **Cart & Payment Methods** | `POST /api/cart/validate`<br>`GET /api/payments/methods` | **DONE** | `node scripts/test-cart-payment-api.mjs` (100% PASS) |
| **7** | **Checkout & Orders** | `POST /api/orders`<br>`GET /api/orders/track`<br>`POST /api/orders/{id}/payment`<br>`PATCH /api/admin/orders/{id}/status` | **DONE** | `node scripts/test-orders-api.mjs` (100% PASS) |
| **8** | **Reviews & Moderation** | `GET /api/reviews`<br>`POST /api/reviews`<br>`GET /api/admin/reviews`<br>`PATCH /api/admin/reviews/{id}`<br>`DELETE /api/admin/reviews/{id}` | **DONE** | `node scripts/test-reviews-api.mjs` (100% PASS) |
| **9** | **Store Settings** | `GET /api/settings`<br>`PUT /api/admin/settings` | **DONE** | `node scripts/test-settings-api.mjs` (100% PASS) |

---

## 3. How to Run Frontend & Backend

### Running Backend:
```bash
./backend/run.sh
```
Or directly via npm shortcut:
```bash
npm run dev:backend
```
Backend will start on `http://localhost:8080`.  
Swagger documentation is available at: `http://localhost:8080/swagger-ui/index.html`

### Running Frontend:
```bash
npm run dev
```
Frontend will start on `http://localhost:3000` or `:5173`.

### Running All API Integration Tests:
```bash
npm run test:api
```
Runs all 7 test suites against the live backend and MongoDB Atlas.

### Building for Production:
```bash
npm run build
```
Generates production-ready bundle in `/dist`.

---

## 4. Default Credentials & Test Data

- **Admin Email:** `admin@quantumtech.com`
- **Admin Password:** `admin123`
- **Customer Checkout Test Phone:** `01712345678` (Valid 11-digit Bangladeshi mobile number)
- **Supported Payment Methods:** `COD`, `bKash`, `Nagad`
- **Delivery Zones:**
  - Inside Dhaka: ৳70
  - Outside Dhaka: ৳130
