import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import { body, validationResult } from 'express-validator';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import sendPromptToFriend from './promptSender.js';
import receiveImage from './receiveImage.js';
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
    const PORT = RECEIVE_PROMPT_PORT; // Fixed HTTP port for sending prompts
    const WEBSOCKET_PORT = 8081; // Fixed WebSocket port
    logger.info(`Using fixed ports: HTTP - ${PORT}, WebSocket - ${WEBSOCKET_PORT}`);

    server = http.createServer(app);
    io = new Server(server, { cors: { origin: "*" } });
    logger.info('HTTP and WebSocket servers created.');

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

    app.use(express.json());
    logger.info('JSON body parser middleware added.');

    app.use('/static', express.static(path.join(__dirname, '../frontend/static')));
    app.use('/images', express.static(path.join(__dirname, '../images')));
    logger.info('Static file serving middleware added.');

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
        try {
            logger.info(`Received prompt: ${prompt}`);
            await sendPromptToFriend(prompt);
            logger.info('Prompt forwarded to friend.');

            const socketId = req.headers['socket-id']; // Get the socket ID from the request headers

            receiveImage.once('imageReceived', (filePath) => {
                logger.info(`Image received from friend: ${filePath}`);
                const imagePath = `/images/${path.basename(filePath)}`;
                logger.info(`Sending image path to frontend: ${imagePath}`);
                res.json({ imagePath });
                logger.info(`Emitting 'imageUpdated' event to socket ID: ${socketId}`);
                io.to(socketId).emit('imageUpdated', { imagePath }); // Notify the specific client via WebSocket
                logger.info(`WebSocket message 'imageUpdated' sent to socket ID: ${socketId} with path: ${imagePath}`);
            });
        } catch (error) {
            logger.error('Error sending prompt:', error);
            res.status(500).json({ error: 'Error sending prompt.' });
        }
    });

    io.on('connection', (socket) => {
        logger.info('Frontend connected.');
        socket.on('disconnect', () => logger.info('Frontend disconnected.'));
    });

    app.use(errorHandler);
    logger.info('Error handler middleware added.');

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