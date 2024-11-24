import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import { body, validationResult } from 'express-validator';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import sendPromptToFriend from './promptSender.js';
import { EventEmitter } from 'events';
import errorHandler from './middleware/errorHandler.js';
import logger from './logger.js';
import { RECEIVE_PROMPT_HOST, RECEIVE_PROMPT_PORT } from './config/settings.js';

const app = express();
let server;
let io;

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const receiveImageEmitter = new EventEmitter();

async function startServer() {
    logger.info('Starting server setup...');
    const PORT = RECEIVE_PROMPT_PORT; // HTTP port

    // HTTP Server setup
    server = http.createServer(app);
    io = new Server(server, { cors: { origin: "*" } });

    server.listen(PORT, () => {
        logger.info(`HTTP and WebSocket server running at http://${RECEIVE_PROMPT_HOST}:${PORT}`);
    }).on('error', (err) => {
        logger.error('Error starting HTTP server:', err);
        process.exit(1);
    });

    // Middleware
    app.use(express.json());
    app.use('/static', express.static(path.join(__dirname, '../frontend/static')));
    app.use('/images', express.static('C:\\Apps\\LazyEnder\\images', {
        maxAge: '1d',
        setHeaders: (res, filePath) => {
            res.set('Access-Control-Allow-Origin', '*');
            logger.info(`Serving file from: ${filePath}`);
        }
    }));

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

        // Check if server is running
        if (!server || !server.listening) {
            logger.error('Server is not running. Cannot process request.');
            return res.status(503).json({ error: 'Server not running.' });
        }

        try {
            await sendPromptToFriend(prompt);
            logger.info('Prompt forwarded to the external service.');

            const imageReceivedHandler = (filePath) => {
                logger.info(`Image received from friend: ${filePath}`);
                const imagePath = `/images/${path.basename(filePath)}`;
                logger.info(`Sending image path to frontend: ${imagePath}`);
                res.json({ imagePath });
                logger.info(`Emitting 'imageUpdated' event to socket ID: ${socketId}`);
                io.to(socketId).emit('imageUpdated', { imagePath }); // Notify the specific client via WebSocket
                logger.info(`WebSocket message 'imageUpdated' sent to socket ID: ${socketId} with path: ${imagePath}`);
            };

            // Register the imageReceived handler
            receiveImageEmitter.once('imageReceived', imageReceivedHandler);

        } catch (error) {
            logger.error('Error processing prompt:', error);
            res.status(500).json({ error: 'Error processing prompt.' });
        }
    });

    io.on('connection', (socket) => {
        logger.info(`Frontend connected (Socket ID: ${socket.id})`);

        // Check if client is connected before sending messages
        socket.on('imageRequest', (data) => {
            if (socket.connected) {
                sendPromptToFriend(data.prompt);
            }
        });

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
