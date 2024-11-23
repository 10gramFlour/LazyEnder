import { spawn, exec } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import logger from './backend/logger.js';
import kill from 'tree-kill';

// Get the directory name
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Validate and sanitize script paths
function validateScriptPath(scriptPath) {
    if (!path.isAbsolute(scriptPath)) {
        throw new Error(`Invalid script path: ${scriptPath}`);
    }
    return scriptPath;
}

// Start the individual scripts
const serverScript = validateScriptPath(path.join(__dirname, 'backend', 'server.js')); // Backend server (Express + WebSocket)
const receiveImageScript = validateScriptPath(path.join(__dirname, 'backend', 'receiveImage.js')); // Image receiver

let backendServerStarted = false;
let receiveImageServerStarted = false;

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
    });

    server.serverName = serverName;
    server.pid = server.pid;

    if (serverName === 'Backend Server') {
        backendServerStarted = true;
    } else if (serverName === 'Receive Image Server') {
        receiveImageServerStarted = true;
    }

    return server;
}

const backendServer = startServer(serverScript, 'Backend Server');
const receiveImageServer = startServer(receiveImageScript, 'Receive Image Server');

// Stop all servers on application exit
process.on('SIGINT', async () => {
    logger.info('Closing servers...');
    await stopServers([backendServer, receiveImageServer]);
    logger.info('All servers closed. Exiting application.');
    process.exit(0);
});

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

function killProcess(pid, serverName) {
    return new Promise((resolve, reject) => {
        logger.info(`Attempting to kill ${serverName} (PID: ${pid})...`);

        // Use tree-kill for a graceful shutdown
        kill(pid, 'SIGTERM', async (err) => {
            if (!err) {
                logger.info(`${serverName} successfully terminated.`);
                return resolve();
            }

            // Fallback to taskkill on Windows if tree-kill fails
            if (process.platform === 'win32') {
                logger.warn(`tree-kill failed for ${serverName}, attempting taskkill...`);
                exec(`taskkill /PID ${pid} /T /F`, (taskKillErr, _stdout, stderr) => {
                    if (taskKillErr) {
                        logger.error(`Failed to kill ${serverName} with taskkill:`, stderr);        
                        return reject(taskKillErr);
                    }

                    logger.info(`${serverName} successfully killed using taskkill.`);
                    resolve();
                });
            } else {
                logger.error(`Failed to kill ${serverName}:`, err);
                reject(err);
            }
        });
    });
}