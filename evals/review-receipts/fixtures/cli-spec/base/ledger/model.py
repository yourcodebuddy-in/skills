from dataclasses import dataclass


@dataclass
class Entry:
    date: str
    description: str
    cents: int
    archived: bool = False
