# Smart CivicConnect - QA Automation

## Requirements

- Python 3.13
- FastAPI
- PostgreSQL
- pytest
- asyncpg

## Install

```bash
pip install -r backend/requirements.txt
pip install pytest
```

## Run All Tests

```bash
pytest testing/pytest -v
```

## Run Individual Module

```bash
pytest testing/pytest/test_auth.py -v
pytest testing/pytest/test_complaints.py -v
pytest testing/pytest/test_workers.py -v
```

## Notes

- Tests require a running PostgreSQL database.
- Configure `.env` correctly before execution.
- Login uses JWT authentication.