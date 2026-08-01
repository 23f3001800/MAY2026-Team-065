def test_get_workers(api_client, auth_headers):

    response = api_client.get(
        "/workers/",
        headers=auth_headers
    )

    assert response.status_code == 200


def test_create_worker(api_client, auth_headers):

    payload = {
        "name":"Worker Test",
        "email":"worker@test.com",
        "phone":"9999999999"
    }

    response = api_client.post(
        "/workers/",
        json=payload,
        headers=auth_headers
    )

    assert response.status_code in [200,201]


def test_worker_tasks(api_client, auth_headers):

    response = api_client.get(
        "/complaints/worker/tasks",
        headers=auth_headers
    )

    assert response.status_code == 200