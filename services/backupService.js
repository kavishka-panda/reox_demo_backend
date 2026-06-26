const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
const archiver = require('archiver');
const registerZipEncrypted = require('archiver-zip-encrypted');

// Register zip-encrypted format for stronger security
archiver.registerFormat('zip-encrypted', registerZipEncrypted);

class BackupService {
    constructor() {
        const baseDataDir = process.env.APP_DATA_PATH || process.cwd();
        this.backupDir = path.join(baseDataDir, 'backups');
        this.connection = null;

        if (!fs.existsSync(this.backupDir)) {
            fs.mkdirSync(this.backupDir, { recursive: true });
        }
    }

    async getConnection() {
        if (!this.connection) {
            this.connection = await mysql.createConnection({
                host: process.env.DB_HOST,
                user: process.env.DB_USER,
                password: process.env.DB_PASSWORD,
                database: process.env.DB_NAME,
                port: parseInt(process.env.DB_PORT || '3306'),
            });
        }
        return this.connection;
    }

    async createBackup() {
        const timestamp = Date.now();
        const sqlFilename = `backup_${timestamp}.sql`;
        const zipFilename = `backup_${timestamp}.zip`;
        const zipFilepath = path.join(this.backupDir, zipFilename);
        const ZIP_PASSWORD = process.env.BACKUP_PASSWORD;

        try {
            console.log("Backup saving to: ", path.resolve(this.backupDir));
            const connection = await this.getConnection();
            let sqlDump = '-- MySQL Database Backup\n';
            sqlDump += `-- Created: ${new Date().toISOString()}\n`;
            sqlDump += `-- Database: ${process.env.DB_NAME}\n\n`;
            sqlDump += 'SET FOREIGN_KEY_CHECKS=0;\n\n';

            const [tables] = await connection.query('SHOW TABLES');

            for (const tableRow of tables) {
                const tableName = Object.values(tableRow)[0];

                sqlDump += `\n-- Table: ${tableName}\n`;
                sqlDump += `DROP TABLE IF EXISTS \`${tableName}\`;\n`;

                const [createResult] = await connection.query(`SHOW CREATE TABLE \`${tableName}\``);
                sqlDump += createResult[0]['Create Table'] + ';\n\n';

                const [rows] = await connection.query(`SELECT * FROM \`${tableName}\``);

                if (rows.length > 0) {
                    sqlDump += `-- Data for table ${tableName}\n`;

                    for (const row of rows) {
                        const columns = Object.keys(row).map(col => `\`${col}\``).join(', ');
                        const values = Object.values(row)
                            .map(val => {
                                if (val === null) return 'NULL';
                                if (typeof val === 'string') return `'${val.replace(/'/g, "''").replace(/\\/g, '\\\\')}'`;
                                if (val instanceof Date) return `'${val.toISOString().slice(0, 19).replace('T', ' ')}'`;
                                if (typeof val === 'boolean') return val ? '1' : '0';
                                return val;
                            })
                            .join(', ');

                        sqlDump += `INSERT INTO \`${tableName}\` (${columns}) VALUES (${values});\n`;
                    }
                    sqlDump += '\n';
                }
            }

            sqlDump += 'SET FOREIGN_KEY_CHECKS=1;\n';

            // Create encrypted ZIP archive
            return new Promise((resolve, reject) => {
                const output = fs.createWriteStream(zipFilepath);

                // Create archive with compression and encryption
                const archive = archiver('zip-encrypted', {
                    zlib: { level: 9 }, // Maximum compression
                    encryptionMethod: 'aes256', // Stronger AES256 encryption
                    password: ZIP_PASSWORD
                });

                output.on('close', () => {
                    const stats = fs.statSync(zipFilepath);
                    const sizeInMB = (stats.size / (1024 * 1024)).toFixed(2);

                    resolve({
                        success: true,
                        filename: zipFilename,
                        size: `${sizeInMB} MB`,
                        date: new Date().toISOString(),
                        timestamp
                    });
                });

                archive.on('error', (err) => reject(new Error(`Archive creation failed: ${err.message}`)));

                // Append SQL dump directly to archive
                archive.append(sqlDump, { name: sqlFilename });

                archive.pipe(output);
                archive.finalize();
            });
        } catch (err) {
            throw new Error(`Backup failed: ${err.message}`);
        }
    }

    listBackups() {
        try {
            const files = fs.readdirSync(this.backupDir);
            const backups = files
                .filter(file => file.endsWith('.zip'))
                .map(file => {
                    const filepath = path.join(this.backupDir, file);
                    const stats = fs.statSync(filepath);
                    return {
                        filename: file,
                        size: `${(stats.size / (1024 * 1024)).toFixed(2)} MB`,
                        date: stats.mtime.toISOString(),
                        timestamp: stats.mtimeMs
                    };
                })
                .sort((a, b) => b.timestamp - a.timestamp);

            return backups;
        } catch (error) {
            throw new Error(`Failed to list backups: ${error.message}`);
        }
    }

    getBackupPath(filename) {
        return path.join(this.backupDir, filename);
    }

    getLatestBackup() {
        try {
            const files = fs.readdirSync(this.backupDir);
            if (files.length === 0) return null;

            const backups = files
                .filter(file => file.endsWith('.zip'))
                .map(file => {
                    const filepath = path.join(this.backupDir, file);
                    const stats = fs.statSync(filepath);
                    return {
                        filename: file,
                        size: `${(stats.size / (1024 * 1024)).toFixed(2)} MB`,
                        date: stats.mtime,
                        timestamp: stats.mtimeMs
                    };
                })
                .sort((a, b) => b.timestamp - a.timestamp);

            return backups[0];
        } catch {
            return null;
        }
    }

    getBackupStats() {
        try {
            const files = fs.readdirSync(this.backupDir);
            const backups = files.filter(file => file.endsWith('.zip'));

            if (backups.length === 0) {
                return {
                    lastBackup: 'Never',
                    totalSize: '0 MB',
                    count: 0,
                    status: 'No Backups'
                };
            }

            let totalSize = 0;
            let latestDate = null;

            backups.forEach(file => {
                const filepath = path.join(this.backupDir, file);
                const stats = fs.statSync(filepath);
                totalSize += stats.size;
                if (!latestDate || stats.mtime > latestDate) {
                    latestDate = stats.mtime;
                }
            });

            const timeAgo = this.getTimeAgo(latestDate);

            return {
                lastBackup: timeAgo,
                totalSize: `${(totalSize / (1024 * 1024)).toFixed(2)} MB`,
                count: backups.length,
                status: 'Protected'
            };
        } catch {
            return {
                lastBackup: 'Error',
                totalSize: '0 MB',
                count: 0,
                status: 'Error'
            };
        }
    }

    getTimeAgo(date) {
        const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);

        if (seconds < 60) return 'Just now';
        if (seconds < 3600) return `${Math.floor(seconds / 60)} minutes ago`;
        if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours ago`;
        if (seconds < 604800) return `${Math.floor(seconds / 86400)} days ago`;
        return date.toLocaleDateString();
    }

    async cleanOldBackups(keepCount = 7) {
        try {
            const files = fs.readdirSync(this.backupDir);
            const backups = files
                .filter(file => file.endsWith('.zip'))
                .map(file => {
                    const filepath = path.join(this.backupDir, file);
                    return {
                        filename: file,
                        mtime: fs.statSync(filepath).mtime
                    };
                })
                .sort((a, b) => b.mtime.getTime() - a.mtime.getTime());

            const toDelete = backups.slice(keepCount);

            toDelete.forEach(backup => {
                fs.unlinkSync(path.join(this.backupDir, backup.filename));
            });

            return { deleted: toDelete.length };
        } catch (err) {
            throw new Error(`Cleanup failed: ${err.message}`);
        }
    }

    async deleteBackup(filename) {
        try {
            const filepath = this.getBackupPath(filename);
            
            // Validate filename to prevent directory traversal
            if (!filename || filename.includes('..') || !filename.endsWith('.zip')) {
                throw new Error('Invalid filename');
            }

            if (!fs.existsSync(filepath)) {
                throw new Error('Backup file not found');
            }

            fs.unlinkSync(filepath);
            return { success: true, message: 'Backup deleted successfully' };
        } catch (err) {
            throw new Error(`Delete failed: ${err.message}`);
        }
    }

    async close() {
        if (this.connection) {
            await this.connection.end();
            this.connection = null;
        }
    }
}

module.exports = { BackupService };
