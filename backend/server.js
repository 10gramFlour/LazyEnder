import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import { body, validationResult } from 'express-validator';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import sendPromptToFriend from './promptSender.js';
import receiveImageEmitter from './receiveImage.js';
import errorHandler from './middleware/errorHandler.js';
import logger from './logger.js';
import { RECEIVE_PROMPT_HOST, RECEIVE_PROMPT_PORT } from './config/settings.js';

const app = express();
let server;
let io;

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function startServer() {
    logger.info('Starting server setup...');
    const PORT = RECEIVE_PROMPT_PORT; // HTTP port
    const WEBSOCKET_PORT = 8081; // WebSocket port

    server = http.createServer(app);
    io = new Server(server, { cors: { origin: "*" } });

    server.listen(PORT, () => logger.info(`HTTP server running at http://${RECEIVE_PROMPT_HOST}:${PORT}`))
        .on('error', (err) => {
            logger.error('Error starting HTTP server:', err);
            process.exit(1);
        });

    io.listen(WEBSOCKET_PORT, () => logger.info(`WebSocket server running at ws://${RECEIVE_PROMPT_HOST}:${WEBSOCKET_PORT}`))
        .on('error', (err) => {
            logger.error('Error starting WebSocket server:', err);
            process.exit(1);
        });

    // Middleware
    app.use(express.json());
    app.use('/static', express.static(path.join(__dirname, '../frontend/static')));
    app.use('/images', express.static('C:\\Apps\\LazyEnder\\images')); // Statically serve images
    logger.info('Middleware added for JSON parsing and static files.');

    // Routes
    app.get('/', (_, res) => {
        logger.info('Serving index.html');
        res.sendFile(path.join(__dirname, '../frontend/index.html'));
    });

    app.post('/sendPrompt', [
        body('prompt').isString().trim().escape()
    ], async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            logger.error('Validation error:', errors.array());
            return res.status(400).json({ error: 'Invalid input.' });
        }

        const { prompt } = req.body;
        const socketId = req.headers['socket-id'];

        if (!socketId) {
            logger.error('Socket ID missing in request headers.');
            return res.status(400).json({ error: 'Socket ID missing.' });
        }

        logger.info(`Received prompt: "${prompt}" from socket ID: ${socketId}`);

        try {
            await sendPromptToFriend(prompt);
            logger.info('Prompt forwarded to the external service.');

            const imageReceivedHandler = (filePath) => {
                logger.info(`Image received: ${filePath}`);
                const imagePath = `/images/${path.basename(filePath)}`;

                // Send response to the HTTP client
                res.json({ imagePath });

                // Notify specific WebSocket client
                logger.info(`Notifying client (Socket ID: ${socketId}) with image path: ${imagePath}`);
                io.to(socketId).emit('imageUpdated', { imagePath });

                // Remove the event listener after the image is processed
                receiveImageEmitter.off('imageReceived', imageReceivedHandler);
            };

            receiveImageEmitter.on('imageReceived', imageReceivedHandler);
        } catch (error) {
            logger.error('Error processing prompt:', error);
            res.status(500).json({ error: 'Error processing prompt.' });
        }
    });

    io.on('connection', (socket) => {
        logger.info(`Frontend connected (Socket ID: ${socket.id})`);

        socket.on('disconnect', () => {
            logger.info(`Frontend disconnected (Socket ID: ${socket.id})`);
        });
    });

    app.use(errorHandler);

    // Graceful shutdown
    process.on('SIGINT', () => {
        logger.info('Received SIGINT. Shutting down gracefully...');
        io.close(() => {
            server.close(() => {
                logger.info('Servers closed. Exiting process.');
                process.exit(0);
            });
        });
    });
}

startServer();
