"""initial_schema

Revision ID: eaffbe057267
Revises:
Create Date: 2026-05-13

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "eaffbe057267"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("email", sa.String(255), unique=True, nullable=False),
        sa.Column("nickname", sa.String(30), unique=True, nullable=False),
        sa.Column("google_id", sa.String(255), unique=True, nullable=True),
        sa.Column("password_hash", sa.String(255), nullable=True),
        sa.Column("avatar_url", sa.String(500), nullable=True),
        sa.Column("bio", sa.String(500), nullable=True),
        sa.Column("status", sa.String(100), nullable=True),
        sa.Column("last_seen", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
        sa.Column("nickname_changes_today", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("nickname_changes_date", sa.Date(), nullable=True),
        sa.Column("nick_ad_unlocked_until", sa.DateTime(), nullable=True),
        sa.Column("country_code", sa.String(2), nullable=True),
        sa.Column("show_flag", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("global_badge", sa.String(20), nullable=True),
        sa.Column("is_admin", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("is_deactivated", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("preferred_language", sa.String(10), nullable=False, server_default="auto"),
        sa.Column("timezone", sa.String(50), nullable=True),
    )

    op.create_table(
        "rooms",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("name", sa.String(32), unique=True, nullable=False),
        sa.Column("description", sa.String(500), nullable=True),
        sa.Column("is_private", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("password_hash", sa.String(255), nullable=True),
        sa.Column("is_locked", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("is_system", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("is_archived", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("created_by_id", sa.Uuid(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("last_activity_at", sa.DateTime(), nullable=True),
    )

    op.create_table(
        "room_members",
        sa.Column("user_id", sa.Uuid(), sa.ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("room_id", sa.Uuid(), sa.ForeignKey("rooms.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("role_id", sa.String(36), nullable=False),
        sa.Column("joined_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("is_muted", sa.Boolean(), nullable=False, server_default="false"),
    )

    op.create_table(
        "messages",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("room_id", sa.Uuid(), sa.ForeignKey("rooms.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_id", sa.Uuid(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=False),
        sa.Column("content", sa.String(2000), nullable=False),
        sa.Column("type", sa.String(10), nullable=False, server_default="normal"),
        sa.Column("reply_to_id", sa.Uuid(), sa.ForeignKey("messages.id", ondelete="SET NULL"), nullable=True),
        sa.Column("timestamp", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("is_edited", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("is_deleted", sa.Boolean(), nullable=False, server_default="false"),
    )

    op.create_table(
        "private_messages",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("sender_id", sa.Uuid(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=False),
        sa.Column("receiver_id", sa.Uuid(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=False),
        sa.Column("content", sa.String(2000), nullable=False),
        sa.Column("timestamp", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("is_read", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("read_at", sa.DateTime(), nullable=True),
        sa.Column("is_deleted_by_sender", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("is_deleted_by_receiver", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("is_deleted_for_everyone", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("deleted_at", sa.DateTime(), nullable=True),
    )

    op.create_table(
        "bans",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("user_id", sa.Uuid(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("banned_by_id", sa.Uuid(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=False),
        sa.Column("reason", sa.String(500), nullable=False),
        sa.Column("banned_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("expires_at", sa.DateTime(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
    )

    op.create_table(
        "refresh_tokens",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("user_id", sa.Uuid(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("token", sa.String(128), unique=True, nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("expires_at", sa.DateTime(), nullable=False),
        sa.Column("is_used", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("is_revoked", sa.Boolean(), nullable=False, server_default="false"),
    )

    # Indices para queries frecuentes
    op.create_index("ix_messages_room_timestamp", "messages", ["room_id", "timestamp"])
    op.create_index("ix_messages_is_deleted", "messages", ["is_deleted"])
    op.create_index("ix_private_messages_receiver", "private_messages", ["receiver_id", "is_read"])
    op.create_index("ix_private_messages_conversation", "private_messages", ["sender_id", "receiver_id"])
    op.create_index("ix_bans_user_active", "bans", ["user_id", "is_active"])
    op.create_index("ix_refresh_tokens_user", "refresh_tokens", ["user_id"])

    # Seed: salas del sistema — nombres sin '#', el '#' es decoración de UI
    op.execute("""
        INSERT INTO rooms (id, name, description, is_system, created_at)
        VALUES
            ('11111111-1111-1111-1111-111111111111', 'general', 'General discussion', true, now()),
            ('22222222-2222-2222-2222-222222222222', 'random',  'Random chat',        true, now()),
            ('33333333-3333-3333-3333-333333333333', 'help',    'Help & support',     true, now())
    """)


def downgrade() -> None:
    op.drop_index("ix_refresh_tokens_user", "refresh_tokens")
    op.drop_index("ix_bans_user_active", "bans")
    op.drop_index("ix_private_messages_conversation", "private_messages")
    op.drop_index("ix_private_messages_receiver", "private_messages")
    op.drop_index("ix_messages_is_deleted", "messages")
    op.drop_index("ix_messages_room_timestamp", "messages")
    op.drop_table("refresh_tokens")
    op.drop_table("bans")
    op.drop_table("private_messages")
    op.drop_table("messages")
    op.drop_table("room_members")
    op.drop_table("rooms")
    op.drop_table("users")
