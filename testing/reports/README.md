# Smart CivicConnect - Test Reports

This directory contains reports generated during API testing and quality assurance for the Smart CivicConnect project.

These reports provide evidence of testing activities performed during the development and final regression testing of the application.

---

# Directory Structure

```text
testing/
└── reports/
    ├── README.md
    ├── API_Test_Report.md
    ├── Newman_Report.html
    └── Pytest_Report.html
```

---

# Report Descriptions

## API_Test_Report.md

This report summarizes the API testing performed for the Smart CivicConnect Backend API.

It includes:

- APIs and modules tested
- Testing scope
- Testing environment
- Test execution summary
- Authentication and authorization testing
- Input validation testing
- Business-rule validation
- Automated testing results
- Regression testing results
- Known application defects
- Testing observations
- Testing limitations
- Overall QA assessment
- Final testing conclusion

The latest automated regression testing result is:

```text
304 tests
300 passed
4 xfailed
0 unexpected failures
```

The four XFAIL tests represent known application defects identified during testing.

This document is intended for project documentation, Software Engineering milestones, and final project submission.

---

## Newman_Report.html

Generated automatically using **Newman**, the command-line runner for Postman collections.

The report contains:

- Requests executed
- Request details
- Response details
- HTTP status codes
- Response time
- Passed assertions
- Failed assertions, if any
- Overall execution summary

### Generate Again

From the project root:

```bash
cd testing/postman

newman run SmartCivicConnect_Professional.postman_collection.json \
-r cli,htmlextra \
--reporter-htmlextra-export ../reports/Newman_Report.html
```

The generated report will overwrite:

```text
testing/reports/Newman_Report.html
```

---

## Pytest_Report.html

Generated automatically using **pytest-html**.

The report contains:

- Executed test cases
- Passed tests
- Expected failures (XFAIL)
- Failed tests
- Execution time
- Test environment information
- Test session summary

The final automated regression suite contains:

```text
304 tests
300 passed
4 xfailed
0 unexpected failures
```

### Generate Again

From the project root:

```bash
pytest -v testing/pytest \
--html=testing/reports/Pytest_Report.html \
--self-contained-html
```

The generated report will overwrite:

```text
testing/reports/Pytest_Report.html
```

---

# Testing Scope

The testing activities covered the major backend functionality of the Smart CivicConnect application.

The following areas were included:

- Authentication
- User registration
- User login
- JWT authentication
- Role-based authorization
- Citizen management
- Citizen profile management
- Citizen password management
- Complaint management
- Complaint creation
- Complaint retrieval
- Complaint assignment
- Bulk complaint assignment
- Complaint status management
- Bulk status management
- Complaint severity management
- Complaint category management
- Complaint history
- Complaint feedback
- Complaint media
- Complaint report slip
- Complaint escalations
- Field worker management
- Worker task retrieval
- Worker profile management
- Worker availability
- Administrative operations
- User management
- Password reset
- Notifications
- Complaint categories
- Input validation
- Business-rule validation

---

# Testing Methods

The Smart CivicConnect API was tested using multiple testing methods.

## Manual API Testing

Manual API verification was performed using Swagger UI.

The following checks were performed:

- Endpoint accessibility
- Request payload validation
- HTTP status code validation
- Response validation
- Authentication
- Authorization
- Business-rule validation
- Error handling
- Response structure verification

---

## Postman Testing

Postman was used for functional API verification.

The testing included:

- API request execution
- Request payload verification
- Authentication headers
- Response status verification
- Response validation
- Assertion verification

---

## Newman Testing

Newman was used to execute Postman collections from the command line.

The Newman report provides execution evidence that can be reviewed independently from the Postman application.

---

## Pytest Testing

Pytest was used for automated API testing and regression testing.

The tests use HTTP requests against the running FastAPI backend and verify:

- Successful API operations
- Authentication requirements
- Authorization requirements
- Invalid tokens
- Missing fields
- Null values
- Invalid values
- Malformed request bodies
- Business-rule behaviour
- Response structures
- Response status codes
- Repeated requests
- Known application defects

---

# Final Automated Testing Status

The latest complete Pytest regression run produced:

```text
300 passed
4 xfailed
0 unexpected failures
```

The complete suite therefore finished without unexpected test failures.

The four XFAIL tests are documented known application defects.

They are intentionally marked as XFAIL rather than being treated as unexpected failures.

---

# Known Application Defects

The current XFAIL tests document the following known issues:

## 1. Empty Worker Email

The worker creation endpoint currently produces an HTTP 500 response when an empty email is submitted.

Expected behaviour would be a controlled validation response such as HTTP 400 or HTTP 422.

---

## 2. Invalid Worker Email

The worker creation endpoint currently produces an HTTP 500 response when an invalid email format is submitted.

Expected behaviour would be an appropriate validation response such as HTTP 400 or HTTP 422.

---

## 3. Duplicate Worker Email

The worker creation endpoint currently produces an HTTP 500 response when an already registered email is used.

Expected behaviour would be a controlled response such as HTTP 400 or HTTP 409.

---

## 4. Empty Password During Administrator Reset

The administrator password reset endpoint currently accepts an empty password and returns HTTP 200.

Expected behaviour would be to reject an empty password using an appropriate validation response.

---

# Expected Behaviours Confirmed

Some scenarios that initially appeared to be possible defects were confirmed as correct application behaviour.

## Duplicate Complaint Category

Attempting to assign a complaint to the same category again returns HTTP 400.

This correctly enforces the application's business rule and prevents redundant category assignments.

---

## Invalid Request Body

Incomplete or malformed request bodies return HTTP 422 where appropriate.

This confirms that request validation is working for the tested scenarios.

---

# Authentication and Authorization

Authentication and authorization were tested across the available user roles.

The testing included:

- Authenticated requests
- Unauthenticated requests
- Invalid authentication tokens
- Administrator authorization
- Citizen authorization
- Field worker authorization
- Unauthorized role access

The application correctly rejected unauthorized access for the tested protected endpoints.

---

# HTTP Responses Verified

The testing covered the following important HTTP responses:

```text
200 OK
201 Created
400 Bad Request
401 Unauthorized
403 Forbidden
422 Unprocessable Entity
500 Internal Server Error
```

HTTP 500 responses identified during testing were investigated and documented as known application defects where applicable.

The expected 400, 401, 403, and 422 responses were used to verify business-rule, authentication, authorization, and input validation behaviour.

---

# Regression Testing

Regression testing was performed using the complete Pytest test suite.

The purpose of regression testing was to ensure that previously tested functionality continued to work after changes were made to the application.

The final regression result was:

```text
304 tests
300 passed
4 xfailed
0 unexpected failures
```

The four XFAIL tests are retained in the suite so that the known defects remain visible and can be automatically re-evaluated after future fixes.

---

# Test Report Maintenance

The reports in this directory should be updated when:

- New APIs are implemented
- Existing API behaviour changes
- New automated tests are added
- Existing tests are modified
- Known defects are fixed
- New defects are discovered
- Regression results change

The HTML reports should be regenerated after significant changes to the test suite.

---

# Purpose

These reports are maintained to:

- Record API testing activities
- Verify API functionality
- Verify authentication and authorization
- Validate request and response handling
- Validate business rules
- Track regression testing
- Document known application defects
- Provide testing evidence
- Support Software Engineering milestones
- Support final project documentation
- Assist future debugging and maintenance

---

# Viewing Reports

## Markdown Report

The API testing report can be viewed directly using:

- VS Code
- GitHub
- Any Markdown editor

File:

```text
API_Test_Report.md
```

---

## Newman Report

The Newman HTML report can be opened using any modern web browser.

File:

```text
Newman_Report.html
```

---

## Pytest Report

The Pytest HTML report can be opened using any modern web browser.

File:

```text
Pytest_Report.html
```

---

# Regeneration

Whenever new APIs are added or existing APIs are modified:

1. Start the Smart CivicConnect backend.
2. Run the Postman collection if applicable.
3. Generate a new Newman HTML report.
4. Execute the complete Pytest suite.
5. Generate a new Pytest HTML report.
6. Review passed, failed, and XFAIL results.
7. Update `API_Test_Report.md` if the testing scope or results change.
8. Update the bug report if new defects are identified.
9. Commit the updated reports when the testing milestone is complete.

---

# Pytest Commands

## Run Complete Test Suite

```bash
pytest -v testing/pytest
```

## Generate Pytest HTML Report

```bash
pytest -v testing/pytest \
--html=testing/reports/Pytest_Report.html \
--self-contained-html
```

The HTML report overwrites the existing `Pytest_Report.html` file.

---

# Newman Command

To regenerate the Postman/Newman report:

```bash
cd testing/postman

newman run SmartCivicConnect_Professional.postman_collection.json \
-r cli,htmlextra \
--reporter-htmlextra-export ../reports/Newman_Report.html
```

The HTML report overwrites the existing `Newman_Report.html` file.

---

# Tools Used

- FastAPI
- Uvicorn
- Swagger UI
- Postman
- Newman
- Pytest
- pytest-html
- Requests

---

# Final Testing Status

The Smart CivicConnect backend completed the planned API testing and regression testing for the current college project scope.

Final automated regression result:

```text
304 tests
300 passed
4 xfailed
0 unexpected failures
```

No Critical or High Severity defects were identified.

The remaining known defects are documented and represented by XFAIL tests in the automated test suite.

---

# Maintained By

**QA & Testing Team**

**Smart CivicConnect**