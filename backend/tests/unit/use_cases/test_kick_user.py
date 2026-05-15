from unittest.mock import AsyncMock
from uuid import uuid4

import pytest

from src.application.use_cases.admin.kick_user_use_case import (
    KickUserUseCase,
    InsufficientRoleError,
)
from src.domain.entities.room_member import RoomMember
from src.domain.value_objects.role import RoleId


def _member(user_id, room_id, role: RoleId) -> RoomMember:
    return RoomMember(user_id=user_id, room_id=room_id, role_id=role)


@pytest.fixture
def room_id():
    return uuid4()


@pytest.fixture
def caller_id():
    return uuid4()


@pytest.fixture
def target_id():
    return uuid4()


@pytest.mark.asyncio
async def test_moderator_can_kick_member(caller_id, target_id, room_id):
    repo = AsyncMock()
    repo.get = AsyncMock(side_effect=lambda uid, rid: (
        _member(caller_id, room_id, RoleId.MODERATOR) if uid == caller_id
        else _member(target_id, room_id, RoleId.MEMBER)
    ))
    repo.delete = AsyncMock()

    use_case = KickUserUseCase(repo)
    await use_case.execute(caller_id=caller_id, target_user_id=target_id, room_id=room_id)

    repo.delete.assert_awaited_once_with(target_id, room_id)


@pytest.mark.asyncio
async def test_member_cannot_kick(caller_id, target_id, room_id):
    repo = AsyncMock()
    repo.get = AsyncMock(side_effect=lambda uid, rid: (
        _member(caller_id, room_id, RoleId.MEMBER) if uid == caller_id
        else _member(target_id, room_id, RoleId.MEMBER)
    ))

    use_case = KickUserUseCase(repo)

    with pytest.raises(InsufficientRoleError):
        await use_case.execute(caller_id=caller_id, target_user_id=target_id, room_id=room_id)


@pytest.mark.asyncio
async def test_admin_can_kick_regardless_of_room_role(caller_id, target_id, room_id):
    repo = AsyncMock()
    repo.get = AsyncMock(side_effect=lambda uid, rid: (
        None if uid == caller_id  # admin may not be in the room
        else _member(target_id, room_id, RoleId.OWNER)
    ))
    repo.delete = AsyncMock()

    use_case = KickUserUseCase(repo)
    await use_case.execute(
        caller_id=caller_id, target_user_id=target_id, room_id=room_id, is_admin=True
    )

    repo.delete.assert_awaited_once_with(target_id, room_id)


@pytest.mark.asyncio
async def test_owner_cannot_kick_another_owner(caller_id, target_id, room_id):
    repo = AsyncMock()
    repo.get = AsyncMock(side_effect=lambda uid, rid: (
        _member(caller_id, room_id, RoleId.OWNER) if uid == caller_id
        else _member(target_id, room_id, RoleId.OWNER)
    ))

    use_case = KickUserUseCase(repo)

    with pytest.raises(InsufficientRoleError):
        await use_case.execute(caller_id=caller_id, target_user_id=target_id, room_id=room_id)
