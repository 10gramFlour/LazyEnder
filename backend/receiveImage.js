import net from 'net';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { RECEIVE_IMAGE_HOST, RECEIVE_IMAGE_PORT } from './config/settings.js';
import logger from './logger.js';
import EventEmitter from 'events';

// Get the directory name
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const receiveImageEmitter = new EventEmitter();

let serverStarted = false;
let server;

async function startServer() {
    if (serverStarted) {
        logger.info('Server is already running.');
        return;
    }
    serverStarted = true;

    try {
        server = net.createServer((socket) => {
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
                const publicImagePath = '/images'; // URL path for the client

                try {
                    if (!fs.existsSync(imagesDir)) {
                        fs.mkdirSync(imagesDir, { recursive: true });
                        logger.info(`Created directory: ${imagesDir}`);
                    }

                    // Save the new image with a unique name in the images directory
                    const uniqueFilename = `received_image_${uuidv4()}.jpg`;
                    const imagePath = path.join(imagesDir, uniqueFilename);
                    const relativeImagePath = path.join(publicImagePath, uniqueFilename); // Client-accessible path

                    await fs.promises.writeFile(imagePath, dataBuffer);
                    logger.info(`Image saved to ${imagePath} (Binary)`);

                    // Emit event to notify the specific client
                    receiveImageEmitter.emit('imageReceived', relativeImagePath);
                    logger.info(`Event 'imageReceived' emitted with relative path: ${relativeImagePath}`);
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
            if (err.code === 'EADDRINUSE') {
                logger.error(`Port ${RECEIVE_IMAGE_PORT} is already in use.`);
            } else {
                logger.error('Error starting the server:', err);
            }
        });
    } catch (err) {
        logger.error('Error starting the server:', err);
    }
}

startServer();

export default receiveImageEmitter;
