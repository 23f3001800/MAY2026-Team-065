import requests


BASE_URL = "http://127.0.0.1:8000"


def test_override_complaint_severity(admin_auth_headers):
    """
    Verify that an administrator can override the severity
    of an existing complaint.
    """

    # Input
    complaint_id = "CMP-65C600"
    endpoint = f"/complaints/{complaint_id}/severity"

    # Get current severity so the test can be repeated safely.
    complaint_response = requests.get(
        f"{BASE_URL}/complaints/{complaint_id}",
        headers=admin_auth_headers
    )

    assert complaint_response.status_code == 200, (
        f"\nTest Case       : Get Complaint Before Severity Override"
        f"\nInput           : GET /complaints/{complaint_id}"
        f"\nExpected Output : HTTP Status 200"
        f"\nActual Output   : HTTP Status "
        f"{complaint_response.status_code}"
        f"\nResponse        : {complaint_response.text}"
    )

    current_severity = complaint_response.json().get("severity")

    valid_severities = [
        "LOW",
        "MEDIUM",
        "HIGH",
        "CRITICAL"
    ]

    new_severity = next(
        (
            severity
            for severity in valid_severities
            if severity != current_severity
        ),
        None
    )

    assert new_severity is not None, (
        f"\nCurrent Severity : {current_severity}"
        f"\nValid Severities : {valid_severities}"
    )

    payload = {
        "severity": new_severity,
        "remarks": "Automated severity override test"
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
        f"\nTest Case       : Override Complaint Severity"
        f"\nInput           : PATCH {endpoint}"
        f"\nExpected Output : HTTP Status {expected_status}"
        f"\nActual Output   : HTTP Status {actual_status}"
        f"\nResponse        : {response.text}"
    )

    data = response.json()

    assert data["complaintId"] == complaint_id, (
        f"\nExpected Complaint ID : {complaint_id}"
        f"\nActual Complaint ID   : {data.get('complaintId')}"
    )

    assert data["severity"] == new_severity, (
        f"\nExpected Severity : {new_severity}"
        f"\nActual Severity   : {data.get('severity')}"
    )


def test_override_severity_requires_auth():
    """
    Verify that severity override requires authentication.
    """

    # Input
    complaint_id = "CMP-65C600"
    endpoint = f"/complaints/{complaint_id}/severity"

    payload = {
        "severity": "HIGH",
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
        f"\nTest Case       : Severity Override Authentication"
        f"\nInput           : PATCH {endpoint}"
        f"\nExpected Output : HTTP Status {expected_status}"
        f"\nActual Output   : HTTP Status {actual_status}"
        f"\nResponse        : {response.text}"
    )


def test_override_severity_invalid_token():
    """
    Verify that an invalid JWT cannot override severity.
    """

    # Input
    complaint_id = "CMP-65C600"
    endpoint = f"/complaints/{complaint_id}/severity"

    payload = {
        "severity": "HIGH",
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
        f"\nTest Case       : Severity Override Invalid Token"
        f"\nInput           : PATCH {endpoint}"
        f"\nExpected Output : HTTP Status {expected_status}"
        f"\nActual Output   : HTTP Status {actual_status}"
        f"\nResponse        : {response.text}"
    )


def test_override_severity_malformed_authorization():
    """
    Verify that a malformed Authorization header is rejected.
    """

    # Input
    complaint_id = "CMP-65C600"
    endpoint = f"/complaints/{complaint_id}/severity"

    payload = {
        "severity": "HIGH",
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
        f"\nTest Case       : Severity Override Malformed Authorization"
        f"\nInput           : PATCH {endpoint}"
        f"\nExpected Output : HTTP Status {expected_status}"
        f"\nActual Output   : HTTP Status {actual_status}"
        f"\nResponse        : {response.text}"
    )


def test_override_severity_citizen_denied(auth_headers):
    """
    Verify that a normal citizen cannot override complaint severity.
    """

    # Input
    complaint_id = "CMP-65C600"
    endpoint = f"/complaints/{complaint_id}/severity"

    payload = {
        "severity": "HIGH",
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
        f"\nTest Case       : Severity Override Citizen Authorization"
        f"\nInput           : PATCH {endpoint}"
        f"\nExpected Output : HTTP Status {expected_status}"
        f"\nActual Output   : HTTP Status {actual_status}"
        f"\nResponse        : {response.text}"
    )


def test_override_severity_missing_severity(admin_auth_headers):
    """
    Verify that severity is required in the request payload.
    """

    # Input
    complaint_id = "CMP-65C600"
    endpoint = f"/complaints/{complaint_id}/severity"

    payload = {
        "remarks": "Missing severity test"
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
        f"\nTest Case       : Missing Severity"
        f"\nInput           : PATCH {endpoint}"
        f"\nExpected Output : HTTP Status {expected_status}"
        f"\nActual Output   : HTTP Status {actual_status}"
        f"\nResponse        : {response.text}"
    )


def test_override_severity_invalid_value(admin_auth_headers):
    """
    Verify that an unsupported severity value is rejected.
    """

    # Input
    complaint_id = "CMP-65C600"
    endpoint = f"/complaints/{complaint_id}/severity"

    payload = {
        "severity": "INVALID_SEVERITY",
        "remarks": "Invalid severity test"
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
        f"\nTest Case       : Invalid Severity Value"
        f"\nInput           : PATCH {endpoint}"
        f"\nExpected Output : HTTP Status {expected_status}"
        f"\nActual Output   : HTTP Status {actual_status}"
        f"\nResponse        : {response.text}"
    )


def test_override_severity_empty_value(admin_auth_headers):
    """
    Verify that an empty severity value is rejected.
    """

    # Input
    complaint_id = "CMP-65C600"
    endpoint = f"/complaints/{complaint_id}/severity"

    payload = {
        "severity": "",
        "remarks": "Empty severity test"
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
        f"\nTest Case       : Empty Severity Value"
        f"\nInput           : PATCH {endpoint}"
        f"\nExpected Output : HTTP Status {expected_status}"
        f"\nActual Output   : HTTP Status {actual_status}"
        f"\nResponse        : {response.text}"
    )


def test_override_severity_null_value(admin_auth_headers):
    """
    Verify that a null severity value is rejected.
    """

    # Input
    complaint_id = "CMP-65C600"
    endpoint = f"/complaints/{complaint_id}/severity"

    payload = {
        "severity": None,
        "remarks": "Null severity test"
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
        f"\nTest Case       : Null Severity Value"
        f"\nInput           : PATCH {endpoint}"
        f"\nExpected Output : HTTP Status {expected_status}"
        f"\nActual Output   : HTTP Status {actual_status}"
        f"\nResponse        : {response.text}"
    )


def test_override_severity_nonexistent_complaint(
    admin_auth_headers
):
    """
    Verify that severity cannot be overridden for a nonexistent
    complaint.
    """

    # Input
    complaint_id = "CMP-DOES-NOT-EXIST"
    endpoint = f"/complaints/{complaint_id}/severity"

    payload = {
        "severity": "HIGH",
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
        f"\nTest Case       : Severity Nonexistent Complaint"
        f"\nInput           : PATCH {endpoint}"
        f"\nExpected Output : HTTP Status {expected_status}"
        f"\nActual Output   : HTTP Status {actual_status}"
        f"\nResponse        : {response.text}"
    )


def test_override_severity_malformed_complaint_id(
    admin_auth_headers
):
    """
    Verify that a malformed complaint ID does not produce
    an unexpected server error.
    """

    # Input
    complaint_id = "INVALID"
    endpoint = f"/complaints/{complaint_id}/severity"

    payload = {
        "severity": "HIGH",
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
        f"\nTest Case       : Severity Malformed Complaint ID"
        f"\nInput           : PATCH {endpoint}"
        f"\nExpected Output : HTTP Status {expected_status}"
        f"\nActual Output   : HTTP Status {actual_status}"
        f"\nResponse        : {response.text}"
    )

    assert actual_status != 500, (
        f"\nUnexpected server error."
        f"\nResponse : {response.text}"
    )


def test_override_severity_response_structure(
    admin_auth_headers
):
    """
    Verify that a successful severity override returns the
    expected complaint information.
    """

    # Input
    complaint_id = "CMP-65C600"
    endpoint = f"/complaints/{complaint_id}/severity"

    # Use a valid severity.
    payload = {
        "severity": "HIGH",
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
        f"\nTest Case       : Severity Response Structure"
        f"\nInput           : PATCH {endpoint}"
        f"\nExpected Output : HTTP Status {expected_status}"
        f"\nActual Output   : HTTP Status {actual_status}"
        f"\nResponse        : {response.text}"
    )

    data = response.json()

    assert isinstance(data, dict)

    assert "complaintId" in data
    assert "severity" in data

    assert data["complaintId"] == complaint_id
    assert data["severity"] == "HIGH"


def test_override_severity_repeated_request(
    admin_auth_headers
):
    """
    Verify that repeatedly setting a valid severity remains
    a controlled API operation.
    """

    # Input
    complaint_id = "CMP-65C600"
    endpoint = f"/complaints/{complaint_id}/severity"

    payload = {
        "severity": "MEDIUM",
        "remarks": "Repeated severity test"
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
        f"\nTest Case       : First Repeated Severity Request"
        f"\nExpected Output : HTTP Status {expected_statuses}"
        f"\nActual Output   : HTTP Status "
        f"{first_response.status_code}"
        f"\nResponse        : {first_response.text}"
    )

    assert second_response.status_code in expected_statuses, (
        f"\nTest Case       : Second Repeated Severity Request"
        f"\nExpected Output : HTTP Status {expected_statuses}"
        f"\nActual Output   : HTTP Status "
        f"{second_response.status_code}"
        f"\nResponse        : {second_response.text}"
    )

    assert first_response.status_code != 500
    assert second_response.status_code != 500


def test_override_severity_no_server_error(
    admin_auth_headers
):
    """
    Verify that the severity endpoint does not return an
    unexpected internal server error for valid input.
    """

    # Input
    complaint_id = "CMP-65C600"
    endpoint = f"/complaints/{complaint_id}/severity"

    payload = {
        "severity": "LOW",
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
        f"\nTest Case       : Severity Server Error Check"
        f"\nInput           : PATCH {endpoint}"
        f"\nUnexpected Output : HTTP Status 500"
        f"\nResponse          : {response.text}"
    )

    assert actual_status in [200, 400], (
        f"\nUnexpected Status : {actual_status}"
        f"\nResponse          : {response.text}"
    )