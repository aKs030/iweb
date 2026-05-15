/**
 * Small in-memory cache with TTL and LRU eviction.
 */

import { createLogger } from "./logger.js";

const log = createLogger("Cache");

class CacheManager {
	constructor(options = {}) {
		this.items = new Map();
		// Default: 50 items for DOM cache, configurable for other use cases
		this.maxSize = options.memorySize ?? 50;
	}

	get(key) {
		const item = this.items.get(key);

		if (!item) {
			log.debug(`Cache miss: ${key}`);
			return null;
		}

		if (item.expires && item.expires < Date.now()) {
			this.items.delete(key);
			log.debug(`Cache expired: ${key}`);
			return null;
		}

		this.items.delete(key);
		this.items.set(key, item);
		log.debug(`Cache hit: ${key}`);
		return item.value;
	}

	set(key, value, options = {}) {
		const ttl = options.ttl ?? 300000;

		if (this.items.has(key)) {
			this.items.delete(key);
		} else if (this.items.size >= this.maxSize) {
			const oldestKey = this.items.keys().next().value;
			this.items.delete(oldestKey);
		}

		this.items.set(key, {
			value,
			expires: ttl ? Date.now() + ttl : null,
		});
	}

	delete(key) {
		return this.items.delete(key);
	}

	clear() {
		this.items.clear();
		log.info("Cache cleared");
	}

	getStats() {
		return {
			memorySize: this.items.size,
			memoryMaxSize: this.maxSize,
		};
	}

	async has(key) {
		return this.get(key) !== null;
	}
}

let globalCache = null;

export function getCache(options) {
	if (!globalCache) {
		globalCache = new CacheManager(options);
	}
	return globalCache;
}
