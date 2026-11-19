#!/usr/bin/env python3
"""
Automated credential rotation utility for GlobeVPN regional VPS proxy nodes.
1. Calls POST /api/admin/servers/{server_id}/rotate-credentials on the hosted control plane.
2. Writes the rotated PROXY_AUTH_USER and PROXY_AUTH_PASS to the VPS node's .env.node file
   (chmod 600) so docker compose can restart the GOST TLS proxy seamlessly.
"""
import argparse
import json
import os
import subprocess
import sys
import urllib.request


def main() -> int:
    parser = argparse.ArgumentParser(description="Rotate GlobeVPN VPS proxy node credentials")
    parser.add_argument("--api-url", required=True, help="Hosted control plane URL")
    parser.add_argument("--admin-key", required=True, help="ADMIN_API_KEY")
    parser.add_argument("--server-id", required=True, help="Registered server ID, e.g. de-fra-01")
    parser.add_argument("--env-file", default="/opt/globevpn-node/.env.node")
    parser.add_argument("--restart-compose", action="store_true")
    args = parser.parse_args()

    url = f"{args.api_url.rstrip('/')}/api/admin/servers/{args.server_id}/rotate-credentials"
    req = urllib.request.Request(
        url,
        data=b"{}",
        headers={
            "Content-Type": "application/json",
            "X-Admin-Key": args.admin_key,
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            data = json.loads(resp.read().decode("utf-8"))
    except Exception as exc:
        print(f"Credential rotation API call failed: {exc}", file=sys.stderr)
        return 1

    os.makedirs(os.path.dirname(args.env_file), exist_ok=True)
    with open(args.env_file, "w", encoding="utf-8") as f:
        f.write(f"PROXY_AUTH_USER={data['username']}\n")
        f.write(f"PROXY_AUTH_PASS={data['password']}\n")
    os.chmod(args.env_file, 0o600)
    print(f"Rotated credentials for {args.server_id} at {data['rotated_at']}")

    if args.restart_compose:
        node_dir = os.path.dirname(args.env_file)
        subprocess.run(
            ["docker", "compose", "-f", "docker-compose.node.yml", "--env-file", args.env_file, "up", "-d", "--force-recreate"],
            cwd=node_dir,
            check=True,
        )
        print("Restarted regional proxy container with rotated credentials.")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
