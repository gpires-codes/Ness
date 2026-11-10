from collections.abc import Callable

from ness_api.core.credentials import get_api_key

from .anthropic_brain import AnthropicBrain
from .base import Brain
from .openai_brain import OpenAIBrain


def _get_required_key(provider: str) -> str:
    key = get_api_key(provider)
    if not key:
        raise ValueError(
            f"The API key for provider '{provider}' was not found in the system vault."
        )
    return key


FABRICAS: dict[str, Callable[[], Brain]] = {
    "openai:gpt-4o-mini": lambda: OpenAIBrain(
        api_key=_get_required_key("openai"), model="gpt-4o-mini"
    ),
    "openai:gpt-4o": lambda: OpenAIBrain(
        api_key=_get_required_key("openai"), model="gpt-4o"
    ),
    "anthropic:claude-sonnet-5": lambda: AnthropicBrain(
        api_key=_get_required_key("anthropic"), model="claude-sonnet-5"
    ),
    "anthropic:claude-haiku-4-5": lambda: AnthropicBrain(
        api_key=_get_required_key("anthropic"), model="claude-haiku-4-5-20251001"
    ),
}


def create_brain(chave: str) -> Brain:
    fabrica = FABRICAS.get(chave)
    if not fabrica:
        raise ValueError(f"Brain desconhecido: {chave}")
    return fabrica()


def list_brains() -> list[str]:
    return list(FABRICAS.keys())
