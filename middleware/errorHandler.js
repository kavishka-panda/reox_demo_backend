class AppError extends Error {
    constructor(message, statusCode) {
        super(message);
        this.statusCode = statusCode;
        this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
        this.isOperational = true;
        Error.captureStackTrace(this, this.constructor);
    }
}

const handleCastErrorDB = (err) => {
    const message = `Invalid ${err.path}: ${err.value}`;
    return new AppError(message, 400);
};

const handleDuplicateFieldsDB = (err) => {
    const value = err.errmsg?.match(/(["'])(\\?.)*?\1/)?.[0];
    const message = `Duplicate field value: ${value}. Please use another value!`;
    return new AppError(message, 400);
};

const handleValidationErrorDB = (err) => {
    const errors = Object.values(err.errors).map(el => el.message);
    const message = `Invalid input data. ${errors.join('. ')}`;
    return new AppError(message, 400);
};

const sendErrorDev = (err, res) => {
    res.status(err.statusCode).json({
        success: false,
        error: err,
        message: err.message,
        stack: err.stack
    });
};

const sendErrorProd = (err, res) => {
    // Operational, trusted error: send message to client
    if (err.isOperational) {
        res.status(err.statusCode).json({
            success: false,
            message: err.message
        });
    } else {
        // Programming or other unknown error: don't leak error details
        console.error('ERROR 💥', err);
        res.status(500).json({
            success: false,
            message: 'Something went wrong!'
        });
    }
};

const globalErrorHandler = (err, req, res, next) => {
    err.statusCode = err.statusCode || 500;
    err.status = err.status || 'error';

    // Enhanced error logging
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.error('❌ ERROR OCCURRED:');
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.error('📍 Route:', req.method, req.originalUrl);
    console.error('💬 Message:', err.message);
    console.error('🔢 Status Code:', err.statusCode);
    console.error('📦 Error Name:', err.name);
    
    // Log Prisma-specific errors
    if (err.code) {
        console.error('🔑 Prisma Error Code:', err.code);
    }
    
    // Log full error object for debugging
    console.error('📋 Full Error:', err);
    console.error('📚 Stack Trace:', err.stack);
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // Handle Prisma errors
    if (err.code === 'P2002') {
        return res.status(400).json({
            success: false,
            message: 'A record with this value already exists'
        });
    }

    if (err.code === 'P2025') {
        return res.status(404).json({
            success: false,
            message: 'Record not found'
        });
    }

    // Handle Prisma database connection errors (MySQL server stopped / unreachable)
    const dbConnectionCodes = ['P1001', 'P1002', 'P1008', 'P1009', 'P1010', 'P1017'];
    if (dbConnectionCodes.includes(err.code)) {
        console.error('🔴 Database connection lost:', err.message);
        
        // Force Prisma to disconnect and clear stale connection pool.
        // It will automatically reconnect on the next query.
        try {
            const prisma = require('../config/prismaClient');
            prisma.$disconnect().catch(e => console.error('Error during forced Prisma disconnect:', e.message));
        } catch (e) {
            console.error('Failed to trigger Prisma disconnect:', e.message);
        }

        return res.status(503).json({
            success: false,
            message: 'Database server is unavailable. Please ensure MySQL is running and try again.',
            code: err.code
        });
    }

    // Handle Node.js level connection refused errors (e.g. ECONNREFUSED)
    if (err.message && (err.message.includes('ECONNREFUSED') || err.message.includes('connect ETIMEDOUT') || err.message.includes('ENOTFOUND'))) {
        console.error('🔴 Network/DB connection error:', err.message);
        
        // Force Prisma disconnect here as well, just in case
        try {
            const prisma = require('../config/prismaClient');
            prisma.$disconnect().catch(e => console.error('Error during forced Prisma disconnect:', e.message));
        } catch (e) {
            console.error('Failed to trigger Prisma disconnect:', e.message);
        }

        return res.status(503).json({
            success: false,
            message: 'Cannot connect to database. Please ensure MySQL is running and try again.'
        });
    }

    if (process.env.NODE_ENV === 'development' || !process.env.NODE_ENV) {
        res.status(err.statusCode).json({
            success: false,
            status: err.status,
            error: err,
            message: err.message,
            stack: err.stack,
            code: err.code
        });
    } else {
        if (err.isOperational) {
            res.status(err.statusCode).json({
                success: false,
                status: err.status,
                message: err.message
            });
        } else {
            // TEMPORARY DEBUG: Return detailed error even in production
            res.status(500).json({
                success: false,
                status: 'error',
                message: err.message,
                stack: err.stack,
                error: err
            });
        }
    }
};

module.exports = {
    AppError,
    globalErrorHandler
};