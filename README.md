# IS455 ML App — Fraud Detection Pipeline

**Live app:** `https://<your-vercel-url>.vercel.app`
_(Replace with your deployed URL before submitting.)_

Predictive ML pipeline web app built on `shop.db` using Next.js App Router and Supabase.
Predicts `is_fraud` on the `orders` table using a CRISP-DM notebook pipeline (see `model_training.ipynb`).

---

## Rubric Feature Checklist

| Feature | Route | Status |
|---------|-------|--------|
| Select Customer screen (no login) | `/select-customer` | ✓ |
| Place new order — saves to DB | `/place-order` | ✓ |
| Customer order history page | `/orders` | ✓ |
| **Admin** (all-customer) order history page | `/admin/orders` | ✓ |
| Run Scoring — triggers ML inference, refreshes queue | `/scoring` | ✓ |
| Priority queue (top 50 by fraud probability) | `/warehouse/priority` | ✓ |

To verify each step in order:
1. Go to `/select-customer` → pick any customer → confirm banner appears.
2. Go to `/place-order` → submit an order → confirm redirect to dashboard.
3. Go to `/orders` → confirm the new order is listed.
4. Go to `/admin/orders` → confirm **all** orders across all customers appear.
5. Go to `/scoring` → click **Run Scoring** → confirm redirect to priority queue.
6. Go to `/warehouse/priority` → confirm rows show `fraud_probability` scores.

---

## Setup

### Node / Next.js

```bash
npm install
npm run dev
# Open http://localhost:3000/select-customer
```

### Python ML pipeline

```bash
pip install -r requirements.txt

# Run in order:
python jobs/etl_build_warehouse.py   # builds data/warehouse.db
python jobs/train_model.py            # trains artifacts/late_delivery_model.sav
python jobs/run_inference.py          # scores shop.db → order_predictions table

# OR run the CRISP-DM notebook to train the fraud model:
# jupyter notebook model_training.ipynb
# (saves fraud_model.joblib which run_inference.py will prefer)
```

---

## Supabase + Vercel Deployment

**Note on data origin:** All operational data originates from `shop.db` (SQLite). For Vercel
deployment the data is imported into a hosted Supabase (PostgreSQL) database — a direct
cloud-hosted equivalent. New orders placed through the web app write to Supabase. The Python
inference job (`jobs/run_inference.py`) reads from local `shop.db` and writes to SQLite;
the web app's Run Scoring action always writes to Supabase so the priority queue stays current.

### Steps

1. Create a [Supabase](https://supabase.com) project.
2. In the Supabase SQL Editor, run `supabase/schema.sql`.

   **Existing deployment migration** — if your `order_predictions` table has the OLD
   late-delivery column names, run these two ALTER statements instead of recreating the table:

   ```sql
   alter table order_predictions
     rename column late_delivery_probability to fraud_probability;

   alter table order_predictions
     rename column predicted_late_delivery to predicted_fraud;
   ```

3. Set environment variables locally (`.env.local`) and in your Vercel project settings:

   ```
   NEXT_PUBLIC_SUPABASE_URL=<your-supabase-project-url>
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY=<anon-public-key>
   SUPABASE_SERVICE_ROLE_KEY=<service-role-secret-key>
   ```

4. Import `shop.db` data into Supabase:

   ```bash
   npm run import:supabase
   ```

5. In Vercel, connect this GitHub repo and set the same three env vars.
6. Deploy. The Run Scoring action uses JS-based fraud inference on Vercel
   (Python runtimes are not available in Next.js server actions on Vercel).

---

## Scoring Architecture

| Environment | Inference path | Writes to |
|-------------|---------------|-----------|
| Vercel (production) | JS fraud scorer in `app/scoring/actions.js` | Supabase `order_predictions` |
| Local dev (Python available) | JS scorer **+** `python jobs/run_inference.py` | Supabase + `shop.db` SQLite |
| Local dev (no Python) | JS fraud scorer | Supabase `order_predictions` |

The JS scorer uses a logistic-regression–inspired algorithm with the same features
as the CRISP-DM notebook (`risk_score`, `zip_mismatch`, `foreign_ip`, `payment_method`, etc.).
The Python job loads `fraud_model.joblib` (produced by the notebook) if present, otherwise
falls back to the same heuristic.

---

## Prediction Contract

All predictions use the **fraud** schema:

| Column | Type | Description |
|--------|------|-------------|
| `order_id` | bigint PK | FK → orders |
| `fraud_probability` | numeric | Probability score 0–1 |
| `predicted_fraud` | integer | 1 if prob ≥ 0.35 threshold |
| `prediction_timestamp` | text | MST timestamp of scoring run |

---

## Python Pipeline Jobs

Run in order when working locally:

```bash
python jobs/etl_build_warehouse.py   # ETL → data/warehouse.db
python jobs/train_model.py            # train → artifacts/late_delivery_model.sav
python jobs/run_inference.py          # score → shop.db order_predictions table
```

Expected stdout from `run_inference.py`:

```
scored=5004
method=model       # or "fallback" if fraud_model.joblib not found
timestamp=2025-01-15 14:32:01
```

---

## Developer Pages

- `/debug/schema` — shows live Supabase table column names (dev only)
