"""Add brand/variant/size/shelf_status/last_checked to products; add shelf_analysis_logs table

Revision ID: 0002
Revises: 0001
Create Date: 2026-04-22
"""

import sqlalchemy as sa
from alembic import op

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None


def upgrade():
    # ── New columns on products ──────────────────────────────────────────────
    with op.batch_alter_table("products") as batch_op:
        batch_op.add_column(sa.Column("brand",        sa.String(80),  server_default="", nullable=False))
        batch_op.add_column(sa.Column("variant",      sa.String(80),  server_default="", nullable=False))
        batch_op.add_column(sa.Column("size",         sa.String(50),  server_default="", nullable=False))
        batch_op.add_column(sa.Column("shelf_status", sa.String(50),  server_default="unknown", nullable=False))
        batch_op.add_column(sa.Column("last_checked", sa.DateTime(timezone=True), nullable=True))

    # ── New shelf_analysis_logs table ────────────────────────────────────────
    op.create_table(
        "shelf_analysis_logs",
        sa.Column("id",          sa.Integer(),                         primary_key=True, autoincrement=True),
        sa.Column("user_id",     sa.Integer(),                         sa.ForeignKey("users.user_id"), nullable=True),
        sa.Column("file_name",   sa.String(255),                       nullable=False),
        sa.Column("result_json", sa.Text(),                            nullable=False),
        sa.Column("created_at",  sa.DateTime(timezone=True),          server_default=sa.func.now(), nullable=False),
    )


def downgrade():
    op.drop_table("shelf_analysis_logs")

    with op.batch_alter_table("products") as batch_op:
        batch_op.drop_column("last_checked")
        batch_op.drop_column("shelf_status")
        batch_op.drop_column("size")
        batch_op.drop_column("variant")
        batch_op.drop_column("brand")
