from enum import StrEnum


class MessageType(StrEnum):
    NORMAL = "normal"
    ACTION = "action"
    SYSTEM = "system"
