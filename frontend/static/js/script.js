// Establish WebSocket connection
const socket = io();  // Production environment

// Handle form submission
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM fully loaded and parsed');

    const promptForm = document.getElementById('promptForm');
    const socket = io('http://localhost:8081'); // Use the fixed WebSocket port

    socket.on('connect', () => {
        console.log('WebSocket connection established');
        const statusBadge = document.getElementById('statusBadge');
        statusBadge.textContent = 'Connected';
        statusBadge.className = 'connected';
    });

    socket.on('disconnect', () => {
        console.log('WebSocket connection closed');
        const statusBadge = document.getElementById('statusBadge');
        statusBadge.textContent = 'Disconnected';
        statusBadge.className = 'disconnected';
    });

    socket.on('imageUpdated', (data) => {
        console.log('WebSocket message received:', data);
        if (data.imagePath) {
            const activeImage = document.getElementById('activeImage');
            activeImage.src = data.imagePath;
            console.log('Active image updated via WebSocket:', activeImage.src);
        } else {
            console.error('No imagePath received in WebSocket message');
        }
    });

    socket.on('error', (error) => {
        console.error('WebSocket error:', error);
        document.getElementById('error').textContent = 'WebSocket error. Please try again later.';
    });

    socket.on('connect_error', (error) => {
        console.error('WebSocket connection error:', error);
        document.getElementById('error').textContent = 'Unable to connect to the server. Please check your internet connection and try again.';
    });

    socket.on('reconnect_attempt', () => {
        const statusBadge = document.getElementById('statusBadge');
        statusBadge.textContent = 'Reconnecting...';
        statusBadge.className = 'reconnecting';
    });

    socket.on('reconnect', () => {
        const statusBadge = document.getElementById('statusBadge');
        statusBadge.textContent = 'Connected';
        statusBadge.className = 'connected';
    });

    if (promptForm) {
        console.log('Found promptForm element:', promptForm);

        promptForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            console.log('Form submit event triggered');

            const prompt = document.getElementById('prompt').value.trim();
            console.log('Prompt value:', prompt);

            if (prompt) {
                console.log('Sending prompt to server:', prompt);
                // Show loading indicator
                document.getElementById('loading').style.display = 'block';
                document.getElementById('error').textContent = ''; // Clear previous error messages

                try {
                    const response = await fetch('/sendPrompt', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'socket-id': socket.id // Send the socket ID in the request headers
                        },
                        body: JSON.stringify({ prompt })
                    });

                    console.log('Response received from server');
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
                    } else {
                        console.error('Error from server:', result.error);
                        document.getElementById('error').textContent = result.error;
                    }
                } catch (error) {
                    console.error('Error:', error);
                    document.getElementById('error').textContent = 'An error occurred. Please try again later.';
                }
            } else {
                console.error('Prompt cannot be empty.');
                document.getElementById('error').textContent = 'Prompt cannot be empty.';
            }
        });
    } else {
        console.error('promptForm element not found');
    }
});