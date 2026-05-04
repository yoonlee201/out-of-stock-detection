"""Add product_locations table — one row per planogram slot a product occupies.

Revision ID: 0006
Revises: 0005
Create Date: 2026-05-03

Idempotent: guarded by an inspector check so it's safe to run against a DB
where db.create_all() already created the table.
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy import inspect

revision = "0006"
down_revision = "0005"
branch_labels = None
depends_on = None


def upgrade():
    inspector = inspect(op.get_bind())
    if "product_locations" in inspector.get_table_names():
        return

    op.create_table(
        "product_locations",
        sa.Column("id",                 sa.Integer(),                primary_key=True, autoincrement=True),
        sa.Column("product_id",         sa.Integer(),                sa.ForeignKey("products.product_id"), nullable=False),
        sa.Column("slot_id",            sa.String(20),               nullable=False, unique=True),
        sa.Column("shelf",              sa.String(20),               nullable=False),
        sa.Column("position",           sa.Integer(),                nullable=False),
        sa.Column("planogram_quantity", sa.Integer(),                server_default="0",       nullable=False),
        sa.Column("shelf_status",       sa.String(50),               server_default="unknown", nullable=False),
        sa.Column("last_checked",       sa.DateTime(timezone=True),  nullable=True),
    )


def downgrade():
    inspector = inspect(op.get_bind())
    if "product_locations" in inspector.get_table_names():
        op.drop_table("product_locations")
