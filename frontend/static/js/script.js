// Establish WebSocket connection
const socket = io();  // Production environment
console.log('Attempting to establish WebSocket connection...');

// Update status badge on connection
socket.on('connect', () => {
    console.log('WebSocket connection established successfully.');
    const statusBadge = document.getElementById('statusBadge');
    statusBadge.textContent = 'Connected';
    statusBadge.className = 'connected';
});

// Update status badge on disconnection
socket.on('disconnect', () => {
    console.log('WebSocket connection lost.');
    const statusBadge = document.getElementById('statusBadge');
    statusBadge.textContent = 'Disconnected';
    statusBadge.className = 'disconnected';
});

// Handle form submission
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM fully loaded and parsed.');

    const promptForm = document.getElementById('promptForm');
    if (promptForm) {
        console.log('Found promptForm element:', promptForm);

        promptForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            console.log('Form submit event triggered.');

            const prompt = document.getElementById('prompt').value.trim();
            console.log('Prompt value:', prompt);

            if (prompt) {
                console.log('Sending prompt to server:', prompt);
                // Show loading indicator
                document.getElementById('loading').style.display = 'block';
                document.getElementById('error').textContent = ''; // Clear previous error messages

                try {
                    console.log('Initiating fetch request to /sendPrompt endpoint.');
                    const response = await fetch('/sendPrompt', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({ prompt })
                    });

                    console.log('Response received from server.');
                    const result = await response.json();
                    console.log('Result from server:', result);

                    if (response.ok) {
                        console.log('Received image path from server:', result.imagePath);
                        // Hide loading indicator
                        document.getElementById('loading').style.display = 'none';

                        // Update the active image
                        const activeImage = document.getElementById('activeImage');
                        activeImage.src = result.imagePath;
                        console.log('Active image updated:', activeImage.src);

                        // Show download button
                        const downloadButton = document.getElementById('downloadButton');
                        downloadButton.style.display = 'block';
                        downloadButton.onclick = () => {
                            const a = document.createElement('a');
                            a.href = activeImage.src;
                            a.download = 'generated_image.jpg';
                            a.click();
                            console.log('Download initiated for:', activeImage.src);
                        };

                        // WebSocket connection to receive updates
                        console.log('Establishing WebSocket connection to receive updates.');
                        const socket = new WebSocket(`ws://localhost:${result.websocketPort}`); // Use the dynamic WebSocket port

                        socket.addEventListener('open', () => {
                            console.log('WebSocket connection established for updates.');
                        });

                        socket.addEventListener('message', (event) => {
                            const data = JSON.parse(event.data);
                            console.log('WebSocket message received:', data);

                            if (data.imagePath) {
                                const activeImage = document.getElementById('activeImage');
                                activeImage.src = data.imagePath;
                                console.log('Active image updated via WebSocket:', activeImage.src);
                            }
                        });

                        socket.addEventListener('error', (error) => {
                            console.error('WebSocket error:', error);
                            document.getElementById('error').textContent = 'WebSocket error. Please try again later.';
                        });

                        socket.addEventListener('close', () => {
                            console.log('WebSocket connection closed.');
                        });
                    } else {
                        console.error('Error from server:', result.error);
                        document.getElementById('error').textContent = result.error;
                    }
                } catch (error) {
                    console.error('Error occurred during fetch request:', error);
                    document.getElementById('error').textContent = 'An error occurred. Please try again later.';
                }
            } else {
                console.error('Prompt cannot be empty.');
                document.getElementById('error').textContent = 'Prompt cannot be empty.';
            }
        });
    } else {
        console.error('promptForm element not found.');
    }
});

// Handle WebSocket errors
socket.on('error', (error) => {
    console.error('WebSocket error:', error);
    document.getElementById('error').textContent = 'WebSocket error. Please try again later.';
});

// Handle WebSocket connection errors
socket.on('connect_error', (error) => {
    console.error('WebSocket connection error:', error);
    document.getElementById('error').textContent = 'Unable to connect to the server. Please check your internet connection and try again.';
});

// Handle WebSocket reconnection attempts
socket.on('reconnect_attempt', () => {
    console.log('Attempting to reconnect WebSocket...');
    const statusBadge = document.getElementById('statusBadge');
    statusBadge.textContent = 'Reconnecting...';
    statusBadge.className = 'reconnecting';
});

// Handle WebSocket reconnection success
socket.on('reconnect', () => {
    console.log('WebSocket reconnected successfully.');
    const statusBadge = document.getElementById('statusBadge');
    statusBadge.textContent = 'Reconnected';
    statusBadge.className = 'connected';
});

// Handle WebSocket reconnection failure
socket.on('reconnect_failed', () => {
    console.error('WebSocket reconnection failed.');
    const statusBadge = document.getElementById('statusBadge');
    statusBadge.textContent = 'Reconnection Failed';
    statusBadge.className = 'disconnected';
    document.getElementById('error').textContent = 'Failed to reconnect to the server. Please refresh the page or try again later.';
});