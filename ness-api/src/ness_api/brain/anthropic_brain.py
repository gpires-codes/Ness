from collections.abc import AsyncIterator

from anthropic import (
    APIError,
    AsyncAnthropic,
    AuthenticationError,
    BadRequestError,
    RateLimitError,
)
from ness_api.actions.registry import list_for_anthropic
from ness_api.core.exceptions import (
    BrainProviderError,
    InsufficientCreditsError,
    InvalidApiKeyError,
)

from .base import (
    ActionCall,
    Brain,
    BrainStreamEvent,
    BrainResponse,
    TextDelta,
    ToolCallEvent,
)


class AnthropicBrain(Brain):
    def __init__(self, api_key: str, model: str = "claude-sonnet-5"):
        self.client = AsyncAnthropic(api_key=api_key)
        self.model = model

    async def get_response(self, messages: list[dict]) -> BrainResponse:
        tools = list_for_anthropic()

        cleaned_messages = []
        for m in messages:
            role = m.get("role")
            content = m.get("content", "")
            if role in ["system", "computer"]:
                cleaned_messages.append(
                    {"role": "user", "content": f"[SYSTEM]: {content}"}
                )
            else:
                cleaned_messages.append({"role": role, "content": content})

        kwargs = {
            "model": self.model,
            "max_tokens": 1024,
            "system": "Você é a Ness, uma assistente de voz. Seja breve nas respostas.",
            "messages": cleaned_messages,
        }

        if tools:
            kwargs["tools"] = tools

        try:
            resp = await self.client.messages.create(**kwargs)
        except AuthenticationError:
            raise InvalidApiKeyError(
                "A chave de API da Anthropic é inválida ou expirou."
            )
        except BadRequestError as e:
            if "credit" in str(e).lower() or "balance" in str(e).lower():
                raise InsufficientCreditsError(
                    "Saldo insuficiente na conta da Anthropic."
                )
            raise BrainProviderError(f"Erro na requisição para a Anthropic: {e}")
        except RateLimitError:
            raise InsufficientCreditsError(
                "Limite de requisições ou créditos atingido na Anthropic."
            )
        except APIError as e:
            raise BrainProviderError(f"Erro inesperado na Anthropic: {e}")

        texto = ""
        actions = []

        for bloco in resp.content:
            if bloco.type == "text":
                texto += bloco.text
            elif bloco.type == "tool_use":
                actions.append(ActionCall(name=bloco.name, parameters=bloco.input))

        return BrainResponse(text=texto, actions=actions)

    async def stream_response(
        self, messages: list[dict]
    ) -> AsyncIterator[BrainStreamEvent]:
        tools = list_for_anthropic()
        cleaned_messages = []
        for message in messages:
            role = message.get("role")
            content = message.get("content", "")
            if role in ["system", "computer"]:
                cleaned_messages.append(
                    {"role": "user", "content": f"[SYSTEM]: {content}"}
                )
            else:
                cleaned_messages.append({"role": role, "content": content})

        kwargs = {
            "model": self.model,
            "max_tokens": 1024,
            "system": "Você é a Ness, uma assistente de voz. Seja breve nas respostas.",
            "messages": cleaned_messages,
        }
        if tools:
            kwargs["tools"] = tools

        try:
            async with self.client.messages.stream(**kwargs) as stream:
                async for event in stream:
                    if (
                        event.type == "content_block_delta"
                        and event.delta.type == "text_delta"
                    ):
                        yield TextDelta(event.delta.text)

                response = await stream.get_final_message()
                for block in response.content:
                    if block.type == "tool_use":
                        yield ToolCallEvent(
                            ActionCall(name=block.name, parameters=block.input)
                        )
        except AuthenticationError:
            raise InvalidApiKeyError(
                "A chave de API da Anthropic é inválida ou expirou."
            )
        except BadRequestError as error:
            if "credit" in str(error).lower() or "balance" in str(error).lower():
                raise InsufficientCreditsError(
                    "Saldo insuficiente na conta da Anthropic."
                ) from error
            raise BrainProviderError(
                f"Erro na requisição para a Anthropic: {error}"
            ) from error
        except RateLimitError as error:
            raise InsufficientCreditsError(
                "Limite de requisições ou créditos atingido na Anthropic."
            ) from error
        except APIError as error:
            raise BrainProviderError(
                f"Erro inesperado na Anthropic: {error}"
            ) from error
