import json
import logging
from collections.abc import AsyncIterator
from typing import Any, Literal, Self
from uuid import uuid4

from fastapi import APIRouter, HTTPException, Query, status
from keyring.errors import KeyringError
from pydantic import BaseModel, ConfigDict, Field, model_validator
from starlette.responses import StreamingResponse

from ness_api.brain.base import TextDelta, ToolCallEvent
from ness_api.brain.factory import (
    Capability,
    create_brain,
    list_brains,
    list_models,
)
from ness_api.core.exceptions import (
    BrainProviderError,
    InsufficientCreditsError,
    InvalidApiKeyError,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/chat", tags=["Chat"])


class ChatMessage(BaseModel):
    model_config = ConfigDict(extra="ignore")

    role: Literal["user", "assistant"]
    content: str = Field(default="", max_length=8000)


class ChatRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")

    thread_id: str = Field(alias="threadId", min_length=1, max_length=128)
    run_id: str = Field(alias="runId", min_length=1, max_length=128)
    messages: list[ChatMessage] = Field(min_length=1, max_length=100)
    forwarded_props: dict[str, Any] = Field(
        default_factory=dict, alias="forwardedProps"
    )

    @model_validator(mode="after")
    def last_message_must_be_from_user(self) -> Self:
        if self.messages[-1].role != "user":
            raise ValueError("The last chat message must be from the user")
        if not self.messages[-1].content.strip():
            raise ValueError("The last chat message cannot be blank")
        return self


def _sse(event: dict[str, Any]) -> str:
    return f"data: {json.dumps(event, ensure_ascii=False)}\n\n"


def _run_error(request: ChatRequest, code: str, message: str) -> str:
    return _sse(
        {
            "type": "RUN_ERROR",
            "threadId": request.thread_id,
            "runId": request.run_id,
            "code": code,
            "message": message,
        }
    )


@router.get("/models")
def get_chat_models(
    capability: Capability = Query(default="chat"),
) -> list[dict[str, Any]]:
    return [
        {
            "id": model.id,
            "label": model.label,
            "provider": model.provider,
            "capabilities": model.capabilities,
        }
        for model in list_models(capability)
    ]


@router.post("")
async def stream_chat(request: ChatRequest):
    model_id = request.forwarded_props.get("model", "openai:gpt-4o-mini")
    if not isinstance(model_id, str) or model_id not in list_brains():
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="The selected chat model is not supported",
        )

    try:
        brain = create_brain(model_id)
    except KeyringError as error:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Não foi possível acessar o cofre de credenciais do sistema.",
        ) from error
    except ValueError as error:
        model = next(model for model in list_models("chat") if model.id == model_id)
        provider = "OpenAI" if model.provider == "openai" else "Anthropic"
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Configure a chave de API da {provider} em Configurações.",
        ) from error

    messages = [message.model_dump() for message in request.messages[-50:]]

    async def events() -> AsyncIterator[str]:
        yield _sse(
            {
                "type": "RUN_STARTED",
                "threadId": request.thread_id,
                "runId": request.run_id,
            }
        )
        message_id: str | None = None

        try:
            async for event in brain.stream_response(messages):
                if isinstance(event, TextDelta):
                    if message_id is None:
                        message_id = str(uuid4())
                        yield _sse(
                            {
                                "type": "TEXT_MESSAGE_START",
                                "messageId": message_id,
                                "role": "assistant",
                            }
                        )
                    yield _sse(
                        {
                            "type": "TEXT_MESSAGE_CONTENT",
                            "messageId": message_id,
                            "delta": event.text,
                        }
                    )
                elif isinstance(event, ToolCallEvent):
                    if message_id is not None:
                        yield _sse(
                            {"type": "TEXT_MESSAGE_END", "messageId": message_id}
                        )
                        message_id = None

                    tool_call_id = str(uuid4())
                    yield _sse(
                        {
                            "type": "TOOL_CALL_START",
                            "toolCallId": tool_call_id,
                            "toolCallName": event.action.name,
                        }
                    )
                    yield _sse(
                        {
                            "type": "TOOL_CALL_ARGS",
                            "toolCallId": tool_call_id,
                            "delta": json.dumps(
                                event.action.parameters, ensure_ascii=False
                            ),
                        }
                    )
                    yield _sse(
                        {"type": "TOOL_CALL_END", "toolCallId": tool_call_id}
                    )

            if message_id is not None:
                yield _sse({"type": "TEXT_MESSAGE_END", "messageId": message_id})
            yield _sse(
                {
                    "type": "RUN_FINISHED",
                    "threadId": request.thread_id,
                    "runId": request.run_id,
                    "outcome": {"type": "success"},
                }
            )
        except InsufficientCreditsError as error:
            if message_id is not None:
                yield _sse({"type": "TEXT_MESSAGE_END", "messageId": message_id})
            yield _run_error(request, "insufficient_credits", str(error))
        except InvalidApiKeyError as error:
            if message_id is not None:
                yield _sse({"type": "TEXT_MESSAGE_END", "messageId": message_id})
            yield _run_error(request, "invalid_api_key", str(error))
        except BrainProviderError as error:
            if message_id is not None:
                yield _sse({"type": "TEXT_MESSAGE_END", "messageId": message_id})
            yield _run_error(request, "provider_error", str(error))
        except Exception:
            logger.exception("Unexpected error while streaming a chat response")
            if message_id is not None:
                yield _sse({"type": "TEXT_MESSAGE_END", "messageId": message_id})
            yield _run_error(
                request,
                "internal_error",
                "Ocorreu um erro inesperado ao gerar a resposta.",
            )

    return StreamingResponse(
        events(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )
