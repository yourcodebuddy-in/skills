import sys


def main(argv, entries):
    if argv[:1] == ["count"]:
        print(sum(1 for entry in entries if not entry.archived))
        return 0
    print("usage: ledger count", file=sys.stderr)
    return 2
