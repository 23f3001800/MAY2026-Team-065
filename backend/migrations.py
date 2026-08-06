"""Additive, idempotent schema migrations.

The project creates its schema with ``Base.metadata.create_all()``, which creates
missing *tables* but never alters existing ones. So when a column is added to a
model, an already-deployed database silently keeps the old shape and every query
touching the new column fails at runtime.

This module closes that gap for the columns added by the AI-triage and
notification features. Each step is written to be safe to run on every startup:

* ``ADD COLUMN IF NOT EXISTS`` on PostgreSQL, and an information-schema check on
  dialects that lack it (SQLite, used by the test suite).
* Backfills are ``WHERE ... IS NULL`` guarded, so they never overwrite live data.

This is deliberately not a replacement for Alembic. It handles additive column
changes only; a destructive or type-changing migration needs a real tool.
"""

from __future__ import annotations

import logging
from typing import List, Tuple

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncConnection, AsyncEngine

logger = logging.getLogger(__name__)

# (table, column, SQL type) for every column added after the initial schema.
# Quoted identifiers because the codebase uses camelCase column names, which
# PostgreSQL would otherwise fold to lowercase.
_ADDED_COLUMNS: List[Tuple[str, str, str]] = [
    ("notifications", "recipientId", "VARCHAR"),
    ("notifications", "readAt", "TIMESTAMP"),
    ("notifications", "priority", "VARCHAR"),
    ("complaints", "aiSuggestedCategoryId", "VARCHAR"),
    ("complaints", "aiSeverity", "VARCHAR"),
    ("complaints", "aiConfidence", "DOUBLE PRECISION"),
    ("complaints", "aiSummary", "VARCHAR"),
    ("complaints", "aiSource", "VARCHAR"),
    ("complaints", "aiAnalyzedAt", "TIMESTAMP"),
    ("complaints", "duplicateOfComplaintId", "VARCHAR"),
]

# SQLite has no DOUBLE PRECISION / TIMESTAMP spelling difference worth caring
# about, but it also has no ADD COLUMN IF NOT EXISTS, so it needs the manual path.
_SQLITE_TYPE_OVERRIDES = {"DOUBLE PRECISION": "REAL", "TIMESTAMP": "DATETIME"}


async def _column_exists(conn: AsyncConnection, table: str, column: str) -> bool:
    """Return True if ``table.column`` already exists, dialect-aware."""
    dialect = conn.engine.dialect.name

    if dialect == "sqlite":
        rows = await conn.execute(text(f'PRAGMA table_info("{table}")'))
        return any(row[1] == column for row in rows.fetchall())

    result = await conn.execute(
        text(
            "SELECT 1 FROM information_schema.columns "
            "WHERE table_name = :table AND column_name = :column"
        ),
        {"table": table, "column": column},
    )
    return result.first() is not None


async def _table_exists(conn: AsyncConnection, table: str) -> bool:
    dialect = conn.engine.dialect.name

    if dialect == "sqlite":
        result = await conn.execute(
            text("SELECT 1 FROM sqlite_master WHERE type='table' AND name = :table"),
            {"table": table},
        )
    else:
        result = await conn.execute(
            text("SELECT 1 FROM information_schema.tables WHERE table_name = :table"),
            {"table": table},
        )
    return result.first() is not None


async def _add_missing_columns(conn: AsyncConnection) -> int:
    """Add every column in ``_ADDED_COLUMNS`` that is not already present."""
    added = 0
    is_sqlite = conn.engine.dialect.name == "sqlite"

    for table, column, sql_type in _ADDED_COLUMNS:
        if not await _table_exists(conn, table):
            # create_all() has not made the table yet (fresh database); it will be
            # created from the model, which already includes these columns.
            continue

        if await _column_exists(conn, table, column):
            continue

        column_type = _SQLITE_TYPE_OVERRIDES.get(sql_type, sql_type) if is_sqlite else sql_type
        await conn.execute(
            text(f'ALTER TABLE "{table}" ADD COLUMN "{column}" {column_type}')
        )
        logger.info("migration: added column %s.%s (%s)", table, column, column_type)
        added += 1

    return added


async def _backfill_notification_recipients(conn: AsyncConnection) -> int:
    """Point historic notifications at the citizen who filed the complaint.

    Every notification created before ``recipientId`` existed was, by
    construction, addressed to the complaint's citizen -- that was the only
    inbox the old ``/notifications/me`` query could serve.
    """
    if not await _table_exists(conn, "notifications"):
        return 0

    result = await conn.execute(
        text(
            'UPDATE notifications SET "recipientId" = c."citizenId" '
            'FROM complaints c WHERE notifications."complaintId" = c."complaintId" '
            'AND notifications."recipientId" IS NULL'
        )
        if conn.engine.dialect.name != "sqlite"
        else text(
            'UPDATE notifications SET "recipientId" = ('
            '  SELECT c."citizenId" FROM complaints c '
            '  WHERE c."complaintId" = notifications."complaintId"'
            ') WHERE "recipientId" IS NULL'
        )
    )
    count = result.rowcount or 0
    if count:
        logger.info("migration: backfilled recipientId on %d notification(s)", count)
    return count


async def _backfill_notification_defaults(conn: AsyncConnection) -> None:
    """Give pre-existing rows the defaults the model now declares."""
    if not await _table_exists(conn, "notifications"):
        return

    await conn.execute(
        text("UPDATE notifications SET priority = 'NORMAL' WHERE priority IS NULL")
    )


async def run_migrations(engine: AsyncEngine) -> None:
    """Apply all additive migrations. Safe to call on every startup.

    Failures are logged and re-raised: starting the API against a database whose
    shape does not match the models produces confusing per-request errors later,
    so failing loudly at boot is the kinder outcome.
    """
    try:
        async with engine.begin() as conn:
            added = await _add_missing_columns(conn)
            await _backfill_notification_recipients(conn)
            await _backfill_notification_defaults(conn)

        if added:
            logger.info("migration: schema update complete (%d column(s) added)", added)
        else:
            logger.debug("migration: schema already up to date")
    except Exception:
        logger.exception("migration: failed to apply additive schema migrations")
        raise
