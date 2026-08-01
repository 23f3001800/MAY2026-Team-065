import pytest


def test_get_all_complaints(api_client, auth_headers):
    response = api_client.get(
        "/complaints/",
        headers=auth_headers
    )

    assert response.status_code == 200


def test_create_complaint(api_client, auth_headers):

    payload = {
        "title": "Large Pothole",
        "description": "Huge pothole near MG Road",
        "latitude": 22.8046,
        "longitude": 86.2029
    }

    response = api_client.post(
        "/complaints/",
        json=payload,
        headers=auth_headers
    )

    assert response.status_code in [200, 201]


def test_get_invalid_complaint(api_client, auth_headers):

    response = api_client.get(
        "/complaints/999999",
        headers=auth_headers
    )

    assert response.status_code in [404, 400]


def test_nearby_complaints(api_client, auth_headers):

    response = api_client.get(
        "/complaints/nearby?latitude=22.8046&longitude=86.2029&radius=5",
        headers=auth_headers
    )

    assert response.status_code == 200


def test_upload_image_without_file(api_client, auth_headers):

    response = api_client.post(
        "/complaints/1/image",
        headers=auth_headers
    )

    assert response.status_code in [400, 422]


def test_feedback_invalid_complaint(api_client, auth_headers):

    response = api_client.post(
        "/complaints/999999/feedback",
        json={
            "rating":5,
            "comments":"Good"
        },
        headers=auth_headers
    )

    assert response.status_code in [404, 400]