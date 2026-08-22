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
| Collection Execution | Newman |
| Automated Test Framework | Pytest |
| Base URL | `http://127.0.0.1:8000` |

---

# 1. Testing Scope

The Smart CivicConnect Backend API was tested across the major functional
modules implemented in the application.

The testing scope included:

- Authentication
- User registration and login
- Citizen management
- Citizen profile management
- Citizen password management
- Complaint management
- Complaint creation and retrieval
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
- Worker profile and availability
- Administrative operations
- System official creation
- User management
- Password reset
- Notifications
- Complaint categories
- Role-based authorization
- Input validation
- Business-rule validation

Image upload functionality was manually investigated using Swagger UI.
Automated multipart file-upload testing was not included in the final
Pytest regression suite because of the file-upload interface requirements.

---

# 2. Testing Objectives

The main objectives of API testing were:

1. Verify that API endpoints return the correct HTTP status codes.
2. Verify authentication and JWT-based authorization.
3. Verify role-based access control.
4. Validate request payloads and required fields.
5. Verify successful CRUD and business operations.
6. Verify business-rule validations.
7. Verify response structures and important response fields.
8. Test invalid, missing, null, and malformed input.
9. Identify unexpected server-side errors.
10. Perform regression testing across the completed API test suite.

---

# 3. Test Summary

| Metric | Result |
|--------|--------|
| Automated Pytest Tests | **304** |
| Passed Tests | **300** |
| Expected Failures (XFAIL) | **4** |
| Unexpected Failures | **0** |
| Critical Defects | **0** |
| High Severity Defects | **0** |
| Medium Severity Known Defects | **4** |
| Low Severity Defects | **0** |
| Overall Result | **PASS WITH KNOWN DEFECTS** |

The four XFAIL tests represent known application defects identified during
testing. They are intentionally marked as expected failures in the
automated test suite.

---

# 4. Functional Validation

The following major functionalities were successfully verified.

## 4.1 Authentication

- User registration
- User login
- JWT authentication
- Invalid token handling
- Authentication-required endpoints
- Role-based authorization

## 4.2 Complaint Management

- Create complaint
- Get complaints
- Get complaint by ID
- Assign field worker
- Bulk assignment
- Update complaint status
- Bulk status update
- Override complaint severity
- Recategorize complaint
- Get complaint history
- Get complaint media
- Get complaint feedback
- Submit feedback
- Get complaint report slip
- Get complaint escalations
- Merge complaints
- Nearby complaint retrieval

## 4.3 Worker Management

- Create field worker
- Get field workers
- Get worker tasks
- Get worker profile
- Update worker profile
- Update worker availability

## 4.4 Citizen Management

- Update citizen profile
- Update citizen password

## 4.5 Administration

- Create system official
- List users
- Update users
- Deactivate users
- Reset user password
- Administrative analytics
- SLA sweep operation

## 4.6 Notifications

- Get notifications
- Get unread notification count
- Mark notification as read/unread
- Mark all notifications as read
- Delete notification

## 4.7 AI Services

- AI health check
- Complaint categorization
- Severity prediction
- Duplicate complaint detection
- Full AI triage
- Image analysis
- Complaint description generation
- AI assistant query
- Re-analysis of existing complaints

---

# 5. Manual Testing

The APIs were manually verified using **Swagger UI** and selected
operations were also checked through Postman.

The following checks were performed:

- Endpoint accessibility
- Request payload validation
- Response validation
- HTTP status code validation
- JWT authentication
- Role-based authorization
- Business-rule validation
- Error handling
- Response structure
- Selected file-upload behaviour

The following roles were used during testing where applicable:

- Citizen
- Administrator
- System/Municipal Official
- Field Worker

---

# 6. Automated Testing

Automated API testing was performed using **Pytest**.

Postman/Newman were also used during earlier functional verification.

| Tool | Purpose | Status |
|------|---------|--------|
| Swagger UI | Manual API verification | Completed |
| Postman | Functional API testing | Completed |
| Newman | Collection execution | Completed |
| Pytest | Automated API testing and regression | Completed |

---

# 7. Final Pytest Regression Result

The final automated regression suite produced:

```text
300 passed
4 xfailed
0 unexpected failures