import shutil
import tempfile
import unittest
from pathlib import Path

from helpers import NOW

from clinicbook import db, migrate


class MigrateTest(unittest.TestCase):
    def setUp(self):
        tmp = tempfile.mkdtemp(prefix="clinicbook-migrate-")
        self.addCleanup(shutil.rmtree, tmp, ignore_errors=True)
        self.conn = db.connect(str(Path(tmp) / "m.sqlite3"))
        self.addCleanup(self.conn.close)

    def test_fresh_database_gets_every_migration(self):
        ran = migrate.migrate(self.conn, now=NOW)
        self.assertEqual(ran, [m.path.name for m in migrate.available()])
        tables = {r[0] for r in self.conn.execute("SELECT name FROM sqlite_master WHERE type = 'table'")}
        self.assertTrue({"clinics", "bookings", "outbox", "fee_jobs", "schema_migrations"} <= tables)

    def test_second_run_does_nothing(self):
        migrate.migrate(self.conn, now=NOW)
        self.assertEqual(migrate.migrate(self.conn, now=NOW), [])

    def test_target_stops_early(self):
        self.assertEqual(migrate.migrate(self.conn, now=NOW, target=2), ["001_initial.sql", "002_outbox.sql"])
        self.assertEqual(migrate.applied(self.conn), {1, 2})

    def test_failed_migration_leaves_nothing_behind(self):
        migrate.migrate(self.conn, now=NOW, target=1)
        self.conn.execute("CREATE TABLE outbox (id INTEGER)")
        with self.assertRaises(migrate.MigrationError):
            migrate.migrate(self.conn, now=NOW, target=2)
        self.assertEqual(migrate.applied(self.conn), {1})
        columns = [r[1] for r in self.conn.execute("PRAGMA table_info(bookings)")]
        self.assertNotIn("reminder_queued", columns)
