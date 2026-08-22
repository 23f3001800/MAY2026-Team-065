import requests


BASE_URL = "http://127.0.0.1:8000"

# Known test citizen password after the manual verification.
CURRENT_PASSWORD = "12345678"
TEMP_PASSWORD = "CitizenTest123"


def test_update_citizen_password(auth_headers):
    """
    Verify that an authenticated citizen can change their password
    by providing the correct current password.
    """

    endpoint = "/citizens/me/password"

    payload = {
        "oldPassword": CURRENT_PASSWORD,
        "newPassword": TEMP_PASSWORD
    }

    expected_status = 200

    response = requests.patch(
        f"{BASE_URL}{endpoint}",
        json=payload,
        headers=auth_headers
    )

    actual_status = response.status_code

    assert actual_status == expected_status, (
        f"\nTest Case       : Update Citizen Password"
        f"\nInput           : PATCH {endpoint}"
        f"\nExpected Output : HTTP Status {expected_status}"
        f"\nActual Output   : HTTP Status {actual_status}"
        f"\nResponse        : {response.text}"
    )

    # Verify JSON response.
    assert response.headers["content-type"].startswith(
        "application/json"
    )

    data = response.json()

    assert isinstance(data, dict)

    # Password must never be returned in the response.
    assert "password" not in data
    assert "oldPassword" not in data
    assert "newPassword" not in data

    # Restore the original password so other tests remain repeatable.
    restore_payload = {
        "oldPassword": TEMP_PASSWORD,
        "newPassword": CURRENT_PASSWORD
    }

    restore_response = requests.patch(
        f"{BASE_URL}{endpoint}",
        json=restore_payload,
        headers=auth_headers
    )

    assert restore_response.status_code == 200, (
        f"\nTest Case       : Restore Citizen Password"
        f"\nExpected Output : HTTP Status 200"
        f"\nActual Output   : HTTP Status {restore_response.status_code}"
        f"\nResponse        : {restore_response.text}"
    )


def test_update_citizen_password_requires_auth():
    """
    Verify that changing a citizen password requires authentication.
    """

    endpoint = "/citizens/me/password"

    payload = {
        "oldPassword": CURRENT_PASSWORD,
        "newPassword": TEMP_PASSWORD
    }

    expected_status = 401

    response = requests.patch(
        f"{BASE_URL}{endpoint}",
        json=payload
    )

    actual_status = response.status_code

    assert actual_status == expected_status, (
        f"\nTest Case       : Citizen Password Authentication"
        f"\nInput           : PATCH {endpoint}"
        f"\nExpected Output : HTTP Status {expected_status}"
        f"\nActual Output   : HTTP Status {actual_status}"
        f"\nResponse        : {response.text}"
    )


def test_update_citizen_password_invalid_token():
    """
    Verify that an invalid authentication token is rejected.
    """

    endpoint = "/citizens/me/password"

    payload = {
        "oldPassword": CURRENT_PASSWORD,
        "newPassword": TEMP_PASSWORD
    }

    headers = {
        "Authorization": "Bearer invalid-token"
    }

    expected_status = 401

    response = requests.patch(
        f"{BASE_URL}{endpoint}",
        json=payload,
        headers=headers
    )

    actual_status = response.status_code

    assert actual_status == expected_status, (
        f"\nTest Case       : Citizen Password Invalid Token"
        f"\nInput           : PATCH {endpoint}"
        f"\nExpected Output : HTTP Status {expected_status}"
        f"\nActual Output   : HTTP Status {actual_status}"
        f"\nResponse        : {response.text}"
    )


def test_update_citizen_password_admin_denied(admin_auth_headers):
    """
    Verify that an administrator cannot use the citizen-only
    password endpoint.
    """

    endpoint = "/citizens/me/password"

    payload = {
        "oldPassword": CURRENT_PASSWORD,
        "newPassword": TEMP_PASSWORD
    }

    expected_status = 403

    response = requests.patch(
        f"{BASE_URL}{endpoint}",
        json=payload,
        headers=admin_auth_headers
    )

    actual_status = response.status_code

    assert actual_status == expected_status, (
        f"\nTest Case       : Citizen Password Admin Authorization"
        f"\nInput           : PATCH {endpoint}"
        f"\nExpected Output : HTTP Status {expected_status}"
        f"\nActual Output   : HTTP Status {actual_status}"
        f"\nResponse        : {response.text}"
    )


def test_update_citizen_password_wrong_old_password(auth_headers):
    """
    Verify that an incorrect current password is rejected.
    """

    endpoint = "/citizens/me/password"

    payload = {
        "oldPassword": "WrongPassword999",
        "newPassword": TEMP_PASSWORD
    }

    expected_status = 400

    response = requests.patch(
        f"{BASE_URL}{endpoint}",
        json=payload,
        headers=auth_headers
    )

    actual_status = response.status_code

    assert actual_status == expected_status, (
        f"\nTest Case       : Citizen Password Wrong Old Password"
        f"\nInput           : PATCH {endpoint}"
        f"\nExpected Output : HTTP Status {expected_status}"
        f"\nActual Output   : HTTP Status {actual_status}"
        f"\nResponse        : {response.text}"
    )


def test_update_citizen_password_missing_old_password(auth_headers):
    """
    Verify the API behavior when oldPassword is missing.
    """

    endpoint = "/citizens/me/password"

    payload = {
        "newPassword": TEMP_PASSWORD
    }

    response = requests.patch(
        f"{BASE_URL}{endpoint}",
        json=payload,
        headers=auth_headers
    )

    actual_status = response.status_code

    assert actual_status in [400, 422], (
        f"\nTest Case       : Citizen Password Missing Old Password"
        f"\nInput           : PATCH {endpoint}"
        f"\nExpected Output : HTTP Status [400, 422]"
        f"\nActual Output   : HTTP Status {actual_status}"
        f"\nResponse        : {response.text}"
    )


def test_update_citizen_password_missing_new_password(auth_headers):
    """
    Verify the API behavior when newPassword is missing.
    """

    endpoint = "/citizens/me/password"

    payload = {
        "oldPassword": CURRENT_PASSWORD
    }

    response = requests.patch(
        f"{BASE_URL}{endpoint}",
        json=payload,
        headers=auth_headers
    )

    actual_status = response.status_code

    assert actual_status in [400, 422], (
        f"\nTest Case       : Citizen Password Missing New Password"
        f"\nInput           : PATCH {endpoint}"
        f"\nExpected Output : HTTP Status [400, 422]"
        f"\nActual Output   : HTTP Status {actual_status}"
        f"\nResponse        : {response.text}"
    )


def test_update_citizen_password_null_values(auth_headers):
    """
    Verify the API behavior when password fields are null.
    """

    endpoint = "/citizens/me/password"

    payload = {
        "oldPassword": None,
        "newPassword": None
    }

    response = requests.patch(
        f"{BASE_URL}{endpoint}",
        json=payload,
        headers=auth_headers
    )

    actual_status = response.status_code

    assert actual_status in [400, 422], (
        f"\nTest Case       : Citizen Password Null Values"
        f"\nInput           : PATCH {endpoint}"
        f"\nExpected Output : HTTP Status [400, 422]"
        f"\nActual Output   : HTTP Status {actual_status}"
        f"\nResponse        : {response.text}"
    )


def test_update_citizen_password_empty_values(auth_headers):
    """
    Verify the API behavior when password fields are empty strings.
    """

    endpoint = "/citizens/me/password"

    payload = {
        "oldPassword": "",
        "newPassword": ""
    }

    response = requests.patch(
        f"{BASE_URL}{endpoint}",
        json=payload,
        headers=auth_headers
    )

    actual_status = response.status_code

    assert actual_status in [400, 422], (
        f"\nTest Case       : Citizen Password Empty Values"
        f"\nInput           : PATCH {endpoint}"
        f"\nExpected Output : HTTP Status [400, 422]"
        f"\nActual Output   : HTTP Status {actual_status}"
        f"\nResponse        : {response.text}"
    )


def test_update_citizen_password_same_password(auth_headers):
    """
    Verify the API behavior when the old and new passwords
    are identical.

    The endpoint may either reject this or accept it depending
    on the application's password policy.
    """

    endpoint = "/citizens/me/password"

    payload = {
        "oldPassword": CURRENT_PASSWORD,
        "newPassword": CURRENT_PASSWORD
    }

    response = requests.patch(
        f"{BASE_URL}{endpoint}",
        json=payload,
        headers=auth_headers
    )

    actual_status = response.status_code

    assert actual_status in [200, 400, 422], (
        f"\nTest Case       : Citizen Password Same Password"
        f"\nInput           : PATCH {endpoint}"
        f"\nExpected Output : HTTP Status [200, 400, 422]"
        f"\nActual Output   : HTTP Status {actual_status}"
        f"\nResponse        : {response.text}"
    )


def test_update_citizen_password_response_content_type(auth_headers):
    """
    Verify that a successful password change returns JSON.
    """

    endpoint = "/citizens/me/password"

    payload = {
        "oldPassword": CURRENT_PASSWORD,
        "newPassword": TEMP_PASSWORD
    }

    response = requests.patch(
        f"{BASE_URL}{endpoint}",
        json=payload,
        headers=auth_headers
    )

    assert response.status_code == 200, (
        f"\nTest Case       : Citizen Password Response Content Type"
        f"\nExpected Output : HTTP Status 200"
        f"\nActual Output   : HTTP Status {response.status_code}"
        f"\nResponse        : {response.text}"
    )

    assert response.headers["content-type"].startswith(
        "application/json"
    )

    # Restore password.
    restore_payload = {
        "oldPassword": TEMP_PASSWORD,
        "newPassword": CURRENT_PASSWORD
    }

    restore_response = requests.patch(
        f"{BASE_URL}{endpoint}",
        json=restore_payload,
        headers=auth_headers
    )

    assert restore_response.status_code == 200, (
        f"\nTest Case       : Restore Citizen Password"
        f"\nExpected Output : HTTP Status 200"
        f"\nActual Output   : HTTP Status {restore_response.status_code}"
        f"\nResponse        : {restore_response.text}"
    )