const { spawn } = require('child_process');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const { DB_USER, DB_PASSWORD, DB_HOST, DB_PORT, DB_NAME } = process.env;

if (!DB_USER || !DB_HOST || !DB_NAME) {
    console.error('Error: Missing required database variables in .env (DB_USER, DB_HOST, DB_NAME)');
    process.exit(1);
}

const dbPort = DB_PORT || '3306';
const encodedPassword = encodeURIComponent(DB_PASSWORD || '');
const databaseUrl = `mysql://${DB_USER}:${encodedPassword}@${DB_HOST}:${dbPort}/${DB_NAME}`;

const env = { ...process.env, DATABASE_URL: databaseUrl };
const args = process.argv.slice(2);

// Use shell: true to let the OS handle command resolution
const child = spawn('npx', ['prisma', ...args], { 
    env, 
    stdio: 'inherit',
    cwd: path.resolve(__dirname, '..'), // Run in backend root
    shell: true 
});

child.on('close', (code) => {
    process.exit(code);
});
