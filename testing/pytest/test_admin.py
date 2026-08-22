import requests


BASE_URL = "http://127.0.0.1:8000"


def test_admin_analytics_requires_auth():
    """
    Verify that the Admin Analytics endpoint is protected
    and cannot be accessed without authentication.
    """

    # Input
    endpoint = "/admin/analytics"

    # Expected Output
    expected_status = [401, 403]

    # Actual Output
    response = requests.get(
        f"{BASE_URL}{endpoint}"
    )

    actual_status = response.status_code

    # Assertion
    assert actual_status in expected_status, (
        f"\nTest Case       : Admin Analytics Authentication"
        f"\nInput           : GET {endpoint}"
        f"\nExpected Output : HTTP Status {expected_status}"
        f"\nActual Output   : HTTP Status {actual_status}"
        f"\nResponse        : {response.text}"
    )


def test_get_admin_analytics(admin_auth_headers):
    """
    Verify that an authenticated administrator can retrieve
    city-level analytics.
    """

    # Input
    endpoint = "/admin/analytics"

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
        f"\nTest Case       : Get Admin Analytics"
        f"\nInput           : GET {endpoint}"
        f"\nExpected Output : HTTP Status {expected_status}"
        f"\nActual Output   : HTTP Status {actual_status}"
        f"\nResponse        : {response.text}"
    )

    # Response validation
    assert response.headers.get("content-type", "").startswith(
        "application/json"
    ), (
        f"\nExpected Content-Type : application/json"
        f"\nActual Content-Type   : "
        f"{response.headers.get('content-type')}"
    )

    data = response.json()

    assert isinstance(data, dict), (
        f"\nExpected Output : JSON object"
        f"\nActual Output   : {data}"
    )


def test_admin_analytics_denied_for_citizen(auth_headers):
    """
    Verify that a normal citizen cannot access
    the administrator analytics endpoint.
    """

    # Input
    endpoint = "/admin/analytics"

    # Expected Output
    expected_status = 403

    # Actual Output
    response = requests.get(
        f"{BASE_URL}{endpoint}",
        headers=auth_headers
    )

    actual_status = response.status_code

    # Assertion
    assert actual_status == expected_status, (
        f"\nTest Case       : Admin Analytics Role Authorization"
        f"\nInput           : GET {endpoint}"
        f"\nExpected Output : HTTP Status {expected_status}"
        f"\nActual Output   : HTTP Status {actual_status}"
        f"\nResponse        : {response.text}"
    )


def test_admin_analytics_invalid_token():
    """
    Verify that the Admin Analytics endpoint rejects
    an invalid JWT token.
    """

    # Input
    endpoint = "/admin/analytics"

    headers = {
        "Authorization": "Bearer invalid.jwt.token"
    }

    # Expected Output
    expected_status = [401, 403]

    # Actual Output
    response = requests.get(
        f"{BASE_URL}{endpoint}",
        headers=headers
    )

    actual_status = response.status_code

    # Assertion
    assert actual_status in expected_status, (
        f"\nTest Case       : Admin Analytics Invalid Token"
        f"\nInput           : GET {endpoint}"
        f"\nExpected Output : HTTP Status {expected_status}"
        f"\nActual Output   : HTTP Status {actual_status}"
        f"\nResponse        : {response.text}"
    )


def test_admin_analytics_malformed_authorization():
    """
    Verify that the Admin Analytics endpoint rejects
    a malformed Authorization header.
    """

    # Input
    endpoint = "/admin/analytics"

    headers = {
        "Authorization": "InvalidToken"
    }

    # Expected Output
    expected_status = [401, 403]

    # Actual Output
    response = requests.get(
        f"{BASE_URL}{endpoint}",
        headers=headers
    )

    actual_status = response.status_code

    # Assertion
    assert actual_status in expected_status, (
        f"\nTest Case       : Admin Analytics Malformed Authorization"
        f"\nInput           : GET {endpoint}"
        f"\nExpected Output : HTTP Status {expected_status}"
        f"\nActual Output   : HTTP Status {actual_status}"
        f"\nResponse        : {response.text}"
    )


def test_admin_analytics_response_is_json(admin_auth_headers):
    """
    Verify that a successful Admin Analytics response
    contains valid JSON data.
    """

    # Input
    endpoint = "/admin/analytics"

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
        f"\nTest Case       : Admin Analytics JSON Response"
        f"\nInput           : GET {endpoint}"
        f"\nExpected Output : HTTP Status {expected_status}"
        f"\nActual Output   : HTTP Status {actual_status}"
        f"\nResponse        : {response.text}"
    )

    data = response.json()

    assert data is not None, (
        "\nExpected Output : Valid JSON response"
        f"\nActual Output   : {data}"
    )


def test_admin_analytics_repeated_request(admin_auth_headers):
    """
    Verify that repeated authenticated requests to the
    Admin Analytics endpoint continue to work correctly.
    """

    # Input
    endpoint = "/admin/analytics"

    # Expected Output
    expected_status = 200

    # Actual Output
    first_response = requests.get(
        f"{BASE_URL}{endpoint}",
        headers=admin_auth_headers
    )

    second_response = requests.get(
        f"{BASE_URL}{endpoint}",
        headers=admin_auth_headers
    )

    # Assertions
    assert first_response.status_code == expected_status, (
        f"\nTest Case       : Admin Analytics First Request"
        f"\nExpected Output : HTTP Status {expected_status}"
        f"\nActual Output   : HTTP Status "
        f"{first_response.status_code}"
        f"\nResponse        : {first_response.text}"
    )

    assert second_response.status_code == expected_status, (
        f"\nTest Case       : Admin Analytics Repeated Request"
        f"\nExpected Output : HTTP Status {expected_status}"
        f"\nActual Output   : HTTP Status "
        f"{second_response.status_code}"
        f"\nResponse        : {second_response.text}"
    )

    # Both responses should contain valid JSON.
    first_data = first_response.json()
    second_data = second_response.json()

    assert isinstance(first_data, dict)
    assert isinstance(second_data, dict)