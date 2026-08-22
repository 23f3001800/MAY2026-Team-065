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
    expected_status = [401, 403, 404]

    # Actual Output
    response = requests.get(
        f"{BASE_URL}{endpoint}"
    )

    actual_status = response.status_code

    # Assertion
    assert actual_status in expected_status, (
        f"\nTest Case       : Complaint Media Authentication"
        f"\nInput           : GET {endpoint}"
        f"\nExpected Output : HTTP Status {expected_status}"
        f"\nActual Output   : HTTP Status {actual_status}"
        f"\nResponse        : {response.text}"
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


def test_get_complaint_media_invalid_token():
    """
    Verify that an invalid JWT cannot be used to retrieve
    complaint media.
    """

    # Input
    complaint_id = "CMP-65C600"
    endpoint = f"/complaints/{complaint_id}/media"

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
        f"\nTest Case       : Complaint Media Invalid Token"
        f"\nInput           : GET {endpoint}"
        f"\nExpected Output : HTTP Status {expected_status}"
        f"\nActual Output   : HTTP Status {actual_status}"
        f"\nResponse        : {response.text}"
    )


def test_get_complaint_media_malformed_authorization():
    """
    Verify that a malformed Authorization header is rejected.
    """

    # Input
    complaint_id = "CMP-65C600"
    endpoint = f"/complaints/{complaint_id}/media"

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
        f"\nTest Case       : Complaint Media Malformed Authorization"
        f"\nInput           : GET {endpoint}"
        f"\nExpected Output : HTTP Status {expected_status}"
        f"\nActual Output   : HTTP Status {actual_status}"
        f"\nResponse        : {response.text}"
    )


def test_get_nonexistent_complaint_media(auth_headers):
    """
    Verify that media cannot be retrieved for a complaint
    that does not exist.
    """

    # Input
    complaint_id = "CMP-DOES-NOT-EXIST"
    endpoint = f"/complaints/{complaint_id}/media"

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
        f"\nTest Case       : Nonexistent Complaint Media"
        f"\nInput           : GET {endpoint}"
        f"\nExpected Output : HTTP Status {expected_status}"
        f"\nActual Output   : HTTP Status {actual_status}"
        f"\nResponse        : {response.text}"
    )


def test_get_complaint_media_malformed_id(auth_headers):
    """
    Verify that a malformed complaint ID does not cause
    an unexpected server error.
    """

    # Input
    complaint_id = "INVALID"
    endpoint = f"/complaints/{complaint_id}/media"

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
        f"\nTest Case       : Complaint Media Malformed ID"
        f"\nInput           : GET {endpoint}"
        f"\nExpected Output : HTTP Status {expected_status}"
        f"\nActual Output   : HTTP Status {actual_status}"
        f"\nResponse        : {response.text}"
    )

    assert actual_status != 500, (
        f"\nUnexpected server error."
        f"\nResponse : {response.text}"
    )


def test_get_complaint_media_response_content_type(
    admin_auth_headers
):
    """
    Verify that successful media retrieval returns JSON.
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
        f"\nTest Case       : Media Response Content Type"
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


def test_complaint_media_item_structure(admin_auth_headers):
    """
    Verify that each returned media record is a JSON object
    and contains the expected basic media information when
    records are available.
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
        f"\nTest Case       : Media Item Structure"
        f"\nInput           : GET {endpoint}"
        f"\nExpected Output : HTTP Status {expected_status}"
        f"\nActual Output   : HTTP Status {actual_status}"
        f"\nResponse        : {response.text}"
    )

    data = response.json()

    assert isinstance(data, list)

    for media in data:
        assert isinstance(media, dict), (
            f"\nExpected Media Item : JSON object"
            f"\nActual Media Item   : {media}"
        )

        # The exact media fields are validated only when present.
        # This avoids assuming a schema that the current API
        # response may not expose.
        if "mediaId" in media:
            assert isinstance(media["mediaId"], str)

        if "complaintId" in media:
            assert media["complaintId"] == complaint_id


def test_complaint_media_consistency(admin_auth_headers):
    """
    Verify that returned media records, when containing a
    complaintId field, belong to the requested complaint.
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
        f"\nTest Case       : Media Complaint Consistency"
        f"\nInput           : GET {endpoint}"
        f"\nExpected Output : HTTP Status {expected_status}"
        f"\nActual Output   : HTTP Status {actual_status}"
        f"\nResponse        : {response.text}"
    )

    data = response.json()

    assert isinstance(data, list)

    for media in data:
        if "complaintId" in media:
            assert media["complaintId"] == complaint_id, (
                f"\nExpected Complaint ID : {complaint_id}"
                f"\nActual Complaint ID   : {media.get('complaintId')}"
            )


def test_get_complaint_media_repeated_request(
    admin_auth_headers
):
    """
    Verify that repeated media requests remain successful
    and return consistent data.
    """

    # Input
    complaint_id = "CMP-65C600"
    endpoint = f"/complaints/{complaint_id}/media"

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
        f"\nTest Case       : First Media Request"
        f"\nExpected Output : HTTP Status {expected_status}"
        f"\nActual Output   : HTTP Status "
        f"{first_response.status_code}"
        f"\nResponse        : {first_response.text}"
    )

    assert second_response.status_code == expected_status, (
        f"\nTest Case       : Repeated Media Request"
        f"\nExpected Output : HTTP Status {expected_status}"
        f"\nActual Output   : HTTP Status "
        f"{second_response.status_code}"
        f"\nResponse        : {second_response.text}"
    )

    first_data = first_response.json()
    second_data = second_response.json()

    assert first_data == second_data, (
        f"\nExpected Output : Consistent media response"
        f"\nFirst Response  : {first_data}"
        f"\nSecond Response : {second_data}"
    )


def test_get_complaint_media_no_server_error(
    admin_auth_headers
):
    """
    Verify that the complaint media endpoint does not
    return an unexpected internal server error.
    """

    # Input
    complaint_id = "CMP-65C600"
    endpoint = f"/complaints/{complaint_id}/media"

    # Actual Output
    response = requests.get(
        f"{BASE_URL}{endpoint}",
        headers=admin_auth_headers
    )

    actual_status = response.status_code

    # Assertion
    assert actual_status != 500, (
        f"\nTest Case       : Media Server Error Check"
        f"\nInput           : GET {endpoint}"
        f"\nUnexpected Output : HTTP Status 500"
        f"\nResponse          : {response.text}"
    )

    assert actual_status == 200, (
        f"\nTest Case       : Get Complaint Media"
        f"\nExpected Output : HTTP Status 200"
        f"\nActual Output   : HTTP Status {actual_status}"
        f"\nResponse        : {response.text}"
    )