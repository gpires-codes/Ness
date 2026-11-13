from typing import Literal

from fastapi import APIRouter, HTTPException, status
from keyring.errors import KeyringError
from pydantic import BaseModel, Field, SecretStr, field_validator

from ness_api.core.credentials import delete_api_key, get_api_key, save_api_key

router = APIRouter(prefix="/keys", tags=["API Keys"])

Provider = Literal["openai", "anthropic"]


def _last_four(api_key: str) -> str | None:
    return api_key[-4:] if len(api_key) > 4 else None


class ApiKeySchema(BaseModel):
    provider: Provider
    api_key: SecretStr = Field(min_length=1, max_length=8192)

    @field_validator("api_key")
    @classmethod
    def api_key_must_not_be_blank(cls, value: SecretStr) -> SecretStr:
        if not value.get_secret_value().strip():
            raise ValueError("API key cannot be empty")
        return value


@router.post("", status_code=status.HTTP_201_CREATED)
def set_key(payload: ApiKeySchema):
    api_key = payload.api_key.get_secret_value().strip()

    try:
        save_api_key(payload.provider, api_key)
    except KeyringError as error:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="System credential vault is unavailable",
        ) from error

    return {
        "provider": payload.provider,
        "is_configured": True,
        "last_four": _last_four(api_key),
    }


@router.get("/{provider}")
def get_key_status(provider: Provider):
    try:
        api_key = get_api_key(provider)
    except KeyringError as error:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="System credential vault is unavailable",
        ) from error

    return {
        "provider": provider,
        "is_configured": api_key is not None,
        "last_four": _last_four(api_key) if api_key is not None else None,
    }


@router.delete("/{provider}")
def remove_key(provider: Provider):
    try:
        delete_api_key(provider)
    except KeyringError as error:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="System credential vault is unavailable",
        ) from error

    return {"provider": provider, "is_configured": False, "last_four": None}
