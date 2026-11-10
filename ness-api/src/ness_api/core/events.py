"""Eventos emitidos pelo Orchestrator. Voz, UI e scheduler só consomem isto."""

from dataclasses import dataclass
from typing import Any


@dataclass
class Say:
    """Texto que o assistente quer dizer (voz fala, UI mostra)."""

    text: str


@dataclass
class NeedsConfirmation:
    name: str
    parameters: dict[str, Any]


@dataclass
class ActionStarted:
    name: str
    parameters: dict[str, Any]


@dataclass
class ActionFinished:
    name: str
    ok: bool
    denied: bool = False
    error: str | None = None


@dataclass
class FrontendAction:
    """Ação com location='frontend': o core não executa, só avisa quem está ouvindo."""

    name: str
    parameters: dict[str, Any]


@dataclass
class Failed:
    message: str


CoreEvent = (
    Say | NeedsConfirmation | ActionStarted | ActionFinished | FrontendAction | Failed
)
