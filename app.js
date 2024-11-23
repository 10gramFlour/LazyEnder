import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import logger from './backend/logger.js';
import { spawn } from 'child_process';
import kill from 'tree-kill';

// Get the directory of the current script file
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Function to validate and sanitize script paths
function validateScriptPath(scriptPath) {
    if (!path.isAbsolute(scriptPath)) {
        throw new Error(`Invalid script path: ${scriptPath}`);
    }
    return scriptPath;
}

// Define paths for the backend and receive image server scripts
const serverScript = validateScriptPath(path.join(__dirname, 'backend', 'server.js'));
const receiveImageScript = validateScriptPath(path.join(__dirname, 'backend', 'receiveImage.js'));

let backendServerStarted = false;
let receiveImageServerStarted = false;

// Function to start a server using Node.js child process
function startServer(scriptPath, serverName) {
    if ((serverName === 'Backend Server' && backendServerStarted) || 
        (serverName === 'Receive Image Server' && receiveImageServerStarted)) {
        logger.warn(`${serverName} is already started.`);
        return null;
    }

    logger.info(`Starting ${serverName}...`);
    const server = spawn('node', [scriptPath]);

    server.stdout.on('data', (data) => {
        logger.info(`${serverName} stdout: ${data}`);
    });

    server.stderr.on('data', (data) => {
        logger.error(`${serverName} stderr: ${data}`);
    });

    server.on('error', (err) => {
        logger.error(`${serverName} failed to start: ${err}`);
    });

    server.on('close', (code) => {
        logger.info(`${serverName} exited with code ${code}`);
        if (serverName === 'Backend Server') backendServerStarted = false;
        if (serverName === 'Receive Image Server') receiveImageServerStarted = false;
    });

    if (serverName === 'Backend Server') backendServerStarted = true;
    if (serverName === 'Receive Image Server') receiveImageServerStarted = true;

    return server;
}

// Start both backend and image receiver servers
const backendServer = startServer(serverScript, 'Backend Server');
const receiveImageServer = startServer(receiveImageScript, 'Receive Image Server');

// Clean up servers on application termination
process.on('SIGINT', async () => {
    logger.info('Closing servers...');
    await stopServers([backendServer, receiveImageServer]);
    logger.info('All servers closed. Exiting application.');
    process.exit(0);
});

// Function to terminate running servers
async function stopServers(servers) {
    for (const server of servers) {
        if (server && server.pid) {
            if (server.exitCode !== null) {
                logger.info(`${server.serverName} has already exited.`);
                continue;
            }
            try {
                await killProcess(server.pid, server.serverName);
            } catch (err) {
                logger.error(`Error stopping ${server.serverName}:`, err);
            }
        } else {
            logger.info(`Process ${server?.serverName || 'unknown'} is not running.`);
        }
    }
}

// Helper function to kill a process by PID
function killProcess(pid, serverName) {
    return new Promise((resolve, reject) => {
        logger.info(`Attempting to kill ${serverName} (PID: ${pid})...`);
        kill(pid, 'SIGTERM', async (err) => {
            if (!err) {
                logger.info(`${serverName} successfully terminated.`);
                return resolve();
            }
            reject(err);
        });
    });
}