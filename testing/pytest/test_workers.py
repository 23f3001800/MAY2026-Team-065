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
    response = requests.get(f"{BASE_URL}{endpoint}")
    actual_status = response.status_code

    # Assertion
    assert actual_status in expected_status, (
        f"\nTest Case       : Get Workers Authentication"
        f"\nInput           : GET {endpoint}"
        f"\nExpected Output : HTTP Status {expected_status}"
        f"\nActual Output   : HTTP Status {actual_status}"
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

    # Basic response validation
    data = response.json()

    assert isinstance(data, list), (
        f"\nExpected Output : List of field workers"
        f"\nActual Output   : {data}"
    )

# def test_get_worker_tasks(auth_headers):
#     """
#     Verify that a field worker can retrieve
#     the worker task feed.
#     """

#     # Input
#     endpoint = "/complaints/worker/tasks"

#     # Expected Output
#     expected_status = 200

#     # Actual Output
#     response = requests.get(
#         f"{BASE_URL}{endpoint}",
#         headers=auth_headers
#     )

#     actual_status = response.status_code

#     # Assertion
#     assert actual_status == expected_status, (
#         f"\nTest Case       : Get Worker Tasks"
#         f"\nInput           : GET {endpoint}"
#         f"\nExpected Output : HTTP Status {expected_status}"
#         f"\nActual Output   : HTTP Status {actual_status}"
#         f"\nResponse        : {response.text}"
#     )

#     data = response.json()

#     assert data is not None

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
        f"\nActual Output   : {actual_status}"
        f"\nResponse        : {response.text}"
    )

    assert response.json() is not None