def total_revenue(orders):
    return sum(order["cents"] for order in orders)
