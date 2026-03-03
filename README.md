# Commerce Backend (Admin + Customer)

Node.js + Express + TypeScript + Prisma (MongoDB) backend for:
- **Admin**: login, create/edit/delete products, view & approve orders
- **Customer**: signup/login, browse products, create Stripe checkout session
- **Stripe webhook**: marks order as paid/placed and emails admin
- **Profile photo uploads**: stored on **Cloudinary** (free tier) and returned via `/api/users/me`

## Tech
- Node.js, Express, TypeScript
- Prisma + MongoDB
- JWT auth (role-based)
- Stripe Checkout + Webhook
- Nodemailer (SMTP)
- Cloudinary (image storage)

---

## Project structure
```
src/
  app.ts
  server.ts
  config/
    env.ts
  db/
    prisma.ts
  controllers/
    auth.controller.ts
    users.controller.ts
    products.controller.ts
    checkout.controller.ts
    orders.controller.ts
    stripeWebhook.controller.ts
  routes/
    auth.routes.ts
    users.routes.ts
    products.routes.ts
    checkout.routes.ts
    orders.routes.ts
    stripeWebhook.routes.ts
  services/
    email.ts
    stripe.ts
    cloudinary.ts
  middlewares/
    auth.ts
    error.ts
  utils/
    http.ts
  scripts/
    seed.ts
prisma/
  schema.prisma
```

---

## Setup & Run

### 1) Install
```bash
npm install
```

### 2) Configure env
```bash
cp .env.example .env
# edit .env
```

### 3) Prisma generate + push schema
```bash
npm run prisma:generate
npm run prisma:push
```

### 4) Seed Admin user
```bash
npm run seed
```

### 5) Start server
```bash
npm run dev
# API on http://localhost:4000
```

---

## API Endpoints (high level)

### Auth
- `POST /api/auth/signup` (customer)
- `POST /api/auth/login` (admin or customer)

### User
- `GET /api/users/me` (auth)
- `PUT /api/users/me/profile-photo` (auth, multipart/form-data `file`)

### Products
- `GET /api/products` (public)
- `GET /api/products/:id` (public)
- `POST /api/products` (admin)
- `PUT /api/products/:id` (admin)
- `DELETE /api/products/:id` (admin, soft delete)

### Checkout
- `POST /api/checkout/session` (customer) -> returns `{ checkoutUrl }`

### Orders
- `GET /api/orders` (customer)
- `GET /api/admin/orders` (admin)
- `PATCH /api/admin/orders/:id/approve` (admin)

### Stripe webhook
- `POST /api/webhooks/stripe` (Stripe)

---

## Notes
- For Stripe webhook locally, use Stripe CLI:
  ```bash
  stripe listen --forward-to localhost:4000/api/webhooks/stripe
  ```
  Then put the printed `whsec_...` into `STRIPE_WEBHOOK_SECRET`.
- Admin receives an email after payment succeeds and the order is marked `PLACED`.
