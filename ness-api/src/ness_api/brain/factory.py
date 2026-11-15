from collections.abc import Callable
from dataclasses import dataclass
from typing import Literal

from ness_api.core.credentials import get_api_key

from .anthropic_brain import AnthropicBrain
from .base import Brain
from .openai_brain import OpenAIBrain


Capability = Literal["chat", "stt", "tts"]


@dataclass(frozen=True)
class ModelDefinition:
    id: str
    label: str
    provider: str
    capabilities: tuple[Capability, ...]
    brain_factory: Callable[[], Brain] | None = None


def _get_required_key(provider: str) -> str:
    key = get_api_key(provider)
    if not key:
        raise ValueError(
            f"The API key for provider '{provider}' was not found in the system vault."
        )
    return key


MODEL_REGISTRY: dict[str, ModelDefinition] = {
    "openai:gpt-4o-mini": ModelDefinition(
        id="openai:gpt-4o-mini",
        label="OpenAI · GPT-4o mini",
        provider="openai",
        capabilities=("chat",),
        brain_factory=lambda: OpenAIBrain(
            api_key=_get_required_key("openai"), model="gpt-4o-mini"
        ),
    ),
    "openai:gpt-4o": ModelDefinition(
        id="openai:gpt-4o",
        label="OpenAI · GPT-4o",
        provider="openai",
        capabilities=("chat",),
        brain_factory=lambda: OpenAIBrain(
            api_key=_get_required_key("openai"), model="gpt-4o"
        ),
    ),
    "anthropic:claude-sonnet-5": ModelDefinition(
        id="anthropic:claude-sonnet-5",
        label="Anthropic · Claude Sonnet 5",
        provider="anthropic",
        capabilities=("chat",),
        brain_factory=lambda: AnthropicBrain(
            api_key=_get_required_key("anthropic"), model="claude-sonnet-5"
        ),
    ),
    "anthropic:claude-haiku-4-5": ModelDefinition(
        id="anthropic:claude-haiku-4-5",
        label="Anthropic · Claude Haiku 4.5",
        provider="anthropic",
        capabilities=("chat",),
        brain_factory=lambda: AnthropicBrain(
            api_key=_get_required_key("anthropic"), model="claude-haiku-4-5-20251001"
        ),
    ),
}


def create_brain(chave: str) -> Brain:
    model = MODEL_REGISTRY.get(chave)
    if not model or "chat" not in model.capabilities or model.brain_factory is None:
        raise ValueError(f"Brain desconhecido: {chave}")
    return model.brain_factory()


def list_models(capability: Capability) -> list[ModelDefinition]:
    return [
        model
        for model in MODEL_REGISTRY.values()
        if capability in model.capabilities
    ]


def list_brains() -> list[str]:
    return [model.id for model in list_models("chat")]
