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
let server;
let io;

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function startServer() {
    logger.info('Starting server setup...');
    const PORT = await portfinder.getPortPromise({ port: 3002, stopPort: 3999 });
    const WEBSOCKET_PORT = await portfinder.getPortPromise({ port: 8081, stopPort: 8999 });
    logger.info(`Found available ports: HTTP - ${PORT}, WebSocket - ${WEBSOCKET_PORT}`);

    server = http.createServer(app);
    io = new Server(server, { port: WEBSOCKET_PORT });
    logger.info('HTTP and WebSocket servers created.');

    server.listen(PORT, () => logger.info(`Server running at http://localhost:${PORT}`))
        .on('error', (err) => {
            logger.error('Error starting server:', err);
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

            if (receiveImage.listenerCount('imageReceived') === 0) {
                receiveImage.once('imageReceived', (filePath) => {
                    logger.info(`Image received from friend: ${filePath}`);
                    const imagePath = `/images/active/received_image.jpg`;
                    logger.info(`Sending image path to frontend: ${imagePath}`);
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
