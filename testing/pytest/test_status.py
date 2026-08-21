import requests

BASE_URL = "http://127.0.0.1:8000"


def test_update_complaint_status(admin_auth_headers):
    """
    Verify that an administrator can update
    the status of a complaint.
    """

    # Input
    endpoint = "/complaints/CMP-65C600/status"

    payload = {
        "status": "PENDING",
        "remarks": "string"
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

    assert data["complaintId"] == "CMP-65C600"
    assert data["status"] == "PENDING"