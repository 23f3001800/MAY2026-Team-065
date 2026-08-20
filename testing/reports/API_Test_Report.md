# API Testing Report – Smart CivicConnect

---

## Project

**Smart CivicConnect Backend API**

---

## Tester

**Rishabh Prasad**  
QA Engineer / Code Reviewer

---

## Testing Environment

| Component | Details |
|-----------|---------|
| Backend Framework | FastAPI (Uvicorn) |
| API Documentation | Swagger UI |
| API Testing Tool | Postman |
| Automation Tool | Newman |
| Automated Test Framework | Pytest |
| Base URL | http://127.0.0.1:8000 |

---

# Testing Scope

The following backend modules were tested during Sprint 1:

- Authentication
- Complaints
- Workers
- Administration
- Users
- Notifications
- Feedback
- Complaint Assignment
- Complaint Status Update
- Complaint Recategorization
- Image Upload

---

# Test Summary

| Metric | Result |
|---------|--------|
| Total Endpoints Tested | 21 |
| Total API Requests Executed | 21 |
| Total Assertions Executed | 63 |
| Passed Assertions | 63 |
| Failed Assertions | 0 |
| Runtime Errors | 0 |
| Average Response Time | ~7 ms |
| Overall Result | **PASS** |

---

# Functional Validation

The following functionalities were successfully verified:

- User registration
- User authentication and login
- Complaint creation
- Complaint retrieval
- Complaint assignment to field workers
- Worker task retrieval
- Worker availability update
- Complaint status update
- Feedback submission for resolved complaints
- Notification retrieval
- Administrative analytics
- Municipal officer creation
- User information update

---

# Test Execution Evidence

## Manual Testing

The APIs were manually verified using **Swagger UI**.

The following checks were performed:

- Endpoint accessibility
- Request payload validation
- Response verification
- HTTP status code validation
- Authentication using JWT tokens
- Role-based authorization (Citizen, Administrator, Municipal Officer, Field Worker)

---

## Automated Testing

Automated testing was performed using multiple tools.

| Tool | Purpose | Status |
|------|---------|--------|
| Swagger UI | Manual API Verification | ✅ Passed |
| Postman Collection Runner | Functional API Testing | ✅ Passed |
| Newman CLI | Automated Collection Execution | ✅ Passed |
| Pytest | Automated Smoke Testing | ✅ Passed |

---

## Automated Test Results

### Postman Collection Runner

- Requests Executed: **21**
- Assertions: **63**
- Failed Assertions: **0**
- Runtime Errors: **0**

### Pytest

```
==========================
5 tests collected

5 passed

Execution completed successfully.
==========================
```

---

# Validation Cases Observed

The following validation scenarios were verified successfully:

- HTTP **400 Bad Request** for business-rule validation failures.
- HTTP **401 Unauthorized** for unauthenticated requests.
- HTTP **403 Forbidden** for unauthorized role access.
- HTTP **422 Unprocessable Entity** for invalid request payloads.
- Appropriate validation messages returned for invalid inputs.

Example:

- Attempting to assign an already assigned complaint category correctly returned **HTTP 400**.
- Invalid or incomplete request bodies correctly returned **HTTP 422**.

---

# Observations

- All implemented APIs responded correctly.
- Authentication and authorization behaved as expected.
- Input validation prevented invalid data from being processed.
- Business-rule validations were enforced successfully.
- No unexpected server crashes or runtime exceptions were observed during testing.
- Average API response time remained within acceptable limits.

---

# Conclusion

Functional and automated testing of the Smart CivicConnect backend APIs was successfully completed.

The testing process included:

- Manual API verification using Swagger UI
- Functional API testing using Postman Collection Runner
- Automated execution using Newman
- Automated smoke testing using Pytest

A total of **21 API endpoints** and **63 assertions** were executed successfully with:

- **0 Failed Assertions**
- **0 Runtime Errors**

Overall, the implemented APIs behaved as expected, and the backend is considered **stable for the completion of Sprint 1**. The identified validation responses (HTTP 400, 401, 403, and 422) were expected behaviours and confirmed that authentication, authorization, and input validation mechanisms are functioning correctly.