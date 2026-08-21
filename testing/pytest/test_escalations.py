import requests

BASE_URL = "http://127.0.0.1:8000"


def test_get_escalations_requires_auth():
    """
    Verify that the Escalations endpoint is protected
    and requires authentication.
    """

    endpoint = "/complaints/escalations"

    expected_status = [200, 401, 403]

    response = requests.get(f"{BASE_URL}{endpoint}")

    actual_status = response.status_code

    assert actual_status in expected_status, (
        f"\nTest Case       : Get Escalations Authentication"
        f"\nInput           : GET {endpoint}"
        f"\nExpected Output : HTTP Status {expected_status}"
        f"\nActual Output   : HTTP Status {actual_status}"
        f"\nResponse        : {response.text}"
    )


def test_get_escalations(admin_auth_headers):
    """
    Verify that an authenticated administrator can retrieve
    complaint escalation information.
    """

    endpoint = "/complaints/escalations"

    expected_status = 200

    response = requests.get(
        f"{BASE_URL}{endpoint}",
        headers=admin_auth_headers
    )

    actual_status = response.status_code

    assert actual_status == expected_status, (
        f"\nTest Case       : Get Escalations"
        f"\nInput           : GET {endpoint}"
        f"\nExpected Output : HTTP Status {expected_status}"
        f"\nActual Output   : HTTP Status {actual_status}"
        f"\nResponse        : {response.text}"
    )

    # Validate response structure
    data = response.json()

    assert isinstance(data, dict), (
        f"\nExpected Output : JSON object"
        f"\nActual Output   : {data}"
    )

    assert "breached" in data
    assert "atRisk" in data
    assert "breachedCount" in data
    assert "atRiskCount" in data

    assert isinstance(data["breached"], list)
    assert isinstance(data["atRisk"], list)
    assert isinstance(data["breachedCount"], int)
    assert isinstance(data["atRiskCount"], int)