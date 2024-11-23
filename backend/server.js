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

const app = express();
let server; // Stellen Sie sicher, dass die Variable `server` hier deklariert wird
let io;
let WEBSOCKET_PORT;

// Get the directory of the current script file
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Automatically find an available port
async function startServer() {
    const PORT = await portfinder.getPortPromise({ port: 3002, stopPort: 3999 });
    WEBSOCKET_PORT = await portfinder.getPortPromise({ port: 8080, stopPort: 8999 });

    server = http.createServer(app); // Initialisieren Sie die Variable `server` hier
    io = new Server(server);

    server.listen(PORT, () => logger.info(`Server running at http://localhost:${PORT}`))
        .on('error', (err) => {
            logger.error('Error starting server:', err);
            process.exit(1);
        });

    // Middleware to parse JSON bodies
    app.use(express.json());

    // Serve static files (CSS, JS, images)
    app.use('/static', express.static(path.join(__dirname, '../frontend/static')));
    app.use('/images', express.static(path.join(__dirname, '../images')));

    // Serve index.html
    app.get('/', (req, res) => {
        logger.info('Serving index.html');
        res.sendFile(path.join(__dirname, '../frontend/index.html'));
    });

    // Endpoint to receive prompt from frontend
    app.post('/sendPrompt', [
        body('prompt').isString().trim().escape()
    ], async (req, res) => {
        const errors = validationResult(req);
        
        if (!errors.isEmpty()) {
            logger.error('Validation error:', errors.array());
            return res.status(400).json({ error: 'Invalid input.' });
        }

        const { prompt } = req.body;
        try {
            logger.info(`Received prompt: ${prompt}`);
            await sendPromptToFriend(prompt);
            logger.info('Prompt forwarded to friend.');

            // Listen for the image from receiveImage.js
            if (receiveImage.listenerCount('imageReceived') === 0) {
                receiveImage.once('imageReceived', (filePath) => {
                    logger.info(`Image received from friend: ${filePath}`);
                    const imagePath = `/images/active/received_image.jpg`;
                    logger.info(`Sending image path to frontend: ${imagePath}`);
                    res.json({ imagePath, websocketPort: WEBSOCKET_PORT }); // Send the image path and WebSocket port to the frontend
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

    // Error handler middleware
    app.use(errorHandler);

    // Gracefully shutdown server
    process.on('SIGINT', () => {
        logger.info('Received SIGINT. Closing server...');
        io.close(() => {
            server.close(() => {
                logger.info('Server closed.');
                process.exit(0);
            });
        });
    });
}

startServer();