/**
 * Unit Tests for LRU Cache Implementation
 *
 * Tests cover:
 * - Basic get/put operations
 * - Capacity limits and eviction (LRU behavior)
 * - Edge cases (empty cache, single item, etc.)
 * - Cache invalidation (delete, clear)
 */

import { LRUCache } from './lru';

describe('LRUCache', () => {
  describe('Basic Operations', () => {
    it('should create a cache with specified capacity', () => {
      const cache = new LRUCache<number>(5);
      expect(cache.getSize()).toBe(0);
    });

    it('should throw error if capacity is less than 1', () => {
      expect(() => new LRUCache<number>(0)).toThrow();
      expect(() => new LRUCache<number>(-1)).toThrow();
    });

    it('should store and retrieve values', () => {
      const cache = new LRUCache<string>(3);
      cache.put('key1', 'value1');
      cache.put('key2', 'value2');

      expect(cache.get('key1')).toBe('value1');
      expect(cache.get('key2')).toBe('value2');
    });

    it('should return undefined for non-existent keys', () => {
      const cache = new LRUCache<string>(3);
      expect(cache.get('nonexistent')).toBeUndefined();
    });

    it('should update existing keys', () => {
      const cache = new LRUCache<string>(3);
      cache.put('key1', 'value1');
      cache.put('key1', 'value2');

      expect(cache.get('key1')).toBe('value2');
      expect(cache.getSize()).toBe(1);
    });
  });

  describe('LRU Eviction', () => {
    it('should evict least recently used item when capacity is exceeded', () => {
      const cache = new LRUCache<number>(2);

      cache.put('key1', 1);
      cache.put('key2', 2);
      cache.put('key3', 3); // Should evict key1

      expect(cache.get('key1')).toBeUndefined(); // Evicted
      expect(cache.get('key2')).toBe(2);
      expect(cache.get('key3')).toBe(3);
    });

    it('should move accessed item to head (mark as recently used)', () => {
      const cache = new LRUCache<number>(3);

      cache.put('key1', 1);
      cache.put('key2', 2);
      cache.put('key3', 3);

      // Access key1 to mark it as recently used
      cache.get('key1');

      // Add new item - should evict key2 (not key1)
      cache.put('key4', 4);

      expect(cache.get('key1')).toBe(1); // Still in cache
      expect(cache.get('key2')).toBeUndefined(); // Evicted
      expect(cache.get('key3')).toBe(3);
      expect(cache.get('key4')).toBe(4);
    });

    it('should handle capacity of 1', () => {
      const cache = new LRUCache<string>(1);

      cache.put('key1', 'value1');
      expect(cache.get('key1')).toBe('value1');

      cache.put('key2', 'value2');
      expect(cache.get('key1')).toBeUndefined(); // Evicted
      expect(cache.get('key2')).toBe('value2');
    });
  });

  describe('Delete Operations', () => {
    it('should delete a key from cache', () => {
      const cache = new LRUCache<string>(3);
      cache.put('key1', 'value1');
      cache.put('key2', 'value2');

      const deleted = cache.delete('key1');
      expect(deleted).toBe(true);
      expect(cache.get('key1')).toBeUndefined();
      expect(cache.getSize()).toBe(1);
    });

    it('should return false when deleting non-existent key', () => {
      const cache = new LRUCache<string>(3);
      expect(cache.delete('nonexistent')).toBe(false);
    });

    it('should clear all entries', () => {
      const cache = new LRUCache<number>(3);
      cache.put('key1', 1);
      cache.put('key2', 2);

      cache.clear();

      expect(cache.getSize()).toBe(0);
      expect(cache.get('key1')).toBeUndefined();
      expect(cache.get('key2')).toBeUndefined();
    });
  });

  describe('Utility Methods', () => {
    it('should return correct size', () => {
      const cache = new LRUCache<number>(5);
      expect(cache.getSize()).toBe(0);

      cache.put('key1', 1);
      cache.put('key2', 2);
      expect(cache.getSize()).toBe(2);
    });

    it('should check if key exists', () => {
      const cache = new LRUCache<string>(3);
      cache.put('key1', 'value1');

      expect(cache.has('key1')).toBe(true);
      expect(cache.has('key2')).toBe(false);
    });

    it('should return all keys', () => {
      const cache = new LRUCache<number>(3);
      cache.put('key1', 1);
      cache.put('key2', 2);
      cache.put('key3', 3);

      const keys = cache.keys();
      expect(keys).toHaveLength(3);
      expect(keys).toContain('key1');
      expect(keys).toContain('key2');
      expect(keys).toContain('key3');
    });
  });

  describe('Complex Scenarios', () => {
    it('should handle mixed operations correctly', () => {
      const cache = new LRUCache<number>(3);

      cache.put('a', 1);
      cache.put('b', 2);
      cache.put('c', 3);

      cache.get('a'); // Access a to mark as recently used

      cache.put('d', 4); // Should evict 'b' (least recently used)

      expect(cache.get('a')).toBe(1); // Still in cache
      expect(cache.get('b')).toBeUndefined(); // Evicted
      expect(cache.get('c')).toBe(3);
      expect(cache.get('d')).toBe(4);

      cache.delete('c');
      expect(cache.get('c')).toBeUndefined();

      cache.put('e', 5);
      expect(cache.get('e')).toBe(5);
      expect(cache.getSize()).toBe(3); // a, d, e
    });

    it('should handle object values', () => {
      interface TestObject {
        id: number;
        name: string;
      }

      const cache = new LRUCache<TestObject>(2);
      const obj1: TestObject = { id: 1, name: 'Object 1' };
      const obj2: TestObject = { id: 2, name: 'Object 2' };

      cache.put('obj1', obj1);
      cache.put('obj2', obj2);

      const retrieved = cache.get('obj1');
      expect(retrieved).toEqual(obj1);
      expect(retrieved?.name).toBe('Object 1');
    });
  });
});

