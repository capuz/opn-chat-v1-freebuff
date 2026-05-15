from uuid import UUID

from src.application.interfaces.repositories import IRoomMemberRepository
from src.domain.value_objects.role import RoleId

_MUTE_ALLOWED = {RoleId.MODERATOR, RoleId.OWNER}


class InsufficientRoleError(Exception):
    pass


class MuteUserUseCase:
    def __init__(self, room_member_repo: IRoomMemberRepository) -> None:
        self._members = room_member_repo

    async def execute(
        self,
        caller_id: UUID,
        target_user_id: UUID,
        room_id: UUID,
        mute: bool,
        is_admin: bool = False,
    ) -> None:
        if not is_admin:
            caller = await self._members.get(caller_id, room_id)
            if caller is None or caller.role_id not in _MUTE_ALLOWED:
                raise InsufficientRoleError("Requires Moderator or Owner role")

        target = await self._members.get(target_user_id, room_id)
        if target is None:
            return

        target.is_muted = mute
        await self._members.update(target)
