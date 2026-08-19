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
    ("complaints", "resolvedAt", "TIMESTAMP"),
    # Account suspension. Added nullable because ALTER TABLE ... ADD COLUMN NOT
    # NULL fails on a table with existing rows; _backfill_is_active() fills it
    # immediately afterwards so the model's nullable=False stays truthful.
    ("users", "isActive", "BOOLEAN"),
    # Field worker profile: where they are based, and where they last were.
    ("field_workers", "baseAddress", "VARCHAR"),
    ("field_workers", "currentLatitude", "DOUBLE PRECISION"),
    ("field_workers", "currentLongitude", "DOUBLE PRECISION"),
    ("field_workers", "locationUpdatedAt", "TIMESTAMP"),
    # Which side of the work a photo documents: "report" or "resolution".
    ("media_attachments", "phase", "VARCHAR"),
]

# SQLite has no DOUBLE PRECISION / TIMESTAMP spelling difference worth caring
# about, but it also has no ADD COLUMN IF NOT EXISTS, so it needs the manual path.
_SQLITE_TYPE_OVERRIDES = {"DOUBLE PRECISION": "REAL", "TIMESTAMP": "DATETIME"}

# PostgreSQL stores StatusEnum as a real enum type. create_all() creates it once
# and never revisits it, so members added to the Python enum later are missing
# from the database type and every write using them fails with InvalidTextRepr.
#
# SQLite has no enum type (it stores VARCHAR), so this whole step is a no-op there.
_ENUM_VALUES: List[Tuple[str, List[str]]] = [
    (
        "statusenum",
        [
            "PENDING",
            "UNDER_REVIEW",
            "ASSIGNED",
            "IN_PROGRESS",
            "ON_HOLD",
            "ESCALATED",
            "RESOLVED",
            "VERIFIED",
            "REOPENED",
            "REJECTED",
        ],
    ),
    ("severityenum", ["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
]


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


async def _existing_enum_labels(conn: AsyncConnection, type_name: str) -> List[str]:
    """Return the labels currently defined on a PostgreSQL enum type."""
    result = await conn.execute(
        text(
            "SELECT e.enumlabel FROM pg_type t "
            "JOIN pg_enum e ON e.enumtypid = t.oid "
            "WHERE t.typname = :name ORDER BY e.enumsortorder"
        ),
        {"name": type_name},
    )
    return [row[0] for row in result.fetchall()]


async def _add_missing_enum_values(engine: AsyncEngine) -> int:
    """Add any enum members missing from the database type.

    Runs on its own AUTOCOMMIT connection, not the migration transaction:
    PostgreSQL forbids using a value added by ALTER TYPE within the same
    transaction that added it, and older versions reject the statement inside a
    transaction block entirely.

    Additive only. PostgreSQL cannot drop an enum label without recreating the
    type, so removing a member from StatusEnum is deliberately not handled here.
    """
    if engine.dialect.name == "sqlite":
        return 0  # SQLite stores enums as VARCHAR; nothing to alter.

    added = 0
    async with engine.connect() as conn:
        await conn.execution_options(isolation_level="AUTOCOMMIT")

        for type_name, wanted in _ENUM_VALUES:
            current = await _existing_enum_labels(conn, type_name)
            if not current:
                # Type does not exist yet; create_all() will build it complete.
                continue

            for index, value in enumerate(wanted):
                if value in current:
                    continue

                # Insert in lifecycle position rather than appending, so the
                # database type sorts the way the Python enum reads. Anchor on
                # the next wanted value that already exists.
                successor = next(
                    (later for later in wanted[index + 1:] if later in current), None
                )

                # Identifiers and values come from the hardcoded table above,
                # never from user input.
                clause = f"ALTER TYPE {type_name} ADD VALUE IF NOT EXISTS '{value}'"
                if successor:
                    clause += f" BEFORE '{successor}'"

                await conn.execute(text(clause))

                if successor:
                    current.insert(current.index(successor), value)
                else:
                    current.append(value)

                logger.info("migration: added enum value %s.%s", type_name, value)
                added += 1

    return added


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


async def _backfill_resolved_at(conn: AsyncConnection) -> int:
    """Recover ``resolvedAt`` for complaints resolved before the column existed.

    ``status_histories`` already records every transition with a timestamp, so
    the first entry into RESOLVED is the real resolution time. That is far
    better than falling back to ``updatedAt``, which moves on any later edit and
    would report an inflated turnaround.

    Complaints with no RESOLVED history entry are left null rather than guessed
    -- an absent figure is honest, an invented one is not.
    """
    if not await _table_exists(conn, "complaints"):
        return 0
    if not await _table_exists(conn, "status_histories"):
        return 0

    # Correlated subquery rather than UPDATE..FROM so the same statement runs on
    # both PostgreSQL and SQLite.
    result = await conn.execute(
        text(
            'UPDATE complaints SET "resolvedAt" = ('
            '  SELECT MIN(h.timestamp) FROM status_histories h'
            '  WHERE h."complaintId" = complaints."complaintId"'
            "    AND CAST(h.status AS VARCHAR) = 'RESOLVED'"
            ') WHERE "resolvedAt" IS NULL'
            '  AND EXISTS ('
            '    SELECT 1 FROM status_histories h2'
            '    WHERE h2."complaintId" = complaints."complaintId"'
            "      AND CAST(h2.status AS VARCHAR) = 'RESOLVED')"
        )
    )
    count = result.rowcount or 0
    if count:
        logger.info("migration: backfilled resolvedAt on %d complaint(s)", count)
    return count


async def _backfill_is_active(conn: AsyncConnection) -> int:
    """Every pre-existing account is active.

    This has to run, not just be defaulted in the model: rows written before the
    column existed hold NULL, and NULL is not False -- so a login check written
    as ``isActive is False`` would pass them, while one written as
    ``isActive is True`` would lock every existing user out of the system. Both
    are bad, and neither is obvious from reading the login handler. Filling the
    column removes the question.
    """
    if not await _table_exists(conn, "users"):
        return 0
    if not await _column_exists(conn, "users", "isActive"):
        return 0

    result = await conn.execute(
        text('UPDATE users SET "isActive" = TRUE WHERE "isActive" IS NULL')
    )
    filled = result.rowcount or 0
    if filled:
        logger.info("migration: marked %d pre-existing account(s) active", filled)
    return filled


async def _backfill_media_phase(conn: AsyncConnection) -> int:
    """Classify existing photos as report or resolution evidence.

    Existing rows predate the column, so the phase has to be reconstructed. The
    reporter is the complaint's citizen, and that is the one signal that is
    actually reliable: anything uploaded by someone other than the citizen who
    filed it is completion evidence.

    Upload *time* is deliberately not used. A citizen who adds a photo after the
    work is done would be misfiled as resolution evidence, and a worker who
    uploads within minutes of the report would be misfiled as the report.
    """
    if not await _table_exists(conn, "media_attachments"):
        return 0
    if not await _column_exists(conn, "media_attachments", "phase"):
        return 0

    result = await conn.execute(text(
        """
        UPDATE media_attachments AS m
        SET phase = CASE
            WHEN c."citizenId" = m."uploadedBy" THEN 'report'
            ELSE 'resolution'
        END
        FROM complaints AS c
        WHERE c."complaintId" = m."complaintId" AND m.phase IS NULL
        """
    ))
    filled = result.rowcount or 0

    # Anything still NULL has no matching complaint row to judge from. Default
    # to "report": showing the original problem twice is a smaller error than
    # presenting an unknown photo as proof the work was done.
    leftover = await conn.execute(text(
        "UPDATE media_attachments SET phase = 'report' WHERE phase IS NULL"
    ))
    filled += leftover.rowcount or 0

    if filled:
        logger.info("migration: classified %d media attachment(s) by phase", filled)
    return filled


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
        # Enum values first, and outside the transaction below: a column default
        # or backfill referencing a new label would otherwise fail in the same
        # transaction that created it.
        enum_values_added = await _add_missing_enum_values(engine)

        async with engine.begin() as conn:
            added = await _add_missing_columns(conn)
            await _backfill_notification_recipients(conn)
            await _backfill_notification_defaults(conn)
            await _backfill_resolved_at(conn)
            await _backfill_is_active(conn)
            await _backfill_media_phase(conn)

        if added or enum_values_added:
            logger.info(
                "migration: schema update complete (%d column(s), %d enum value(s) added)",
                added,
                enum_values_added,
            )
        else:
            logger.debug("migration: schema already up to date")
    except Exception:
        logger.exception("migration: failed to apply additive schema migrations")
        raise
