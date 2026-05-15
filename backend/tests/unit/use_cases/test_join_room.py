from unittest.mock import AsyncMock
from uuid import uuid4

import pytest

from src.application.use_cases.chat.join_room_use_case import (
    JoinRoomUseCase,
    RoomNotFoundError,
    RoomLockedError,
    AlreadyMemberError,
)
from src.domain.entities.room import Room
from src.domain.entities.room_member import RoomMember
from src.domain.value_objects.role import RoleId


def _room(locked: bool = False, private: bool = False) -> Room:
    return Room(id=uuid4(), name="#test", is_locked=locked, is_private=private)


@pytest.fixture
def user_id():
    return uuid4()


@pytest.fixture
def room_id():
    return uuid4()


@pytest.fixture
def mock_room_repo(room_id):
    repo = AsyncMock()
    repo.get_by_id = AsyncMock(return_value=Room(id=room_id, name="#test"))
    return repo


@pytest.fixture
def mock_member_repo():
    repo = AsyncMock()
    repo.get = AsyncMock(return_value=None)
    repo.save = AsyncMock(side_effect=lambda m: m)
    return repo


@pytest.mark.asyncio
async def test_join_room_creates_member(user_id, room_id, mock_room_repo, mock_member_repo):
    use_case = JoinRoomUseCase(mock_room_repo, mock_member_repo)
    member = await use_case.execute(user_id=user_id, room_id=room_id)

    assert member.user_id == user_id
    assert member.room_id == room_id
    assert member.role_id == RoleId.MEMBER
    mock_member_repo.save.assert_awaited_once()


@pytest.mark.asyncio
async def test_join_nonexistent_room_raises(user_id, room_id, mock_member_repo):
    room_repo = AsyncMock()
    room_repo.get_by_id = AsyncMock(return_value=None)
    use_case = JoinRoomUseCase(room_repo, mock_member_repo)

    with pytest.raises(RoomNotFoundError):
        await use_case.execute(user_id=user_id, room_id=room_id)


@pytest.mark.asyncio
async def test_join_locked_room_raises(user_id, room_id, mock_member_repo):
    room_repo = AsyncMock()
    room_repo.get_by_id = AsyncMock(return_value=Room(id=room_id, name="#test", is_locked=True))
    use_case = JoinRoomUseCase(room_repo, mock_member_repo)

    with pytest.raises(RoomLockedError):
        await use_case.execute(user_id=user_id, room_id=room_id)


@pytest.mark.asyncio
async def test_join_room_already_member_raises(user_id, room_id, mock_room_repo):
    member_repo = AsyncMock()
    member_repo.get = AsyncMock(return_value=RoomMember(
        user_id=user_id, room_id=room_id, role_id=RoleId.MEMBER
    ))
    use_case = JoinRoomUseCase(mock_room_repo, member_repo)

    with pytest.raises(AlreadyMemberError):
        await use_case.execute(user_id=user_id, room_id=room_id)
