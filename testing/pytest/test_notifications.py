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
        f"\nResponse        : {response.text}"
    )

    # Response Validation
    assert response.headers.get(
        "content-type", ""
    ).startswith("application/json")

    data = response.json()

    assert isinstance(data, list), (
        f"\nExpected Output : List of notifications"
        f"\nActual Output   : {data}"
    )


def test_get_notifications_requires_auth():
    """
    Verify that the notifications endpoint requires
    authentication.
    """

    # Input
    endpoint = "/notifications/me"

    # Expected Output
    expected_status = [401, 403]

    # Actual Output
    response = requests.get(
        f"{BASE_URL}{endpoint}"
    )

    actual_status = response.status_code

    # Assertion
    assert actual_status in expected_status, (
        f"\nTest Case       : Notifications Authentication"
        f"\nInput           : GET {endpoint}"
        f"\nExpected Output : HTTP Status {expected_status}"
        f"\nActual Output   : HTTP Status {actual_status}"
        f"\nResponse        : {response.text}"
    )


def test_get_notifications_invalid_token():
    """
    Verify that an invalid JWT cannot be used to retrieve
    notifications.
    """

    # Input
    endpoint = "/notifications/me"

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
        f"\nTest Case       : Notifications Invalid Token"
        f"\nInput           : GET {endpoint}"
        f"\nExpected Output : HTTP Status {expected_status}"
        f"\nActual Output   : HTTP Status {actual_status}"
        f"\nResponse        : {response.text}"
    )


def test_get_notifications_malformed_authorization():
    """
    Verify that a malformed Authorization header is rejected.
    """

    # Input
    endpoint = "/notifications/me"

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
        f"\nTest Case       : Notifications Malformed Authorization"
        f"\nInput           : GET {endpoint}"
        f"\nExpected Output : HTTP Status {expected_status}"
        f"\nActual Output   : HTTP Status {actual_status}"
        f"\nResponse        : {response.text}"
    )


def test_get_notifications_response_structure(auth_headers):
    """
    Verify that each notification returned by the endpoint
    is a JSON object.
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
        f"\nTest Case       : Notifications Response Structure"
        f"\nInput           : GET {endpoint}"
        f"\nExpected Output : HTTP Status {expected_status}"
        f"\nActual Output   : HTTP Status {actual_status}"
        f"\nResponse        : {response.text}"
    )

    data = response.json()

    assert isinstance(data, list)

    for notification in data:
        assert isinstance(notification, dict), (
            f"\nExpected Notification : JSON object"
            f"\nActual Notification   : {notification}"
        )


def test_get_notifications_no_server_error(auth_headers):
    """
    Verify that the notifications endpoint does not return
    an unexpected internal server error.
    """

    # Input
    endpoint = "/notifications/me"

    # Actual Output
    response = requests.get(
        f"{BASE_URL}{endpoint}",
        headers=auth_headers
    )

    actual_status = response.status_code

    # Assertion
    assert actual_status != 500, (
        f"\nTest Case       : Notifications Server Error Check"
        f"\nInput           : GET {endpoint}"
        f"\nUnexpected Output : HTTP Status 500"
        f"\nResponse          : {response.text}"
    )

    assert actual_status == 200, (
        f"\nTest Case       : Get My Notifications"
        f"\nExpected Output : HTTP Status 200"
        f"\nActual Output   : HTTP Status {actual_status}"
        f"\nResponse        : {response.text}"
    )


def test_get_unread_notification_count(auth_headers):
    """
    Verify that an authenticated user can retrieve
    the unread notification count successfully.
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
        f"\nResponse        : {response.text}"
    )

    # Response Validation
    assert response.headers.get(
        "content-type", ""
    ).startswith("application/json")

    data = response.json()

    assert isinstance(data, dict)

    if "unreadCount" in data:
        assert isinstance(data["unreadCount"], int)
        assert data["unreadCount"] >= 0


def test_get_unread_notification_count_requires_auth():
    """
    Verify that unread notification count requires
    authentication.
    """

    # Input
    endpoint = "/notifications/me/unread-count"

    # Expected Output
    expected_status = [401, 403]

    # Actual Output
    response = requests.get(
        f"{BASE_URL}{endpoint}"
    )

    actual_status = response.status_code

    # Assertion
    assert actual_status in expected_status, (
        f"\nTest Case       : Unread Count Authentication"
        f"\nInput           : GET {endpoint}"
        f"\nExpected Output : HTTP Status {expected_status}"
        f"\nActual Output   : HTTP Status {actual_status}"
        f"\nResponse        : {response.text}"
    )


def test_get_unread_notification_count_invalid_token():
    """
    Verify that an invalid JWT cannot be used to retrieve
    the unread notification count.
    """

    # Input
    endpoint = "/notifications/me/unread-count"

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
        f"\nTest Case       : Unread Count Invalid Token"
        f"\nInput           : GET {endpoint}"
        f"\nExpected Output : HTTP Status {expected_status}"
        f"\nActual Output   : HTTP Status {actual_status}"
        f"\nResponse        : {response.text}"
    )


def test_get_unread_notification_count_malformed_authorization():
    """
    Verify that a malformed Authorization header is rejected
    for the unread notification count endpoint.
    """

    # Input
    endpoint = "/notifications/me/unread-count"

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
        f"\nTest Case       : Unread Count Malformed Authorization"
        f"\nInput           : GET {endpoint}"
        f"\nExpected Output : HTTP Status {expected_status}"
        f"\nActual Output   : HTTP Status {actual_status}"
        f"\nResponse        : {response.text}"
    )


def test_unread_count_matches_notifications(auth_headers):
    """
    Verify that the unread notification count is a valid
    non-negative integer and that notification records have
    a recognizable read/unread field when provided.
    """

    # Input
    notifications_endpoint = "/notifications/me"
    count_endpoint = "/notifications/me/unread-count"

    # Expected Output
    expected_status = 200

    # Actual Output
    notifications_response = requests.get(
        f"{BASE_URL}{notifications_endpoint}",
        headers=auth_headers
    )

    count_response = requests.get(
        f"{BASE_URL}{count_endpoint}",
        headers=auth_headers
    )

    # Assertions
    assert notifications_response.status_code == expected_status, (
        f"\nTest Case       : Notification List For Count Validation"
        f"\nExpected Output : HTTP Status {expected_status}"
        f"\nActual Output   : HTTP Status "
        f"{notifications_response.status_code}"
        f"\nResponse        : {notifications_response.text}"
    )

    assert count_response.status_code == expected_status, (
        f"\nTest Case       : Unread Count For Count Validation"
        f"\nExpected Output : HTTP Status {expected_status}"
        f"\nActual Output   : HTTP Status "
        f"{count_response.status_code}"
        f"\nResponse        : {count_response.text}"
    )

    notifications = notifications_response.json()
    count_data = count_response.json()

    assert isinstance(notifications, list)
    assert isinstance(count_data, dict)

    if "unreadCount" in count_data:
        assert isinstance(count_data["unreadCount"], int)
        assert count_data["unreadCount"] >= 0


def test_notifications_repeated_request(auth_headers):
    """
    Verify that repeated notification requests remain
    successful and return consistent data.
    """

    # Input
    endpoint = "/notifications/me"

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
        f"\nTest Case       : First Notifications Request"
        f"\nExpected Output : HTTP Status {expected_status}"
        f"\nActual Output   : HTTP Status "
        f"{first_response.status_code}"
        f"\nResponse        : {first_response.text}"
    )

    assert second_response.status_code == expected_status, (
        f"\nTest Case       : Repeated Notifications Request"
        f"\nExpected Output : HTTP Status {expected_status}"
        f"\nActual Output   : HTTP Status "
        f"{second_response.status_code}"
        f"\nResponse        : {second_response.text}"
    )

    first_data = first_response.json()
    second_data = second_response.json()

    assert first_data == second_data, (
        f"\nExpected Output : Consistent notification response"
        f"\nFirst Response  : {first_data}"
        f"\nSecond Response : {second_data}"
    )


def test_unread_count_repeated_request(auth_headers):
    """
    Verify that repeated unread-count requests remain
    successful and return a valid count.
    """

    # Input
    endpoint = "/notifications/me/unread-count"

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
    assert first_response.status_code == expected_status
    assert second_response.status_code == expected_status

    first_data = first_response.json()
    second_data = second_response.json()

    assert isinstance(first_data, dict)
    assert isinstance(second_data, dict)

    if "unreadCount" in first_data:
        assert isinstance(first_data["unreadCount"], int)
        assert first_data["unreadCount"] >= 0

    if "unreadCount" in second_data:
        assert isinstance(second_data["unreadCount"], int)
        assert second_data["unreadCount"] >= 0


def test_unread_count_no_server_error(auth_headers):
    """
    Verify that the unread notification count endpoint
    does not return an unexpected internal server error.
    """

    # Input
    endpoint = "/notifications/me/unread-count"

    # Actual Output
    response = requests.get(
        f"{BASE_URL}{endpoint}",
        headers=auth_headers
    )

    actual_status = response.status_code

    # Assertion
    assert actual_status != 500, (
        f"\nTest Case       : Unread Count Server Error Check"
        f"\nInput           : GET {endpoint}"
        f"\nUnexpected Output : HTTP Status 500"
        f"\nResponse          : {response.text}"
    )

    assert actual_status == 200, (
        f"\nTest Case       : Get Unread Notification Count"
        f"\nExpected Output : HTTP Status 200"
        f"\nActual Output   : HTTP Status {actual_status}"
        f"\nResponse        : {response.text}"
    )