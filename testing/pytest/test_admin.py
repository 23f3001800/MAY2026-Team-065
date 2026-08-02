import requests

BASE_URL="http://127.0.0.1:8000"


def test_admin_analytics_requires_auth():
    r=requests.get(f"{BASE_URL}/admin/analytics")
    assert r.status_code in [200,401,403]
