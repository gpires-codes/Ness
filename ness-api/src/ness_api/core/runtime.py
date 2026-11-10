"""Peças de runtime compartilhadas entre main.py e as rotas."""

import asyncio

from fastapi import FastAPI

from ness_api.core import Orchestrator
from ness_api.services.brain_service import BrainService


class ConfirmationBroker:
    """Confirmer do canal web: o orquestrador pede, o front responde via POST /chat/confirm.

    Assume um pedido ativo por vez (o chat_lock garante). Sem resposta no prazo = negado.
    """

    def __init__(self, timeout: float = 60.0) -> None:
        self.timeout = timeout
        self._pending: asyncio.Future[bool] | None = None

    async def __call__(self, action, parameters: dict) -> bool:
        self._pending = asyncio.get_running_loop().create_future()
        try:
            return await asyncio.wait_for(self._pending, self.timeout)
        except asyncio.TimeoutError:
            return False
        finally:
            self._pending = None

    def resolve(self, approved: bool) -> bool:
        if self._pending is None or self._pending.done():
            return False
        self._pending.set_result(approved)
        return True


def activate_brain(app: FastAPI, key: str) -> None:
    """Cria o BrainService + Orchestrator na primeira vez; depois só troca o modelo.

    Levanta ValueError se o modelo for desconhecido ou a chave não estiver no cofre.
    """
    if app.state.brain is None:
        app.state.brain = BrainService(brain_padrao=key)
        app.state.orchestrator = Orchestrator(
            brain=app.state.brain, confirmer=app.state.confirmations
        )
    else:
        app.state.brain.trocar_brain(key)
    app.state.brain_error = None
