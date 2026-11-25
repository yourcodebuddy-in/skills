"""Values shared across the package."""

DEFAULT_DB_PATH = "usagebill.db"
DEFAULT_PLANS_PATH = "config/plans.json"
DEFAULT_LOG_LEVEL = "INFO"

# Invoices
DEFAULT_DUE_DAYS = 30
INVOICE_STATUSES = ("draft", "finalized", "sent")

# Usage files
REQUIRED_COLUMNS = ("account", "metric", "quantity", "occurred_at")
MAX_ERRORS_REPORTED = 20
ACCOUNT_PATTERN = r"^[a-z0-9][a-z0-9-]{1,31}$"

# Accounting webhook
WEBHOOK_MAX_ATTEMPTS = 4
WEBHOOK_BACKOFF_SECONDS = (2, 10, 30)
WEBHOOK_TIMEOUT_SECONDS = 15
USER_AGENT = "usagebill/1.4"
