#!/usr/bin/env python3
"""
Fraud inference job — reads shop.db, scores every order, writes to order_predictions.

Stdout contract (parsed by app/scoring/actions.js):
  scored=<n>
  method=<model|fallback>
  timestamp=<YYYY-MM-DD HH:MM:SS>
"""
import math
import sys
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

PROJECT_ROOT = Path(__file__).resolve().parents[1]
LOCAL_PY_DEPS = PROJECT_ROOT / ".python_packages"
if LOCAL_PY_DEPS.exists():
    sys.path.insert(0, str(LOCAL_PY_DEPS))

try:
    import pandas as pd
    import joblib  # type: ignore
except Exception:  # noqa: BLE001
    pd = None
    joblib = None

from config import MODEL_PATH, OP_DB_PATH
from utils_db import ensure_predictions_table, sqlite_conn

# Decision threshold stored alongside the model artifact.
# Fallback value matches the JS scorer in app/scoring/actions.js.
DEFAULT_THRESHOLD = 0.35


def now_mst_string() -> str:
    return datetime.now(ZoneInfo("America/Phoenix")).strftime("%Y-%m-%d %H:%M:%S")


# ── Data loading ──────────────────────────────────────────────────────────────

def load_live_df(conn):
    """Flatten orders + customers + order_items into the fraud feature matrix."""
    orders = pd.read_sql(
        """
        SELECT
            o.order_id,
            o.customer_id,
            o.order_datetime,
            o.billing_zip,
            o.shipping_zip,
            o.payment_method,
            o.device_type,
            o.ip_country,
            COALESCE(o.promo_used, 0)       AS promo_used,
            COALESCE(o.order_subtotal, 0)   AS order_subtotal,
            COALESCE(o.shipping_fee, 0)     AS shipping_fee,
            COALESCE(o.tax_amount, 0)       AS tax_amount,
            COALESCE(o.order_total, 0)      AS order_total,
            COALESCE(o.risk_score, 0)       AS risk_score,
            c.customer_segment,
            c.loyalty_tier,
            COALESCE(c.is_active, 1)        AS is_active
        FROM orders o
        JOIN customers c ON o.customer_id = c.customer_id
        """,
        conn,
    )

    item_stats = pd.read_sql(
        """
        SELECT
            order_id,
            SUM(quantity)                AS total_items,
            AVG(unit_price)              AS avg_unit_price,
            MAX(unit_price)              AS max_unit_price,
            COUNT(DISTINCT product_id)   AS distinct_products
        FROM order_items
        GROUP BY order_id
        """,
        conn,
    )

    df = orders.merge(item_stats, on="order_id", how="left")
    for col in ("total_items", "avg_unit_price", "max_unit_price", "distinct_products"):
        df[col] = df[col].fillna(0)

    # Feature engineering — must match model_training.ipynb exactly
    df["order_datetime"] = pd.to_datetime(df["order_datetime"], errors="coerce")
    df["order_hour"]       = df["order_datetime"].dt.hour.fillna(12).astype(int)
    df["order_dayofweek"]  = df["order_datetime"].dt.dayofweek.fillna(0).astype(int)
    df["is_weekend_order"] = (df["order_dayofweek"] >= 5).astype(int)
    df["is_late_night"]    = df["order_hour"].between(0, 5).astype(int)
    df["zip_mismatch"]     = (df["billing_zip"] != df["shipping_zip"]).astype(int)
    df["foreign_ip"]       = (df["ip_country"] != "US").astype(int)

    p95 = df["order_total"].quantile(0.95)
    df["high_value_order"] = (df["order_total"] > p95).astype(int)
    df["shipping_ratio"]   = df["shipping_fee"] / df["order_total"].replace(0, float("nan"))

    return df


# ── Fallback scorer (no sklearn / no model artifact) ─────────────────────────

def _fraud_fallback(row: dict) -> tuple[float, int]:
    """Logistic-regression–inspired fraud scorer using raw features."""
    logit = -3.8
    logit += min(float(row.get("risk_score", 0)), 1.0) * 4.0
    if row.get("billing_zip") != row.get("shipping_zip"):
        logit += 0.9
    if row.get("ip_country") != "US":
        logit += 1.3
    if row.get("promo_used"):
        logit += 0.35
    if float(row.get("max_unit_price", 0)) > 200:
        logit += 0.4
    pay = str(row.get("payment_method") or "").lower()
    if pay == "prepaid_card":
        logit += 0.9
    elif pay == "cryptocurrency":
        logit += 1.1
    prob = max(0.01, min(0.99, 1 / (1 + math.exp(-logit))))
    return prob, int(prob >= DEFAULT_THRESHOLD)


def _fallback_score_all(live_df) -> list[tuple[int, float, int]]:
    results = []
    for row in live_df.to_dict(orient="records"):
        prob, pred = _fraud_fallback(row)
        results.append((int(row["order_id"]), prob, pred))
    return results


# ── Model scorer ──────────────────────────────────────────────────────────────

def score_with_model_if_available(live_df) -> tuple[list[tuple[int, float, int]], str]:
    if joblib is None or not MODEL_PATH.exists():
        return _fallback_score_all(live_df), "fallback"

    try:
        artifact   = joblib.load(str(MODEL_PATH))
        pipeline   = artifact["pipeline"]
        threshold  = artifact.get("decision_threshold", DEFAULT_THRESHOLD)
        all_cols   = artifact["all_input_columns"]

        X_live = live_df[all_cols]
        probs  = pipeline.predict_proba(X_live)[:, 1]
        preds  = (probs >= threshold).astype(int)

        scored = [
            (int(oid), float(p), int(yhat))
            for oid, p, yhat in zip(live_df["order_id"], probs, preds)
        ]
        return scored, "model"

    except Exception as exc:  # noqa: BLE001
        print(f"warning: fraud model failed, using fallback ({exc})", file=sys.stderr)
        return _fallback_score_all(live_df), "fallback"


# ── Main ─────────────────────────────────────────────────────────────────────

def main() -> int:
    if pd is None:
        print("error: pandas is required — run: pip install -r requirements.txt", file=sys.stderr)
        return 1
    if not OP_DB_PATH.exists():
        print(f"error: database not found at {OP_DB_PATH}", file=sys.stderr)
        return 1

    try:
        with sqlite_conn(OP_DB_PATH) as conn:
            ensure_predictions_table(conn)
            live_df = load_live_df(conn)

            if live_df.empty:
                print("scored=0")
                print("method=none")
                return 0

            scored_rows, method = score_with_model_if_available(live_df)
            ts = now_mst_string()

            conn.executemany(
                """
                INSERT OR REPLACE INTO order_predictions
                    (order_id, fraud_probability, predicted_fraud, prediction_timestamp)
                VALUES (?, ?, ?, ?)
                """,
                [(order_id, prob, pred, ts) for order_id, prob, pred in scored_rows],
            )
            conn.commit()

        print(f"scored={len(scored_rows)}")
        print(f"method={method}")
        print(f"timestamp={ts}")
        return 0

    except Exception as exc:  # noqa: BLE001
        print(f"error: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
