import uuid

import requests


BASE_URL = "http://127.0.0.1:8000"


def test_swagger_available():
    """
    Verify that the Swagger documentation endpoint is available.
    """

    # Input
    endpoint = "/docs"

    # Expected Output
    expected_status = 200

    # Actual Output
    response = requests.get(f"{BASE_URL}{endpoint}")
    actual_status = response.status_code

    # Assertion
    assert actual_status == expected_status, (
        f"\nTest Case       : Swagger Availability"
        f"\nInput           : GET {endpoint}"
        f"\nExpected Output : HTTP Status {expected_status}"
        f"\nActual Output   : HTTP Status {actual_status}"
        f"\nResponse        : {response.text}"
    )


def test_openapi_available():
    """
    Verify that the OpenAPI specification endpoint is available.
    """

    # Input
    endpoint = "/openapi.json"

    # Expected Output
    expected_status = 200

    # Actual Output
    response = requests.get(f"{BASE_URL}{endpoint}")
    actual_status = response.status_code

    # Assertion
    assert actual_status == expected_status, (
        f"\nTest Case       : OpenAPI Availability"
        f"\nInput           : GET {endpoint}"
        f"\nExpected Output : HTTP Status {expected_status}"
        f"\nActual Output   : HTTP Status {actual_status}"
        f"\nResponse        : {response.text}"
    )


def test_register_citizen():
    """
    Verify that a new citizen can register successfully.
    """

    # Input
    endpoint = "/auth/register"

    unique_email = f"pytest_{uuid.uuid4().hex}@test.com"

    payload = {
        "userId": str(uuid.uuid4()),
        "name": "Pytest Citizen",
        "email": unique_email,
        "phone": "9876543210",
        "password": "12345678",
        "role": "citizen",
        "address": "Pytest Test Address",
    }

    # Expected Output
    expected_status = 201

    # Actual Output
    response = requests.post(
        f"{BASE_URL}{endpoint}",
        json=payload,
    )
    actual_status = response.status_code

    # Assertion
    assert actual_status == expected_status, (
        f"\nTest Case       : Register Citizen"
        f"\nInput           : POST {endpoint}"
        f"\nExpected Output : HTTP Status {expected_status}"
        f"\nActual Output   : HTTP Status {actual_status}"
        f"\nResponse        : {response.text}"
    )

    # Response validation
    data = response.json()

    assert data.get("message") == (
        "Citizen registered successfully. You may now log in."
    ), (
        f"\nExpected Message : "
        f"Citizen registered successfully. You may now log in."
        f"\nActual Message   : {data.get('message')}"
    )

    assert data.get("userId"), (
        f"\nExpected userId : Generated user ID"
        f"\nActual userId   : {data.get('userId')}"
    )


def test_register_duplicate_email():
    """
    Verify that registration fails when the email is already registered.
    """

    # Input
    endpoint = "/auth/register"

    payload = {
        "userId": str(uuid.uuid4()),
        "name": "Duplicate User",
        "email": "qa1@test.com",
        "phone": "9876543211",
        "password": "12345678",
        "role": "citizen",
        "address": "Duplicate Test Address",
    }

    # Expected Output
    expected_status = 400

    # Actual Output
    response = requests.post(
        f"{BASE_URL}{endpoint}",
        json=payload,
    )
    actual_status = response.status_code

    # Assertion
    assert actual_status == expected_status, (
        f"\nTest Case       : Register Duplicate Email"
        f"\nInput           : POST {endpoint}"
        f"\nExpected Output : HTTP Status {expected_status}"
        f"\nActual Output   : HTTP Status {actual_status}"
        f"\nResponse        : {response.text}"
    )

    data = response.json()

    assert data.get("detail") == "Email already registered", (
        f"\nExpected Message : Email already registered"
        f"\nActual Message   : {data.get('detail')}"
    )


def test_register_non_citizen_role():
    """
    Verify that public registration does not allow non-citizen roles.
    """

    # Input
    endpoint = "/auth/register"

    payload = {
        "userId": str(uuid.uuid4()),
        "name": "Pytest Worker",
        "email": f"pytest_worker_{uuid.uuid4().hex}@test.com",
        "phone": "9876543212",
        "password": "12345678",
        "role": "field_worker",
        "address": "Test Address",
    }

    # Expected Output
    expected_status = 400

    # Actual Output
    response = requests.post(
        f"{BASE_URL}{endpoint}",
        json=payload,
    )
    actual_status = response.status_code

    # Assertion
    assert actual_status == expected_status, (
        f"\nTest Case       : Register Non-Citizen Role"
        f"\nInput           : POST {endpoint}"
        f"\nExpected Output : HTTP Status {expected_status}"
        f"\nActual Output   : HTTP Status {actual_status}"
        f"\nResponse        : {response.text}"
    )

    data = response.json()

    assert data.get("detail") == (
        "Only citizen registration is currently supported."
    ), (
        f"\nExpected Message : "
        f"Only citizen registration is currently supported."
        f"\nActual Message   : {data.get('detail')}"
    )


def test_register_missing_email():
    """
    Verify that registration fails when email is missing.
    """

    # Input
    endpoint = "/auth/register"

    payload = {
        "userId": str(uuid.uuid4()),
        "name": "Missing Email User",
        "phone": "9876543213",
        "password": "12345678",
        "role": "citizen",
        "address": "Test Address",
    }

    # Expected Output
    expected_status = 422

    # Actual Output
    response = requests.post(
        f"{BASE_URL}{endpoint}",
        json=payload,
    )
    actual_status = response.status_code

    # Assertion
    assert actual_status == expected_status, (
        f"\nTest Case       : Register Missing Email"
        f"\nInput           : POST {endpoint}"
        f"\nExpected Output : HTTP Status {expected_status}"
        f"\nActual Output   : HTTP Status {actual_status}"
        f"\nResponse        : {response.text}"
    )


def test_register_missing_password():
    """
    Verify that registration fails when password is missing.
    """

    # Input
    endpoint = "/auth/register"

    payload = {
        "userId": str(uuid.uuid4()),
        "name": "Missing Password User",
        "email": f"missing_password_{uuid.uuid4().hex}@test.com",
        "phone": "9876543214",
        "role": "citizen",
        "address": "Test Address",
    }

    # Expected Output
    expected_status = 422

    # Actual Output
    response = requests.post(
        f"{BASE_URL}{endpoint}",
        json=payload,
    )
    actual_status = response.status_code

    # Assertion
    assert actual_status == expected_status, (
        f"\nTest Case       : Register Missing Password"
        f"\nInput           : POST {endpoint}"
        f"\nExpected Output : HTTP Status {expected_status}"
        f"\nActual Output   : HTTP Status {actual_status}"
        f"\nResponse        : {response.text}"
    )


def test_register_missing_name():
    """
    Verify that registration fails when name is missing.
    """

    # Input
    endpoint = "/auth/register"

    payload = {
        "userId": str(uuid.uuid4()),
        "email": f"missing_name_{uuid.uuid4().hex}@test.com",
        "phone": "9876543215",
        "password": "12345678",
        "role": "citizen",
        "address": "Test Address",
    }

    # Expected Output
    expected_status = 422

    # Actual Output
    response = requests.post(
        f"{BASE_URL}{endpoint}",
        json=payload,
    )
    actual_status = response.status_code

    # Assertion
    assert actual_status == expected_status, (
        f"\nTest Case       : Register Missing Name"
        f"\nInput           : POST {endpoint}"
        f"\nExpected Output : HTTP Status {expected_status}"
        f"\nActual Output   : {actual_status}"
        f"\nResponse        : {response.text}"
    )


def test_register_missing_phone():
    """
    Verify that registration fails when phone is missing.
    """

    # Input
    endpoint = "/auth/register"

    payload = {
        "userId": str(uuid.uuid4()),
        "name": "Missing Phone User",
        "email": f"missing_phone_{uuid.uuid4().hex}@test.com",
        "password": "12345678",
        "role": "citizen",
        "address": "Test Address",
    }

    # Expected Output
    expected_status = 422

    # Actual Output
    response = requests.post(
        f"{BASE_URL}{endpoint}",
        json=payload,
    )
    actual_status = response.status_code

    # Assertion
    assert actual_status == expected_status, (
        f"\nTest Case       : Register Missing Phone"
        f"\nInput           : POST {endpoint}"
        f"\nExpected Output : HTTP Status {expected_status}"
        f"\nActual Output   : HTTP Status {actual_status}"
        f"\nResponse        : {response.text}"
    )


def test_login_valid_citizen():
    """
    Verify that a valid citizen can log in successfully.
    """

    # Input
    endpoint = "/auth/login"

    payload = {
        "username": "qa1@test.com",
        "password": "12345678",
    }

    # Expected Output
    expected_status = 200

    # Actual Output
    response = requests.post(
        f"{BASE_URL}{endpoint}",
        data=payload,
    )
    actual_status = response.status_code

    # Assertion
    assert actual_status == expected_status, (
        f"\nTest Case       : Valid Citizen Login"
        f"\nInput           : POST {endpoint}"
        f"\nExpected Output : HTTP Status {expected_status}"
        f"\nActual Output   : HTTP Status {actual_status}"
        f"\nResponse        : {response.text}"
    )

    data = response.json()

    assert data.get("access_token"), (
        f"\nExpected access_token : Present"
        f"\nActual access_token   : {data.get('access_token')}"
    )

    assert data.get("token_type") == "bearer", (
        f"\nExpected token_type : bearer"
        f"\nActual token_type   : {data.get('token_type')}"
    )


def test_login_valid_admin():
    """
    Verify that an administrator can log in successfully.
    """

    # Input
    endpoint = "/auth/login"

    payload = {
        "username": "admin@city.gov",
        "password": "admin123",
    }

    # Expected Output
    expected_status = 200

    # Actual Output
    response = requests.post(
        f"{BASE_URL}{endpoint}",
        data=payload,
    )
    actual_status = response.status_code

    # Assertion
    assert actual_status == expected_status, (
        f"\nTest Case       : Valid Admin Login"
        f"\nInput           : POST {endpoint}"
        f"\nExpected Output : HTTP Status {expected_status}"
        f"\nActual Output   : HTTP Status {actual_status}"
        f"\nResponse        : {response.text}"
    )

    data = response.json()

    assert data.get("access_token")
    assert data.get("token_type") == "bearer"


def test_login_valid_field_worker():
    """
    Verify that a valid field worker can log in successfully.
    """

    # Input
    endpoint = "/auth/login"

    payload = {
        "username": "road1@gmail.com",
        "password": "12345678",
    }

    # Expected Output
    expected_status = 200

    # Actual Output
    response = requests.post(
        f"{BASE_URL}{endpoint}",
        data=payload,
    )
    actual_status = response.status_code

    # Assertion
    assert actual_status == expected_status, (
        f"\nTest Case       : Valid Field Worker Login"
        f"\nInput           : POST {endpoint}"
        f"\nExpected Output : HTTP Status {expected_status}"
        f"\nActual Output   : HTTP Status {actual_status}"
        f"\nResponse        : {response.text}"
    )

    data = response.json()

    assert data.get("access_token")
    assert data.get("token_type") == "bearer"


def test_login_wrong_password():
    """
    Verify that login fails when the password is incorrect.
    """

    # Input
    endpoint = "/auth/login"

    payload = {
        "username": "qa1@test.com",
        "password": "Wrong12345678",
    }

    # Expected Output
    expected_status = 401

    # Actual Output
    response = requests.post(
        f"{BASE_URL}{endpoint}",
        data=payload,
    )
    actual_status = response.status_code

    # Assertion
    assert actual_status == expected_status, (
        f"\nTest Case       : Login Wrong Password"
        f"\nInput           : POST {endpoint}"
        f"\nExpected Output : HTTP Status {expected_status}"
        f"\nActual Output   : HTTP Status {actual_status}"
        f"\nResponse        : {response.text}"
    )

    assert response.json().get("detail") == "Incorrect email or password"


def test_login_wrong_email():
    """
    Verify that login fails for a non-existent email.
    """

    # Input
    endpoint = "/auth/login"

    payload = {
        "username": "does_not_exist@test.com",
        "password": "12345678",
    }

    # Expected Output
    expected_status = 401

    # Actual Output
    response = requests.post(
        f"{BASE_URL}{endpoint}",
        data=payload,
    )
    actual_status = response.status_code

    # Assertion
    assert actual_status == expected_status, (
        f"\nTest Case       : Login Wrong Email"
        f"\nInput           : POST {endpoint}"
        f"\nExpected Output : HTTP Status {expected_status}"
        f"\nActual Output   : HTTP Status {actual_status}"
        f"\nResponse        : {response.text}"
    )

    assert response.json().get("detail") == "Incorrect email or password"


def test_login_missing_username():
    """
    Verify that login fails when username is missing.
    """

    # Input
    endpoint = "/auth/login"

    payload = {
        "password": "123",
    }

    # Expected Output
    expected_status = 422

    # Actual Output
    response = requests.post(
        f"{BASE_URL}{endpoint}",
        data=payload,
    )
    actual_status = response.status_code

    # Assertion
    assert actual_status == expected_status, (
        f"\nTest Case       : Login Missing Username"
        f"\nInput           : POST {endpoint}"
        f"\nExpected Output : HTTP Status {expected_status}"
        f"\nActual Output   : HTTP Status {actual_status}"
        f"\nResponse        : {response.text}"
    )


def test_login_missing_password():
    """
    Verify that login fails when password is missing.
    """

    # Input
    endpoint = "/auth/login"

    payload = {
        "username": "qa1@test.com",
    }

    # Expected Output
    expected_status = 422

    # Actual Output
    response = requests.post(
        f"{BASE_URL}{endpoint}",
        data=payload,
    )
    actual_status = response.status_code

    # Assertion
    assert actual_status == expected_status, (
        f"\nTest Case       : Login Missing Password"
        f"\nInput           : POST {endpoint}"
        f"\nExpected Output : HTTP Status {expected_status}"
        f"\nActual Output   : HTTP Status {actual_status}"
        f"\nResponse        : {response.text}"
    )


def test_login_empty_credentials():
    """
    Verify that login fails when both credentials are empty.
    """

    # Input
    endpoint = "/auth/login"

    payload = {
        "username": "",
        "password": "",
    }

    # Expected Output
    expected_status = 422

    # Actual Output
    response = requests.post(
        f"{BASE_URL}{endpoint}",
        data=payload,
    )
    actual_status = response.status_code

    # Assertion
    assert actual_status == expected_status, (
        f"\nTest Case       : Login Empty Credentials"
        f"\nInput           : POST {endpoint}"
        f"\nExpected Output : HTTP Status {expected_status}"
        f"\nActual Output   : HTTP Status {actual_status}"
        f"\nResponse        : {response.text}"
    )


def test_protected_endpoint_without_authentication():
    """
    Verify that a protected endpoint cannot be accessed
    without authentication.
    """

    # Input
    endpoint = "/complaints"

    # Expected Output
    expected_status = [401, 403]

    # Actual Output
    response = requests.get(f"{BASE_URL}{endpoint}")
    actual_status = response.status_code

    # Assertion
    assert actual_status in expected_status, (
        f"\nTest Case       : Protected Endpoint Without Authentication"
        f"\nInput           : GET {endpoint}"
        f"\nExpected Output : HTTP Status {expected_status}"
        f"\nActual Output   : HTTP Status {actual_status}"
        f"\nResponse        : {response.text}"
    )


def test_protected_endpoint_with_invalid_token():
    """
    Verify that a protected endpoint rejects an invalid JWT.
    """

    # Input
    endpoint = "/complaints"

    headers = {
        "Authorization": "Bearer invalid.jwt.token"
    }

    # Expected Output
    expected_status = [401, 403]

    # Actual Output
    response = requests.get(
        f"{BASE_URL}{endpoint}",
        headers=headers,
    )
    actual_status = response.status_code

    # Assertion
    assert actual_status in expected_status, (
        f"\nTest Case       : Protected Endpoint Invalid Token"
        f"\nInput           : GET {endpoint}"
        f"\nExpected Output : {expected_status}"
        f"\nActual Output   : {actual_status}"
        f"\nResponse        : {response.text}"
    )


def test_protected_endpoint_malformed_authorization_header():
    """
    Verify that a protected endpoint rejects a malformed
    Authorization header.
    """

    # Input
    endpoint = "/complaints"

    headers = {
        "Authorization": "InvalidToken"
    }

    # Expected Output
    expected_status = [401, 403]

    # Actual Output
    response = requests.get(
        f"{BASE_URL}{endpoint}",
        headers=headers,
    )
    actual_status = response.status_code

    # Assertion
    assert actual_status in expected_status, (
        f"\nTest Case       : Malformed Authorization Header"
        f"\nInput           : GET {endpoint}"
        f"\nExpected Output : {expected_status}"
        f"\nActual Output   : HTTP Status {actual_status}"
        f"\nResponse        : {response.text}"
    )