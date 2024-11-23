import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import logger from './backend/logger.js';
import { exec } from 'child_process';
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
const findFreePortScript = validateScriptPath(path.join(__dirname, 'backend', 'findFreePort.js'));

let serverProcesses = {
    backendServer: null,
    receiveImageServer: null,
};

// Function to start a server using Node.js child process
function startServer(scriptPath, serverName) {
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

// Call findFreePort.js to find a free port and write it to the configuration file
exec(`node ${findFreePortScript}`, (error, stdout, stderr) => {
    if (error) {
        logger.error(`Error executing findFreePort.js: ${error}`);
        return;
    }
    if (stderr) {
        logger.error(`stderr: ${stderr}`);
        return;
    }
    logger.info(`stdout: ${stdout}`);

    // Stop existing servers before starting new ones
    stopServer('backendServer');
    stopServer('receiveImageServer');

    // Start the other server scripts after finding a free port
    startServer(receiveImageScript, 'receiveImageServer');
    startServer(serverScript, 'backendServer');
});

// Clean up servers on application termination
process.on('SIGINT', async () => {
    logger.info('Closing servers...');
    await stopServers([serverProcesses.backendServer, serverProcesses.receiveImageServer]);
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