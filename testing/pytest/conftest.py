import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

# -------------------------------------------------------------------
# Add backend folder to Python path
# -------------------------------------------------------------------
BACKEND_DIR = Path(__file__).resolve().parents[2] / "backend"

if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

# Import FastAPI app
from main import app

# Shared Test Client
client = TestClient(app)


# -------------------------------------------------------------------
# Shared API Client
# -------------------------------------------------------------------
@pytest.fixture(scope="session")
def api_client():
    return client


# -------------------------------------------------------------------
# Test Citizen Data
# -------------------------------------------------------------------
@pytest.fixture(scope="session")
def citizen_data():
    return {
        "name": "QA Test Citizen",
        "email": "qa_citizen@test.com",
        "phone": "9876543210",
        "password": "Password123",
        "address": "Jamshedpur",
        "role": "citizen"
    }


# -------------------------------------------------------------------
# Login Credentials
# -------------------------------------------------------------------
@pytest.fixture(scope="session")
def login_data():
    return {
        "username": "qa_citizen@test.com",
        "password": "Password123"
    }


# -------------------------------------------------------------------
# JWT Authentication Token
# -------------------------------------------------------------------
@pytest.fixture(scope="session")
def auth_token(api_client, citizen_data, login_data):

    # Register user (ignore if already exists)
    api_client.post(
        "/auth/register",
        json=citizen_data
    )

    # Login
    response = api_client.post(
        "/auth/login",
        data=login_data
    )

    assert response.status_code == 200, (
        f"Login failed: {response.text}"
    )

    token = response.json()["access_token"]

    return token


# -------------------------------------------------------------------
# Authorization Header
# -------------------------------------------------------------------
@pytest.fixture(scope="session")
def auth_headers(auth_token):
    return {
        "Authorization": f"Bearer {auth_token}"
    }