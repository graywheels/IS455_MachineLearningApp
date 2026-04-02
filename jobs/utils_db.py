import sqlite3
from contextlib import contextmanager


@contextmanager
def sqlite_conn(db_path):
    conn = sqlite3.connect(str(db_path))
    conn.row_factory = sqlite3.Row
    try:
        yield conn
    finally:
        conn.close()


def ensure_predictions_table(conn):
    """Create order_predictions with fraud columns; migrate from late-delivery schema if needed."""
    cur = conn.cursor()
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS order_predictions (
          order_id              INTEGER PRIMARY KEY,
          fraud_probability     REAL,
          predicted_fraud       INTEGER,
          prediction_timestamp  TEXT
        )
        """
    )
    # Idempotent migration: add fraud columns if table was created with old late-delivery schema
    existing = {row[1] for row in cur.execute("PRAGMA table_info(order_predictions)")}
    if "fraud_probability" not in existing:
        cur.execute("ALTER TABLE order_predictions ADD COLUMN fraud_probability REAL")
    if "predicted_fraud" not in existing:
        cur.execute("ALTER TABLE order_predictions ADD COLUMN predicted_fraud INTEGER")
    conn.commit()
