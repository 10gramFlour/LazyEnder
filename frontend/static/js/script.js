// Establish WebSocket connection
const socket = io('http://localhost:8081'); // Production environment

// Handle form submission
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM fully loaded and parsed.');

    const promptForm = document.getElementById('promptForm');
    const statusBadge = document.getElementById('statusBadge');
    const activeImage = document.getElementById('activeImage');
    const downloadButton = document.getElementById('downloadButton');
    const loadingIndicator = document.getElementById('loading');
    const errorDisplay = document.getElementById('error');

    // WebSocket event listeners
    socket.on('connect', () => {
        console.log('WebSocket connection established (Socket ID:', socket.id, ')');
        updateStatusBadge('Connected', 'connected');
    });

    socket.on('disconnect', () => {
        console.log('WebSocket connection closed.');
        updateStatusBadge('Disconnected', 'disconnected');
        displayError('Disconnected from WebSocket. Please try again later.');
    });

    socket.on('reconnect_attempt', () => {
        console.log('WebSocket reconnecting...');
        updateStatusBadge('Reconnecting...', 'reconnecting');
    });

    socket.on('reconnect', () => {
        console.log('WebSocket reconnected.');
        updateStatusBadge('Connected', 'connected');
    });

    socket.on('imageUpdated', (data) => {
        if (data.imagePath) {
            console.log('Image updated:', data.imagePath);
            updateImage(data.imagePath);
        } else {
            console.error('No imagePath received in WebSocket message.');
            displayError('Error receiving image.');
        }
    });

    socket.on('error', (error) => handleSocketError('WebSocket error', error));
    socket.on('connect_error', (error) => handleSocketError('WebSocket connection error', error));

    // Handle form submission
    if (promptForm) {
        promptForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            const prompt = document.getElementById('prompt').value.trim();

            if (!prompt) {
                displayError('Prompt cannot be empty.');
                return;
            }

            console.log('Submitting prompt:', prompt);
            displayLoading(true);
            clearError();

            try {
                const response = await fetch('/sendPrompt', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'socket-id': socket.id // Attach the socket ID
                    },
                    body: JSON.stringify({ prompt })
                });

                const result = await response.json();
                if (response.ok) {
                    console.log('Image path received from server:', result.imagePath);
                    updateImage(result.imagePath);
                } else {
                    console.error('Server error:', result.error);
                    displayError(result.error || 'Unexpected server error.');
                }
            } catch (error) {
                console.error('Request error:', error);
                displayError('An error occurred while sending the prompt. Please try again.');
            } finally {
                displayLoading(false);
            }
        });
    } else {
        console.error('Prompt form not found in DOM.');
    }

    // Utility functions
    function updateStatusBadge(text, className) {
        if (statusBadge) {
            statusBadge.textContent = text;
            statusBadge.className = className;
        }
    }

    function updateImage(imagePath) {
        if (activeImage && imagePath) {
            // Verify that the image path is valid
            if (isValidImageUrl(imagePath)) {
                activeImage.src = imagePath;
                downloadButton.style.display = 'block';
                console.log('Image updated:', imagePath);
                downloadButton.onclick = () => initiateDownload(imagePath);
            } else {
                displayError('Invalid image path received.');
            }
        }
    }

    function isValidImageUrl(url) {
        // Simple check to see if the URL seems valid
        return url && (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('/images/'));
    }

    function displayLoading(show) {
        if (loadingIndicator) {
            loadingIndicator.style.display = show ? 'block' : 'none';
        }
    }

    function clearError() {
        if (errorDisplay) {
            errorDisplay.textContent = '';
        }
    }

    function displayError(message) {
        if (errorDisplay) {
            errorDisplay.textContent = message;
        }
    }

    function handleSocketError(logMessage, error) {
        console.error(logMessage, error);
        displayError('WebSocket error occurred. Please try again later.');
    }

    function initiateDownload(imagePath) {
        if (imagePath) {
            const link = document.createElement('a');
            link.href = imagePath;
            link.download = 'generated_image.jpg';
            link.click();
            console.log('Download initiated for:', imagePath);
        }
    }
});

