import requests


BASE_URL = "http://127.0.0.1:8000"


def test_get_complaint_by_id(auth_headers):
    """
    Verify that an authenticated user can retrieve
    a complaint by its ID.
    """

    # Input
    complaint_id = "CMP-65C600"
    endpoint = f"/complaints/{complaint_id}"

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

    assert isinstance(data, dict), (
        f"\nExpected Output : JSON object"
        f"\nActual Output   : {data}"
    )

    assert data["complaintId"] == complaint_id, (
        f"\nExpected Complaint ID : {complaint_id}"
        f"\nActual Complaint ID   : {data.get('complaintId')}"
    )

    assert "description" in data
    assert "status" in data
    assert "severity" in data


def test_get_complaint_by_id_requires_auth():
    """
    Verify that retrieving a complaint requires authentication.
    """

    # Input
    complaint_id = "CMP-65C600"
    endpoint = f"/complaints/{complaint_id}"

    # Expected Output
    expected_status = [401, 403]

    # Actual Output
    response = requests.get(
        f"{BASE_URL}{endpoint}"
    )

    actual_status = response.status_code

    # Assertion
    assert actual_status in expected_status, (
        f"\nTest Case       : Get Complaint Authentication"
        f"\nInput           : GET {endpoint}"
        f"\nExpected Output : HTTP Status {expected_status}"
        f"\nActual Output   : HTTP Status {actual_status}"
        f"\nResponse        : {response.text}"
    )


def test_get_complaint_by_id_invalid_token():
    """
    Verify that an invalid JWT cannot be used to retrieve
    a complaint.
    """

    # Input
    complaint_id = "CMP-65C600"
    endpoint = f"/complaints/{complaint_id}"

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
        f"\nTest Case       : Get Complaint Invalid Token"
        f"\nInput           : GET {endpoint}"
        f"\nExpected Output : HTTP Status {expected_status}"
        f"\nActual Output   : HTTP Status {actual_status}"
        f"\nResponse        : {response.text}"
    )


def test_get_nonexistent_complaint_by_id(auth_headers):
    """
    Verify that retrieving a complaint that does not exist
    returns an appropriate not-found response.
    """

    # Input
    complaint_id = "CMP-DOES-NOT-EXIST"
    endpoint = f"/complaints/{complaint_id}"

    # Expected Output
    expected_status = 404

    # Actual Output
    response = requests.get(
        f"{BASE_URL}{endpoint}",
        headers=auth_headers
    )

    actual_status = response.status_code

    # Assertion
    assert actual_status == expected_status, (
        f"\nTest Case       : Get Nonexistent Complaint"
        f"\nInput           : GET {endpoint}"
        f"\nExpected Output : HTTP Status {expected_status}"
        f"\nActual Output   : HTTP Status {actual_status}"
        f"\nResponse        : {response.text}"
    )


def test_get_complaints_collection(auth_headers):
    """
    Verify that an authenticated user can retrieve the
    complaints collection from the base complaints endpoint.
    """

    # Input
    endpoint = "/complaints/"

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
        f"\nTest Case       : Get Complaints Collection"
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

    # Validate complaint structure when records are available
    if len(data) > 0:
        complaint = data[0]

        assert isinstance(complaint, dict), (
            f"\nExpected complaint item : JSON object"
            f"\nActual complaint item   : {complaint}"
        )

        assert "complaintId" in complaint
        assert "description" in complaint
        assert "status" in complaint
        assert "severity" in complaint


def test_get_complaint_with_malformed_id(auth_headers):
    """
    Verify that a malformed complaint ID does not result
    in a server error.
    """

    # Input
    complaint_id = "INVALID"
    endpoint = f"/complaints/{complaint_id}"

    # Expected Output
    expected_status = [400, 404, 422]

    # Actual Output
    response = requests.get(
        f"{BASE_URL}{endpoint}",
        headers=auth_headers
    )

    actual_status = response.status_code

    # Assertion
    assert actual_status in expected_status, (
        f"\nTest Case       : Get Complaint Malformed ID"
        f"\nInput           : GET {endpoint}"
        f"\nExpected Output : HTTP Status {expected_status}"
        f"\nActual Output   : HTTP Status {actual_status}"
        f"\nResponse        : {response.text}"
    )

    assert actual_status != 500, (
        f"\nUnexpected server error."
        f"\nResponse        : {response.text}"
    )


def test_get_complaint_response_content_type(auth_headers):
    """
    Verify that a successful complaint retrieval returns JSON.
    """

    # Input
    complaint_id = "CMP-65C600"
    endpoint = f"/complaints/{complaint_id}"

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
        f"\nTest Case       : Complaint Response Content Type"
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

    data = response.json()

    assert isinstance(data, dict), (
        f"\nExpected Output : JSON object"
        f"\nActual Output   : {data}"
    )


def test_get_complaint_required_fields(auth_headers):
    """
    Verify that the complaint response contains the
    essential complaint fields.
    """

    # Input
    complaint_id = "CMP-65C600"
    endpoint = f"/complaints/{complaint_id}"

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
        f"\nTest Case       : Complaint Required Fields"
        f"\nInput           : GET {endpoint}"
        f"\nExpected Output : HTTP Status {expected_status}"
        f"\nActual Output   : HTTP Status {actual_status}"
        f"\nResponse        : {response.text}"
    )

    data = response.json()

    required_fields = [
        "complaintId",
        "description",
        "status",
        "severity",
    ]

    for field in required_fields:
        assert field in data, (
            f"\nMissing required field : {field}"
            f"\nResponse                : {data}"
        )


def test_get_complaint_repeated_request(auth_headers):
    """
    Verify that repeated retrieval of the same complaint
    remains successful and returns the same complaint ID.
    """

    # Input
    complaint_id = "CMP-65C600"
    endpoint = f"/complaints/{complaint_id}"

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
        f"\nTest Case       : First Complaint Retrieval"
        f"\nExpected Output : HTTP Status {expected_status}"
        f"\nActual Output   : HTTP Status "
        f"{first_response.status_code}"
        f"\nResponse        : {first_response.text}"
    )

    assert second_response.status_code == expected_status, (
        f"\nTest Case       : Repeated Complaint Retrieval"
        f"\nExpected Output : HTTP Status {expected_status}"
        f"\nActual Output   : HTTP Status "
        f"{second_response.status_code}"
        f"\nResponse        : {second_response.text}"
    )

    first_data = first_response.json()
    second_data = second_response.json()

    assert first_data["complaintId"] == complaint_id
    assert second_data["complaintId"] == complaint_id