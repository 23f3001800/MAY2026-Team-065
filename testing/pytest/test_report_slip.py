import requests


BASE_URL = "http://127.0.0.1:8000"


def test_get_report_slip_requires_auth():
    """
    Verify that the Complaint Report Slip endpoint is protected
    and requires authentication.
    """

    # Input
    complaint_id = "CMP-TEST001"
    endpoint = f"/complaints/{complaint_id}/report-slip"

    # Expected Output
    expected_status = [401, 403, 404]

    # Actual Output
    response = requests.get(
        f"{BASE_URL}{endpoint}"
    )

    actual_status = response.status_code

    # Assertion
    assert actual_status in expected_status, (
        f"\nTest Case       : Complaint Report Slip Authentication"
        f"\nInput           : GET {endpoint}"
        f"\nExpected Output : HTTP Status {expected_status}"
        f"\nActual Output   : HTTP Status {actual_status}"
        f"\nResponse        : {response.text}"
    )


def test_get_report_slip(admin_auth_headers):
    """
    Verify that an authenticated administrator can retrieve
    the report slip for an existing complaint.
    """

    # Input
    complaint_id = "CMP-65C600"
    endpoint = f"/complaints/{complaint_id}/report-slip"

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
        f"\nTest Case       : Get Complaint Report Slip"
        f"\nInput           : GET {endpoint}"
        f"\nExpected Output : HTTP Status {expected_status}"
        f"\nActual Output   : HTTP Status {actual_status}"
        f"\nResponse        : {response.text[:500]}"
    )

    # Basic response validation
    assert response.content, (
        "\nExpected Output : Non-empty report slip response"
        f"\nActual Output   : {response.text[:500]}"
    )


def test_report_slip_invalid_token():
    """
    Verify that an invalid JWT cannot be used to retrieve
    a complaint report slip.
    """

    # Input
    complaint_id = "CMP-65C600"
    endpoint = f"/complaints/{complaint_id}/report-slip"

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
        f"\nTest Case       : Report Slip Invalid Token"
        f"\nInput           : GET {endpoint}"
        f"\nExpected Output : HTTP Status {expected_status}"
        f"\nActual Output   : HTTP Status {actual_status}"
        f"\nResponse        : {response.text[:500]}"
    )


def test_report_slip_malformed_authorization():
    """
    Verify that a malformed Authorization header is rejected.
    """

    # Input
    complaint_id = "CMP-65C600"
    endpoint = f"/complaints/{complaint_id}/report-slip"

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
        f"\nTest Case       : Report Slip Malformed Authorization"
        f"\nInput           : GET {endpoint}"
        f"\nExpected Output : HTTP Status {expected_status}"
        f"\nActual Output   : HTTP Status {actual_status}"
        f"\nResponse        : {response.text[:500]}"
    )


def test_report_slip_nonexistent_complaint(auth_headers):
    """
    Verify that a report slip cannot be generated for a
    nonexistent complaint.
    """

    # Input
    complaint_id = "CMP-DOES-NOT-EXIST"
    endpoint = f"/complaints/{complaint_id}/report-slip"

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
        f"\nTest Case       : Report Slip Nonexistent Complaint"
        f"\nInput           : GET {endpoint}"
        f"\nExpected Output : HTTP Status {expected_status}"
        f"\nActual Output   : HTTP Status {actual_status}"
        f"\nResponse        : {response.text[:500]}"
    )


def test_report_slip_malformed_complaint_id(auth_headers):
    """
    Verify that a malformed complaint ID does not produce
    an unexpected internal server error.
    """

    # Input
    complaint_id = "INVALID"
    endpoint = f"/complaints/{complaint_id}/report-slip"

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
        f"\nTest Case       : Report Slip Malformed ID"
        f"\nInput           : GET {endpoint}"
        f"\nExpected Output : HTTP Status {expected_status}"
        f"\nActual Output   : HTTP Status {actual_status}"
        f"\nResponse        : {response.text[:500]}"
    )

    assert actual_status != 500, (
        f"\nUnexpected server error."
        f"\nResponse : {response.text[:500]}"
    )


def test_report_slip_content_type(admin_auth_headers):
    """
    Verify that the successful report slip response has a
    meaningful content type.
    """

    # Input
    complaint_id = "CMP-65C600"
    endpoint = f"/complaints/{complaint_id}/report-slip"

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
        f"\nTest Case       : Report Slip Content Type"
        f"\nInput           : GET {endpoint}"
        f"\nExpected Output : HTTP Status {expected_status}"
        f"\nActual Output   : HTTP Status {actual_status}"
        f"\nResponse        : {response.text[:500]}"
    )

    content_type = response.headers.get("content-type", "")

    assert content_type, (
        "\nExpected Output : Content-Type header"
        "\nActual Output   : Missing Content-Type header"
    )

    assert (
        "application/pdf" in content_type
        or "application/octet-stream" in content_type
        or "application/json" in content_type
    ), (
        f"\nUnexpected Content-Type : {content_type}"
    )


def test_report_slip_non_empty_response(admin_auth_headers):
    """
    Verify that the generated report slip contains actual
    response content.
    """

    # Input
    complaint_id = "CMP-65C600"
    endpoint = f"/complaints/{complaint_id}/report-slip"

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
        f"\nTest Case       : Report Slip Non-Empty Response"
        f"\nInput           : GET {endpoint}"
        f"\nExpected Output : HTTP Status {expected_status}"
        f"\nActual Output   : HTTP Status {actual_status}"
        f"\nResponse        : {response.text[:500]}"
    )

    assert len(response.content) > 0

    content_type = response.headers.get("content-type", "")

    if "application/pdf" in content_type:
        assert response.content.startswith(b"%PDF"), (
            "\nExpected Output : Valid PDF response"
            "\nActual Output   : PDF signature not found"
        )


def test_report_slip_repeated_request(admin_auth_headers):
    """
    Verify that repeated report-slip requests remain successful
    and return valid non-empty documents.
    """

    # Input
    complaint_id = "CMP-65C600"
    endpoint = f"/complaints/{complaint_id}/report-slip"

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
        f"\nTest Case       : First Report Slip Request"
        f"\nExpected Output : HTTP Status {expected_status}"
        f"\nActual Output   : HTTP Status "
        f"{first_response.status_code}"
        f"\nResponse        : {first_response.text[:500]}"
    )

    assert second_response.status_code == expected_status, (
        f"\nTest Case       : Repeated Report Slip Request"
        f"\nExpected Output : HTTP Status {expected_status}"
        f"\nActual Output   : HTTP Status "
        f"{second_response.status_code}"
        f"\nResponse        : {second_response.text[:500]}"
    )

    assert first_response.content
    assert second_response.content


def test_report_slip_no_server_error(admin_auth_headers):
    """
    Verify that the report-slip endpoint does not return
    an unexpected internal server error.
    """

    # Input
    complaint_id = "CMP-65C600"
    endpoint = f"/complaints/{complaint_id}/report-slip"

    # Actual Output
    response = requests.get(
        f"{BASE_URL}{endpoint}",
        headers=admin_auth_headers
    )

    actual_status = response.status_code

    # Assertion
    assert actual_status != 500, (
        f"\nTest Case       : Report Slip Server Error Check"
        f"\nInput           : GET {endpoint}"
        f"\nUnexpected Output : HTTP Status 500"
        f"\nResponse          : {response.text[:500]}"
    )

    assert actual_status == 200, (
        f"\nTest Case       : Get Complaint Report Slip"
        f"\nExpected Output : HTTP Status 200"
        f"\nActual Output   : HTTP Status {actual_status}"
        f"\nResponse        : {response.text[:500]}"
    )