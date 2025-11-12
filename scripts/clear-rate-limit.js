/**
 * Script to clear rate limits from Redis
 * 
 * Usage:
 *   node scripts/clear-rate-limit.js [type] [key]
 * 
 * Examples:
 *   node scripts/clear-rate-limit.js login ::1:alice@example.com
 *   node scripts/clear-rate-limit.js login all  (clears all login rate limits)
 */

const Redis = require('ioredis');

// Get Redis connection from environment
const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
const redis = new Redis(redisUrl);

async function clearRateLimit(type, key) {
  try {
    if (key === 'all') {
      // Clear all rate limits for the given type
      // Try multiple patterns as rate-limiter-flexible might use different formats
      const patterns = [
        `rate_limit:${type}:*`,
        `rlflx:rate_limit:${type}:*`,
        `rlflx:${type}:*`,
        `${type}:*`,
      ];
      
      let totalDeleted = 0;
      for (const pattern of patterns) {
        const keys = await redis.keys(pattern);
        if (keys.length > 0) {
          console.log(`Found ${keys.length} keys matching pattern: ${pattern}`);
          for (const k of keys) {
            await redis.del(k);
            console.log(`  Deleted: ${k}`);
            totalDeleted++;
          }
        }
      }
      
      if (totalDeleted === 0) {
        console.log(`No rate limit keys found for type: ${type}`);
        console.log(`Tried patterns: ${patterns.join(', ')}`);
      } else {
        console.log(`✅ Cleared ${totalDeleted} rate limit key(s) for type: ${type}`);
      }
    } else {
      // Clear specific key
      const fullKey = `rate_limit:${type}:${key}`;
      const deleted = await redis.del(fullKey);
      
      if (deleted > 0) {
        console.log(`✅ Cleared rate limit: ${fullKey}`);
      } else {
        console.log(`❌ Rate limit key not found: ${fullKey}`);
        console.log(`   Trying alternative key formats...`);
        
        // Try alternative key formats
        const alternatives = [
          `rate_limit:${type}:${key}`,
          `rlflx:rate_limit:${type}:${key}`,
          `${type}:${key}`,
        ];
        
        for (const altKey of alternatives) {
          const deleted = await redis.del(altKey);
          if (deleted > 0) {
            console.log(`✅ Cleared rate limit: ${altKey}`);
            return;
          }
        }
        
        console.log(`❌ Could not find rate limit key. It may have already expired.`);
      }
    }
  } catch (error) {
    console.error('Error clearing rate limit:', error.message);
    process.exit(1);
  } finally {
    await redis.quit();
  }
}

// Parse command line arguments
const type = process.argv[2] || 'login';
const key = process.argv[3] || 'all';

if (!type) {
  console.error('Usage: node scripts/clear-rate-limit.js [type] [key]');
  console.error('Example: node scripts/clear-rate-limit.js login ::1:alice@example.com');
  process.exit(1);
}

console.log(`Clearing rate limit for type: ${type}, key: ${key}`);
clearRateLimit(type, key);

