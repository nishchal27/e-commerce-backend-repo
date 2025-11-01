/**
 * LRU (Least Recently Used) Cache Implementation
 *
 * This is a classic data structure problem that combines a HashMap and a Doubly Linked List
 * to achieve O(1) time complexity for both get and put operations.
 *
 * Data Structure Design:
 * - HashMap (Map): Stores key -> node mappings for O(1) lookups
 * - Doubly Linked List: Maintains access order (most recent at head, least recent at tail)
 *
 * Algorithm:
 * - GET: Look up node in map, move to head (mark as recently used), return value
 * - PUT: If key exists, update value and move to head. If full, remove tail node, add new node at head
 *
 * Use Case:
 * - Product detail caching to avoid repeated database queries
 * - Can be used in-memory for development or replaced with Redis for production
 */

/**
 * Node for doubly linked list that stores key-value pairs
 */
class LRUNode<T> {
  key: string;
  value: T;
  prev: LRUNode<T> | null = null;
  next: LRUNode<T> | null = null;

  constructor(key: string, value: T) {
    this.key = key;
    this.value = value;
  }
}

/**
 * LRU Cache implementation with O(1) get and put operations.
 *
 * @template T - The type of values stored in the cache
 */
export class LRUCache<T> {
  // Capacity of the cache (maximum number of items)
  private readonly capacity: number;

  // HashMap for O(1) key lookups
  private readonly cache: Map<string, LRUNode<T>>;

  // Head of doubly linked list (most recently used)
  private head: LRUNode<T> | null = null;

  // Tail of doubly linked list (least recently used)
  private tail: LRUNode<T> | null = null;

  // Current number of items in cache
  private size: number = 0;

  /**
   * Creates a new LRU Cache instance.
   *
   * @param capacity - Maximum number of items the cache can hold
   * @throws Error if capacity is less than 1
   */
  constructor(capacity: number) {
    if (capacity < 1) {
      throw new Error('LRU Cache capacity must be at least 1');
    }
    this.capacity = capacity;
    this.cache = new Map<string, LRUNode<T>>();
  }

  /**
   * Get a value from the cache by key.
   * Moves the accessed node to the head (marks as recently used).
   *
   * Time Complexity: O(1)
   *
   * @param key - The key to look up
   * @returns The value if found, undefined otherwise
   */
  get(key: string): T | undefined {
    const node = this.cache.get(key);

    // Key not found
    if (!node) {
      return undefined;
    }

    // Move accessed node to head (mark as recently used)
    this.moveToHead(node);

    return node.value;
  }

  /**
   * Put a key-value pair into the cache.
   * If key exists, updates value and moves to head.
   * If cache is full, removes least recently used item (tail).
   *
   * Time Complexity: O(1)
   *
   * @param key - The key to store
   * @param value - The value to store
   */
  put(key: string, value: T): void {
    const existingNode = this.cache.get(key);

    if (existingNode) {
      // Key exists: update value and move to head
      existingNode.value = value;
      this.moveToHead(existingNode);
      return;
    }

    // Key doesn't exist: create new node
    const newNode = new LRUNode(key, value);

    if (this.size < this.capacity) {
      // Cache has room: add new node
      this.addNode(newNode);
      this.size++;
    } else {
      // Cache is full: remove tail (LRU) and add new node
      this.removeTail();
      this.addNode(newNode);
    }

    // Add to cache map
    this.cache.set(key, newNode);
  }

  /**
   * Delete a key from the cache.
   *
   * Time Complexity: O(1)
   *
   * @param key - The key to delete
   * @returns true if key was deleted, false if key didn't exist
   */
  delete(key: string): boolean {
    const node = this.cache.get(key);

    if (!node) {
      return false;
    }

    // Remove from linked list
    this.removeNode(node);

    // Remove from cache map
    this.cache.delete(key);
    this.size--;

    return true;
  }

  /**
   * Clear all entries from the cache.
   */
  clear(): void {
    this.cache.clear();
    this.head = null;
    this.tail = null;
    this.size = 0;
  }

  /**
   * Get the current number of items in the cache.
   */
  getSize(): number {
    return this.size;
  }

  /**
   * Check if the cache has a key.
   *
   * @param key - The key to check
   * @returns true if key exists, false otherwise
   */
  has(key: string): boolean {
    return this.cache.has(key);
  }

  /**
   * Get all keys currently in the cache.
   *
   * @returns Array of all keys
   */
  keys(): string[] {
    return Array.from(this.cache.keys());
  }

  /**
   * Add a new node to the head of the linked list.
   * This marks it as the most recently used item.
   *
   * @param node - The node to add
   */
  private addNode(node: LRUNode<T>): void {
    // Set node's next to current head
    node.next = this.head;
    node.prev = null;

    // Update previous head's prev pointer if head exists
    if (this.head) {
      this.head.prev = node;
    }

    // Update head to new node
    this.head = node;

    // If this is the first node, it's also the tail
    if (!this.tail) {
      this.tail = node;
    }
  }

  /**
   * Remove a node from the linked list.
   * Used when deleting or when moving a node to head.
   *
   * @param node - The node to remove
   */
  private removeNode(node: LRUNode<T>): void {
    // Update previous node's next pointer
    if (node.prev) {
      node.prev.next = node.next;
    } else {
      // Node is head: update head pointer
      this.head = node.next;
    }

    // Update next node's prev pointer
    if (node.next) {
      node.next.prev = node.prev;
    } else {
      // Node is tail: update tail pointer
      this.tail = node.prev;
    }

    // Clear node's pointers
    node.prev = null;
    node.next = null;
  }

  /**
   * Move a node to the head of the linked list.
   * This is called when a node is accessed (get operation).
   *
   * @param node - The node to move to head
   */
  private moveToHead(node: LRUNode<T>): void {
    // If already at head, no-op
    if (node === this.head) {
      return;
    }

    // Remove node from current position
    this.removeNode(node);

    // Add to head (most recently used)
    this.addNode(node);
  }

  /**
   * Remove the tail node (least recently used item).
   * Called when cache is full and a new item needs to be added.
   */
  private removeTail(): void {
    if (!this.tail) {
      return;
    }

    const tailKey = this.tail.key;

    // Remove from linked list
    this.removeNode(this.tail);

    // Remove from cache map
    this.cache.delete(tailKey);
    this.size--;
  }
}

