from datetime import timedelta

from helpers import FAST_ITERATIONS, NOW, PASSWORD, ClinicTestCase

from clinicbook import auth
from clinicbook.errors import Conflict, Forbidden, Unauthorized


class PasswordTest(ClinicTestCase):
    def test_hash_verifies_only_the_same_password(self):
        stored = auth.hash_password("s3cret-enough", iterations=FAST_ITERATIONS)
        self.assertTrue(auth.verify_password("s3cret-enough", stored))
        self.assertFalse(auth.verify_password("s3cret-enougH", stored))

    def test_hashes_are_salted(self):
        self.assertNotEqual(
            auth.hash_password("same", iterations=FAST_ITERATIONS), auth.hash_password("same", iterations=FAST_ITERATIONS)
        )

    def test_malformed_hash_never_verifies(self):
        self.assertFalse(auth.verify_password("anything", "plain-text"))


class SessionTest(ClinicTestCase):
    def setUp(self):
        super().setUp()
        self.token = self.add_user(self.east, "Desk@Harbor.example", "staff")

    def test_login_is_case_insensitive_on_email(self):
        token = auth.login(self.conn, "DESK@harbor.example ", PASSWORD, NOW, 12)
        self.assertEqual(auth.authenticate(self.conn, token, NOW).email, "desk@harbor.example")

    def test_wrong_password_and_unknown_email_fail_the_same_way(self):
        with self.assertRaises(Unauthorized) as wrong:
            auth.login(self.conn, "desk@harbor.example", "not the password", NOW, 12)
        with self.assertRaises(Unauthorized) as unknown:
            auth.login(self.conn, "nobody@harbor.example", PASSWORD, NOW, 12)
        self.assertEqual(wrong.exception.message, unknown.exception.message)

    def test_every_attempt_is_recorded(self):
        with self.assertRaises(Unauthorized):
            auth.login(self.conn, "desk@harbor.example", "not the password", NOW, 12)
        rows = self.conn.execute("SELECT succeeded FROM login_attempts ORDER BY id").fetchall()
        self.assertEqual([r[0] for r in rows], [1, 0])

    def test_session_expires(self):
        self.assertIsNotNone(auth.authenticate(self.conn, self.token, NOW + timedelta(hours=11)))
        self.assertIsNone(auth.authenticate(self.conn, self.token, NOW + timedelta(hours=12)))

    def test_logout_ends_the_session(self):
        auth.logout(self.conn, self.token)
        self.assertIsNone(auth.authenticate(self.conn, self.token, NOW))

    def test_tokens_are_stored_hashed(self):
        stored = self.conn.execute("SELECT token_hash FROM sessions").fetchone()[0]
        self.assertNotEqual(stored, self.token)

    def test_purge_removes_expired_sessions_and_old_attempts(self):
        later = NOW + timedelta(days=31)
        self.assertEqual(auth.purge(self.conn, later, 30), (1, 1))

    def test_email_is_unique_across_clinics(self):
        with self.assertRaises(Conflict):
            auth.create_user(self.conn, self.west.id, "desk@harbor.example", "x", "staff", NOW)

    def test_require_role(self):
        user = auth.authenticate(self.conn, self.token, NOW)
        self.assertIs(auth.require_role(user, "admin", "staff"), user)
        with self.assertRaises(Forbidden):
            auth.require_role(user, "admin")
