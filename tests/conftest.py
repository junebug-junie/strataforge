"""Shared pytest fixtures for all tests."""

from __future__ import annotations

import httpx
import pytest


def _make_client_ctx(transport: httpx.MockTransport) -> type:
    """Return a context-manager class that wraps a real httpx.Client with the given transport."""
    real_client = httpx.Client

    class _ClientCtx:
        def __init__(self, timeout: float = 180.0):
            self._inner = real_client(transport=transport, timeout=timeout)

        def __enter__(self):
            return self._inner

        def __exit__(self, *args):
            self._inner.close()

    return _ClientCtx


@pytest.fixture
def mock_httpx_client(monkeypatch):
    """Return a factory that installs a mock httpx.Client for the given response handler.

    Usage::

        def test_foo(mock_httpx_client):
            def handler(request):
                return httpx.Response(200, json={...})
            mock_httpx_client(handler)
            # ... call code that uses httpx.Client ...
    """

    def factory(handler):
        transport = httpx.MockTransport(handler)
        cls = _make_client_ctx(transport)
        monkeypatch.setattr("strataforge.llm.providers.httpx.Client", cls)

    return factory
