'use strict';

/**
 * Staff sign-in for the lab deck.
 *
 * The deck has no user store of its own. Sign-in is forwarded to the
 * diagnostics gateway (extorg-api), which owns the lab accounts, and the JWT it
 * returns is verified here with the shared JWT_SECRET on every /api call.
 */

const crypto = require('crypto');

const LAB_ROLES = ['labreceptionist', 'labtechnician', 'radiologist', 'labsupervisor', 'labadmin'];
const WORKFLOW_APPROVER_ROLES = ['doctor', 'labsupervisor', 'labadmin'];

function isWorkflowApprovalRequest(req) {
  return req.method === 'POST' && new RegExp('^/api/agents/run/[^/]+/approve$').test(req.path);
}

function canApproveWorkflow(role) {
  return WORKFLOW_APPROVER_ROLES.includes(role);
}
const PUBLIC_PATHS = new Set(['/api/health', '/api/meta', '/api/ipfs/health', '/api/auth/login']);

function b64urlDecode(value) {
  return Buffer.from(String(value).replace(/-/g, '+').replace(/_/g, '/'), 'base64');
}

function verifyToken(token, secret) {
  if (!secret) throw Object.assign(new Error('JWT_SECRET is not configured for the lab gateway'), { status: 500 });
  const parts = String(token).split('.');
  if (parts.length !== 3) throw new Error('Invalid token');
  const header = JSON.parse(b64urlDecode(parts[0]).toString('utf8'));
  if (header.alg !== 'HS256') throw new Error('Invalid token');
  const expected = crypto.createHmac('sha256', secret).update(`${parts[0]}.${parts[1]}`).digest();
  const given = b64urlDecode(parts[2]);
  if (expected.length !== given.length || !crypto.timingSafeEqual(expected, given)) throw new Error('Invalid token');
  const payload = JSON.parse(b64urlDecode(parts[1]).toString('utf8'));
  if (payload.exp && Date.now() / 1000 >= payload.exp) throw new Error('Token expired');
  return payload;
}

function requireLabStaff(req, res, next) {
  if (!req.path.startsWith('/api/') || PUBLIC_PATHS.has(req.path)) return next();
  const header = req.headers.authorization || '';
  if (!header.startsWith('Bearer ')) return res.status(401).json({ error: 'Sign in with a lab staff account' });
  try {
    const user = verifyToken(header.slice(7), process.env.JWT_SECRET);
    const approvalOnlyAccess = isWorkflowApprovalRequest(req) && user.role === 'doctor';
    if (!LAB_ROLES.includes(user.role) && !approvalOnlyAccess) {
      return res.status(403).json({ error: `Role '${user.role}' cannot use the lab deck` });
    }
    req.user = user;
    return next();
  } catch (error) {
    return res.status(error.status || 401).json({ error: error.message });
  }
}

async function login(req, res) {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: 'username and password are required' });
  const base = process.env.EXTORG_API_URL || 'http://h-extorg-api:4004';
  let upstream;
  try {
    upstream = await fetch(`${base}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
      signal: AbortSignal.timeout(8000),
    });
  } catch (error) {
    return res.status(502).json({ error: `Diagnostics sign-in service is unreachable (${error.message})` });
  }
  const body = await upstream.json().catch(() => ({}));
  if (!upstream.ok || !body.success) {
    return res.status(upstream.status === 200 ? 401 : upstream.status).json({ error: body.error || 'Invalid credentials' });
  }
  const user = body.data && body.data.user;
  if (!user || !LAB_ROLES.includes(user.role)) {
    return res.status(403).json({ error: 'This account is not a lab staff account' });
  }
  return res.json({ token: body.data.token, user });
}

module.exports = { requireLabStaff, login, verifyToken, LAB_ROLES, WORKFLOW_APPROVER_ROLES, isWorkflowApprovalRequest, canApproveWorkflow };
