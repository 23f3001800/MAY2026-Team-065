import requests

BASE_URL = "http://127.0.0.1:8000"


def valid_payload():
    """
    Return a valid complaint payload.
    """
    return {
        "description": "Test complaint for final Pytest validation",
        "categoryId": "CAT-ROA-01",
        "location": {
            "latitude": 22.8046,
            "longitude": 86.2029,
            "address": "Sakchi, Jamshedpur"
        }
    }


def test_create_complaint_valid(auth_headers):
    """
    Verify that an authenticated citizen can successfully
    create a new complaint.
    """

    # Input
    endpoint = "/complaints/"
    payload = valid_payload()

    # Expected Output
    expected_status = 201

    # Actual Output
    response = requests.post(
        f"{BASE_URL}{endpoint}",
        json=payload,
        headers=auth_headers
    )

    actual_status = response.status_code

    # Assertion
    assert actual_status == expected_status, (
        f"\nTest Case       : Create Complaint - Valid Request"
        f"\nInput           : POST {endpoint}"
        f"\nExpected Output : HTTP Status {expected_status}"
        f"\nActual Output   : HTTP Status {actual_status}"
        f"\nResponse        : {response.text}"
    )

    # Response validation
    data = response.json()

    assert "complaintId" in data
    assert "description" in data
    assert "status" in data
    assert "severity" in data
    assert "createdAt" in data
    assert "updatedAt" in data
    assert "location" in data
    assert "category" in data

    assert data["description"] == payload["description"]

    # Newly created complaints should be pending.
    assert data["status"] == "PENDING"

    # Severity may be determined dynamically by the application.
    valid_severities = [
        "LOW",
        "MEDIUM",
        "HIGH",
        "CRITICAL"
    ]

    assert data["severity"] in valid_severities, (
        f"\nExpected Output : Severity must be one of {valid_severities}"
        f"\nActual Output   : {data.get('severity')}"
        f"\nResponse        : {response.text}"
    )

    # Complaint ID validation
    assert isinstance(data["complaintId"], str)
    assert data["complaintId"].startswith("CMP-")

    # Location validation
    assert data["location"]["latitude"] == payload["location"]["latitude"]
    assert data["location"]["longitude"] == payload["location"]["longitude"]
    assert data["location"]["address"] == payload["location"]["address"]

    # Category validation
    assert "categoryId" in data["category"]
    assert data["category"]["categoryId"] == payload["categoryId"]


def test_create_complaint_requires_auth():
    """
    Verify that creating a complaint without authentication
    is rejected.
    """

    # Input
    endpoint = "/complaints/"
    payload = valid_payload()

    # Expected Output
    expected_status = 401

    # Actual Output
    response = requests.post(
        f"{BASE_URL}{endpoint}",
        json=payload
    )

    actual_status = response.status_code

    # Assertion
    assert actual_status == expected_status, (
        f"\nTest Case       : Create Complaint - No Authentication"
        f"\nInput           : POST {endpoint}"
        f"\nExpected Output : HTTP Status {expected_status}"
        f"\nActual Output   : HTTP Status {actual_status}"
        f"\nResponse        : {response.text}"
    )


def test_create_complaint_invalid_token():
    """
    Verify that an invalid authentication token is rejected.
    """

    # Input
    endpoint = "/complaints/"
    payload = valid_payload()

    headers = {
        "Authorization": "Bearer invalid-token"
    }

    # Expected Output
    expected_status = 401

    # Actual Output
    response = requests.post(
        f"{BASE_URL}{endpoint}",
        json=payload,
        headers=headers
    )

    actual_status = response.status_code

    # Assertion
    assert actual_status == expected_status, (
        f"\nTest Case       : Create Complaint - Invalid Token"
        f"\nInput           : POST {endpoint}"
        f"\nExpected Output : HTTP Status {expected_status}"
        f"\nActual Output   : HTTP Status {actual_status}"
        f"\nResponse        : {response.text}"
    )


def test_create_complaint_missing_description(auth_headers):
    """
    Verify that description is mandatory.
    """

    # Input
    endpoint = "/complaints/"
    payload = valid_payload()
    payload.pop("description")

    # Expected Output
    expected_status = 422

    # Actual Output
    response = requests.post(
        f"{BASE_URL}{endpoint}",
        json=payload,
        headers=auth_headers
    )

    actual_status = response.status_code

    # Assertion
    assert actual_status == expected_status, (
        f"\nTest Case       : Create Complaint - Missing Description"
        f"\nInput           : POST {endpoint}"
        f"\nExpected Output : HTTP Status {expected_status}"
        f"\nActual Output   : HTTP Status {actual_status}"
        f"\nResponse        : {response.text}"
    )


def test_create_complaint_missing_category(auth_headers):
    """
    Verify that categoryId is mandatory.
    """

    # Input
    endpoint = "/complaints/"
    payload = valid_payload()
    payload.pop("categoryId")

    # Expected Output
    expected_status = 422

    # Actual Output
    response = requests.post(
        f"{BASE_URL}{endpoint}",
        json=payload,
        headers=auth_headers
    )

    actual_status = response.status_code

    # Assertion
    assert actual_status == expected_status, (
        f"\nTest Case       : Create Complaint - Missing Category"
        f"\nInput           : POST {endpoint}"
        f"\nExpected Output : HTTP Status {expected_status}"
        f"\nActual Output   : HTTP Status {actual_status}"
        f"\nResponse        : {response.text}"
    )


def test_create_complaint_missing_location(auth_headers):
    """
    Verify that location is mandatory.
    """

    # Input
    endpoint = "/complaints/"
    payload = valid_payload()
    payload.pop("location")

    # Expected Output
    expected_status = 422

    # Actual Output
    response = requests.post(
        f"{BASE_URL}{endpoint}",
        json=payload,
        headers=auth_headers
    )

    actual_status = response.status_code

    # Assertion
    assert actual_status == expected_status, (
        f"\nTest Case       : Create Complaint - Missing Location"
        f"\nInput           : POST {endpoint}"
        f"\nExpected Output : HTTP Status {expected_status}"
        f"\nActual Output   : HTTP Status {actual_status}"
        f"\nResponse        : {response.text}"
    )


def test_create_complaint_missing_location_latitude(auth_headers):
    """
    Verify that latitude is mandatory inside location.
    """

    # Input
    endpoint = "/complaints/"
    payload = valid_payload()
    payload["location"].pop("latitude")

    # Expected Output
    expected_status = 422

    # Actual Output
    response = requests.post(
        f"{BASE_URL}{endpoint}",
        json=payload,
        headers=auth_headers
    )

    actual_status = response.status_code

    # Assertion
    assert actual_status == expected_status, (
        f"\nTest Case       : Create Complaint - Missing Latitude"
        f"\nInput           : POST {endpoint}"
        f"\nExpected Output : HTTP Status {expected_status}"
        f"\nActual Output   : HTTP Status {actual_status}"
        f"\nResponse        : {response.text}"
    )


def test_create_complaint_missing_location_longitude(auth_headers):
    """
    Verify that longitude is mandatory inside location.
    """

    # Input
    endpoint = "/complaints/"
    payload = valid_payload()
    payload["location"].pop("longitude")

    # Expected Output
    expected_status = 422

    # Actual Output
    response = requests.post(
        f"{BASE_URL}{endpoint}",
        json=payload,
        headers=auth_headers
    )

    actual_status = response.status_code

    # Assertion
    assert actual_status == expected_status, (
        f"\nTest Case       : Create Complaint - Missing Longitude"
        f"\nInput           : POST {endpoint}"
        f"\nExpected Output : HTTP Status {expected_status}"
        f"\nActual Output   : {actual_status}"
        f"\nResponse        : {response.text}"
    )


def test_create_complaint_missing_location_address(auth_headers):
    """
    Verify that address is mandatory inside location.
    """

    # Input
    endpoint = "/complaints/"
    payload = valid_payload()
    payload["location"].pop("address")

    # Expected Output
    expected_status = 422

    # Actual Output
    response = requests.post(
        f"{BASE_URL}{endpoint}",
        json=payload,
        headers=auth_headers
    )

    actual_status = response.status_code

    # Assertion
    assert actual_status == expected_status, (
        f"\nTest Case       : Create Complaint - Missing Address"
        f"\nInput           : POST {endpoint}"
        f"\nExpected Output : HTTP Status {expected_status}"
        f"\nActual Output   : HTTP Status {actual_status}"
        f"\nResponse        : {response.text}"
    )


def test_create_complaint_empty_description(auth_headers):
    """
    Verify application behavior for an empty description.

    The API schema does not define a minimum description length,
    therefore the test accepts the application's valid contract
    response rather than assuming rejection.
    """

    # Input
    endpoint = "/complaints/"
    payload = valid_payload()
    payload["description"] = ""

    # Expected Output
    expected_statuses = [201, 400, 422]

    # Actual Output
    response = requests.post(
        f"{BASE_URL}{endpoint}",
        json=payload,
        headers=auth_headers
    )

    actual_status = response.status_code

    # Assertion
    assert actual_status in expected_statuses, (
        f"\nTest Case       : Create Complaint - Empty Description"
        f"\nInput           : POST {endpoint}"
        f"\nExpected Output : HTTP Status {expected_statuses}"
        f"\nActual Output   : HTTP Status {actual_status}"
        f"\nResponse        : {response.text}"
    )


def test_create_complaint_null_description(auth_headers):
    """
    Verify that null description is rejected.
    """

    # Input
    endpoint = "/complaints/"
    payload = valid_payload()
    payload["description"] = None

    # Expected Output
    expected_status = 422

    # Actual Output
    response = requests.post(
        f"{BASE_URL}{endpoint}",
        json=payload,
        headers=auth_headers
    )

    actual_status = response.status_code

    # Assertion
    assert actual_status == expected_status, (
        f"\nTest Case       : Create Complaint - Null Description"
        f"\nInput           : POST {endpoint}"
        f"\nExpected Output : HTTP Status {expected_status}"
        f"\nActual Output   : HTTP Status {actual_status}"
        f"\nResponse        : {response.text}"
    )


def test_create_complaint_null_category(auth_headers):
    """
    Verify that null categoryId is rejected.
    """

    # Input
    endpoint = "/complaints/"
    payload = valid_payload()
    payload["categoryId"] = None

    # Expected Output
    expected_status = 422

    # Actual Output
    response = requests.post(
        f"{BASE_URL}{endpoint}",
        json=payload,
        headers=auth_headers
    )

    actual_status = response.status_code

    # Assertion
    assert actual_status == expected_status, (
        f"\nTest Case       : Create Complaint - Null Category"
        f"\nInput           : POST {endpoint}"
        f"\nExpected Output : HTTP Status {expected_status}"
        f"\nActual Output   : HTTP Status {actual_status}"
        f"\nResponse        : {response.text}"
    )


def test_create_complaint_null_location(auth_headers):
    """
    Verify that null location is rejected.
    """

    # Input
    endpoint = "/complaints/"
    payload = valid_payload()
    payload["location"] = None

    # Expected Output
    expected_status = 422

    # Actual Output
    response = requests.post(
        f"{BASE_URL}{endpoint}",
        json=payload,
        headers=auth_headers
    )

    actual_status = response.status_code

    # Assertion
    assert actual_status == expected_status, (
        f"\nTest Case       : Create Complaint - Null Location"
        f"\nInput           : POST {endpoint}"
        f"\nExpected Output : HTTP Status {expected_status}"
        f"\nActual Output   : HTTP Status {actual_status}"
        f"\nResponse        : {response.text}"
    )


def test_create_complaint_invalid_latitude_type(auth_headers):
    """
    Verify that latitude must be numeric.
    """

    # Input
    endpoint = "/complaints/"
    payload = valid_payload()
    payload["location"]["latitude"] = "invalid"

    # Expected Output
    expected_status = 422

    # Actual Output
    response = requests.post(
        f"{BASE_URL}{endpoint}",
        json=payload,
        headers=auth_headers
    )

    actual_status = response.status_code

    # Assertion
    assert actual_status == expected_status, (
        f"\nTest Case       : Create Complaint - Invalid Latitude Type"
        f"\nInput           : POST {endpoint}"
        f"\nExpected Output : HTTP Status {expected_status}"
        f"\nActual Output   : HTTP Status {actual_status}"
        f"\nResponse        : {response.text}"
    )


def test_create_complaint_invalid_longitude_type(auth_headers):
    """
    Verify that longitude must be numeric.
    """

    # Input
    endpoint = "/complaints/"
    payload = valid_payload()
    payload["location"]["longitude"] = "invalid"

    # Expected Output
    expected_status = 422

    # Actual Output
    response = requests.post(
        f"{BASE_URL}{endpoint}",
        json=payload,
        headers=auth_headers
    )

    actual_status = response.status_code

    # Assertion
    assert actual_status == expected_status, (
        f"\nTest Case       : Create Complaint - Invalid Longitude Type"
        f"\nInput           : POST {endpoint}"
        f"\nExpected Output : HTTP Status {expected_status}"
        f"\nActual Output   : HTTP {actual_status}"
        f"\nResponse        : {response.text}"
    )


def test_create_complaint_invalid_category(auth_headers):
    """
    Verify that an unknown category ID is rejected.
    """

    # Input
    endpoint = "/complaints/"
    payload = valid_payload()
    payload["categoryId"] = "CAT-INVALID-999"

    # Expected Output
    expected_statuses = [400, 404, 422]

    # Actual Output
    response = requests.post(
        f"{BASE_URL}{endpoint}",
        json=payload,
        headers=auth_headers
    )

    actual_status = response.status_code

    # Assertion
    assert actual_status in expected_statuses, (
        f"\nTest Case       : Create Complaint - Invalid Category"
        f"\nInput           : POST {endpoint}"
        f"\nExpected Output : HTTP Status {expected_statuses}"
        f"\nActual Output   : HTTP Status {actual_status}"
        f"\nResponse        : {response.text}"
    )


def test_create_complaint_boundary_coordinates(auth_headers):
    """
    Verify that boundary numeric coordinates are handled correctly.

    The current API schema does not define explicit minimum/maximum
    constraints for latitude and longitude.
    """

    # Input
    endpoint = "/complaints/"

    payload = valid_payload()
    payload["description"] = "Boundary coordinate complaint"
    payload["location"]["latitude"] = 90
    payload["location"]["longitude"] = 180

    # Expected Output
    expected_status = 201

    # Actual Output
    response = requests.post(
        f"{BASE_URL}{endpoint}",
        json=payload,
        headers=auth_headers
    )

    actual_status = response.status_code

    # Assertion
    assert actual_status == expected_status, (
        f"\nTest Case       : Create Complaint - Boundary Coordinates"
        f"\nInput           : POST {endpoint}"
        f"\nExpected Output : HTTP Status {expected_status}"
        f"\nActual Output   : HTTP Status {actual_status}"
        f"\nResponse        : {response.text}"
    )

    data = response.json()

    assert "complaintId" in data
    assert data["location"]["latitude"] == 90
    assert data["location"]["longitude"] == 180


def test_create_complaint_non_citizen_denied(admin_auth_headers):
    """
    Verify that an administrator cannot create a complaint.

    Complaint creation is restricted to citizens.
    """

    # Input
    endpoint = "/complaints/"
    payload = valid_payload()

    # Expected Output
    expected_status = 403

    # Actual Output
    response = requests.post(
        f"{BASE_URL}{endpoint}",
        json=payload,
        headers=admin_auth_headers
    )

    actual_status = response.status_code

    # Assertion
    assert actual_status == expected_status, (
        f"\nTest Case       : Create Complaint - Admin Authorization"
        f"\nInput           : POST {endpoint}"
        f"\nExpected Output : HTTP Status {expected_status}"
        f"\nActual Output   : HTTP Status {actual_status}"
        f"\nResponse        : {response.text}"
    )

    assert "Only citizens can file new complaints." in response.text


def test_create_complaint_malformed_body(auth_headers):
    """
    Verify that malformed JSON is rejected.
    """

    # Input
    endpoint = "/complaints/"

    headers = {
        **auth_headers,
        "Content-Type": "application/json"
    }

    # Expected Output
    expected_status = 422

    # Actual Output
    response = requests.post(
        f"{BASE_URL}{endpoint}",
        data='{"description":',
        headers=headers
    )

    actual_status = response.status_code

    # Assertion
    assert actual_status == expected_status, (
        f"\nTest Case       : Create Complaint - Malformed JSON"
        f"\nInput           : POST {endpoint}"
        f"\nExpected Output : HTTP Status {expected_status}"
        f"\nActual Output   : HTTP Status {actual_status}"
        f"\nResponse        : {response.text}"
    )


def test_create_complaint_repeated_valid_requests(auth_headers):
    """
    Verify that two independent valid complaint submissions
    can both be created successfully and receive different IDs.
    """

    # Input
    endpoint = "/complaints/"

    payload1 = valid_payload()
    payload1["description"] = "Repeated request test one"

    payload2 = valid_payload()
    payload2["description"] = "Repeated request test two"

    # Expected Output
    expected_status = 201

    # Actual Output
    response1 = requests.post(
        f"{BASE_URL}{endpoint}",
        json=payload1,
        headers=auth_headers
    )

    response2 = requests.post(
        f"{BASE_URL}{endpoint}",
        json=payload2,
        headers=auth_headers
    )

    actual_status1 = response1.status_code
    actual_status2 = response2.status_code

    # Assertions
    assert actual_status1 == expected_status, (
        f"\nTest Case       : Repeated Valid Request - First"
        f"\nExpected Output : HTTP Status {expected_status}"
        f"\nActual Output   : HTTP Status {actual_status1}"
        f"\nResponse        : {response1.text}"
    )

    assert actual_status2 == expected_status, (
        f"\nTest Case       : Repeated Valid Request - Second"
        f"\nExpected Output : HTTP Status {expected_status}"
        f"\nActual Output   : HTTP Status {actual_status2}"
        f"\nResponse        : {response2.text}"
    )

    data1 = response1.json()
    data2 = response2.json()

    assert data1["complaintId"] != data2["complaintId"]