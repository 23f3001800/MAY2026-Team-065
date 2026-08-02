# Bug Report -- Smart CivicConnect

## Project

Smart CivicConnect Backend API

## Tester

Rishabh Prasad (QA Engineer / Code Reviewer)

## Test Period

API verification using Swagger UI and Postman Collection Runner.

------------------------------------------------------------------------

# Summary

  Metric                          Value
  ----------------------------- -------
  Critical Bugs                       0
  High Severity                       0
  Medium Severity                     0
  Low Severity                        2
  Closed / Expected Behaviour         2

------------------------------------------------------------------------

# BUG-001

**Title:** Duplicate complaint category update returns HTTP 400

**Module:** Complaints

**Endpoint:** PATCH /complaints/{complaintId}/category

**Severity:** Low

**Priority:** Low

**Status:** Closed (Expected Behaviour)

**Observed Result**

    HTTP 400
    Complaint is already assigned to this category.

**Expected Result**

The API should prevent assigning the same category twice.

**Conclusion**

Business rule works correctly.

------------------------------------------------------------------------

# BUG-002

**Title:** Validation error returned for invalid request body

**Module:** Authentication / Validation

**Severity:** Low

**Priority:** Low

**Status:** Closed (Expected Behaviour)

**Observed Result**

    HTTP 422 Unprocessable Entity

**Expected Result**

The API should reject incomplete or invalid requests.

**Conclusion**

Validation works correctly.

------------------------------------------------------------------------

# Overall Assessment

No functional defects were discovered during testing. Authentication,
authorization, business-rule validation, and input validation behaved as
expected. No blocker or critical issues were identified.
