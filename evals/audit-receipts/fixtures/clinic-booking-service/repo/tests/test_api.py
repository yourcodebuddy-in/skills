from datetime import timedelta

from helpers import PASSWORD, ClinicTestCase


class PublicEndpointsTest(ClinicTestCase):
    def test_health(self):
        self.assertEqual(self.call("GET", "/healthz"), (200, {"status": "ok"}))

    def test_practitioners_are_listed_by_clinic(self):
        status, body = self.call("GET", "/api/clinics/harbor-east/practitioners")
        self.assertEqual(status, 200)
        self.assertEqual([p["name"] for p in body["practitioners"]], ["Dr Ana Ruiz"])
        self.assertEqual(body["clinic"]["timezone"], "America/New_York")

    def test_slots_for_a_day(self):
        status, body = self.call("GET", f"/api/clinics/harbor-east/practitioners/{self.east_doc.id}/slots?date=2026-03-04")
        self.assertEqual(status, 200)
        self.assertEqual(body["slots"][0]["start"], "2026-03-04T09:00")

    def test_slots_need_a_valid_date(self):
        status, body = self.call("GET", f"/api/clinics/harbor-east/practitioners/{self.east_doc.id}/slots?date=soon")
        self.assertEqual((status, body["error"]["code"]), (400, "invalid"))

    def test_practitioner_of_another_clinic_is_not_found(self):
        status, _ = self.call("GET", f"/api/clinics/harbor-east/practitioners/{self.west_doc.id}/slots?date=2026-03-04")
        self.assertEqual(status, 404)

    def test_register_then_sign_in(self):
        status, body = self.call(
            "POST",
            "/api/clinics/harbor-east/register",
            body={"name": "Ivy Chen", "email": "Ivy@Example.com", "phone": "(646) 555-0100", "password": PASSWORD},
        )
        self.assertEqual(status, 201)
        self.assertEqual(body["patient"]["email"], "ivy@example.com")
        self.assertEqual(body["patient"]["phone"], "+16465550100")
        status, body = self.call("POST", "/api/login", body={"email": "ivy@example.com", "password": PASSWORD})
        self.assertEqual(status, 200)
        self.assertTrue(body["token"])

    def test_register_twice_is_a_conflict(self):
        payload = {"name": "Ivy Chen", "email": "ivy@example.com", "password": PASSWORD}
        self.call("POST", "/api/clinics/harbor-east/register", body=payload)
        status, _ = self.call("POST", "/api/clinics/harbor-east/register", body=payload)
        self.assertEqual(status, 409)

    def test_wrong_password_is_unauthorized(self):
        self.add_user(self.east, "desk@harbor.example", "staff")
        status, _ = self.call("POST", "/api/login", body={"email": "desk@harbor.example", "password": "nope-nope-nope"})
        self.assertEqual(status, 401)


class RequestHandlingTest(ClinicTestCase):
    def test_signed_in_routes_need_a_token(self):
        self.assertEqual(self.call("GET", "/api/bookings")[0], 401)

    def test_unknown_token_is_rejected(self):
        self.assertEqual(self.call("GET", "/api/bookings", token="not-a-token")[0], 401)

    def test_unknown_path_and_wrong_method(self):
        self.assertEqual(self.call("GET", "/api/nothing")[0], 404)
        self.assertEqual(self.call("DELETE", "/api/login")[0], 405)

    def test_body_must_be_a_json_object(self):
        token = self.add_user(self.east, "desk@harbor.example", "staff")
        response = self.app().handle("POST", "/api/bookings", {"Authorization": f"Bearer {token}"}, b"[1, 2]")
        self.assertEqual(response.status, 400)

    def test_large_body_is_refused(self):
        response = self.app().handle("POST", "/api/login", {}, b"x" * (65 * 1024))
        self.assertEqual(response.status, 413)


class PatientFlowTest(ClinicTestCase):
    def setUp(self):
        super().setUp()
        self.patient = self.add_patient(self.east, "sam@example.com")
        self.token = self.add_user(self.east, "sam@example.com", "patient", patient=self.patient)

    def book(self, start, token=None):
        return self.call(
            "POST",
            "/api/bookings",
            token=token or self.token,
            body={"practitioner_id": self.east_doc.id, "start": start},
        )

    def test_patient_books_and_sees_their_bookings(self):
        status, body = self.book("2026-03-04T09:00")
        self.assertEqual(status, 201)
        self.assertEqual(body["booking"]["start"], "2026-03-04T09:00")
        status, body = self.call("GET", "/api/bookings", token=self.token)
        self.assertEqual([b["start_utc"] for b in body["bookings"]], ["2026-03-04T14:00:00Z"])

    def test_patient_cannot_see_another_patients_booking(self):
        other = self.add_patient(self.east, "kim@example.com")
        other_token = self.add_user(self.east, "kim@example.com", "patient", patient=other)
        _, body = self.book("2026-03-04T09:00", token=other_token)
        status, _ = self.call("GET", f"/api/bookings/{body['booking']['id']}", token=self.token)
        self.assertEqual(status, 404)

    def test_patient_cannot_cancel_another_patients_booking(self):
        other = self.add_patient(self.east, "kim@example.com")
        other_token = self.add_user(self.east, "kim@example.com", "patient", patient=other)
        _, body = self.book("2026-03-04T09:00", token=other_token)
        status, _ = self.call("POST", f"/api/bookings/{body['booking']['id']}/cancel", token=self.token)
        self.assertEqual(status, 404)

    def test_patient_cancels_their_booking(self):
        _, body = self.book("2026-03-04T09:00")
        status, body = self.call("POST", f"/api/bookings/{body['booking']['id']}/cancel", token=self.token)
        self.assertEqual((status, body["booking"]["status"]), (200, "cancelled"))

    def test_patient_reschedules_and_is_told(self):
        _, body = self.book("2026-03-04T09:00")
        status, body = self.call(
            "POST", f"/api/bookings/{body['booking']['id']}/reschedule", token=self.token, body={"start": "2026-03-05T10:00"}
        )
        self.assertEqual((status, body["booking"]["start"]), (200, "2026-03-05T10:00"))
        self.assertEqual(len(self.sms.sent), 1)

    def test_fourth_upcoming_booking_is_refused(self):
        for start in ("2026-03-04T09:00", "2026-03-04T09:30", "2026-03-04T10:00"):
            self.assertEqual(self.book(start)[0], 201)
        status, body = self.book("2026-03-04T10:30")
        self.assertEqual((status, body["error"]["code"]), (409, "limit_reached"))

    def test_patient_cannot_list_patients_or_mark_no_shows(self):
        _, body = self.book("2026-03-04T09:00")
        self.assertEqual(self.call("GET", "/api/patients", token=self.token)[0], 403)
        self.assertEqual(self.call("POST", f"/api/bookings/{body['booking']['id']}/no-show", token=self.token)[0], 403)

    def test_patient_can_store_a_card(self):
        status, body = self.call(
            "PUT", f"/api/patients/{self.patient.id}/card", token=self.token, body={"card_ref": "card_new"}
        )
        self.assertEqual((status, body["patient"]["has_card"]), (200, True))


class StaffFlowTest(ClinicTestCase):
    def setUp(self):
        super().setUp()
        self.patient = self.add_patient(self.east, "sam@example.com", name="Sam Lee")
        self.add_patient(self.east, "abe@example.com", name="Abe Moss")
        self.staff = self.add_user(self.east, "desk@harbor.example", "staff")
        self.admin = self.add_user(self.east, "admin@harbor.example", "admin")

    def test_staff_books_for_a_patient_and_lists_the_day(self):
        status, _ = self.call(
            "POST",
            "/api/bookings",
            token=self.staff,
            body={"practitioner_id": self.east_doc.id, "patient_id": self.patient.id, "start": "2026-03-04T11:00"},
        )
        self.assertEqual(status, 201)
        status, body = self.call("GET", "/api/bookings?date=2026-03-04", token=self.staff)
        self.assertEqual([b["start"] for b in body["bookings"]], ["2026-03-04T11:00"])

    def test_staff_cannot_book_another_clinics_patient(self):
        stranger = self.add_patient(self.west, "lou@example.com")
        status, _ = self.call(
            "POST",
            "/api/bookings",
            token=self.staff,
            body={"practitioner_id": self.east_doc.id, "patient_id": stranger.id, "start": "2026-03-04T11:00"},
        )
        self.assertEqual(status, 404)

    def test_staff_cannot_read_another_clinics_booking(self):
        stranger = self.add_patient(self.west, "lou@example.com")
        booking = self.book(self.west, self.west_doc, stranger, "2026-03-04T11:00")
        self.assertEqual(self.call("GET", f"/api/bookings/{booking.id}", token=self.staff)[0], 404)

    def test_staff_marks_a_no_show(self):
        booking = self.book(self.east, self.east_doc, self.patient, "2026-03-02T11:00")
        self.now = self.now + timedelta(hours=2)
        status, body = self.call("POST", f"/api/bookings/{booking.id}/no-show", token=self.staff)
        self.assertEqual((status, body["booking"]["status"]), (200, "no_show"))

    def test_patient_list_sorts_and_searches(self):
        _, body = self.call("GET", "/api/patients?sort=name", token=self.staff)
        self.assertEqual([p["name"] for p in body["patients"]], ["Abe Moss", "Sam Lee"])
        _, body = self.call("GET", "/api/patients?q=moss", token=self.staff)
        self.assertEqual([p["name"] for p in body["patients"]], ["Abe Moss"])
        self.assertEqual(self.call("GET", "/api/patients?sort=phone", token=self.staff)[0], 400)

    def test_staff_adds_a_patient(self):
        status, body = self.call(
            "POST", "/api/patients", token=self.staff, body={"name": "Dee Park", "email": "dee@example.com", "phone": ""}
        )
        self.assertEqual((status, body["patient"]["phone"]), (201, None))

    def test_only_admins_export(self):
        self.assertEqual(self.call("GET", "/api/export/bookings.csv?from=2026-03-01&to=2026-03-31", token=self.staff)[0], 403)
        status, text = self.call("GET", "/api/export/bookings.csv?from=2026-03-01&to=2026-03-31", token=self.admin)
        self.assertEqual(status, 200)
        self.assertTrue(text.startswith("booking_id,date,time"))

    def test_sign_out_ends_the_session(self):
        self.assertEqual(self.call("POST", "/api/logout", token=self.staff)[0], 200)
        self.assertEqual(self.call("GET", "/api/bookings", token=self.staff)[0], 401)
