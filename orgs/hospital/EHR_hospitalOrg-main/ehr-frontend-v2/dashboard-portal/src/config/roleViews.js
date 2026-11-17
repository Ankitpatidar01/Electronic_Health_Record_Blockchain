export const roleViews = {
  admin: ['overview', 'network', 'agents', 'transactions', 'security', 'ipfs', 'logs', 'alerts'],
  hospitaladmin: ['overview', 'network', 'agents', 'transactions', 'security', 'ipfs', 'logs', 'alerts'],
  doctor: ['agents', 'agent-doctor'],
  nurse: ['agents', 'agent-nurse'],
  pharmacist: ['agents', 'agent-pharmacy'],
  labtechnician: ['agents', 'agent-lab'],
  labsupervisor: ['agents', 'agent-lab'],
  labadmin: ['agents', 'agent-lab'],
  radiologist: ['agents', 'agent-lab'],
};

export function allowedViews(role) { return roleViews[role] || []; }
