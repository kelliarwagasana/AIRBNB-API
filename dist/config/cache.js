const cache = new Map();
export function getCache(key) {
    const entry = cache.get(key);
    if (!entry) {
        return null;
    }
    if (Date.now() > entry.expiresAt) {
        cache.delete(key);
        return null;
    }
    return entry.data;
}
export function setCache(key, data, ttlSeconds) {
    cache.set(key, {
        data,
        expiresAt: Date.now() + ttlSeconds * 1000,
    });
}
export function deleteCache(key) {
    cache.delete(key);
}
export function clearCacheByPrefix(prefix) {
    for (const key of cache.keys()) {
        if (key.startsWith(prefix)) {
            cache.delete(key);
        }
    }
}
