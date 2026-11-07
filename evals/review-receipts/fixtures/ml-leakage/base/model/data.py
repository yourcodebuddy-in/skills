def train_test_split(rows, test_fraction=0.2):
    cut = int(len(rows) * (1 - test_fraction))
    return rows[:cut], rows[cut:]
