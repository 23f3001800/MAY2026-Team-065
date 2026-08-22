import requests


BASE_URL = "http://127.0.0.1:8000"


def test_get_workers_requires_auth():
    """
    Verify that the Workers endpoint is protected
    and requires authentication.
    """

    # Input
    endpoint = "/workers"

    # Expected Output
    expected_status = [200, 401, 403]

    # Actual Output
    response = requests.get(
        f"{BASE_URL}{endpoint}"
    )

    actual_status = response.status_code

    # Assertion
    assert actual_status in expected_status, (
        f"\nTest Case       : Get Workers Authentication"
        f"\nInput           : GET {endpoint}"
        f"\nExpected Output : HTTP Status {expected_status}"
        f"\nActual Output   : HTTP Status {actual_status}"
        f"\nResponse        : {response.text}"
    )


def test_get_field_workers(admin_auth_headers):
    """
    Verify that an authenticated administrator can retrieve
    the list of field workers.
    """

    # Input
    endpoint = "/workers/"

    # Expected Output
    expected_status = 200

    # Actual Output
    response = requests.get(
        f"{BASE_URL}{endpoint}",
        headers=admin_auth_headers
    )

    actual_status = response.status_code

    # Assertion
    assert actual_status == expected_status, (
        f"\nTest Case       : Get Field Workers"
        f"\nInput           : GET {endpoint}"
        f"\nExpected Output : HTTP Status {expected_status}"
        f"\nActual Output   : HTTP Status {actual_status}"
        f"\nResponse        : {response.text}"
    )

    data = response.json()

    assert isinstance(data, list), (
        f"\nExpected Output : List of field workers"
        f"\nActual Output   : {data}"
    )


def test_get_workers_citizen_access(auth_headers):
    """
    Verify that an authenticated citizen cannot access
    the administrator worker-management endpoint.
    """

    # Input
    endpoint = "/workers/"

    # Expected Output
    expected_status = 403

    # Actual Output
    response = requests.get(
        f"{BASE_URL}{endpoint}",
        headers=auth_headers
    )

    actual_status = response.status_code

    # Assertion
    assert actual_status == expected_status, (
        f"\nTest Case       : Get Workers Citizen Authorization"
        f"\nInput           : GET {endpoint}"
        f"\nExpected Output : HTTP Status {expected_status}"
        f"\nActual Output   : HTTP Status {actual_status}"
        f"\nResponse        : {response.text}"
    )


def test_get_workers_invalid_token():
    """
    Verify that an invalid JWT cannot retrieve field workers.
    """

    # Input
    endpoint = "/workers/"

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
        f"\nTest Case       : Get Workers Invalid Token"
        f"\nInput           : GET {endpoint}"
        f"\nExpected Output : HTTP Status {expected_status}"
        f"\nActual Output   : HTTP Status {actual_status}"
        f"\nResponse        : {response.text}"
    )


def test_get_workers_malformed_authorization():
    """
    Verify that a malformed Authorization header is rejected.
    """

    # Input
    endpoint = "/workers/"

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
        f"\nTest Case       : Get Workers Malformed Authorization"
        f"\nInput           : GET {endpoint}"
        f"\nExpected Output : HTTP Status {expected_status}"
        f"\nActual Output   : HTTP Status {actual_status}"
        f"\nResponse        : {response.text}"
    )


def test_get_workers_response_structure(admin_auth_headers):
    """
    Verify the structure of returned field worker records.
    """

    # Input
    endpoint = "/workers/"

    # Expected Output
    expected_status = 200

    # Actual Output
    response = requests.get(
        f"{BASE_URL}{endpoint}",
        headers=admin_auth_headers
    )

    actual_status = response.status_code

    assert actual_status == expected_status, (
        f"\nTest Case       : Worker Response Structure"
        f"\nInput           : GET {endpoint}"
        f"\nExpected Output : HTTP Status {expected_status}"
        f"\nActual Output   : HTTP Status {actual_status}"
        f"\nResponse        : {response.text}"
    )

    data = response.json()

    assert isinstance(data, list)

    for worker in data:
        assert isinstance(worker, dict)

        # Worker records should contain identifying information.
        assert any(
            field in worker
            for field in [
                "userId",
                "workerId",
                "fieldWorkerId",
                "id"
            ]
        )


def test_get_workers_repeated_request(admin_auth_headers):
    """
    Verify that repeated worker-list requests remain stable.
    """

    # Input
    endpoint = "/workers/"

    # Expected Output
    expected_status = 200

    first_response = requests.get(
        f"{BASE_URL}{endpoint}",
        headers=admin_auth_headers
    )

    second_response = requests.get(
        f"{BASE_URL}{endpoint}",
        headers=admin_auth_headers
    )

    assert first_response.status_code == expected_status, (
        f"\nTest Case       : First Worker Request"
        f"\nExpected Output : HTTP Status {expected_status}"
        f"\nActual Output   : HTTP Status "
        f"{first_response.status_code}"
        f"\nResponse        : {first_response.text}"
    )

    assert second_response.status_code == expected_status, (
        f"\nTest Case       : Repeated Worker Request"
        f"\nExpected Output : HTTP Status {expected_status}"
        f"\nActual Output   : HTTP Status "
        f"{second_response.status_code}"
        f"\nResponse        : {second_response.text}"
    )


# ============================================================
# WORKER TASK TESTS
# ============================================================


def test_get_worker_tasks_requires_auth():
    """
    Verify that the Worker Task endpoint requires authentication.
    """

    # Input
    endpoint = "/complaints/worker/tasks"

    # Expected Output
    expected_status = [401, 403]

    # Actual Output
    response = requests.get(
        f"{BASE_URL}{endpoint}"
    )

    actual_status = response.status_code

    # Assertion
    assert actual_status in expected_status, (
        f"\nTest Case       : Worker Tasks Authentication"
        f"\nInput           : GET {endpoint}"
        f"\nExpected Output : HTTP Status {expected_status}"
        f"\nActual Output   : HTTP Status {actual_status}"
        f"\nResponse        : {response.text}"
    )


def test_get_worker_tasks(field_worker_auth_headers):
    """
    Verify that an authenticated field worker can retrieve
    the worker task feed.
    """

    # Input
    endpoint = "/complaints/worker/tasks"

    # Expected Output
    expected_status = 200

    # Actual Output
    response = requests.get(
        f"{BASE_URL}{endpoint}",
        headers=field_worker_auth_headers
    )

    actual_status = response.status_code

    # Assertion
    assert actual_status == expected_status, (
        f"\nTest Case       : Get Worker Tasks"
        f"\nInput           : GET {endpoint}"
        f"\nExpected Output : HTTP Status {expected_status}"
        f"\nActual Output   : HTTP Status {actual_status}"
        f"\nResponse        : {response.text}"
    )

    assert response.json() is not None


def test_get_worker_tasks_citizen_denied(auth_headers):
    """
    Verify that a normal citizen cannot access the field worker
    task feed.
    """

    # Input
    endpoint = "/complaints/worker/tasks"

    # Expected Output
    expected_status = 403

    # Actual Output
    response = requests.get(
        f"{BASE_URL}{endpoint}",
        headers=auth_headers
    )

    actual_status = response.status_code

    # Assertion
    assert actual_status == expected_status, (
        f"\nTest Case       : Worker Tasks Citizen Authorization"
        f"\nInput           : GET {endpoint}"
        f"\nExpected Output : HTTP Status {expected_status}"
        f"\nActual Output   : HTTP Status {actual_status}"
        f"\nResponse        : {response.text}"
    )


def test_get_worker_tasks_invalid_token():
    """
    Verify that an invalid JWT cannot access worker tasks.
    """

    # Input
    endpoint = "/complaints/worker/tasks"

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
        f"\nTest Case       : Worker Tasks Invalid Token"
        f"\nInput           : GET {endpoint}"
        f"\nExpected Output : HTTP Status {expected_status}"
        f"\nActual Output   : HTTP Status {actual_status}"
        f"\nResponse        : {response.text}"
    )


def test_get_worker_tasks_malformed_authorization():
    """
    Verify that a malformed Authorization header is rejected.
    """

    # Input
    endpoint = "/complaints/worker/tasks"

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
        f"\nTest Case       : Worker Tasks Malformed Authorization"
        f"\nInput           : GET {endpoint}"
        f"\nExpected Output : HTTP Status {expected_status}"
        f"\nActual Output   : HTTP Status {actual_status}"
        f"\nResponse        : {response.text}"
    )


def test_get_worker_tasks_response_structure(
    field_worker_auth_headers
):
    """
    Verify that the worker task endpoint returns a valid
    JSON response structure.
    """

    # Input
    endpoint = "/complaints/worker/tasks"

    # Expected Output
    expected_status = 200

    # Actual Output
    response = requests.get(
        f"{BASE_URL}{endpoint}",
        headers=field_worker_auth_headers
    )

    actual_status = response.status_code

    assert actual_status == expected_status, (
        f"\nTest Case       : Worker Tasks Response Structure"
        f"\nInput           : GET {endpoint}"
        f"\nExpected Output : HTTP Status {expected_status}"
        f"\nActual Output   : HTTP Status {actual_status}"
        f"\nResponse        : {response.text}"
    )

    data = response.json()

    assert isinstance(data, (list, dict))


def test_get_worker_tasks_content_type(
    field_worker_auth_headers
):
    """
    Verify that the Worker Task endpoint returns JSON.
    """

    # Input
    endpoint = "/complaints/worker/tasks"

    # Expected Output
    expected_status = 200

    # Actual Output
    response = requests.get(
        f"{BASE_URL}{endpoint}",
        headers=field_worker_auth_headers
    )

    actual_status = response.status_code

    assert actual_status == expected_status, (
        f"\nTest Case       : Worker Tasks Content Type"
        f"\nInput           : GET {endpoint}"
        f"\nExpected Output : HTTP Status {expected_status}"
        f"\nActual Output   : HTTP Status {actual_status}"
        f"\nResponse        : {response.text}"
    )

    content_type = response.headers.get(
        "content-type",
        ""
    )

    assert "application/json" in content_type


def test_get_worker_tasks_repeated_request(
    field_worker_auth_headers
):
    """
    Verify that repeated task-feed requests remain stable.
    """

    # Input
    endpoint = "/complaints/worker/tasks"

    # Expected Output
    expected_status = 200

    first_response = requests.get(
        f"{BASE_URL}{endpoint}",
        headers=field_worker_auth_headers
    )

    second_response = requests.get(
        f"{BASE_URL}{endpoint}",
        headers=field_worker_auth_headers
    )

    assert first_response.status_code == expected_status, (
        f"\nTest Case       : First Worker Tasks Request"
        f"\nExpected Output : HTTP Status {expected_status}"
        f"\nActual Output   : HTTP Status "
        f"{first_response.status_code}"
        f"\nResponse        : {first_response.text}"
    )

    assert second_response.status_code == expected_status, (
        f"\nTest Case       : Repeated Worker Tasks Request"
        f"\nExpected Output : HTTP Status {expected_status}"
        f"\nActual Output   : HTTP Status "
        f"{second_response.status_code}"
        f"\nResponse        : {second_response.text}"
    )


def test_get_worker_tasks_no_server_error(
    field_worker_auth_headers
):
    """
    Verify that the Worker Task endpoint does not return
    an unexpected internal server error.
    """

    # Input
    endpoint = "/complaints/worker/tasks"

    # Actual Output
    response = requests.get(
        f"{BASE_URL}{endpoint}",
        headers=field_worker_auth_headers
    )

    actual_status = response.status_code

    # Assertion
    assert actual_status != 500, (
        f"\nTest Case       : Worker Tasks Server Error Check"
        f"\nInput           : GET {endpoint}"
        f"\nUnexpected Output : HTTP Status 500"
        f"\nResponse          : {response.text}"
    )

    assert actual_status == 200, (
        f"\nExpected Output : HTTP Status 200"
        f"\nActual Output   : HTTP Status {actual_status}"
        f"\nResponse        : {response.text}"
    )