from datetime import datetime
from unittest.mock import AsyncMock
from uuid import uuid4

import pytest

from src.application.use_cases.chat.send_message_use_case import (
    SendMessageUseCase,
    MutedError,
    MessageTooLongError,
)
from src.domain.entities.message import Message
from src.domain.entities.room_member import RoomMember
from src.domain.value_objects.message_type import MessageType
from src.domain.value_objects.role import RoleId


def _member(muted: bool = False) -> RoomMember:
    return RoomMember(
        user_id=uuid4(),
        room_id=uuid4(),
        role_id=RoleId.MEMBER,
        is_muted=muted,
    )


@pytest.fixture
def user_id():
    return uuid4()


@pytest.fixture
def room_id():
    return uuid4()


@pytest.fixture
def mock_message_repo():
    repo = AsyncMock()
    repo.save = AsyncMock(side_effect=lambda m: m)
    return repo


@pytest.fixture
def mock_member_repo(user_id, room_id):
    repo = AsyncMock()
    repo.get = AsyncMock(return_value=RoomMember(
        user_id=user_id, room_id=room_id, role_id=RoleId.MEMBER, is_muted=False
    ))
    return repo


@pytest.mark.asyncio
async def test_send_message_returns_saved_message(user_id, room_id, mock_message_repo, mock_member_repo):
    use_case = SendMessageUseCase(mock_message_repo, mock_member_repo)
    result = await use_case.execute(user_id=user_id, room_id=room_id, content="hello")

    assert isinstance(result, Message)
    assert result.content == "hello"
    assert result.type == MessageType.NORMAL
    mock_message_repo.save.assert_awaited_once()


@pytest.mark.asyncio
async def test_send_message_action_type(user_id, room_id, mock_message_repo, mock_member_repo):
    use_case = SendMessageUseCase(mock_message_repo, mock_member_repo)
    result = await use_case.execute(user_id=user_id, room_id=room_id, content="jumps", message_type="action")
    assert result.type == MessageType.ACTION


@pytest.mark.asyncio
async def test_muted_user_raises_error(user_id, room_id, mock_message_repo):
    member_repo = AsyncMock()
    member_repo.get = AsyncMock(return_value=RoomMember(
        user_id=user_id, room_id=room_id, role_id=RoleId.MEMBER, is_muted=True
    ))
    use_case = SendMessageUseCase(mock_message_repo, member_repo)

    with pytest.raises(MutedError):
        await use_case.execute(user_id=user_id, room_id=room_id, content="hello")

    mock_message_repo.save.assert_not_awaited()


@pytest.mark.asyncio
async def test_message_too_long_raises_error(user_id, room_id, mock_message_repo, mock_member_repo):
    use_case = SendMessageUseCase(mock_message_repo, mock_member_repo)

    with pytest.raises(MessageTooLongError):
        await use_case.execute(user_id=user_id, room_id=room_id, content="x" * 2001)


@pytest.mark.asyncio
async def test_non_member_raises_permission_error(user_id, room_id, mock_message_repo):
    member_repo = AsyncMock()
    member_repo.get = AsyncMock(return_value=None)
    use_case = SendMessageUseCase(mock_message_repo, member_repo)

    with pytest.raises(PermissionError):
        await use_case.execute(user_id=user_id, room_id=room_id, content="hello")
