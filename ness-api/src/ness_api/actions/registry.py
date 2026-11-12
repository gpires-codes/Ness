import inspect
from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from typing import Literal

from .schema import build_parameters_schema

JSONValue = str | int | float | bool | None | list["JSONValue"] | dict[str, "JSONValue"]


@dataclass
class ActionResult:
    type: Literal["final", "requires_response"]
    status: bool
    content: JSONValue


class Action:
    def __init__(
        self,
        parameters_schema: dict | None = None,
        executor: Callable[..., Awaitable[ActionResult]] | None = None,
        location: Literal["backend", "frontend"] = "backend",
        name: str | None = None,
        description: str | None = None,
    ):
        if location == "backend" and executor is None:
            raise ValueError("location='backend' requires an executor")

        self.name = name or (executor.__name__ if executor else None)
        self.description = description or (
            inspect.getdoc(executor) if executor else None
        )
        self.parameters_schema = parameters_schema or (
            build_parameters_schema(executor)
            if executor
            else {"type": "object", "properties": {}}
        )

        if not self.name:
            raise ValueError(
                "Action requires a 'name' (explicit, or derived from executor)"
            )

        self.executor = executor
        self.location = location


ACTIONS: dict[str, Action] = {}


def action_register(action: Action):
    if action.name:
        ACTIONS[action.name] = action
    else:
        return


def list_for_openai() -> list[dict]:
    return [
        {
            "type": "function",
            "function": {
                "name": a.name,
                "description": a.description,
                "parameters": a.parameters_schema,
            },
        }
        for a in ACTIONS.values()
    ]


def list_for_anthropic() -> list[dict]:
    return [
        {
            "name": a.name,
            "description": a.description,
            "input_schema": a.parameters_schema,
        }
        for a in ACTIONS.values()
    ]
