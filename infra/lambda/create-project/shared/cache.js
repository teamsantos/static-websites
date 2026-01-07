/**
 * In-Memory Caching Module
 *
 * Caches frequently accessed data:
 * - Templates (HTML)
 * - Language files (JSON)
 * - Image metadata
 * - Computed values
 *
 * Benefits:
 * - Reduce S3/GitHub API calls
 * - Faster subsequent requests
 * - Lower latency for repeated content
 * - Automatic cache invalidation with TTL
 *
 * Trade-off: Uses Lambda memory (limited to 10GB total)
 * Strategy: Cache only frequently used small files
 */

class Cache {
  constructor() {
    this.storage = new Map();
    this.timers = new Map();
    this.stats = {
      hits: 0,
      misses: 0,
      evictions: 0,
    };
  }

  /**
   * Get value from cache
   * @param {string} key - Cache key
   * @returns {any|null} - Cached value or null
   */
  get(key) {
    if (this.storage.has(key)) {
      this.stats.hits++;
      console.log(`[Cache] HIT: ${key}`);
      return this.storage.get(key);
    }
    this.stats.misses++;
    console.log(`[Cache] MISS: ${key}`);
    return null;
  }

  /**
   * Set value in cache with TTL
   * @param {string} key - Cache key
   * @param {any} value - Value to cache
   * @param {number} ttlSeconds - Time to live in seconds (default 3600)
   */
  set(key, value, ttlSeconds = 3600) {
    // Clear existing timer if any
    if (this.timers.has(key)) {
      clearTimeout(this.timers.get(key));
    }

    this.storage.set(key, value);

    // Set auto-expiration timer
    const timer = setTimeout(() => {
      this.delete(key);
      this.stats.evictions++;
      console.log(`[Cache] EVICTED (TTL): ${key}`);
    }, ttlSeconds * 1000);

    this.timers.set(key, timer);
    console.log(`[Cache] SET: ${key} (TTL: ${ttlSeconds}s)`);
  }

  /**
   * Check if key exists in cache
   * @param {string} key - Cache key
   * @returns {boolean}
   */
  has(key) {
    return this.storage.has(key);
  }

  /**
   * Delete value from cache
   * @param {string} key - Cache key
   */
  delete(key) {
    if (this.timers.has(key)) {
      clearTimeout(this.timers.get(key));
      this.timers.delete(key);
    }
    this.storage.delete(key);
    console.log(`[Cache] DELETE: ${key}`);
  }

  /**
   * Clear entire cache
   */
  clear() {
    for (const timer of this.timers.values()) {
      clearTimeout(timer);
    }
    this.storage.clear();
    this.timers.clear();
    console.log('[Cache] CLEARED all entries');
  }

  /**
   * Get cache statistics
   * @returns {object} - Stats including hit/miss ratio
   */
  getStats() {
    const total = this.stats.hits + this.stats.misses;
    const hitRate = total > 0 ? (this.stats.hits / total * 100).toFixed(1) : 0;
    
    return {
      ...this.stats,
      hitRate: `${hitRate}%`,
      size: this.storage.size,
      memory: `${(this.getMemoryUsage() / 1024 / 1024).toFixed(2)}MB`,
    };
  }

  /**
   * Estimate memory usage (rough approximation)
   * @returns {number} - Bytes
   */
  getMemoryUsage() {
    let total = 0;
    for (const value of this.storage.values()) {
      if (typeof value === 'string') {
        total += value.length * 2; // UTF-16 encoding
      } else if (typeof value === 'object') {
        total += JSON.stringify(value).length * 2;
      }
    }
    return total;
  }

  /**
   * Get all cache keys
   * @returns {array}
   */
  keys() {
    return Array.from(this.storage.keys());
  }
}

// Global cache instance (persists across Lambda invocations within same container)
const globalCache = new Cache();

/**
 * Cache templates from GitHub
 * Key: `template:${templateId}`
 * TTL: 1 hour (templates rarely change)
 */
export async function cacheTemplate(templateId, htmlContent) {
  const key = `template:${templateId}`;
  globalCache.set(key, htmlContent, 3600); // 1 hour TTL
}

/**
 * Get cached template
 */
export function getTemplate(templateId) {
  const key = `template:${templateId}`;
  return globalCache.get(key);
}

/**
 * Cache language file
 * Key: `lang:${templateId}:${languageCode}`
 * TTL: 1 hour
 */
export async function cacheLanguageFile(templateId, languageCode, langContent) {
  const key = `lang:${templateId}:${languageCode}`;
  globalCache.set(key, langContent, 3600);
}

/**
 * Get cached language file
 */
export function getLanguageFile(templateId, languageCode) {
  const key = `lang:${templateId}:${languageCode}`;
  return globalCache.get(key);
}

/**
 * Cache project metadata
 * Key: `metadata:${operationId}`
 * TTL: 24 hours (metadata is semi-static)
 */
export async function cacheMetadata(operationId, metadata) {
  const key = `metadata:${operationId}`;
  globalCache.set(key, metadata, 86400); // 24 hours TTL
}

/**
 * Get cached metadata
 */
export function getMetadata(operationId) {
  const key = `metadata:${operationId}`;
  return globalCache.get(key);
}

/**
 * Cache computed image variants
 * Key: `image-variants:${imageName}`
 * TTL: 24 hours
 */
export async function cacheImageVariants(imageName, variants) {
  const key = `image-variants:${imageName}`;
  globalCache.set(key, variants, 86400);
}

/**
 * Get cached image variants
 */
export function getImageVariants(imageName) {
  const key = `image-variants:${imageName}`;
  return globalCache.get(key);
}

/**
 * Get global cache statistics
 */
export function getCacheStats() {
  return globalCache.getStats();
}

/**
 * Clear cache (for testing or manual reset)
 */
export function clearCache() {
  globalCache.clear();
}

/**
 * Get all cached keys for monitoring
 */
export function getCachedKeys() {
  return globalCache.keys();
}

/**
 * Cache warming function
 * Pre-load frequently used templates on Lambda startup
 * Call this during Lambda initialization if needed
 */
export async function warmCache(octokit, templateIds) {
  console.log(`[Cache] Warming cache with ${templateIds.length} templates...`);
  
  for (const templateId of templateIds) {
    try {
      // Skip if already cached
      if (getTemplate(templateId)) {
        console.log(`[Cache] Template ${templateId} already cached`);
        continue;
      }

      // Fetch from GitHub (would need to be called by the handler)
      console.log(`[Cache] Preload template ${templateId}`);
    } catch (error) {
      console.error(`[Cache] Failed to warm cache for ${templateId}:`, error);
    }
  }
}

export default globalCache;
