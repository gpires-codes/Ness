import json
import logging
from collections.abc import AsyncIterator
from typing import Literal, Self

from fastapi import APIRouter, HTTPException, status
from keyring.errors import KeyringError
from pydantic import BaseModel, Field, model_validator
from starlette.responses import StreamingResponse

from ness_api.brain.base import TextDelta, ToolCallEvent
from ness_api.brain.factory import create_brain, list_brains
from ness_api.core.exceptions import (
    BrainProviderError,
    InsufficientCreditsError,
    InvalidApiKeyError,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/chat", tags=["Chat"])


class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=8000)


class ChatRequest(BaseModel):
    model: str = "openai:gpt-4o-mini"
    messages: list[ChatMessage] = Field(min_length=1, max_length=50)

    @model_validator(mode="after")
    def last_message_must_be_from_user(self) -> Self:
        if self.messages[-1].role != "user":
            raise ValueError("The last chat message must be from the user")
        if not self.messages[-1].content.strip():
            raise ValueError("The last chat message cannot be blank")
        return self


def _sse(event: str, data: dict) -> str:
    return f"event: {event}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"


@router.post("")
async def stream_chat(request: ChatRequest):
    if request.model not in list_brains():
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="The selected model is not supported",
        )

    try:
        brain = create_brain(request.model)
    except KeyringError as error:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Não foi possível acessar o cofre de credenciais do sistema.",
        ) from error
    except ValueError as error:
        provider = {
            "openai": "OpenAI",
            "anthropic": "Anthropic",
        }[request.model.partition(":")[0]]
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Configure a chave de API da {provider} em Configurações.",
        ) from error

    messages = [message.model_dump() for message in request.messages]

    async def events() -> AsyncIterator[str]:
        yield _sse("start", {"model": request.model})
        try:
            async for event in brain.stream_response(messages):
                if isinstance(event, TextDelta):
                    yield _sse("delta", {"text": event.text})
                elif isinstance(event, ToolCallEvent):
                    yield _sse(
                        "tool_call",
                        {
                            "name": event.action.name,
                            "parameters": event.action.parameters,
                        },
                    )
            yield _sse("done", {})
        except InsufficientCreditsError as error:
            yield _sse(
                "error",
                {"code": "insufficient_credits", "message": str(error)},
            )
        except InvalidApiKeyError as error:
            yield _sse("error", {"code": "invalid_api_key", "message": str(error)})
        except BrainProviderError as error:
            yield _sse("error", {"code": "provider_error", "message": str(error)})
        except Exception:
            logger.exception("Unexpected error while streaming a chat response")
            yield _sse(
                "error",
                {
                    "code": "internal_error",
                    "message": "Ocorreu um erro inesperado ao gerar a resposta.",
                },
            )

    return StreamingResponse(
        events(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )
