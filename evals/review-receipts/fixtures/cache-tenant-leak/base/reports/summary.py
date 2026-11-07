def monthly_summary(db, tenant_id, month):
    rows = db.invoices_for(tenant_id, month)
    return {"count": len(rows), "total_cents": sum(row["cents"] for row in rows)}
