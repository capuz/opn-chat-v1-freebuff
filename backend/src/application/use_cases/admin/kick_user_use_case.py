from uuid import UUID

from src.application.interfaces.repositories import IRoomMemberRepository
from src.domain.value_objects.role import RoleId

_KICK_ALLOWED = {RoleId.MODERATOR, RoleId.OWNER}
_ROLE_RANK = {RoleId.MEMBER: 0, RoleId.MODERATOR: 1, RoleId.OWNER: 2}


class InsufficientRoleError(Exception):
    pass


class KickUserUseCase:
    def __init__(self, room_member_repo: IRoomMemberRepository) -> None:
        self._members = room_member_repo

    async def execute(
        self,
        caller_id: UUID,
        target_user_id: UUID,
        room_id: UUID,
        is_admin: bool = False,
    ) -> None:
        if not is_admin:
            caller = await self._members.get(caller_id, room_id)
            if caller is None or caller.role_id not in _KICK_ALLOWED:
                raise InsufficientRoleError("Requires Moderator or Owner role")

            target = await self._members.get(target_user_id, room_id)
            if target and _ROLE_RANK.get(target.role_id, 0) >= _ROLE_RANK.get(caller.role_id, 0):
                raise InsufficientRoleError("Cannot kick someone with equal or higher role")

        await self._members.delete(target_user_id, room_id)
