#!/usr/bin/env bash
set -euo pipefail
BASE=${RIFTDEN_MONITOR_URL:-https://riftden.com}
response=$(curl -fsS --max-time 15 "$BASE/health.json")
printf '%s' "$response" | node -e "let s='';process.stdin.on('data',d=>s+=d);process.stdin.on('end',()=>{const x=JSON.parse(s);if(x.status!=='ok'||!x.patch)process.exit(1);console.log('RiftDen healthy: '+x.patch)})"
