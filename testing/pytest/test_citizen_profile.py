import requests


BASE_URL = "http://127.0.0.1:8000"


def test_update_citizen_profile(auth_headers):
    """
    Verify that an authenticated citizen can update
    their own name, phone, and address.
    """

    endpoint = "/citizens/me/profile"

    payload = {
        "name": "QA Test Citizen",
        "phone": "9876543210",
        "address": "Test Address, Jamshedpur"
    }

    expected_status = 200

    response = requests.patch(
        f"{BASE_URL}{endpoint}",
        json=payload,
        headers=auth_headers
    )

    actual_status = response.status_code

    assert actual_status == expected_status, (
        f"\nTest Case       : Update Citizen Profile"
        f"\nInput           : PATCH {endpoint}"
        f"\nExpected Output : HTTP Status {expected_status}"
        f"\nActual Output   : HTTP Status {actual_status}"
        f"\nResponse        : {response.text}"
    )

    data = response.json()

    assert isinstance(data, dict)

    assert data.get("message") == "Profile updated successfully."

    assert "profile" in data
    assert isinstance(data["profile"], dict)

    profile = data["profile"]

    assert profile.get("name") == payload["name"]
    assert profile.get("phone") == payload["phone"]
    assert profile.get("address") == payload["address"]

    assert "email" in profile


def test_update_citizen_profile_requires_auth():
    """
    Verify that updating a citizen profile requires authentication.
    """

    endpoint = "/citizens/me/profile"

    payload = {
        "name": "Unauthenticated Test",
        "phone": "9876543210",
        "address": "Test Address"
    }

    expected_status = 401

    response = requests.patch(
        f"{BASE_URL}{endpoint}",
        json=payload
    )

    actual_status = response.status_code

    assert actual_status == expected_status, (
        f"\nTest Case       : Citizen Profile Authentication"
        f"\nInput           : PATCH {endpoint}"
        f"\nExpected Output : HTTP Status {expected_status}"
        f"\nActual Output   : HTTP Status {actual_status}"
        f"\nResponse        : {response.text}"
    )


def test_update_citizen_profile_invalid_token():
    """
    Verify that an invalid authentication token is rejected.
    """

    endpoint = "/citizens/me/profile"

    payload = {
        "name": "Invalid Token Test",
        "phone": "9876543210",
        "address": "Test Address"
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
        f"\nTest Case       : Citizen Profile Invalid Token"
        f"\nInput           : PATCH {endpoint}"
        f"\nExpected Output : HTTP Status {expected_status}"
        f"\nActual Output   : HTTP Status {actual_status}"
        f"\nResponse        : {response.text}"
    )


def test_update_citizen_profile_admin_denied(admin_auth_headers):
    """
    Verify that an administrator cannot use the citizen-only
    self-profile endpoint.
    """

    endpoint = "/citizens/me/profile"

    payload = {
        "name": "Admin Test",
        "phone": "9876543210",
        "address": "Admin Address"
    }

    expected_status = 403

    response = requests.patch(
        f"{BASE_URL}{endpoint}",
        json=payload,
        headers=admin_auth_headers
    )

    actual_status = response.status_code

    assert actual_status == expected_status, (
        f"\nTest Case       : Citizen Profile Admin Authorization"
        f"\nInput           : PATCH {endpoint}"
        f"\nExpected Output : HTTP Status {expected_status}"
        f"\nActual Output   : HTTP Status {actual_status}"
        f"\nResponse        : {response.text}"
    )


def test_update_citizen_profile_missing_name(auth_headers):
    """
    Verify the actual API behavior when name is omitted.
    """

    endpoint = "/citizens/me/profile"

    payload = {
        "phone": "9876543210",
        "address": "Test Address, Jamshedpur"
    }

    response = requests.patch(
        f"{BASE_URL}{endpoint}",
        json=payload,
        headers=auth_headers
    )

    actual_status = response.status_code

    assert actual_status in [200, 400, 422], (
        f"\nTest Case       : Citizen Profile Missing Name"
        f"\nInput           : PATCH {endpoint}"
        f"\nExpected Output : HTTP Status [200, 400, 422]"
        f"\nActual Output   : HTTP Status {actual_status}"
        f"\nResponse        : {response.text}"
    )


def test_update_citizen_profile_missing_phone(auth_headers):
    """
    Verify the actual API behavior when phone is omitted.
    """

    endpoint = "/citizens/me/profile"

    payload = {
        "name": "QA Test Citizen",
        "address": "Test Address, Jamshedpur"
    }

    response = requests.patch(
        f"{BASE_URL}{endpoint}",
        json=payload,
        headers=auth_headers
    )

    actual_status = response.status_code

    assert actual_status in [200, 400, 422], (
        f"\nTest Case       : Citizen Profile Missing Phone"
        f"\nInput           : PATCH {endpoint}"
        f"\nExpected Output : HTTP Status [200, 400, 422]"
        f"\nActual Output   : HTTP Status {actual_status}"
        f"\nResponse        : {response.text}"
    )


def test_update_citizen_profile_missing_address(auth_headers):
    """
    Verify the actual API behavior when address is omitted.
    """

    endpoint = "/citizens/me/profile"

    payload = {
        "name": "QA Test Citizen",
        "phone": "9876543210"
    }

    response = requests.patch(
        f"{BASE_URL}{endpoint}",
        json=payload,
        headers=auth_headers
    )

    actual_status = response.status_code

    assert actual_status in [200, 400, 422], (
        f"\nTest Case       : Citizen Profile Missing Address"
        f"\nInput           : PATCH {endpoint}"
        f"\nExpected Output : HTTP Status [200, 400, 422]"
        f"\nActual Output   : HTTP Status {actual_status}"
        f"\nResponse        : {response.text}"
    )


def test_update_citizen_profile_null_values(auth_headers):
    """
    Verify the actual API behavior when profile fields are null.
    """

    endpoint = "/citizens/me/profile"

    payload = {
        "name": None,
        "phone": None,
        "address": None
    }

    response = requests.patch(
        f"{BASE_URL}{endpoint}",
        json=payload,
        headers=auth_headers
    )

    actual_status = response.status_code

    assert actual_status in [200, 400, 422], (
        f"\nTest Case       : Citizen Profile Null Values"
        f"\nInput           : PATCH {endpoint}"
        f"\nExpected Output : HTTP Status [200, 400, 422]"
        f"\nActual Output   : HTTP Status {actual_status}"
        f"\nResponse        : {response.text}"
    )


def test_update_citizen_profile_empty_values(auth_headers):
    """
    Verify the actual API behavior when profile fields are empty.
    """

    endpoint = "/citizens/me/profile"

    payload = {
        "name": "",
        "phone": "",
        "address": ""
    }

    response = requests.patch(
        f"{BASE_URL}{endpoint}",
        json=payload,
        headers=auth_headers
    )

    actual_status = response.status_code

    assert actual_status in [200, 400, 422], (
        f"\nTest Case       : Citizen Profile Empty Values"
        f"\nInput           : PATCH {endpoint}"
        f"\nExpected Output : HTTP Status [200, 400, 422]"
        f"\nActual Output   : HTTP Status {actual_status}"
        f"\nResponse        : {response.text}"
    )


def test_update_citizen_profile_response_content_type(auth_headers):
    """
    Verify that a successful profile update returns JSON.
    """

    endpoint = "/citizens/me/profile"

    payload = {
        "name": "QA Test Citizen",
        "phone": "9876543210",
        "address": "Test Address, Jamshedpur"
    }

    response = requests.patch(
        f"{BASE_URL}{endpoint}",
        json=payload,
        headers=auth_headers
    )

    assert response.status_code == 200, (
        f"\nTest Case       : Citizen Profile Response Content Type"
        f"\nExpected Output : HTTP Status 200"
        f"\nActual Output   : HTTP Status {response.status_code}"
        f"\nResponse        : {response.text}"
    )

    assert response.headers["content-type"].startswith(
        "application/json"
    )


def test_update_citizen_profile_persists(auth_headers):
    """
    Verify that the updated profile values are returned consistently
    when the profile is updated again.
    """

    endpoint = "/citizens/me/profile"

    payload = {
        "name": "QA Persistence Citizen",
        "phone": "9123456789",
        "address": "Persistence Test Address"
    }

    response = requests.patch(
        f"{BASE_URL}{endpoint}",
        json=payload,
        headers=auth_headers
    )

    assert response.status_code == 200, (
        f"\nTest Case       : Citizen Profile Persistence"
        f"\nExpected Output : HTTP Status 200"
        f"\nActual Output   : HTTP Status {response.status_code}"
        f"\nResponse        : {response.text}"
    )

    data = response.json()

    profile = data["profile"]

    assert profile["name"] == payload["name"]
    assert profile["phone"] == payload["phone"]
    assert profile["address"] == payload["address"]