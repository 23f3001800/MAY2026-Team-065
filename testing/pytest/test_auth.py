import requests

BASE_URL = "http://127.0.0.1:8000"


def test_swagger_available():
    # Input
    endpoint = "/docs"

    # Expected Output
    expected_status = 200

    # Actual Output
    response = requests.get(f"{BASE_URL}{endpoint}")
    actual_status = response.status_code

    # Assertions
    assert actual_status == expected_status

    print(f"\nInput           : GET {endpoint}")
    print(f"Expected Output : HTTP {expected_status}")
    print(f"Actual Output   : HTTP {actual_status}")
    print("Result          : PASS")


def test_openapi_available():
    # Input
    endpoint = "/openapi.json"

    # Expected Output
    expected_status = 200

    # Actual Output
    response = requests.get(f"{BASE_URL}{endpoint}")
    actual_status = response.status_code

    # Assertions
    assert actual_status == expected_status

    print(f"\nInput           : GET {endpoint}")
    print(f"Expected Output : HTTP {expected_status}")
    print(f"Actual Output   : HTTP {actual_status}")
    print("Result          : PASS")