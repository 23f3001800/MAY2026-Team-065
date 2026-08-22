import uuid

import requests


BASE_URL = "http://127.0.0.1:8000"


def test_assign_field_worker_requires_auth():
    """
    Verify that the Assign Field Worker endpoint is protected
    and requires authentication.
    """

    # Input
    complaint_id = "CMP-TEST001"
    endpoint = f"/complaints/{complaint_id}/assign"

    payload = {}

    # Expected Output
    expected_status = [401, 403, 404]

    # Actual Output
    response = requests.patch(
        f"{BASE_URL}{endpoint}",
        json=payload,
    )

    actual_status = response.status_code

    # Assertion
    assert actual_status in expected_status, (
        f"\nTest Case       : Assign Field Worker Authentication"
        f"\nInput           : PATCH {endpoint}"
        f"\nExpected Output : HTTP Status {expected_status}"
        f"\nActual Output   : HTTP Status {actual_status}"
        f"\nResponse        : {response.text}"
    )


def test_assign_field_worker_skill_mismatch(admin_auth_headers):
    """
    Verify that assigning a field worker with an incompatible
    skill is rejected.
    """

    # Input
    complaint_id = "CMP-65C600"
    endpoint = f"/complaints/{complaint_id}/assign"

    payload = {
        "fieldWorkerId": "eabf91dd-6194-478e-93ea-68a0d58aafb1"
    }

    # Expected Output
    expected_status = 400

    # Actual Output
    response = requests.patch(
        f"{BASE_URL}{endpoint}",
        json=payload,
        headers=admin_auth_headers,
    )

    actual_status = response.status_code

    # Assertion
    assert actual_status == expected_status, (
        f"\nTest Case       : Assign Field Worker - Skill Mismatch"
        f"\nInput           : PATCH {endpoint}"
        f"\nExpected Output : HTTP Status {expected_status}"
        f"\nActual Output   : HTTP Status {actual_status}"
        f"\nResponse        : {response.text}"
    )

    assert "Skill mismatch" in response.text, (
        f"\nExpected Output : Skill mismatch error"
        f"\nActual Output   : {response.text}"
    )


def test_assign_field_worker_missing_worker_id(admin_auth_headers):
    """
    Verify that assignment fails when fieldWorkerId is missing.
    """

    # Input
    complaint_id = "CMP-65C600"
    endpoint = f"/complaints/{complaint_id}/assign"

    payload = {}

    # Expected Output
    expected_status = 422

    # Actual Output
    response = requests.patch(
        f"{BASE_URL}{endpoint}",
        json=payload,
        headers=admin_auth_headers,
    )

    actual_status = response.status_code

    # Assertion
    assert actual_status == expected_status, (
        f"\nTest Case       : Assign Field Worker - Missing Worker ID"
        f"\nInput           : PATCH {endpoint}"
        f"\nExpected Output : HTTP Status {expected_status}"
        f"\nActual Output   : HTTP Status {actual_status}"
        f"\nResponse        : {response.text}"
    )


def test_assign_field_worker_invalid_worker_id(admin_auth_headers):
    """
    Verify that assignment fails when an invalid field worker ID
    is supplied.
    """

    # Input
    complaint_id = "CMP-65C600"
    endpoint = f"/complaints/{complaint_id}/assign"

    payload = {
        "fieldWorkerId": "not-a-valid-worker-id"
    }

    # Expected Output
    expected_status = [400, 404, 422]

    # Actual Output
    response = requests.patch(
        f"{BASE_URL}{endpoint}",
        json=payload,
        headers=admin_auth_headers,
    )

    actual_status = response.status_code

    # Assertion
    assert actual_status in expected_status, (
        f"\nTest Case       : Assign Field Worker - Invalid Worker ID"
        f"\nInput           : PATCH {endpoint}"
        f"\nExpected Output : HTTP Status {expected_status}"
        f"\nActual Output   : HTTP Status {actual_status}"
        f"\nResponse        : {response.text}"
    )


def test_assign_field_worker_nonexistent_worker(admin_auth_headers):
    """
    Verify that assignment fails when the field worker does not exist.
    """

    # Input
    complaint_id = "CMP-65C600"
    endpoint = f"/complaints/{complaint_id}/assign"

    payload = {
        "fieldWorkerId": str(uuid.uuid4())
    }

    # Expected Output
    expected_status = [400, 404]

    # Actual Output
    response = requests.patch(
        f"{BASE_URL}{endpoint}",
        json=payload,
        headers=admin_auth_headers,
    )

    actual_status = response.status_code

    # Assertion
    assert actual_status in expected_status, (
        f"\nTest Case       : Assign Field Worker - Nonexistent Worker"
        f"\nInput           : PATCH {endpoint}"
        f"\nExpected Output : HTTP Status {expected_status}"
        f"\nActual Output   : HTTP Status {actual_status}"
        f"\nResponse        : {response.text}"
    )


def test_assign_field_worker_nonexistent_complaint(admin_auth_headers):
    """
    Verify that assignment fails when the complaint does not exist.
    """

    # Input
    complaint_id = "CMP-DOES-NOT-EXIST"
    endpoint = f"/complaints/{complaint_id}/assign"

    payload = {
        "fieldWorkerId": str(uuid.uuid4())
    }

    # Expected Output
    expected_status = [400, 404]

    # Actual Output
    response = requests.patch(
        f"{BASE_URL}{endpoint}",
        json=payload,
        headers=admin_auth_headers,
    )

    actual_status = response.status_code

    # Assertion
    assert actual_status in expected_status, (
        f"\nTest Case       : Assign Field Worker - "
        f"Nonexistent Complaint"
        f"\nInput           : PATCH {endpoint}"
        f"\nExpected Output : HTTP Status {expected_status}"
        f"\nActual Output   : HTTP Status {actual_status}"
        f"\nResponse        : {response.text}"
    )


def test_assign_field_worker_invalid_authorization():
    """
    Verify that assignment rejects an invalid authentication token.
    """

    # Input
    complaint_id = "CMP-65C600"
    endpoint = f"/complaints/{complaint_id}/assign"

    payload = {
        "fieldWorkerId": str(uuid.uuid4())
    }

    headers = {
        "Authorization": "Bearer invalid.jwt.token"
    }

    # Expected Output
    expected_status = [401, 403]

    # Actual Output
    response = requests.patch(
        f"{BASE_URL}{endpoint}",
        json=payload,
        headers=headers,
    )

    actual_status = response.status_code

    # Assertion
    assert actual_status in expected_status, (
        f"\nTest Case       : Assign Field Worker - Invalid Token"
        f"\nInput           : PATCH {endpoint}"
        f"\nExpected Output : HTTP Status {expected_status}"
        f"\nActual Output   : HTTP Status {actual_status}"
        f"\nResponse        : {response.text}"
    )


def test_assign_field_worker_citizen_denied(auth_headers):
    """
    Verify that a citizen cannot assign a field worker.
    """

    # Input
    complaint_id = "CMP-65C600"
    endpoint = f"/complaints/{complaint_id}/assign"

    payload = {
        "fieldWorkerId": str(uuid.uuid4())
    }

    # Expected Output
    expected_status = 403

    # Actual Output
    response = requests.patch(
        f"{BASE_URL}{endpoint}",
        json=payload,
        headers=auth_headers,
    )

    actual_status = response.status_code

    # Assertion
    assert actual_status == expected_status, (
        f"\nTest Case       : Assign Field Worker - Citizen Access"
        f"\nInput           : PATCH {endpoint}"
        f"\nExpected Output : HTTP Status {expected_status}"
        f"\nActual Output   : HTTP Status {actual_status}"
        f"\nResponse        : {response.text}"
    )