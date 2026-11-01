"""Minimal Wwise readers for League voice-over banks.

* WPK (`r3d2` container) -> {source_id: wem bytes}
* events BNK (HIRC) -> {event_id: [source_id, ...]}

Events are resolved through their actions to the target object, and every
Sound whose parent chain reaches that target is attributed to the event.
The parent of a Sound/container is found as the first u32 in its payload that
is the id of another object of the same bank (the NodeBaseParams parent id
comes before any child list), which is robust to Wwise version differences.
"""
import struct


def fnv1_32(name: str) -> int:
    h = 0x811C9DC5
    for b in name.lower().encode("ascii", "ignore"):
        h = (h * 0x01000193) & 0xFFFFFFFF
        h ^= b
    return h


def read_wpk(data: bytes) -> dict:
    if data[:4] != b"r3d2":
        raise ValueError("not a WPK file")
    _version, count = struct.unpack_from("<II", data, 4)
    offsets = struct.unpack_from(f"<{count}I", data, 12)
    out = {}
    for off in offsets:
        if off == 0:
            continue
        d_off, d_size, n_len = struct.unpack_from("<III", data, off)
        name = data[off + 12:off + 12 + n_len * 2].decode("utf-16-le")
        stem = name.rsplit(".", 1)[0]
        if stem.isdigit():
            out[int(stem)] = data[d_off:d_off + d_size]
    return out


def read_bnk_sections(data: bytes) -> dict:
    sections, pos = {}, 0
    while pos + 8 <= len(data):
        tag, size = struct.unpack_from("<4sI", data, pos)
        sections[tag.decode("ascii", "replace")] = data[pos + 8:pos + 8 + size]
        pos += 8 + size
    return sections


def read_hirc(data: bytes) -> dict:
    """Return {object_id: (type, payload_without_id)}."""
    hirc = read_bnk_sections(data).get("HIRC")
    if not hirc:
        return {}
    (count,) = struct.unpack_from("<I", hirc, 0)
    objs, pos = {}, 4
    for _ in range(count):
        otype, size, oid = struct.unpack_from("<BII", hirc, pos)
        objs[oid] = (otype, hirc[pos + 9:pos + 5 + size])
        pos += 5 + size
    return objs


SOUND, ACTION, EVENT = 2, 3, 4


def _event_actions(payload: bytes) -> list:
    n = len(payload)
    # action count is u8 / var-int in recent Wwise versions, u32 in older ones
    if n >= 1 and payload[0] * 4 + 1 == n:
        cnt, off = payload[0], 1
    else:
        (cnt,) = struct.unpack_from("<I", payload, 0)
        off = 4
    return list(struct.unpack_from(f"<{cnt}I", payload, off))


def event_sources(events_bnk: bytes, event_ids) -> dict:
    """Map each requested event id to the ordered list of wem source ids."""
    objs = read_hirc(events_bnk)
    ids = set(objs)

    def parent_of(oid):
        otype, payload = objs[oid]
        start = 14 if otype == SOUND else 0  # skip plugin/stream/source/size/bits
        for p in range(start, len(payload) - 3):
            (v,) = struct.unpack_from("<I", payload, p)
            if v != oid and v in ids and objs[v][0] not in (ACTION, EVENT):
                return v
        return None

    parents = {oid: parent_of(oid) for oid, (t, _) in objs.items() if t not in (ACTION, EVENT)}
    sound_src = {}
    for oid, (t, payload) in objs.items():
        if t == SOUND and len(payload) >= 9:
            (src,) = struct.unpack_from("<I", payload, 5)
            sound_src[oid] = src

    def ancestors(oid):
        seen = []
        while oid is not None and oid not in seen:
            seen.append(oid)
            oid = parents.get(oid)
        return seen

    sound_chain = {s: set(ancestors(s)) for s in sound_src}
    result = {}
    for eid in event_ids:
        obj = objs.get(eid)
        if not obj or obj[0] != EVENT:
            continue
        targets = set()
        for aid in _event_actions(obj[1]):
            act = objs.get(aid)
            if act and act[0] == ACTION and len(act[1]) >= 6:
                atype, target = struct.unpack_from("<HI", act[1], 0)
                if (atype >> 8) == 0x04:  # 0x04xx = Play
                    targets.add(target)
        srcs = [sound_src[s] for s, chain in sound_chain.items() if chain & targets]
        if srcs:
            result[eid] = sorted(set(srcs), key=srcs.index)
    return result
