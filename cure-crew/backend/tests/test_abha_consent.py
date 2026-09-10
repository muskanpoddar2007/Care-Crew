import unittest
import uuid
from fastapi.testclient import TestClient

from app.main import app
from app.models.user import user_store


class TestAbhaAndConsent(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)

    def test_register_patient_missing_abha(self):
        payload = {
            "name": "Test Patient",
            "password": "password123",
            "role": "patient",
            "consent": True,
        }
        res = self.client.post("/api/auth/register", json=payload)
        self.assertEqual(res.status_code, 400)
        self.assertIn("ABHA ID is required", res.text)

    def test_register_patient_invalid_abha_length(self):
        for invalid_abha in ["12345", "1234567890123", "123456789012345"]:
            payload = {
                "name": "Test Patient",
                "abha_id": invalid_abha,
                "password": "password123",
                "role": "patient",
                "consent": True,
            }
            res = self.client.post("/api/auth/register", json=payload)
            self.assertEqual(res.status_code, 400, f"Failed for {invalid_abha}")
            self.assertIn("ABHA ID must be exactly 14 digits, numbers only", res.text)

    def test_register_patient_invalid_abha_characters(self):
        for invalid_abha in ["12-3456-7890-12", "1234 5678 9012 34", "1234567890abcd", "1234567890123@"]:
            payload = {
                "name": "Test Patient",
                "abha_id": invalid_abha,
                "password": "password123",
                "role": "patient",
                "consent": True,
            }
            res = self.client.post("/api/auth/register", json=payload)
            self.assertEqual(res.status_code, 400, f"Failed for {invalid_abha}")
            self.assertIn("ABHA ID must be exactly 14 digits, numbers only", res.text)

    def test_register_patient_without_consent(self):
        payload = {
            "name": "Test Patient",
            "abha_id": "99998888777766",
            "password": "password123",
            "role": "patient",
            "consent": False,
        }
        res = self.client.post("/api/auth/register", json=payload)
        self.assertEqual(res.status_code, 400)
        self.assertIn("Consent to Terms and Conditions is required", res.text)

    def test_register_and_login_patient_success(self):
        unique_abha = f"14{str(uuid.uuid4().int)[:12]}"
        payload = {
            "name": "Consent Approved Patient",
            "abha_id": unique_abha,
            "password": "password123",
            "role": "patient",
            "consent": True,
        }
        # 1. Register successfully
        res = self.client.post("/api/auth/register", json=payload)
        self.assertEqual(res.status_code, 201)
        data = res.json()["data"]
        self.assertEqual(data["user"]["abha_id"], unique_abha)
        self.assertEqual(data["user"]["consent"], True)
        self.assertIsNotNone(data["user"]["consent_at"])

        # 2. Login with invalid ABHA ID format
        bad_login = self.client.post(
            "/api/auth/login",
            json={"identifier": "12345", "password": "password123", "role": "patient"},
        )
        self.assertEqual(bad_login.status_code, 400)
        self.assertIn("ABHA ID must be exactly 14 digits, numbers only", bad_login.text)

        # 3. Login with wrong password
        wrong_pw = self.client.post(
            "/api/auth/login",
            json={"identifier": unique_abha, "password": "wrongpassword", "role": "patient"},
        )
        self.assertEqual(wrong_pw.status_code, 401)

        # 4. Login with correct 14-digit ABHA ID and password
        login_res = self.client.post(
            "/api/auth/login",
            json={"identifier": unique_abha, "password": "password123", "role": "patient"},
        )
        self.assertEqual(login_res.status_code, 200)
        login_data = login_res.json()["data"]
        self.assertEqual(login_data["user"]["abha_id"], unique_abha)
        self.assertIsNotNone(login_data["access_token"])

    def test_register_doctor_not_subject_to_abha_rules(self):
        doc_id = f"DOC-{uuid.uuid4().hex[:6].upper()}"
        payload = {
            "name": "Dr. Smith",
            "doctor_id": doc_id,
            "password": "password123",
            "role": "doctor",
            "department": "Cardiology",
        }
        res = self.client.post("/api/auth/register", json=payload)
        self.assertEqual(res.status_code, 201)
        data = res.json()["data"]
        self.assertEqual(data["user"]["doctor_id"], doc_id)
        self.assertEqual(data["user"]["role"], "doctor")


if __name__ == "__main__":
    unittest.main()
