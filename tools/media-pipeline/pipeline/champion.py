"""Process one champion: download its WADs, build glb models, chroma textures and
voice-over, then delete the WADs. Returns a JSON-able state for the manifest."""
import json
import os
import re
import shutil
import subprocess
import tempfile
import time
from concurrent.futures import ThreadPoolExecutor

import gamedata as gd
import rman_fetch
import wwise

RIFTMODEL = os.environ.get("RIFTMODEL", "/opt/riftmodel/riftmodel")
NODE = os.environ.get("NODE", "node")
OPTIMIZE = os.environ.get("OPTIMIZE_JS", "/opt/media/node/optimize.mjs")
VGMSTREAM = os.environ.get("VGMSTREAM", "vgmstream-cli")
LANGS = {"en": "en_US", "ru": "ru_RU"}


def _run_jsonl(cmd, jobs, cwd, timeout):
    """Run a batch tool over JSON-lines jobs, return {id: result}."""
    path = os.path.join(cwd, f"jobs-{os.path.basename(cmd[0])}-{len(jobs)}.jsonl")
    with open(path, "w") as f:
        for j in jobs:
            f.write(json.dumps(j) + "\n")
    r = subprocess.run(cmd + [path] if "{jobs}" not in cmd else [c.replace("{jobs}", path) for c in cmd],
                       capture_output=True, text=True, timeout=timeout, cwd=cwd)
    out = {}
    for line in r.stdout.splitlines():
        line = line.strip()
        if line.startswith("{"):
            try:
                res = json.loads(line)
                out[res.get("id")] = res
            except json.JSONDecodeError:
                pass
    if r.returncode != 0 and not out:
        raise RuntimeError(f"{os.path.basename(cmd[0])} rc={r.returncode}: {r.stderr[-500:]}")
    return out


def _write(path, data):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "wb") as f:
        f.write(data)
    return path


class ChampionJob:
    def __init__(self, ctx, champ):
        self.ctx = ctx
        self.champ = champ  # {"id", "alias", "skins": [{"id","num"}], "chromas": [{"id","num","parent"}]}
        self.cid = champ["id"]
        self.alias = champ["alias"]
        self.out = ctx["out"]
        self.work = os.path.join(ctx["work"], self.alias)
        self.state = {"champion": self.alias, "skins": {}, "chromas": {}, "errors": []}

    def skin_state(self, sid):
        return self.state["skins"].setdefault(str(sid), {})

    # ------------------------------------------------------------------
    def run(self):
        t0 = time.time()
        shutil.rmtree(self.work, ignore_errors=True)
        os.makedirs(self.work)
        try:
            if not self.fetch():
                for s in self.champ["skins"]:
                    self.skin_state(s["id"])["modelError"] = "no champion WAD in the live game client"
                return self.state
            self.data = gd.ChampionData(self.main, self.alias)
            self.models()
            self.voice()
        finally:
            for w in getattr(self, "wads", {}).values():
                w.close()
            shutil.rmtree(self.work, ignore_errors=True)
        self.state["seconds"] = round(time.time() - t0, 1)
        return self.state

    def fetch(self):
        files = self.ctx["manifest_files"]  # lowercased name -> PatcherFile
        self.wads = {}
        base = f"data/final/champions/{self.alias.lower()}"
        wanted = {"main": base + ".wad.client"}
        for lang, loc in LANGS.items():
            wanted[lang] = f"{base}.{loc.lower()}.wad.client"
        for key, name in wanted.items():
            pf = files.get(name)
            if pf is None:
                self.state["errors"].append(f"{name} not in live manifest")
                if key == "main":
                    return False
                continue
            local = os.path.join(self.work, os.path.basename(pf.name))
            rman_fetch.fetch_file(pf, local)
            self.wads[key] = gd.WadReader(local, pf.name)
        self.main = self.wads["main"]
        return True

    # ---- models ---------------------------------------------------------
    def tex_file(self, h):
        path = os.path.join(self.work, "tex", f"{h:016x}.tex")
        if not os.path.exists(path):
            data = self.main.read(h)
            if not data:
                return None
            _write(path, data)
        return path

    def raw_file(self, h, ext):
        path = os.path.join(self.work, ext, f"{h:016x}.{ext}")
        if not os.path.exists(path):
            data = self.main.read(h)
            if not data:
                return None
            _write(path, data)
        return path

    def models(self):
        bh = self.ctx["binhashes"]
        specs, entries = {}, {}
        for s in self.champ["skins"]:
            sid = s["id"]
            st = self.skin_state(sid)
            try:
                skin = self.data.skin_entry(s["num"])
            except Exception as e:
                st["modelError"] = f"skin bin unreadable: {e}"
                continue
            if skin is None:
                st["modelError"] = "no skin bin in WAD"
                continue
            entries[sid] = skin
            spec, err = self.data.model_spec(skin, bh)
            if err:
                st["modelError"] = err
                continue
            if not spec["anims"]:
                st["modelWarning"] = "no animation graph clips"
            specs[sid] = spec
        self.skin_entries = entries

        # chroma textures relative to the parent skin's materials
        chroma_tex = {}  # sid -> {cid: {material: tex hash}}
        for ch in self.champ["chromas"]:
            parent = specs.get(ch["parent"])
            cst = self.state["chromas"].setdefault(str(ch["id"]), {})
            if parent is None:
                continue
            try:
                cskin = self.data.skin_entry(ch["num"])
            except Exception:
                cskin = None
            if cskin is None or cskin.get("skinMeshProperties") is None:
                cst["textureError"] = "no chroma skin bin"
                continue
            mesh = cskin.get("skinMeshProperties").value
            skn = mesh.getv("simpleSkin")
            skn_h = gd.path_hash(skn) if isinstance(skn, str) else None
            if skn_h is not None and skn_h != parent["skn"]:
                cst["textureError"] = "chroma uses another mesh"
                continue
            default, overrides = self.data.mesh_textures(mesh)
            chroma_tex.setdefault(ch["parent"], {})[ch["id"]] = (default, overrides)

        jobs = []
        for sid, spec in specs.items():
            textures = []
            for mat, h in spec["overrides"].items():
                p = self.tex_file(h)
                if p:
                    textures.append({"material": mat, "tex": p})
            default = self.tex_file(spec["default"]) if spec["default"] else None
            anims = []
            for name, h in spec["anims"]:
                p = self.raw_file(h, "anm")
                if p:
                    anims.append({"name": name, "path": p})
            jobs.append({
                "id": str(sid),
                "skn": self.raw_file(spec["skn"], "skn"),
                "skl": self.raw_file(spec["skl"], "skl"),
                "out": os.path.join(self.work, "glb", f"{sid}.glb"),
                "defaultTex": default,
                "textures": textures,
                "anims": anims,
            })
        # chroma pngs (one per distinct texture)
        png_for = {}
        for sid, chromas in chroma_tex.items():
            for cid, (default, overrides) in chromas.items():
                for h in [default, *overrides.values()]:
                    if h is not None and h not in png_for and self.main.has(h):
                        src = self.tex_file(h)
                        if src:
                            png_for[h] = os.path.join(self.work, "png", f"{h:016x}.png")
                            jobs.append({"id": f"tex:{h:016x}", "pngs": [{"tex": src, "png": png_for[h]}]})
        if not jobs:
            return
        results = _run_jsonl([RIFTMODEL, "batch"], jobs, self.work, timeout=3600)

        opt_jobs = []
        chroma_files = {}  # tex hash -> rel path
        for sid, spec in specs.items():
            st = self.skin_state(sid)
            res = results.get(str(sid))
            if not res or not res.get("ok"):
                st["modelError"] = (res or {}).get("error", "riftmodel produced no result")
                continue
            if res.get("animErrors"):
                st["animErrors"] = res["animErrors"]
            materials = [m for m in res.get("materials", []) if m.lower() not in {h.lower() for h in spec["hide"]}]
            base_tex = {m: spec["overrides"].get(m, spec["default"]) for m in materials}
            extras = {"baseMaterials": [m for m in materials if base_tex[m] == spec["default"]], "chromas": {}}
            for cid, (cdef, cover) in chroma_tex.get(sid, {}).items():
                swap = {}
                for m in materials:
                    new = cover.get(m, cdef)
                    if new is None or new == base_tex[m] or new not in png_for:
                        continue
                    rel = f"models/chromas/{cid}.webp" if new == cdef else f"models/chromas/{cid}-{new:016x}.webp"
                    chroma_files.setdefault((cid, new), rel)
                    swap[m] = rel
                if swap:
                    extras["chromas"][str(cid)] = swap
                    main_rel = f"models/chromas/{cid}.webp"
                    if main_rel in swap.values():
                        self.state["chromas"][str(cid)]["texture"] = main_rel
                    else:
                        self.state["chromas"][str(cid)]["texture"] = next(iter(swap.values()))
            opt_jobs.append({
                "id": str(sid),
                "in": os.path.join(self.work, "glb", f"{sid}.glb"),
                "out": os.path.join(self.work, "opt", f"{sid}.glb"),
                "hide": spec["hide"],
                "extras": extras,
            })
        for (cid, h), rel in chroma_files.items():
            opt_jobs.append({"id": f"chroma:{cid}:{h:016x}", "png": png_for[h], "webp": os.path.join(self.out, rel)})
        if not opt_jobs:
            return
        os.makedirs(os.path.join(self.work, "opt"), exist_ok=True)
        os.makedirs(os.path.join(self.out, "models", "chromas"), exist_ok=True)
        opt = _run_jsonl([NODE, OPTIMIZE], opt_jobs, self.work, timeout=3600)
        for (cid, h), rel in chroma_files.items():
            r = opt.get(f"chroma:{cid}:{h:016x}")
            if not r or not r.get("ok"):
                self.state["chromas"][str(cid)].pop("texture", None)
                self.state["chromas"][str(cid)]["textureError"] = (r or {}).get("error", "texture not written")
        for sid in specs:
            st = self.skin_state(sid)
            if "modelError" in st:
                continue
            r = opt.get(str(sid))
            if not r or not r.get("ok"):
                st["modelError"] = "optimize: " + (r or {}).get("error", "no result")
                continue
            rel = f"models/{sid}.glb"
            dst = os.path.join(self.out, rel)
            shutil.move(os.path.join(self.work, "opt", f"{sid}.glb"), dst + ".part")
            os.replace(dst + ".part", dst)
            st["model"] = {"glb": rel, "animations": r["animations"], "bytes": r["bytes"]}

    # ---- voice-over -----------------------------------------------------
    def voice(self):
        cid = self.cid
        sids = {s["id"] for s in self.champ["skins"]}
        source_of = {}
        banks = {}
        for s in self.champ["skins"]:
            sid = s["id"]
            skin = self.skin_entries.get(sid)
            vb = gd.ChampionData.vo_banks(skin) if skin is not None else None
            if vb is None:
                source_of[sid] = None
                continue
            events_path, wpk_path, events, token = vb
            src = sid if token is None else cid * 1000 + (0 if token == "base" else int(token[4:]))
            if src not in sids:
                src = sid  # bank of a skin that is not listed: attach it here
            source_of[sid] = src
            if src == sid or src not in banks:
                banks.setdefault(src, (events_path, wpk_path, events))
        base = cid * 1000
        for s in self.champ["skins"]:
            sid = s["id"]
            st = self.skin_state(sid)
            src = source_of.get(sid)
            if src is None:
                src = base if sid != base and base in banks else None
            if src is None:
                continue
            if src != sid:
                st["voFrom"] = src
                continue
            events_path, wpk_path, events = banks[src]
            vo = {}
            for lang in LANGS:
                wad = self.wads.get(lang)
                if wad is None:
                    continue
                try:
                    lines = self.convert_bank(wad, events_path, wpk_path, events, lang, sid)
                except Exception as e:
                    st.setdefault("voErrors", {})[lang] = str(e)[:300]
                    continue
                if lines:
                    vo[lang] = lines
                else:
                    st.setdefault("voErrors", {})[lang] = "bank not in locale WAD"
            if vo:
                st["vo"] = vo
        # a skin pointing at a source without converted lines falls back to the base
        for sid, st in self.state["skins"].items():
            src = st.get("voFrom")
            if src and "vo" not in self.state["skins"].get(str(src), {}):
                if src != base and "vo" in self.state["skins"].get(str(base), {}) and int(sid) != base:
                    st["voFrom"] = base
                else:
                    del st["voFrom"]

    def convert_bank(self, wad, events_path, wpk_path, events, lang, sid):
        bnk = wad.read(events_path.lower())
        wpk = wad.read(wpk_path.lower())
        if not bnk or not wpk:
            return []
        wems = wwise.read_wpk(wpk)
        ids = [wwise.fnv1_32(n) for n in events]
        mapping = wwise.event_sources(bnk, ids)
        order = []  # (source id, event label)
        seen = set()
        for name, eid in zip(events, ids):
            label = re.sub(r"^play_vo_[^_]+_", "", name, flags=re.I)
            for src in mapping.get(eid, []):
                if src in wems and src not in seen:
                    seen.add(src)
                    order.append((src, label))
        for src in sorted(wems):
            if src not in seen:
                order.append((src, None))
        rel_dir = f"vo/{lang}/{sid}"
        out_dir = os.path.join(self.out, rel_dir)
        os.makedirs(out_dir, exist_ok=True)

        # wem -> wav: one vgmstream call per chunk; wav -> opus: one ffmpeg call
        # with many outputs per chunk (process start-up dominates single calls)
        def conv(chunk):
            durations = {}
            with tempfile.TemporaryDirectory(dir=self.work) as tmp:
                names = []
                for src in chunk:
                    _write(os.path.join(tmp, f"{src}.wem"), wems[src])
                    names.append(f"{src}.wem")
                subprocess.run([VGMSTREAM, "-o", "?f.wav", *names], cwd=tmp, capture_output=True)
                ff = ["ffmpeg", "-nostdin", "-loglevel", "error", "-y"]
                outs = []
                for src in chunk:
                    wav = os.path.join(tmp, f"{src}.wem.wav")
                    d = _wav_duration(wav)
                    if d is None:
                        continue
                    durations[src] = d
                    dst = os.path.join(out_dir, f"{src}.ogg")
                    if not os.path.exists(dst):
                        ff += ["-i", wav]
                        outs.append((src, dst))
                for n, (src, dst) in enumerate(outs):
                    ff += ["-map", f"{n}:a", "-c:a", "libopus", "-b:a", "48k", "-vbr", "on", "-compression_level", "10",
                           "-map_metadata", "-1", dst + ".part.ogg"]
                if outs:
                    r = subprocess.run(ff, capture_output=True, text=True)
                    for src, dst in outs:
                        if r.returncode == 0 and os.path.exists(dst + ".part.ogg"):
                            os.replace(dst + ".part.ogg", dst)
                        else:
                            durations.pop(src, None)
            return durations

        srcs = [s for s, _ in order]
        chunks = [srcs[i:i + 40] for i in range(0, len(srcs), 40)]
        durations = {}
        with ThreadPoolExecutor(self.ctx.get("audio_threads", 3)) as ex:
            for d in ex.map(conv, chunks):
                durations.update(d)
        lines = []
        for src, label in order:
            if src not in durations:
                continue
            line = {"file": f"{rel_dir}/{src}.ogg"}
            if label:
                line["event"] = label
            line["duration"] = durations[src]
            lines.append(line)
        return lines


def _wav_duration(path):
    """Seconds of a RIFF/WAVE file (PCM or float), None if unreadable."""
    try:
        with open(path, "rb") as f:
            data = f.read(4096)
            size = os.path.getsize(path)
    except OSError:
        return None
    if data[:4] != b"RIFF" or data[8:12] != b"WAVE":
        return None
    pos, rate, block = 12, None, None
    while pos + 8 <= len(data):
        tag, n = data[pos:pos + 4], int.from_bytes(data[pos + 4:pos + 8], "little")
        if tag == b"fmt ":
            rate = int.from_bytes(data[pos + 12:pos + 16], "little")
            block = int.from_bytes(data[pos + 20:pos + 22], "little")
        elif tag == b"data":
            n = min(n, size - pos - 8)
            return round(n / block / rate, 2) if rate and block else None
        pos += 8 + n + (n & 1)
    return None
