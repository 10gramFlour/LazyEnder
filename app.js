import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import logger from './backend/logger.js';
import { exec } from 'child_process';
import kill from 'tree-kill';

// Get the directory of the current script file
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
logger.debug(`__filename: ${__filename}`);
logger.debug(`__dirname: ${__dirname}`);

// Function to validate and sanitize script paths
function validateScriptPath(scriptPath) {
    logger.debug(`Validating script path: ${scriptPath}`);
    if (!path.isAbsolute(scriptPath)) {
        const errorMessage = `Invalid script path: ${scriptPath}`;
        logger.error(errorMessage);
        throw new Error(errorMessage);
    }
    logger.debug(`Script path validated: ${scriptPath}`);
    return scriptPath;
}

// Define paths for the backend and receive image server scripts
const serverScript = validateScriptPath(path.join(__dirname, 'backend', 'server.js'));
const receiveImageScript = validateScriptPath(path.join(__dirname, 'backend', 'receiveImage.js'));
logger.debug(`serverScript path: ${serverScript}`);
logger.debug(`receiveImageScript path: ${receiveImageScript}`);

let serverProcesses = {
    backendServer: null,
    receiveImageServer: null,
};

// Function to start a server using Node.js child process
function startServer(scriptPath, serverName) {
    logger.debug(`Attempting to start server: ${serverName} with script: ${scriptPath}`);
    if (serverProcesses[serverName]) {
        logger.warn(`${serverName} is already running (PID: ${serverProcesses[serverName].pid}).`);
        return null;
    }

    const serverProcess = exec(`node ${scriptPath}`, (error, stdout, stderr) => {
        if (error) {
            logger.error(`Error starting ${serverName}: ${error}`);
            return;
        }
        if (stderr) {
            logger.error(`${serverName} stderr: ${stderr}`);
            return;
        }
        logger.info(`${serverName} stdout: ${stdout}`);
    });

    serverProcess.on('exit', (code) => {
        logger.info(`${serverName} exited with code ${code}`);
        serverProcesses[serverName] = null;
    });

    serverProcesses[serverName] = serverProcess;
    logger.info(`${serverName} started with PID: ${serverProcess.pid}`);
    return serverProcess;
}

// Stop a server by its process
function stopServer(serverName) {
    logger.debug(`Attempting to stop server: ${serverName}`);
    const processToKill = serverProcesses[serverName];
    if (!processToKill) {
        logger.warn(`${serverName} is not running.`);
        return;
    }

    kill(processToKill.pid, 'SIGTERM', (err) => {
        if (err) {
            logger.error(`Failed to stop ${serverName}: ${err}`);
        } else {
            logger.info(`${serverName} stopped successfully.`);
            serverProcesses[serverName] = null;
        }
    });
}

// Start the server scripts
logger.debug('Starting receiveImageServer...');
startServer(receiveImageScript, 'receiveImageServer');
logger.debug('Starting backendServer...');
startServer(serverScript, 'backendServer');

// Clean up servers on application termination
process.on('SIGINT', async () => {
    logger.info('SIGINT received. Closing servers...');
    await stopServers([serverProcesses.backendServer, serverProcesses.receiveImageServer]);
    logger.info('All servers closed. Exiting application.');
    process.exit(0);
});

// Function to terminate running servers
async function stopServers(servers) {
    logger.debug('Stopping servers...');
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
            logger.error(`Failed to kill ${serverName} (PID: ${pid}): ${err}`);
            reject(err);
        });
    });
}