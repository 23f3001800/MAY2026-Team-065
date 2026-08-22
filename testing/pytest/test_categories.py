import requests


BASE_URL = "http://127.0.0.1:8000"


def test_get_categories_requires_auth():
    """
    Verify that the Categories endpoint is protected
    and requires authentication.
    """

    # Input
    endpoint = "/categories"

    # Expected Output
    expected_status = [401, 403]

    # Actual Output
    response = requests.get(
        f"{BASE_URL}{endpoint}"
    )

    actual_status = response.status_code

    # Assertion
    assert actual_status in expected_status, (
        f"\nTest Case       : Get Categories Authentication"
        f"\nInput           : GET {endpoint}"
        f"\nExpected Output : HTTP Status {expected_status}"
        f"\nActual Output   : HTTP Status {actual_status}"
        f"\nResponse        : {response.text}"
    )


def test_get_categories(admin_auth_headers):
    """
    Verify that an authenticated administrator can retrieve
    the available complaint categories.
    """

    # Input
    endpoint = "/categories"

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
        f"\nTest Case       : Get Categories"
        f"\nInput           : GET {endpoint}"
        f"\nExpected Output : HTTP Status {expected_status}"
        f"\nActual Output   : HTTP Status {actual_status}"
        f"\nResponse        : {response.text}"
    )

    # Response validation
    assert response.headers.get("content-type", "").startswith(
        "application/json"
    ), (
        f"\nExpected Content-Type : application/json"
        f"\nActual Content-Type   : "
        f"{response.headers.get('content-type')}"
    )

    data = response.json()

    assert isinstance(data, list), (
        f"\nExpected Output : List of categories"
        f"\nActual Output   : {data}"
    )

    assert len(data) > 0, (
        "\nExpected Output : At least one category"
        f"\nActual Output   : {data}"
    )


def test_get_categories_citizen_access(auth_headers):
    """
    Verify that an authenticated citizen can retrieve
    the available complaint categories.
    """

    # Input
    endpoint = "/categories"

    # Expected Output
    expected_status = 200

    # Actual Output
    response = requests.get(
        f"{BASE_URL}{endpoint}",
        headers=auth_headers
    )

    actual_status = response.status_code

    # Assertion
    assert actual_status == expected_status, (
        f"\nTest Case       : Get Categories Citizen Access"
        f"\nInput           : GET {endpoint}"
        f"\nExpected Output : HTTP Status {expected_status}"
        f"\nActual Output   : HTTP Status {actual_status}"
        f"\nResponse        : {response.text}"
    )

    # Response validation
    data = response.json()

    assert isinstance(data, list), (
        f"\nExpected Output : List of categories"
        f"\nActual Output   : {data}"
    )

    assert len(data) > 0, (
        "\nExpected Output : At least one category"
        f"\nActual Output   : {data}"
    )


def test_get_categories_invalid_token():
    """
    Verify that the Categories endpoint rejects an invalid JWT.
    """

    # Input
    endpoint = "/categories"

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
        f"\nTest Case       : Get Categories Invalid Token"
        f"\nInput           : GET {endpoint}"
        f"\nExpected Output : HTTP Status {expected_status}"
        f"\nActual Output   : HTTP Status {actual_status}"
        f"\nResponse        : {response.text}"
    )


def test_recategorize_complaint(admin_auth_headers):
    """
    Verify that an administrator can recategorize
    an existing complaint.

    The test determines the complaint's current category
    and selects a different available category so that
    repeated test execution remains reliable.
    """

    # Input
    complaint_id = "CMP-65C600"
    endpoint = f"/complaints/{complaint_id}/category"

    # ---------------------------------------------------------
    # Step 1: Get the current complaint
    # ---------------------------------------------------------

    complaint_response = requests.get(
        f"{BASE_URL}/complaints/{complaint_id}",
        headers=admin_auth_headers
    )

    assert complaint_response.status_code == 200, (
        f"\nTest Case       : Get Complaint Before Recategorization"
        f"\nInput           : GET /complaints/{complaint_id}"
        f"\nExpected Output : HTTP Status 200"
        f"\nActual Output   : HTTP Status "
        f"{complaint_response.status_code}"
        f"\nResponse        : {complaint_response.text}"
    )

    complaint_data = complaint_response.json()

    current_category_id = None

    if isinstance(complaint_data.get("category"), dict):
        current_category_id = (
            complaint_data["category"].get("categoryId")
            or complaint_data["category"].get("id")
        )

    # ---------------------------------------------------------
    # Step 2: Get available categories
    # ---------------------------------------------------------

    categories_response = requests.get(
        f"{BASE_URL}/categories",
        headers=admin_auth_headers
    )

    assert categories_response.status_code == 200, (
        f"\nTest Case       : Get Categories"
        f"\nInput           : GET /categories"
        f"\nExpected Output : HTTP Status 200"
        f"\nActual Output   : HTTP Status "
        f"{categories_response.status_code}"
        f"\nResponse        : {categories_response.text}"
    )

    categories_data = categories_response.json()

    if isinstance(categories_data, list):
        categories = categories_data
    elif isinstance(categories_data, dict):
        categories = categories_data.get(
            "categories",
            categories_data.get("data", [])
        )
    else:
        categories = []

    # ---------------------------------------------------------
    # Step 3: Select a category different from current category
    # ---------------------------------------------------------

    new_category_id = None

    for category in categories:
        if not isinstance(category, dict):
            continue

        category_id = (
            category.get("categoryId")
            or category.get("id")
        )

        if category_id and category_id != current_category_id:
            new_category_id = category_id
            break

    assert new_category_id is not None, (
        f"\nTest Case       : Find Alternative Category"
        f"\nCurrent Category : {current_category_id}"
        f"\nResponse         : {categories_response.text}"
    )

    # ---------------------------------------------------------
    # Step 4: Recategorize complaint
    # ---------------------------------------------------------

    payload = {
        "categoryId": new_category_id
    }

    expected_status = 200

    response = requests.patch(
        f"{BASE_URL}{endpoint}",
        json=payload,
        headers=admin_auth_headers
    )

    actual_status = response.status_code

    # ---------------------------------------------------------
    # Step 5: Verify HTTP status
    # ---------------------------------------------------------

    assert actual_status == expected_status, (
        f"\nTest Case       : Recategorize Complaint"
        f"\nInput           : PATCH {endpoint}"
        f"\nExpected Output : HTTP Status {expected_status}"
        f"\nActual Output   : HTTP Status {actual_status}"
        f"\nResponse        : {response.text}"
    )

    # ---------------------------------------------------------
    # Step 6: Verify returned category
    # ---------------------------------------------------------

    response_data = response.json()

    actual_category_id = None

    if isinstance(response_data.get("category"), dict):
        actual_category_id = (
            response_data["category"].get("categoryId")
            or response_data["category"].get("id")
        )

    assert actual_category_id == new_category_id, (
        f"\nExpected Category : {new_category_id}"
        f"\nActual Category   : {actual_category_id}"
        f"\nResponse          : {response.text}"
    )


def test_recategorize_missing_category_id(admin_auth_headers):
    """
    Verify that recategorization fails when categoryId is missing.
    """

    # Input
    complaint_id = "CMP-65C600"
    endpoint = f"/complaints/{complaint_id}/category"

    payload = {}

    # Expected Output
    expected_status = 422

    # Actual Output
    response = requests.patch(
        f"{BASE_URL}{endpoint}",
        json=payload,
        headers=admin_auth_headers
    )

    actual_status = response.status_code

    # Assertion
    assert actual_status == expected_status, (
        f"\nTest Case       : Recategorize Missing Category ID"
        f"\nInput           : PATCH {endpoint}"
        f"\nExpected Output : HTTP Status {expected_status}"
        f"\nActual Output   : HTTP Status {actual_status}"
        f"\nResponse        : {response.text}"
    )


def test_recategorize_empty_category_id(admin_auth_headers):
    """
    Verify that recategorization handles an empty category ID.
    """

    # Input
    complaint_id = "CMP-65C600"
    endpoint = f"/complaints/{complaint_id}/category"

    payload = {
        "categoryId": ""
    }

    # Expected Output
    expected_status = [400, 404, 422]

    # Actual Output
    response = requests.patch(
        f"{BASE_URL}{endpoint}",
        json=payload,
        headers=admin_auth_headers
    )

    actual_status = response.status_code

    # Assertion
    assert actual_status in expected_status, (
        f"\nTest Case       : Recategorize Empty Category ID"
        f"\nInput           : PATCH {endpoint}"
        f"\nExpected Output : HTTP Status {expected_status}"
        f"\nActual Output   : HTTP Status {actual_status}"
        f"\nResponse        : {response.text}"
    )


def test_recategorize_invalid_category_id(admin_auth_headers):
    """
    Verify that recategorization fails when an invalid
    category ID is supplied.
    """

    # Input
    complaint_id = "CMP-65C600"
    endpoint = f"/complaints/{complaint_id}/category"

    payload = {
        "categoryId": "CAT-DOES-NOT-EXIST"
    }

    # Expected Output
    expected_status = [400, 404]

    # Actual Output
    response = requests.patch(
        f"{BASE_URL}{endpoint}",
        json=payload,
        headers=admin_auth_headers
    )

    actual_status = response.status_code

    # Assertion
    assert actual_status in expected_status, (
        f"\nTest Case       : Recategorize Invalid Category"
        f"\nInput           : PATCH {endpoint}"
        f"\nExpected Output : HTTP Status {expected_status}"
        f"\nActual Output   : HTTP Status {actual_status}"
        f"\nResponse        : {response.text}"
    )


def test_recategorize_nonexistent_complaint(admin_auth_headers):
    """
    Verify that recategorization fails when the complaint
    does not exist.
    """

    # Input
    complaint_id = "CMP-DOES-NOT-EXIST"
    endpoint = f"/complaints/{complaint_id}/category"

    payload = {
        "categoryId": "CAT-SAN-01"
    }

    # Expected Output
    expected_status = [400, 404]

    # Actual Output
    response = requests.patch(
        f"{BASE_URL}{endpoint}",
        json=payload,
        headers=admin_auth_headers
    )

    actual_status = response.status_code

    # Assertion
    assert actual_status in expected_status, (
        f"\nTest Case       : Recategorize Nonexistent Complaint"
        f"\nInput           : PATCH {endpoint}"
        f"\nExpected Output : HTTP Status {expected_status}"
        f"\nActual Output   : HTTP Status {actual_status}"
        f"\nResponse        : {response.text}"
    )


def test_recategorize_requires_auth():
    """
    Verify that recategorization cannot be performed
    without authentication.
    """

    # Input
    complaint_id = "CMP-65C600"
    endpoint = f"/complaints/{complaint_id}/category"

    payload = {
        "categoryId": "CAT-SAN-01"
    }

    # Expected Output
    expected_status = [401, 403]

    # Actual Output
    response = requests.patch(
        f"{BASE_URL}{endpoint}",
        json=payload
    )

    actual_status = response.status_code

    # Assertion
    assert actual_status in expected_status, (
        f"\nTest Case       : Recategorize Authentication"
        f"\nInput           : PATCH {endpoint}"
        f"\nExpected Output : HTTP Status {expected_status}"
        f"\nActual Output   : HTTP Status {actual_status}"
        f"\nResponse        : {response.text}"
    )


def test_recategorize_citizen_denied(auth_headers):
    """
    Verify that a normal citizen cannot recategorize
    a complaint.
    """

    # Input
    complaint_id = "CMP-65C600"
    endpoint = f"/complaints/{complaint_id}/category"

    payload = {
        "categoryId": "CAT-SAN-01"
    }

    # Expected Output
    expected_status = 403

    # Actual Output
    response = requests.patch(
        f"{BASE_URL}{endpoint}",
        json=payload,
        headers=auth_headers
    )

    actual_status = response.status_code

    # Assertion
    assert actual_status == expected_status, (
        f"\nTest Case       : Recategorize Citizen Authorization"
        f"\nInput           : PATCH {endpoint}"
        f"\nExpected Output : HTTP Status {expected_status}"
        f"\nActual Output   : HTTP Status {actual_status}"
        f"\nResponse        : {response.text}"
    )


def test_recategorize_invalid_token():
    """
    Verify that recategorization rejects an invalid JWT.
    """

    # Input
    complaint_id = "CMP-65C600"
    endpoint = f"/complaints/{complaint_id}/category"

    payload = {
        "categoryId": "CAT-SAN-01"
    }

    headers = {
        "Authorization": "Bearer invalid.jwt.token"
    }

    # Expected Output
    expected_status = [401, 403]

    # Actual Output
    response = requests.patch(
        f"{BASE_URL}{endpoint}",
        json=payload,
        headers=headers
    )

    actual_status = response.status_code

    # Assertion
    assert actual_status in expected_status, (
        f"\nTest Case       : Recategorize Invalid Token"
        f"\nInput           : PATCH {endpoint}"
        f"\nExpected Output : HTTP Status {expected_status}"
        f"\nActual Output   : HTTP Status {actual_status}"
        f"\nResponse        : {response.text}"
    )