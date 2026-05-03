"""Add brand/variant/size/shelf_status/last_checked to products; add shelf_analysis_logs table

Revision ID: 0002
Revises: 0001
Create Date: 2026-04-22

Idempotent: each ADD COLUMN / CREATE TABLE is guarded by an inspector check.
This lets the migration run cleanly against a DB whose schema was already
created by `db.create_all()` (which the app does on startup).
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy import inspect

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None


_PRODUCT_COLUMNS = [
    ("brand",        sa.Column("brand",        sa.String(80), server_default="",        nullable=False)),
    ("variant",      sa.Column("variant",      sa.String(80), server_default="",        nullable=False)),
    ("size",         sa.Column("size",         sa.String(50), server_default="",        nullable=False)),
    ("shelf_status", sa.Column("shelf_status", sa.String(50), server_default="unknown", nullable=False)),
    ("last_checked", sa.Column("last_checked", sa.DateTime(timezone=True),              nullable=True)),
]


def upgrade():
    inspector = inspect(op.get_bind())

    # ── New columns on products (skip any that already exist) ────────────────
    existing_cols = {c["name"] for c in inspector.get_columns("products")}
    missing = [col for name, col in _PRODUCT_COLUMNS if name not in existing_cols]
    if missing:
        with op.batch_alter_table("products") as batch_op:
            for col in missing:
                batch_op.add_column(col)

    # ── New shelf_analysis_logs table ────────────────────────────────────────
    if "shelf_analysis_logs" not in inspector.get_table_names():
        op.create_table(
            "shelf_analysis_logs",
            sa.Column("id",          sa.Integer(),                         primary_key=True, autoincrement=True),
            sa.Column("user_id",     sa.Integer(),                         sa.ForeignKey("users.user_id"), nullable=True),
            sa.Column("file_name",   sa.String(255),                       nullable=False),
            sa.Column("result_json", sa.Text(),                            nullable=False),
            sa.Column("created_at",  sa.DateTime(timezone=True),          server_default=sa.func.now(), nullable=False),
        )


def downgrade():
    inspector = inspect(op.get_bind())

    if "shelf_analysis_logs" in inspector.get_table_names():
        op.drop_table("shelf_analysis_logs")

    existing_cols = {c["name"] for c in inspector.get_columns("products")}
    drops = [name for name, _ in reversed(_PRODUCT_COLUMNS) if name in existing_cols]
    if drops:
        with op.batch_alter_table("products") as batch_op:
            for name in drops:
                batch_op.drop_column(name)
