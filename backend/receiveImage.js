import fs from 'fs';
import { WebSocketServer } from 'ws';
import portfinder from 'portfinder';
import EventEmitter from 'events';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import logger from './logger.js';

const receiveImageEmitter = new EventEmitter();
let serverStarted = false;

// Function to start the WebSocket server
async function startServer() {
    if (serverStarted) return logger.info('Server is already running.');
    serverStarted = true;

    const PORT = await portfinder.getPortPromise({ port: 5000, stopPort: 5999 });

    const imageServer = new WebSocketServer({ port: PORT });
    logger.info(`Image Receiver running on ws://localhost:${PORT}`);

    imageServer.on('connection', (socket) => {
        logger.info('Connected to image sender');
        socket.on('message', async (data) => {
            const imagesDir = 'C:\\Apps\\LazyEnder\\images';
            if (!fs.existsSync(imagesDir)) fs.mkdirSync(imagesDir, { recursive: true });
            const uniqueFilename = `received_image_${uuidv4()}.jpg`;
            const filePath = path.join(imagesDir, uniqueFilename);

            try {
                const base64Pattern = /^data:image\/[a-zA-Z]+;base64,/;
                if (base64Pattern.test(data)) {
                    const base64Image = data.split(';base64,').pop();
                    await fs.promises.writeFile(filePath, base64Image, 'base64');
                    logger.info(`Image saved to ${filePath}`);
                    receiveImageEmitter.emit('imageReceived', base64Image);
                } else {
                    await fs.promises.writeFile(filePath, data);
                    logger.info(`Image saved to ${filePath}`);
                    receiveImageEmitter.emit('imageReceived', data.toString('base64'));
                }
            } catch (err) {
                logger.error('Error saving image:', err);
            }
        });

        socket.on('close', () => logger.info('Image sender disconnected.'));
        socket.on('error', (err) => logger.error('Socket error:', err));
    });

    imageServer.on('error', (err) => logger.error('Error starting server:', err));
}

startServer();
export default receiveImageEmitter;
