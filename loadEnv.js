const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');                     // <-- add this

let ENV_KEY, ENV_IV;
try {
  const envKey = require('./envKey');
  ENV_KEY = envKey.ENV_KEY;
  ENV_IV = envKey.ENV_IV;
} catch (err) {
  // Development: envKey.js may not exist
}

function decryptEnv(encryptedPath) {
  const encryptedData = fs.readFileSync(encryptedPath);
  const decipher = crypto.createDecipheriv(
    'aes-256-cbc',
    Buffer.from(ENV_KEY, 'hex'),
    Buffer.from(ENV_IV, 'hex')
  );
  const decrypted = Buffer.concat([
    decipher.update(encryptedData),
    decipher.final()
  ]);
  return decrypted.toString('utf8');
}

function loadEnv() {
  // Try current directory first, then parent directory
  const possibleDirs = [__dirname, path.join(__dirname, '..')];

  let envEncPath = null;
  let envPath = null;

  for (const dir of possibleDirs) {
    const encCandidate = path.join(dir, '.env.enc');
    const plainCandidate = path.join(dir, '.env');
    if (!envEncPath && fs.existsSync(encCandidate)) {
      envEncPath = encCandidate;
    }
    if (!envPath && fs.existsSync(plainCandidate)) {
      envPath = plainCandidate;
    }
  }

  // Log for diagnostics (safe to leave in)
  const logMsg = (msg) => {
    console.log(msg);
    try {
      const log = require('electron-log');
      log.info(msg);
    } catch (e) { /* ignore */ }
  };

  logMsg(`[loadEnv] Checking directories: ${possibleDirs.join(', ')}`);
  logMsg(`[loadEnv] .env.enc path: ${envEncPath}`);
  logMsg(`[loadEnv] .env path: ${envPath}`);

  let envContent = null;

  if (envPath) {
    logMsg('[loadEnv] Using plain .env file');
    envContent = fs.readFileSync(envPath, 'utf8');
  } else if (ENV_KEY && ENV_IV && envEncPath) {
    try {
      logMsg('[loadEnv] Attempting decryption...');
      envContent = decryptEnv(envEncPath);
      logMsg(`[loadEnv] Decryption succeeded. Length: ${envContent.length}`);
    } catch (err) {
      logMsg(`[loadEnv] Decryption FAILED: ${err.message}`);
    }
  }

  if (!envContent) {
    logMsg('[loadEnv] No .env.enc or .env file found – environment not loaded from file');
    return;
  }

  // Parse using dotenv
  const dotenv = require('dotenv');
  const parsed = dotenv.parse(envContent);
  Object.assign(process.env, parsed);

  // Sanitised logging
  logMsg(`[loadEnv] Loaded keys: ${Object.keys(parsed).join(', ')}`);
  logMsg(`[loadEnv] DB_HOST: ${process.env.DB_HOST}`);
  logMsg(`[loadEnv] DB_PORT: ${process.env.DB_PORT}`);
}

module.exports = { loadEnv };