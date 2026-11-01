"""Read champion WADs and skin BIN files: what a skin needs for its 3D model,
its chroma textures and its voice-over banks.

BIN `PATH` values are xxh64 hashes of lowercased file paths, i.e. exactly the
WAD entry hashes, so no path hash table is needed. Clip names in animation
graphs are FNV-1a hashes; they are matched against candidate names and, for
fuzzy matching, against CommunityDragon's `hashes.binhashes.txt`.
"""
import io
import os
import re

import cdtb.binfile as _binfile
from cdtb.binfile import BinFile, compute_binhash
from cdtb.wad import Wad
from xxhash import xxh64_intdigest

# CDTB resolves every hash to a name on construction, loading its hash tables
# (hundreds of MB). Only raw hashes are used here: give it empty tables.
for _hf in (_binfile.hashfile_binentries, _binfile.hashfile_binhashes, _binfile.hashfile_binhashes_xxh3,
            _binfile.hashfile_binfields, _binfile.hashfile_bintypes, _binfile.hashfile_binpaths):
    _hf.hashes = {}


def path_hash(path: str) -> int:
    return xxh64_intdigest(path.lower())


class WadReader:
    """Random access to a WAD by path or path hash (no hash table needed)."""

    def __init__(self, path, rel_name):
        wad = Wad.__new__(Wad)
        wad.path = path
        wad.version = None
        wad.files = None
        wad.parse_headers()
        toc = path_hash(rel_name.lower().replace(".wad.client", ".wad.subchunktoc"))
        for wf in wad.files:
            if wf.path_hash == toc:
                wf.path = "x.subchunktoc"
        wad.load_subchunk_toc()
        self.wad = wad
        self.entries = {wf.path_hash: wf for wf in wad.files}
        self.f = open(path, "rb")

    def has(self, h):
        return h in self.entries

    def read(self, h_or_path):
        h = path_hash(h_or_path) if isinstance(h_or_path, str) else h_or_path
        wf = self.entries.get(h)
        if wf is None:
            return None
        return self.wad.read_file_data(self.f, wf)

    def close(self):
        self.f.close()


T_ATOMIC = compute_binhash("AtomicClipData")
T_SEQUENCER = compute_binhash("SequencerClipData")
T_SKIN = compute_binhash("SkinCharacterDataProperties")
T_MATERIAL = compute_binhash("StaticMaterialDef")

# output clip name -> exact candidates (tried first), then a fuzzy regex
ANIMATIONS = [
    ("idle", ["Idle1", "Idle1_Base", "Idle_Base", "Idle", "Idle01", "Idle_01", "Idle1_Loop"], r"^idle"),
    ("run", ["Run", "Run_Base", "Run1", "Run01", "Run_01"], r"^run"),
    ("attack", ["Attack1", "Attack", "Attack01", "Attack_01", "Attack1_Base"], r"^attack"),
    ("spell1", ["Spell1", "Spell1A", "Spell1_A", "Spell1_Base"], r"^spell_?1"),
    ("spell2", ["Spell2", "Spell2A", "Spell2_A", "Spell2_Base"], r"^spell_?2"),
    ("spell3", ["Spell3", "Spell3A", "Spell3_A", "Spell3_Base"], r"^spell_?3"),
    ("spell4", ["Spell4", "Spell4A", "Spell4_A", "Spell4_Base"], r"^spell_?4"),
    ("dance", ["Dance", "Dance_Loop", "Dance_Base", "Dance1"], r"^dance"),
    ("recall", ["Recall", "Recall_Base", "Recall1"], r"^recall"),
    ("joke", ["Joke", "Joke_Base", "Joke1"], r"^joke"),
    ("taunt", ["Taunt", "Taunt_Base", "Taunt1"], r"^taunt"),
]
# transitions and short variants are never what a viewer wants to loop
SKIP_CLIP = re.compile(r"(_to_|_to|to_|_in$|_out$|_intro$|winddown|windup|wndup|_end$|_outro|turn_)", re.I)


class BinHashes:
    """Reverse lookup of FNV-1a bin hashes (only used for fuzzy clip names)."""

    def __init__(self, path):
        self.names = {}
        if path and os.path.exists(path):
            with open(path, encoding="utf-8", errors="replace") as f:
                for line in f:
                    h, _, name = line.rstrip("\n").partition(" ")
                    if name:
                        self.names[int(h, 16)] = name

    def name(self, h):
        return self.names.get(h)


def _walk_hashes(value, out):
    """Collect every hash-like value nested in a bin value."""
    if hasattr(value, "fields"):
        for f in value.fields:
            _walk_hashes(f.value, out)
    elif hasattr(value, "values"):
        vals = value.values.values() if isinstance(value.values, dict) else value.values
        for v in vals:
            _walk_hashes(v, out)
    elif hasattr(value, "h"):
        out.append(value.h)


class ChampionData:
    """BIN entries of one champion, loaded lazily from its main WAD."""

    def __init__(self, wad: WadReader, alias: str):
        self.wad = wad
        self.alias = alias.lower()
        self.entries = {}
        self.loaded = set()

    def load_bin(self, path_or_hash):
        h = path_hash(path_or_hash) if isinstance(path_or_hash, str) else path_or_hash
        if h in self.loaded:
            return True
        self.loaded.add(h)
        data = self.wad.read(h)
        if not data:
            return False
        try:
            b = BinFile(io.BytesIO(data))
        except Exception:
            return False
        for e in b.entries:
            self.entries.setdefault(e.path.h, e)
        for linked in b.linked_files or []:
            if linked.lower().startswith("data/characters/"):
                self.load_bin(linked)
        return True

    def skin_entry(self, num):
        path = f"data/characters/{self.alias}/skins/skin{num}.bin"
        h = path_hash(path)
        data = self.wad.read(h)
        if not data:
            return None
        b = BinFile(io.BytesIO(data))
        skin = None
        for e in b.entries:
            self.entries.setdefault(e.path.h, e)
            if e.type.h == T_SKIN and skin is None:
                skin = e
        for linked in b.linked_files or []:
            if linked.lower().startswith("data/characters/"):
                self.load_bin(linked)
        return skin

    # ---- textures -------------------------------------------------------
    def material_diffuse(self, link_h):
        mat = self.entries.get(link_h)
        if mat is None:
            return None
        samplers = mat.getv("samplerValues") or []
        best = None
        for s in samplers:
            name = (s.getv("textureName") or s.getv("samplerName") or "").lower()
            tex = s.get("texturePath")
            if tex is None:
                continue
            val = tex.value
            th = val.h if hasattr(val, "h") else path_hash(val)
            if not self.wad.has(th):
                continue
            if "diffuse" in name or name in ("main_texture", "maintexture", "albedo", "basecolor"):
                return th
            if best is None and "mask" not in name and "normal" not in name and "gradient" not in name:
                best = th
        return best

    @staticmethod
    def _tex_hash(field):
        if field is None:
            return None
        v = field.value
        return v.h if hasattr(v, "h") else path_hash(v)

    def mesh_textures(self, mesh):
        """(default texture hash, {submesh: texture hash})"""
        default = self._tex_hash(mesh.get("texture"))
        if (default is None or not self.wad.has(default)) and mesh.get("Material") is not None:
            default = self.material_diffuse(mesh.get("Material").value.h) or default
        overrides = {}
        for ov in mesh.getv("materialOverride") or []:
            sub = ov.getv("submesh")
            if not sub:
                continue
            th = self._tex_hash(ov.get("texture"))
            if (th is None or not self.wad.has(th)) and ov.get("Material") is not None:
                th = self.material_diffuse(ov.get("Material").value.h)
            if th is not None and self.wad.has(th):
                overrides[sub] = th
        return default, overrides

    # ---- animations -----------------------------------------------------
    def animation_files(self, skin, binhashes: BinHashes):
        """[(output name, anm path hash)] picked from the skin animation graph."""
        props = skin.get("skinAnimationProperties")
        if props is None:
            return []
        graph_link = props.value.get("animationGraphData")
        if graph_link is None:
            return []
        graph = self.entries.get(graph_link.value.h)
        if graph is None:
            return []
        clipmap = graph.get("mClipDataMap")
        if clipmap is None:
            return []
        clips = {k.h if hasattr(k, "h") else k: v for k, v in clipmap.value.values.items()}

        def resolve(h, depth=0):
            clip = clips.get(h)
            if clip is None or depth > 6:
                return None
            if clip.type.h == T_ATOMIC:
                res = clip.get("mAnimationResourceData")
                if res is None:
                    return None
                p = res.value.get("mAnimationFilePath")
                if p is None:
                    return None
                ph = p.value.h if hasattr(p.value, "h") else path_hash(p.value)
                return ph if self.wad.has(ph) else None
            refs = []
            for f in clip.fields:
                _walk_hashes(f.value, refs)
            refs = [r for r in refs if r in clips and r != h]
            if clip.type.h == T_SEQUENCER:
                refs = list(reversed(refs))  # intro -> loop: the loop is the clip to show
            for r in refs:
                got = resolve(r, depth + 1)
                if got:
                    return got
            return None

        names = {h: binhashes.name(h) for h in clips}
        picked, used = [], set()
        for out, exact, fuzzy in ANIMATIONS:
            found = None
            for cand in exact:
                found = resolve(compute_binhash(cand))
                if found:
                    break
            if not found:
                rx = re.compile(fuzzy, re.I)
                cands = sorted((n for n in names.values() if n and rx.search(n) and not SKIP_CLIP.search(n)), key=len)
                for n in cands:
                    found = resolve(compute_binhash(n))
                    if found:
                        break
            if found and found not in used:
                used.add(found)
                picked.append((out, found))
        return picked

    # ---- model ----------------------------------------------------------
    def model_spec(self, skin, binhashes):
        mesh_f = skin.get("skinMeshProperties")
        if mesh_f is None:
            return None, "no skinMeshProperties"
        mesh = mesh_f.value
        skn, skl = mesh.getv("simpleSkin"), mesh.getv("skeleton")
        if not skn or not skl:
            return None, "no simpleSkin/skeleton"
        skn_h = path_hash(skn) if isinstance(skn, str) else skn.h
        skl_h = path_hash(skl) if isinstance(skl, str) else skl.h
        if not self.wad.has(skn_h):
            return None, f"skn not in WAD: {skn}"
        if not self.wad.has(skl_h):
            return None, f"skl not in WAD: {skl}"
        default, overrides = self.mesh_textures(mesh)
        hide = mesh.getv("initialSubmeshToHide") or ""
        hide = [s for s in re.split(r"[,\s]+", hide) if s]
        return {
            "skn": skn_h,
            "skl": skl_h,
            "default": default if default and self.wad.has(default) else None,
            "overrides": overrides,
            "hide": hide,
            "anims": self.animation_files(skin, binhashes),
        }, None

    def main_texture(self, skin):
        mesh_f = skin.get("skinMeshProperties")
        if mesh_f is None:
            return None
        default, _ = self.mesh_textures(mesh_f.value)
        return default if default and self.wad.has(default) else None

    # ---- voice-over -----------------------------------------------------
    @staticmethod
    def vo_banks(skin):
        """(events.bnk path, audio.wpk path, [event names], source skin token) or None."""
        audio = skin.get("skinAudioProperties")
        if audio is None:
            return None
        for unit in audio.value.getv("bankUnits") or []:
            paths = unit.getv("bankPath") or []
            name = (unit.getv("name") or "").lower()
            if not (name.endswith("_vo") or any("/vo/" in p.lower() for p in paths)):
                continue
            events_bnk = next((p for p in paths if p.lower().endswith("_events.bnk")), None)
            wpk = next((p for p in paths if p.lower().endswith(".wpk")), None)
            if not events_bnk or not wpk:
                continue
            m = re.search(r"/skins/(base|skin\d+)/", wpk.lower())
            token = m.group(1) if m else None
            return events_bnk, wpk, list(unit.getv("events") or []), token
        return None
