"""Initial schema (existing tables — stamp only, do not re-create)

Revision ID: 0001
Revises:
Create Date: 2026-04-22

This migration represents the schema that already exists in the database
(created via db.create_all() before Flask-Migrate was introduced).
Run `flask db stamp 0001` to mark the database as up-to-date with this
revision WITHOUT running any SQL, then run `flask db upgrade` to apply
the next migration (0002) which adds the new columns and tables.
"""

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    # Intentionally empty — existing tables were created by db.create_all().
    pass


def downgrade():
    pass
