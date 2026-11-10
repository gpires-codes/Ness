import json

from ness_api.actions.registry import list_for_openai
from ness_api.core.exceptions import (
    BrainProviderError,
    InsufficientCreditsError,
    InvalidApiKeyError,
)
from openai import APIError, AsyncOpenAI, AuthenticationError, RateLimitError

from .base import ActionCall, Brain, BrainResponse


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
