#!/usr/bin/env python3
"""Cloudflare для riftden.com: сертификат Origin, DNS, строгий SSL и правило «ходить на сервер по порту 8443».

Ключ API берётся из env-файла на сервере и никуда не выводится.
Запуск на сервере: sudo python3 cloudflare.py --env <env-файл с ключом> --ip <IPv4 сервера> [--cert] [--dns]
Повторный запуск безопасен: существующие записи и правила обновляются, сертификат не перевыпускается.
"""
import argparse
import json
import os
import subprocess
import urllib.error
import urllib.request

API = "https://api.cloudflare.com/client/v4"
ZONE = "riftden.com"
HOSTS = ["riftden.com", "www.riftden.com"]
ORIGIN_PORT = 8443
CERT_DIR = "/opt/riftden/certs"


def read_env(path):
    env = {}
    with open(path, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                env[k.strip()] = v.strip().strip('"').strip("'")
    return env


class Cloudflare:
    def __init__(self, email, key):
        self.headers = {"X-Auth-Email": email, "X-Auth-Key": key, "Content-Type": "application/json"}

    def request(self, method, path, body=None):
        data = json.dumps(body).encode() if body is not None else None
        req = urllib.request.Request(API + path, data=data, method=method, headers=self.headers)
        try:
            with urllib.request.urlopen(req, timeout=30) as res:
                out = json.loads(res.read())
        except urllib.error.HTTPError as e:
            out = json.loads(e.read() or b"{}")
        if not out.get("success"):
            raise SystemExit(f"{method} {path}: {out.get('errors')}")
        return out["result"]


def ensure_cert(cf):
    cert, key = f"{CERT_DIR}/origin.pem", f"{CERT_DIR}/origin-key.pem"
    if os.path.exists(cert) and os.path.exists(key):
        print("origin certificate: уже есть")
        return
    os.makedirs(CERT_DIR, exist_ok=True)
    csr = subprocess.run(
        ["openssl", "req", "-new", "-newkey", "rsa:2048", "-nodes", "-keyout", key, "-subj", f"/CN={ZONE}"],
        check=True, capture_output=True, text=True,
    ).stdout
    os.chmod(key, 0o600)
    result = cf.request("POST", "/certificates", {"hostnames": [ZONE, f"*.{ZONE}"], "requested_validity": 5475, "request_type": "origin-rsa", "csr": csr})
    with open(cert, "w", encoding="utf-8") as f:
        f.write(result["certificate"])
    print(f"origin certificate: выпущен, действует до {result['expires_on']}")


def ensure_dns(cf, zone_id, ip):
    records = [("A", ZONE, ip), ("CNAME", f"www.{ZONE}", ZONE)]
    for rtype, name, content in records:
        existing = cf.request("GET", f"/zones/{zone_id}/dns_records?name={name}")
        body = {"type": rtype, "name": name, "content": content, "proxied": True, "ttl": 1}
        same = [r for r in existing if r["type"] == rtype]
        if same:
            cf.request("PUT", f"/zones/{zone_id}/dns_records/{same[0]['id']}", body)
            print(f"dns: {rtype} {name} обновлена")
        elif existing:
            raise SystemExit(f"dns: у {name} уже есть запись другого типа ({existing[0]['type']}) — разберитесь вручную")
        else:
            cf.request("POST", f"/zones/{zone_id}/dns_records", body)
            print(f"dns: {rtype} {name} создана")


def ensure_settings(cf, zone_id):
    for setting, value in [("ssl", "strict"), ("always_use_https", "on"), ("min_tls_version", "1.2")]:
        cf.request("PATCH", f"/zones/{zone_id}/settings/{setting}", {"value": value})
        print(f"settings: {setting} = {value}")


def ensure_origin_port(cf, zone_id):
    rule = {
        "description": f"riftden: сервер принимает на порту {ORIGIN_PORT}",
        "expression": "(http.host in {" + " ".join(f'"{h}"' for h in HOSTS) + "})",
        "action": "route",
        "action_parameters": {"origin": {"port": ORIGIN_PORT}},
        "enabled": True,
    }
    try:
        current = cf.request("GET", f"/zones/{zone_id}/rulesets/phases/http_request_origin/entrypoint")
        others = [r for r in current.get("rules", []) if not r.get("description", "").startswith("riftden:")]
    except SystemExit:
        others = []
    cf.request("PUT", f"/zones/{zone_id}/rulesets/phases/http_request_origin/entrypoint", {"rules": others + [rule]})
    print(f"origin rule: {', '.join(HOSTS)} → порт {ORIGIN_PORT}")


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--env", required=True, help="env-файл с CLOUDFLARE_API_EMAIL и CLOUDFLARE_GLOBAL_API_KEY")
    p.add_argument("--ip", required=True, help="IPv4 сервера")
    p.add_argument("--cert", action="store_true", help="выпустить сертификат Origin")
    p.add_argument("--dns", action="store_true", help="DNS, строгий SSL и правило порта")
    args = p.parse_args()

    env = read_env(args.env)
    cf = Cloudflare(env["CLOUDFLARE_API_EMAIL"], env["CLOUDFLARE_GLOBAL_API_KEY"])
    zones = cf.request("GET", f"/zones?name={ZONE}")
    if not zones:
        raise SystemExit(f"зона {ZONE} не найдена в этом аккаунте Cloudflare")
    zone_id = zones[0]["id"]
    print(f"zone: {ZONE} ({zones[0]['status']})")
    if args.cert:
        ensure_cert(cf)
    if args.dns:
        ensure_origin_port(cf, zone_id)
        ensure_settings(cf, zone_id)
        ensure_dns(cf, zone_id, args.ip)


if __name__ == "__main__":
    main()
