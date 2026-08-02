# Smart CivicConnect - Test Reports

This directory contains reports generated during API testing and quality assurance for the Smart CivicConnect project.

These reports provide evidence of testing activities performed during Sprint 1.

---

# Directory Structure

```
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

This report summarizes the API testing performed during Sprint 1.

It includes:

- APIs tested
- Test execution summary
- Testing tools used
- Overall observations
- Testing conclusion

This document is intended for project documentation and milestone submission.

---

## Newman_Report.html

Generated automatically using **Newman**, the command-line runner for Postman collections.

The report contains:

- Requests executed
- Response time
- Passed assertions
- Failed assertions (if any)
- Request details
- Overall execution summary

### Generate Again

```bash
cd testing/postman

newman run SmartCivicConnect_Professional.postman_collection.json \
-r cli,htmlextra \
--reporter-htmlextra-export ../reports/Newman_Report.html
```

---

## Pytest_Report.html

Generated automatically using **Pytest HTML Reporter**.

The report contains:

- Executed test cases
- Passed tests
- Failed tests
- Execution time
- Environment information

### Generate Again

```bash
pytest testing/pytest \
-v \
--html=testing/reports/Pytest_Report.html \
--self-contained-html
```

---

# Purpose

These reports are maintained to:

- Record testing activities
- Verify API functionality
- Track regression testing
- Provide evidence for Software Engineering milestones
- Assist future debugging and maintenance

---

# Viewing Reports

Markdown report

```
API_Test_Report.md
```

can be viewed directly in:

- VS Code
- GitHub
- Any Markdown editor

HTML reports

```
Newman_Report.html
```

and

```
Pytest_Report.html
```

can be opened in any modern web browser.

---

# Regeneration

Whenever new APIs are added or existing APIs are modified:

1. Run the Postman Collection again.
2. Generate a new Newman HTML report.
3. Execute the Pytest suite.
4. Generate a new Pytest HTML report.
5. Update API_Test_Report.md if required.

---

# Tools Used

- FastAPI
- Swagger UI
- Postman
- Newman
- Pytest
- Requests

---

# Maintained By

QA & Testing Team

Smart CivicConnect