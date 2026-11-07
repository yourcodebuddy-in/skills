import csv


def export_entries(path, entries):
    with open(path, "w", newline="") as handle:
        writer = csv.writer(handle)
        writer.writerow(["date", "description", "amount"])
        for entry in entries:
            writer.writerow([entry.date, entry.description, entry.cents / 100])
