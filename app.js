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

let backendServerStarted = false;
let receiveImageServerStarted = false;

// Function to start a server using Node.js child process
function startServer(scriptPath, serverName) {
    if ((serverName === 'Backend Server' && backendServerStarted) || 
        (serverName === 'Receive Image Server' && receiveImageServerStarted)) {
        logger.warn(`${serverName} is already started.`);
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
        if (serverName === 'Backend Server') {
            backendServerStarted = false;
        } else if (serverName === 'Receive Image Server') {
            receiveImageServerStarted = false;
        }
    });

    if (serverName === 'Backend Server') {
        backendServerStarted = true;
    } else if (serverName === 'Receive Image Server') {
        receiveImageServerStarted = true;
    }

    return serverProcess;
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

    // Start the other server scripts after finding a free port
    startServer(receiveImageScript, 'Receive Image Server');
    startServer(serverScript, 'Backend Server');
});