'use strict';

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Errors worth another attempt: network blips, 5xx from a dependency, a peer
// that is briefly unavailable, or an MVCC read conflict on commit.
function isTransient(err) {
  if (!err) return false;
  if (err.retryable === true) return true;
  if (err.retryable === false) return false;
  const code = String(err.code ?? '');
  if (['ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT', 'EAI_AGAIN', 'ENOTFOUND', 'UND_ERR_CONNECT_TIMEOUT', 'UND_ERR_SOCKET'].includes(code)) return true;
  if (code === '14' || code === '4') return true; // gRPC UNAVAILABLE / DEADLINE_EXCEEDED
  if (typeof err.status === 'number' && err.status >= 500) return true;
  const message = String(err.message || '');
  return /UNAVAILABLE|DEADLINE_EXCEEDED|MVCC_READ_CONFLICT|fetch failed|timed out|aborted/i.test(message);
}

async function withRetry(operation, options = {}) {
  const retries   = options.retries ?? 3;
  const baseMs    = options.baseMs ?? 250;
  const maxMs     = options.maxMs ?? 4000;
  const retryable = options.retryable ?? isTransient;
  let attempt = 0;
  for (;;) {
    try {
      return await operation(attempt);
    } catch (err) {
      if (attempt >= retries || !retryable(err)) {
        err.attempts = attempt + 1;
        throw err;
      }
      const delay = Math.min(maxMs, baseMs * 2 ** attempt);
      options.onRetry?.(err, attempt + 1, delay);
      await sleep(options.sleep === false ? 0 : delay);
      attempt += 1;
    }
  }
}

module.exports = { withRetry, isTransient, sleep };
