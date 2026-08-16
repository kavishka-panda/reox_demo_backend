// backend/generate-env-key.js
const fs = require('fs');
const crypto = require('crypto');

const key = crypto.randomBytes(32).toString('hex'); // 256-bit key
const iv = crypto.randomBytes(16).toString('hex');  // 128-bit IV

const content = `module.exports = {
  ENV_KEY: '${key}',
  ENV_IV: '${iv}'
};\n`;

fs.writeFileSync(__dirname + '/envKey.js', content);
console.log('envKey.js generated with fresh encryption key.');