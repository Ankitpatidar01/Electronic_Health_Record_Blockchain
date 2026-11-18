'use strict';

const fs = require('fs');
const path = require('path');

function parseEnvLine(line) {
  const trimmed = String(line || '').trim();
  if (!trimmed || trimmed.startsWith('#')) {
    return null;
  }

  const withoutExport = trimmed.startsWith('export ')
    ? trimmed.slice('export '.length).trim()
    : trimmed;

  const equalsIndex = withoutExport.indexOf('=');
  if (equalsIndex <= 0) {
    return null;
  }

  const key = withoutExport.slice(0, equalsIndex).trim();
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) {
    return null;
  }

  let value = withoutExport.slice(equalsIndex + 1).trim();
  const hasDoubleQuotes = value.startsWith('"') && value.endsWith('"');
  const hasSingleQuotes = value.startsWith("'") && value.endsWith("'");
  if (hasDoubleQuotes || hasSingleQuotes) {
    value = value.slice(1, -1);
  }

  return { key, value };
}

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return;
  }

  const text = fs.readFileSync(filePath, 'utf8');
  const lines = text.split(/\r?\n/);

  for (const line of lines) {
    const parsed = parseEnvLine(line);
    if (!parsed) {
      continue;
    }

    // Keep explicit shell-provided values and fill only missing/empty ones.
    if (process.env[parsed.key] === undefined || process.env[parsed.key] === '') {
      process.env[parsed.key] = parsed.value;
    }
  }
}

function loadGatewayEnvironment() {
  const candidateDirs = [
    path.resolve(__dirname, '..', '..', 'env'),
    path.resolve(__dirname, 'env'),
    path.resolve('/env'),
  ];
  for (const dir of candidateDirs) {
    const netEnv = path.join(dir, 'network.env');
    if (fs.existsSync(netEnv)) {
      loadEnvFile(netEnv);
      break;
    }
  }

  const optionalMachineEnv = String(process.env.GATEWAY_MACHINE_ENV || '').trim();
  if (optionalMachineEnv) {
    const machineEnvFile = optionalMachineEnv.endsWith('.env')
      ? optionalMachineEnv
      : `${optionalMachineEnv}.env`;
    for (const dir of candidateDirs) {
      const target = path.join(dir, machineEnvFile);
      if (fs.existsSync(target)) {
        loadEnvFile(target);
        break;
      }
    }
  }

  if (!process.env.IPFS_API_URL) {
    process.env.IPFS_API_URL = 'http://ipfs.ehr.local:5001';
  }
  if (!process.env.IPFS_GATEWAY_URL) {
    process.env.IPFS_GATEWAY_URL = 'http://localhost:8090/ipfs';
  }
}

module.exports = {
  loadGatewayEnvironment,
};
