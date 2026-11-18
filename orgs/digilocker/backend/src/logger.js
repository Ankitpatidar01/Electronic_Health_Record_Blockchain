'use strict';

const LEVELS = { error: 0, warn: 1, info: 2, http: 3, debug: 4 };
const threshold = LEVELS[process.env.LOG_LEVEL || 'info'] ?? LEVELS.info;

function write(level, message, meta) {
  if (LEVELS[level] > threshold) return;
  const line = JSON.stringify({
    time: new Date().toISOString(),
    level,
    service: 'digilocker-service',
    message,
    ...(meta && typeof meta === 'object' ? meta : {}),
  });
  (level === 'error' ? process.stderr : process.stdout).write(line + '\n');
}

module.exports = {
  error: (m, meta) => write('error', m, meta),
  warn:  (m, meta) => write('warn', m, meta),
  info:  (m, meta) => write('info', m, meta),
  http:  (m, meta) => write('http', m, meta),
  debug: (m, meta) => write('debug', m, meta),
};
