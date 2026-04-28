#!/usr/bin/env python
"""
Drop all tables and data from the database.

Usage (inside the running backend container):
    python -m scripts.drop_all_tables

Via docker exec:
    docker exec oos_detection-backend python -m scripts.drop_all_tables

For RDS database, update SQLALCHEMY_DATABASE_URI in backend/.env first, then run.
"""

import sys
from pathlib import Path

# Allow running directly from the repo root
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app import create_app
from app.core.db import db
from sqlalchemy import text


def drop_all_tables():
    """Drop all tables from the database."""
    app = create_app()
    
    with app.app_context():
        # Get the database URL for confirmation
        db_url = app.config['SQLALCHEMY_DATABASE_URI']
        print(f"Target database: {db_url}")
        print("\n⚠️  WARNING: This will delete ALL tables and data!")
        
        # Get user confirmation
        response = input("Type 'yes' to confirm deletion: ").strip().lower()
        if response != 'yes':
            print("Cancelled.")
            return
        
        print("\nDropping all tables...")
        
        # Drop all tables
        db.drop_all()
        
        # Also clear the alembic_version table if it exists
        # (in case you want to re-run migrations from scratch)
        try:
            with db.engine.connect() as conn:
                conn.execute(text("DROP TABLE IF EXISTS alembic_version"))
                conn.commit()
        except Exception as e:
            print(f"Note: Could not drop alembic_version table: {e}")
        
        print("✓ All tables and data have been deleted.")
        print("\nYou can now:")
        print("  1. Run migrations: alembic upgrade head")
        print("  2. Seed sample data: python -m backend.db.init_db --seed")


if __name__ == "__main__":
    drop_all_tables()
