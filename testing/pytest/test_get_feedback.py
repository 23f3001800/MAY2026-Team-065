import requests

BASE_URL = "http://127.0.0.1:8000"


def test_get_complaint_feedback(auth_headers):
    """
    Verify that an authenticated citizen can retrieve
    feedback submitted for a complaint.
    """

    # Input
    endpoint = "/complaints/CMP-65C600/feedback"

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
        f"\nTest Case       : Get Complaint Feedback"
        f"\nInput           : GET {endpoint}"
        f"\nExpected Output : HTTP Status {expected_status}"
        f"\nActual Output   : HTTP Status {actual_status}"
        f"\nResponse        : {response.text}"
    )

    # Verify response structure
    response_data = response.json()

    assert isinstance(response_data, list), (
        f"\nExpected Output : List of feedback records"
        f"\nActual Output   : {type(response_data).__name__}"
    )

    assert len(response_data) > 0, (
        "\nExpected Output : At least one feedback record"
        "\nActual Output   : Empty feedback list"
    )

    assert "feedbackId" in response_data[0]
    assert "rating" in response_data[0]
    assert "comments" in response_data[0]
    assert "submittedAt" in response_data[0]
    assert "complaintId" in response_data[0]