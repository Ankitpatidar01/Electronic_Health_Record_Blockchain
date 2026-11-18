'use strict';

const { classify, safeId } = require('./docTypes');
const { withRetry } = require('../retry');

// ─────────────────────────────────────────────────────────────────────────────
// Live DigiLocker provider (API Setu / MeriPehchaan OAuth 2.0 with PKCE).
//
// Requires a client id/secret issued to a registered DigiLocker partner and a
// redirect URI registered with DigiLocker that matches
//   <DIGILOCKER_PUBLIC_URL>/link/callback
// Every endpoint is configurable through the environment because DigiLocker
// versions its paths.
// ─────────────────────────────────────────────────────────────────────────────

class LiveProvider {
  constructor({ publicUrl, live, fetchImpl }) {
    this.mode = 'live';
    this.cfg = live;
    this.redirectUri = `${publicUrl}/link/callback`;
    this.fetch = fetchImpl || globalThis.fetch;
  }

  authorizeUrl({ state, codeChallenge }) {
    const url = new URL(this.cfg.authorizeUrl);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('client_id', this.cfg.clientId);
    url.searchParams.set('redirect_uri', this.redirectUri);
    url.searchParams.set('state', state);
    url.searchParams.set('code_challenge', codeChallenge);
    url.searchParams.set('code_challenge_method', 'S256');
    return url.toString();
  }

  async request(url, init, { binary = false } = {}) {
    return withRetry(async () => {
      const res = await this.fetch(url, { ...init, signal: AbortSignal.timeout(20_000) });
      if (res.status === 401) {
        throw Object.assign(new Error('DigiLocker session expired. Link again.'), { status: 401, code: 'RELINK_REQUIRED', retryable: false });
      }
      if (!res.ok) {
        const detail = (await res.text().catch(() => '')).slice(0, 200);
        throw Object.assign(new Error(`DigiLocker responded ${res.status}${detail ? `: ${detail}` : ''}`), {
          status: res.status >= 500 ? 502 : res.status, retryable: res.status >= 500,
        });
      }
      if (binary) return { buffer: Buffer.from(await res.arrayBuffer()), mime: (res.headers.get('content-type') || 'application/octet-stream').split(';')[0] };
      return res.json();
    }, { retries: 2 });
  }

  async token(params) {
    const body = new URLSearchParams({ client_id: this.cfg.clientId, client_secret: this.cfg.clientSecret, ...params });
    const json = await this.request(this.cfg.tokenUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json' },
      body,
    });
    if (!json.access_token) throw Object.assign(new Error('DigiLocker did not return an access token'), { status: 502, retryable: false });
    return json;
  }

  async exchangeCode({ code, codeVerifier }) {
    const json = await this.token({ grant_type: 'authorization_code', code, redirect_uri: this.redirectUri, code_verifier: codeVerifier });
    const id = String(json.digilockerid || '');
    return {
      tokens: {
        accessToken:  json.access_token,
        refreshToken: json.refresh_token || null,
        expiresAt:    Date.now() + Number(json.expires_in || 3600) * 1000,
      },
      // Only a masked reference is kept; name, DOB and gender returned by
      // DigiLocker are deliberately discarded.
      account: { label: 'DigiLocker account', maskedId: id ? `****${id.slice(-4)}` : 'linked' },
    };
  }

  async refresh(tokens) {
    if (tokens.expiresAt - Date.now() > 60_000) return tokens;
    if (!tokens.refreshToken) {
      throw Object.assign(new Error('DigiLocker session expired. Link again.'), { status: 401, code: 'RELINK_REQUIRED', retryable: false });
    }
    const json = await this.token({ grant_type: 'refresh_token', refresh_token: tokens.refreshToken });
    return {
      accessToken:  json.access_token,
      refreshToken: json.refresh_token || tokens.refreshToken,
      expiresAt:    Date.now() + Number(json.expires_in || 3600) * 1000,
    };
  }

  async listIssued(tokens) {
    const json = await this.request(this.cfg.issuedFilesUrl, {
      headers: { authorization: `Bearer ${tokens.accessToken}`, accept: 'application/json' },
    });
    return (Array.isArray(json.items) ? json.items : []).filter(item => item && item.uri).map(item => ({
      uri:      String(item.uri),
      name:     String(item.name || item.description || item.doctype || 'Document'),
      docType:  classify(item.doctype, item.description, item.name),
      issuerId: safeId(item.issuerid, 'digilocker'),
      issuer:   String(item.issuer || item.issuerid || 'DigiLocker issuer'),
      issuedAt: this.normaliseDate(item.date),
      mime:     Array.isArray(item.mime) ? String(item.mime[0] || '') : String(item.mime || ''),
      size:     Number(item.size) || null,
    }));
  }

  normaliseDate(value) {
    if (!value) return '';
    const dmy = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(String(value));
    const parsed = dmy ? Date.parse(`${dmy[3]}-${dmy[2]}-${dmy[1]}T00:00:00Z`) : Date.parse(String(value));
    return Number.isFinite(parsed) ? new Date(parsed).toISOString().slice(0, 10) : '';
  }

  async fetchFile(tokens, uri) {
    const listed = (await this.listIssued(tokens)).find(item => item.uri === uri);
    if (!listed) throw Object.assign(new Error('Document not found in this DigiLocker account'), { status: 404, retryable: false });
    const file = await this.request(`${this.cfg.fileUrl.replace(/\/$/, '')}/${encodeURIComponent(uri)}`, {
      headers: { authorization: `Bearer ${tokens.accessToken}` },
    }, { binary: true });
    return { ...file, name: listed.name, docType: listed.docType, issuerId: listed.issuerId, issuer: listed.issuer, issuedAt: listed.issuedAt };
  }

  async revoke(tokens) {
    if (!this.cfg.revokeUrl || !tokens?.accessToken) return;
    const body = new URLSearchParams({ token: tokens.accessToken, token_type_hint: 'access_token' });
    const basic = Buffer.from(`${this.cfg.clientId}:${this.cfg.clientSecret}`).toString('base64');
    await this.fetch(this.cfg.revokeUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded', authorization: `Basic ${basic}` },
      body,
      signal: AbortSignal.timeout(10_000),
    }).catch(() => {});
  }
}

module.exports = { LiveProvider };
