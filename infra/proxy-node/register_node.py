#!/usr/bin/env python3
"""
Registers an authorized GlobeVPN proxy exit node with the control plane API.
The backend will immediately run a real TCP/TLS reachability check.
"""
import argparse
import json
import sys
import urllib.request


def main() -> int:
    parser = argparse.ArgumentParser(description="Register an authorized GlobeVPN proxy node")
    parser.add_argument("--api-url", required=True, help="Backend base URL, e.g. https://api.globevpn.example")
    parser.add_argument("--admin-key", required=True, help="ADMIN_API_KEY value")
    parser.add_argument("--id", required=True, help="Unique node ID, e.g. de-fra-01")
    parser.add_argument("--country-code", required=True, help="ISO country code, e.g. DE")
    parser.add_argument("--country-name", required=True, help="Country display name, e.g. Germany")
    parser.add_argument("--flag", default="", help="Flag emoji, e.g. 🇩🇪")
    parser.add_argument("--region", default="Europe")
    parser.add_argument("--name", required=True, help="Node display name, e.g. Frankfurt #1")
    parser.add_argument("--city", required=True, help="City name, e.g. Frankfurt")
    parser.add_argument("--hostname", required=True, help="TLS hostname, e.g. de-fra-01.globevpn.example")
    parser.add_argument("--port", type=int, default=443)
    parser.add_argument("--scheme", choices=["https", "http", "socks5"], default="https")
    parser.add_argument("--tier", choices=["free", "pro"], default="free")
    parser.add_argument("--auth-user", required=True)
    parser.add_argument("--auth-pass", required=True)
    args = parser.parse_args()

    payload = {
        "id": args.id,
        "country_code": args.country_code,
        "country_name": args.country_name,
        "flag_emoji": args.flag,
        "region": args.region,
        "name": args.name,
        "city": args.city,
        "hostname": args.hostname,
        "port": args.port,
        "scheme": args.scheme,
        "tier": args.tier,
        "auth_username": args.auth_user,
        "auth_password": args.auth_pass,
    }

    url = f"{args.api_url.rstrip('/')}/api/admin/servers"
    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "X-Admin-Key": args.admin_key,
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            body = resp.read().decode("utf-8")
            print(f"Registered ({resp.status}): {body}")
            return 0
    except Exception as exc:
        print(f"Registration failed: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
