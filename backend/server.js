import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import portfinder from 'portfinder';
import { body, validationResult } from 'express-validator';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import sendPromptToFriend from './promptSender.js';
import receiveImage from './receiveImage.js';
import errorHandler from './middleware/errorHandler.js';
import logger from './logger.js';
import { WEBSOCKET_PORT } from './config/websocket.js'; // Import WebSocket port configuration

const app = express();
let server; // Declare server globally to manage its lifecycle
let io;

// Get the directory of the current script file
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Automatically find an available port and start the server
async function startServer() {
    // Dynamically find an available port between 3002 and 3999
    const PORT = await portfinder.getPortPromise({ port: 3002, stopPort: 3999 });

    // Create HTTP server and Socket.IO instance
    server = http.createServer(app);
    io = new Server(server);

    // Start the server
    server.listen(PORT, () => logger.info(`Server running at http://localhost:${PORT}`))
        .on('error', (err) => {
            if (err.code === 'EADDRINUSE') {
                logger.error(`Port ${PORT} is already in use.`);
            } else {
                logger.error('Error starting server:', err);
            }
            process.exit(1); // Exit process if server cannot start
        });

    // Middleware to parse JSON bodies
    app.use(express.json());

    // Serve static files (CSS, JS, images)
    app.use('/images', express.static(path.join(__dirname, '../images')));

    // Serve index.html for the frontend
    app.get('/', (req, res) => {
        logger.info('Serving index.html');
        res.sendFile(path.join(__dirname, '../frontend/index.html'));
    });

    // Endpoint to receive a prompt from the frontend
    app.post('/sendPrompt', [
        body('prompt').isString().trim().escape() // Validate and sanitize the 'prompt' input
    ], async (req, res) => {
        const errors = validationResult(req);
        
        // Handle validation errors
        if (!errors.isEmpty()) {
            logger.error('Validation error:', errors.array());
            return res.status(400).json({ error: 'Invalid input.' });
        }

        const { prompt } = req.body; // Extract the prompt from the request body
        try {
            logger.info(`Received prompt: ${prompt}`);
            await sendPromptToFriend(prompt); // Forward the prompt to your friend's system
            logger.info('Prompt forwarded to friend.');

            // Listen for the imageReceived event only once
            if (receiveImage.listenerCount('imageReceived') === 0) {
                receiveImage.once('imageReceived', (filePath) => {
                    logger.info(`Image received from friend: ${filePath}`);
                    
                    // Define the path to the received image
                    const imagePath = `/images/active/received_image.jpg`;
                    logger.info(`Sending image path to frontend: ${imagePath}`);

                    // Respond to the frontend with the image path and WebSocket port
                    res.json({ imagePath, websocketPort: WEBSOCKET_PORT });
                });
            } else {
                logger.warn('Listener for imageReceived event already exists.');
            }
        } catch (error) {
            logger.error('Error sending prompt:', error);
            res.status(500).json({ error: 'Error sending prompt.' });
        }
    });

    // WebSocket event listeners
    io.on('connection', (socket) => {
        logger.info('Frontend connected.');
        socket.on('disconnect', () => logger.info('Frontend disconnected.'));
    });

    // Global error handler middleware
    app.use(errorHandler);

    // Gracefully shutdown the server on SIGINT (Ctrl+C)
    process.on('SIGINT', () => {
        logger.info('Received SIGINT. Closing server...');
        io.close(() => { // Close WebSocket server first
            server.close(() => { // Then close the HTTP server
                logger.info('Server closed.');
                process.exit(0); // Exit process after shutdown
            });
        });
    });
}

// Start the server
startServer();
