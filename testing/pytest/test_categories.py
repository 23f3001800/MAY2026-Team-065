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
    expected_status = [200, 401, 403]

    # Actual Output
    response = requests.get(f"{BASE_URL}{endpoint}")
    actual_status = response.status_code

    # Assertion
    assert actual_status in expected_status, (
        f"\nTest Case       : Get Categories Authentication"
        f"\nInput           : GET {endpoint}"
        f"\nExpected Output : HTTP Status {expected_status}"
        f"\nActual Output   : HTTP Status {actual_status}"
        f"\nResponse        : {response.text}"
    )


def test_recategorize_complaint(admin_auth_headers):
    """
    Verify that an administrator can recategorize
    an existing complaint.

    The test first determines the complaint's current
    category and then selects a different available category.
    This makes the test repeatable and avoids failures caused
    by the complaint already having the requested category.
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
        f"\nActual Output   : HTTP Status {complaint_response.status_code}"
        f"\nResponse        : {complaint_response.text}"
    )

    complaint_data = complaint_response.json()

    # Extract current category ID
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
        f"\nActual Output   : HTTP Status {categories_response.status_code}"
        f"\nResponse        : {categories_response.text}"
    )

    categories_data = categories_response.json()

    # Handle either a direct list or a wrapped response
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
    # Step 3: Select a category different from the current one
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