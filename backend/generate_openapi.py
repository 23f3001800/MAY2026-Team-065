"""Regenerate the OpenAPI specification from the live FastAPI app.

Run this after adding or changing an endpoint so the committed spec never drifts
from the code:

    python generate_openapi.py                       # writes backend/openapi.yaml
    python generate_openapi.py ../testing/postman/swagger.yaml

Requires DATABASE_URL to be set (the app builds its engine at import time), but
it never connects -- only the route table is read.
"""

from __future__ import annotations

import sys
from pathlib import Path

import yaml

from main import app

DEFAULT_OUTPUT = Path(__file__).parent / "openapi.yaml"


def main(destination: Path) -> None:
    spec = app.openapi()

    destination.parent.mkdir(parents=True, exist_ok=True)
    with destination.open("w", encoding="utf-8") as handle:
        yaml.safe_dump(
            spec,
            handle,
            sort_keys=False,
            allow_unicode=True,
            default_flow_style=False,
            width=100,
        )

    print(f"Wrote {destination} ({len(spec['paths'])} paths, "
          f"{len(spec.get('components', {}).get('schemas', {}))} schemas)")


if __name__ == "__main__":
    target = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_OUTPUT
    main(target)
