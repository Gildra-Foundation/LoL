"""RiftDen media pipeline.

    run.py build  --out /out --cache /cache [--patch 16.21] [--champions Ahri,Zed] [--skins 103014]
    run.py update --root /out --cache /cache      # daily: new patch -> /out/<patch>, then cleanup

`build` writes into <out>/<patch>.partial (resumable: finished champions and
images are skipped) and renames it to <out>/<patch> when the manifest is done.
"""
import argparse
import json
import multiprocessing
import os
import re
import shutil
import sys
import time
import traceback
from concurrent.futures import ProcessPoolExecutor, ThreadPoolExecutor, as_completed
from datetime import datetime, timezone

import images
import rman_fetch

UA = images.UA
CDRAGON = images.CDRAGON
BINHASHES_URL = f"{CDRAGON}/data/hashes/lol/hashes.binhashes.txt"


def log(*a):
    print(time.strftime("%H:%M:%S"), *a, flush=True)


def cdragon_patch():
    meta = json.loads(images.cdragon_get(f"{CDRAGON}/latest/content-metadata.json"))
    m = re.match(r"(\d+)\.(\d+)", meta["version"])
    return f"{m.group(1)}.{m.group(2)}", meta["version"]


def patch_key(p):
    return tuple(int(x) for x in p.split("."))


def load_binhashes(cache):
    path = os.path.join(cache, "hashes.binhashes.txt")
    if not os.path.exists(path) or time.time() - os.path.getmtime(path) > 86400:
        data = images.cdragon_get(BINHASHES_URL)
        with open(path + ".part", "wb") as f:
            f.write(data)
        os.replace(path + ".part", path)
    return path


# ---------------------------------------------------------------- workers
_ctx = None


def _init_worker(ctx_base):
    global _ctx
    import gamedata
    sys.setrecursionlimit(10000)
    manifest = rman_fetch.load_manifest(ctx_base["manifest_url"], ctx_base["cache"])
    files = {f.name.lower(): f for f in manifest.files.values() if f.name.lower().startswith("data/final/champions/")}
    _ctx = dict(ctx_base, manifest=None, manifest_files=files,
                binhashes=gamedata.BinHashes(ctx_base["binhashes_path"]))


def _champion_worker(champ):
    import champion
    try:
        return champ["id"], champion.ChampionJob(_ctx, champ).run(), None
    except Exception as e:
        return champ["id"], None, f"{type(e).__name__}: {e}\n{traceback.format_exc()[-1500:]}"


def _write_json(path, obj):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path + ".part", "w") as f:
        json.dump(obj, f, ensure_ascii=False, separators=(",", ":"))
    os.replace(path + ".part", path)


def du(path):
    total = 0
    for root, _, files in os.walk(path):
        for f in files:
            try:
                total += os.path.getsize(os.path.join(root, f))
            except OSError:
                pass
    return total


# ---------------------------------------------------------------- build
def build(args):
    t_start = time.time()
    patch = args.patch or cdragon_patch()[0]
    live_version, manifest_url = rman_fetch.live_manifest_url()
    live_patch = ".".join(live_version.split(".")[:2])
    if live_patch != patch:
        raise SystemExit(f"live game is {live_version}, CommunityDragon is {patch}: wait until both match")
    final_dir = os.path.join(args.out, patch)
    out = final_dir + ".partial"
    if os.path.exists(os.path.join(final_dir, "manifest.json")) and not args.force:
        log(f"{final_dir} already complete")
        return final_dir
    os.makedirs(out, exist_ok=True)
    work = os.path.join(args.cache, "work")
    os.makedirs(work, exist_ok=True)
    state_dir = os.path.join(out, ".state")
    log(f"patch {patch}, live {live_version}, out {out}")

    skins_en = json.loads(images.cdragon_get(f"{CDRAGON}/{patch}/plugins/rcp-be-lol-game-data/global/default/v1/skins.json"))
    champs = json.loads(images.cdragon_get(f"{CDRAGON}/{patch}/plugins/rcp-be-lol-game-data/global/default/v1/champion-summary.json"))
    alias = {c["id"]: c["alias"] for c in champs if c["id"] > 0}

    # skins + quest tiers (tiers are separate records on the site)
    records = {}
    for sid, s in skins_en.items():
        sid = int(sid)
        records[sid] = {"record": s, "chromas": s.get("chromas") or [], "parent": None}
        for tier in (s.get("questSkinInfo") or {}).get("tiers") or []:
            if tier.get("id") and tier["id"] != sid:
                records[tier["id"]] = {"record": tier, "chromas": [], "parent": sid}
    if args.skins:
        keep = {int(x) for x in args.skins.split(",")}
        records = {k: v for k, v in records.items() if k in keep or v["parent"] in keep}
    if args.champions:
        keep = {a.lower() for a in args.champions.split(",")}
        records = {k: v for k, v in records.items() if alias.get(k // 1000, "").lower() in keep}
    log(f"{len(records)} skin records ({sum(1 for r in records.values() if r['parent'])} tiers)")

    timings = {}
    t = time.time()
    img_states = {}

    def img_job(sid):
        path = os.path.join(state_dir, "images", f"{sid}.json")
        if os.path.exists(path):
            with open(path) as f:
                return sid, json.load(f)
        r = records[sid]
        entry, errors = images.process_skin_images(patch, out, sid, r["record"], r["chromas"])
        st = {"entry": entry, "errors": errors}
        if not errors:
            _write_json(path, st)
        return sid, st

    # images run in threads next to the champion processes (network + cwebp/avifenc)
    img_pool = ThreadPoolExecutor(args.image_threads)
    img_futs = [] if args.skip_images else [img_pool.submit(img_job, sid) for sid in records]

    # ---- champions
    by_champ = {}
    for sid, r in records.items():
        cid = sid // 1000
        if cid not in alias:
            continue
        c = by_champ.setdefault(cid, {"id": cid, "alias": alias[cid], "skins": [], "chromas": []})
        c["skins"].append({"id": sid, "num": sid % 1000})
        for ch in r["chromas"]:
            c["chromas"].append({"id": ch["id"], "num": ch["id"] % 1000, "parent": sid})
    champ_states = {}
    todo = []
    for cid, c in sorted(by_champ.items()):
        path = os.path.join(state_dir, "champions", f"{cid}.json")
        if os.path.exists(path) and not args.force:
            with open(path) as f:
                champ_states[cid] = json.load(f)
        else:
            todo.append(c)
    champ_failures = {}
    if todo and not args.skip_champions:
        binhashes_path = load_binhashes(args.cache)
        rman_fetch.load_manifest(manifest_url, args.cache)  # download once before forking
        ctx_base = {"out": out, "work": work, "cache": args.cache, "manifest_url": manifest_url,
                    "binhashes_path": binhashes_path, "audio_threads": args.audio_threads}
        log(f"champions: {len(todo)} to do, {len(champ_states)} cached, {args.workers} workers")
        with ProcessPoolExecutor(args.workers, mp_context=multiprocessing.get_context("spawn"),
                                 initializer=_init_worker, initargs=(ctx_base,)) as ex:
            futs = [ex.submit(_champion_worker, c) for c in todo]
            for n, fut in enumerate(as_completed(futs), 1):
                cid, st, err = fut.result()
                if err:
                    champ_failures[cid] = err
                    log(f"[{n}/{len(todo)}] {alias[cid]} FAILED: {err.splitlines()[0]}")
                    continue
                champ_states[cid] = st
                _write_json(os.path.join(state_dir, "champions", f"{cid}.json"), st)
                models = sum(1 for s in st["skins"].values() if "model" in s)
                vo = sum(1 for s in st["skins"].values() if "vo" in s)
                log(f"[{n}/{len(todo)}] {alias[cid]} {st.get('seconds')}s models {models}/{len(st['skins'])} vo {vo}")
    timings["champions"] = round(time.time() - t)
    for n, fut in enumerate(as_completed(img_futs), 1):
        try:
            sid, st = fut.result()
            img_states[sid] = st
        except Exception as e:
            log("image job failed", e)
    img_pool.shutdown()
    timings["imagesDone"] = round(time.time() - t)

    # ---- manifest
    manifest = {"patch": patch, "generatedAt": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"), "skins": {}}
    failures = []
    for sid in sorted(records):
        r = records[sid]
        name = r["record"].get("name")
        img = img_states.get(sid) or {}
        if not img:
            p = os.path.join(state_dir, "images", f"{sid}.json")
            if os.path.exists(p):
                with open(p) as f:
                    img = json.load(f)
        entry_img = img.get("entry") or {"images": {}, "chromas": {}, "video": {"features": []}}
        for e in img.get("errors") or []:
            failures.append({"id": sid, "name": name, "stage": "images", "reason": e})
        entry = {"images": entry_img["images"], "chromas": dict(entry_img["chromas"]), "video": entry_img["video"]}
        cst = champ_states.get(sid // 1000)
        if cst is None:
            reason = champ_failures.get(sid // 1000, "champion not processed").splitlines()[0]
            failures.append({"id": sid, "name": name, "stage": "champion", "reason": reason})
        else:
            st = cst["skins"].get(str(sid), {})
            if "model" in st:
                entry["model"] = st["model"]
            else:
                failures.append({"id": sid, "name": name, "stage": "model", "reason": st.get("modelError", "unknown")})
            if st.get("animErrors"):
                failures.append({"id": sid, "name": name, "stage": "animations", "reason": json.dumps(st["animErrors"])[:300]})
            if "vo" in st:
                entry["vo"] = st["vo"]
            if "voFrom" in st:
                entry["voFrom"] = st["voFrom"]
            for lang, e in (st.get("voErrors") or {}).items():
                failures.append({"id": sid, "name": name, "stage": f"vo-{lang}", "reason": e})
            for cid, ch in entry["chromas"].items():
                cs = cst["chromas"].get(cid, {})
                if cs.get("texture"):
                    ch["texture"] = cs["texture"]
        manifest["skins"][str(sid)] = entry

    skins = manifest["skins"].values()
    counts = {
        "skins": len(manifest["skins"]),
        "withImages": sum(1 for s in skins if s["images"].get("splash")),
        "withModel": sum(1 for s in skins if "model" in s),
        "withVoEn": sum(1 for s in skins if "en" in (s.get("vo") or {})),
        "withVoRu": sum(1 for s in skins if "ru" in (s.get("vo") or {})),
        "withVoFrom": sum(1 for s in skins if "voFrom" in s),
        "chromas": sum(len(s["chromas"]) for s in skins),
        "chromaTextures": sum(1 for s in skins for c in s["chromas"].values() if "texture" in c),
        "voLines": sum(len(v) for s in skins for v in (s.get("vo") or {}).values()),
    }
    sizes = {d: du(os.path.join(out, d)) for d in ("images", "video", "models", "vo")}
    timings["total"] = round(time.time() - t_start)
    report = {"patch": patch, "live": live_version, "generatedAt": manifest["generatedAt"], "timings": timings,
              "counts": counts, "bytes": sizes, "failures": failures,
              "championFailures": {alias.get(k, k): v for k, v in champ_failures.items()}}
    _write_json(os.path.join(out, "report.json"), report)
    log("counts", json.dumps(counts))
    log("bytes", json.dumps(sizes))
    if champ_failures and not args.allow_failures:
        raise SystemExit(f"{len(champ_failures)} champions failed; rerun to resume (see report.json)")
    _write_json(os.path.join(out, "manifest.json"), manifest)
    if not (args.skins or args.champions):
        if os.path.isdir(final_dir):
            shutil.rmtree(final_dir)
        os.rename(out, final_dir)
        log(f"done: {final_dir}")
        return final_dir
    log(f"partial build (filtered) kept in {out}")
    return out


# ---------------------------------------------------------------- update
def cleanup(root):
    """Delete patch folders older than the one the site uses (SITE_PATCH)."""
    site_file = os.path.join(root, "SITE_PATCH")
    if not os.path.exists(site_file):
        log("cleanup: no SITE_PATCH yet, nothing deleted")
        return
    site = open(site_file).read().strip()
    if not re.fullmatch(r"\d+\.\d+", site) or not os.path.isdir(os.path.join(root, site)):
        log(f"cleanup: SITE_PATCH={site!r} is not a built patch, nothing deleted")
        return
    for name in os.listdir(root):
        m = re.fullmatch(r"(\d+\.\d+)(\.partial)?", name)
        if m and patch_key(m.group(1)) < patch_key(site):
            log(f"cleanup: removing {name}")
            shutil.rmtree(os.path.join(root, name))


def update(args):
    patch, version = cdragon_patch()
    log(f"CommunityDragon {version}")
    if os.path.exists(os.path.join(args.out, patch, "manifest.json")):
        log(f"{patch} already built")
    else:
        args.patch = patch
        build(args)
    cleanup(args.out)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("command", choices=["build", "update", "cleanup"])
    ap.add_argument("--out", default="/out")
    ap.add_argument("--cache", default="/cache")
    ap.add_argument("--patch")
    ap.add_argument("--champions")
    ap.add_argument("--skins")
    ap.add_argument("--workers", type=int, default=3)
    ap.add_argument("--image-threads", type=int, default=6)
    ap.add_argument("--audio-threads", type=int, default=3)
    ap.add_argument("--skip-images", action="store_true")
    ap.add_argument("--skip-champions", action="store_true")
    ap.add_argument("--allow-failures", action="store_true")
    ap.add_argument("--force", action="store_true")
    args = ap.parse_args()
    os.makedirs(args.cache, exist_ok=True)
    if args.command == "build":
        build(args)
    elif args.command == "update":
        update(args)
    else:
        cleanup(args.out)


if __name__ == "__main__":
    main()
