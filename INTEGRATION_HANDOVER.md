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
  - Configure the URI locally or through the deployment secret manager; do not commit credentials.
- **Maven Location:** `/home/sakib/.local/bin/mvn` (`/home/sakib/.tools/apache-maven-3.9.9/bin/mvn`)

### Environment Files
1. **Backend:** Use the ignored `application-local.properties` with the `local` Spring profile,
   or supply deployment values through environment variables. `backend/.env` is ignored and
   only sourced by `backend/run.sh`; never commit it.
2. **`/.env` (Root Frontend):**
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
cd backend
SPRING_PROFILES_ACTIVE=local mvn spring-boot:run
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

## 4. Credentials & Test Data

- Admin credentials come from `ADMIN_EMAIL` and `ADMIN_PASSWORD`; for local development use
  the values in `backend/src/main/resources/application-local.properties`. Set the
  `adminEmail` and `adminPassword` Postman collection variables before running API requests.
- **Customer Checkout Test Phone:** `01712345678` (Valid 11-digit Bangladeshi mobile number)
- **Supported Payment Methods:** `COD`, `bKash`, `Nagad`
- **Delivery Zones:**
  - Inside Dhaka: ৳70
  - Outside Dhaka: ৳130
