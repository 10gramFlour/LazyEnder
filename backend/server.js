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

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Get the directory name
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Middleware to parse JSON bodies
app.use(express.json());

// Serve static files (CSS, JS, images)
app.use('/static', express.static(path.join(__dirname, '../frontend/static')));

// Serve index.html
app.get('/', (res) => {
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
        await sendPromptToFriend(prompt);
        logger.info('Prompt forwarded to friend.');

        // Listen for the image from receiveImage.js
        if (receiveImage.listenerCount('imageReceived') === 0) {
            receiveImage.once('imageReceived', (base64Image) => {
                logger.info('Image received from friend.');
                res.json({ image: base64Image }); // Send the image to the frontend
            });
        }
    } catch (error) {
        logger.error('Error sending prompt:', error);
        res.status(500).json({ error: 'Error sending prompt.' });
    }
});

// WebSocket Connection
io.on('connection', (socket) => {
    logger.info('Frontend connected.');

    socket.on('disconnect', () => {
        logger.info('Frontend disconnected.');
    });
});

// Use the error handling middleware
app.use(errorHandler);

const PORT = process.env.PORT || 3001;

let serverStarted = false;

function startServer() {
    if (serverStarted) return;
    serverStarted = true;

    server.listen(PORT, (err) => {
        if (err) {
            logger.error(`Error starting server: ${err.message}`);
            process.exit(1);
        } else {
            logger.info(`Server running at http://localhost:${PORT}`);
        }
    });

    // Graceful shutdown on SIGINT (Ctrl+C)
    process.on('SIGINT', () => {
        logger.info('Received SIGINT. Closing server gracefully...');
        io.close(() => {
            logger.info('WebSocket server closed.');
            server.close(() => {
                logger.info('HTTP server closed.');
                process.exit(0); // Exit the process
            });
        });
    });
}

startServer();