"""IA (resumen/afinidad/asistente) en postulaciones y telegram_chat_id en empresas

Revision ID: 7c1e9a4b2d10
Revises: 42facff58357
Create Date: 2026-06-24 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '7c1e9a4b2d10'
down_revision: Union[str, Sequence[str], None] = '42facff58357'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('companies', sa.Column('telegram_chat_id', sa.String(length=40), nullable=True))
    op.add_column('postulaciones', sa.Column('ia_resumen', sa.Text(), nullable=True))
    op.add_column('postulaciones', sa.Column('ia_afinidad', sa.Integer(), nullable=True))
    op.add_column('postulaciones', sa.Column('ia_motivo', sa.Text(), nullable=True))
    op.add_column('postulaciones', sa.Column('ia_checklist', sa.JSON(), nullable=True))
    op.add_column('postulaciones', sa.Column('ia_carta', sa.Text(), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('postulaciones', 'ia_carta')
    op.drop_column('postulaciones', 'ia_checklist')
    op.drop_column('postulaciones', 'ia_motivo')
    op.drop_column('postulaciones', 'ia_afinidad')
    op.drop_column('postulaciones', 'ia_resumen')
    op.drop_column('companies', 'telegram_chat_id')
