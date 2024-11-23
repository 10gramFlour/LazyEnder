import net from 'net';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { RECEIVE_IMAGE_HOST, RECEIVE_IMAGE_PORT } from './config/settings.js';
import { WEBSOCKET_PORT } from './config/websocket.js'; // Importieren Sie den WebSocket-Port
import logger from './logger.js';
import EventEmitter from 'events';
import { WebSocketServer } from 'ws';

// Get the directory name
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const receiveImageEmitter = new EventEmitter();

let serverStarted = false;
let server; // Stellen Sie sicher, dass die Variable `server` hier deklariert wird

async function startServer() {
    if (serverStarted) {
        logger.info('Server is already running.');
        return;
    }
    serverStarted = true;

    try {
        const wss = new WebSocketServer({ port: WEBSOCKET_PORT });
        logger.info(`WebSocket Server running on port ${WEBSOCKET_PORT}`);

        server = net.createServer((socket) => { // Initialisieren Sie die Variable `server` hier
            logger.info('Connected to image sender');

            let dataBuffer = Buffer.alloc(0);

            socket.on('data', (data) => {
                logger.info(`Receiving image data chunk of size ${data.length} bytes...`);
                dataBuffer = Buffer.concat([dataBuffer, data]);
                logger.info(`Current buffer size: ${dataBuffer.length} bytes`);
            });

            socket.on('end', async () => {
                logger.info('Image data received completely.');
                logger.info(`Total received data size: ${dataBuffer.length} bytes`);

                const imagesDir = 'C:\\Apps\\LazyEnder\\images';
                const activeDir = path.join(imagesDir, 'active');
                const archiveDir = path.join(imagesDir, 'archive');

                try {
                    if (!fs.existsSync(activeDir)) {
                        fs.mkdirSync(activeDir, { recursive: true });
                        logger.info(`Created directory: ${activeDir}`);
                    }

                    if (!fs.existsSync(archiveDir)) {
                        fs.mkdirSync(archiveDir, { recursive: true });
                        logger.info(`Created directory: ${archiveDir}`);
                    }

                    // Move the current active image to the archive
                    const activeImagePath = path.join(activeDir, 'received_image.jpg');
                    if (fs.existsSync(activeImagePath)) {
                        const uniqueFilename = `received_image_${uuidv4()}.jpg`;
                        const archiveImagePath = path.join(archiveDir, uniqueFilename);
                        fs.renameSync(activeImagePath, archiveImagePath);
                        logger.info(`Moved ${activeImagePath} to ${archiveImagePath}`);
                    }

                    // Save the new image as received_image.jpg in the active directory
                    await fs.promises.writeFile(activeImagePath, dataBuffer);
                    logger.info(`Image saved to ${activeImagePath} (Binary)`);

                    // Send WebSocket message to notify clients
                    wss.clients.forEach(client => {
                        if (client.readyState === WebSocket.OPEN) {
                            client.send(JSON.stringify({ imagePath: '/images/active/received_image.jpg' }));
                        }
                    });
                } catch (err) {
                    logger.error('Error handling the image directory or file:', err);
                }
            });

            socket.on('close', () => {
                logger.info('Image sender disconnected');
            });

            socket.on('error', (err) => {
                logger.error('Socket error:', err);
            });
        });

        server.listen(RECEIVE_IMAGE_PORT, RECEIVE_IMAGE_HOST, () => {
            logger.info(`Image Receiver running on ${RECEIVE_IMAGE_HOST}:${RECEIVE_IMAGE_PORT}`);
        });

        server.on('error', (err) => {
            logger.error('Error starting the server:', err);
        });
    } catch (err) {
        logger.error('Error starting the server:', err);
    }
}

startServer();

export default receiveImageEmitter;