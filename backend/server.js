import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import portfinder from 'portfinder';
import { body, validationResult } from 'express-validator';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import sendPromptToFriend from './promptSender.js';
import errorHandler from './middleware/errorHandler.js';
import logger from './logger.js';

const app = express();
let server;
let io;

// Get the directory name
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Find an available port
async function startServer() {
    const PORT = await portfinder.getPortPromise({ port: 3001, stopPort: 3999 });

    server = http.createServer(app);
    io = new Server(server);

    server.listen(PORT, () => logger.info(`Server running at http://localhost:${PORT}`))
        .on('error', (err) => {
            logger.error('Error starting server:', err);
            process.exit(1);
        });

    app.use(express.json());
    app.use('/static', express.static(path.join(__dirname, '../frontend/static')));
    app.get('/', (req, res) => res.sendFile(path.join(__dirname, '../frontend/index.html')));

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
            await sendPromptToFriend(prompt);
            logger.info('Prompt forwarded to friend.');
            res.json({ status: 'Prompt sent successfully.' });
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
