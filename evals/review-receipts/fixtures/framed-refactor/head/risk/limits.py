DAILY_LIMIT_CENTS = 100_000
REVIEW_THRESHOLD_CENTS = 50_000


def can_transfer(sent_today_cents, amount_cents):
    return sent_today_cents + amount_cents <= DAILY_LIMIT_CENTS


def needs_review(amount_cents):
    return amount_cents > REVIEW_THRESHOLD_CENTS
