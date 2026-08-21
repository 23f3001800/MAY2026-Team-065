import requests

BASE_URL = "http://127.0.0.1:8000"


def test_override_complaint_severity(admin_auth_headers):
    """
    Verify that an administrator can override
    the severity of a complaint.

    The test reads the current severity and selects
    a different valid severity so it can be executed
    repeatedly without failing because the requested
    severity is already set.
    """

    # Input
    complaint_id = "CMP-65C600"
    endpoint = f"/complaints/{complaint_id}/severity"

    # ---------------------------------------------------------
    # Step 1: Get the current complaint
    # ---------------------------------------------------------
    complaint_response = requests.get(
        f"{BASE_URL}/complaints/{complaint_id}",
        headers=admin_auth_headers
    )

    assert complaint_response.status_code == 200, (
        f"\nTest Case       : Get Complaint Before Severity Override"
        f"\nInput           : GET /complaints/{complaint_id}"
        f"\nExpected Output : HTTP Status 200"
        f"\nActual Output   : HTTP Status {complaint_response.status_code}"
        f"\nResponse        : {complaint_response.text}"
    )

    complaint_data = complaint_response.json()

    # Get current severity
    current_severity = complaint_data.get("severity")

    # ---------------------------------------------------------
    # Step 2: Select a different valid severity
    # ---------------------------------------------------------
    valid_severities = ["LOW", "MEDIUM", "HIGH", "CRITICAL"]

    new_severity = next(
        (
            severity
            for severity in valid_severities
            if severity != current_severity
        ),
        None
    )

    assert new_severity is not None, (
        f"\nTest Case        : Select New Severity"
        f"\nCurrent Severity : {current_severity}"
        f"\nValid Severities : {valid_severities}"
    )

    payload = {
        "severity": new_severity,
        "remarks": "string"
    }

    # ---------------------------------------------------------
    # Step 3: Override severity
    # ---------------------------------------------------------
    expected_status = 200

    response = requests.patch(
        f"{BASE_URL}{endpoint}",
        json=payload,
        headers=admin_auth_headers
    )

    actual_status = response.status_code

    # ---------------------------------------------------------
    # Step 4: Verify HTTP status
    # ---------------------------------------------------------
    assert actual_status == expected_status, (
        f"\nTest Case       : Override Complaint Severity"
        f"\nInput           : PATCH {endpoint}"
        f"\nExpected Output : HTTP Status {expected_status}"
        f"\nActual Output   : HTTP Status {actual_status}"
        f"\nResponse        : {response.text}"
    )

    # ---------------------------------------------------------
    # Step 5: Verify response
    # ---------------------------------------------------------
    data = response.json()

    assert data["complaintId"] == complaint_id, (
        f"\nExpected Complaint ID : {complaint_id}"
        f"\nActual Complaint ID   : {data.get('complaintId')}"
    )

    assert data["severity"] == new_severity, (
        f"\nExpected Severity : {new_severity}"
        f"\nActual Severity   : {data.get('severity')}"
    )