from reports.cache import get_or_set
from reports.keys import report_key

SUMMARY_TTL_SECONDS = 300


def monthly_summary(db, tenant_id, month):
    def load():
        rows = db.invoices_for(tenant_id, month)
        return {"count": len(rows), "total_cents": sum(row["cents"] for row in rows)}

    return get_or_set(report_key("monthly-summary", month), SUMMARY_TTL_SECONDS, load)
