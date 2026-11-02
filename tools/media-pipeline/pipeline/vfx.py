"""Particle effects of a skin for the web viewer.

Animation clips fire ParticleEventData (effect key + bones + frame). The skin's ResourceResolver maps
the key to a VfxSystemDefinitionData; its emitters are reduced here to what a small WebGL particle
system can draw: camera-facing sprites, flat quads and meshes with rate, lifetime, velocity,
acceleration, drag, scale/colour/rotation over life, texture atlases and blending.
Trails, beams, distortion and gameplay-only effects (spell missiles, buffs) are not exported.
"""
from cdtb.binfile import BinOption, compute_binhash

from gamedata import path_hash

T_VFX = compute_binhash("VfxSystemDefinitionData")
T_RESOLVER = compute_binhash("ResourceResolver")
T_PARTICLE_EVENT = compute_binhash("ParticleEventData")
P_MESH = compute_binhash("VfxPrimitiveMesh")
P_QUAD = compute_binhash("VfxPrimitiveArbitraryQuad")
P_SPRITES = {compute_binhash(n) for n in ("VfxPrimitiveCameraUnitQuad", "VfxPrimitiveCameraQuad", "VfxPrimitiveCameraSegmentBeam")}
MAX_EMITTERS = 24


def _items(v):
    """Values of a BIN map or list, whatever cdtb returned for it."""
    if v is None:
        return []
    if isinstance(v, dict):
        return list(v.values())
    inner = getattr(v, "values", v)
    if isinstance(inner, dict):
        return list(inner.values())
    return list(inner) if isinstance(inner, (list, tuple)) else []


def _unwrap(v):
    while isinstance(v, BinOption):
        v = v.value
    return v


def get(obj, name, default=None):
    if obj is None or not hasattr(obj, "getv"):
        return default
    v = _unwrap(obj.getv(name))
    return default if v is None else v


def _hash(v):
    if isinstance(v, str):
        return compute_binhash(v)
    return getattr(v, "h", v)


def _num(v):
    if isinstance(v, (int, float)):
        return round(float(v), 4)
    if isinstance(v, (list, tuple)):
        return [round(float(x), 4) for x in v]
    return None


def value(obj, name):
    """ValueFloat/ValueVector3/ValueColor: constant, curve over life and random range per component."""
    v = get(obj, name)
    if v is None or not hasattr(v, "getv"):
        return None
    out = {}
    c = _num(get(v, "constantValue"))
    dyn = get(v, "dynamics")
    if dyn is not None:
        times = get(dyn, "times") or []
        values = get(dyn, "values") or []
        if len(times) > 1 and len(times) == len(values):
            out["t"] = _num(list(times))
            out["v"] = [_num(x) for x in values]
        elif values and c is None:
            c = _num(values[0])
        tables = get(dyn, "probabilityTables") or []
        ranges = []
        for tab in tables:
            keys = [float(x) for x in (get(tab, "keyValues") or [])]
            ranges.append([round(min(keys), 4), round(max(keys), 4)] if keys else None)
        if any(ranges):
            out["r"] = ranges
    if c is not None:
        out["c"] = c
    return out or None


def emitter(e, textures, meshes):
    prim = get(e, "primitive")
    ptype = getattr(getattr(prim, "type", None), "h", None)
    if prim is None or ptype in P_SPRITES:
        kind = "sprite"
    elif ptype == P_QUAD:
        kind = "quad"
    elif ptype == P_MESH:
        kind = "mesh"
    else:
        return None  # trails, beams, distortion
    if get(e, "disabled"):
        return None
    tex = get(e, "texture")
    out = {"name": get(e, "emitterName", ""), "kind": kind}
    if isinstance(tex, str) and tex:
        out["tex"] = textures.setdefault(tex.lower(), f"models/fx/tex/{path_hash(tex):016x}.webp")
    if kind == "mesh":
        mesh = get(get(prim, "mMesh"), "mSimpleMeshName")
        if not isinstance(mesh, str) or not mesh.lower().endswith((".scb", ".sco")):
            return None
        out["mesh"] = meshes.setdefault(mesh.lower(), f"models/fx/mesh/{path_hash(mesh):016x}.glb")
    if "tex" not in out and kind != "mesh":
        return None
    for key, field in (("rate", "rate"), ("plife", "particleLifetime"), ("vel", "birthVelocity"), ("acc", "worldAcceleration"),
                       ("drag", "birthDrag"), ("scale", "birthScale0"), ("scaleLife", "scale0"), ("color", "birthColor"),
                       ("colorLife", "Color"), ("rot", "birthRotation0"), ("spin", "birthRotationalVelocity0"),
                       ("offset", "EmitterPosition"), ("rot3", "birthRotation"), ("spin3", "birthRotationalVelocity")):
        v = value(e, field)
        if v:
            out[key] = v
    shape = get(e, "SpawnShape")
    if shape is not None:
        off = value(shape, "emitOffset")
        radius = get(shape, "radius")
        if off:
            out["spawn"] = off
        if isinstance(radius, (int, float)):
            out["radius"] = round(float(radius), 3)
    for key, field in (("life", "lifetime"), ("delay", "timeBeforeFirstEmission"), ("linger", "particleLinger")):
        v = get(e, field)
        if isinstance(v, (int, float)):
            out[key] = round(float(v), 4)
    div = get(e, "texDiv")
    if isinstance(div, (list, tuple)) and len(div) == 2 and (div[0] > 1 or div[1] > 1):
        out["div"] = [int(div[0]), int(div[1])]
        frames = get(e, "numFrames")
        if isinstance(frames, int) and frames > 1:
            out["frames"] = frames
        if get(e, "isRandomStartFrame"):
            out["randomFrame"] = True
    blend = get(e, "blendMode")
    if isinstance(blend, int):
        out["blend"] = blend
    for key, field in (("uniform", "isUniformScale"), ("single", "isSingleParticle"), ("local", "isLocalOrientation"),
                       ("directional", "isDirectionOriented")):
        v = get(e, field)
        if v:
            out[key] = True
    return out


def system(entry, textures, meshes):
    emitters = []
    for e in (get(entry, "complexEmitterDefinitionData") or []) + (get(entry, "simpleEmitterDefinitionData") or []):
        em = emitter(e, textures, meshes)
        if em:
            emitters.append(em)
        if len(emitters) >= MAX_EMITTERS:
            break
    return emitters


def resolver(data, skin):
    """Effect key hash -> VFX system path hash, from the skin's ResourceResolver."""
    link = get(skin, "mResourceResolver")
    entry = data.entries.get(_hash(link)) if link is not None else None
    if entry is None:
        return {}
    rmap = get(entry, "resourceMap")
    vals = rmap if isinstance(rmap, dict) else getattr(rmap, "values", None)
    return {_hash(k): _hash(v) for k, v in vals.items()} if isinstance(vals, dict) else {}


def particle_events(clip):
    """ParticleEventData of an atomic clip: [{start, end, key, bones, loop}] (frames, hashes)."""
    m = get(clip, "mEventDataMap")
    if m is None:
        return []
    events = []
    for ev in _items(m):
        if getattr(getattr(ev, "type", None), "h", None) != T_PARTICLE_EVENT:
            continue
        key = get(ev, "mEffectKey")
        if key is None:
            continue
        bones = []
        for pair in get(ev, "mParticleEventDataPairList") or []:
            b = get(pair, "mBoneName")
            if b is not None:
                bones.append(b if isinstance(b, str) else _hash(b))
        end = get(ev, "mEndFrame")
        events.append({"start": float(get(ev, "mStartFrame", 0.0) or 0.0), "end": float(end) if isinstance(end, (int, float)) and end > 0 else None,
                       "key": _hash(key), "bones": bones or [None], "loop": bool(get(ev, "mIsLoop"))})
    return events


def skin_effects(data, skin, clip_particles):
    """{"events": {clip: [{start, end, bone, system}]}, "systems": [[emitters]]} plus textures/meshes to export."""
    res = resolver(data, skin)
    textures, meshes, systems, index, events = {}, {}, [], {}, {}
    for clip, evs in clip_particles.items():
        out = []
        for ev in evs:
            path = res.get(ev["key"], ev["key"])
            entry = data.entries.get(path)
            if entry is None or getattr(entry.type, "h", None) != T_VFX:
                continue
            if path not in index:
                ems = system(entry, textures, meshes)
                index[path] = len(systems) if ems else None
                if ems:
                    systems.append(ems)
            if index[path] is None:
                continue
            for bone in ev["bones"]:
                out.append({"start": round(ev["start"] / 30, 3), "end": None if ev["end"] is None else round(ev["end"] / 30, 3),
                            "bone": bone, "system": index[path], "loop": ev["loop"]})
        if out:
            events[clip] = out
    return ({"events": events, "systems": systems} if events else None), textures, meshes
