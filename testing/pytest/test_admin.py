def test_admin_analytics(api_client, auth_headers):

    response = api_client.get(
        "/admin/analytics",
        headers=auth_headers
    )

    assert response.status_code == 200


def test_list_users(api_client, auth_headers):

    response = api_client.get(
        "/admin/users",
        headers=auth_headers
    )

    assert response.status_code == 200