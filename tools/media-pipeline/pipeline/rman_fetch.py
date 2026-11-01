"""Download selected files of a Riot RMAN manifest using HTTP range requests.

Only the chunks a file needs are fetched (adjacent chunks of one bundle are
merged into a single request), so a champion WAD costs its own size, not the
size of every bundle it touches.
"""
import concurrent.futures as cf
import os
import re
import sys
import time

import requests
from cdtb.patcher import PatcherManifest
from cdtb.tools import zstd_decompress

CDN = "https://lol.dyn.riotcdn.net/channels/public"
SIEVE = ("https://sieve.services.riotcdn.net/api/v1/products/lol/version-sets/{region}"
         "?q[artifact_type_id]=lol-game-client&q[platform]=windows&q[published]=true")
UA = "RiftDen-media/1.0 (+https://riftden.com)"

_session = requests.Session()
_session.headers["User-Agent"] = UA


def live_manifest_url(region="EUW1"):
    """Return (version, manifest URL) of the newest published live game client."""
    r = _session.get(SIEVE.format(region=region), timeout=30)
    r.raise_for_status()
    best = None
    for rel in r.json()["releases"]:
        labels = rel["release"]["labels"]
        if labels.get("riot:artifact_type_id", {}).get("values") != ["lol-game-client"]:
            continue
        version = labels["riot:artifact_version_id"]["values"][0].split("+")[0]
        key = tuple(int(x) for x in version.split("."))
        if best is None or key > best[0]:
            best = (key, version, rel["download"]["url"].replace(".secure.", "."))
    if not best:
        raise RuntimeError("no live game client release in sieve")
    return best[1], best[2]


def load_manifest(url, cache_dir):
    os.makedirs(cache_dir, exist_ok=True)
    name = re.sub(r"[^0-9A-Za-z.]", "_", url.rsplit("/", 1)[-1])
    path = os.path.join(cache_dir, name)
    if not os.path.exists(path):
        data = _get(url).content
        with open(path + ".tmp", "wb") as f:
            f.write(data)
        os.replace(path + ".tmp", path)
    return PatcherManifest(path)


def _get(url, headers=None, tries=5):
    for attempt in range(tries):
        try:
            r = _session.get(url, headers=headers, timeout=120)
            if r.status_code in (200, 206):
                return r
            err = f"HTTP {r.status_code}"
        except requests.RequestException as e:
            err = str(e)
        time.sleep(2 ** attempt)
    raise RuntimeError(f"{url}: {err}")


def _fetch_range(bundle_id, start, end):
    url = f"{CDN}/bundles/{bundle_id:016X}.bundle"
    r = _get(url, headers={"Range": f"bytes={start}-{end - 1}"})
    data = r.content
    if r.status_code == 200:  # server ignored the range
        data = data[start:end]
    if len(data) != end - start:
        raise RuntimeError(f"short read {url} {start}-{end}: {len(data)}")
    return data


def fetch_file(pfile, output, workers=8):
    """Write one manifest file to `output` (atomically)."""
    # group needed chunks by bundle and merge contiguous ranges
    spans = {}
    for c in pfile.chunks:
        spans.setdefault(c.bundle.bundle_id, set()).add((c.offset, c.offset + c.size))
    jobs = []
    for bid, ranges in spans.items():
        cur = None
        for s, e in sorted(ranges):
            if cur and s <= cur[1] + 4096:
                cur[1] = max(cur[1], e)
            else:
                if cur:
                    jobs.append((bid, cur[0], cur[1]))
                cur = [s, e]
        jobs.append((bid, cur[0], cur[1]))
    blobs = {}
    with cf.ThreadPoolExecutor(workers) as ex:
        futs = {ex.submit(_fetch_range, *j): j for j in jobs}
        for fut in cf.as_completed(futs):
            blobs[futs[fut]] = fut.result()
    index = {}
    for (bid, s, e), data in blobs.items():
        index.setdefault(bid, []).append((s, e, data))
    os.makedirs(os.path.dirname(output) or ".", exist_ok=True)
    tmp = output + ".part"
    with open(tmp, "wb") as f:
        for c in pfile.chunks:
            for s, e, data in index[c.bundle.bundle_id]:
                if s <= c.offset and c.offset + c.size <= e:
                    raw = data[c.offset - s:c.offset - s + c.size]
                    break
            else:
                raise RuntimeError(f"chunk {c.chunk_id:016X} not fetched")
            out = zstd_decompress(raw)
            if len(out) != c.target_size:
                raise RuntimeError(f"chunk {c.chunk_id:016X}: size {len(out)} != {c.target_size}")
            f.write(out)
    if os.path.getsize(tmp) != pfile.size:
        raise RuntimeError(f"{pfile.name}: size mismatch")
    os.replace(tmp, output)
    return output


if __name__ == "__main__":
    version, url = live_manifest_url()
    print(version, url)
    m = load_manifest(url, sys.argv[1])
    for name in sys.argv[3:]:
        t = time.time()
        p = fetch_file(m.files[name], os.path.join(sys.argv[2], os.path.basename(name)))
        print(name, os.path.getsize(p), f"{time.time() - t:.1f}s")
