import sqlite3, sys
c = sqlite3.connect(":memory:")
c.executescript(open("migrations/001_users.sql").read())
c.execute("INSERT INTO users (email) VALUES ('a@example.com')")
try:
    c.executescript(open("migrations/002_add_plan.sql").read())
    sys.exit(1)
except sqlite3.Error:
    sys.exit(0)
