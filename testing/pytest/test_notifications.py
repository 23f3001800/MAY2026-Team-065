def test_notifications(api_client, auth_headers):

    response = api_client.get(
        "/notifications/me",
        headers=auth_headers
    )

    assert response.status_code == 200