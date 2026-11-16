"""Short-lived in-process cache for public catalog reads that change rarely.

Only data that is identical for every visitor and tolerates a short delay is
cached (categories, brands, colors, filter facets). Prices on product pages,
stock availability, purchase states, carts and orders are never cached here.
Set CATALOG_CACHE_SECONDS=0 to disable; each process keeps its own copy.
"""
from collections import OrderedDict
from copy import deepcopy
from threading import Lock
import os
import time

MAX_ENTRIES = 256
_entries: OrderedDict = OrderedDict()
_lock = Lock()


def ttl_seconds(default: float) -> float:
    raw = os.getenv("CATALOG_CACHE_SECONDS")
    if raw is None or not raw.strip():
        return default
    try:
        return max(0.0, float(raw))
    except ValueError:
        return default


def cached(key, ttl: float, compute):
    """Return a private copy of the cached value, computing it when missing or expired."""
    if ttl <= 0:
        return compute()
    now = time.monotonic()
    with _lock:
        entry = _entries.get(key)
        if entry is not None and entry[0] > now:
            _entries.move_to_end(key)
            return deepcopy(entry[1])
    value = compute()  # Outside the lock: a slow database read must not block other keys.
    with _lock:
        _entries[key] = (time.monotonic() + ttl, deepcopy(value))
        _entries.move_to_end(key)
        while len(_entries) > MAX_ENTRIES:
            _entries.popitem(last=False)
    return value


def clear() -> None:
    with _lock:
        _entries.clear()
