# Backend image.
#
# python:3.12-slim rather than alpine: the wheels for asyncpg, bcrypt and
# pydantic-core are built against glibc, and on musl pip falls back to compiling
# them from source -- a multi-minute build for an image that is barely smaller.
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

# Requirements first, so a code change does not re-install every dependency.
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Photos land here. Mount a volume at this path -- without one, every complaint's
# evidence is deleted on the next deploy. See DEPLOY.md.
ENV UPLOAD_DIR=/data/uploads
RUN mkdir -p /data/uploads

# Run as a non-root user. If a volume is mounted at /data the platform usually
# sets ownership; the chown covers the case where it does not.
RUN useradd --create-home --uid 10001 app && chown -R app:app /app /data
USER app

EXPOSE 8000

# The platform supplies $PORT (Render, Railway and Fly all do); 8000 is the
# local default. Shell form, so the variable expands at runtime.
CMD uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}
