---

# Generating API Documentation

The Smart CivicConnect backend is built using **FastAPI**, which automatically generates the OpenAPI specification.

## Generate openapi.json

1. Start the FastAPI backend.

```bash
cd backend
source .venv/bin/activate
uvicorn main:app --reload
```

2. Open the following URL in a browser:

```
http://127.0.0.1:8000/openapi.json
```

3. Save the JSON file.

Using Ubuntu:

```bash
curl http://127.0.0.1:8000/openapi.json -o openapi.json
```

or simply open the URL and choose **Save As**.

---

## Generate swagger.yaml

The YAML file can be generated from the OpenAPI JSON using Swagger Editor.

### Method 1 (Recommended)

1. Open **https://editor.swagger.io/**
2. Choose **File → Import File**
3. Import `openapi.json`
4. After validation, choose:

```
File → Save as YAML
```

5. Save the file as:

```
swagger.yaml
```

---

### Method 2 (Command Line)

If Node.js is installed:

```bash
npm install -g swagger-cli
```

Then run:

```bash
swagger-cli bundle openapi.json \
--outfile swagger.yaml \
--type yaml
```

---

# Verification

After generating the files:

- Validate `openapi.json` using the FastAPI `/openapi.json` endpoint.
- Validate `swagger.yaml` by importing it into Swagger Editor.
- Ensure both files describe the same API endpoints.
