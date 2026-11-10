import asyncio
import os
from contextlib import asynccontextmanager

import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from ness_api.core import ConfirmationBroker, activate_brain
from ness_api.routes import chat

# Origens do front: Vite em dev e o webview do Tauri em produção (varia por SO).
ALLOWED_ORIGINS = [
    "http://localhost:1420",
    "http://127.0.0.1:1420",
    "tauri://localhost",
    "http://tauri.localhost",
    "https://tauri.localhost",
]


@asynccontextmanager
async def lifespan(app: FastAPI):
    if not os.environ.get("NESS_TOKEN"):
        raise RuntimeError("Defina NESS_TOKEN (veja .env.example)")

    app.state.brain = None
    app.state.orchestrator = None
    app.state.brain_error = None
    app.state.confirmations = ConfirmationBroker()
    app.state.chat_lock = asyncio.Lock()

    try:
        activate_brain(app, os.environ.get("NESS_BRAIN", "openai:gpt-4o-mini"))
        print("✅ Brain pronto")
    except ValueError as err:  # chave fora do cofre ou modelo desconhecido
        app.state.brain_error = str(err)
        print(f"⚠️ Brain não iniciado: {err}")

    yield


app = FastAPI(title="Ness API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=False,  # usamos Bearer token, não cookie
    allow_methods=["GET", "POST"],
    allow_headers=["Authorization", "Content-Type"],
)

app.include_router(chat.router)


@app.get("/health")
async def health():
    """Sem auth de propósito: o Tauri usa pra saber se o sidecar já subiu."""
    return {"ok": True, "brain_ready": app.state.orchestrator is not None}


def start():
    """Entrada do script `ness-api` do pyproject."""
    uvicorn.run(
        "ness_api.main:app",
        host="127.0.0.1",  # nunca 0.0.0.0: só este PC fala com o assistente
        port=int(os.environ.get("NESS_PORT", "8000")),
        reload=os.environ.get("NESS_DEV") == "1",
    )


if __name__ == "__main__":
    start()
