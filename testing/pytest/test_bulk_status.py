import requests

BASE_URL = "http://127.0.0.1:8000"


def create_test_complaint(auth_headers, description):
    """
    Create a fresh complaint so the bulk-status tests always know
    the complaint's initial state.

    Newly created complaints are expected to start in PENDING state.
    """

    endpoint = "/complaints/"

    payload = {
        "description": description,
        "categoryId": "CAT-ROA-01",
        "location": {
            "latitude": 22.8046,
            "longitude": 86.2029,
            "address": "Sakchi, Jamshedpur"
        }
    }

    response = requests.post(
        f"{BASE_URL}{endpoint}",
        json=payload,
        headers=auth_headers
    )

    assert response.status_code == 201, (
        f"\nTest Case       : Prepare Bulk Status Complaint"
        f"\nInput           : POST {endpoint}"
        f"\nExpected Output : HTTP Status 201"
        f"\nActual Output   : HTTP Status {response.status_code}"
        f"\nResponse        : {response.text}"
    )

    data = response.json()

    assert "complaintId" in data
    assert data["status"] == "PENDING"

    return data["complaintId"]


def test_bulk_status_requires_auth():
    """
    Verify that the Bulk Status endpoint requires authentication.
    """

    # Input
    endpoint = "/complaints/bulk-status"

    payload = {
        "complaintIds": ["CMP-TEST001"],
        "fromStatus": "PENDING",
        "toStatus": "IN_PROGRESS",
        "remarks": "Authentication validation"
    }

    # Expected Output
    expected_status = 401

    # Actual Output
    response = requests.patch(
        f"{BASE_URL}{endpoint}",
        json=payload
    )

    actual_status = response.status_code

    # Assertion
    assert actual_status == expected_status, (
        f"\nTest Case       : Bulk Status - Authentication"
        f"\nInput           : PATCH {endpoint}"
        f"\nExpected Output : HTTP Status {expected_status}"
        f"\nActual Output   : HTTP Status {actual_status}"
        f"\nResponse        : {response.text}"
    )


def test_bulk_status_invalid_token():
    """
    Verify that an invalid JWT token is rejected.
    """

    # Input
    endpoint = "/complaints/bulk-status"

    payload = {
        "complaintIds": ["CMP-TEST001"],
        "fromStatus": "PENDING",
        "toStatus": "IN_PROGRESS",
        "remarks": "Invalid token validation"
    }

    headers = {
        "Authorization": "Bearer invalid-token"
    }

    # Expected Output
    expected_status = 401

    # Actual Output
    response = requests.patch(
        f"{BASE_URL}{endpoint}",
        json=payload,
        headers=headers
    )

    actual_status = response.status_code

    # Assertion
    assert actual_status == expected_status, (
        f"\nTest Case       : Bulk Status - Invalid Token"
        f"\nInput           : PATCH {endpoint}"
        f"\nExpected Output : HTTP Status {expected_status}"
        f"\nActual Output   : HTTP Status {actual_status}"
        f"\nResponse        : {response.text}"
    )


def test_bulk_status_citizen_denied(auth_headers):
    """
    Verify that a normal citizen cannot perform bulk status updates.
    """

    # Input
    endpoint = "/complaints/bulk-status"

    payload = {
        "complaintIds": ["CMP-TEST001"],
        "fromStatus": "PENDING",
        "toStatus": "IN_PROGRESS",
        "remarks": "Citizen authorization validation"
    }

    # Expected Output
    expected_status = 403

    # Actual Output
    response = requests.patch(
        f"{BASE_URL}{endpoint}",
        json=payload,
        headers=auth_headers
    )

    actual_status = response.status_code

    # Assertion
    assert actual_status == expected_status, (
        f"\nTest Case       : Bulk Status - Citizen Authorization"
        f"\nInput           : PATCH {endpoint}"
        f"\nExpected Output : HTTP Status {expected_status}"
        f"\nActual Output   : HTTP Status {actual_status}"
        f"\nResponse        : {response.text}"
    )


def test_bulk_status_valid_single_complaint(
    auth_headers,
    admin_auth_headers
):
    """
    Verify that an administrator can advance one complaint
    from PENDING to IN_PROGRESS.
    """

    complaint_id = create_test_complaint(
        auth_headers,
        "Bulk status single complaint validation"
    )

    # Input
    endpoint = "/complaints/bulk-status"

    payload = {
        "complaintIds": [complaint_id],
        "fromStatus": "PENDING",
        "toStatus": "IN_PROGRESS",
        "remarks": "Bulk status single complaint test"
    }

    # Expected Output
    expected_status = 200

    # Actual Output
    response = requests.patch(
        f"{BASE_URL}{endpoint}",
        json=payload,
        headers=admin_auth_headers
    )

    actual_status = response.status_code

    # Assertion
    assert actual_status == expected_status, (
        f"\nTest Case       : Bulk Status - Single Complaint"
        f"\nInput           : PATCH {endpoint}"
        f"\nExpected Output : HTTP Status {expected_status}"
        f"\nActual Output   : HTTP Status {actual_status}"
        f"\nResponse        : {response.text}"
    )

    data = response.json()

    assert isinstance(data, dict)
    assert "updated" in data
    assert "failed" in data
    assert "updatedCount" in data
    assert "failedCount" in data

    assert complaint_id in data["updated"]
    assert data["updatedCount"] == 1
    assert data["failedCount"] == 0


def test_bulk_status_valid_multiple_complaints(
    auth_headers,
    admin_auth_headers
):
    """
    Verify that multiple PENDING complaints can be advanced
    together from PENDING to IN_PROGRESS.
    """

    complaint_id_1 = create_test_complaint(
        auth_headers,
        "Bulk status multiple complaint test one"
    )

    complaint_id_2 = create_test_complaint(
        auth_headers,
        "Bulk status multiple complaint test two"
    )

    # Input
    endpoint = "/complaints/bulk-status"

    payload = {
        "complaintIds": [
            complaint_id_1,
            complaint_id_2
        ],
        "fromStatus": "PENDING",
        "toStatus": "IN_PROGRESS",
        "remarks": "Bulk status multiple complaint test"
    }

    # Expected Output
    expected_status = 200

    # Actual Output
    response = requests.patch(
        f"{BASE_URL}{endpoint}",
        json=payload,
        headers=admin_auth_headers
    )

    actual_status = response.status_code

    # Assertion
    assert actual_status == expected_status, (
        f"\nTest Case       : Bulk Status - Multiple Complaints"
        f"\nInput           : PATCH {endpoint}"
        f"\nExpected Output : HTTP Status {expected_status}"
        f"\nActual Output   : HTTP Status {actual_status}"
        f"\nResponse        : {response.text}"
    )

    data = response.json()

    assert isinstance(data, dict)
    assert "updated" in data
    assert "failed" in data
    assert "updatedCount" in data
    assert "failedCount" in data

    assert complaint_id_1 in data["updated"]
    assert complaint_id_2 in data["updated"]
    assert data["updatedCount"] == 2
    assert data["failedCount"] == 0


def test_bulk_status_missing_complaint_ids(admin_auth_headers):
    """
    Verify that complaintIds is mandatory.
    """

    # Input
    endpoint = "/complaints/bulk-status"

    payload = {
        "fromStatus": "PENDING",
        "toStatus": "IN_PROGRESS",
        "remarks": "Missing complaint IDs"
    }

    # Expected Output
    expected_status = 422

    # Actual Output
    response = requests.patch(
        f"{BASE_URL}{endpoint}",
        json=payload,
        headers=admin_auth_headers
    )

    actual_status = response.status_code

    assert actual_status == expected_status, (
        f"\nTest Case       : Bulk Status - Missing Complaint IDs"
        f"\nInput           : PATCH {endpoint}"
        f"\nExpected Output : HTTP Status {expected_status}"
        f"\nActual Output   : HTTP Status {actual_status}"
        f"\nResponse        : {response.text}"
    )


def test_bulk_status_missing_from_status(
    auth_headers,
    admin_auth_headers
):
    """
    Verify that fromStatus is mandatory.
    """

    complaint_id = create_test_complaint(
        auth_headers,
        "Bulk status missing fromStatus"
    )

    # Input
    endpoint = "/complaints/bulk-status"

    payload = {
        "complaintIds": [complaint_id],
        "toStatus": "IN_PROGRESS",
        "remarks": "Missing from status"
    }

    # Expected Output
    expected_status = 422

    # Actual Output
    response = requests.patch(
        f"{BASE_URL}{endpoint}",
        json=payload,
        headers=admin_auth_headers
    )

    actual_status = response.status_code

    assert actual_status == expected_status, (
        f"\nTest Case       : Bulk Status - Missing From Status"
        f"\nInput           : PATCH {endpoint}"
        f"\nExpected Output : HTTP Status {expected_status}"
        f"\nActual Output   : HTTP Status {actual_status}"
        f"\nResponse        : {response.text}"
    )


def test_bulk_status_missing_to_status(
    auth_headers,
    admin_auth_headers
):
    """
    Verify that toStatus is mandatory.
    """

    complaint_id = create_test_complaint(
        auth_headers,
        "Bulk status missing toStatus"
    )

    # Input
    endpoint = "/complaints/bulk-status"

    payload = {
        "complaintIds": [complaint_id],
        "fromStatus": "PENDING",
        "remarks": "Missing to status"
    }

    # Expected Output
    expected_status = 422

    # Actual Output
    response = requests.patch(
        f"{BASE_URL}{endpoint}",
        json=payload,
        headers=admin_auth_headers
    )

    actual_status = response.status_code

    assert actual_status == expected_status, (
        f"\nTest Case       : Bulk Status - Missing To Status"
        f"\nInput           : PATCH {endpoint}"
        f"\nExpected Output : HTTP Status {expected_status}"
        f"\nActual Output   : HTTP Status {actual_status}"
        f"\nResponse        : {response.text}"
    )


def test_bulk_status_empty_complaint_ids(admin_auth_headers):
    """
    Verify that an empty complaint ID list is handled as invalid input.
    """

    # Input
    endpoint = "/complaints/bulk-status"

    payload = {
        "complaintIds": [],
        "fromStatus": "PENDING",
        "toStatus": "IN_PROGRESS",
        "remarks": "Empty complaint list"
    }

    # Expected Output
    expected_statuses = [400, 422]

    # Actual Output
    response = requests.patch(
        f"{BASE_URL}{endpoint}",
        json=payload,
        headers=admin_auth_headers
    )

    actual_status = response.status_code

    assert actual_status in expected_statuses, (
        f"\nTest Case       : Bulk Status - Empty Complaint IDs"
        f"\nInput           : PATCH {endpoint}"
        f"\nExpected Output : HTTP Status {expected_statuses}"
        f"\nActual Output   : HTTP Status {actual_status}"
        f"\nResponse        : {response.text}"
    )


def test_bulk_status_null_complaint_ids(admin_auth_headers):
    """
    Verify that null complaintIds are rejected.
    """

    # Input
    endpoint = "/complaints/bulk-status"

    payload = {
        "complaintIds": None,
        "fromStatus": "PENDING",
        "toStatus": "IN_PROGRESS",
        "remarks": "Null complaint IDs"
    }

    # Expected Output
    expected_status = 422

    # Actual Output
    response = requests.patch(
        f"{BASE_URL}{endpoint}",
        json=payload,
        headers=admin_auth_headers
    )

    actual_status = response.status_code

    assert actual_status == expected_status, (
        f"\nTest Case       : Bulk Status - Null Complaint IDs"
        f"\nInput           : PATCH {endpoint}"
        f"\nExpected Output : HTTP Status {expected_status}"
        f"\nActual Output   : HTTP Status {actual_status}"
        f"\nResponse        : {response.text}"
    )


def test_bulk_status_invalid_complaint_ids_type(admin_auth_headers):
    """
    Verify that complaintIds must be a list.
    """

    # Input
    endpoint = "/complaints/bulk-status"

    payload = {
        "complaintIds": "CMP-TEST001",
        "fromStatus": "PENDING",
        "toStatus": "IN_PROGRESS",
        "remarks": "Invalid complaint IDs type"
    }

    # Expected Output
    expected_status = 422

    # Actual Output
    response = requests.patch(
        f"{BASE_URL}{endpoint}",
        json=payload,
        headers=admin_auth_headers
    )

    actual_status = response.status_code

    assert actual_status == expected_status, (
        f"\nTest Case       : Bulk Status - Invalid Complaint IDs Type"
        f"\nInput           : PATCH {endpoint}"
        f"\nExpected Output : HTTP Status {expected_status}"
        f"\nActual Output   : HTTP Status {actual_status}"
        f"\nResponse        : {response.text}"
    )


def test_bulk_status_invalid_from_status(
    auth_headers,
    admin_auth_headers
):
    """
    Verify that an invalid fromStatus is rejected.
    """

    complaint_id = create_test_complaint(
        auth_headers,
        "Bulk status invalid fromStatus"
    )

    # Input
    endpoint = "/complaints/bulk-status"

    payload = {
        "complaintIds": [complaint_id],
        "fromStatus": "INVALID_STATUS",
        "toStatus": "IN_PROGRESS",
        "remarks": "Invalid from status"
    }

    # Expected Output
    expected_statuses = [400, 422]

    # Actual Output
    response = requests.patch(
        f"{BASE_URL}{endpoint}",
        json=payload,
        headers=admin_auth_headers
    )

    actual_status = response.status_code

    assert actual_status in expected_statuses, (
        f"\nTest Case       : Bulk Status - Invalid From Status"
        f"\nInput           : PATCH {endpoint}"
        f"\nExpected Output : HTTP Status {expected_statuses}"
        f"\nActual Output   : HTTP Status {actual_status}"
        f"\nResponse        : {response.text}"
    )


def test_bulk_status_invalid_to_status(
    auth_headers,
    admin_auth_headers
):
    """
    Verify that an invalid toStatus is rejected.
    """

    complaint_id = create_test_complaint(
        auth_headers,
        "Bulk status invalid toStatus"
    )

    # Input
    endpoint = "/complaints/bulk-status"

    payload = {
        "complaintIds": [complaint_id],
        "fromStatus": "PENDING",
        "toStatus": "INVALID_STATUS",
        "remarks": "Invalid to status"
    }

    # Expected Output
    expected_statuses = [400, 422]

    # Actual Output
    response = requests.patch(
        f"{BASE_URL}{endpoint}",
        json=payload,
        headers=admin_auth_headers
    )

    actual_status = response.status_code

    assert actual_status in expected_statuses, (
        f"\nTest Case       : Bulk Status - Invalid To Status"
        f"\nInput           : PATCH {endpoint}"
        f"\nExpected Output : HTTP Status {expected_statuses}"
        f"\nActual Output   : HTTP Status {actual_status}"
        f"\nResponse        : {response.text}"
    )


def test_bulk_status_same_status_rejected(
    auth_headers,
    admin_auth_headers
):
    """
    Verify that attempting to move a complaint to the same status
    is handled according to the lifecycle rules.
    """

    complaint_id = create_test_complaint(
        auth_headers,
        "Bulk status same status validation"
    )

    # Input
    endpoint = "/complaints/bulk-status"

    payload = {
        "complaintIds": [complaint_id],
        "fromStatus": "PENDING",
        "toStatus": "PENDING",
        "remarks": "Same status validation"
    }

    # Expected Output
    expected_statuses = [200, 400, 422]

    # Actual Output
    response = requests.patch(
        f"{BASE_URL}{endpoint}",
        json=payload,
        headers=admin_auth_headers
    )

    actual_status = response.status_code

    assert actual_status in expected_statuses, (
        f"\nTest Case       : Bulk Status - Same Status"
        f"\nInput           : PATCH {endpoint}"
        f"\nExpected Output : HTTP Status {expected_statuses}"
        f"\nActual Output   : HTTP Status {actual_status}"
        f"\nResponse        : {response.text}"
    )

    if actual_status == 200:
        data = response.json()
        assert isinstance(data, dict)
        assert "updated" in data
        assert "failed" in data


def test_bulk_status_wrong_from_status(
    auth_headers,
    admin_auth_headers
):
    """
    Verify that a stale/wrong fromStatus does not update the complaint.

    The endpoint reports per-complaint failures using HTTP 200.
    """

    complaint_id = create_test_complaint(
        auth_headers,
        "Bulk status stale state validation"
    )

    # Input
    endpoint = "/complaints/bulk-status"

    payload = {
        "complaintIds": [complaint_id],
        "fromStatus": "IN_PROGRESS",
        "toStatus": "RESOLVED",
        "remarks": "Wrong current state validation"
    }

    # Expected Output
    expected_status = 200

    # Actual Output
    response = requests.patch(
        f"{BASE_URL}{endpoint}",
        json=payload,
        headers=admin_auth_headers
    )

    actual_status = response.status_code

    # Assertion
    assert actual_status == expected_status, (
        f"\nTest Case       : Bulk Status - Wrong From Status"
        f"\nInput           : PATCH {endpoint}"
        f"\nExpected Output : HTTP Status {expected_status}"
        f"\nActual Output   : HTTP Status {actual_status}"
        f"\nResponse        : {response.text}"
    )

    data = response.json()

    assert isinstance(data, dict)
    assert "updated" in data
    assert "failed" in data
    assert "updatedCount" in data
    assert "failedCount" in data

    assert complaint_id not in data["updated"]
    assert data["updatedCount"] == 0
    assert data["failedCount"] == 1

    assert len(data["failed"]) == 1
    assert data["failed"][0]["complaintId"] == complaint_id
    assert "Expected in_progress" in data["failed"][0]["reason"]
    assert "pending" in data["failed"][0]["reason"]


def test_bulk_status_nonexistent_complaint(
    admin_auth_headers
):
    """
    Verify that a nonexistent complaint is reported in failed[].

    Bulk-status uses HTTP 200 and reports individual failures
    inside the response.
    """

    # Input
    endpoint = "/complaints/bulk-status"

    complaint_id = "CMP-NONEXISTENT-999999"

    payload = {
        "complaintIds": [complaint_id],
        "fromStatus": "PENDING",
        "toStatus": "IN_PROGRESS",
        "remarks": "Nonexistent complaint validation"
    }

    # Expected Output
    expected_status = 200

    # Actual Output
    response = requests.patch(
        f"{BASE_URL}{endpoint}",
        json=payload,
        headers=admin_auth_headers
    )

    actual_status = response.status_code

    assert actual_status == expected_status, (
        f"\nTest Case       : Bulk Status - Nonexistent Complaint"
        f"\nInput           : PATCH {endpoint}"
        f"\nExpected Output : HTTP Status {expected_status}"
        f"\nActual Output   : HTTP Status {actual_status}"
        f"\nResponse        : {response.text}"
    )

    data = response.json()

    assert isinstance(data, dict)
    assert "updated" in data
    assert "failed" in data
    assert "updatedCount" in data
    assert "failedCount" in data

    assert data["updatedCount"] == 0
    assert data["failedCount"] == 1
    assert complaint_id not in data["updated"]

    assert len(data["failed"]) == 1
    assert data["failed"][0]["complaintId"] == complaint_id
    assert data["failed"][0]["reason"] == "Complaint not found."


def test_bulk_status_missing_remarks(
    auth_headers,
    admin_auth_headers
):
    """
    Verify the behavior when remarks is omitted.
    """

    complaint_id = create_test_complaint(
        auth_headers,
        "Bulk status missing remarks validation"
    )

    # Input
    endpoint = "/complaints/bulk-status"

    payload = {
        "complaintIds": [complaint_id],
        "fromStatus": "PENDING",
        "toStatus": "IN_PROGRESS"
    }

    # Expected Output
    expected_statuses = [200, 400, 422]

    # Actual Output
    response = requests.patch(
        f"{BASE_URL}{endpoint}",
        json=payload,
        headers=admin_auth_headers
    )

    actual_status = response.status_code

    assert actual_status in expected_statuses, (
        f"\nTest Case       : Bulk Status - Missing Remarks"
        f"\nInput           : PATCH {endpoint}"
        f"\nExpected Output : HTTP Status {expected_statuses}"
        f"\nActual Output   : HTTP Status {actual_status}"
        f"\nResponse        : {response.text}"
    )


def test_bulk_status_null_remarks(
    auth_headers,
    admin_auth_headers
):
    """
    Verify the behavior when remarks is explicitly null.
    """

    complaint_id = create_test_complaint(
        auth_headers,
        "Bulk status null remarks validation"
    )

    # Input
    endpoint = "/complaints/bulk-status"

    payload = {
        "complaintIds": [complaint_id],
        "fromStatus": "PENDING",
        "toStatus": "IN_PROGRESS",
        "remarks": None
    }

    # Expected Output
    expected_statuses = [200, 400, 422]

    # Actual Output
    response = requests.patch(
        f"{BASE_URL}{endpoint}",
        json=payload,
        headers=admin_auth_headers
    )

    actual_status = response.status_code

    assert actual_status in expected_statuses, (
        f"\nTest Case       : Bulk Status - Null Remarks"
        f"\nInput           : PATCH {endpoint}"
        f"\nExpected Output : HTTP Status {expected_statuses}"
        f"\nActual Output   : HTTP Status {actual_status}"
        f"\nResponse        : {response.text}"
    )


def test_bulk_status_mixed_valid_invalid_complaints(
    auth_headers,
    admin_auth_headers
):
    """
    Verify that a bulk request can report both successful and
    failed complaint operations in the same response.
    """

    valid_complaint_id = create_test_complaint(
        auth_headers,
        "Bulk status mixed IDs validation"
    )

    invalid_complaint_id = "CMP-NONEXISTENT-MIXED"

    # Input
    endpoint = "/complaints/bulk-status"

    payload = {
        "complaintIds": [
            valid_complaint_id,
            invalid_complaint_id
        ],
        "fromStatus": "PENDING",
        "toStatus": "IN_PROGRESS",
        "remarks": "Mixed valid and invalid complaint IDs"
    }

    # Expected Output
    expected_status = 200

    # Actual Output
    response = requests.patch(
        f"{BASE_URL}{endpoint}",
        json=payload,
        headers=admin_auth_headers
    )

    actual_status = response.status_code

    assert actual_status == expected_status, (
        f"\nTest Case       : Bulk Status - Mixed Valid/Invalid IDs"
        f"\nInput           : PATCH {endpoint}"
        f"\nExpected Output : HTTP Status {expected_status}"
        f"\nActual Output   : HTTP Status {actual_status}"
        f"\nResponse        : {response.text}"
    )

    data = response.json()

    assert isinstance(data, dict)
    assert "updated" in data
    assert "failed" in data
    assert "updatedCount" in data
    assert "failedCount" in data

    # Valid complaint must be updated.
    assert valid_complaint_id in data["updated"]

    # Invalid complaint must be reported as failed.
    assert invalid_complaint_id not in data["updated"]

    assert data["updatedCount"] == 1
    assert data["failedCount"] == 1

    assert len(data["failed"]) == 1
    assert data["failed"][0]["complaintId"] == invalid_complaint_id
    assert data["failed"][0]["reason"] == "Complaint not found."


def test_bulk_status_duplicate_complaint_ids(
    auth_headers,
    admin_auth_headers
):
    """
    Verify that duplicate complaint IDs in the same bulk request
    are handled safely.
    """

    complaint_id = create_test_complaint(
        auth_headers,
        "Bulk status duplicate ID validation"
    )

    # Input
    endpoint = "/complaints/bulk-status"

    payload = {
        "complaintIds": [
            complaint_id,
            complaint_id
        ],
        "fromStatus": "PENDING",
        "toStatus": "IN_PROGRESS",
        "remarks": "Duplicate complaint ID validation"
    }

    # Expected Output
    expected_statuses = [200, 400, 409, 422]

    # Actual Output
    response = requests.patch(
        f"{BASE_URL}{endpoint}",
        json=payload,
        headers=admin_auth_headers
    )

    actual_status = response.status_code

    assert actual_status in expected_statuses, (
        f"\nTest Case       : Bulk Status - Duplicate Complaint IDs"
        f"\nInput           : PATCH {endpoint}"
        f"\nExpected Output : HTTP Status {expected_statuses}"
        f"\nActual Output   : HTTP Status {actual_status}"
        f"\nResponse        : {response.text}"
    )


def test_bulk_status_malformed_json(admin_auth_headers):
    """
    Verify that malformed JSON is rejected.
    """

    # Input
    endpoint = "/complaints/bulk-status"

    headers = {
        **admin_auth_headers,
        "Content-Type": "application/json"
    }

    # Expected Output
    expected_status = 422

    # Actual Output
    response = requests.patch(
        f"{BASE_URL}{endpoint}",
        data='{"complaintIds":',
        headers=headers
    )

    actual_status = response.status_code

    assert actual_status == expected_status, (
        f"\nTest Case       : Bulk Status - Malformed JSON"
        f"\nInput           : PATCH {endpoint}"
        f"\nExpected Output : HTTP Status {expected_status}"
        f"\nActual Output   : HTTP Status {actual_status}"
        f"\nResponse        : {response.text}"
    )


def test_bulk_status_response_content_type(
    auth_headers,
    admin_auth_headers
):
    """
    Verify that a successful bulk status response is JSON.
    """

    complaint_id = create_test_complaint(
        auth_headers,
        "Bulk status response content type validation"
    )

    # Input
    endpoint = "/complaints/bulk-status"

    payload = {
        "complaintIds": [complaint_id],
        "fromStatus": "PENDING",
        "toStatus": "IN_PROGRESS",
        "remarks": "Response content type validation"
    }

    # Expected Output
    expected_status = 200

    # Actual Output
    response = requests.patch(
        f"{BASE_URL}{endpoint}",
        json=payload,
        headers=admin_auth_headers
    )

    actual_status = response.status_code

    assert actual_status == expected_status, (
        f"\nTest Case       : Bulk Status - Response Content Type"
        f"\nInput           : PATCH {endpoint}"
        f"\nExpected Output : HTTP Status {expected_status}"
        f"\nActual Output   : HTTP Status {actual_status}"
        f"\nResponse        : {response.text}"
    )

    assert response.headers["content-type"].startswith(
        "application/json"
    )


def test_bulk_status_repeated_request_rejected(
    auth_headers,
    admin_auth_headers
):
    """
    Verify stale-state protection.

    The first request succeeds.

    The second request uses the old fromStatus and therefore
    the complaint must be reported in failed[].

    The endpoint still returns HTTP 200 because bulk-status
    communicates individual failures inside the response body.
    """

    complaint_id = create_test_complaint(
        auth_headers,
        "Bulk status repeated request validation"
    )

    endpoint = "/complaints/bulk-status"

    payload = {
        "complaintIds": [complaint_id],
        "fromStatus": "PENDING",
        "toStatus": "IN_PROGRESS",
        "remarks": "Repeated bulk status request"
    }

    # First request
    first_response = requests.patch(
        f"{BASE_URL}{endpoint}",
        json=payload,
        headers=admin_auth_headers
    )

    assert first_response.status_code == 200, (
        f"\nFirst request failed"
        f"\nExpected Output : HTTP Status 200"
        f"\nActual Output   : HTTP Status {first_response.status_code}"
        f"\nResponse        : {first_response.text}"
    )

    first_data = first_response.json()

    assert complaint_id in first_data["updated"]
    assert first_data["updatedCount"] == 1
    assert first_data["failedCount"] == 0

    # Second request using stale fromStatus
    second_response = requests.patch(
        f"{BASE_URL}{endpoint}",
        json=payload,
        headers=admin_auth_headers
    )

    actual_status = second_response.status_code

    # Expected Output
    expected_status = 200

    # Assertion
    assert actual_status == expected_status, (
        f"\nTest Case       : Bulk Status - Repeated/Stale Request"
        f"\nInput           : PATCH {endpoint}"
        f"\nExpected Output : HTTP Status {expected_status}"
        f"\nActual Output   : HTTP Status {actual_status}"
        f"\nResponse        : {second_response.text}"
    )

    data = second_response.json()

    assert isinstance(data, dict)
    assert "updated" in data
    assert "failed" in data
    assert "updatedCount" in data
    assert "failedCount" in data

    # The second operation must NOT update the complaint.
    assert complaint_id not in data["updated"]

    assert data["updatedCount"] == 0
    assert data["failedCount"] == 1

    assert len(data["failed"]) == 1
    assert data["failed"][0]["complaintId"] == complaint_id
    assert "Expected pending" in data["failed"][0]["reason"]
    assert "in_progress" in data["failed"][0]["reason"]