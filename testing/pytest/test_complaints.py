import requests


BASE_URL = "http://127.0.0.1:8000"


def test_get_complaints_requires_auth():
    """
    Verify that the complaints collection endpoint
    requires authentication.
    """

    # Input
    endpoint = "/complaints"

    # Expected Output
    expected_status = [401, 403]

    # Actual Output
    response = requests.get(
        f"{BASE_URL}{endpoint}"
    )

    actual_status = response.status_code

    # Assertion
    assert actual_status in expected_status, (
        f"\nTest Case       : Get Complaints Authentication"
        f"\nInput           : GET {endpoint}"
        f"\nExpected Output : HTTP Status {expected_status}"
        f"\nActual Output   : HTTP Status {actual_status}"
        f"\nResponse        : {response.text}"
    )


def test_get_complaints(auth_headers):
    """
    Verify that an authenticated user can retrieve
    the complaints collection.
    """

    # Input
    endpoint = "/complaints"

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
        f"\nTest Case       : Get Complaints"
        f"\nInput           : GET {endpoint}"
        f"\nExpected Output : HTTP Status {expected_status}"
        f"\nActual Output   : HTTP Status {actual_status}"
        f"\nResponse        : {response.text}"
    )

    # Response validation
    data = response.json()

    assert isinstance(data, list), (
        f"\nExpected Output : List of complaints"
        f"\nActual Output   : {data}"
    )


def test_get_complaints_response_content_type(auth_headers):
    """
    Verify that the complaints endpoint returns
    a JSON response.
    """

    # Input
    endpoint = "/complaints"

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
        f"\nTest Case       : Complaints Response Content Type"
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


def test_get_complaints_structure(auth_headers):
    """
    Verify that returned complaint records have
    the essential complaint fields.
    """

    # Input
    endpoint = "/complaints"

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
        f"\nTest Case       : Complaints Response Structure"
        f"\nInput           : GET {endpoint}"
        f"\nExpected Output : HTTP Status {expected_status}"
        f"\nActual Output   : HTTP Status {actual_status}"
        f"\nResponse        : {response.text}"
    )

    data = response.json()

    assert isinstance(data, list)

    # Validate structure when complaints are available
    for complaint in data:
        assert isinstance(complaint, dict), (
            f"\nExpected Complaint : JSON object"
            f"\nActual Complaint   : {complaint}"
        )

        assert "complaintId" in complaint
        assert "description" in complaint
        assert "status" in complaint
        assert "severity" in complaint


def test_get_complaints_invalid_token():
    """
    Verify that an invalid JWT cannot be used to retrieve
    the complaints collection.
    """

    # Input
    endpoint = "/complaints"

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
        f"\nTest Case       : Get Complaints Invalid Token"
        f"\nInput           : GET {endpoint}"
        f"\nExpected Output : HTTP Status {expected_status}"
        f"\nActual Output   : HTTP Status {actual_status}"
        f"\nResponse        : {response.text}"
    )


def test_get_complaints_malformed_authorization_header():
    """
    Verify that a malformed Authorization header
    is rejected.
    """

    # Input
    endpoint = "/complaints"

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
        f"\nTest Case       : Malformed Authorization Header"
        f"\nInput           : GET {endpoint}"
        f"\nExpected Output : HTTP Status {expected_status}"
        f"\nActual Output   : HTTP Status {actual_status}"
        f"\nResponse        : {response.text}"
    )


def test_get_complaints_repeated_request(auth_headers):
    """
    Verify that repeated requests to the complaints endpoint
    remain successful.
    """

    # Input
    endpoint = "/complaints"

    # Expected Output
    expected_status = 200

    # Actual Output
    first_response = requests.get(
        f"{BASE_URL}{endpoint}",
        headers=auth_headers
    )

    second_response = requests.get(
        f"{BASE_URL}{endpoint}",
        headers=auth_headers
    )

    # Assertions
    assert first_response.status_code == expected_status, (
        f"\nTest Case       : First Complaints Request"
        f"\nExpected Output : HTTP Status {expected_status}"
        f"\nActual Output   : HTTP Status "
        f"{first_response.status_code}"
        f"\nResponse        : {first_response.text}"
    )

    assert second_response.status_code == expected_status, (
        f"\nTest Case       : Repeated Complaints Request"
        f"\nExpected Output : HTTP Status {expected_status}"
        f"\nActual Output   : HTTP Status "
        f"{second_response.status_code}"
        f"\nResponse        : {second_response.text}"
    )

    first_data = first_response.json()
    second_data = second_response.json()

    assert isinstance(first_data, list)
    assert isinstance(second_data, list)


def test_get_complaints_no_server_error(auth_headers):
    """
    Verify that the complaints endpoint does not return
    an unexpected internal server error.
    """

    # Input
    endpoint = "/complaints"

    # Expected Output
    expected_status = 200

    # Actual Output
    response = requests.get(
        f"{BASE_URL}{endpoint}",
        headers=auth_headers
    )

    actual_status = response.status_code

    # Assertion
    assert actual_status != 500, (
        f"\nTest Case       : Complaints Server Error Check"
        f"\nInput           : GET {endpoint}"
        f"\nUnexpected Output : HTTP Status 500"
        f"\nResponse          : {response.text}"
    )

    assert actual_status == expected_status, (
        f"\nTest Case       : Get Complaints"
        f"\nExpected Output : HTTP Status {expected_status}"
        f"\nActual Output   : HTTP Status {actual_status}"
        f"\nResponse        : {response.text}"
    )