import os
import secrets

import uvicorn
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import RequestResponseEndpoint
from starlette.responses import JSONResponse, Response

from ness_api.routes import router as api_router

# Origens do front: Vite em dev e o webview do Tauri em produção (varia por SO).
ALLOWED_ORIGINS = [
    "http://localhost:1420",
    "http://127.0.0.1:1420",
    "tauri://localhost",
    "http://tauri.localhost",
    "https://tauri.localhost",
]


app = FastAPI(title="Ness API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=False,  # usamos Bearer token, não cookie
    allow_methods=["GET", "POST", "DELETE"],
    allow_headers=["Authorization", "Content-Type"],
)
app.include_router(api_router)


@app.middleware("http")
async def require_bearer_token(
    request: Request, call_next: RequestResponseEndpoint
) -> Response:
    if request.url.path == "/health" or request.method == "OPTIONS":
        return await call_next(request)

    expected = os.environ.get("NESS_TOKEN")
    if not expected:
        return JSONResponse(
            status_code=503,
            content={"detail": "API token is not configured"},
        )

    parts = request.headers.get("authorization", "").split()
    if (
        len(parts) != 2
        or parts[0].lower() != "bearer"
        or not secrets.compare_digest(
            parts[1].encode("utf-8"), expected.encode("utf-8")
        )
    ):
        return JSONResponse(
            status_code=401,
            content={"detail": "Invalid or missing bearer token"},
            headers={"WWW-Authenticate": "Bearer"},
        )

    return await call_next(request)


@app.get("/health")
async def health():
    """Sem auth de propósito: o Tauri usa pra saber se o sidecar já subiu."""
    return {
        "ok": True,
        "brain_ready": getattr(app.state, "orchestrator", None) is not None,
    }


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
