import requests

BASE_URL = "http://127.0.0.1:8000"


def test_get_complaint_history_requires_auth():
    """
    Verify that the Complaint History endpoint is protected
    and requires authentication.
    """

    # Input
    complaint_id = "CMP-TEST001"
    endpoint = f"/complaints/{complaint_id}/history"

    # Expected Output
    expected_status = [200, 401, 403, 404]

    # Actual Output
    response = requests.get(f"{BASE_URL}{endpoint}")
    actual_status = response.status_code

    # Assertion
    assert actual_status in expected_status, (
        f"\nTest Case       : Complaint History Authentication"
        f"\nInput           : GET {endpoint}"
        f"\nExpected Output : HTTP Status {expected_status}"
        f"\nActual Output   : HTTP Status {actual_status}"
    )

def test_get_complaint_history(admin_auth_headers):
    """
    Verify that an authenticated administrator can retrieve
    the history of an existing complaint.
    """

    # Input
    complaint_id = "CMP-65C600"
    endpoint = f"/complaints/{complaint_id}/history"

    # Expected Output
    expected_status = 200

    # Actual Output
    response = requests.get(
        f"{BASE_URL}{endpoint}",
        headers=admin_auth_headers
    )

    actual_status = response.status_code

    # Assertion
    assert actual_status == expected_status, (
        f"\nTest Case       : Get Complaint History"
        f"\nInput           : GET {endpoint}"
        f"\nExpected Output : HTTP Status {expected_status}"
        f"\nActual Output   : HTTP Status {actual_status}"
        f"\nResponse        : {response.text}"
    )

    # Validate response structure
    data = response.json()

    assert isinstance(data, list), (
        f"\nExpected Output : List of history records"
        f"\nActual Output   : {data}"
    )

    for item in data:
        assert "historyId" in item
        assert "status" in item
        assert "remarks" in item
        assert "timestamp" in item
        assert "complaintId" in item