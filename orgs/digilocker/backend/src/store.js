'use strict';

const fs   = require('fs');
const path = require('path');

// Small JSON file store for link records and document display metadata.
// The ledger is the source of truth for anchors; this only holds what must not
// go on-chain (sealed OAuth tokens, file names, mime types).
class JsonStore {
  constructor(dir) {
    this.file = path.join(dir, 'digilocker-store.json');
    fs.mkdirSync(dir, { recursive: true });
    this.state = { links: {}, pending: {}, documents: {} };
    if (fs.existsSync(this.file)) {
      try {
        this.state = { ...this.state, ...JSON.parse(fs.readFileSync(this.file, 'utf8')) };
      } catch (err) {
        const backup = `${this.file}.corrupt-${Date.now()}`;
        fs.copyFileSync(this.file, backup);
        throw new Error(`digilocker store is unreadable (${err.message}); a copy was kept at ${backup}`);
      }
    }
  }

  persist() {
    const tmp = `${this.file}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(this.state), { mode: 0o600 });
    fs.renameSync(tmp, this.file);
  }

  // ── pending OAuth handshakes (state → patient) ──
  putPending(state, record) {
    const now = Date.now();
    for (const [key, value] of Object.entries(this.state.pending)) {
      if (value.expiresAt < now) delete this.state.pending[key];
    }
    this.state.pending[state] = record;
    this.persist();
  }

  takePending(state) {
    const record = this.state.pending[state];
    if (!record) return null;
    delete this.state.pending[state];
    this.persist();
    return record.expiresAt >= Date.now() ? record : null;
  }

  // ── links ──
  getLink(patientId) { return this.state.links[patientId] || null; }
  putLink(patientId, link) { this.state.links[patientId] = link; this.persist(); }
  deleteLink(patientId) { delete this.state.links[patientId]; this.persist(); }

  // ── document display metadata ──
  getDocument(patientId, docId) { return this.state.documents[`${patientId}/${docId}`] || null; }
  putDocument(patientId, docId, meta) { this.state.documents[`${patientId}/${docId}`] = meta; this.persist(); }
}

module.exports = { JsonStore };
