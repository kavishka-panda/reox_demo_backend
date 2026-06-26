const express = require('express');
const { BackupService } = require('../services/backupService');
const path = require('path');
const fs = require('fs');

const router = express.Router();
const backupService = new BackupService();

router.post('/create', async (req, res) => {
    try {
        const result = await backupService.createBackup();
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.get('/stats', async (req, res) => {
    try {
        const stats = backupService.getBackupStats();
        res.json(stats);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.get('/latest', async (req, res) => {
    try {
        const latest = backupService.getLatestBackup();
        res.json(latest);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.get('/list', async (req, res) => {
    try {
        const backups = backupService.listBackups();
        res.json(backups);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.get('/download/:filename', async (req, res) => {
    try {
        const filename = req.params.filename;

        // Validate filename to prevent directory traversal
        if (!filename || filename.includes('..') || !filename.endsWith('.sql')) {
            return res.status(400).json({ error: 'Invalid filename' });
        }

        const filepath = backupService.getBackupPath(filename);

        // Check if file exists
        if (!fs.existsSync(filepath)) {
            return res.status(404).json({ error: 'Backup file not found' });
        }

        // Set proper headers
        res.setHeader('Content-Type', 'application/sql');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.setHeader('Content-Length', fs.statSync(filepath).size);

        // Stream the file
        const fileStream = fs.createReadStream(filepath);
        fileStream.pipe(res);

        fileStream.on('error', (error) => {
            console.error('File stream error:', error);
            if (!res.headersSent) {
                res.status(500).json({ error: 'Error streaming file' });
            }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.delete('/clean', async (req, res) => {
    try {
        const result = await backupService.cleanOldBackups();
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});
router.get('/schedule/status', async (req, res) => {
    try {
        const { getNextScheduledTime } = require('../schedulers/backupScheduler');
        const nextRun = getNextScheduledTime();

        res.json({
            enabled: true,
            schedule: 'Daily at 5:00 PM',
            nextRun: nextRun.toISOString(),
            timezone: 'Asia/Colombo'
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});


router.post('/schedule/trigger', async (req, res) => {
    try {
        const { triggerManualBackup } = require('../schedulers/backupScheduler');
        const result = await triggerManualBackup();
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.delete('/:filename', async (req, res) => {
    try {
        const filename = req.params.filename;
        const result = await backupService.deleteBackup(filename);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
