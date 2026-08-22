import uuid
import requests


BASE_URL = "http://127.0.0.1:8000"


def valid_payload():
    """
    Return a valid payload for creating a municipal officer.
    A unique email is generated so successful tests can be
    executed repeatedly without duplicate-email conflicts.
    """
    unique_id = uuid.uuid4().hex[:8]

    return {
        "name": f"Test Official {unique_id}",
        "email": f"official_{unique_id}@test.com",
        "phone": "9876543201",
        "password": "Official123",
        "role": "municipal_officer",
        "department": "Sanitation",
        "designation": "General Officer",
        "skills": [
            "Complaint Management"
        ]
    }


def test_create_official_valid(admin_auth_headers):
    """
    Verify that an administrator can successfully create
    a municipal officer.
    """

    endpoint = "/admin/users/official"
    payload = valid_payload()

    response = requests.post(
        f"{BASE_URL}{endpoint}",
        json=payload,
        headers=admin_auth_headers
    )

    assert response.status_code == 201, (
        f"\nTest Case       : Create System Official - Valid Request"
        f"\nExpected Output : HTTP Status 201"
        f"\nActual Output   : HTTP Status {response.status_code}"
        f"\nResponse        : {response.text}"
    )

    assert response.headers["content-type"].startswith("application/json")

    data = response.json()

    assert isinstance(data, dict)
    assert "message" in data
    assert "userId" in data
    assert isinstance(data["message"], str)
    assert isinstance(data["userId"], str)
    assert data["userId"] != ""


def test_create_official_requires_auth():
    """
    Verify that authentication is required.
    """

    endpoint = "/admin/users/official"

    response = requests.post(
        f"{BASE_URL}{endpoint}",
        json=valid_payload()
    )

    assert response.status_code in [401, 403], (
        f"\nTest Case       : Create System Official - Authentication"
        f"\nExpected Output : HTTP Status [401, 403]"
        f"\nActual Output   : HTTP Status {response.status_code}"
        f"\nResponse        : {response.text}"
    )


def test_create_official_invalid_token():
    """
    Verify that an invalid token is rejected.
    """

    endpoint = "/admin/users/official"

    headers = {
        "Authorization": "Bearer invalid-token"
    }

    response = requests.post(
        f"{BASE_URL}{endpoint}",
        json=valid_payload(),
        headers=headers
    )

    assert response.status_code in [401, 403], (
        f"\nTest Case       : Create System Official - Invalid Token"
        f"\nExpected Output : HTTP Status [401, 403]"
        f"\nActual Output   : HTTP Status {response.status_code}"
        f"\nResponse        : {response.text}"
    )


def test_create_official_citizen_denied(auth_headers):
    """
    Verify that a citizen cannot create a system official.
    """

    endpoint = "/admin/users/official"

    response = requests.post(
        f"{BASE_URL}{endpoint}",
        json=valid_payload(),
        headers=auth_headers
    )

    assert response.status_code == 403, (
        f"\nTest Case       : Create System Official - Citizen Denied"
        f"\nExpected Output : HTTP Status 403"
        f"\nActual Output   : HTTP Status {response.status_code}"
        f"\nResponse        : {response.text}"
    )


def test_create_official_missing_name(admin_auth_headers):
    """
    Verify that name is required.
    """

    endpoint = "/admin/users/official"
    payload = valid_payload()
    payload.pop("name")

    response = requests.post(
        f"{BASE_URL}{endpoint}",
        json=payload,
        headers=admin_auth_headers
    )

    assert response.status_code == 422, (
        f"\nTest Case       : Missing Name"
        f"\nExpected Output : HTTP Status 422"
        f"\nActual Output   : HTTP Status {response.status_code}"
        f"\nResponse        : {response.text}"
    )


def test_create_official_missing_email(admin_auth_headers):
    """
    Verify that email is required.
    """

    endpoint = "/admin/users/official"
    payload = valid_payload()
    payload.pop("email")

    response = requests.post(
        f"{BASE_URL}{endpoint}",
        json=payload,
        headers=admin_auth_headers
    )

    assert response.status_code == 422, (
        f"\nTest Case       : Missing Email"
        f"\nExpected Output : HTTP Status 422"
        f"\nActual Output   : HTTP Status {response.status_code}"
        f"\nResponse        : {response.text}"
    )


def test_create_official_missing_phone(admin_auth_headers):
    """
    Verify that phone is required.
    """

    endpoint = "/admin/users/official"
    payload = valid_payload()
    payload.pop("phone")

    response = requests.post(
        f"{BASE_URL}{endpoint}",
        json=payload,
        headers=admin_auth_headers
    )

    assert response.status_code == 422, (
        f"\nTest Case       : Missing Phone"
        f"\nExpected Output : HTTP Status 422"
        f"\nActual Output   : HTTP Status {response.status_code}"
        f"\nResponse        : {response.text}"
    )


def test_create_official_missing_password(admin_auth_headers):
    """
    Verify that password is required.
    """

    endpoint = "/admin/users/official"
    payload = valid_payload()
    payload.pop("password")

    response = requests.post(
        f"{BASE_URL}{endpoint}",
        json=payload,
        headers=admin_auth_headers
    )

    assert response.status_code == 422, (
        f"\nTest Case       : Missing Password"
        f"\nExpected Output : HTTP Status 422"
        f"\nActual Output   : HTTP Status {response.status_code}"
        f"\nResponse        : {response.text}"
    )


def test_create_official_missing_role(admin_auth_headers):
    """
    Verify that role is required.
    """

    endpoint = "/admin/users/official"
    payload = valid_payload()
    payload.pop("role")

    response = requests.post(
        f"{BASE_URL}{endpoint}",
        json=payload,
        headers=admin_auth_headers
    )

    assert response.status_code == 422, (
        f"\nTest Case       : Missing Role"
        f"\nExpected Output : HTTP Status 422"
        f"\nActual Output   : HTTP Status {response.status_code}"
        f"\nResponse        : {response.text}"
    )


def test_create_official_invalid_role(admin_auth_headers):
    """
    Verify that an unsupported role is rejected.
    """

    endpoint = "/admin/users/official"
    payload = valid_payload()
    payload["role"] = "invalid_role"

    response = requests.post(
        f"{BASE_URL}{endpoint}",
        json=payload,
        headers=admin_auth_headers
    )

    assert response.status_code == 400, (
        f"\nTest Case       : Invalid Role"
        f"\nInput           : role={payload['role']}"
        f"\nExpected Output : HTTP Status 400"
        f"\nActual Output   : HTTP Status {response.status_code}"
        f"\nResponse        : {response.text}"
    )


def test_create_official_field_worker_role_rejected(admin_auth_headers):
    """
    Verify that field_worker cannot be created through
    the system official endpoint.
    """

    endpoint = "/admin/users/official"
    payload = valid_payload()
    payload["role"] = "field_worker"

    response = requests.post(
        f"{BASE_URL}{endpoint}",
        json=payload,
        headers=admin_auth_headers
    )

    assert response.status_code == 400, (
        f"\nTest Case       : Field Worker Role Rejected"
        f"\nExpected Output : HTTP Status 400"
        f"\nActual Output   : HTTP Status {response.status_code}"
        f"\nResponse        : {response.text}"
    )


def test_create_official_duplicate_email(admin_auth_headers):
    """
    Verify that an already registered email is rejected.

    official2@test.com was already created manually while
    validating the endpoint.
    """

    endpoint = "/admin/users/official"

    payload = {
        "name": "Duplicate Official Test",
        "email": "official2@test.com",
        "phone": "9876543202",
        "password": "Official123",
        "role": "municipal_officer",
        "department": "Sanitation",
        "designation": "General Officer",
        "skills": [
            "Complaint Management"
        ]
    }

    response = requests.post(
        f"{BASE_URL}{endpoint}",
        json=payload,
        headers=admin_auth_headers
    )

    assert response.status_code == 400, (
        f"\nTest Case       : Duplicate Email"
        f"\nExpected Output : HTTP Status 400"
        f"\nActual Output   : HTTP Status {response.status_code}"
        f"\nResponse        : {response.text}"
    )

    data = response.json()

    assert data.get("detail") == "Email already registered.", (
        f"\nExpected Message : Email already registered."
        f"\nActual Message   : {data.get('detail')}"
    )


def test_create_official_null_required_fields(admin_auth_headers):
    """
    Verify that null required fields are rejected.
    """

    endpoint = "/admin/users/official"

    payload = {
        "name": None,
        "email": None,
        "phone": None,
        "password": None,
        "role": None
    }

    response = requests.post(
        f"{BASE_URL}{endpoint}",
        json=payload,
        headers=admin_auth_headers
    )

    assert response.status_code == 422, (
        f"\nTest Case       : Null Required Fields"
        f"\nExpected Output : HTTP Status 422"
        f"\nActual Output   : HTTP Status {response.status_code}"
        f"\nResponse        : {response.text}"
    )


def test_create_official_malformed_body(admin_auth_headers):
    """
    Verify that malformed JSON is rejected.
    """

    endpoint = "/admin/users/official"

    response = requests.post(
        f"{BASE_URL}{endpoint}",
        data="this is not valid json",
        headers={
            **admin_auth_headers,
            "Content-Type": "application/json"
        }
    )

    assert response.status_code == 422, (
        f"\nTest Case       : Malformed Body"
        f"\nExpected Output : HTTP Status 422"
        f"\nActual Output   : HTTP Status {response.status_code}"
        f"\nResponse        : {response.text}"
    )


def test_create_official_response_content_type(admin_auth_headers):
    """
    Verify that a successful creation returns JSON.
    """

    endpoint = "/admin/users/official"
    payload = valid_payload()

    response = requests.post(
        f"{BASE_URL}{endpoint}",
        json=payload,
        headers=admin_auth_headers
    )

    assert response.status_code == 201, (
        f"\nTest Case       : Response Content Type"
        f"\nExpected Output : HTTP Status 201"
        f"\nActual Output   : HTTP Status {response.status_code}"
        f"\nResponse        : {response.text}"
    )

    assert response.headers["content-type"].startswith(
        "application/json"
    )

    data = response.json()

    assert isinstance(data, dict)
    assert "message" in data
    assert "userId" in data


def test_create_official_repeated_unique_requests(admin_auth_headers):
    """
    Verify that multiple unique requests can create
    separate municipal officers.
    """

    endpoint = "/admin/users/official"

    for index in range(2):

        unique_id = uuid.uuid4().hex[:8]

        payload = {
            "name": f"Repeated Official {unique_id}",
            "email": f"repeated_official_{unique_id}@test.com",
            "phone": f"98765432{10 + index}",
            "password": "Official123",
            "role": "municipal_officer",
            "department": "Sanitation",
            "designation": "General Officer",
            "skills": [
                "Complaint Management"
            ]
        }

        response = requests.post(
            f"{BASE_URL}{endpoint}",
            json=payload,
            headers=admin_auth_headers
        )

        assert response.status_code == 201, (
            f"\nTest Case       : Repeated Unique Request {index + 1}"
            f"\nExpected Output : HTTP Status 201"
            f"\nActual Output   : HTTP Status {response.status_code}"
            f"\nResponse        : {response.text}"
        )

        data = response.json()

        assert "message" in data
        assert "userId" in data
        assert data["userId"]