import requests


BASE_URL = "http://127.0.0.1:8000"


def test_get_escalations_requires_auth():
    """
    Verify that the Escalations endpoint is protected
    and requires authentication.
    """

    # Input
    endpoint = "/complaints/escalations"

    # Expected Output
    expected_status = [401, 403]

    # Actual Output
    response = requests.get(
        f"{BASE_URL}{endpoint}"
    )

    actual_status = response.status_code

    # Assertion
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

    # Input
    endpoint = "/complaints/escalations"

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
        f"\nTest Case       : Get Escalations"
        f"\nInput           : GET {endpoint}"
        f"\nExpected Output : HTTP Status {expected_status}"
        f"\nActual Output   : HTTP Status {actual_status}"
        f"\nResponse        : {response.text}"
    )

    # Response validation
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

    # Count consistency validation
    assert data["breachedCount"] == len(data["breached"]), (
        f"\nExpected Breached Count : {len(data['breached'])}"
        f"\nActual Breached Count   : {data['breachedCount']}"
    )

    assert data["atRiskCount"] == len(data["atRisk"]), (
        f"\nExpected At-Risk Count : {len(data['atRisk'])}"
        f"\nActual At-Risk Count   : {data['atRiskCount']}"
    )


def test_get_escalations_citizen_access(auth_headers):
    """
    Verify whether an authenticated citizen can access
    the escalations endpoint.

    The test accepts the actual supported authorization
    behavior while ensuring the API does not return
    an unexpected server error.
    """

    # Input
    endpoint = "/complaints/escalations"

    # Expected Output
    expected_status = [200, 403]

    # Actual Output
    response = requests.get(
        f"{BASE_URL}{endpoint}",
        headers=auth_headers
    )

    actual_status = response.status_code

    # Assertion
    assert actual_status in expected_status, (
        f"\nTest Case       : Escalations Citizen Access"
        f"\nInput           : GET {endpoint}"
        f"\nExpected Output : HTTP Status {expected_status}"
        f"\nActual Output   : HTTP Status {actual_status}"
        f"\nResponse        : {response.text}"
    )

    assert actual_status != 500, (
        f"\nUnexpected server error."
        f"\nResponse : {response.text}"
    )


def test_get_escalations_invalid_token():
    """
    Verify that an invalid JWT cannot be used to access
    the escalations endpoint.
    """

    # Input
    endpoint = "/complaints/escalations"

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
        f"\nTest Case       : Escalations Invalid Token"
        f"\nInput           : GET {endpoint}"
        f"\nExpected Output : HTTP Status {expected_status}"
        f"\nActual Output   : HTTP Status {actual_status}"
        f"\nResponse        : {response.text}"
    )


def test_get_escalations_malformed_authorization_header():
    """
    Verify that a malformed Authorization header
    is rejected.
    """

    # Input
    endpoint = "/complaints/escalations"

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
        f"\nTest Case       : Escalations Malformed Authorization"
        f"\nInput           : GET {endpoint}"
        f"\nExpected Output : HTTP Status {expected_status}"
        f"\nActual Output   : HTTP Status {actual_status}"
        f"\nResponse        : {response.text}"
    )


def test_get_escalations_response_content_type(admin_auth_headers):
    """
    Verify that a successful escalations request
    returns JSON.
    """

    # Input
    endpoint = "/complaints/escalations"

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
        f"\nTest Case       : Escalations Response Content Type"
        f"\nInput           : GET {endpoint}"
        f"\nExpected Output : HTTP Status {expected_status}"
        f"\nActual Output   : HTTP Status {actual_status}"
        f"\nResponse        : {response.text}"
    )

    assert response.headers.get("content-type", "").startswith(
        "application/json"
    ), (
        f"\nExpected Content-Type : application/json"
        f"\nActual Content-Type   : "
        f"{response.headers.get('content-type')}"
    )


def test_get_escalations_item_structure(admin_auth_headers):
    """
    Verify that individual breached and at-risk escalation
    records are returned as JSON objects.
    """

    # Input
    endpoint = "/complaints/escalations"

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
        f"\nTest Case       : Escalation Item Structure"
        f"\nInput           : GET {endpoint}"
        f"\nExpected Output : HTTP Status {expected_status}"
        f"\nActual Output   : HTTP Status {actual_status}"
        f"\nResponse        : {response.text}"
    )

    data = response.json()

    assert isinstance(data["breached"], list)
    assert isinstance(data["atRisk"], list)

    for item in data["breached"]:
        assert isinstance(item, dict), (
            f"\nExpected breached item : JSON object"
            f"\nActual item            : {item}"
        )

    for item in data["atRisk"]:
        assert isinstance(item, dict), (
            f"\nExpected at-risk item : JSON object"
            f"\nActual item            : {item}"
        )


def test_get_escalations_repeated_request(admin_auth_headers):
    """
    Verify that repeated escalation requests remain
    successful and return consistent count information.
    """

    # Input
    endpoint = "/complaints/escalations"

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
        f"\nTest Case       : First Escalations Request"
        f"\nExpected Output : HTTP Status {expected_status}"
        f"\nActual Output   : HTTP Status "
        f"{first_response.status_code}"
        f"\nResponse        : {first_response.text}"
    )

    assert second_response.status_code == expected_status, (
        f"\nTest Case       : Repeated Escalations Request"
        f"\nExpected Output : HTTP Status {expected_status}"
        f"\nActual Output   : HTTP Status "
        f"{second_response.status_code}"
        f"\nResponse        : {second_response.text}"
    )

    first_data = first_response.json()
    second_data = second_response.json()

    assert first_data["breachedCount"] == len(first_data["breached"])
    assert first_data["atRiskCount"] == len(first_data["atRisk"])

    assert second_data["breachedCount"] == len(second_data["breached"])
    assert second_data["atRiskCount"] == len(second_data["atRisk"])


def test_get_escalations_no_server_error(admin_auth_headers):
    """
    Verify that the escalations endpoint does not produce
    an unexpected internal server error.
    """

    # Input
    endpoint = "/complaints/escalations"

    # Actual Output
    response = requests.get(
        f"{BASE_URL}{endpoint}",
        headers=admin_auth_headers
    )

    actual_status = response.status_code

    # Assertion
    assert actual_status != 500, (
        f"\nTest Case       : Escalations Server Error Check"
        f"\nInput           : GET {endpoint}"
        f"\nUnexpected Output : HTTP Status 500"
        f"\nResponse          : {response.text}"
    )

    assert actual_status == 200, (
        f"\nTest Case       : Get Escalations"
        f"\nExpected Output : HTTP Status 200"
        f"\nActual Output   : HTTP Status {actual_status}"
        f"\nResponse        : {response.text}"
    )