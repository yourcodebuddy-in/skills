def charge_order(gateway, orders, order_id):
    order = orders.get(order_id)
    receipt = gateway.charge(order.customer_id, order.amount_cents)
    orders.mark_paid(order_id, receipt)
    return receipt
