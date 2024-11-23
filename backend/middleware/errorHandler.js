// backend/middleware/errorHandler.js
const logger = require('../logger');

function errorHandler(err, _req, res, _next) {
    // Log the error message, stack trace, and additional details
    logger.error('Error: %s', err.message, {
        stack: err.stack,
        name: err.name,
        code: err.code,
        status: err.status,
        additionalInfo: err.additionalInfo
    });

    // Determine the status code and error message to send to the client
    let statusCode = 500;
    let errorMessage = 'Internal Server Error';

    if (err.status) {
        statusCode = err.status;
    }

    if (err.isClientError) {
        errorMessage = err.message;
    }

    // Send the error response to the client
    res.status(statusCode).json({ error: errorMessage });
}

module.exports = errorHandler;