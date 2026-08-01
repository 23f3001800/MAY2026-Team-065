import uuid

def test_register_success(api_client):

    unique_email = f"qa_{uuid.uuid4().hex[:8]}@test.com"

    payload = {
        "name": "QA Citizen",
        "email": unique_email,
        "phone": "9876543210",
        "password": "Password123",
        "address": "Jamshedpur",
        "role": "citizen"
    }

    response = api_client.post(
        "/auth/register",
        json=payload
    )

    assert response.status_code == 201

    body = response.json()

    assert "message" in body
    assert "userId" in body


def test_register_duplicate_email(api_client):

    payload = {
        "name": "Duplicate User",
        "email": "duplicate@test.com",
        "phone": "9876543210",
        "password": "Password123",
        "address": "Jamshedpur",
        "role": "citizen"
    }

    api_client.post(
        "/auth/register",
        json=payload
    )

    response = api_client.post(
        "/auth/register",
        json=payload
    )

    assert response.status_code == 400

    assert response.json()["detail"] == "Email already registered"


def test_login_success(api_client):

    unique_email = f"login_{uuid.uuid4().hex[:8]}@test.com"

    register_payload = {
        "name": "Login User",
        "email": unique_email,
        "phone": "9876543210",
        "password": "Password123",
        "address": "Jamshedpur",
        "role": "citizen"
    }

    api_client.post(
        "/auth/register",
        json=register_payload
    )

    response = api_client.post(
        "/auth/login",
        data={
            "username": unique_email,
            "password": "Password123"
        }
    )

    assert response.status_code == 200

    token = response.json()

    assert "access_token" in token
    assert token["token_type"] == "bearer"


def test_login_wrong_password(api_client):

    response = api_client.post(
        "/auth/login",
        data={
            "username": "random@test.com",
            "password": "wrongpassword"
        }
    )

    assert response.status_code == 401


def test_login_invalid_email(api_client):

    response = api_client.post(
        "/auth/login",
        data={
            "username": "invalid@test.com",
            "password": "Password123"
        }
    )

    assert response.status_code == 401


def test_register_missing_fields(api_client):

    payload = {
        "name": "Test User"
    }

    response = api_client.post(
        "/auth/register",
        json=payload
    )

    assert response.status_code == 422