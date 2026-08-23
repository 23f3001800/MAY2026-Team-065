import requests


BASE_URL = "http://127.0.0.1:8000"


def test_submit_feedback_already_submitted(auth_headers, admin_auth_headers):
    """
    Verify that submitting feedback again for a complaint
    that already has feedback returns a conflict response.
    """

    # Input
    complaint_id = "CMP-65C600"
    feedback_endpoint = f"/complaints/{complaint_id}/feedback"
    status_endpoint = f"/complaints/{complaint_id}/status"

    payload = {
        "rating": 5,
        "comments": "Nice work"
    }

    # ---------------------------------------------------------
    # Step 1: Ensure complaint is in a feedback-eligible state
    # ---------------------------------------------------------

    status_payload = {
        "status": "RESOLVED",
        "remarks": "Resolved for feedback validation"
    }

    status_response = requests.patch(
        f"{BASE_URL}{status_endpoint}",
        json=status_payload,
        headers=admin_auth_headers
    )

    assert status_response.status_code in [200, 400], (
        f"\nTest Case       : Prepare Complaint For Feedback"
        f"\nInput           : PATCH {status_endpoint}"
        f"\nExpected Output : HTTP Status 200 or 400"
        f"\nActual Output   : HTTP Status "
        f"{status_response.status_code}"
        f"\nResponse        : {status_response.text}"
    )

    # ---------------------------------------------------------
    # Step 2: Submit duplicate feedback
    # ---------------------------------------------------------

    expected_status = 409

    response = requests.post(
        f"{BASE_URL}{feedback_endpoint}",
        json=payload,
        headers=auth_headers
    )

    actual_status = response.status_code

    # Assertion
    assert actual_status == expected_status, (
        f"\nTest Case       : Submit Duplicate Feedback"
        f"\nInput           : POST {feedback_endpoint}"
        f"\nExpected Output : HTTP Status {expected_status}"
        f"\nActual Output   : HTTP Status {actual_status}"
        f"\nResponse        : {response.text}"
    )

    # ---------------------------------------------------------
    # Step 3: Verify error message
    # ---------------------------------------------------------

    response_data = response.json()

    assert response_data.get("detail") == (
        "You have already submitted feedback for this complaint."
    ), (
        f"\nExpected Message : "
        f"You have already submitted feedback for this complaint."
        f"\nActual Message   : {response_data.get('detail')}"
    )


def test_submit_feedback_requires_auth():
    """
    Verify that feedback submission requires authentication.
    """

    # Input
    complaint_id = "CMP-65C600"
    endpoint = f"/complaints/{complaint_id}/feedback"

    payload = {
        "rating": 5,
        "comments": "Nice work"
    }

    # Expected Output
    expected_status = [401, 403]

    # Actual Output
    response = requests.post(
        f"{BASE_URL}{endpoint}",
        json=payload
    )

    actual_status = response.status_code

    # Assertion
    assert actual_status in expected_status, (
        f"\nTest Case       : Submit Feedback Authentication"
        f"\nInput           : POST {endpoint}"
        f"\nExpected Output : HTTP Status {expected_status}"
        f"\nActual Output   : HTTP Status {actual_status}"
        f"\nResponse        : {response.text}"
    )


def test_submit_feedback_invalid_token():
    """
    Verify that feedback submission rejects an invalid JWT.
    """

    # Input
    complaint_id = "CMP-65C600"
    endpoint = f"/complaints/{complaint_id}/feedback"

    payload = {
        "rating": 5,
        "comments": "Nice work"
    }

    headers = {
        "Authorization": "Bearer invalid.jwt.token"
    }

    # Expected Output
    expected_status = [401, 403]

    # Actual Output
    response = requests.post(
        f"{BASE_URL}{endpoint}",
        json=payload,
        headers=headers
    )

    actual_status = response.status_code

    # Assertion
    assert actual_status in expected_status, (
        f"\nTest Case       : Submit Feedback Invalid Token"
        f"\nInput           : POST {endpoint}"
        f"\nExpected Output : HTTP Status {expected_status}"
        f"\nActual Output   : HTTP Status {actual_status}"
        f"\nResponse        : {response.text}"
    )


def test_submit_feedback_missing_rating(auth_headers):
    """
    Verify that feedback submission fails when rating
    is missing.
    """

    # Input
    complaint_id = "CMP-DOES-NOT-EXIST"
    endpoint = f"/complaints/{complaint_id}/feedback"

    payload = {
        "comments": "Nice work"
    }

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
        f"\nTest Case       : Feedback Missing Rating"
        f"\nInput           : POST {endpoint}"
        f"\nExpected Output : HTTP Status {expected_status}"
        f"\nActual Output   : HTTP Status {actual_status}"
        f"\nResponse        : {response.text}"
    )


def test_submit_feedback_missing_comments(auth_headers):
    """
    Verify that feedback submission handles a missing
    comments field.
    """

    # Input
    complaint_id = "CMP-DOES-NOT-EXIST"
    endpoint = f"/complaints/{complaint_id}/feedback"

    payload = {
        "rating": 5
    }

    # Expected Output
    expected_status = [200, 201, 400, 404, 409, 422]

    # Actual Output
    response = requests.post(
        f"{BASE_URL}{endpoint}",
        json=payload,
        headers=auth_headers
    )

    actual_status = response.status_code

    # Assertion
    assert actual_status in expected_status, (
        f"\nTest Case       : Feedback Missing Comments"
        f"\nInput           : POST {endpoint}"
        f"\nExpected Output : HTTP Status {expected_status}"
        f"\nActual Output   : HTTP Status {actual_status}"
        f"\nResponse        : {response.text}"
    )

    assert actual_status != 500, (
        f"\nUnexpected server error."
        f"\nResponse : {response.text}"
    )


def test_submit_feedback_invalid_rating(auth_headers):
    """
    Verify that an invalid rating value is rejected.
    """

    # Input
    complaint_id = "CMP-DOES-NOT-EXIST"
    endpoint = f"/complaints/{complaint_id}/feedback"

    payload = {
        "rating": 0,
        "comments": "Invalid rating test"
    }

    # Expected Output
    expected_status = [400, 404, 422]

    # Actual Output
    response = requests.post(
        f"{BASE_URL}{endpoint}",
        json=payload,
        headers=auth_headers
    )

    actual_status = response.status_code

    # Assertion
    assert actual_status in expected_status, (
        f"\nTest Case       : Feedback Invalid Rating"
        f"\nInput           : POST {endpoint}"
        f"\nExpected Output : HTTP Status {expected_status}"
        f"\nActual Output   : HTTP Status {actual_status}"
        f"\nResponse        : {response.text}"
    )


def test_submit_feedback_rating_above_maximum(auth_headers):
    """
    Verify that a rating above the expected maximum is rejected.
    """

    # Input
    complaint_id = "CMP-DOES-NOT-EXIST"
    endpoint = f"/complaints/{complaint_id}/feedback"

    payload = {
        "rating": 6,
        "comments": "Invalid rating test"
    }

    # Expected Output
    expected_status = [400, 404, 422]

    # Actual Output
    response = requests.post(
        f"{BASE_URL}{endpoint}",
        json=payload,
        headers=auth_headers
    )

    actual_status = response.status_code

    # Assertion
    assert actual_status in expected_status, (
        f"\nTest Case       : Feedback Rating Above Maximum"
        f"\nInput           : POST {endpoint}"
        f"\nExpected Output : HTTP Status {expected_status}"
        f"\nActual Output   : HTTP Status {actual_status}"
        f"\nResponse        : {response.text}"
    )


def test_submit_feedback_negative_rating(auth_headers):
    """
    Verify that a negative rating is rejected.
    """

    # Input
    complaint_id = "CMP-DOES-NOT-EXIST"
    endpoint = f"/complaints/{complaint_id}/feedback"

    payload = {
        "rating": -1,
        "comments": "Negative rating test"
    }

    # Expected Output
    expected_status = [400, 404, 422]

    # Actual Output
    response = requests.post(
        f"{BASE_URL}{endpoint}",
        json=payload,
        headers=auth_headers
    )

    actual_status = response.status_code

    # Assertion
    assert actual_status in expected_status, (
        f"\nTest Case       : Feedback Negative Rating"
        f"\nInput           : POST {endpoint}"
        f"\nExpected Output : HTTP Status {expected_status}"
        f"\nActual Output   : HTTP Status {actual_status}"
        f"\nResponse        : {response.text}"
    )


def test_submit_feedback_nonexistent_complaint(auth_headers):
    """
    Verify that feedback cannot be submitted for a
    complaint that does not exist.
    """

    # Input
    complaint_id = "CMP-DOES-NOT-EXIST"
    endpoint = f"/complaints/{complaint_id}/feedback"

    payload = {
        "rating": 5,
        "comments": "Test feedback"
    }

    # Expected Output
    expected_status = 404

    # Actual Output
    response = requests.post(
        f"{BASE_URL}{endpoint}",
        json=payload,
        headers=auth_headers
    )

    actual_status = response.status_code

    # Assertion
    assert actual_status == expected_status, (
        f"\nTest Case       : Feedback Nonexistent Complaint"
        f"\nInput           : POST {endpoint}"
        f"\nExpected Output : HTTP Status {expected_status}"
        f"\nActual Output   : HTTP Status {actual_status}"
        f"\nResponse        : {response.text}"
    )


def test_submit_feedback_empty_payload(auth_headers):
    """
    Verify that an empty feedback payload is rejected.
    """

    # Input
    complaint_id = "CMP-DOES-NOT-EXIST"
    endpoint = f"/complaints/{complaint_id}/feedback"

    payload = {}

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
        f"\nTest Case       : Feedback Empty Payload"
        f"\nInput           : POST {endpoint}"
        f"\nExpected Output : HTTP Status {expected_status}"
        f"\nActual Output   : HTTP Status {actual_status}"
        f"\nResponse        : {response.text}"
    )


def test_submit_feedback_no_server_error(auth_headers):
    """
    Verify that feedback submission does not produce
    an unexpected internal server error.
    """

    # Input
    complaint_id = "CMP-DOES-NOT-EXIST"
    endpoint = f"/complaints/{complaint_id}/feedback"

    payload = {
        "rating": 5,
        "comments": "Server error validation"
    }

    # Actual Output
    response = requests.post(
        f"{BASE_URL}{endpoint}",
        json=payload,
        headers=auth_headers
    )

    actual_status = response.status_code

    # Assertion
    assert actual_status != 500, (
        f"\nTest Case       : Feedback Server Error Check"
        f"\nInput           : POST {endpoint}"
        f"\nUnexpected Output : HTTP Status 500"
        f"\nResponse          : {response.text}"
    )