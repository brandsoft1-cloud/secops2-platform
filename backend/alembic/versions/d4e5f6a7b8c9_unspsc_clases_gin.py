"""unspsc_clases (array) + índice GIN en opportunities

Revision ID: d4e5f6a7b8c9
Revises: c3d4e5f6a7b8
Create Date: 2026-06-30 15:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = 'd4e5f6a7b8c9'
down_revision: Union[str, Sequence[str], None] = 'c3d4e5f6a7b8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column(
        'opportunities',
        sa.Column('unspsc_clases', postgresql.ARRAY(sa.String()), nullable=False, server_default='{}'),
    )
    # Backfill: clases (6 díg) distintas a partir de unspsc_codes (JSON de 8 díg).
    op.execute(
        """
        UPDATE opportunities AS o
        SET unspsc_clases = sub.clases
        FROM (
            SELECT o2.id,
                   COALESCE(array_agg(DISTINCT left(c.value, 6))
                            FILTER (WHERE length(c.value) >= 6), '{}') AS clases
            FROM opportunities o2
            LEFT JOIN LATERAL json_array_elements_text(o2.unspsc_codes) AS c(value) ON true
            GROUP BY o2.id
        ) AS sub
        WHERE o.id = sub.id
        """
    )
    op.create_index(
        'ix_opportunities_unspsc_clases', 'opportunities', ['unspsc_clases'],
        postgresql_using='gin',
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index('ix_opportunities_unspsc_clases', table_name='opportunities')
    op.drop_column('opportunities', 'unspsc_clases')
