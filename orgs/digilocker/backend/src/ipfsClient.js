'use strict';

const { withRetry } = require('./retry');

// Talks to the hospital ipfs-service (never to Kubo directly), with retries.
class IpfsClient {
  constructor({ url, key, fetchImpl, logger }) {
    this.url = url;
    this.key = key;
    this.fetch = fetchImpl || globalThis.fetch;
    this.logger = logger;
  }

  async call(path, init = {}) {
    return withRetry(async () => {
      let res;
      try {
        res = await this.fetch(`${this.url}${path}`, {
          ...init,
          headers: { 'x-ipfs-key': this.key, 'content-type': 'application/json', ...(init.headers || {}) },
          signal: AbortSignal.timeout(30_000),
        });
      } catch (err) {
        throw Object.assign(new Error(`IPFS service unreachable: ${err.message}`), { status: 503, code: 'IPFS_UNAVAILABLE', retryable: true });
      }
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json.success === false) {
        throw Object.assign(new Error(`IPFS service error (${res.status}): ${json.error || 'request failed'}`), {
          status: res.status >= 500 ? 503 : 502,
          code: res.status === 401 ? 'IPFS_UNAUTHORIZED' : 'IPFS_ERROR',
          retryable: res.status >= 500,
        });
      }
      return json;
    }, {
      retries: 3,
      onRetry: (err, attempt, delay) => this.logger?.warn('Retrying IPFS call', { path, attempt, delay, error: err.message }),
    });
  }

  async pinEnvelope(envelope, filename) {
    const json = await this.call('/pin', { method: 'POST', body: JSON.stringify({ json: envelope, filename }) });
    return json.cid;
  }

  async fetchEnvelope(cid) {
    const json = await this.call(`/fetch/${encodeURIComponent(cid)}`);
    return json.data;
  }

  async unpin(cid) {
    await this.call('/unpin', { method: 'POST', body: JSON.stringify({ cid }) }).catch(() => {});
  }

  async health() {
    try {
      const res = await this.fetch(`${this.url}/health`, { signal: AbortSignal.timeout(3000) });
      return res.ok;
    } catch (_) {
      return false;
    }
  }
}

module.exports = { IpfsClient };
