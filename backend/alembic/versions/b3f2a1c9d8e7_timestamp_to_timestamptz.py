"""timestamp_to_timestamptz

Revision ID: b3f2a1c9d8e7
Revises: eaffbe057267
Create Date: 2026-05-15

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "b3f2a1c9d8e7"
down_revision: Union[str, None] = "eaffbe057267"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_TIMESTAMP_COLUMNS: list[tuple[str, str]] = [
    ("users", "last_seen"),
    ("users", "created_at"),
    ("users", "updated_at"),
    ("users", "nick_ad_unlocked_until"),
    ("rooms", "created_at"),
    ("rooms", "last_activity_at"),
    ("room_members", "joined_at"),
    ("messages", "timestamp"),
    ("private_messages", "timestamp"),
    ("private_messages", "read_at"),
    ("private_messages", "deleted_at"),
    ("bans", "banned_at"),
    ("bans", "expires_at"),
    ("refresh_tokens", "created_at"),
    ("refresh_tokens", "expires_at"),
]


def upgrade() -> None:
    for table, column in _TIMESTAMP_COLUMNS:
        op.alter_column(
            table,
            column,
            type_=sa.DateTime(timezone=True),
            postgresql_using=f"{column} AT TIME ZONE 'UTC'",
        )


def downgrade() -> None:
    for table, column in reversed(_TIMESTAMP_COLUMNS):
        op.alter_column(
            table,
            column,
            type_=sa.DateTime(timezone=False),
            postgresql_using=f"{column} AT TIME ZONE 'UTC'",
        )
