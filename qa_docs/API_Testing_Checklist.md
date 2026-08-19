# Smart CivicConnect

# API Testing Checklist

---

# Purpose

This checklist is used to verify that the Smart CivicConnect backend APIs function correctly, securely, reliably, and meet the functional requirements defined for Sprint 1 before deployment.

---

# 1. Endpoint Verification

- [ ] API route is accessible.
- [ ] API endpoint URL is correct.
- [ ] Correct HTTP method is used (GET, POST, PUT, PATCH, DELETE).
- [ ] API version is correct (if applicable).

---

# 2. Request Validation

- [ ] Required fields are mandatory.
- [ ] Optional fields are handled correctly.
- [ ] Input data types are validated.
- [ ] Invalid inputs return appropriate validation errors.
- [ ] Empty request body is handled properly.
- [ ] Large input values are handled correctly.

---

# 3. Response Validation

- [ ] Response status code is correct.
- [ ] Response body follows the expected JSON format.
- [ ] Response Content-Type is `application/json`.
- [ ] All expected fields are present.
- [ ] Data values are accurate.
- [ ] No unnecessary or sensitive data is returned.

---

# 4. HTTP Status Code Verification

Verify that appropriate HTTP status codes are returned.

- [ ] 200 OK
- [ ] 201 Created
- [ ] 400 Bad Request
- [ ] 401 Unauthorized
- [ ] 403 Forbidden
- [ ] 404 Not Found
- [ ] 409 Conflict (if applicable)
- [ ] 422 Unprocessable Entity
- [ ] 500 Internal Server Error

---

# 5. Authentication & Authorization

- [ ] Protected APIs require authentication.
- [ ] JWT token is generated successfully after login.
- [ ] Invalid token is rejected.
- [ ] Expired token is rejected.
- [ ] Users can access only authorized resources.
- [ ] Unauthorized requests return the correct status code.

---

# 6. Database Validation

- [ ] Data is stored correctly.
- [ ] Data updates correctly.
- [ ] Data deletion works correctly.
- [ ] Duplicate records are prevented where required.
- [ ] Database remains consistent after API execution.

---

# 7. Error Handling

- [ ] Invalid requests return meaningful error messages.
- [ ] Missing required fields are reported correctly.
- [ ] Server errors are handled gracefully.
- [ ] Error responses follow a consistent format.

---

# 8. Performance Checks

- [ ] API response time is within acceptable limits (generally under 1 second for local testing).
- [ ] Multiple requests are handled successfully.
- [ ] No unexpected timeout occurs.

---

# 9. Security Checks

- [ ] Sensitive information is not exposed in API responses.
- [ ] SQL Injection attempts are handled safely.
- [ ] Invalid inputs are sanitized.
- [ ] API keys and JWT tokens are protected.
- [ ] Passwords are never returned in responses.

---

# 10. Logging

- [ ] Errors are logged properly.
- [ ] Important events are recorded.
- [ ] Sensitive information is not written to logs.

---

# 11. Testing Tools

The following tools were used during API testing:

- Swagger UI
- Postman
- Newman
- Pytest

---

# 12. Test Execution Record

| Test ID | API Endpoint | Result | Remarks |
|---------|--------------|--------|---------|
| API-001 | | PASS / FAIL / BLOCKED | |
| API-002 | | PASS / FAIL / BLOCKED | |
| API-003 | | PASS / FAIL / BLOCKED | |
| API-004 | | PASS / FAIL / BLOCKED | |

---

# Checklist Status

**Reviewer:**

_____________________________

**Execution Date:**

_____________________________

**Testing Environment:**

_____________________________

**Application Version:**

_____________________________

### Overall Status

☐ Passed

☐ Passed with Minor Issues

☐ Failed

---

# Notes

Use this checklist during every testing cycle to ensure that newly implemented or modified APIs continue to meet the project's functional, security, and performance requirements. Update the checklist whenever new API endpoints or features are introduced.