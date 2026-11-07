from reports.cache import get_or_set
from reports.keys import report_key


def platform_status(period, load):
    return get_or_set(report_key("platform-status", period), 60, lambda: load(period))
