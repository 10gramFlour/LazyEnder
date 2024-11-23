import fs from 'fs';
import WebSocket from 'ws';
import EventEmitter from 'events';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { v4 as uuidv4 } from 'uuid';
import settings from './config/settings.js';
import logger from './logger.js';

// Get the directory name
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const receiveImageEmitter = new EventEmitter();

async function startServer() {
    try {
        const RECEIVE_IMAGE_PORT = settings.RECEIVE_IMAGE_PORT;
        const imageServer = new WebSocket.Server({ host: settings.RECEIVE_IMAGE_HOST, port: RECEIVE_IMAGE_PORT });

        logger.info(`Image Receiver running on ws://${settings.RECEIVE_IMAGE_HOST}:${RECEIVE_IMAGE_PORT}`);

        imageServer.on('connection', (socket) => {
            logger.info('Connected to image sender');

            socket.on('message', async (data) => {
                logger.info('Image received');

                const imagesDir = 'C:\\Apps\\LazyEnder\\images';
                try {
                    if (!fs.existsSync(imagesDir)) {
                        fs.mkdirSync(imagesDir, { recursive: true });
                        logger.info(`Created directory: ${imagesDir}`);
                    }

                    // Generate a unique filename for the received image
                    const uniqueFilename = `received_image_${uuidv4()}.jpg`;
                    let filePath = path.join(imagesDir, uniqueFilename);

                    // Validate and sanitize incoming data
                    if (typeof data !== 'string' && !Buffer.isBuffer(data)) {
                        throw new Error('Invalid data format');
                    }

                    // Check if the data is Base64 encoded, if not assume binary data
                    const base64Pattern = /^data:image\/[a-zA-Z]+;base64,/;
                    if (base64Pattern.test(data)) {
                        try {
                            const imageData = JSON.parse(data);
                            if (typeof imageData.image !== 'string') {
                                throw new Error('Invalid image data');
                            }
                            const base64Image = imageData.image.split(';base64,').pop();
                            await fs.promises.writeFile(filePath, base64Image, 'base64');
                            logger.info(`Image saved to ${filePath} (Base64)`);
                            receiveImageEmitter.emit('imageReceived', base64Image);
                        } catch (e) {
                            logger.error('Error parsing Base64 image data:', e);
                        }
                    } else {
                        // Assume binary data if not Base64
                        await fs.promises.writeFile(filePath, data);
                        logger.info(`Image saved to ${filePath} (Binary)`);
                        receiveImageEmitter.emit('imageReceived', data.toString('base64'));
                    }
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

        imageServer.on('error', (err) => {
            logger.error('Error starting the server:', err);
        });
    } catch (err) {
        logger.error('Error starting the server:', err);
    }
}

startServer();

export default receiveImageEmitter;