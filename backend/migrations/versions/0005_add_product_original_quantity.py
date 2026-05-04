"""Add original_quantity to products so stock-status can be computed as a
percentage of the baseline (planogram) capacity instead of an absolute count.

Revision ID: 0005
Revises: 0004
Create Date: 2026-05-03

Idempotent: ADD COLUMN is guarded by an inspector check so the migration is
safe to run against a DB that already has the column from db.create_all().
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy import inspect

revision = "0005"
down_revision = "0004"
branch_labels = None
depends_on = None


def upgrade():
    inspector = inspect(op.get_bind())
    existing_cols = {c["name"] for c in inspector.get_columns("products")}

    if "original_quantity" not in existing_cols:
        with op.batch_alter_table("products") as batch_op:
            batch_op.add_column(
                sa.Column("original_quantity", sa.Integer(), server_default="0", nullable=False)
            )
        # Backfill: assume the current quantity_in_store IS the baseline.
        op.execute("UPDATE products SET original_quantity = quantity_in_store WHERE original_quantity = 0")


def downgrade():
    inspector = inspect(op.get_bind())
    existing_cols = {c["name"] for c in inspector.get_columns("products")}
    if "original_quantity" in existing_cols:
        with op.batch_alter_table("products") as batch_op:
            batch_op.drop_column("original_quantity")
