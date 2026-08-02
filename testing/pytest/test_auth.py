import requests

BASE_URL="http://127.0.0.1:8000"


def test_swagger_available():
    r=requests.get(f"{BASE_URL}/docs")
    assert r.status_code==200

def test_openapi_available():
    r=requests.get(f"{BASE_URL}/openapi.json")
    assert r.status_code==200
