import NodeCache from "node-cache";

// In-memory cache for public content (categories, subcategories, slider, testimonials)
// Default TTL: 5 minutes, check period: 60 seconds
export const contentCache = new NodeCache({
  stdTTL: 300,
  checkperiod: 60,
  useClones: false,
});

/** Flush all cached public content — call after any admin CRUD mutation */
export function clearContentCache(): void {
  contentCache.flushAll();
}
