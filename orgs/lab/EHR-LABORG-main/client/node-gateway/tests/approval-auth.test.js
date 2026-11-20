'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { canApproveWorkflow, isWorkflowApprovalRequest } = require('../staff-auth');

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
});
