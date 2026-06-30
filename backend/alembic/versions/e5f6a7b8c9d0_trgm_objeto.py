"""índice trigram (pg_trgm) en objeto para ILIKE rápido

Revision ID: e5f6a7b8c9d0
Revises: d4e5f6a7b8c9
Create Date: 2026-06-30 15:30:00.000000

"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = 'e5f6a7b8c9d0'
down_revision: Union[str, Sequence[str], None] = 'd4e5f6a7b8c9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.execute("CREATE EXTENSION IF NOT EXISTS pg_trgm")
    op.create_index(
        'ix_opportunities_objeto_trgm', 'opportunities', ['objeto'],
        postgresql_using='gin', postgresql_ops={'objeto': 'gin_trgm_ops'},
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index('ix_opportunities_objeto_trgm', table_name='opportunities')
