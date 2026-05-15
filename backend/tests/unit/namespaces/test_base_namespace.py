import asyncio
import pytest
from unittest.mock import AsyncMock, patch

from src.realtime.namespaces.base_namespace import BaseNamespace


class ConcreteNamespace(BaseNamespace):
    pass


@pytest.fixture
def ns():
    namespace = ConcreteNamespace("/test")
    namespace.emit = AsyncMock()
    return namespace


@pytest.mark.asyncio
async def test_handle_calls_coro(ns):
    called = []

    async def work():
        called.append(True)
        return 42

    result = await ns._handle("sid-1", work)
    assert result == 42
    assert called == [True]


@pytest.mark.asyncio
async def test_handle_timeout_emits_server_error(ns):
    async def slow():
        await asyncio.sleep(99)

    await ns._handle("sid-1", slow, timeout=0.01)

    ns.emit.assert_awaited_once()
    call_args = ns.emit.call_args
    assert call_args[0][0] == "server_error"
    assert call_args[1]["room"] == "sid-1"
    assert call_args[0][1]["code"] == "TIMEOUT"


@pytest.mark.asyncio
async def test_handle_exception_emits_server_error(ns):
    async def boom():
        raise ValueError("something broke")

    await ns._handle("sid-1", boom)

    ns.emit.assert_awaited_once()
    call_args = ns.emit.call_args
    assert call_args[0][1]["code"] == "INTERNAL"
