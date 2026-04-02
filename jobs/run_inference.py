#!/usr/bin/env python3
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


def clamp(value: float, low: float, high: float) -> float:
    return max(low, min(high, value))


def now_mst_string() -> str:
    return datetime.now(ZoneInfo("America/Phoenix")).strftime("%Y-%m-%d %H:%M:%S")


def load_live_df(conn):
    orders = pd.read_sql(
        """
        SELECT order_id, customer_id, order_datetime, COALESCE(order_total, 0) AS total_value
        FROM orders
        """,
        conn,
    )
    customers = pd.read_sql("SELECT customer_id, birthdate FROM customers", conn)
    order_items = pd.read_sql("SELECT order_id, quantity FROM order_items", conn)

    item_features = (
        order_items.groupby("order_id", as_index=False)
        .agg(num_items=("quantity", "sum"))
    )
    order_counts = (
        orders.groupby("customer_id", as_index=False)
        .agg(customer_order_count=("order_id", "count"))
    )

    df = orders.merge(customers, on="customer_id", how="left").merge(item_features, on="order_id", how="left")
    df = df.merge(order_counts, on="customer_id", how="left")
    df["num_items"] = df["num_items"].fillna(0)
    df["avg_weight"] = None  # placeholder to match training feature schema

    df["order_datetime"] = pd.to_datetime(df["order_datetime"], errors="coerce")
    df["birthdate"] = pd.to_datetime(df["birthdate"], errors="coerce")
    df["customer_age"] = datetime.now().year - df["birthdate"].dt.year
    df["order_dow"] = df["order_datetime"].dt.dayofweek
    df["order_month"] = df["order_datetime"].dt.month
    return df


def score_with_fallback(row: dict) -> tuple[float, int]:
    # Deterministic backup scorer when model artifacts or dependencies are unavailable.
    prob = 0.06
    prob += min(row["total_value"] / 900.0, 0.5)
    prob += min(row["num_items"] / 50.0, 0.2)
    if row["customer_order_count"] <= 2:
        prob += 0.06
    if row["order_dow"] in (4, 5, 6):
        prob += 0.04
    prob = clamp(prob, 0.01, 0.99)
    return prob, int(prob >= 0.5)


def score_with_model_if_available(live_df) -> tuple[list[tuple[int, float, int]], str]:
    if joblib is None or not MODEL_PATH.exists():
        method = "fallback"
        scored = []
        for row in live_df.to_dict(orient="records"):
            prob, pred = score_with_fallback(
                {
                    "total_value": float(row["total_value"]),
                    "num_items": float(row["num_items"]),
                    "customer_order_count": float(row["customer_order_count"]),
                    "order_dow": row["order_dow"],
                }
            )
            scored.append((int(row["order_id"]), prob, pred))
        return scored, method

    try:
        model = joblib.load(str(MODEL_PATH))
        X_live = live_df[
            [
                "num_items",
                "total_value",
                "customer_age",
                "order_dow",
                "order_month",
                "customer_order_count",
            ]
        ]
        probs = model.predict_proba(X_live)[:, 1]
        preds = model.predict(X_live)
        scored = [
            (int(oid), float(p), int(yhat))
            for oid, p, yhat in zip(live_df["order_id"], probs, preds)
        ]
        return scored, "model"
    except Exception as exc:  # noqa: BLE001
        print(f"warning: model scoring failed, using fallback ({exc})", file=sys.stderr)
        scored = []
        for row in live_df.to_dict(orient="records"):
            prob, pred = score_with_fallback(
                {
                    "total_value": float(row["total_value"]),
                    "num_items": float(row["num_items"]),
                    "customer_order_count": float(row["customer_order_count"]),
                    "order_dow": row["order_dow"],
                }
            )
            scored.append((int(row["order_id"]), prob, pred))
        return scored, "fallback"


def main() -> int:
    if pd is None:
        print("error: pandas is required for inference", file=sys.stderr)
        return 1
    if not OP_DB_PATH.exists():
        print(f"error: missing database at {OP_DB_PATH}", file=sys.stderr)
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
                (order_id, late_delivery_probability, predicted_late_delivery, prediction_timestamp)
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
