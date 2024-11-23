// backend/logger.js
const { createLogger, format, transports } = require('winston');
const path = require('path');
const fs = require('fs');
const DailyRotateFile = require('winston-daily-rotate-file');

// Ensure the /logs/ directory exists
const logDirectory = path.join(__dirname, '../logs');
try {
    if (!fs.existsSync(logDirectory)) {
        fs.mkdirSync(logDirectory);
    }
} catch (err) {
    console.error('Failed to create log directory:', err);
}

// Filter sensitive information
const filterSensitiveInfo = format((info) => {
    if (info.message && typeof info.message === 'string') {
        // Replace sensitive information in the message
        info.message = info.message.replace(/password=.*?(&|$)/g, 'password=****$1');
        info.message = info.message.replace(/token=.*?(&|$)/g, 'token=****$1');
    }
    return info;
});

// Custom log format
const customFormat = format.printf(({ level, message, timestamp, service }) => {
    return `${timestamp} [${service}] ${level}: ${message}`;
});

const logger = createLogger({
    level: 'info',
    format: format.combine(
        format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        format.errors({ stack: true }),
        format.splat(),
        filterSensitiveInfo(),
        customFormat
    ),
    defaultMeta: { service: 'user-service' },
    transports: [
        new transports.File({ filename: path.join(logDirectory, 'error.log'), level: 'error' }),
        new transports.File({ filename: path.join(logDirectory, 'combined.log') }),
        new DailyRotateFile({
            filename: path.join(logDirectory, 'application-%DATE%.log'),
            datePattern: 'YYYY-MM-DD',
            maxFiles: '14d'
        })
    ],
});

if (process.env.NODE_ENV !== 'production') {
    logger.add(new transports.Console({
        format: format.combine(
            format.colorize(),
            customFormat
        ),
    }));
}

module.exports = logger;