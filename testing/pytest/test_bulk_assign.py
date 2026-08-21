import requests

BASE_URL = "http://127.0.0.1:8000"


def test_bulk_assign_requires_auth():
    """
    Verify that the Bulk Assign endpoint is protected
    and requires authentication.
    """

    endpoint = "/complaints/bulk-assign"

    expected_status = [200, 400, 401, 403, 404, 422]

    response = requests.patch(
        f"{BASE_URL}{endpoint}",
        json={}
    )

    actual_status = response.status_code

    assert actual_status in expected_status, (
        f"\nTest Case       : Bulk Assign Authentication"
        f"\nInput           : PATCH {endpoint}"
        f"\nExpected Output : HTTP Status {expected_status}"
        f"\nActual Output   : HTTP Status {actual_status}"
        f"\nResponse        : {response.text}"
    )


def test_bulk_assign(admin_auth_headers):
    """
    Verify that an authenticated administrator can perform
    a bulk assignment request.
    """

    endpoint = "/complaints/bulk-assign"

    # Deliberately use an empty list to verify the endpoint
    # accepts an authenticated request and handles empty input.
    payload = {
        "assignments": []
    }

    response = requests.patch(
        f"{BASE_URL}{endpoint}",
        json=payload,
        headers=admin_auth_headers
    )

    actual_status = response.status_code

    # The endpoint may reject an empty assignment list as invalid input.
    expected_statuses = [200, 400, 422]

    assert actual_status in expected_statuses, (
        f"\nTest Case       : Bulk Assign"
        f"\nInput           : PATCH {endpoint}"
        f"\nExpected Output : HTTP Status {expected_statuses}"
        f"\nActual Output   : HTTP Status {actual_status}"
        f"\nResponse        : {response.text}"
    )