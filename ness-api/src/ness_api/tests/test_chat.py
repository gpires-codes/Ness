import asyncio

import pytest
from fastapi import HTTPException

from ness_api.brain.base import ActionCall, TextDelta, ToolCallEvent
from ness_api.core.exceptions import InvalidApiKeyError
from ness_api.routes import chat


def make_request(**overrides):
    values = {
        "threadId": "thread-1",
        "runId": "run-1",
        "messages": [{"role": "user", "content": "Oi"}],
        "forwardedProps": {"model": "openai:gpt-4o-mini"},
    }
    values.update(overrides)
    return chat.ChatRequest(**values)


def collect_body(response) -> str:
    async def collect():
        chunks = [chunk async for chunk in response.body_iterator]
        return "".join(
            chunk.decode() if isinstance(chunk, bytes) else chunk for chunk in chunks
        )

    return asyncio.run(collect())


def test_model_catalog_is_filtered_by_capability(monkeypatch):
    monkeypatch.setattr(
        chat,
        "list_models",
        lambda capability: [
            type(
                "Model",
                (),
                {
                    "id": "local:whisper",
                    "label": "Whisper",
                    "provider": "local",
                    "capabilities": ("stt",),
                },
            )()
        ]
        if capability == "stt"
        else [],
    )

    assert chat.get_chat_models("stt") == [
        {
            "id": "local:whisper",
            "label": "Whisper",
            "provider": "local",
            "capabilities": ("stt",),
        }
    ]
    assert chat.get_chat_models("tts") == []


def test_chat_streams_ag_ui_text_and_tool_call_events(monkeypatch):
    class FakeBrain:
        async def stream_response(self, messages):
            assert messages == [{"role": "user", "content": "Oi"}]
            yield TextDelta("Olá")
            yield ToolCallEvent(ActionCall("calendar.read", {"day": "today"}))

    monkeypatch.setattr(chat, "list_brains", lambda: ["openai:gpt-4o-mini"])
    monkeypatch.setattr(chat, "create_brain", lambda _model: FakeBrain())

    response = asyncio.run(chat.stream_chat(make_request()))
    body = collect_body(response)

    assert response.media_type == "text/event-stream"
    assert '"type": "RUN_STARTED"' in body
    assert '"type": "TEXT_MESSAGE_START"' in body
    assert '"type": "TEXT_MESSAGE_CONTENT", "messageId"' in body
    assert '"delta": "Olá"' in body
    assert '"type": "TEXT_MESSAGE_END"' in body
    assert '"type": "TOOL_CALL_START"' in body
    assert '"toolCallName": "calendar.read"' in body
    assert '"type": "TOOL_CALL_ARGS"' in body
    assert '"type": "TOOL_CALL_END"' in body
    assert '"type": "RUN_FINISHED"' in body


def test_chat_reports_missing_provider_key(monkeypatch):
    monkeypatch.setattr(chat, "list_brains", lambda: ["openai:gpt-4o-mini"])

    def missing_key(_model):
        raise ValueError("provider key missing")

    monkeypatch.setattr(chat, "create_brain", missing_key)

    with pytest.raises(HTTPException) as error:
        asyncio.run(chat.stream_chat(make_request()))

    assert error.value.status_code == 409
    assert "OpenAI" in error.value.detail


def test_streaming_provider_error_is_an_ag_ui_run_error(monkeypatch):
    class FakeBrain:
        async def stream_response(self, _messages):
            raise InvalidApiKeyError("A chave é inválida.")
            yield

    monkeypatch.setattr(chat, "list_brains", lambda: ["openai:gpt-4o-mini"])
    monkeypatch.setattr(chat, "create_brain", lambda _model: FakeBrain())

    response = asyncio.run(chat.stream_chat(make_request()))
    body = collect_body(response)

    assert '"type": "RUN_ERROR"' in body
    assert '"code": "invalid_api_key"' in body
    assert '"runId": "run-1"' in body
    assert '"type": "RUN_FINISHED"' not in body


def test_chat_rejects_non_user_final_message():
    with pytest.raises(ValueError, match="last chat message must be from the user"):
        make_request(messages=[{"role": "assistant", "content": "Resposta"}])


def test_chat_rejects_unregistered_model(monkeypatch):
    monkeypatch.setattr(chat, "list_brains", lambda: ["openai:gpt-4o-mini"])

    with pytest.raises(HTTPException) as error:
        asyncio.run(
            chat.stream_chat(
                make_request(forwardedProps={"model": "https://attacker.example"})
            )
        )

    assert error.value.status_code == 422
