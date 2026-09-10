import io
import unittest
import uuid
from fastapi.testclient import TestClient

from app.main import app
from app.models.appointment import appointment_store
from app.models.user import user_store


class TestSosAndFeatures(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)

    def _register_and_login_doctor(self, doctor_id="DOC99901", dept="Cardiology"):
        payload = {
            "name": f"Dr. Specialist {doctor_id}",
            "doctor_id": doctor_id,
            "department": dept,
            "specialty": dept,
            "password": "Password123!",
            "role": "doctor",
            "phone": "+91-9876543210",
        }
        self.client.post("/api/auth/register", json=payload)
        login_res = self.client.post(
            "/api/auth/login",
            json={"identifier": doctor_id, "password": "Password123!"},
        )
        return login_res.json()["data"]["access_token"], login_res.json()["data"]["user"]

    def _register_and_login_patient(self, abha_id=None):
        if not abha_id:
            abha_id = "".join([str((i * 7 + 3) % 10) for i in range(14)])
        payload = {
            "name": f"Patient {abha_id[-4:]}",
            "abha_id": abha_id,
            "password": "Password123!",
            "role": "patient",
            "consent": True,
            "phone": "+91-9123456789",
        }
        self.client.post("/api/auth/register", json=payload)
        login_res = self.client.post(
            "/api/auth/login",
            json={"identifier": abha_id, "password": "Password123!"},
        )
        return login_res.json()["data"]["access_token"], login_res.json()["data"]["user"]

    def test_sos_trigger_and_doctor_notification(self):
        doc_id = f"DOC{uuid.uuid4().hex[:5].upper()}"
        doc_token, doc_user = self._register_and_login_doctor(doctor_id=doc_id, dept="Emergency Medicine")
        pat_token, pat_user = self._register_and_login_patient()

        # Trigger SOS
        sos_res = self.client.post(
            "/api/patients/me/sos",
            headers={"Authorization": f"Bearer {pat_token}"},
        )
        self.assertEqual(sos_res.status_code, 201)
        data = sos_res.json()["data"]
        appt = data["appointment"]
        self.assertTrue(appt["is_sos"])
        self.assertEqual(appt["type"], "sos")
        self.assertEqual(appt["status"], "confirmed")
        self.assertTrue(appt["urgent"])

        # Check Doctor notifications
        notif_res = self.client.get(
            "/api/doctors/me/notifications",
            headers={"Authorization": f"Bearer {doc_token}"},
        )
        self.assertEqual(notif_res.status_code, 200)
        notif_data = notif_res.json()["data"]
        self.assertGreaterEqual(notif_data["urgent_count"], 1)
        matching = [n for n in notif_data["notifications"] if n["appointment_id"] == appt["id"]]
        self.assertEqual(len(matching), 1)

        # Check Doctor appointments list
        appts_res = self.client.get(
            "/api/doctors/me/appointments",
            headers={"Authorization": f"Bearer {doc_token}"},
        )
        self.assertEqual(appts_res.status_code, 200)
        dept_appts = appts_res.json()["data"]
        sos_appts = [a for a in dept_appts if a["id"] == appt["id"]]
        self.assertEqual(len(sos_appts), 1)
        self.assertTrue(sos_appts[0]["is_sos"])

    def test_single_booking_limit_and_sos_exemption(self):
        pat_token, pat_user = self._register_and_login_patient()
        case_id = f"case_{uuid.uuid4().hex[:8]}"

        # 1. First booking for this case sheet session
        booking_payload = {
            "department": "Cardiology",
            "preferred_date": "2026-09-15",
            "note": "First appointment request",
            "urgent": False,
            "case_sheet_id": case_id,
        }
        res1 = self.client.post(
            "/api/patients/me/appointments",
            json=booking_payload,
            headers={"Authorization": f"Bearer {pat_token}"},
        )
        self.assertEqual(res1.status_code, 201)

        # 2. Duplicate booking for the same case sheet session should be rejected
        res2 = self.client.post(
            "/api/patients/me/appointments",
            json=booking_payload,
            headers={"Authorization": f"Bearer {pat_token}"},
        )
        self.assertEqual(res2.status_code, 400)
        self.assertIn("already been booked", res2.text)

        # 3. SOS booking must NOT be blocked by the single booking limit
        sos_res = self.client.post(
            "/api/patients/me/sos",
            headers={"Authorization": f"Bearer {pat_token}"},
        )
        self.assertEqual(sos_res.status_code, 201)

        # 4. A fresh case session can book without issue
        res3 = self.client.post(
            "/api/patients/me/appointments",
            json={
                "department": "Neurology",
                "preferred_date": "2026-09-20",
                "note": "Fresh session booking",
                "urgent": False,
                "case_sheet_id": f"case_{uuid.uuid4().hex[:8]}",
            },
            headers={"Authorization": f"Bearer {pat_token}"},
        )
        self.assertEqual(res3.status_code, 201)

    def test_get_my_doctors(self):
        doc_id = f"DOC{uuid.uuid4().hex[:5].upper()}"
        _, doc_user = self._register_and_login_doctor(doctor_id=doc_id, dept="Orthopedics")
        pat_token, _ = self._register_and_login_patient()

        # Link doctor via an appointment
        self.client.post(
            "/api/patients/me/appointments",
            json={
                "doctor_id": doc_user["id"],
                "doctor_name": doc_user["name"],
                "department": "Orthopedics",
                "preferred_date": "2026-09-16",
            },
            headers={"Authorization": f"Bearer {pat_token}"},
        )

        res = self.client.get(
            "/api/patients/me/doctors",
            headers={"Authorization": f"Bearer {pat_token}"},
        )
        self.assertEqual(res.status_code, 200)
        doctors = res.json()["data"]
        self.assertGreaterEqual(len(doctors), 1)
        found = any(d.get("name") == doc_user["name"] for d in doctors)
        self.assertTrue(found)
        doc = next(d for d in doctors if d.get("name") == doc_user["name"])
        self.assertIn("hospital_name", doc)
        self.assertIn("hospital_contact", doc)
        self.assertIn("specialisation", doc)

    def test_profile_picture_upload(self):
        pat_token, _ = self._register_and_login_patient()

        # 1. Valid JPG with magic bytes
        jpg_data = b"\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x01\x00`\x00`\x00\x00" + b"\x00" * 200
        res = self.client.post(
            "/api/auth/profile-picture",
            files={"file": ("avatar.jpg", io.BytesIO(jpg_data), "image/jpeg")},
            headers={"Authorization": f"Bearer {pat_token}"},
        )
        self.assertEqual(res.status_code, 200)
        data = res.json()["data"]
        self.assertTrue(data["user"]["photo_url"].startswith("/uploads/avatar_"))

        # 2. Valid PNG with magic bytes
        png_data = b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR" + b"\x00" * 100
        res_png = self.client.post(
            "/api/auth/profile-picture",
            files={"file": ("photo.png", io.BytesIO(png_data), "image/png")},
            headers={"Authorization": f"Bearer {pat_token}"},
        )
        self.assertEqual(res_png.status_code, 200)

        # 3. Disallowed extension
        res_bad_ext = self.client.post(
            "/api/auth/profile-picture",
            files={"file": ("photo.gif", io.BytesIO(b"GIF89a" + b"\x00" * 50), "image/gif")},
            headers={"Authorization": f"Bearer {pat_token}"},
        )
        self.assertEqual(res_bad_ext.status_code, 400)
        self.assertIn("Unsupported image type", res_bad_ext.text)

        # 4. Invalid file content (spoofed extension)
        res_corrupt = self.client.post(
            "/api/auth/profile-picture",
            files={"file": ("fake.jpg", io.BytesIO(b"not an image at all"), "image/jpeg")},
            headers={"Authorization": f"Bearer {pat_token}"},
        )
        self.assertEqual(res_corrupt.status_code, 400)
        self.assertIn("not a valid image", res_corrupt.text)

        # 5. Oversized image (> 5 MB)
        oversized = b"\xff\xd8" + b"\x00" * (5 * 1024 * 1024 + 10)
        res_oversized = self.client.post(
            "/api/auth/profile-picture",
            files={"file": ("large.jpg", io.BytesIO(oversized), "image/jpeg")},
            headers={"Authorization": f"Bearer {pat_token}"},
        )
        self.assertEqual(res_oversized.status_code, 400)
        self.assertIn("exceeds 5 MB", res_oversized.text)


if __name__ == "__main__":
    unittest.main()
