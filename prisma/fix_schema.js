const fs = require('fs');
const path = require('path');

const schemaPath = path.resolve(__dirname, 'schema.prisma');
let content = fs.readFileSync(schemaPath, 'utf8');

// Replace all occurrences of updated_at DateTime @updatedAt with updated_at DateTime @default(now()) @updatedAt
content = content.replace(/updated_at\s+DateTime\s+@updatedAt/g, 'updated_at  DateTime @default(now()) @updatedAt');

fs.writeFileSync(schemaPath, content);
console.log('Schema updated successfully!');
