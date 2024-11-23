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

async function startServer() {
    if (serverStarted) {
        logger.info('Server is already running.');
        return;
    }
    serverStarted = true;

    try {
        const server = net.createServer((socket) => {
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
                    const activeFiles = fs.readdirSync(activeDir);
                    for (const file of activeFiles) {
                        const oldPath = path.join(activeDir, file);
                        const newPath = path.join(archiveDir, file);
                        fs.renameSync(oldPath, newPath);
                        logger.info(`Moved ${file} to archive`);
                    }

                    // Generate a unique filename for the received image
                    const uniqueFilename = `received_image_${uuidv4()}.jpg`;
                    let filePath = path.join(activeDir, uniqueFilename);

                    // Validate and sanitize incoming data
                    if (!Buffer.isBuffer(dataBuffer)) {
                        throw new Error('Invalid data format');
                    }

                    // Assume binary data and write it to the file
                    await fs.promises.writeFile(filePath, dataBuffer);
                    logger.info(`Image saved to ${filePath} (Binary)`);
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