const fs = require('fs');
const path = require('path');

const schemaPath = path.resolve(__dirname, 'schema.prisma');
let content = fs.readFileSync(schemaPath, 'utf8');

// Replace all occurrences of updated_at to append sync_status
// Look for lines containing "updated_at  DateTime @default(now()) @updatedAt"
// or similar, and add sync_status below it.
content = content.replace(/(updated_at\s+DateTime\s+@default\(now\(\)\)\s+@updatedAt)/g, '$1\n  sync_status String @default("pending") @db.VarChar(20)');

fs.writeFileSync(schemaPath, content);
console.log('Schema updated successfully with sync_status!');
