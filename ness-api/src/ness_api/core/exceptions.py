from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

# --- EXCEÇÕES CUSTOMIZADAS ---


class BrainException(Exception):
    """Exceção base para erros do motor de inteligência (Ness Brain)."""


class InsufficientCreditsError(BrainException):
    """Lançada quando a conta do provedor de IA não possui saldo ou cota suficiente."""


class InvalidApiKeyError(BrainException):
    """Lançada quando a chave de API cadastrada é inválida ou expirou."""


class BrainProviderError(BrainException):
    """Lançada em caso de erro genérico ou indisponibilidade no provedor de IA."""


def register_exception_handlers(app: FastAPI) -> None:
    """Registra manipuladores globais de exceção na aplicação FastAPI."""

    @app.exception_handler(StarletteHTTPException)
    async def handle_http_exception(_: Request, exc: StarletteHTTPException):
        return JSONResponse(
            status_code=exc.status_code,
            content={"error": "http_error", "detail": exc.detail},
        )

    @app.exception_handler(RequestValidationError)
    async def handle_validation_error(_: Request, exc: RequestValidationError):
        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            content={"error": "validation_error", "detail": exc.errors()},
        )

    @app.exception_handler(InsufficientCreditsError)
    async def handle_insufficient_credits(_: Request, exc: InsufficientCreditsError):
        return JSONResponse(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            content={"error": "insufficient_credits", "detail": str(exc)},
        )

    @app.exception_handler(InvalidApiKeyError)
    async def handle_invalid_api_key(_: Request, exc: InvalidApiKeyError):
        return JSONResponse(
            status_code=status.HTTP_401_UNAUTHORIZED,
            content={"error": "invalid_api_key", "detail": str(exc)},
        )

    @app.exception_handler(BrainException)
    async def handle_generic_brain_error(_: Request, exc: BrainException):
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={"error": "brain_error", "detail": str(exc)},
        )
