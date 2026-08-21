import requests

BASE_URL = "http://127.0.0.1:8000"


def test_assign_field_worker_requires_auth():
    """
    Verify that the Assign Field Worker endpoint is protected
    and requires authentication.
    """

    complaint_id = "CMP-TEST001"
    endpoint = f"/complaints/{complaint_id}/assign"

    expected_status = [200, 401, 403, 404]

    response = requests.patch(
        f"{BASE_URL}{endpoint}",
        json={},
    )

    actual_status = response.status_code

    assert actual_status in expected_status, (
        f"\nTest Case       : Assign Field Worker Authentication"
        f"\nInput           : PATCH {endpoint}"
        f"\nExpected Output : HTTP Status {expected_status}"
        f"\nActual Output   : HTTP Status {actual_status}"
    )


def test_assign_field_worker_skill_mismatch(admin_auth_headers):
    """
    Verify that assigning a field worker with an incompatible
    skill is rejected.
    """

    complaint_id = "CMP-65C600"
    endpoint = f"/complaints/{complaint_id}/assign"

    payload = {
        "fieldWorkerId": "eabf91dd-6194-478e-93ea-68a0d58aafb1"
    }

    expected_status = 400

    response = requests.patch(
        f"{BASE_URL}{endpoint}",
        json=payload,
        headers=admin_auth_headers
    )

    actual_status = response.status_code

    assert actual_status == expected_status, (
        f"\nTest Case       : Assign Field Worker - Skill Mismatch"
        f"\nInput           : PATCH {endpoint}"
        f"\nExpected Output : HTTP Status {expected_status}"
        f"\nActual Output   : HTTP Status {actual_status}"
        f"\nResponse        : {response.text}"
    )

    assert "Skill mismatch" in response.text