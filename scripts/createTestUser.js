const bcrypt = require('bcrypt');
const db = require('../config/db');

async function createTestUser() {
    try {
        const hashedPassword = await bcrypt.hash('admin123', 10);

        await db.query(
            `INSERT INTO user (name, contact, email, password, role_id, created_at,status_id)
             VALUES (?, ?, ?, ?, ?, NOW(),?)
             ON DUPLICATE KEY UPDATE password = VALUES(password)`,
            ['Admin', '0712345678', 'admin', hashedPassword, 1, 1]
        );

        console.log('Test user created successfully!');
        console.log('Username: admin');
        console.log('Password: admin123');
        process.exit(0);
    } catch (error) {
        console.error('Error creating test user:', error);
        process.exit(1);
    }
}

createTestUser();
