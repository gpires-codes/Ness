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

from .base import ActionCall, Brain, BrainResponse


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
