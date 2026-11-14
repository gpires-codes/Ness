import asyncio

import pytest
from fastapi import HTTPException

from ness_api.brain.base import ActionCall, TextDelta, ToolCallEvent
from ness_api.core.exceptions import InvalidApiKeyError
from ness_api.routes import chat


def collect_body(response) -> str:
    async def collect():
        chunks = [chunk async for chunk in response.body_iterator]
        return "".join(
            chunk.decode() if isinstance(chunk, bytes) else chunk for chunk in chunks
        )

    return asyncio.run(collect())


def test_chat_streams_text_and_tool_calls(monkeypatch):
    class FakeBrain:
        async def stream_response(self, messages):
            assert messages == [
                {"role": "user", "content": "Oi"},
            ]
            yield TextDelta("Olá")
            yield ToolCallEvent(ActionCall("calendar.read", {"day": "today"}))

    monkeypatch.setattr(chat, "list_brains", lambda: ["openai:gpt-4o-mini"])
    monkeypatch.setattr(chat, "create_brain", lambda _model: FakeBrain())

    response = asyncio.run(
        chat.stream_chat(
            chat.ChatRequest(
                model="openai:gpt-4o-mini",
                messages=[{"role": "user", "content": "Oi"}],
            )
        )
    )
    body = collect_body(response)

    assert response.media_type == "text/event-stream"
    assert 'event: delta\ndata: {"text": "Olá"}' in body
    assert '"name": "calendar.read"' in body
    assert 'event: done\ndata: {}' in body


def test_chat_reports_missing_provider_key(monkeypatch):
    monkeypatch.setattr(chat, "list_brains", lambda: ["openai:gpt-4o-mini"])

    def missing_key(_model):
        raise ValueError("provider key missing")

    monkeypatch.setattr(chat, "create_brain", missing_key)

    with pytest.raises(HTTPException) as error:
        asyncio.run(
            chat.stream_chat(
                chat.ChatRequest(
                    model="openai:gpt-4o-mini",
                    messages=[{"role": "user", "content": "Oi"}],
                )
            )
        )

    assert error.value.status_code == 409
    assert "OpenAI" in error.value.detail


def test_streaming_provider_error_is_an_sse_error(monkeypatch):
    class FakeBrain:
        async def stream_response(self, _messages):
            raise InvalidApiKeyError("A chave é inválida.")
            yield

    monkeypatch.setattr(chat, "list_brains", lambda: ["openai:gpt-4o-mini"])
    monkeypatch.setattr(chat, "create_brain", lambda _model: FakeBrain())

    response = asyncio.run(
        chat.stream_chat(
            chat.ChatRequest(
                model="openai:gpt-4o-mini",
                messages=[{"role": "user", "content": "Oi"}],
            )
        )
    )
    body = collect_body(response)

    assert '"code": "invalid_api_key"' in body
    assert 'event: done' not in body


def test_chat_rejects_non_user_final_message():
    with pytest.raises(ValueError, match="last chat message must be from the user"):
        chat.ChatRequest(
            model="openai:gpt-4o-mini",
            messages=[{"role": "assistant", "content": "Resposta"}],
        )
