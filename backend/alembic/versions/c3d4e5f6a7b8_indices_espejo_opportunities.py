"""índices para el espejo local (opportunities)

Revision ID: c3d4e5f6a7b8
Revises: b2c3d4e5f6a7
Create Date: 2026-06-30 14:00:00.000000

"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = 'c3d4e5f6a7b8'
down_revision: Union[str, Sequence[str], None] = 'b2c3d4e5f6a7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_index('ix_opportunities_departamento', 'opportunities', ['departamento'])
    op.create_index('ix_opportunities_fecha_publicacion', 'opportunities', ['fecha_publicacion'])
    op.create_index('ix_opportunities_modalidad', 'opportunities', ['modalidad'])


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index('ix_opportunities_modalidad', table_name='opportunities')
    op.drop_index('ix_opportunities_fecha_publicacion', table_name='opportunities')
    op.drop_index('ix_opportunities_departamento', table_name='opportunities')
