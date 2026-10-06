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
# API on http://localhost:4000 (PORT in .env)
```

---

## API Endpoints (high level)

### Auth
- `POST /api/auth/signup` (customer)
- `POST /api/auth/login` (admin or customer)

### User
- `GET /api/users/me` (auth)
- `POST /api/users/update` (auth, updates the authenticated user: name, address, phoneNumber)

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

---

## Quality gates
```bash
npm run typecheck   # tsc --noEmit, strict mode
npm run lint        # eslint, typescript-eslint strictTypeChecked
npm run build       # prisma generate + tsc
```

## Docker
```bash
docker build -t rreva-backend .
docker run --rm -p 4000:4000 --env-file .env rreva-backend
```
Health endpoints: `GET /health` (liveness), `GET /health/ready` (checks the database).
Seed the admin once: `docker run --rm --env-file .env rreva-backend node dist/scripts/seed.js`.
Push the schema once: `docker run --rm --env-file .env rreva-backend npx prisma db push --skip-generate`.

## Free deployment (Render + MongoDB Atlas + Cloudinary)
1. **Database** – create a free MongoDB Atlas **M0** cluster (Atlas runs a replica set, which Prisma needs),
   allow access from `0.0.0.0/0`, and copy the connection string with a database name, e.g.
   `mongodb+srv://USER:PASS@cluster0.xxxx.mongodb.net/rreva?retryWrites=true&w=majority`.
2. **Schema + admin** – from your machine with that `DATABASE_URL` in `.env`: `npm run prisma:push && npm run seed`.
3. **Render** – New → Blueprint → select this repo (`render.yaml`, plan `free`, Docker runtime).
   Fill in `DATABASE_URL`, `ADMIN_EMAIL`, `ADMIN_PASSWORD` and (optionally) the Cloudinary keys.
   `JWT_SECRET` is generated automatically. Health check path is `/health`.
4. Optional: set `CORS_ORIGINS` to your frontend origin(s), comma separated.

Notes: Render's free web service sleeps after ~15 min idle (first request takes ~30–60 s to wake).
Stripe, SMTP and Cloudinary are optional – without Cloudinary, product creation works but image uploads return 503.
Checkout creates a `PENDING_PAYMENT` order; an admin confirms payment via `PATCH /api/admin/orders/:id/place`.
