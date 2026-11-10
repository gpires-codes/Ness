from __future__ import annotations

import json
from collections.abc import AsyncIterator, Awaitable, Callable
from typing import Protocol

from ness_api.actions.registry import ACTIONS, Action, ActionResult
from ness_api.brain.base import ActionCall, BrainResponse

from .events import (
    ActionFinished,
    ActionStarted,
    CoreEvent,
    Failed,
    FrontendAction,
    NeedsConfirmation,
    Say,
)

Confirmer = Callable[[Action, dict], Awaitable[bool]]


class BrainLike(Protocol):
    """O BrainService atual já satisfaz isto."""

    async def get_response(self, text: str, role: str = "user") -> BrainResponse: ...


def _result_prompt(result: ActionResult) -> str:
    return (
        "A ultima ação do usuário deu uma mensagem e um status como resultado. "
        f"O status do resultado foi: {json.dumps(result.status, ensure_ascii=False)} "
        f"A mensagem do resultado foi: '{json.dumps(result.content, ensure_ascii=False)}'. "
        "Responda ao usuário de forma resumida e clara com base nesse conteúdo "
        "e na ultima ação do usuário."
    )


def _error_prompt(name: str, err: Exception) -> str:
    return f"The action '{name}' failed with the following error: {err}"


class Orchestrator:
    def __init__(
        self,
        brain: BrainLike,
        actions: dict[str, Action] | None = None,
        confirmer: Confirmer | None = None,
        max_steps: int = 6,
    ) -> None:
        self.brain = brain
        self.actions = actions if actions is not None else ACTIONS
        self.confirmer = confirmer
        self.max_steps = max_steps

    async def handle(self, text: str) -> AsyncIterator[CoreEvent]:
        message, role = text, "user"

        for _ in range(self.max_steps):
            try:
                response = await self.brain.get_response(message, role=role)
            except Exception as err:  # noqa: BLE001
                yield Failed(f"{type(err).__name__}: {err}")
                return

            if response.text:
                yield Say(response.text)

            followups: list[str] = []
            for call in response.actions:
                async for event in self._run_action(call, followups):
                    yield event

            if not followups:
                return
            message, role = "\n".join(followups), "system"

        yield Failed("Limite de passos atingido")

    async def _run_action(
        self, call: ActionCall, followups: list[str]
    ) -> AsyncIterator[CoreEvent]:
        action = self.actions.get(call.name)
        if action is None:
            yield ActionFinished(call.name, ok=False, error="unknown action")
            return

        if action.location == "frontend":
            yield FrontendAction(call.name, call.parameters)
            return

        policy = getattr(action, "confirm", "auto")

        if policy == "never":
            yield ActionFinished(call.name, ok=False, denied=True)
            followups.append(
                f"The action '{call.name}' is blocked and cannot be executed."
            )
            return

        if policy == "ask":
            yield NeedsConfirmation(call.name, call.parameters)
            approved = self.confirmer is not None and await self.confirmer(
                action, call.parameters
            )
            if not approved:
                yield ActionFinished(call.name, ok=False, denied=True)
                followups.append(f"The user denied the action '{call.name}'.")
                return

        assert action.executor is not None  # garantido por location == "backend"
        yield ActionStarted(call.name, call.parameters)
        try:
            result = await action.executor(**call.parameters)
        except Exception as err:  # noqa: BLE001
            yield ActionFinished(call.name, ok=False, error=str(err))
            followups.append(_error_prompt(call.name, err))
            return

        if result is None:  # ações tipo end_conversation não devolvem nada
            yield ActionFinished(call.name, ok=True)
            return

        yield ActionFinished(call.name, ok=result.status)
        if result.type == "requires_response":
            followups.append(_result_prompt(result))
