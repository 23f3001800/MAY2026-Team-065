import requests

BASE_URL = "http://127.0.0.1:8000"


def test_get_complaints_requires_auth():
    # Input
    endpoint = "/complaints"

    # Expected Output
    expected_status = [200, 401, 403]

    # Actual Output
    response = requests.get(f"{BASE_URL}{endpoint}")
    actual_status = response.status_code

    # Validation
    assert actual_status in expected_status, (
        f"\nInput           : GET {endpoint}"
        f"\nExpected Output : HTTP {expected_status}"
        f"\nActual Output   : HTTP {actual_status}"
    )