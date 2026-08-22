import pytest
import requests

BASE_URL = "http://127.0.0.1:8000"

USERNAME = "qa1@test.com"
PASSWORD = "12345678"


@pytest.fixture(scope="session")
def auth_token():
    """
    Login once and return the JWT access token.
    """

    response = requests.post(
        f"{BASE_URL}/auth/login",
        data={
            "username": USERNAME,
            "password": PASSWORD,
        },
    )

    assert response.status_code == 200, (
        f"Login failed.\n"
        f"Expected: 200\n"
        f"Actual: {response.status_code}\n"
        f"Response: {response.text}"
    )

    return response.json()["access_token"]


@pytest.fixture(scope="session")
def auth_headers(auth_token):
    """
    Return Authorization header for authenticated requests.
    """

    return {
        "Authorization": f"Bearer {auth_token}"
    }

@pytest.fixture(scope="session")
def admin_auth_token():
    response = requests.post(
        f"{BASE_URL}/auth/login",
        data={
            "username": "admin@city.gov",
            "password": "admin123",
        },
    )

    assert response.status_code == 200, (
        f"\nAdmin Login Failed"
        f"\nExpected Output : HTTP Status 200"
        f"\nActual Output   : HTTP Status {response.status_code}"
        f"\nResponse        : {response.text}"
    )

    return response.json()["access_token"]


@pytest.fixture(scope="session")
def admin_auth_headers(admin_auth_token):
    return {
        "Authorization": f"Bearer {admin_auth_token}"
    }
@pytest.fixture(scope="session")
def field_worker_auth_token():
    response = requests.post(
        f"{BASE_URL}/auth/login",
        data={
            "username": "road1@gmail.com",
            "password": "12345678",
        },
    )

    assert response.status_code == 200, (
        f"\nField Worker Login Failed"
        f"\nExpected Output : HTTP Status 200"
        f"\nActual Output   : HTTP Status {response.status_code}"
        f"\nResponse        : {response.text}"
    )

    return response.json()["access_token"]


@pytest.fixture(scope="session")
def field_worker_auth_headers(field_worker_auth_token):
    return {
        "Authorization": f"Bearer {field_worker_auth_token}"
    }