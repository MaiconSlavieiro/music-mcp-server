interface Attempt {
  count: number;
  blockedUntil: number;
  lastAttempt: number;
}

const attempts = new Map<string, Attempt>();

const MAX_ATTEMPTS = 5;
const BLOCK_DURATION_MS = 15 * 60 * 1000; // 15 minutes
const STALE_AFTER_MS = 30 * 60 * 1000; // cleanup entries older than 30 min

// Cleanup stale entries every 10 minutes. Use unref() so the timer
// doesn't prevent the process from exiting gracefully.
const cleanupTimer = setInterval(() => {
  const now = Date.now();
  for (const [ip, attempt] of attempts) {
    if (now - attempt.lastAttempt > STALE_AFTER_MS && attempt.blockedUntil <= now) {
      attempts.delete(ip);
    }
  }
}, 10 * 60 * 1000);
cleanupTimer.unref();

export function isBlocked(ip: string): boolean {
  const attempt = attempts.get(ip);
  if (!attempt) return false;
  if (attempt.blockedUntil > Date.now()) return true;
  // Block expired, reset
  if (attempt.blockedUntil > 0) {
    attempt.count = 0;
    attempt.blockedUntil = 0;
  }
  return false;
}

export function recordFailure(ip: string): void {
  const attempt = attempts.get(ip) || { count: 0, blockedUntil: 0, lastAttempt: 0 };
  attempt.count++;
  attempt.lastAttempt = Date.now();
  if (attempt.count >= MAX_ATTEMPTS) {
    attempt.blockedUntil = Date.now() + BLOCK_DURATION_MS;
    attempt.count = 0;
  }
  attempts.set(ip, attempt);
}

export function resetAttempts(ip: string): void {
  attempts.delete(ip);
}
