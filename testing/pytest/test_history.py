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
    expected_status = [401, 403, 404]

    # Actual Output
    response = requests.get(
        f"{BASE_URL}{endpoint}"
    )

    actual_status = response.status_code

    # Assertion
    assert actual_status in expected_status, (
        f"\nTest Case       : Complaint History Authentication"
        f"\nInput           : GET {endpoint}"
        f"\nExpected Output : HTTP Status {expected_status}"
        f"\nActual Output   : HTTP Status {actual_status}"
        f"\nResponse        : {response.text}"
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
        assert isinstance(item, dict)

        assert "historyId" in item
        assert "status" in item
        assert "remarks" in item
        assert "timestamp" in item
        assert "complaintId" in item

        assert item["complaintId"] == complaint_id


def test_get_complaint_history_invalid_token():
    """
    Verify that an invalid JWT cannot be used to retrieve
    complaint history.
    """

    # Input
    complaint_id = "CMP-65C600"
    endpoint = f"/complaints/{complaint_id}/history"

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
        f"\nTest Case       : Complaint History Invalid Token"
        f"\nInput           : GET {endpoint}"
        f"\nExpected Output : HTTP Status {expected_status}"
        f"\nActual Output   : HTTP Status {actual_status}"
        f"\nResponse        : {response.text}"
    )


def test_get_complaint_history_malformed_authorization():
    """
    Verify that a malformed Authorization header is rejected.
    """

    # Input
    complaint_id = "CMP-65C600"
    endpoint = f"/complaints/{complaint_id}/history"

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
        f"\nTest Case       : Complaint History Malformed Authorization"
        f"\nInput           : GET {endpoint}"
        f"\nExpected Output : HTTP Status {expected_status}"
        f"\nActual Output   : HTTP Status {actual_status}"
        f"\nResponse        : {response.text}"
    )


def test_get_nonexistent_complaint_history(auth_headers):
    """
    Verify that history cannot be retrieved for a complaint
    that does not exist.
    """

    # Input
    complaint_id = "CMP-DOES-NOT-EXIST"
    endpoint = f"/complaints/{complaint_id}/history"

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
        f"\nTest Case       : Nonexistent Complaint History"
        f"\nInput           : GET {endpoint}"
        f"\nExpected Output : HTTP Status {expected_status}"
        f"\nActual Output   : HTTP Status {actual_status}"
        f"\nResponse        : {response.text}"
    )


def test_get_complaint_history_malformed_id(auth_headers):
    """
    Verify that a malformed complaint ID does not result
    in an unexpected server error.
    """

    # Input
    complaint_id = "INVALID"
    endpoint = f"/complaints/{complaint_id}/history"

    # Expected Output
    expected_status = [200, 400, 404, 422]

    # Actual Output
    response = requests.get(
        f"{BASE_URL}{endpoint}",
        headers=auth_headers
    )

    actual_status = response.status_code

    # Assertion
    assert actual_status in expected_status, (
        f"\nTest Case       : Complaint History Malformed ID"
        f"\nInput           : GET {endpoint}"
        f"\nExpected Output : HTTP Status {expected_status}"
        f"\nActual Output   : HTTP Status {actual_status}"
        f"\nResponse        : {response.text}"
    )

    assert actual_status != 500, (
        f"\nUnexpected server error."
        f"\nResponse : {response.text}"
    )


def test_get_complaint_history_response_content_type(
    admin_auth_headers
):
    """
    Verify that complaint history is returned as JSON.
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
        f"\nTest Case       : History Response Content Type"
        f"\nInput           : GET {endpoint}"
        f"\nExpected Output : HTTP Status {expected_status}"
        f"\nActual Output   : HTTP Status {actual_status}"
        f"\nResponse        : {response.text}"
    )

    assert response.headers.get(
        "content-type", ""
    ).startswith("application/json"), (
        f"\nExpected Content-Type : application/json"
        f"\nActual Content-Type   : "
        f"{response.headers.get('content-type')}"
    )


def test_complaint_history_field_types(admin_auth_headers):
    """
    Verify that individual history records contain
    correctly typed values.
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
        f"\nTest Case       : History Field Type Validation"
        f"\nInput           : GET {endpoint}"
        f"\nExpected Output : HTTP Status {expected_status}"
        f"\nActual Output   : HTTP Status {actual_status}"
        f"\nResponse        : {response.text}"
    )

    data = response.json()

    assert isinstance(data, list)

    for item in data:
        assert isinstance(item["historyId"], str)
        assert isinstance(item["complaintId"], str)
        assert isinstance(item["status"], str)
        assert isinstance(item["timestamp"], str)


def test_complaint_history_consistency(admin_auth_headers):
    """
    Verify that every returned history record belongs
    to the requested complaint.
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
        f"\nTest Case       : History Complaint Consistency"
        f"\nInput           : GET {endpoint}"
        f"\nExpected Output : HTTP Status {expected_status}"
        f"\nActual Output   : HTTP Status {actual_status}"
        f"\nResponse        : {response.text}"
    )

    data = response.json()

    for item in data:
        assert item["complaintId"] == complaint_id, (
            f"\nExpected Complaint ID : {complaint_id}"
            f"\nActual Complaint ID   : {item.get('complaintId')}"
        )


def test_get_complaint_history_repeated_request(
    admin_auth_headers
):
    """
    Verify that repeated history requests remain successful
    and return consistent data.
    """

    # Input
    complaint_id = "CMP-65C600"
    endpoint = f"/complaints/{complaint_id}/history"

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
        f"\nTest Case       : First History Request"
        f"\nExpected Output : HTTP Status {expected_status}"
        f"\nActual Output   : HTTP Status "
        f"{first_response.status_code}"
        f"\nResponse        : {first_response.text}"
    )

    assert second_response.status_code == expected_status, (
        f"\nTest Case       : Repeated History Request"
        f"\nExpected Output : HTTP Status {expected_status}"
        f"\nActual Output   : HTTP Status "
        f"{second_response.status_code}"
        f"\nResponse        : {second_response.text}"
    )

    first_data = first_response.json()
    second_data = second_response.json()

    assert first_data == second_data, (
        f"\nExpected Output : Consistent history response"
        f"\nFirst Response  : {first_data}"
        f"\nSecond Response : {second_data}"
    )


def test_get_complaint_history_no_server_error(
    admin_auth_headers
):
    """
    Verify that the complaint history endpoint does not
    return an unexpected internal server error.
    """

    # Input
    complaint_id = "CMP-65C600"
    endpoint = f"/complaints/{complaint_id}/history"

    # Actual Output
    response = requests.get(
        f"{BASE_URL}{endpoint}",
        headers=admin_auth_headers
    )

    actual_status = response.status_code

    # Assertion
    assert actual_status != 500, (
        f"\nTest Case       : History Server Error Check"
        f"\nInput           : GET {endpoint}"
        f"\nUnexpected Output : HTTP Status 500"
        f"\nResponse          : {response.text}"
    )

    assert actual_status == 200, (
        f"\nTest Case       : Get Complaint History"
        f"\nExpected Output : HTTP Status 200"
        f"\nActual Output   : HTTP Status {actual_status}"
        f"\nResponse        : {response.text}"
    )