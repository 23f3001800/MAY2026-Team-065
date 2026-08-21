import requests

BASE_URL = "http://127.0.0.1:8000"


def test_submit_feedback_already_submitted(auth_headers, admin_auth_headers):
    """
    Verify that submitting feedback again for a complaint
    that already has feedback returns a conflict response.

    The complaint must be RESOLVED or VERIFIED before
    feedback can be submitted.
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
        f"\nActual Output   : HTTP Status {status_response.status_code}"
        f"\nResponse        : {status_response.text}"
    )

    # ---------------------------------------------------------
    # Step 2: Submit feedback
    #
    # The complaint already has feedback in the seeded data.
    # Therefore this request should be rejected as duplicate.
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
    # Step 3: Verify the actual error message
    # ---------------------------------------------------------
    response_data = response.json()

    assert response_data.get("detail") == (
        "You have already submitted feedback for this complaint."
    ), (
        f"\nExpected Message : "
        f"You have already submitted feedback for this complaint."
        f"\nActual Message   : {response_data.get('detail')}"
    )