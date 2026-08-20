# Smart CivicConnect - Pytest API Test Suite

This directory contains the automated API test suite for the Smart CivicConnect backend.

The tests are written using **Pytest** and **Requests** and are intended to verify that the implemented REST APIs behave correctly.

---

# Directory Structure

```
testing/
└── pytest/
    ├── README.md
    ├── test_auth.py
    ├── test_admin.py
    ├── test_complaints.py
    └── test_workers.py
```

---

# Purpose

The purpose of these tests is to:

- Verify that the backend APIs are reachable.
- Verify authentication and authorization.
- Verify protected endpoints.
- Detect regressions after new code changes.
- Provide automated API validation.

---

# Technologies Used

- Python 3.12+
- Pytest
- Requests
- FastAPI
- Uvicorn

---

# Prerequisites

Before executing the tests, ensure the following:

- Python 3.12 or above is installed.
- Project dependencies are installed.
- Backend server is running.
- Database is initialized.
- Internet connection is **not** required (tests run locally).

---

# Installing Dependencies

## Step 1 - Clone the Repository

```bash
git clone <repository-url>
cd MAY2026-Team-065
```

---

## Step 2 - Activate Virtual Environment

Ubuntu / WSL

```bash
cd backend
source .venv/bin/activate
```

Windows PowerShell

```powershell
backend\.venv\Scripts\Activate.ps1
```

---

## Step 3 - Install Required Packages

Install backend dependencies.

```bash
pip install -r backend/requirements.txt
```

If Pytest or Requests are missing:

```bash
pip install pytest
pip install requests
pip install pytest-html
```

---

# Starting the Backend

Before running the tests, start the FastAPI backend.

```bash
cd backend

uvicorn main:app --reload
```

Backend URL

```
http://127.0.0.1:8000
```

Swagger UI

```
http://127.0.0.1:8000/docs
```

OpenAPI

```
http://127.0.0.1:8000/openapi.json
```

Do **not** stop the backend while the tests are executing.

---

# Current Test Files

| File | Description |
|------|-------------|
| test_auth.py | Authentication-related API tests |
| test_admin.py | Administrator API tests |
| test_complaints.py | Complaint API tests |
| test_workers.py | Worker API tests |

---

# Running All Tests

Return to the project root.

```bash
cd ..
```

Run the complete test suite.

```bash
pytest -v testing/pytest
```

---

# Running Individual Test Files

Authentication

```bash
pytest testing/pytest/test_auth.py -v
```

Administrator

```bash
pytest testing/pytest/test_admin.py -v
```

Complaints

```bash
pytest testing/pytest/test_complaints.py -v
```

Workers

```bash
pytest testing/pytest/test_workers.py -v
```

---

# Generate HTML Test Report

Pytest can generate a detailed HTML report.

```bash
pytest testing/pytest \
-v \
--html=testing/reports/Pytest_Report.html \
--self-contained-html
```

Generated report

```
testing/reports/Pytest_Report.html
```

Open the HTML file in any web browser.

---

# Expected Output

Example:

```
======================== test session starts ========================

platform linux

collected 5 items

test_auth.py ........ PASSED
test_admin.py ...... PASSED
test_complaints.py . PASSED
test_workers.py .... PASSED

======================== 5 passed in 0.14s ==========================
```

---

# Test Coverage

The current automated tests verify:

✔ Swagger endpoint availability

✔ OpenAPI endpoint availability

✔ Authentication protection

✔ Complaint API authorization

✔ Worker API authorization

✔ Administrator API authorization

Additional test cases can be added as new APIs are implemented.

---

# Common Issues

## ModuleNotFoundError: requests

Install Requests.

```bash
pip install requests
```

---

## pytest: command not found

Install Pytest.

```bash
pip install pytest
```

---

## Connection Refused

Ensure the backend server is running.

```bash
uvicorn main:app --reload
```

---

## 401 Unauthorized

Protected APIs require a valid JWT token.

Generate a token using:

```
POST /auth/login
```

or update the test configuration if authentication is required.

---

## 404 Not Found

Verify that

```
http://127.0.0.1:8000
```

is correct and the backend is running.

---

# Extending the Test Suite

To add a new API test:

1. Create a new file beginning with **test_**

Example

```
test_notifications.py
```

2. Write Pytest test functions.

3. Execute

```bash
pytest -v testing/pytest
```

to verify the new tests.

---

# Notes

- Run tests after backend changes.
- Keep API URLs updated if the backend address changes.
- Add new test files whenever new endpoints are introduced.
- Generate a new HTML report after every major testing cycle.

---

# Maintained By

QA & Testing Team

Smart CivicConnect