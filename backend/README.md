# QuantumTech Spring Boot Backend

## Contributor and Backend Ownership

**Sifat (Backend & Admin Developer)** implemented and owns the following areas:

- Spring Boot backend setup and project structure
- MongoDB and MongoDB Atlas integration for the `qtechdb` database
- Admin authentication, JWT sessions, BCrypt passwords, account lockout, and password reset
- Product, product variant, stock, and category REST APIs
- Order creation, order tracking, status transitions, cancellation, and inventory restoration
- bKash and Nagad payment verification and duplicate TrxID protection
- Store settings and low-stock configuration
- Owner email notifications, retry attempts, and notification status
- Review submission, verified-purchase checks, moderation, and rating recalculation
- Cloudinary image upload integration
- API validation, error handling, security rules, Swagger documentation, and unit tests

This implementation follows the backend/admin responsibilities assigned to Sifat in the
QuantumTech sprint document.

This backend implements Sifat's assigned backend/admin work for the QuantumTech project:
MongoDB Atlas data storage, Spring Security JWT authentication, product/category/order/review
management, stock safety, payment verification, email notifications, and Cloudinary uploads.

## Stack

- Java 21
- Spring Boot 3.4
- Spring Data MongoDB
- Spring Security with JWT
- BCrypt passwords
- Cloudinary
- Spring Mail
- SpringDoc OpenAPI

## Run locally

```bash
cd backend
cp .env.example .env
/tmp/apache-maven-3.9.9/bin/mvn spring-boot:run
```

Set environment variables in `.env` or your terminal. MongoDB defaults to a local database:

```properties
MONGODB_URI=mongodb://localhost:27017/qtechdb
MONGODB_DATABASE=qtechdb
```

For Atlas, set `MONGODB_URI=mongodb+srv://USER:PASSWORD@CLUSTER/qtechdb`.
Cloudinary values are intentionally blank until credentials are provided.

Swagger: `http://localhost:8080/swagger-ui`

## Frontend integration

Use `VITE_API_URL=http://localhost:8080` and send JSON as shown below. For every protected
admin request:

```http
Authorization: Bearer <JWT_FROM_LOGIN>
Content-Type: application/json
```

`frontendV2` currently keeps its service data in browser `localStorage` and imports mock data;
it does not call this API yet. The endpoints below define the backend contract for that frontend,
but the frontend service layer must be switched to HTTP requests before data is shared between
browsers or persisted in MongoDB.

### Authentication

| Method | Endpoint | Access |
|---|---|---|
| POST | `/api/auth/login` | Public |
| POST | `/api/auth/forgot-password` | Public |
| POST | `/api/auth/reset-password` | Public |

Login body:

```json
{"email":"admin@quantumtech.com","password":"admin123","rememberMe":true}
```

Login response:

```json
{"token":"JWT","email":"admin@quantumtech.com","name":"QuantumTech Admin","role":"Owner"}
```

### Products

| Method | Endpoint | Access |
|---|---|---|
| GET | `/api/products` | Public |
| GET | `/api/products/{idOrSlug}` | Public |
| GET | `/api/products?search=charger` | Public |
| GET | `/api/admin/products` | Admin |
| GET | `/api/admin/products/{id}` | Admin |
| POST | `/api/admin/products` | Admin |
| PUT | `/api/admin/products/{id}` | Admin |
| DELETE | `/api/admin/products/{id}` | Admin soft delete |

The JSON shape matches `frontendV2/src/types/index.ts#Product`, including `isFeatured` and
`isNew`.
Variants are nested under `variants`. Parent stock is recalculated from variant stocks.

### Categories

| Method | Endpoint | Access |
|---|---|---|
| GET | `/api/categories` | Public visible categories |
| GET | `/api/admin/categories` | Admin |
| POST | `/api/admin/categories` | Admin |
| PUT | `/api/admin/categories/{id}` | Admin |
| PUT | `/api/admin/categories/reorder` | Admin |
| DELETE | `/api/admin/categories/{id}` | Admin |

Deleting a category with non-deleted products returns `409 Conflict`.

### Orders

| Method | Endpoint | Access |
|---|---|---|
| POST | `/api/orders` | Public |
| GET | `/api/orders/track?orderNumber=...&phone=...` | Public |
| GET | `/api/admin/orders` | Admin |
| GET | `/api/admin/orders/{id}` | Admin |
| PATCH | `/api/admin/orders/{id}/status` | Admin |
| PATCH | `/api/admin/orders/{id}/payment` | Admin |
| GET | `/api/admin/dashboard` | Admin |

Checkout body:

```json
{
  "customerName": "Rahim Uddin",
  "phone": "01712345678",
  "area": "Inside Dhaka",
  "address": "House 12, Road 5, Dhanmondi",
  "note": "Call before delivery",
  "deliveryCharge": 70,
  "paymentMethod": "bKash",
  "trxId": "9K8J7H6G5F",
  "senderNumber": "01712345678",
  "couponCode": null,
  "couponDiscount": 0,
  "source": "Facebook",
  "language": "en",
  "items": [
    {
      "productId": "PRODUCT_ID",
      "variantId": "OPTIONAL_VARIANT_ID",
      "quantity": 1
    }
  ]
}
```

Send `X-Idempotency-Key: UNIQUE_VALUE` on checkout to protect repeated submissions.
The backend rechecks product availability, stock, price, delivery charge, and TrxID uniqueness.

Status changes:

```json
{"status":"Shipped","note":"Handed to courier"}
```

Allowed: `Pending -> Confirmed -> Shipped -> Delivered` and cancellation from Pending,
Confirmed or Shipped. bKash/Nagad requires `paymentStatus=Verified` before confirmation.

Payment verification:

```json
{"status":"Verified","note":"Statement matched"}
```

### Reviews

| Method | Endpoint | Access |
|---|---|---|
| GET | `/api/reviews?productId=...&sortBy=newest` | Public |
| GET | `/api/reviews/stats?productId=...` | Public |
| POST | `/api/reviews` | Public |
| GET | `/api/admin/reviews` | Admin |
| PATCH | `/api/admin/reviews/{id}` | Admin |
| DELETE | `/api/admin/reviews/{id}` | Admin |

New reviews are always `Pending`. Approving/rejecting recalculates the product rating.
Customer email is stored privately and excluded from JSON responses.

### Settings and uploads

| Method | Endpoint | Access |
|---|---|---|
| GET | `/api/settings` | Public |
| PUT | `/api/admin/settings` | Admin |
| POST | `/api/admin/uploads/image` multipart `file` | Admin |

Upload response:

```json
{"url":"https://res.cloudinary.com/.../image.jpg"}
```

Settings also persist the bilingual hero customization fields used by `frontendV2`, including
`heroBadgeText`, `heroTitleLine1`, `heroSubtitle`, `heroBannerImage`, both CTA text/link pairs,
and the rating label/text fields.

### Campaigns, promotions, coupons, and analytics

| Method | Endpoint | Access |
|---|---|---|
| GET | `/api/campaigns` | Public active campaigns |
| GET | `/api/campaigns/slug/{slug}` | Public campaign landing page |
| GET/POST | `/api/admin/campaigns` | Admin list/create |
| PUT/DELETE | `/api/admin/campaigns/{id}` | Admin update/delete |
| GET | `/api/promotions/popups/active` | Public active popups |
| GET/POST | `/api/admin/popups` | Admin list/create |
| PUT/DELETE | `/api/admin/popups/{id}` | Admin update/delete |
| GET | `/api/discounts/active` | Public active product discounts |
| GET/POST | `/api/admin/discounts` | Admin list/create |
| PUT/DELETE | `/api/admin/discounts/{id}` | Admin update/delete |
| GET/POST | `/api/admin/coupons` | Admin list/create |
| PUT/DELETE | `/api/admin/coupons/{id}` | Admin update/delete |
| POST | `/api/promotions/coupons/validate` | Public |
| POST | `/api/campaign-analytics/events` | Public event tracking |
| GET | `/api/admin/campaign-analytics/summary` | Admin |
| GET/DELETE | `/api/admin/campaign-analytics/events` | Admin |

Promotion payloads use the matching interfaces in `frontendV2/src/types/promotions.ts`.
Checkout recalculates product discounts and coupon eligibility from stored product, discount,
and coupon data; client-provided item prices and coupon discount amounts are not trusted.

## Errors

Validation and business-rule failures use JSON:

```json
{"timestamp":"2026-11-22T00:00:00Z","status":400,"error":"Error message"}
```

For field validation, `fields` contains invalid field names and messages.

## Tests

```bash
mvn test
```

The suite currently covers product price/variant stock rules, public filtering,
order status transitions, mobile payment verification, cancellation validation,
and pending review creation.
