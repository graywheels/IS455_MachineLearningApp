#!/usr/bin/env python3
import sys
from datetime import datetime
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]
LOCAL_PY_DEPS = PROJECT_ROOT / ".python_packages"
if LOCAL_PY_DEPS.exists():
    sys.path.insert(0, str(LOCAL_PY_DEPS))

try:
    import pandas as pd
except Exception as exc:  # noqa: BLE001
    print(f"error: pandas is required for ETL ({exc})", file=sys.stderr)
    raise SystemExit(1)

from config import OP_DB_PATH, WH_DB_PATH
from utils_db import sqlite_conn


def build_modeling_table():
    if not OP_DB_PATH.exists():
        raise FileNotFoundError(f"missing operational DB: {OP_DB_PATH}")

    with sqlite_conn(OP_DB_PATH) as conn:
        orders = pd.read_sql("SELECT * FROM orders", conn)
        customers = pd.read_sql("SELECT customer_id, birthdate FROM customers", conn)
        order_items = pd.read_sql("SELECT order_id, quantity FROM order_items", conn)

    item_features = (
        order_items.groupby("order_id", as_index=False)
        .agg(num_items=("quantity", "sum"))
    )

    df = orders.merge(customers, on="customer_id", how="left").merge(item_features, on="order_id", how="left")
    df["num_items"] = df["num_items"].fillna(0)
    df["total_value"] = df["order_total"].fillna(0)
    df["avg_weight"] = None  # not present in current schema, retained for model compatibility

    df["order_datetime"] = pd.to_datetime(df["order_datetime"], errors="coerce")
    df["birthdate"] = pd.to_datetime(df["birthdate"], errors="coerce")
    now_year = datetime.now().year
    df["customer_age"] = now_year - df["birthdate"].dt.year
    df["order_dow"] = df["order_datetime"].dt.dayofweek
    df["order_month"] = df["order_datetime"].dt.month

    # Historical order volume feature
    df["customer_order_count"] = df.groupby("customer_id")["order_id"].transform("count")

    # Preferred label if available. Fallback label keeps training runnable for student demo data.
    if "is_fraud" in df.columns and df["is_fraud"].nunique(dropna=True) > 1:
        df["label_late_delivery"] = df["is_fraud"].fillna(0).astype(int)
    else:
        threshold = df["total_value"].median()
        df["label_late_delivery"] = (df["total_value"] >= threshold).astype(int)

    modeling_cols = [
        "order_id",
        "customer_id",
        "num_items",
        "total_value",
        "avg_weight",
        "customer_age",
        "order_dow",
        "order_month",
        "customer_order_count",
        "label_late_delivery",
    ]

    df_model = df[modeling_cols]

    WH_DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    with sqlite_conn(WH_DB_PATH) as wh_conn:
        df_model.to_sql("modeling_orders", wh_conn, if_exists="replace", index=False)

    return len(df_model)


if __name__ == "__main__":
    try:
        row_count = build_modeling_table()
        print(f"Warehouse updated. modeling_orders rows: {row_count}")
    except Exception as exc:  # noqa: BLE001
        print(f"error: {exc}", file=sys.stderr)
        raise SystemExit(1)
