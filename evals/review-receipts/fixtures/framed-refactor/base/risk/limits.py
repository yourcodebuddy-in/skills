DAILY_LIMIT_CENTS = 100_000


def can_transfer(sent_today_cents, amount_cents):
    if sent_today_cents + amount_cents > DAILY_LIMIT_CENTS:
        return False
    return True


def needs_review(amount_cents):
    if amount_cents >= 50_000:
        return True
    return False
