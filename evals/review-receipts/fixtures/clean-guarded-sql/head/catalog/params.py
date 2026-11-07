from dataclasses import dataclass

SORT_COLUMNS = {"id": "id", "name": "name", "price": "price_cents"}
SORT_DIRECTIONS = {"asc": "ASC", "desc": "DESC"}


@dataclass(frozen=True)
class Sort:
    column: str
    direction: str

    def __post_init__(self):
        if self.column not in SORT_COLUMNS.values():
            raise ValueError("unknown sort column")
        if self.direction not in SORT_DIRECTIONS.values():
            raise ValueError("unknown sort direction")


def parse_sort(raw):
    field, _, direction = (raw or "id:asc").partition(":")
    if field not in SORT_COLUMNS or direction not in SORT_DIRECTIONS:
        raise ValueError("invalid sort")
    return Sort(SORT_COLUMNS[field], SORT_DIRECTIONS[direction])
