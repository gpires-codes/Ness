import keyring
from keyring.errors import PasswordDeleteError

SERVICE_NAME = "Ness"


def save_api_key(provider: str, api_key: str) -> None:
    """Salva a chave de API no cofre seguro do SO."""
    keyring.set_password(SERVICE_NAME, provider.lower().strip(), api_key)


def get_api_key(provider: str) -> str | None:
    """Recupera a chave do cofre do SO."""
    return keyring.get_password(SERVICE_NAME, provider.lower().strip())


def delete_api_key(provider: str) -> None:
    """Remove a chave do cofre sem lançar erro caso ela não exista."""
    try:
        keyring.delete_password(SERVICE_NAME, provider.lower().strip())
    except PasswordDeleteError:
        pass
