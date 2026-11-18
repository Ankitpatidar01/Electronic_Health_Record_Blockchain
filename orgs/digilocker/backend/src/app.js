'use strict';

require('dotenv').config();

const express   = require('express');
const cors      = require('cors');
const helmet    = require('helmet');
const rateLimit = require('express-rate-limit');
const crypto    = require('crypto');

const logger = require('./logger');
const { loadConfig }      = require('./config');
const { JsonStore }       = require('./store');
const { IpfsClient }      = require('./ipfsClient');
const { FabricClient }    = require('./fabricClient');
const { createTelemetry } = require('./telemetry');
const { createRouter }    = require('./routes');
const { SandboxProvider } = require('./providers/sandbox');
const { LiveProvider }    = require('./providers/live');

function createProvider(config) {
  if (config.mode === 'live') return new LiveProvider({ publicUrl: config.publicUrl, live: config.live });
  const signingKey = crypto.createHmac('sha256', config.vaultKey).update('ehr-digilocker:sandbox-signing').digest();
  return new SandboxProvider({ publicUrl: config.publicUrl, signingKey });
}

function createApp(deps) {
  const { config } = deps;
  const app = express();
  app.set('trust proxy', 1);
  app.disable('x-powered-by');
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(cors({
    origin(origin, done) {
      // Same-origin and non-browser calls carry no Origin header.
      if (!origin || config.corsOrigins.includes('*') || config.corsOrigins.includes(origin)) return done(null, true);
      return done(null, false);
    },
    methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Authorization', 'Content-Type'],
    exposedHeaders: ['Content-Disposition'],
  }));
  app.use(express.json({ limit: '64kb' }));
  app.use(rateLimit({ windowMs: 60_000, max: 120, standardHeaders: true, legacyHeaders: false }));
  app.use((req, res, next) => {
    const started = Date.now();
    res.on('finish', () => deps.logger.http('request', { method: req.method, path: req.path, status: res.statusCode, ms: Date.now() - started }));
    next();
  });

  app.use('/', createRouter(deps));

  app.use((req, res) => res.status(404).json({ success: false, error: `Not found: ${req.method} ${req.path}` }));

  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    const status = Number.isInteger(err.status) && err.status >= 400 && err.status < 600 ? err.status : 500;
    if (status >= 500) deps.logger.error('Request failed', { path: req.path, status, error: err.message });
    res.status(status).json({
      success: false,
      error: status === 500 ? 'Internal error' : err.message,
      ...(err.code ? { code: err.code } : {}),
    });
  });
  return app;
}

function start() {
  const config = loadConfig();
  if (config.problems.length) {
    for (const problem of config.problems) logger.error(`Configuration: ${problem}`);
    logger.error('Copy orgs/digilocker/backend/.env.example to .env (or set the variables in the root .env) and fill in the values above.');
    process.exit(1);
  }

  const store     = new JsonStore(config.dataDir);
  const provider  = createProvider(config);
  const ipfs      = new IpfsClient({ ...config.ipfs, logger });
  const fabric    = new FabricClient({ fabric: config.fabric, logger });
  const telemetry = createTelemetry({ dashboard: config.dashboard, logger });
  const app = createApp({ config, store, provider, ipfs, fabric, telemetry, logger });

  try { fabric.connect(); } catch (err) {
    logger.warn('Fabric gateway not ready at startup; will reconnect on demand', { error: err.message });
  }

  const server = app.listen(config.port, () => {
    logger.info(`digilocker-service listening on :${config.port}`, { mode: config.mode, publicUrl: config.publicUrl });
    if (config.mode === 'sandbox') logger.warn('Running in SANDBOX mode: documents are generated samples, not real DigiLocker records.');
  });

  telemetry.heartbeat();
  const beat = setInterval(() => telemetry.heartbeat(), 15_000);
  beat.unref();

  const shutdown = (signal) => {
    logger.info(`${signal} received, shutting down`);
    clearInterval(beat);
    server.close(() => { fabric.disconnect(); process.exit(0); });
    setTimeout(() => process.exit(1), 10_000).unref();
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

if (require.main === module) start();

module.exports = { createApp, createProvider };
