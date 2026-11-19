import os
from typing import Optional, Tuple

from app.models.models import Server


def resolve_proxy_credentials(server: Server) -> Tuple[Optional[str], Optional[str]]:
    """
    Resolves authorized proxy credentials on the server side only.
    Prefers environment-variable references over direct DB columns so secrets
    are never hardcoded in frontend code or committed to git.
    """
    username: Optional[str] = None
    password: Optional[str] = None

    if server.auth_username_env:
        username = os.getenv(server.auth_username_env)
    if server.auth_password_env:
        password = os.getenv(server.auth_password_env)

    if username is None:
        username = server.auth_username_direct
    if password is None:
        password = server.auth_password_direct

    return username, password


def describe_transport_encryption(scheme: str) -> str:
    if scheme == "https":
        return (
            "Browser-to-proxy leg is encrypted via TLS (HTTPS CONNECT). "
            "Applies to Chrome browser traffic only, not non-browser apps."
        )
    if scheme == "socks5":
        return (
            "SOCKS5 proxy routes browser traffic but does NOT add transport-layer "
            "VPN encryption on its own; rely on HTTPS websites for end-to-end encryption."
        )
    return (
        "HTTP proxy routes browser traffic (intended for local development/testing only). "
        "Does not provide VPN-level tunnel encryption."
    )
