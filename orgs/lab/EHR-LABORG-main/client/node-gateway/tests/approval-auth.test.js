'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const {
  canApproveWorkflow,
  isWorkflowApprovalRequest,
  requireLabStaff,
  verifyToken,
} = require('../staff-auth');

const SECRET = 'staff-auth-test-secret';

function tokenFor(payload) {
  const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
  const header = encode({ alg: 'HS256', typ: 'JWT' });
  const body = encode(payload);
  const signature = crypto.createHmac('sha256', SECRET).update(`${header}.${body}`).digest('base64url');
  return `${header}.${body}.${signature}`;
}

function invokeMiddleware(role, path) {
  const req = {
    method: 'POST',
    path,
    headers: { authorization: `Bearer ${tokenFor({ userId: 'staff-1', role, exp: Date.now() / 1000 + 60 })}` },
  };
  const res = {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
  let continued = false;
  const previousSecret = process.env.JWT_SECRET;
  process.env.JWT_SECRET = SECRET;
  try {
    requireLabStaff(req, res, () => { continued = true; });
  } finally {
    if (previousSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = previousSecret;
  }
  return { req, res, continued };
}

test('only doctor and designated lab reviewers may approve workflows', () => {
  for (const role of ['doctor', 'labsupervisor', 'labadmin']) {
    assert.equal(canApproveWorkflow(role), true, role);
  }
  for (const role of ['labtechnician', 'radiologist', 'labreceptionist', 'nurse', 'receptionist', 'patient']) {
    assert.equal(canApproveWorkflow(role), false, role);
  }
});

test('doctor is admitted only to the workflow approval endpoint', () => {
  assert.equal(isWorkflowApprovalRequest({ method: 'POST', path: '/api/agents/run/run-1/approve' }), true);
  assert.equal(isWorkflowApprovalRequest({ method: 'POST', path: '/api/records' }), false);
  assert.equal(isWorkflowApprovalRequest({ method: 'GET', path: '/api/agents/run/run-1/approve' }), false);

  const approval = invokeMiddleware('doctor', '/api/agents/run/run-1/approve');
  assert.equal(approval.continued, true);
  assert.equal(approval.req.user.role, 'doctor');

  const labData = invokeMiddleware('doctor', '/api/records');
  assert.equal(labData.continued, false);
  assert.equal(labData.res.statusCode, 403);
});

test('JWT expiry must be a finite numeric timestamp', () => {
  const valid = tokenFor({ userId: 'doctor-1', role: 'doctor', exp: Date.now() / 1000 + 60 });
  assert.equal(verifyToken(valid, SECRET).userId, 'doctor-1');

  for (const exp of ['9999999999', null, true, NaN, Infinity]) {
    const malformed = tokenFor({ userId: 'doctor-1', role: 'doctor', exp });
    assert.throws(() => verifyToken(malformed, SECRET), /expiry/);
  }

  const expired = tokenFor({ userId: 'doctor-1', role: 'doctor', exp: 1 });
  assert.throws(() => verifyToken(expired, SECRET), /expired/);
});
