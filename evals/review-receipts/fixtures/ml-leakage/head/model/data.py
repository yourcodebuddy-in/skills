def train_test_split(rows, test_fraction=0.2):
    cut = int(len(rows) * (1 - test_fraction))
    return rows[:cut], rows[cut:]


def normalize(rows):
    low, high = min(rows), max(rows)
    return [(value - low) / (high - low) for value in rows]


def prepare(rows):
    return train_test_split(normalize(rows))
