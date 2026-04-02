#!/usr/bin/env python3
import json
import sys
from datetime import datetime
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]
LOCAL_PY_DEPS = PROJECT_ROOT / ".python_packages"
if LOCAL_PY_DEPS.exists():
    sys.path.insert(0, str(LOCAL_PY_DEPS))

try:
    import joblib
    import pandas as pd
    from sklearn.impute import SimpleImputer
    from sklearn.linear_model import LogisticRegression
    from sklearn.metrics import accuracy_score, f1_score, roc_auc_score
    from sklearn.model_selection import train_test_split
    from sklearn.pipeline import Pipeline
    from sklearn.preprocessing import StandardScaler
except Exception as exc:  # noqa: BLE001
    print(f"error: missing ML dependencies ({exc})", file=sys.stderr)
    raise SystemExit(1)

from config import ARTIFACTS_DIR, METRICS_PATH, MODEL_METADATA_PATH, MODEL_PATH, WH_DB_PATH
from utils_db import sqlite_conn

MODEL_VERSION = "1.0.0"


def train_and_save():
    if not WH_DB_PATH.exists():
        raise FileNotFoundError(f"missing warehouse DB: {WH_DB_PATH}. Run ETL first.")

    with sqlite_conn(WH_DB_PATH) as conn:
        df = pd.read_sql("SELECT * FROM modeling_orders", conn)

    label_col = "label_late_delivery"
    feature_cols = [
        "num_items",
        "total_value",
        "customer_age",
        "order_dow",
        "order_month",
        "customer_order_count",
    ]

    X = df[feature_cols]
    y = df[label_col].astype(int)
    if y.nunique() < 2:
        raise ValueError("label_late_delivery must contain at least 2 classes")

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )

    model = Pipeline(
        steps=[
            ("imputer", SimpleImputer(strategy="median")),
            ("scaler", StandardScaler()),
            ("clf", LogisticRegression(max_iter=500)),
        ]
    )

    model.fit(X_train, y_train)
    y_pred = model.predict(X_test)
    y_prob = model.predict_proba(X_test)[:, 1]

    metrics = {
        "accuracy": float(accuracy_score(y_test, y_pred)),
        "f1": float(f1_score(y_test, y_pred)),
        "roc_auc": float(roc_auc_score(y_test, y_prob)),
        "row_count_train": int(len(X_train)),
        "row_count_test": int(len(X_test)),
    }

    metadata = {
        "model_version": MODEL_VERSION,
        "trained_at_utc": datetime.utcnow().isoformat(),
        "feature_list": feature_cols,
        "label": label_col,
        "warehouse_table": "modeling_orders",
        "warehouse_rows": int(len(df)),
    }

    ARTIFACTS_DIR.mkdir(parents=True, exist_ok=True)
    joblib.dump(model, str(MODEL_PATH))

    with open(MODEL_METADATA_PATH, "w", encoding="utf-8") as f:
        json.dump(metadata, f, indent=2)
    with open(METRICS_PATH, "w", encoding="utf-8") as f:
        json.dump(metrics, f, indent=2)

    print("Training complete.")
    print(f"Saved model: {MODEL_PATH}")
    print(f"Saved metadata: {MODEL_METADATA_PATH}")
    print(f"Saved metrics: {METRICS_PATH}")


if __name__ == "__main__":
    try:
        train_and_save()
    except Exception as exc:  # noqa: BLE001
        print(f"error: {exc}", file=sys.stderr)
        raise SystemExit(1)
