# IS455_MachineLearningApp
Predictive Machine Learning Pipeline App dealing with customer orders.

## Vibe Code App (Next.js + SQLite)

Simple student web app built on top of `shop.db` using Next.js App Router and `better-sqlite3`.

## What it includes

- Select customer (`/select-customer`) and save `customer_id` in cookie `selected_customer_id`
- Customer dashboard (`/dashboard`) with summary + recent orders
- Place order (`/place-order`) with transaction-safe inserts into `orders` and `order_items`
- Order history (`/orders`) and order details (`/orders/[order_id]`)
- Warehouse queue (`/warehouse/priority`) from `order_predictions` (top 50)
- Run scoring (`/scoring`) to execute `python jobs/run_inference.py`
- Developer schema page (`/debug/schema`)

## Setup

1. Install dependencies:

```bash
npm install
```

2. Start dev server:

```bash
npm run dev
```

3. Open:

- <http://localhost:3000/select-customer>

## Supabase + Vercel deployment

1. Create a Supabase project.
2. In Supabase SQL Editor, run `supabase/schema.sql`.
3. Set environment variables locally and in Vercel:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY` (or `NEXT_PUBLIC_SUPABASE_ANON_KEY`)
   - `SUPABASE_SERVICE_ROLE_KEY` (server-side only)
4. Import SQLite data into Supabase:

```bash
npm run import:supabase
```

5. In Vercel, connect this GitHub repo and set the same env vars.

## Notes on database contract

- App uses existing operational tables: `customers`, `orders`, `order_items`, `products`, `order_predictions`.
- Current schema uses `full_name`, `order_datetime`, and `order_total`.
- The Run Scoring page writes/upserts predictions into `order_predictions` keyed by `order_id`.

## Run scoring manually

```bash
python jobs/run_inference.py
```

Expected stdout pattern includes `scored=<number>` so the app can display count.

## Scheduled pipeline jobs (17.7 style)

This repo now includes:

- `jobs/config.py`
- `jobs/utils_db.py`
- `jobs/etl_build_warehouse.py`
- `jobs/train_model.py`
- `jobs/run_inference.py`

Run in order:

```bash
python jobs/etl_build_warehouse.py
python jobs/train_model.py
python jobs/run_inference.py
```

Artifacts are written to `artifacts/` and warehouse data to `data/warehouse.db`.

## Manual QA checklist

- Select customer on `/select-customer`.
- Confirm banner shows selected customer.
- Place a new order on `/place-order`.
- Verify order appears in `/orders` and details page.
- Run scoring from `/scoring`.
- Open `/warehouse/priority` and confirm scored rows appear.
