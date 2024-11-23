// promptSender.js
import net from 'net';
import { RECEIVE_PROMPT_HOST, RECEIVE_PROMPT_PORT } from './config/settings.js';
import validator from 'validator';

// Function to validate and sanitize the prompt
const validateAndSanitizePrompt = (prompt) => {
    console.log('Validating and sanitizing prompt:', prompt);
    if (typeof prompt !== 'string' || validator.isEmpty(prompt)) {
        console.error('Validation failed: Prompt must be a non-empty string.');
        throw new Error('Invalid prompt: Prompt must be a non-empty string.');
    }
    const sanitizedPrompt = validator.escape(prompt);
    console.log('Sanitized prompt:', sanitizedPrompt);
    return sanitizedPrompt;
};

// Function to send prompt to friend
const sendPromptToFriend = (prompt) => {
    return new Promise((resolve, reject) => {
        try {
            console.log('Starting to send prompt to friend...');
            const sanitizedPrompt = validateAndSanitizePrompt(prompt);
            const client = new net.Socket();

            console.log(`Attempting to connect to ${RECEIVE_PROMPT_HOST}:${RECEIVE_PROMPT_PORT}...`);
            client.connect(RECEIVE_PROMPT_PORT, RECEIVE_PROMPT_HOST, () => {
                console.log('Connected to friend, sending prompt...');
                client.write(sanitizedPrompt);
            });

            client.on('data', (data) => {
                console.log('Received data from friend:', data.toString());
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
            console.error('Error occurred while sending prompt:', error.message);
            reject(error.message);
        }
    });
};

export default sendPromptToFriend;