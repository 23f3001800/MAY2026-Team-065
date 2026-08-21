import requests

BASE_URL = "http://127.0.0.1:8000"


def test_get_complaint_by_id(auth_headers):
    """
    Verify that an authenticated user can retrieve
    a complaint by its ID.
    """

    # Input
    endpoint = "/complaints/CMP-65C600"

    # Expected Output
    expected_status = 200

    # Actual Output
    response = requests.get(
        f"{BASE_URL}{endpoint}",
        headers=auth_headers
    )

    actual_status = response.status_code

    # Assertion
    assert actual_status == expected_status, (
        f"\nTest Case       : Get Complaint By ID"
        f"\nInput           : GET {endpoint}"
        f"\nExpected Output : HTTP Status {expected_status}"
        f"\nActual Output   : HTTP Status {actual_status}"
        f"\nResponse        : {response.text}"
    )

    # Response validation
    data = response.json()

    assert data["complaintId"] == "CMP-65C600"
    assert "description" in data
    assert "status" in data
    assert "severity" in data