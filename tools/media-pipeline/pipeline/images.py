"""Skin pictures and videos from CommunityDragon -> WebP (+AVIF for splashes), webm copies."""
import os
import subprocess
import tempfile
import time

import requests

UA = "RiftDen-media/1.0 (+https://riftden.com)"
CDRAGON = "https://raw.communitydragon.org"

_session = requests.Session()
_session.headers["User-Agent"] = UA


def cdragon_get(url, tries=5):
    err = None
    for attempt in range(tries):
        try:
            r = _session.get(url, timeout=120)
            if r.status_code == 200:
                return r.content
            if r.status_code == 404:
                raise FileNotFoundError(f"404 {url}")
            err = f"HTTP {r.status_code}"
        except requests.RequestException as e:
            err = str(e)
        time.sleep(2 ** attempt)
    raise RuntimeError(f"{url}: {err}")


def asset_url(patch_dir, game_path):
    """`/lol-game-data/assets/ASSETS/...` or `ASSETS/...` -> CommunityDragon URL."""
    p = game_path
    if p.startswith("/lol-game-data/assets/"):
        p = p[len("/lol-game-data/assets/"):]
    p = p.lstrip("/").lower()
    return f"{CDRAGON}/{patch_dir}/plugins/rcp-be-lol-game-data/global/default/{p}"


def _run(cmd):
    r = subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
    if r.returncode != 0:
        raise RuntimeError(f"{cmd[0]}: {r.stderr.decode(errors='replace')[-300:]}")


def convert_image(data, out_webp, avif=False, quality=82):
    """Write WebP (and optionally AVIF next to it); atomic per file."""
    os.makedirs(os.path.dirname(out_webp), exist_ok=True)
    with tempfile.TemporaryDirectory(dir=os.path.dirname(out_webp)) as tmp:
        src = os.path.join(tmp, "src")
        with open(src, "wb") as f:
            f.write(data)
        # cwebp and avifenc pick the decoder by extension
        kind = "png" if data[:8] == b"\x89PNG\r\n\x1a\n" else "jpg"
        os.rename(src, src + "." + kind)
        src += "." + kind
        tmp_webp = os.path.join(tmp, "o.webp")
        _run(["cwebp", "-quiet", "-q", str(quality), "-m", "5", "-mt", "-alpha_q", "90", src, "-o", tmp_webp])
        if avif:
            tmp_avif = os.path.join(tmp, "o.avif")
            _run(["avifenc", "--speed", "6", "--min", "22", "--max", "34", "-j", "2", src, tmp_avif])
            os.replace(tmp_avif, out_webp[:-5] + ".avif")
        os.replace(tmp_webp, out_webp)


def save_raw(data, out):
    os.makedirs(os.path.dirname(out), exist_ok=True)
    tmp = out + ".part"
    with open(tmp, "wb") as f:
        f.write(data)
    os.replace(tmp, out)


def skin_image_jobs(skin):
    """[(kind, game path)] for one skin or tier record of skins.json."""
    jobs = []
    for kind, key in (("splash", "splashPath"), ("uncentered", "uncenteredSplashPath"), ("tile", "tilePath"),
                      ("loading", "loadScreenPath"), ("vintage", "loadScreenVintagePath")):
        if skin.get(key):
            jobs.append((kind, skin[key]))
    return jobs


def process_skin_images(patch_dir, out_root, sid, record, chromas):
    """Download and convert everything visual of one skin. Returns (entry, errors)."""
    images, errors = {}, []
    for kind, gp in skin_image_jobs(record):
        rel = f"images/{kind}/{sid}.webp"
        dst = os.path.join(out_root, rel)
        try:
            if not os.path.exists(dst):
                convert_image(cdragon_get(asset_url(patch_dir, gp)), dst, avif=kind in ("splash", "uncentered"))
            images[kind] = rel
        except Exception as e:
            errors.append(f"image {kind}: {e}")

    chroma_out = {}
    for ch in chromas:
        cid = str(ch["id"])
        rel = f"images/chromas/{cid}.webp"
        dst = os.path.join(out_root, rel)
        try:
            if ch.get("chromaPath") and not os.path.exists(dst):
                convert_image(cdragon_get(asset_url(patch_dir, ch["chromaPath"])), dst)
            if ch.get("chromaPath"):
                chroma_out[cid] = {"image": rel}
        except Exception as e:
            errors.append(f"chroma {cid}: {e}")

    video = {"features": []}
    vpath = record.get("splashVideoPath") or record.get("collectionSplashVideoPath")
    if vpath:
        rel = f"video/splash/{sid}.webm"
        dst = os.path.join(out_root, rel)
        try:
            if not os.path.exists(dst):
                save_raw(cdragon_get(asset_url(patch_dir, vpath)), dst)
            video["splash"] = rel
        except Exception as e:
            errors.append(f"splash video: {e}")
    for i, feat in enumerate(record.get("skinFeaturePreviewData") or []):
        if not feat.get("videoPath"):
            continue
        rel = f"video/features/{sid}-{i + 1}.webm"
        dst = os.path.join(out_root, rel)
        try:
            if not os.path.exists(dst):
                save_raw(cdragon_get(asset_url(patch_dir, feat["videoPath"])), dst)
            video["features"].append({"name": feat.get("description") or f"#{i + 1}", "file": rel})
        except Exception as e:
            errors.append(f"feature video {i + 1}: {e}")
    return {"images": images, "chromas": chroma_out, "video": video}, errors
