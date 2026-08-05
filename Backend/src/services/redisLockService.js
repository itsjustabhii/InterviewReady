/**
 * RedisLockService
 * ─────────────────────────────────────────────────────────────────────────────
 * A Redlock-style distributed lock built on top of the existing ioredis client.
 *
 * Safety contract:
 *   • SET NX PX  — acquired atomically; expires automatically if the holder
 *                  crashes or the payment flow stalls.
 *   • Lua release — releases ONLY if the caller still owns the lock (value
 *                   matches).  Prevents a late release from evicting a lock
 *                   that was already re-acquired by another request.
 *   • Retry with jitter — backs off exponentially so concurrent requests don't
 *                         all hammer Redis at the same instant.
 *
 * Key schema (all keys carry the global keyPrefix from config/redis):
 *   slot:lock:<slotId>         — held while a user is holding a slot reservation
 *   slot:hold:<slotId>         — holds reservation metadata during payment window
 *
 * Usage:
 *   const lock = await lockService.acquireLock(`slot:${slotId}`, userId, 600);
 *   try { ... } finally { await lockService.releaseLock(lock); }
 */

const { v4: uuidv4 } = require('uuid');
const redisClient = require('../config/redis');
const logger = require('../utils/logger');

// ─── Constants ────────────────────────────────────────────────────────────────
const LOCK_PREFIX = 'slot:lock:';
const HOLD_PREFIX = 'slot:hold:';

/** Retry defaults */
const DEFAULT_RETRY_COUNT = 5;
const DEFAULT_RETRY_DELAY_MS = 150; // base delay
const DEFAULT_RETRY_JITTER_MS = 50; // added random jitter

/**
 * Atomic Lua script: release lock only if value matches.
 *
 * Returns 1 if released, 0 if the lock was already taken by someone else
 * (expired and re-acquired between our check and delete).
 */
const RELEASE_LUA_SCRIPT = `
  if redis.call("get", KEYS[1]) == ARGV[1] then
    return redis.call("del", KEYS[1])
  else
    return 0
  end
`;

class RedisLockService {
  /**
   * Acquire a distributed lock on a slot.
   *
   * @param {string}  resource   - Logical resource name (e.g. slotId string)
   * @param {string}  ownerId    - Unique owner identifier (userId or requestId)
   * @param {number}  ttlSeconds - Lock TTL in seconds (default 600 = 10 min payment window)
   * @param {object}  opts       - { retryCount, retryDelayMs, retryJitterMs }
   * @returns {{ lockKey, token, ttl } | null}  null if lock could not be acquired
   */
  async acquireLock(resource, ownerId, ttlSeconds = 600, opts = {}) {
    const {
      retryCount = DEFAULT_RETRY_COUNT,
      retryDelayMs = DEFAULT_RETRY_DELAY_MS,
      retryJitterMs = DEFAULT_RETRY_JITTER_MS,
    } = opts;

    const lockKey = `${LOCK_PREFIX}${resource}`;
    // Unique token per acquisition attempt — used as the lock value so that
    // only the original acquirer can release it.
    const token = `${ownerId}:${uuidv4()}`;
    const client = redisClient.getClient();

    for (let attempt = 0; attempt <= retryCount; attempt++) {
      // SET <key> <token> NX PX <ttlMs>
      const result = await client.set(lockKey, token, 'NX', 'PX', ttlSeconds * 1000);

      if (result === 'OK') {
        logger.debug(`[Lock] Acquired lock on "${resource}" (attempt ${attempt + 1})`);
        return { lockKey, token, ttlSeconds };
      }

      if (attempt < retryCount) {
        const jitter = Math.floor(Math.random() * retryJitterMs);
        const delay = retryDelayMs * (attempt + 1) + jitter;
        logger.debug(`[Lock] "${resource}" busy, retrying in ${delay}ms (attempt ${attempt + 1}/${retryCount})`);
        await this._sleep(delay);
      }
    }

    logger.warn(`[Lock] Failed to acquire lock on "${resource}" after ${retryCount + 1} attempts`);
    return null;
  }

  /**
   * Release a previously acquired lock atomically via Lua.
   *
   * @param {{ lockKey, token }} lock - Object returned by acquireLock
   * @returns {boolean} true if released, false if the lock had already expired/changed
   */
  async releaseLock(lock) {
    if (!lock || !lock.lockKey || !lock.token) return false;

    try {
      const client = redisClient.getClient();
      const result = await client.eval(RELEASE_LUA_SCRIPT, 1, lock.lockKey, lock.token);

      if (result === 1) {
        logger.debug(`[Lock] Released lock "${lock.lockKey}"`);
        return true;
      }

      logger.warn(`[Lock] Lock "${lock.lockKey}" was already released or expired`);
      return false;
    } catch (error) {
      logger.error(`[Lock] Error releasing lock "${lock.lockKey}":`, error);
      return false;
    }
  }

  /**
   * Extend the TTL of a lock the caller already holds.
   *
   * Useful if a payment flow is taking longer than expected but we can
   * verify the token still matches (we don't want to extend foreign locks).
   *
   * @param {{ lockKey, token }} lock
   * @param {number} extraSeconds
   * @returns {boolean}
   */
  async extendLock(lock, extraSeconds) {
    if (!lock?.lockKey || !lock?.token) return false;

    const EXTEND_LUA = `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("pexpire", KEYS[1], ARGV[2])
      else
        return 0
      end
    `;

    try {
      const client = redisClient.getClient();
      const result = await client.eval(EXTEND_LUA, 1, lock.lockKey, lock.token, extraSeconds * 1000);
      return result === 1;
    } catch (error) {
      logger.error(`[Lock] Error extending lock "${lock.lockKey}":`, error);
      return false;
    }
  }

  /**
   * Check whether a lock is currently held (by anyone).
   * @param {string} resource
   * @returns {boolean}
   */
  async isLocked(resource) {
    const client = redisClient.getClient();
    const val = await client.get(`${LOCK_PREFIX}${resource}`);
    return val !== null;
  }

  /**
   * Check whether a specific owner still holds the lock.
   * @param {string} resource
   * @param {string} token  - token returned from acquireLock
   * @returns {boolean}
   */
  async isOwner(resource, token) {
    const client = redisClient.getClient();
    const val = await client.get(`${LOCK_PREFIX}${resource}`);
    return val === token;
  }

  // ─── Hold (soft reservation) helpers ────────────────────────────────────────

  /**
   * Persist hold metadata in Redis so the payment step can confirm the
   * reservation without re-reading MongoDB.
   *
   * @param {string} slotId
   * @param {object} holdData  - { userId, bookingId, amount, expiresAt, lockToken }
   * @param {number} ttlSeconds
   */
  async setHold(slotId, holdData, ttlSeconds = 600) {
    const key = `${HOLD_PREFIX}${slotId}`;
    const client = redisClient.getClient();
    await client.setex(key, ttlSeconds, JSON.stringify(holdData));
    logger.debug(`[Hold] Set hold on slot "${slotId}" for user ${holdData.userId}`);
  }

  /**
   * Retrieve hold metadata.
   * @param {string} slotId
   * @returns {object|null}
   */
  async getHold(slotId) {
    const key = `${HOLD_PREFIX}${slotId}`;
    const client = redisClient.getClient();
    const raw = await client.get(key);
    return raw ? JSON.parse(raw) : null;
  }

  /**
   * Delete the hold record (called on confirm or explicit release).
   * @param {string} slotId
   */
  async clearHold(slotId) {
    const key = `${HOLD_PREFIX}${slotId}`;
    const client = redisClient.getClient();
    await client.del(key);
    logger.debug(`[Hold] Cleared hold on slot "${slotId}"`);
  }

  /**
   * Return the TTL (seconds) remaining on a hold, or 0 if expired/missing.
   * @param {string} slotId
   * @returns {number}
   */
  async getHoldTtl(slotId) {
    const key = `${HOLD_PREFIX}${slotId}`;
    const client = redisClient.getClient();
    const ttl = await client.ttl(key);
    return ttl > 0 ? ttl : 0;
  }

  // ─── Utility ─────────────────────────────────────────────────────────────────
  _sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

module.exports = new RedisLockService();

// Made with Bob
