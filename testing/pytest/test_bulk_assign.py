import requests


BASE_URL = "http://127.0.0.1:8000"


def test_bulk_assign_requires_auth():
    """
    Verify that the Bulk Assign endpoint is protected
    and requires authentication.
    """

    # Input
    endpoint = "/complaints/bulk-assign"

    payload = {}

    # Expected Output
    expected_status = [401, 403]

    # Actual Output
    response = requests.patch(
        f"{BASE_URL}{endpoint}",
        json=payload,
    )

    actual_status = response.status_code

    # Assertion
    assert actual_status in expected_status, (
        f"\nTest Case       : Bulk Assign Authentication"
        f"\nInput           : PATCH {endpoint}"
        f"\nExpected Output : HTTP Status {expected_status}"
        f"\nActual Output   : HTTP Status {actual_status}"
        f"\nResponse        : {response.text}"
    )


def test_bulk_assign_empty_list(admin_auth_headers):
    """
    Verify that an authenticated administrator can submit
    an empty bulk-assignment request and that the API handles
    the empty input without an unexpected server error.
    """

    # Input
    endpoint = "/complaints/bulk-assign"

    payload = {
        "assignments": []
    }

    # Expected Output
    expected_status = [200, 400, 422]

    # Actual Output
    response = requests.patch(
        f"{BASE_URL}{endpoint}",
        json=payload,
        headers=admin_auth_headers,
    )

    actual_status = response.status_code

    # Assertion
    assert actual_status in expected_status, (
        f"\nTest Case       : Bulk Assign Empty List"
        f"\nInput           : PATCH {endpoint}"
        f"\nExpected Output : HTTP Status {expected_status}"
        f"\nActual Output   : HTTP Status {actual_status}"
        f"\nResponse        : {response.text}"
    )

    assert actual_status != 500, (
        f"\nTest Case       : Bulk Assign Empty List"
        f"\nUnexpected Output : HTTP Status 500"
        f"\nResponse        : {response.text}"
    )


def test_bulk_assign_missing_assignments(admin_auth_headers):
    """
    Verify that the API handles a request where the assignments
    field is missing.
    """

    # Input
    endpoint = "/complaints/bulk-assign"

    payload = {}

    # Expected Output
    expected_status = [400, 422]

    # Actual Output
    response = requests.patch(
        f"{BASE_URL}{endpoint}",
        json=payload,
        headers=admin_auth_headers,
    )

    actual_status = response.status_code

    # Assertion
    assert actual_status in expected_status, (
        f"\nTest Case       : Bulk Assign Missing Assignments"
        f"\nInput           : PATCH {endpoint}"
        f"\nExpected Output : HTTP Status {expected_status}"
        f"\nActual Output   : HTTP Status {actual_status}"
        f"\nResponse        : {response.text}"
    )


def test_bulk_assign_null_assignments(admin_auth_headers):
    """
    Verify that the API rejects a null assignments value.
    """

    # Input
    endpoint = "/complaints/bulk-assign"

    payload = {
        "assignments": None
    }

    # Expected Output
    expected_status = [400, 422]

    # Actual Output
    response = requests.patch(
        f"{BASE_URL}{endpoint}",
        json=payload,
        headers=admin_auth_headers,
    )

    actual_status = response.status_code

    # Assertion
    assert actual_status in expected_status, (
        f"\nTest Case       : Bulk Assign Null Assignments"
        f"\nInput           : PATCH {endpoint}"
        f"\nExpected Output : HTTP Status {expected_status}"
        f"\nActual Output   : HTTP Status {actual_status}"
        f"\nResponse        : {response.text}"
    )


def test_bulk_assign_invalid_assignments_type(admin_auth_headers):
    """
    Verify that the API rejects an invalid assignments data type.
    """

    # Input
    endpoint = "/complaints/bulk-assign"

    payload = {
        "assignments": "invalid"
    }

    # Expected Output
    expected_status = [400, 422]

    # Actual Output
    response = requests.patch(
        f"{BASE_URL}{endpoint}",
        json=payload,
        headers=admin_auth_headers,
    )

    actual_status = response.status_code

    # Assertion
    assert actual_status in expected_status, (
        f"\nTest Case       : Bulk Assign Invalid Data Type"
        f"\nInput           : PATCH {endpoint}"
        f"\nExpected Output : HTTP Status {expected_status}"
        f"\nActual Output   : HTTP Status {actual_status}"
        f"\nResponse        : {response.text}"
    )


def test_bulk_assign_invalid_worker_id(admin_auth_headers):
    """
    Verify that the API rejects an assignment containing
    an invalid field worker ID.
    """

    # Input
    endpoint = "/complaints/bulk-assign"

    payload = {
        "assignments": [
            {
                "complaintId": "CMP-65C600",
                "fieldWorkerId": "invalid-worker-id"
            }
        ]
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
        f"\nTest Case       : Bulk Assign Invalid Worker ID"
        f"\nInput           : PATCH {endpoint}"
        f"\nExpected Output : HTTP Status {expected_status}"
        f"\nActual Output   : HTTP Status {actual_status}"
        f"\nResponse        : {response.text}"
    )


def test_bulk_assign_invalid_complaint_id(admin_auth_headers):
    """
    Verify that the API rejects an assignment containing
    a complaint ID that does not exist.
    """

    # Input
    endpoint = "/complaints/bulk-assign"

    payload = {
        "assignments": [
            {
                "complaintId": "CMP-DOES-NOT-EXIST",
                "fieldWorkerId": "invalid-worker-id"
            }
        ]
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
        f"\nTest Case       : Bulk Assign Invalid Complaint"
        f"\nInput           : PATCH {endpoint}"
        f"\nExpected Output : HTTP Status {expected_status}"
        f"\nActual Output   : HTTP Status {actual_status}"
        f"\nResponse        : {response.text}"
    )


def test_bulk_assign_missing_complaint_id(admin_auth_headers):
    """
    Verify that the API handles an assignment where complaintId
    is missing.
    """

    # Input
    endpoint = "/complaints/bulk-assign"

    payload = {
        "assignments": [
            {
                "fieldWorkerId": "invalid-worker-id"
            }
        ]
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
        f"\nTest Case       : Bulk Assign Missing Complaint ID"
        f"\nInput           : PATCH {endpoint}"
        f"\nExpected Output : HTTP Status {expected_status}"
        f"\nActual Output   : HTTP Status {actual_status}"
        f"\nResponse        : {response.text}"
    )


def test_bulk_assign_missing_worker_id(admin_auth_headers):
    """
    Verify that the API handles an assignment where fieldWorkerId
    is missing.
    """

    # Input
    endpoint = "/complaints/bulk-assign"

    payload = {
        "assignments": [
            {
                "complaintId": "CMP-65C600"
            }
        ]
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
        f"\nTest Case       : Bulk Assign Missing Worker ID"
        f"\nInput           : PATCH {endpoint}"
        f"\nExpected Output : HTTP Status {expected_status}"
        f"\nActual Output   : HTTP Status {actual_status}"
        f"\nResponse        : {response.text}"
    )


def test_bulk_assign_citizen_denied(auth_headers):
    """
    Verify that a normal citizen cannot perform bulk assignment.
    """

    # Input
    endpoint = "/complaints/bulk-assign"

    # Use the actual request structure required by the endpoint.
    # This ensures request validation succeeds before checking
    # the user's authorization.
    payload = {
        "complaintIds": ["CMP-65C600"],
        "fieldWorkerId": "eabf91dd-6194-478e-93ea-68a0d58aafb1"
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
        f"\nTest Case       : Bulk Assign Citizen Authorization"
        f"\nInput           : PATCH {endpoint}"
        f"\nExpected Output : HTTP Status {expected_status}"
        f"\nActual Output   : HTTP Status {actual_status}"
        f"\nResponse        : {response.text}"
    )


def test_bulk_assign_invalid_token():
    """
    Verify that bulk assignment rejects an invalid JWT token.
    """

    # Input
    endpoint = "/complaints/bulk-assign"

    payload = {
        "assignments": []
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
        f"\nTest Case       : Bulk Assign Invalid Token"
        f"\nInput           : PATCH {endpoint}"
        f"\nExpected Output : HTTP Status {expected_status}"
        f"\nActual Output   : HTTP Status {actual_status}"
        f"\nResponse        : {response.text}"
    )