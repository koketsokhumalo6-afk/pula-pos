# Pula POS — Cloud SaaS Point of Sale

A completely web-based, multi-tenant POS system. Customers open a browser,
go to your website, log in, and use it — nothing to install, ever.

```
Chrome → https://pos.yourdomain.com → Login → Use POS
```

## What was built

Three deployable projects:

| Project         | What it is                                              | Who uses it |
|------------------|----------------------------------------------------------|-------------|
| `backend/`       | The API — auth, licensing, all business data             | Both apps below call it |
| `pos-app/`       | The customer-facing POS web app                          | Your customers (businesses) |
| `admin-portal/`  | The master admin portal                                  | You (Pula POS operator) |

Everything — the database, the API, authentication, and licensing — runs on
your hosting server. The two frontends are static websites that talk to the
API over HTTPS. A customer's "installation" is opening a URL.

## Technical decisions made for you

You asked for these to be decided rather than asked about. Here's what was
chosen and why:

- **Backend**: Node.js + TypeScript + Express. Ubiquitous, cheap to host,
  easy to find developers for, and fast enough for a POS workload of any
  realistic size.
- **Database**: PostgreSQL, accessed through Prisma ORM. Postgres is the
  standard choice for multi-tenant SaaS — reliable, well-supported by every
  managed database provider, and Prisma keeps the schema (`backend/prisma/schema.prisma`)
  as a single source of truth with safe, reviewable migrations.
  **This is a managed cloud database you point the server at — nothing
  for you or your customers to install.** Any managed Postgres provider
  works (Neon, Supabase, Railway, Render, AWS RDS, DigitalOcean, etc.).
- **Multi-tenancy model**: one shared database, every table scoped by
  `businessId`. This is the standard, cost-effective approach for a SaaS
  serving many small/medium businesses — cheaper to run and simpler to
  maintain than one database per customer, while every API route enforces
  tenant isolation in code (a business can never query another business's
  rows).
- **Auth**: JWT access tokens, bcrypt-hashed passwords. Business staff and
  your master-admin operators are entirely separate credential spaces
  (different secrets, different login endpoints), so a compromised business
  account can never reach the admin portal.
- **Frontend**: React + Vite, compiled to static HTML/CSS/JS. Deploys to any
  static host or CDN, loads fast, and requires only a browser to run.
- **Hosting shape**: the backend runs as a small always-on Node process
  (any container/PaaS host works — Render, Railway, Fly.io, a VPS with
  Docker, AWS/GCP/Azure). The two frontends are static sites, best hosted on
  a CDN-backed static host (Vercel, Netlify, Cloudflare Pages, or an S3+CDN
  bucket) for speed and near-zero cost. A `Dockerfile` is included for the
  backend so it's deployable anywhere that runs containers.

None of this requires you or your customers to install MySQL, XAMPP,
Node.js locally, Docker on a desktop, or anything else — those tools only
exist in the cloud hosting environment you'll deploy to.

## Licensing system

Every business has one `License` row: a key in the form `PULA-2026-XXXX-XXXX`,
a plan, a status (`PENDING` / `ACTIVE` / `SUSPENDED` / `EXPIRED` / `CANCELLED`),
an activation date, an expiry date, and seat limits (`maxUsers`,
`maxTerminals`).

- New businesses get a license automatically when you create them in the
  admin portal (12 months from activation).
- The API blocks **new sales, purchases, products, and other writes** the
  moment a license is expired or suspended — reads still work, so a
  business isn't locked out of its own historical data while it renews.
  A banner in the POS app warns staff when the license is within 14 days of
  expiring.
- You renew, suspend, reinstate, extend, or change plan limits from the
  admin portal — the change takes effect immediately, the next time that
  business's browser calls the API. The customer never touches anything.

## Modules included

Point of Sale, Products, Stock (with movement history and manual
adjustments), Customers, Suppliers, Sales history, Purchases, Expenses,
Invoices, Quotations, Customer statements, Reports (sales summary, top
products, expenses by category, payment method breakdown), Staff (with
license-enforced seat limits), Shifts & cash management (open/close,
cash-in/cash-out, variance on close).

## Deploying

### 1. Provision a managed PostgreSQL database

Create one with any provider (Neon and Supabase both have generous free
tiers to start on). Copy the connection string.

### 2. Deploy the backend

```
cd backend
cp .env.example .env      # fill in DATABASE_URL and generate real secrets
npm install
npx prisma migrate deploy # creates all tables
npm run seed               # creates your super-admin login + plans + a demo business
npm run build
npm start                  # or deploy the Dockerfile to your host of choice
```

`npm run seed` prints your master-admin email/password — **change that
password immediately** by logging into the admin portal and (for now)
updating it directly in the database, or extend the admin portal with a
password-change screen before go-live.

Deploy this as a long-running service on your chosen host, pointed at your
domain, e.g. `https://api.yourdomain.com`.

### 3. Deploy the two frontends

```
cd pos-app
cp .env.example .env      # set VITE_API_URL to your backend's URL
npm install && npm run build   # outputs pos-app/dist — a static site

cd ../admin-portal
cp .env.example .env
npm install && npm run build   # outputs admin-portal/dist — a static site
```

Upload `pos-app/dist` to `https://pos.yourdomain.com` and
`admin-portal/dist` to `https://admin.yourdomain.com` (or any subdomains you
prefer) on your static hosting provider of choice. Point your DNS at them.

### 4. Go live

Log into `https://pos.yourdomain.com` with the demo login printed by the
seed script to confirm everything works end-to-end, then start creating
real businesses from the admin portal. Each one gets its own login, its own
license, and its own isolated data from the moment you click "Create
Business."

## A note on this build environment

This project was written in a sandboxed cloud workspace that has no access
to package registries (npm, PyPI, etc.) or the open internet, so `npm
install` / a full compiled build could not be run here to produce a final
tested binary. Every file was written by hand and checked with a
TypeScript syntax pass (catching malformed code), and the API/data model
were cross-checked field-by-field for consistency. Still, treat the first
`npm install && npm run build` on your own machine or CI as the real
build verification, and run through a test business end-to-end (create it,
log in, ring up a sale, renew its license) before onboarding paying
customers.
