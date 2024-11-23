// backend/findFreePort.js
import fs from 'fs';
import path from 'path';
import portfinder from 'portfinder';

const configPath = path.join(__dirname, 'config', 'websocket.js');

async function findFreePort() {
    try {
        const port = await portfinder.getPortPromise({ port: 8080, stopPort: 8999 });
        const configContent = `export const WEBSOCKET_PORT = ${port};\n`;
        fs.writeFileSync(configPath, configContent);
        console.log(`WebSocket Port ${port} written to ${configPath}`);
    } catch (err) {
        console.error('Error finding free port:', err);
    }
}

findFreePort();