import json
from collections.abc import AsyncIterator

from ness_api.actions.registry import list_for_openai
from ness_api.core.exceptions import (
    BrainProviderError,
    InsufficientCreditsError,
    InvalidApiKeyError,
)
from openai import APIError, AsyncOpenAI, AuthenticationError, RateLimitError

from .base import (
    ActionCall,
    Brain,
    BrainResponse,
    BrainStreamEvent,
    TextDelta,
    ToolCallEvent,
)


class OpenAIBrain(Brain):
    def __init__(self, api_key: str, model: str = "gpt-4o-mini"):
        self.client = AsyncOpenAI(api_key=api_key)
        self.model = model

    async def get_response(self, messages: list[dict]) -> BrainResponse:
        kwargs = {
            "model": self.model,
            "messages": [
                {
                    "role": "system",
                    "content": "Você é a Ness, uma assistente de voz. Seja breve nas respostas.",
                },
                *messages,
            ],
            "tools": list_for_openai(),
            "tool_choice": "auto",
        }

        try:
            resp = await self.client.chat.completions.create(**kwargs)
        except AuthenticationError:
            raise InvalidApiKeyError("A chave de API da OpenAI é inválida.")
        except RateLimitError as e:
            # Na OpenAI, falta de saldo/crédito geralmente cai em RateLimitError (Quota Exceeded)
            if "quota" in str(e).lower() or "billing" in str(e).lower():
                raise InsufficientCreditsError(
                    "Saldo ou cota esgotada na sua conta OpenAI."
                )
            raise BrainProviderError(f"Limite de requisições excedido na OpenAI: {e}")
        except APIError as e:
            raise BrainProviderError(f"Erro inesperado na OpenAI: {e}")

        msg = resp.choices[0].message

        actions = [
            ActionCall(
                name=call.function.name, parameters=json.loads(call.function.arguments)
            )
            for call in (msg.tool_calls or [])
        ]

        return BrainResponse(text=msg.content or "", actions=actions)

    async def stream_response(
        self, messages: list[dict]
    ) -> AsyncIterator[BrainStreamEvent]:
        kwargs = {
            "model": self.model,
            "messages": [
                {
                    "role": "system",
                    "content": "Você é a Ness, uma assistente de voz. Seja breve nas respostas.",
                },
                *messages,
            ],
            "tools": list_for_openai(),
            "tool_choice": "auto",
            "stream": True,
        }
        tool_calls: dict[int, dict[str, str]] = {}

        try:
            stream = await self.client.chat.completions.create(**kwargs)
            async with stream:
                async for chunk in stream:
                    for choice in chunk.choices:
                        delta = choice.delta
                        if delta.content:
                            yield TextDelta(delta.content)
                        for tool_call in delta.tool_calls or []:
                            item = tool_calls.setdefault(
                                tool_call.index, {"name": "", "arguments": ""}
                            )
                            if tool_call.function.name:
                                item["name"] += tool_call.function.name
                            if tool_call.function.arguments:
                                item["arguments"] += tool_call.function.arguments

            for item in tool_calls.values():
                try:
                    parameters = json.loads(item["arguments"] or "{}")
                except json.JSONDecodeError as error:
                    raise BrainProviderError(
                        "A OpenAI retornou argumentos inválidos para uma ferramenta."
                    ) from error
                if not item["name"] or not isinstance(parameters, dict):
                    raise BrainProviderError(
                        "A OpenAI retornou uma chamada de ferramenta inválida."
                    )
                yield ToolCallEvent(
                    ActionCall(name=item["name"], parameters=parameters)
                )
        except AuthenticationError:
            raise InvalidApiKeyError("A chave de API da OpenAI é inválida.")
        except RateLimitError as error:
            if "quota" in str(error).lower() or "billing" in str(error).lower():
                raise InsufficientCreditsError(
                    "Saldo ou cota esgotada na sua conta OpenAI."
                ) from error
            raise BrainProviderError(
                f"Limite de requisições excedido na OpenAI: {error}"
            ) from error
        except APIError as error:
            raise BrainProviderError(f"Erro inesperado na OpenAI: {error}") from error
