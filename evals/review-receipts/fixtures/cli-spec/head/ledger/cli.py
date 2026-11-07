import sys

from ledger.export import export_entries


def main(argv, entries):
    if argv[:1] == ["count"]:
        print(sum(1 for entry in entries if not entry.archived))
        return 0
    if argv[:1] == ["export"] and len(argv) == 2:
        export_entries(argv[1], entries)
        return 0
    print("usage: ledger count | ledger export <file>", file=sys.stderr)
    return 2
