'use strict';

const path = require('path');

function parseKey(raw) {
  if (!raw) return null;
  const value = raw.trim();
  if (/^[a-f0-9]{64}$/i.test(value)) return Buffer.from(value, 'hex');
  const decoded = Buffer.from(value, 'base64');
  return decoded.length === 32 ? decoded : null;
}

function loadConfig(env = process.env) {
  const problems = [];
  const mode = (env.DIGILOCKER_MODE || 'sandbox').toLowerCase();
  if (!['sandbox', 'live'].includes(mode)) problems.push('DIGILOCKER_MODE must be "sandbox" or "live"');

  if (!env.JWT_SECRET) problems.push('JWT_SECRET is required (use the same value as patient-api)');

  const vaultKey = parseKey(env.DIGILOCKER_VAULT_KEY);
  if (!vaultKey) problems.push('DIGILOCKER_VAULT_KEY is required: 32 random bytes as 64 hex chars or base64');

  if (mode === 'live') {
    if (!env.DIGILOCKER_CLIENT_ID)     problems.push('DIGILOCKER_CLIENT_ID is required in live mode');
    if (!env.DIGILOCKER_CLIENT_SECRET) problems.push('DIGILOCKER_CLIENT_SECRET is required in live mode');
  }

  const port = Number(env.PORT || 4007);
  const publicUrl = (env.DIGILOCKER_PUBLIC_URL || `http://localhost:${port}`).replace(/\/$/, '');

  return {
    problems,
    port,
    mode,
    jwtSecret: env.JWT_SECRET,
    vaultKey,
    publicUrl,
    portalReturnUrl: env.DIGILOCKER_PORTAL_RETURN_URL || 'http://localhost:5174/digilocker',
    corsOrigins: (env.CORS_ALLOWED_ORIGINS || 'http://localhost:5174,http://localhost')
      .split(',').map(s => s.trim()).filter(Boolean),
    maxDocumentBytes: Number(env.DIGILOCKER_MAX_DOCUMENT_BYTES || 3 * 1024 * 1024),
    dataDir: path.resolve(process.cwd(), env.DIGILOCKER_DATA_DIR || './data'),
    live: {
      clientId:       env.DIGILOCKER_CLIENT_ID || '',
      clientSecret:   env.DIGILOCKER_CLIENT_SECRET || '',
      authorizeUrl:   env.DIGILOCKER_AUTHORIZE_URL   || 'https://digilocker.meripehchaan.gov.in/public/oauth2/1/authorize',
      tokenUrl:       env.DIGILOCKER_TOKEN_URL       || 'https://digilocker.meripehchaan.gov.in/public/oauth2/1/token',
      issuedFilesUrl: env.DIGILOCKER_ISSUED_FILES_URL || 'https://digilocker.meripehchaan.gov.in/public/oauth2/2/files/issued',
      fileUrl:        env.DIGILOCKER_FILE_URL        || 'https://digilocker.meripehchaan.gov.in/public/oauth2/1/file',
      revokeUrl:      env.DIGILOCKER_REVOKE_URL      || 'https://digilocker.meripehchaan.gov.in/public/oauth2/1/revoke',
    },
    fabric: {
      basePath:  env.FABRIC_BASE_PATH || path.resolve(__dirname, '../../../hospital/EHR_hospitalOrg-main/ehr-network'),
      peer:      env.PEER_ADDRESS || 'localhost:7051',
      channel:   env.FABRIC_CHANNEL || 'ehrchannel',
      chaincode: env.FABRIC_CHAINCODE || 'ehr',
    },
    ipfs: {
      url: (env.IPFS_SERVICE_URL || 'http://localhost:4006').replace(/\/$/, ''),
      key: env.IPFS_SERVICE_KEY || '',
    },
    dashboard: {
      url: (env.DASHBOARD_EVENT_API_URL || '').replace(/\/$/, ''),
      key: env.DASHBOARD_SERVICE_KEY || '',
    },
  };
}

module.exports = { loadConfig, parseKey };
