import requests

BASE_URL = "http://127.0.0.1:8000"


def test_get_notifications(auth_headers):
    """
    Verify that an authenticated user can retrieve
    their notifications successfully.
    """

    # Input
    endpoint = "/notifications/me"

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
        f"\nTest Case       : Get My Notifications"
        f"\nInput           : GET {endpoint}"
        f"\nExpected Output : HTTP Status {expected_status}"
        f"\nActual Output   : HTTP Status {actual_status}"
    )

    # Response Validation
    assert response.headers["content-type"].startswith("application/json")


def test_get_unread_notification_count(auth_headers):
    """
    Verify that an authenticated user can retrieve
    unread notification count successfully.
    """

    # Input
    endpoint = "/notifications/me/unread-count"

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
        f"\nTest Case       : Get Unread Notification Count"
        f"\nInput           : GET {endpoint}"
        f"\nExpected Output : HTTP Status {expected_status}"
        f"\nActual Output   : HTTP Status {actual_status}"
    )

    # Response Validation
    assert response.headers["content-type"].startswith("application/json")

    data = response.json()

    # Validate response structure
    assert isinstance(data, dict)

    # Optional validation (only if field exists)
    if "unreadCount" in data:
        assert isinstance(data["unreadCount"], int)