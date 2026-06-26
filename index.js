const path = require('path');
const os = require('os');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '.env') });

// Hostinger (Linux Server) එකකද දුවන්නේ කියලා චෙක් කරමු
const isServer = process.env.NODE_ENV === 'production' || !process.env.APPDATA;

let log;
let dataSyncLogPath; // මෙතන declare කරලා තියෙනවා

if (!isServer) {
    // Local / Electron App Environment
    log = require('electron-log');
    const roamingDir = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
    dataSyncLogPath = path.join(roamingDir, 'Reox', 'logs', 'datasync.log'); // const අයින් කරා
    fs.mkdirSync(path.dirname(dataSyncLogPath), { recursive: true });
    log.transports.file.resolvePathFn = () => dataSyncLogPath;
    console.log(log.transports.file.getFile().path);
} else {
    // Hostinger Server Environment
    console.log("🌐 Running on Linux Production Server environment.");
    
    dataSyncLogPath = path.join(__dirname, 'logs', 'datasync.log'); // const අයින් කරා
    fs.mkdirSync(path.dirname(dataSyncLogPath), { recursive: true });
    
    log = {
        info: (...args) => console.log('[INFO]', ...args),
        error: (...args) => console.error('[ERROR]', ...args),
        warn: (...args) => console.warn('[WARN]', ...args),
        transports: { file: {} }
    };
}

const roamingDir = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
const dataSyncLogPath = path.join(roamingDir, 'Reox', 'logs', 'datasync.log');
fs.mkdirSync(path.dirname(dataSyncLogPath), { recursive: true });
log.transports.file.resolvePathFn = () => dataSyncLogPath;
console.log(log.transports.file.getFile().path);
const { initializeDatabase } = require('./config/dbInitializer');
const express = require('express');
const cors = require('cors');
const { globalErrorHandler, AppError } = require('./middleware/errorHandler');
const productRoutes = require('./routes/productRoutes');
const supplierRoutes = require('./routes/supplierRoutes');
const grnRoutes = require('./routes/grnRouters');
const brandRoutes = require('./routes/brandRoutes');
const categoryRoutes = require('./routes/categoryRoutes');
const unitRoutes = require('./routes/unitRoutes');
const productTypeRoutes = require('./routes/productTypeRoutes');
const paymentTypeRoutes = require('./routes/paymentTypeRoutes');
const stockRoutes = require('./routes/stockRoutes');
const resonRoutes = require('./routes/reasonRoutes');
const returnStatusRoutes = require('./routes/returnStatusRoutes');
const damagedRoutes = require('./routes/damagedRoutes');
const setupRoutes = require('./routes/setup');
const backupRoutes = require('./routes/backup.routes');
const posRoutes = require('./routes/posRoutes');
const customerRoutes = require('./routes/customerRoutes');
const userRoutes = require('./routes/userRoutes');
const roleRoutes = require('./routes/roleRoutes');
const { scheduleBackup } = require('./schedulers/backupScheduler');
const { scheduleSessionClosure } = require('./schedulers/sessionClosureScheduler');
const { scheduleSubscriptionVerification } = require('./schedulers/subscriptionVerificationScheduler');
const moneyExchangeRoutes = require('./routes/moneyExchangeRoutes');
const swaggerJsDoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');
const cashSessionRoutes = require('./routes/cashSessionRoutes');
const quotationRoutes = require('./routes/quotationRoutes');
const reportRoutes = require('./routes/reportRoutes');
const analyticsRoutes = require('./routes/reportRoutes'); // Using the same file for now
const subscriptionRoutes = require('./routes/subscriptionRoutes');
const dbOnlineCheckRoutes = require('./routes/dbOnlineCheckRoutes');
const dbConfigRoutes = require('./routes/dbConfig');
const adminRoutes = require('./routes/adminRoutes');
const { initializeSyncServices, cleanupSyncServices } = require('./middleware/syncMiddleware');


// Middleware
const app = express();
app.use(cors({
    origin: ['https://demo.reox.lk','http://localhost:5173', 'http://localhost:5174', 'http://127.0.0.1:5173'],
    credentials: true
}));
const authRoutes = require('./routes/auth');
app.use(express.json());

// Health check endpoint for Electron
app.get('/api/health', (req, res) => {
    res.status(200).json({ status: 'ok', message: 'Backend is running' });
});

// Routes
app.use('/api/analytics', analyticsRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/suppliers', supplierRoutes);
app.use('/api/grn', grnRoutes);
app.use('/api/brands', brandRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/units', unitRoutes);
app.use('/api/product-types', productTypeRoutes);
app.use('/api/payment-types', paymentTypeRoutes);
app.use('/api/stock', stockRoutes);
app.use('/api/reasons', resonRoutes);
app.use('/api/return-status', returnStatusRoutes);
app.use('/api/damaged', damagedRoutes);
app.use('/api/setup', setupRoutes);
app.use('/api/backup', backupRoutes);
app.use('/api/db-config', dbConfigRoutes);
app.use('/api/online-database', dbConfigRoutes);
app.use('/api/pos', posRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/subscription', subscriptionRoutes);
app.use('/api/db-online', dbOnlineCheckRoutes);
app.use('/api/money-exchange', moneyExchangeRoutes);
app.use('/api/quotations', quotationRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api', cashSessionRoutes);
app.use('/api/users', userRoutes);
app.use('/api/roles', roleRoutes);

// Handle undefined routes
app.use((req, res, next) => {
    next(new AppError(`Can't find ${req.originalUrl} on this server!`, 404));
});

// Global error handling middleware (MUST BE LAST)
app.use(globalErrorHandler);

const PORT = process.env.PORT || 3000;

// Async server startup function
async function startServer() {
    try {
        // Initialize database connection by checking db_config table
        console.log('\n🚀 Starting server initialization...\n');
        const initResult = await initializeDatabase();
        const syncMode = initResult?.syncAllowed ? 'online' : 'offline';

        // Initialize sync services (background sync worker)
        console.log('\n🔄 Initializing sync services...\n');
        await initializeSyncServices(syncMode);
        console.log('✅ Sync services initialized\n');

        // Update display mode tracking only; local DB stays primary at all times
        const db = require('./config/db');
        db.dbManager.setMode(syncMode);

        if (syncMode === 'online') {
            console.log('\n🔄 Online sync allowed (LOCAL DB remains primary)...\n');
            console.log('✅ Online sync enabled - Data syncs to cloud in background\n');
        } else {
            console.log('\n💾 Offline mode at startup - no background sync enabled\n');
        }

        const server = app.listen(PORT, () => {
            console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
            console.log(`✅ Server is running on port ${PORT}`);
            console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

            // Initialize backup scheduler
            try {
                scheduleBackup();
                console.log('✅ Backup scheduler started successfully');
            } catch (error) {
                console.error('❌ Failed to start backup scheduler:', error.message);
            }

            // Initialize session auto-close scheduler
            try {
                scheduleSessionClosure();
                console.log('✅ Session auto-close scheduler started successfully');
            } catch (error) {
                console.error('❌ Failed to start session auto-close scheduler:', error.message);
            }

            // Initialize subscription auto-verification scheduler
            try {
                scheduleSubscriptionVerification();
                console.log('✅ Subscription verification scheduler started successfully');
            } catch (error) {
                console.error('❌ Failed to start subscription verification scheduler:', error.message);
            }
        });

        server.on('error', (error) => {
            if (error.code === 'EADDRINUSE') {
                console.error(`❌ Port ${PORT} is already in use. Please close the other process or change the PORT in .env.`);
            } else {
                console.error('❌ Server startup error:', error.message);
            }
            process.exit(1);
        });

    } catch (error) {
        console.error('❌ Failed to initialize server:', error);
        process.exit(1);
    }
}

// Start the server
startServer();

// Swagger definition
const swaggerOptions = {
    swaggerDefinition: {
        openapi: '3.0.0',
        info: {
            title: 'POS System API',
            version: '1.0.0',
            description: 'API documentation for Product and Inventory Management',
        },
        servers: [
            {
                url: `http://localhost:${PORT}`,
            },
        ],
    },
    apis: ['./routes/*.js'],
};

const swaggerDocs = swaggerJsDoc(swaggerOptions);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocs));

// Graceful shutdown
process.on('SIGINT', async () => {
    console.log('\n🛑 Shutting down gracefully...');
    await cleanupSyncServices();
    process.exit(0);
});

// Place this before your other routes
app.get('/favicon.ico', (req, res) => res.status(204).end());