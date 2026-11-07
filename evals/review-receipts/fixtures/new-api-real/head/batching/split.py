from itertools import batched


def split(rows, size):
    return [list(batch) for batch in batched(rows, size)]


def split_exact(rows, size):
    return [list(batch) for batch in batched(rows, size, strict=True)]
