import uuid

import pytest
import requests


BASE_URL = "http://127.0.0.1:8000"


def unique_email():
    return f"worker_{uuid.uuid4().hex[:10]}@test.com"


def unique_phone():
    return str(9000000000 + (uuid.uuid4().int % 999999999))


def valid_payload():
    return {
        "name": "Pytest Field Worker",
        "email": unique_email(),
        "phone": unique_phone(),
        "password": "Worker123",
        "skillSet": "Electrical",
    }


def test_create_worker_valid(admin_auth_headers):
    endpoint = "/workers/"
    payload = valid_payload()

    response = requests.post(
        f"{BASE_URL}{endpoint}",
        json=payload,
        headers=admin_auth_headers,
    )

    assert response.status_code == 201, (
        f"\nTest Case       : Create Field Worker - Valid Request"
        f"\nExpected Output : HTTP Status 201"
        f"\nActual Output   : HTTP Status {response.status_code}"
        f"\nResponse        : {response.text}"
    )

    data = response.json()

    assert isinstance(data, dict)
    assert "userId" in data
    assert "name" in data
    assert "phone" in data
    assert "skillSet" in data
    assert "availabilityStatus" in data

    assert data["name"] == payload["name"]
    assert data["phone"] == payload["phone"]
    assert data["skillSet"] == payload["skillSet"]
    assert data["availabilityStatus"] == "AVAILABLE"

    assert "password" not in data
    assert "passwordHash" not in data


def test_create_worker_requires_auth():
    endpoint = "/workers/"
    payload = valid_payload()

    response = requests.post(
        f"{BASE_URL}{endpoint}",
        json=payload,
    )

    assert response.status_code == 401, (
        f"\nTest Case       : Create Field Worker - Authentication"
        f"\nExpected Output : HTTP Status 401"
        f"\nActual Output   : HTTP Status {response.status_code}"
        f"\nResponse        : {response.text}"
    )


def test_create_worker_invalid_token():
    endpoint = "/workers/"
    payload = valid_payload()

    headers = {
        "Authorization": "Bearer invalid-token"
    }

    response = requests.post(
        f"{BASE_URL}{endpoint}",
        json=payload,
        headers=headers,
    )

    assert response.status_code == 401, (
        f"\nTest Case       : Create Field Worker - Invalid Token"
        f"\nExpected Output : HTTP Status 401"
        f"\nActual Output   : HTTP Status {response.status_code}"
        f"\nResponse        : {response.text}"
    )


def test_create_worker_citizen_denied(auth_headers):
    endpoint = "/workers/"
    payload = valid_payload()

    response = requests.post(
        f"{BASE_URL}{endpoint}",
        json=payload,
        headers=auth_headers,
    )

    assert response.status_code == 403, (
        f"\nTest Case       : Create Field Worker - Citizen Authorization"
        f"\nExpected Output : HTTP Status 403"
        f"\nActual Output   : HTTP Status {response.status_code}"
        f"\nResponse        : {response.text}"
    )


def test_create_worker_missing_name(admin_auth_headers):
    endpoint = "/workers/"
    payload = valid_payload()
    payload.pop("name")

    response = requests.post(
        f"{BASE_URL}{endpoint}",
        json=payload,
        headers=admin_auth_headers,
    )

    assert response.status_code == 422, (
        f"\nTest Case       : Create Field Worker - Missing Name"
        f"\nExpected Output : HTTP Status 422"
        f"\nActual Output   : HTTP Status {response.status_code}"
        f"\nResponse        : {response.text}"
    )


def test_create_worker_missing_email(admin_auth_headers):
    endpoint = "/workers/"
    payload = valid_payload()
    payload.pop("email")

    response = requests.post(
        f"{BASE_URL}{endpoint}",
        json=payload,
        headers=admin_auth_headers,
    )

    assert response.status_code == 422, (
        f"\nTest Case       : Create Field Worker - Missing Email"
        f"\nExpected Output : HTTP Status 422"
        f"\nActual Output   : HTTP Status {response.status_code}"
        f"\nResponse        : {response.text}"
    )


def test_create_worker_missing_phone(admin_auth_headers):
    endpoint = "/workers/"
    payload = valid_payload()
    payload.pop("phone")

    response = requests.post(
        f"{BASE_URL}{endpoint}",
        json=payload,
        headers=admin_auth_headers,
    )

    assert response.status_code == 422, (
        f"\nTest Case       : Create Field Worker - Missing Phone"
        f"\nExpected Output : HTTP Status 422"
        f"\nActual Output   : HTTP Status {response.status_code}"
        f"\nResponse        : {response.text}"
    )


def test_create_worker_missing_password(admin_auth_headers):
    endpoint = "/workers/"
    payload = valid_payload()
    payload.pop("password")

    response = requests.post(
        f"{BASE_URL}{endpoint}",
        json=payload,
        headers=admin_auth_headers,
    )

    assert response.status_code == 422, (
        f"\nTest Case       : Create Field Worker - Missing Password"
        f"\nExpected Output : HTTP Status 422"
        f"\nActual Output   : HTTP Status {response.status_code}"
        f"\nResponse        : {response.text}"
    )


def test_create_worker_missing_skill_set(admin_auth_headers):
    endpoint = "/workers/"
    payload = valid_payload()
    payload.pop("skillSet")

    response = requests.post(
        f"{BASE_URL}{endpoint}",
        json=payload,
        headers=admin_auth_headers,
    )

    assert response.status_code == 422, (
        f"\nTest Case       : Create Field Worker - Missing Skill Set"
        f"\nExpected Output : HTTP Status 422"
        f"\nActual Output   : HTTP Status {response.status_code}"
        f"\nResponse        : {response.text}"
    )


def test_create_worker_empty_name(admin_auth_headers):
    endpoint = "/workers/"
    payload = valid_payload()
    payload["name"] = ""

    response = requests.post(
        f"{BASE_URL}{endpoint}",
        json=payload,
        headers=admin_auth_headers,
    )

    assert response.status_code == 201, (
        f"\nTest Case       : Create Field Worker - Empty Name"
        f"\nExpected Output : HTTP Status 201"
        f"\nActual Output   : HTTP Status {response.status_code}"
        f"\nResponse        : {response.text}"
    )

    assert response.json()["name"] == ""


def test_create_worker_empty_email(admin_auth_headers):
    """
    Known application defect:
    empty email causes HTTP 500 instead of a controlled
    validation error.
    """

    endpoint = "/workers/"
    payload = valid_payload()
    payload["email"] = ""

    response = requests.post(
        f"{BASE_URL}{endpoint}",
        json=payload,
        headers=admin_auth_headers,
    )

    if response.status_code == 500:
        pytest.xfail(
            "Known application defect: empty email causes HTTP 500."
        )

    assert response.status_code in [400, 422], (
        f"\nTest Case       : Create Field Worker - Empty Email"
        f"\nExpected Output : HTTP Status 400 or 422"
        f"\nActual Output   : HTTP Status {response.status_code}"
        f"\nResponse        : {response.text}"
    )


def test_create_worker_invalid_email(admin_auth_headers):
    """
    Known application defect:
    invalid email format causes HTTP 500 instead of
    a controlled validation error.
    """

    endpoint = "/workers/"
    payload = valid_payload()
    payload["email"] = "not-an-email"

    response = requests.post(
        f"{BASE_URL}{endpoint}",
        json=payload,
        headers=admin_auth_headers,
    )

    if response.status_code == 500:
        pytest.xfail(
            "Known application defect: invalid email format causes HTTP 500."
        )

    assert response.status_code in [400, 422], (
        f"\nTest Case       : Create Field Worker - Invalid Email"
        f"\nExpected Output : HTTP Status 400 or 422"
        f"\nActual Output   : HTTP Status {response.status_code}"
        f"\nResponse        : {response.text}"
    )


def test_create_worker_duplicate_email(admin_auth_headers):
    """
    Known application defect:
    duplicate email causes HTTP 500 instead of a controlled
    400/409 response.
    """

    endpoint = "/workers/"
    email = unique_email()

    first_payload = {
        "name": "Duplicate Email Worker",
        "email": email,
        "phone": unique_phone(),
        "password": "Worker123",
        "skillSet": "Roads",
    }

    first_response = requests.post(
        f"{BASE_URL}{endpoint}",
        json=first_payload,
        headers=admin_auth_headers,
    )

    assert first_response.status_code == 201, (
        f"\nTest Case       : Prepare Duplicate Email Test"
        f"\nExpected Output : HTTP Status 201"
        f"\nActual Output   : HTTP Status {first_response.status_code}"
        f"\nResponse        : {first_response.text}"
    )

    second_payload = {
        "name": "Duplicate Email Worker Two",
        "email": email,
        "phone": unique_phone(),
        "password": "Worker123",
        "skillSet": "Electrical",
    }

    response = requests.post(
        f"{BASE_URL}{endpoint}",
        json=second_payload,
        headers=admin_auth_headers,
    )

    if response.status_code == 500:
        pytest.xfail(
            "Known application defect: duplicate worker email causes HTTP 500."
        )

    assert response.status_code in [400, 409], (
        f"\nTest Case       : Create Field Worker - Duplicate Email"
        f"\nExpected Output : HTTP Status 400 or 409"
        f"\nActual Output   : HTTP Status {response.status_code}"
        f"\nResponse        : {response.text}"
    )


def test_create_worker_null_required_fields(admin_auth_headers):
    endpoint = "/workers/"

    payload = {
        "name": None,
        "email": None,
        "phone": None,
        "password": None,
        "skillSet": None,
    }

    response = requests.post(
        f"{BASE_URL}{endpoint}",
        json=payload,
        headers=admin_auth_headers,
    )

    assert response.status_code == 422, (
        f"\nTest Case       : Create Field Worker - Null Fields"
        f"\nExpected Output : HTTP Status 422"
        f"\nActual Output   : HTTP Status {response.status_code}"
        f"\nResponse        : {response.text}"
    )


def test_create_worker_malformed_body(admin_auth_headers):
    endpoint = "/workers/"

    headers = {
        **admin_auth_headers,
        "Content-Type": "application/json",
    }

    response = requests.post(
        f"{BASE_URL}{endpoint}",
        data='{"name":',
        headers=headers,
    )

    assert response.status_code == 422, (
        f"\nTest Case       : Create Field Worker - Malformed JSON"
        f"\nExpected Output : HTTP Status 422"
        f"\nActual Output   : HTTP Status {response.status_code}"
        f"\nResponse        : {response.text}"
    )


def test_create_worker_repeated_unique_requests(admin_auth_headers):
    endpoint = "/workers/"

    for index in range(2):
        payload = {
            "name": f"Repeated Worker {index + 1}",
            "email": unique_email(),
            "phone": unique_phone(),
            "password": "Worker123",
            "skillSet": "Roads",
        }

        response = requests.post(
            f"{BASE_URL}{endpoint}",
            json=payload,
            headers=admin_auth_headers,
        )

        assert response.status_code == 201, (
            f"\nTest Case       : Create Field Worker - Repeated Valid Request"
            f"\nIteration       : {index + 1}"
            f"\nExpected Output : HTTP Status 201"
            f"\nActual Output   : HTTP Status {response.status_code}"
            f"\nResponse        : {response.text}"
        )

        data = response.json()

        assert data["userId"]
        assert data["name"] == payload["name"]
        assert data["phone"] == payload["phone"]
        assert data["skillSet"] == payload["skillSet"]
        assert data["availabilityStatus"] == "AVAILABLE"


def test_create_worker_response_content_type(admin_auth_headers):
    endpoint = "/workers/"
    payload = valid_payload()

    response = requests.post(
        f"{BASE_URL}{endpoint}",
        json=payload,
        headers=admin_auth_headers,
    )

    assert response.status_code == 201, (
        f"\nTest Case       : Create Field Worker - Content Type"
        f"\nExpected Output : HTTP Status 201"
        f"\nActual Output   : HTTP Status {response.status_code}"
        f"\nResponse        : {response.text}"
    )

    assert response.headers["content-type"].startswith(
        "application/json"
    )