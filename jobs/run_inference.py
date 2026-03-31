#!/usr/bin/env python3
import sqlite3
import sys
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo


def clamp(value: float, low: float, high: float) -> float:
    return max(low, min(high, value))


def main() -> int:
    db_path = Path(__file__).resolve().parents[1] / "shop.db"
    if not db_path.exists():
        print(f"error: missing database at {db_path}", file=sys.stderr)
        return 1

    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row

    try:
        has_predictions = conn.execute(
            "SELECT name FROM sqlite_master WHERE type='table' AND name='order_predictions'"
        ).fetchone()
        if not has_predictions:
            print("error: missing required table order_predictions", file=sys.stderr)
            return 1

        rows = conn.execute(
            """
            SELECT order_id, COALESCE(order_total, 0) AS order_total
            FROM orders
            """
        ).fetchall()

        now = datetime.now(ZoneInfo("America/Phoenix")).strftime("%Y-%m-%d %H:%M:%S")
        scored = 0

        for row in rows:
            order_id = row["order_id"]
            order_total = float(row["order_total"])
            probability = clamp(0.05 + (order_total / 500.0), 0.01, 0.99)
            predicted = 1 if probability >= 0.5 else 0

            conn.execute(
                """
                INSERT INTO order_predictions (
                  order_id, late_delivery_probability, predicted_late_delivery, prediction_timestamp
                ) VALUES (?, ?, ?, ?)
                ON CONFLICT(order_id) DO UPDATE SET
                  late_delivery_probability = excluded.late_delivery_probability,
                  predicted_late_delivery = excluded.predicted_late_delivery,
                  prediction_timestamp = excluded.prediction_timestamp
                """,
                (order_id, probability, predicted, now),
            )
            scored += 1

        conn.commit()
        print(f"scored={scored}")
        return 0
    except Exception as exc:  # noqa: BLE001
        conn.rollback()
        print(f"error: {exc}", file=sys.stderr)
        return 1
    finally:
        conn.close()


if __name__ == "__main__":
    raise SystemExit(main())
