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

## Notes on database contract

- Uses existing tables in `shop.db`: `customers`, `orders`, `order_items`, `products`.
- Priority queue expects `order_predictions` to already exist (from your ML pipeline).
- This DB uses `full_name`, `order_datetime`, and `order_total` instead of the prompt's default names.

## Run scoring manually

```bash
python jobs/run_inference.py
```

Expected stdout pattern includes `scored=<number>` so the app can display count.

## Manual QA checklist

- Select customer on `/select-customer`.
- Confirm banner shows selected customer.
- Place a new order on `/place-order`.
- Verify order appears in `/orders` and details page.
- Run scoring from `/scoring`.
- Open `/warehouse/priority` and confirm scored rows appear.
