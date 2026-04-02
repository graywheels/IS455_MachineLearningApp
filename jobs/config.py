from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]

DATA_DIR = PROJECT_ROOT / "data"
ARTIFACTS_DIR = PROJECT_ROOT / "artifacts"

# Prefer course-style /data layout if present, otherwise use project-root DB.
OP_DB_PATH = DATA_DIR / "shop.db" if (DATA_DIR / "shop.db").exists() else PROJECT_ROOT / "shop.db"
WH_DB_PATH = DATA_DIR / "warehouse.db"

# fraud_model.joblib is produced by model_training.ipynb (CRISP-DM notebook).
# It is a dict: {"pipeline": sklearn.Pipeline, "decision_threshold": float,
#                "all_input_columns": list[str], ...}
MODEL_PATH = PROJECT_ROOT / "fraud_model.joblib"
MODEL_METADATA_PATH = ARTIFACTS_DIR / "model_metadata.json"
METRICS_PATH = ARTIFACTS_DIR / "metrics.json"
