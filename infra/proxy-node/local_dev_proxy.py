#!/usr/bin/env python3
"""
Real local authenticated HTTP/HTTPS CONNECT proxy for development testing
when Docker is not installed. Supports Proxy-Authorization (Basic) and
full bidirectional TCP tunneling for HTTPS websites.
"""
import asyncio
import base64
import os
import sys

HOST = os.getenv("LOCAL_PROXY_HOST", "127.0.0.1")
PORT = int(os.getenv("LOCAL_PROXY_PORT", "8443"))
AUTH_USER = os.getenv("LOCAL_PROXY_AUTH_USER", "globevpn_local")
AUTH_PASS = os.getenv("LOCAL_PROXY_AUTH_PASS", "globevpn_local_pass")

EXPECTED_TOKEN = base64.b64encode(f"{AUTH_USER}:{AUTH_PASS}".encode()).decode()


async def pipe(reader: asyncio.StreamReader, writer: asyncio.StreamWriter) -> None:
    try:
        while True:
            data = await reader.read(65536)
            if not data:
                break
            writer.write(data)
            await writer.drain()
    except Exception:
        pass
    finally:
        try:
            writer.close()
        except Exception:
            pass


def check_auth(headers_raw: bytes) -> bool:
    for line in headers_raw.split(b"\r\n")[1:]:
        if line.lower().startswith(b"proxy-authorization:"):
            parts = line.split(b":", 1)[1].strip().split()
            if len(parts) == 2 and parts[0].lower() == b"basic":
                return parts[1].decode("ascii", errors="ignore") == EXPECTED_TOKEN
    return False


async def handle_client(
    client_reader: asyncio.StreamReader,
    client_writer: asyncio.StreamWriter,
) -> None:
    try:
        header_data = await asyncio.wait_for(client_reader.readuntil(b"\r\n\r\n"), timeout=10)
    except Exception:
        client_writer.close()
        return

    first_line = header_data.split(b"\r\n", 1)[0].decode("latin-1", errors="ignore")
    parts = first_line.split()
    if len(parts) < 3:
        client_writer.close()
        return

    method, target, _ = parts[0], parts[1], parts[2]

    if not check_auth(header_data):
        client_writer.write(
            b"HTTP/1.1 407 Proxy Authentication Required\r\n"
            b'Proxy-Authenticate: Basic realm="GlobeVPN Local Proxy"\r\n'
            b"Content-Length: 0\r\n"
            b"Connection: close\r\n\r\n"
        )
        await client_writer.drain()
        client_writer.close()
        return

    if method.upper() == "CONNECT":
        if ":" in target:
            dest_host, dest_port_s = target.rsplit(":", 1)
            dest_port = int(dest_port_s)
        else:
            dest_host, dest_port = target, 443

        try:
            remote_reader, remote_writer = await asyncio.wait_for(
                asyncio.open_connection(dest_host, dest_port), timeout=10
            )
        except Exception:
            client_writer.write(b"HTTP/1.1 502 Bad Gateway\r\n\r\n")
            await client_writer.drain()
            client_writer.close()
            return

        client_writer.write(b"HTTP/1.1 200 Connection Established\r\n\r\n")
        await client_writer.drain()

        await asyncio.gather(
            pipe(client_reader, remote_writer),
            pipe(remote_reader, client_writer),
        )
    else:
        # Plain HTTP request forwarding
        if target.startswith("http://"):
            rest = target[7:]
            host_port, _, path = rest.partition("/")
            path = "/" + path
        else:
            client_writer.write(b"HTTP/1.1 400 Bad Request\r\n\r\n")
            await client_writer.drain()
            client_writer.close()
            return

        if ":" in host_port:
            dest_host, dest_port_s = host_port.rsplit(":", 1)
            dest_port = int(dest_port_s)
        else:
            dest_host, dest_port = host_port, 80

        try:
            remote_reader, remote_writer = await asyncio.wait_for(
                asyncio.open_connection(dest_host, dest_port), timeout=10
            )
        except Exception:
            client_writer.write(b"HTTP/1.1 502 Bad Gateway\r\n\r\n")
            await client_writer.drain()
            client_writer.close()
            return

        lines = header_data.split(b"\r\n")
        rebuilt = [f"{method} {path} HTTP/1.1".encode("latin-1")]
        for ln in lines[1:]:
            if not ln.lower().startswith(b"proxy-"):
                rebuilt.append(ln)
        remote_writer.write(b"\r\n".join(rebuilt))
        await remote_writer.drain()

        await asyncio.gather(
            pipe(client_reader, remote_writer),
            pipe(remote_reader, client_writer),
        )


async def main() -> None:
    server = await asyncio.start_server(handle_client, HOST, PORT)
    print(f"GlobeVPN local authenticated proxy listening on {HOST}:{PORT}", flush=True)
    async with server:
        await server.serve_forever()


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        sys.exit(0)
