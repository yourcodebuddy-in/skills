from collections import defaultdict


def total_revenue(orders):
    return sum(order["cents"] for order in orders)


def revenue_by_region(orders, addresses):
    totals = defaultdict(int)
    for order in orders:
        for address in addresses:
            if address["customer_id"] == order["customer_id"]:
                totals[address["region"]] += order["cents"]
    return dict(totals)
