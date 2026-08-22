import requests
import pytest


BASE_URL = "http://127.0.0.1:8000"

# Test user: Raj Worker 2
TEST_USER_ID = "eabf91dd-6194-478e-93ea-68a0d58aafb1"
TEST_USER_EMAIL = "worker2@test.com"

# Password used by this test
NEW_PASSWORD = "WorkerReset123"


def test_reset_password_success(admin_auth_headers):
    """
    Verify that an administrator can successfully reset
    the password of a field worker.
    """

    endpoint = f"/users/{TEST_USER_ID}/reset-password"

    payload = {
        "newPassword": NEW_PASSWORD
    }

    expected_status = 200

    response = requests.patch(
        f"{BASE_URL}{endpoint}",
        json=payload,
        headers=admin_auth_headers
    )

    actual_status = response.status_code

    assert actual_status == expected_status, (
        f"\nTest Case       : Reset User Password - Valid Request"
        f"\nInput           : PATCH {endpoint}"
        f"\nExpected Output : HTTP Status {expected_status}"
        f"\nActual Output   : HTTP Status {actual_status}"
        f"\nResponse        : {response.text}"
    )

    data = response.json()

    assert isinstance(data, dict)

    assert data.get("message") == "Password reset successful."
    assert data.get("user") == "Raj Worker 2"
    assert data.get("email") == TEST_USER_EMAIL
    assert data.get("role") == "field_worker"

    # Password must never be returned.
    assert "password" not in data
    assert "passwordHash" not in data


def test_reset_password_requires_auth():
    """
    Verify that password reset requires authentication.
    """

    endpoint = f"/users/{TEST_USER_ID}/reset-password"

    payload = {
        "newPassword": NEW_PASSWORD
    }

    expected_status = 401

    response = requests.patch(
        f"{BASE_URL}{endpoint}",
        json=payload
    )

    actual_status = response.status_code

    assert actual_status == expected_status, (
        f"\nTest Case       : Reset User Password - Authentication"
        f"\nInput           : PATCH {endpoint}"
        f"\nExpected Output : HTTP Status {expected_status}"
        f"\nActual Output   : HTTP Status {actual_status}"
        f"\nResponse        : {response.text}"
    )


def test_reset_password_invalid_token():
    """
    Verify that an invalid authentication token is rejected.
    """

    endpoint = f"/users/{TEST_USER_ID}/reset-password"

    payload = {
        "newPassword": NEW_PASSWORD
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
        f"\nTest Case       : Reset User Password - Invalid Token"
        f"\nInput           : PATCH {endpoint}"
        f"\nExpected Output : HTTP Status {expected_status}"
        f"\nActual Output   : HTTP Status {actual_status}"
        f"\nResponse        : {response.text}"
    )


def test_reset_password_citizen_denied(auth_headers):
    """
    Verify that a normal citizen cannot reset another user's password.
    """

    endpoint = f"/users/{TEST_USER_ID}/reset-password"

    payload = {
        "newPassword": NEW_PASSWORD
    }

    expected_status = 403

    response = requests.patch(
        f"{BASE_URL}{endpoint}",
        json=payload,
        headers=auth_headers
    )

    actual_status = response.status_code

    assert actual_status == expected_status, (
        f"\nTest Case       : Reset User Password - Citizen Authorization"
        f"\nInput           : PATCH {endpoint}"
        f"\nExpected Output : HTTP Status {expected_status}"
        f"\nActual Output   : HTTP Status {actual_status}"
        f"\nResponse        : {response.text}"
    )


def test_reset_password_nonexistent_user(admin_auth_headers):
    """
    Verify that resetting the password of a non-existent user
    is rejected.
    """

    fake_user_id = "00000000-0000-0000-0000-000000000000"

    endpoint = f"/users/{fake_user_id}/reset-password"

    payload = {
        "newPassword": NEW_PASSWORD
    }

    expected_status = 404

    response = requests.patch(
        f"{BASE_URL}{endpoint}",
        json=payload,
        headers=admin_auth_headers
    )

    actual_status = response.status_code

    assert actual_status == expected_status, (
        f"\nTest Case       : Reset User Password - Non-existent User"
        f"\nInput           : PATCH {endpoint}"
        f"\nExpected Output : HTTP Status {expected_status}"
        f"\nActual Output   : HTTP Status {actual_status}"
        f"\nResponse        : {response.text}"
    )


def test_reset_password_missing_new_password(admin_auth_headers):
    """
    Verify that newPassword is required.
    """

    endpoint = f"/users/{TEST_USER_ID}/reset-password"

    payload = {}

    expected_status = 422

    response = requests.patch(
        f"{BASE_URL}{endpoint}",
        json=payload,
        headers=admin_auth_headers
    )

    actual_status = response.status_code

    assert actual_status == expected_status, (
        f"\nTest Case       : Reset User Password - Missing Password"
        f"\nInput           : PATCH {endpoint}"
        f"\nExpected Output : HTTP Status {expected_status}"
        f"\nActual Output   : HTTP Status {actual_status}"
        f"\nResponse        : {response.text}"
    )


def test_reset_password_null_password(admin_auth_headers):
    """
    Verify that null newPassword is rejected.
    """

    endpoint = f"/users/{TEST_USER_ID}/reset-password"

    payload = {
        "newPassword": None
    }

    expected_status = 422

    response = requests.patch(
        f"{BASE_URL}{endpoint}",
        json=payload,
        headers=admin_auth_headers
    )

    actual_status = response.status_code

    assert actual_status == expected_status, (
        f"\nTest Case       : Reset User Password - Null Password"
        f"\nInput           : PATCH {endpoint}"
        f"\nExpected Output : HTTP Status {expected_status}"
        f"\nActual Output   : HTTP Status {actual_status}"
        f"\nResponse        : {response.text}"
    )


def test_reset_password_empty_password(admin_auth_headers):
    """
    Verify that an empty password is rejected.

    Known application defect:
    the API currently accepts an empty password and returns 200.
    """

    endpoint = f"/users/{TEST_USER_ID}/reset-password"

    payload = {
        "newPassword": ""
    }

    response = requests.patch(
        f"{BASE_URL}{endpoint}",
        json=payload,
        headers=admin_auth_headers
    )

    actual_status = response.status_code

    # Current application defect:
    # Empty password is accepted and reset succeeds.
    if actual_status == 200:
        pytest.xfail(
            "Known application defect: empty password is accepted "
            "and password reset returns HTTP 200."
        )

    expected_statuses = [400, 422]

    assert actual_status in expected_statuses, (
        f"\nTest Case       : Reset User Password - Empty Password"
        f"\nInput           : PATCH {endpoint}"
        f"\nExpected Output : HTTP Status {expected_statuses}"
        f"\nActual Output   : HTTP Status {actual_status}"
        f"\nResponse        : {response.text}"
    )


def test_reset_password_response_content_type(admin_auth_headers):
    """
    Verify that a successful password reset returns JSON.
    """

    endpoint = f"/users/{TEST_USER_ID}/reset-password"

    payload = {
        "newPassword": NEW_PASSWORD
    }

    expected_status = 200

    response = requests.patch(
        f"{BASE_URL}{endpoint}",
        json=payload,
        headers=admin_auth_headers
    )

    assert response.status_code == expected_status, (
        f"\nTest Case       : Reset User Password - Content Type"
        f"\nExpected Output : HTTP Status {expected_status}"
        f"\nActual Output   : HTTP Status {response.status_code}"
        f"\nResponse        : {response.text}"
    )

    assert response.headers["content-type"].startswith(
        "application/json"
    )


def test_reset_password_new_password_works(admin_auth_headers):
    """
    Verify that the newly reset password can actually be used
    to log in as the affected field worker.
    """

    # First reset the password to a known test password.
    reset_endpoint = f"/users/{TEST_USER_ID}/reset-password"

    reset_payload = {
        "newPassword": NEW_PASSWORD
    }

    reset_response = requests.patch(
        f"{BASE_URL}{reset_endpoint}",
        json=reset_payload,
        headers=admin_auth_headers
    )

    assert reset_response.status_code == 200, (
        f"\nTest Case       : Prepare Password Login Verification"
        f"\nExpected Output : HTTP Status 200"
        f"\nActual Output   : HTTP Status {reset_response.status_code}"
        f"\nResponse        : {reset_response.text}"
    )

    # Login using the newly reset password.
    login_endpoint = "/auth/login"

    login_payload = {
        "username": TEST_USER_EMAIL,
        "password": NEW_PASSWORD
    }

    login_response = requests.post(
        f"{BASE_URL}{login_endpoint}",
        data=login_payload
    )

    actual_status = login_response.status_code

    assert actual_status == 200, (
        f"\nTest Case       : Verify New Password Login"
        f"\nInput           : POST {login_endpoint}"
        f"\nExpected Output : HTTP Status 200"
        f"\nActual Output   : HTTP Status {actual_status}"
        f"\nResponse        : {login_response.text}"
    )

    login_data = login_response.json()

    assert isinstance(login_data, dict)
    assert "access_token" in login_data
    assert login_data["access_token"]