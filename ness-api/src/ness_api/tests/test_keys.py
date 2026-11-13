import pytest
from fastapi import HTTPException
from keyring.errors import KeyringError
from pydantic import ValidationError

from ness_api.main import app
from ness_api.routes import keys


def test_key_routes_are_registered():
    paths = app.openapi()["paths"]

    assert "post" in paths["/keys"]
    assert "get" in paths["/keys/{provider}"]
    assert "delete" in paths["/keys/{provider}"]


def test_save_key_stores_secret_and_returns_no_key(monkeypatch):
    stored = {}

    def save(provider, api_key):
        stored["provider"] = provider
        stored["api_key"] = api_key

    monkeypatch.setattr(keys, "save_api_key", save)
    payload = keys.ApiKeySchema(provider="openai", api_key="  sk-test-secret  ")

    result = keys.set_key(payload)

    assert stored == {"provider": "openai", "api_key": "sk-test-secret"}
    assert result == {
        "provider": "openai",
        "is_configured": True,
        "last_four": "cret",
    }
    assert "api_key" not in result
    assert "sk-test-secret" not in repr(payload)
    assert "sk-test-secret" not in repr(result)


def test_key_status_returns_only_last_four_characters(monkeypatch):
    monkeypatch.setattr(keys, "get_api_key", lambda _provider: "sk-test-secret")

    result = keys.get_key_status("openai")

    assert result == {
        "provider": "openai",
        "is_configured": True,
        "last_four": "cret",
    }
    assert "api_key" not in result
    assert "sk-test-secret" not in repr(result)


def test_short_key_is_never_returned_as_suffix(monkeypatch):
    monkeypatch.setattr(keys, "get_api_key", lambda _provider: "abcd")

    assert keys.get_key_status("openai") == {
        "provider": "openai",
        "is_configured": True,
        "last_four": None,
    }


def test_missing_key_reports_not_configured(monkeypatch):
    monkeypatch.setattr(keys, "get_api_key", lambda _provider: None)

    assert keys.get_key_status("anthropic") == {
        "provider": "anthropic",
        "is_configured": False,
        "last_four": None,
    }


def test_remove_key_deletes_from_keyring(monkeypatch):
    removed = []
    monkeypatch.setattr(keys, "delete_api_key", removed.append)

    result = keys.remove_key("anthropic")

    assert removed == ["anthropic"]
    assert result == {
        "provider": "anthropic",
        "is_configured": False,
        "last_four": None,
    }


def test_empty_or_unknown_keys_are_rejected():
    with pytest.raises(ValidationError):
        keys.ApiKeySchema(provider="openai", api_key="   ")

    with pytest.raises(ValidationError):
        keys.ApiKeySchema(provider="unknown", api_key="some-key")


def test_keyring_failure_is_reported_as_unavailable(monkeypatch):
    def fail(_provider, _api_key):
        raise KeyringError("vault unavailable")

    monkeypatch.setattr(keys, "save_api_key", fail)

    with pytest.raises(HTTPException) as error:
        keys.set_key(
            keys.ApiKeySchema(provider="openai", api_key="sk-test-secret")
        )

    assert error.value.status_code == 503
    assert error.value.detail == "System credential vault is unavailable"
