# Bug Report — Smart CivicConnect

## Project

**Smart CivicConnect Backend API**

## Tester

**Rishabh Prasad**  
QA Engineer / Code Reviewer

## Test Period

API verification using **Swagger UI, Postman, and automated Pytest API tests**.

---

# 1. Testing Summary

The Smart CivicConnect Backend API was tested across major functional areas including:

- Authentication and authorization
- Citizen management
- Complaint management
- Complaint assignment
- Complaint status and severity
- Complaint category management
- Complaint history
- Complaint feedback
- Complaint media
- Report generation
- Escalations
- Field worker management
- Notifications
- Administrative operations
- Password management
- System official management

The final automated regression test suite produced the following result:

| Metric | Value |
|---|---:|
| Total Automated Tests | 304 |
| Passed | 300 |
| Expected Failures (XFAIL) | 4 |
| Unexpected Failures | 0 |
| Critical Bugs | 0 |
| High Severity Bugs | 0 |
| Medium Severity Bugs | 4 |
| Low Severity Bugs | 0 |
| Closed / Expected Behaviour | 2 |

The four XFAIL cases represent known application defects that were identified during testing and intentionally documented as expected failures.

---

# 2. Bug Severity Definitions

| Severity | Description |
|---|---|
| **Critical** | Complete system failure, data loss, security compromise, or a core feature becoming unusable |
| **High** | Major functionality failure with significant impact on the application |
| **Medium** | Functional or validation defect affecting a specific feature but not blocking the overall application |
| **Low** | Minor issue with limited functional impact |
| **Closed / Expected Behaviour** | Behaviour confirmed to be intentional or correct according to the application's business rules |

---

# 3. BUG-001

## Title

Duplicate complaint category update returns HTTP 400

## Module

Complaints

## Endpoint

```text
PATCH /complaints/{complaintId}/category