"""Add missing and misplaced count columns to alerts

Revision ID: 0004
Revises: 0003
Create Date: 2026-04-27

Idempotent: each ADD COLUMN is guarded by an inspector check so the migration
runs cleanly against a DB whose schema was already created by `db.create_all()`.
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy import inspect

revision = "0004"
down_revision = "0003"
branch_labels = None
depends_on = None


_NEW_COLUMNS = [
    ("missing",   sa.Column("missing",   sa.Integer(), nullable=False, server_default="0")),
    ("misplaced", sa.Column("misplaced", sa.Integer(), nullable=False, server_default="0")),
]


def upgrade():
    inspector = inspect(op.get_bind())
    existing = {c["name"] for c in inspector.get_columns("alerts")}
    missing = [col for name, col in _NEW_COLUMNS if name not in existing]
    if missing:
        with op.batch_alter_table("alerts") as batch_op:
            for col in missing:
                batch_op.add_column(col)


def downgrade():
    inspector = inspect(op.get_bind())
    existing = {c["name"] for c in inspector.get_columns("alerts")}
    drops = [name for name, _ in reversed(_NEW_COLUMNS) if name in existing]
    if drops:
        with op.batch_alter_table("alerts") as batch_op:
            for name in drops:
                batch_op.drop_column(name)
