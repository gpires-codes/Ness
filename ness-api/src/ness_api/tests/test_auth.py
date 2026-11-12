import asyncio
from types import SimpleNamespace

from starlette.responses import Response

from ness_api.main import require_bearer_token


def run_middleware(path="/protected", method="GET", authorization=None):
    request = SimpleNamespace(
        url=SimpleNamespace(path=path),
        method=method,
        headers={} if authorization is None else {"authorization": authorization},
    )
    reached_endpoint = False

    async def call_next(_request):
        nonlocal reached_endpoint
        reached_endpoint = True
        return Response(status_code=200)

    response = asyncio.run(require_bearer_token(request, call_next))
    return response, reached_endpoint


def test_protected_route_fails_closed_without_configured_token(monkeypatch):
    monkeypatch.delenv("NESS_TOKEN", raising=False)

    response, reached_endpoint = run_middleware()

    assert response.status_code == 503
    assert not reached_endpoint


def test_protected_route_rejects_missing_or_invalid_token(monkeypatch):
    monkeypatch.setenv("NESS_TOKEN", "expected")

    missing, missing_reached_endpoint = run_middleware()
    invalid, invalid_reached_endpoint = run_middleware(
        authorization="Bearer incorrect"
    )
    non_ascii, non_ascii_reached_endpoint = run_middleware(
        authorization="Bearer inválido"
    )

    assert missing.status_code == invalid.status_code == non_ascii.status_code == 401
    assert missing.headers["www-authenticate"] == "Bearer"
    assert not missing_reached_endpoint
    assert not invalid_reached_endpoint
    assert not non_ascii_reached_endpoint


def test_protected_route_accepts_bearer_token_case_insensitively(monkeypatch):
    monkeypatch.setenv("NESS_TOKEN", "expected")

    response, reached_endpoint = run_middleware(
        authorization="bEaReR expected"
    )

    assert response.status_code == 200
    assert reached_endpoint


def test_health_and_cors_preflight_do_not_require_token(monkeypatch):
    monkeypatch.delenv("NESS_TOKEN", raising=False)

    health, health_reached_endpoint = run_middleware(path="/health")
    preflight, preflight_reached_endpoint = run_middleware(
        method="OPTIONS"
    )

    assert health.status_code == preflight.status_code == 200
    assert health_reached_endpoint
    assert preflight_reached_endpoint
