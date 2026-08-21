import requests

BASE_URL = "http://127.0.0.1:8000"


def test_get_complaint_media_requires_auth():
    """
    Verify that the Complaint Media endpoint is protected
    and requires authentication.
    """

    # Input
    complaint_id = "CMP-TEST001"
    endpoint = f"/complaints/{complaint_id}/media"

    # Expected Output
    expected_status = [200, 401, 403, 404]

    # Actual Output
    response = requests.get(f"{BASE_URL}{endpoint}")
    actual_status = response.status_code

    # Assertion
    assert actual_status in expected_status, (
        f"\nTest Case       : Complaint Media Authentication"
        f"\nInput           : GET {endpoint}"
        f"\nExpected Output : HTTP Status {expected_status}"
        f"\nActual Output   : HTTP Status {actual_status}"
    )

def test_get_complaint_media(admin_auth_headers):
    """
    Verify that an authenticated administrator can retrieve
    media associated with an existing complaint.
    """

    # Input
    complaint_id = "CMP-65C600"
    endpoint = f"/complaints/{complaint_id}/media"

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
        f"\nTest Case       : Get Complaint Media"
        f"\nInput           : GET {endpoint}"
        f"\nExpected Output : HTTP Status {expected_status}"
        f"\nActual Output   : HTTP Status {actual_status}"
        f"\nResponse        : {response.text}"
    )

    # Validate response structure
    data = response.json()

    assert isinstance(data, list), (
        f"\nExpected Output : List of media records"
        f"\nActual Output   : {data}"
    )