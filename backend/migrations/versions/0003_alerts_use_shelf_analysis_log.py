"""Replace alerts.product_id with alerts.shelf_analysis_log_id

Revision ID: 0003
Revises: 0002
Create Date: 2026-04-27

Idempotent: each column op is guarded by an inspector check. This lets the
migration run cleanly against a DB whose schema was already created by
`db.create_all()` (which the app does on startup) — that path produces an
alerts table that already matches the target schema.
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy import inspect

revision = "0003"
down_revision = "0002"
branch_labels = None
depends_on = None


def upgrade():
    inspector = inspect(op.get_bind())
    cols = {c["name"] for c in inspector.get_columns("alerts")}

    has_product_id = "product_id" in cols
    has_log_id = "shelf_analysis_log_id" in cols

    if not has_product_id and has_log_id:
        return  # already at target state (e.g. fresh DB created by create_all)

    with op.batch_alter_table("alerts") as batch_op:
        if has_product_id:
            batch_op.drop_column("product_id")
        if not has_log_id:
            batch_op.add_column(
                sa.Column("shelf_analysis_log_id", sa.Integer(), nullable=True)
            )
            batch_op.create_foreign_key(
                "fk_alerts_shelf_analysis_log_id",
                "shelf_analysis_logs",
                ["shelf_analysis_log_id"],
                ["id"],
            )


def downgrade():
    inspector = inspect(op.get_bind())
    cols = {c["name"] for c in inspector.get_columns("alerts")}

    has_product_id = "product_id" in cols
    has_log_id = "shelf_analysis_log_id" in cols

    if has_product_id and not has_log_id:
        return

    # Look up the actual FK name — it may differ when the column was created by
    # create_all() rather than by this migration (Postgres auto-names it).
    fk_name = None
    for fk in inspector.get_foreign_keys("alerts"):
        if fk.get("constrained_columns") == ["shelf_analysis_log_id"]:
            fk_name = fk.get("name")
            break

    with op.batch_alter_table("alerts") as batch_op:
        if has_log_id:
            if fk_name:
                batch_op.drop_constraint(fk_name, type_="foreignkey")
            batch_op.drop_column("shelf_analysis_log_id")
        if not has_product_id:
            batch_op.add_column(sa.Column("product_id", sa.Integer(), nullable=True))
            batch_op.create_foreign_key(
                "fk_alerts_product_id",
                "products",
                ["product_id"],
                ["product_id"],
            )
