"""Testes do Orchestrator com Brain falso: sem microfone, sem API, sem GPU."""

import asyncio

from ness_api.actions.registry import Action, ActionResult
from ness_api.brain.base import ActionCall, BrainResponse
from ness_api.core import (
    ActionFinished,
    ActionStarted,
    Failed,
    FrontendAction,
    NeedsConfirmation,
    Orchestrator,
    Say,
)

SCHEMA = {"type": "object", "properties": {}}


class FakeBrain:
    """Devolve respostas roteirizadas e registra (text, role) de cada chamada."""

    def __init__(self, *responses, loop_last: bool = False):
        self._responses = list(responses)
        self._loop_last = loop_last
        self.calls: list[tuple[str, str]] = []

    async def get_response(self, text: str, role: str = "user") -> BrainResponse:
        self.calls.append((text, role))
        if self._loop_last:
            item = self._responses[0]
        elif self._responses:
            item = self._responses.pop(0)
        else:
            raise AssertionError("brain chamado mais vezes que o esperado")
        if isinstance(item, Exception):
            raise item
        return item


def call(name: str = "act", **params) -> ActionCall:
    return ActionCall(name=name, parameters=params)


def reply(text: str = "", *calls: ActionCall) -> BrainResponse:
    return BrainResponse(text=text, actions=list(calls))


def make_action(executor, name: str = "act") -> Action:
    return Action(
        name=name, description="x", parameters_schema=SCHEMA, executor=executor
    )


async def exec_final(**_):
    return ActionResult(type="final", status=True, content="ok")


async def exec_followup(**_):
    return ActionResult(type="requires_response", status=True, content={"x": 1})


async def exec_boom(**_):
    raise RuntimeError("boom")


async def exec_none(**_):
    return None


def run(orch: Orchestrator, text: str = "oi") -> list:
    async def collect():
        return [event async for event in orch.handle(text)]

    return asyncio.run(collect())


def kinds(events) -> list[str]:
    return [type(e).__name__ for e in events]


def test_only_text():
    brain = FakeBrain(reply("olá"))
    events = run(Orchestrator(brain, actions={}))
    assert events == [Say("olá")]
    assert brain.calls == [("oi", "user")]


def test_final_action_does_not_call_brain_again():
    brain = FakeBrain(reply("abrindo", call()))
    orch = Orchestrator(brain, actions={"act": make_action(exec_final)})
    events = run(orch)
    assert kinds(events) == ["Say", "ActionStarted", "ActionFinished"]
    assert len(brain.calls) == 1


def test_requires_response_goes_back_to_brain_as_system():
    brain = FakeBrain(reply("vou ver", call()), reply("achei: x=1"))
    orch = Orchestrator(brain, actions={"act": make_action(exec_followup)})
    events = run(orch)
    assert kinds(events) == ["Say", "ActionStarted", "ActionFinished", "Say"]
    assert events[-1] == Say("achei: x=1")
    assert len(brain.calls) == 2
    assert brain.calls[1][1] == "system"


def test_executor_error_goes_back_to_brain_as_system():
    brain = FakeBrain(reply("", call()), reply("deu ruim"))
    orch = Orchestrator(brain, actions={"act": make_action(exec_boom)})
    events = run(orch)
    finished = next(e for e in events if isinstance(e, ActionFinished))
    assert finished.ok is False and finished.error == "boom"
    assert brain.calls[1][1] == "system"
    assert "boom" in brain.calls[1][0]


def test_none_result_counts_as_success():
    """Regressão: end_conversation devolve None e antes estourava AttributeError."""
    brain = FakeBrain(reply("tchau", call()))
    orch = Orchestrator(brain, actions={"act": make_action(exec_none)})
    events = run(orch)
    finished = next(e for e in events if isinstance(e, ActionFinished))
    assert finished.ok is True
    assert len(brain.calls) == 1


def test_ask_without_confirmer_is_denied():
    ran = []

    async def executor(**_):
        ran.append(True)
        return ActionResult(type="final", status=True, content="ok")

    action = make_action(executor)
    action.confirm = "ask"
    brain = FakeBrain(reply("", call()), reply("ok, não faço"))
    events = run(Orchestrator(brain, actions={"act": action}))
    assert any(isinstance(e, NeedsConfirmation) for e in events)
    assert not any(isinstance(e, ActionStarted) for e in events)
    assert ran == []
    assert brain.calls[1][1] == "system"


def test_ask_with_confirmer_runs():
    async def yes(action, params):
        return True

    action = make_action(exec_final)
    action.confirm = "ask"
    brain = FakeBrain(reply("", call()))
    events = run(Orchestrator(brain, actions={"act": action}, confirmer=yes))
    assert kinds(events) == ["NeedsConfirmation", "ActionStarted", "ActionFinished"]


def test_never_is_blocked():
    action = make_action(exec_final)
    action.confirm = "never"
    brain = FakeBrain(reply("", call()), reply("não posso"))
    events = run(Orchestrator(brain, actions={"act": action}))
    finished = next(e for e in events if isinstance(e, ActionFinished))
    assert finished.denied is True
    assert not any(isinstance(e, ActionStarted) for e in events)


def test_unknown_action_is_ignored():
    brain = FakeBrain(reply("", call("nao_existe")))
    events = run(Orchestrator(brain, actions={}))
    assert kinds(events) == ["ActionFinished"]
    assert len(brain.calls) == 1


def test_frontend_action_is_emitted_not_executed():
    action = Action(
        name="act", description="x", parameters_schema=SCHEMA, location="frontend"
    )
    brain = FakeBrain(reply("", call(app="spotify")))
    events = run(Orchestrator(brain, actions={"act": action}))
    assert events == [FrontendAction("act", {"app": "spotify"})]


def test_max_steps_stops_infinite_loop():
    brain = FakeBrain(reply("de novo", call()), loop_last=True)
    orch = Orchestrator(brain, actions={"act": make_action(exec_followup)}, max_steps=3)
    events = run(orch)
    assert isinstance(events[-1], Failed)
    assert len(brain.calls) == 3


def test_brain_exception_becomes_failed():
    brain = FakeBrain(RuntimeError("api caiu"))
    events = run(Orchestrator(brain, actions={}))
    assert events == [Failed("RuntimeError: api caiu")]
