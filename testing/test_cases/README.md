# API Test Cases

This directory contains API test cases for the Smart CivicConnect Backend API.

## Contents

- `API_Test_Cases.xlsx`
- `README.md`

The spreadsheet contains the complete set of API test cases extracted from the project's Pytest test suite.

---

## Test Case Coverage

The spreadsheet contains:

- **304 total test cases**
- **300 passed tests**
- **4 expected failures (XFAIL)**
- **0 unexpected failures**

The four XFAIL cases represent known application defects that have been intentionally documented in the automated test suite.

---

## Spreadsheet Columns

The spreadsheet includes:

- Test Case ID
- Module
- API Endpoint
- HTTP Method
- Test Scenario
- Test Data / Description
- Expected Result
- Actual Result
- Status
- Remarks

---

## Testing Coverage

The test cases cover the major Smart CivicConnect backend modules, including:

- Authentication
- Citizens
- Citizen Profile
- Citizen Password
- Complaints
- Complaint Assignment
- Bulk Assignment
- Complaint Status
- Bulk Status
- Complaint Categories
- Complaint Severity
- Complaint History
- Complaint Feedback
- Complaint Media
- Complaint Report Slip
- Complaint Escalations
- Field Workers
- Worker Management
- Administration
- User Management
- Password Reset
- Notifications
- Input Validation
- Authentication and Authorization
- Business-rule Validation

---

## Test Results

The final Pytest regression execution produced:

```text
304 tests
300 passed
4 xfailed
0 unexpected failures
```

The XFAIL tests correspond to known application defects identified during testing.

They are intentionally retained as expected failures so that the known behaviour remains visible during future regression testing.

---

## Known XFAIL Cases

The current expected failures include:

1. Empty email during field worker creation.
2. Invalid email format during field worker creation.
3. Duplicate email during field worker creation.
4. Empty password during administrator password reset.

These cases are documented in the project's automated test suite and bug report.

---

## Purpose

The API test cases are maintained to:

- Document API testing coverage.
- Provide traceability between API functionality and automated tests.
- Support regression testing.
- Record expected and actual API behaviour.
- Document known application defects.
- Provide QA evidence for the Software Engineering project.
- Support Sprint 1 and final project documentation.
- Assist with future debugging and maintenance.

---

## Testing Approach

The API test cases were developed as part of the Smart CivicConnect QA activities.

Testing included:

- Positive test cases
- Negative test cases
- Authentication testing
- Authorization testing
- Input validation
- Missing-field validation
- Null-value validation
- Invalid-value validation
- Business-rule validation
- Duplicate-data validation
- Response validation
- HTTP status-code validation
- Regression testing

The detailed automated implementation of these test cases is maintained in:

```text
testing/pytest/
```

---

## Authentication and Authorization Testing

Authentication and authorization scenarios were included across the API test suite.

The testing covered:

- Valid authentication
- Missing authentication
- Invalid authentication tokens
- Role-based access control
- Administrator access
- Citizen access
- Field worker access
- Unauthorized role access

The purpose of these tests is to ensure that protected API operations are accessible only to authorized users.

---

## Validation Testing

The test cases also verify API input validation.

The following scenarios were covered where applicable:

- Missing required fields
- Null values
- Empty values
- Invalid formats
- Malformed request bodies
- Invalid identifiers
- Duplicate values
- Invalid state transitions

Validation responses such as HTTP `400`, `401`, `403`, and `422` were verified during testing.

---

## Known Defects

The automated test suite currently contains four expected failures.

These failures represent known application-level defects rather than unexpected test failures.

### Field Worker Email Validation

The worker creation endpoint currently returns HTTP `500` for:

- Empty email
- Invalid email format
- Duplicate email

These cases are marked as XFAIL in the automated test suite.

### Empty Password Reset

The administrator password reset endpoint currently accepts an empty password and returns HTTP `200`.

The expected behaviour is to reject an empty password with an appropriate validation response.

This case is also marked as XFAIL.

---

## Relationship with Pytest

The Excel test-case document represents the complete test coverage from:

```text
testing/pytest/
```

The automated suite can be executed using:

```bash
pytest -v testing/pytest
```

The current regression result is:

```text
304 tests
300 passed
4 xfailed
0 unexpected failures
```

The spreadsheet and automated test suite should remain synchronized when tests are added, removed, or modified.

---

## Regenerating the Test Results

To execute the complete Pytest test suite:

```bash
pytest -v testing/pytest
```

To generate the HTML Pytest report:

```bash
pytest -v testing/pytest \
--html=testing/reports/Pytest_Report.html \
--self-contained-html
```

The generated report is stored at:

```text
testing/reports/Pytest_Report.html
```

---

## Maintenance

The spreadsheet should be updated whenever:

- New APIs are added.
- Existing API functionality changes.
- New automated tests are created.
- Existing tests are modified.
- Known defects are fixed.
- New defects are identified.
- Test expectations change.
- Regression test results change.

Whenever the Pytest suite changes, the API test-case spreadsheet should be reviewed to ensure that it continues to represent the current testing coverage.

---

## File Structure

The API test-case documentation is organized as:

```text
testing/
└── test_cases/
    ├── API_Test_Cases.xlsx
    └── README.md
```

The detailed automated tests are maintained separately:

```text
testing/
└── pytest/
    ├── conftest.py
    ├── test_admin.py
    ├── test_assign.py
    ├── test_auth.py
    ├── test_bulk_assign.py
    ├── test_bulk_status.py
    ├── test_categories.py
    ├── test_citizen_password.py
    ├── test_citizen_profile.py
    ├── test_complaint_by_id.py
    ├── test_complaints.py
    ├── test_create_complaint.py
    ├── test_create_official.py
    ├── test_create_worker.py
    ├── test_escalations.py
    ├── test_feedback.py
    ├── test_get_feedback.py
    ├── test_history.py
    ├── test_media.py
    ├── test_notifications.py
    ├── test_report_slip.py
    ├── test_reset_password.py
    ├── test_severity.py
    ├── test_status.py
    └── test_workers.py
```

---

## Final Regression Status

The current Smart CivicConnect automated API regression suite contains:

```text
Total Tests       : 304
Passed            : 300
Expected Failures : 4
Unexpected Failed : 0
```

Overall regression status:

**PASS**

The four expected failures are documented known application defects and do not represent unexpected regression failures.

---

## Project

**Smart CivicConnect Backend API**

### Testing Role

**QA Engineer / Code Reviewer**

### Testing Framework

**Pytest**

### Test Case Documentation

**API_Test_Cases.xlsx**

---

## Conclusion

The API test-case documentation provides a consolidated view of the current Smart CivicConnect backend testing coverage.

The test cases include functional, negative, authentication, authorization, validation, and business-rule scenarios.

The final automated regression execution completed with:

```text
304 total tests
300 passed
4 expected failures
0 unexpected failures
```

The test-case documentation will be maintained as the backend evolves and can be used as supporting evidence for the project's Software Engineering QA and testing activities.