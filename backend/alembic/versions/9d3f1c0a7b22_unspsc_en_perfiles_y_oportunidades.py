"""UNSPSC codes en search_profiles y opportunities (matching por código)

Revision ID: 9d3f1c0a7b22
Revises: 7c1e9a4b2d10
Create Date: 2026-06-25 16:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '9d3f1c0a7b22'
down_revision: Union[str, Sequence[str], None] = '7c1e9a4b2d10'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column(
        'search_profiles',
        sa.Column('unspsc_codes', sa.JSON(), nullable=False, server_default='[]'),
    )
    op.add_column(
        'opportunities',
        sa.Column('unspsc_codes', sa.JSON(), nullable=False, server_default='[]'),
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('opportunities', 'unspsc_codes')
    op.drop_column('search_profiles', 'unspsc_codes')
