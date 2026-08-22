import requests


BASE_URL = "http://127.0.0.1:8000"


def test_update_complaint_status(admin_auth_headers):
    """
    Verify that an administrator can update
    the status of a complaint.
    """

    # Input
    complaint_id = "CMP-65C600"
    endpoint = f"/complaints/{complaint_id}/status"

    payload = {
        "status": "PENDING",
        "remarks": "Automated status update test"
    }

    # Expected Output
    expected_status = 200

    # Actual Output
    response = requests.patch(
        f"{BASE_URL}{endpoint}",
        json=payload,
        headers=admin_auth_headers
    )

    actual_status = response.status_code

    # Assertion
    assert actual_status == expected_status, (
        f"\nTest Case       : Update Complaint Status"
        f"\nInput           : PATCH {endpoint}"
        f"\nExpected Output : HTTP Status {expected_status}"
        f"\nActual Output   : HTTP Status {actual_status}"
        f"\nResponse        : {response.text}"
    )

    # Response validation
    data = response.json()

    assert data["complaintId"] == complaint_id
    assert data["status"] == "PENDING"


def test_update_status_requires_auth():
    """
    Verify that updating complaint status requires authentication.
    """

    # Input
    complaint_id = "CMP-65C600"
    endpoint = f"/complaints/{complaint_id}/status"

    payload = {
        "status": "PENDING",
        "remarks": "Authentication test"
    }

    # Expected Output
    expected_status = [401, 403]

    # Actual Output
    response = requests.patch(
        f"{BASE_URL}{endpoint}",
        json=payload
    )

    actual_status = response.status_code

    # Assertion
    assert actual_status in expected_status, (
        f"\nTest Case       : Status Update Authentication"
        f"\nInput           : PATCH {endpoint}"
        f"\nExpected Output : HTTP Status {expected_status}"
        f"\nActual Output   : HTTP Status {actual_status}"
        f"\nResponse        : {response.text}"
    )


def test_update_status_invalid_token():
    """
    Verify that an invalid JWT cannot update complaint status.
    """

    # Input
    complaint_id = "CMP-65C600"
    endpoint = f"/complaints/{complaint_id}/status"

    payload = {
        "status": "PENDING",
        "remarks": "Invalid token test"
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
        headers=headers
    )

    actual_status = response.status_code

    # Assertion
    assert actual_status in expected_status, (
        f"\nTest Case       : Status Update Invalid Token"
        f"\nInput           : PATCH {endpoint}"
        f"\nExpected Output : HTTP Status {expected_status}"
        f"\nActual Output   : HTTP Status {actual_status}"
        f"\nResponse        : {response.text}"
    )


def test_update_status_malformed_authorization():
    """
    Verify that a malformed Authorization header is rejected.
    """

    # Input
    complaint_id = "CMP-65C600"
    endpoint = f"/complaints/{complaint_id}/status"

    payload = {
        "status": "PENDING",
        "remarks": "Malformed authorization test"
    }

    headers = {
        "Authorization": "InvalidToken"
    }

    # Expected Output
    expected_status = [401, 403]

    # Actual Output
    response = requests.patch(
        f"{BASE_URL}{endpoint}",
        json=payload,
        headers=headers
    )

    actual_status = response.status_code

    # Assertion
    assert actual_status in expected_status, (
        f"\nTest Case       : Status Update Malformed Authorization"
        f"\nInput           : PATCH {endpoint}"
        f"\nExpected Output : HTTP Status {expected_status}"
        f"\nActual Output   : HTTP Status {actual_status}"
        f"\nResponse        : {response.text}"
    )


def test_update_status_citizen_denied(auth_headers):
    """
    Verify that a normal citizen cannot update complaint status.
    """

    # Input
    complaint_id = "CMP-65C600"
    endpoint = f"/complaints/{complaint_id}/status"

    payload = {
        "status": "PENDING",
        "remarks": "Citizen authorization test"
    }

    # Expected Output
    expected_status = 403

    # Actual Output
    response = requests.patch(
        f"{BASE_URL}{endpoint}",
        json=payload,
        headers=auth_headers
    )

    actual_status = response.status_code

    # Assertion
    assert actual_status == expected_status, (
        f"\nTest Case       : Status Update Citizen Authorization"
        f"\nInput           : PATCH {endpoint}"
        f"\nExpected Output : HTTP Status {expected_status}"
        f"\nActual Output   : HTTP Status {actual_status}"
        f"\nResponse        : {response.text}"
    )


def test_update_status_missing_status(admin_auth_headers):
    """
    Verify that the status field is required.
    """

    # Input
    complaint_id = "CMP-65C600"
    endpoint = f"/complaints/{complaint_id}/status"

    payload = {
        "remarks": "Missing status test"
    }

    # Expected Output
    expected_status = [400, 422]

    # Actual Output
    response = requests.patch(
        f"{BASE_URL}{endpoint}",
        json=payload,
        headers=admin_auth_headers
    )

    actual_status = response.status_code

    # Assertion
    assert actual_status in expected_status, (
        f"\nTest Case       : Missing Complaint Status"
        f"\nInput           : PATCH {endpoint}"
        f"\nExpected Output : HTTP Status {expected_status}"
        f"\nActual Output   : HTTP Status {actual_status}"
        f"\nResponse        : {response.text}"
    )


def test_update_status_invalid_value(admin_auth_headers):
    """
    Verify that an unsupported status value is rejected.
    """

    # Input
    complaint_id = "CMP-65C600"
    endpoint = f"/complaints/{complaint_id}/status"

    payload = {
        "status": "INVALID_STATUS",
        "remarks": "Invalid status test"
    }

    # Expected Output
    expected_status = [400, 422]

    # Actual Output
    response = requests.patch(
        f"{BASE_URL}{endpoint}",
        json=payload,
        headers=admin_auth_headers
    )

    actual_status = response.status_code

    # Assertion
    assert actual_status in expected_status, (
        f"\nTest Case       : Invalid Complaint Status"
        f"\nInput           : PATCH {endpoint}"
        f"\nExpected Output : HTTP Status {expected_status}"
        f"\nActual Output   : HTTP Status {actual_status}"
        f"\nResponse        : {response.text}"
    )


def test_update_status_empty_value(admin_auth_headers):
    """
    Verify that an empty status value is rejected.
    """

    # Input
    complaint_id = "CMP-65C600"
    endpoint = f"/complaints/{complaint_id}/status"

    payload = {
        "status": "",
        "remarks": "Empty status test"
    }

    # Expected Output
    expected_status = [400, 422]

    # Actual Output
    response = requests.patch(
        f"{BASE_URL}{endpoint}",
        json=payload,
        headers=admin_auth_headers
    )

    actual_status = response.status_code

    # Assertion
    assert actual_status in expected_status, (
        f"\nTest Case       : Empty Complaint Status"
        f"\nInput           : PATCH {endpoint}"
        f"\nExpected Output : HTTP Status {expected_status}"
        f"\nActual Output   : HTTP Status {actual_status}"
        f"\nResponse        : {response.text}"
    )


def test_update_status_null_value(admin_auth_headers):
    """
    Verify that a null status value is rejected.
    """

    # Input
    complaint_id = "CMP-65C600"
    endpoint = f"/complaints/{complaint_id}/status"

    payload = {
        "status": None,
        "remarks": "Null status test"
    }

    # Expected Output
    expected_status = [400, 422]

    # Actual Output
    response = requests.patch(
        f"{BASE_URL}{endpoint}",
        json=payload,
        headers=admin_auth_headers
    )

    actual_status = response.status_code

    # Assertion
    assert actual_status in expected_status, (
        f"\nTest Case       : Null Complaint Status"
        f"\nInput           : PATCH {endpoint}"
        f"\nExpected Output : HTTP Status {expected_status}"
        f"\nActual Output   : HTTP Status {actual_status}"
        f"\nResponse        : {response.text}"
    )


def test_update_status_nonexistent_complaint(
    admin_auth_headers
):
    """
    Verify that status cannot be updated for a nonexistent
    complaint.
    """

    # Input
    complaint_id = "CMP-DOES-NOT-EXIST"
    endpoint = f"/complaints/{complaint_id}/status"

    payload = {
        "status": "PENDING",
        "remarks": "Nonexistent complaint test"
    }

    # Expected Output
    expected_status = 404

    # Actual Output
    response = requests.patch(
        f"{BASE_URL}{endpoint}",
        json=payload,
        headers=admin_auth_headers
    )

    actual_status = response.status_code

    # Assertion
    assert actual_status == expected_status, (
        f"\nTest Case       : Status Nonexistent Complaint"
        f"\nInput           : PATCH {endpoint}"
        f"\nExpected Output : HTTP Status {expected_status}"
        f"\nActual Output   : HTTP Status {actual_status}"
        f"\nResponse        : {response.text}"
    )


def test_update_status_malformed_complaint_id(
    admin_auth_headers
):
    """
    Verify that a malformed complaint ID does not produce
    an unexpected server error.
    """

    # Input
    complaint_id = "INVALID"
    endpoint = f"/complaints/{complaint_id}/status"

    payload = {
        "status": "PENDING",
        "remarks": "Malformed ID test"
    }

    # Expected Output
    expected_status = [400, 404, 422]

    # Actual Output
    response = requests.patch(
        f"{BASE_URL}{endpoint}",
        json=payload,
        headers=admin_auth_headers
    )

    actual_status = response.status_code

    # Assertion
    assert actual_status in expected_status, (
        f"\nTest Case       : Status Malformed Complaint ID"
        f"\nInput           : PATCH {endpoint}"
        f"\nExpected Output : HTTP Status {expected_status}"
        f"\nActual Output   : HTTP Status {actual_status}"
        f"\nResponse        : {response.text}"
    )

    assert actual_status != 500, (
        f"\nUnexpected server error."
        f"\nResponse : {response.text}"
    )


def test_update_status_response_structure(
    admin_auth_headers
):
    """
    Verify that a successful status update returns the
    expected complaint information.
    """

    # Input
    complaint_id = "CMP-65C600"
    endpoint = f"/complaints/{complaint_id}/status"

    payload = {
        "status": "PENDING",
        "remarks": "Response structure test"
    }

    # Expected Output
    expected_status = 200

    # Actual Output
    response = requests.patch(
        f"{BASE_URL}{endpoint}",
        json=payload,
        headers=admin_auth_headers
    )

    actual_status = response.status_code

    # Assertion
    assert actual_status == expected_status, (
        f"\nTest Case       : Status Response Structure"
        f"\nInput           : PATCH {endpoint}"
        f"\nExpected Output : HTTP Status {expected_status}"
        f"\nActual Output   : HTTP Status {actual_status}"
        f"\nResponse        : {response.text}"
    )

    data = response.json()

    assert isinstance(data, dict)
    assert "complaintId" in data
    assert "status" in data

    assert data["complaintId"] == complaint_id
    assert data["status"] == "PENDING"


def test_update_status_repeated_request(
    admin_auth_headers
):
    """
    Verify that repeated status updates are handled without
    producing an unexpected server error.
    """

    # Input
    complaint_id = "CMP-65C600"
    endpoint = f"/complaints/{complaint_id}/status"

    payload = {
        "status": "PENDING",
        "remarks": "Repeated status update test"
    }

    # Expected Output
    expected_statuses = [200, 400]

    # Actual Output
    first_response = requests.patch(
        f"{BASE_URL}{endpoint}",
        json=payload,
        headers=admin_auth_headers
    )

    second_response = requests.patch(
        f"{BASE_URL}{endpoint}",
        json=payload,
        headers=admin_auth_headers
    )

    # Assertions
    assert first_response.status_code in expected_statuses, (
        f"\nTest Case       : First Repeated Status Update"
        f"\nExpected Output : HTTP Status {expected_statuses}"
        f"\nActual Output   : HTTP Status "
        f"{first_response.status_code}"
        f"\nResponse        : {first_response.text}"
    )

    assert second_response.status_code in expected_statuses, (
        f"\nTest Case       : Second Repeated Status Update"
        f"\nExpected Output : HTTP Status {expected_statuses}"
        f"\nActual Output   : HTTP Status "
        f"{second_response.status_code}"
        f"\nResponse        : {second_response.text}"
    )

    assert first_response.status_code != 500
    assert second_response.status_code != 500


def test_update_status_no_server_error(
    admin_auth_headers
):
    """
    Verify that the status endpoint does not return an
    unexpected internal server error for valid input.
    """

    # Input
    complaint_id = "CMP-65C600"
    endpoint = f"/complaints/{complaint_id}/status"

    payload = {
        "status": "PENDING",
        "remarks": "Server error validation"
    }

    # Actual Output
    response = requests.patch(
        f"{BASE_URL}{endpoint}",
        json=payload,
        headers=admin_auth_headers
    )

    actual_status = response.status_code

    # Assertion
    assert actual_status != 500, (
        f"\nTest Case       : Status Server Error Check"
        f"\nInput           : PATCH {endpoint}"
        f"\nUnexpected Output : HTTP Status 500"
        f"\nResponse          : {response.text}"
    )

    assert actual_status in [200, 400], (
        f"\nUnexpected Status : {actual_status}"
        f"\nResponse          : {response.text}"
    )