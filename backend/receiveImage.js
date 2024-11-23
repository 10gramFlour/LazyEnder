// promptSender.js
import net from 'net';
import { RECEIVE_PROMPT_HOST, RECEIVE_PROMPT_PORT } from './config/settings.js';
import validator from 'validator';

// Function to validate and sanitize the prompt
const validateAndSanitizePrompt = (prompt) => {
    if (typeof prompt !== 'string' || validator.isEmpty(prompt)) {
        throw new Error('Invalid prompt: Prompt must be a non-empty string.');
    }
    return validator.escape(prompt);
};

// Function to send prompt to friend
const sendPromptToFriend = (prompt) => {
    return new Promise((resolve, reject) => {
        try {
            const sanitizedPrompt = validateAndSanitizePrompt(prompt);
            const client = new net.Socket();

            client.connect(RECEIVE_PROMPT_PORT, RECEIVE_PROMPT_HOST, () => {
                console.log('Connected to friend, sending prompt...');
                client.write(sanitizedPrompt);
            });

            client.on('data', (data) => {
                console.log('Prompt successfully sent:', data.toString());
                resolve(data.toString());
                // Do not close the connection immediately
                // client.destroy(); // Close the connection
            });

            client.on('error', (err) => {
                console.error('Failed to connect to friend:', err.message);
                reject(new Error('Connection error: ' + err.message));
                client.destroy();
            });

            client.on('close', () => {
                console.log('Connection closed');
            });
        } catch (error) {
            reject(error.message);
        }
    });
};

export default sendPromptToFriend;