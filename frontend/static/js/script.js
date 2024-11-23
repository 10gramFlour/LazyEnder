// Establish WebSocket connection
const socket = io();  // Production environment

// Update status badge on connection
socket.on('connect', () => {
    const statusBadge = document.getElementById('statusBadge');
    statusBadge.textContent = 'Connected';
    statusBadge.className = 'connected';
});

// Update status badge on disconnection
socket.on('disconnect', () => {
    const statusBadge = document.getElementById('statusBadge');
    statusBadge.textContent = 'Disconnected';
    statusBadge.className = 'disconnected';
});

// Handle form submission
document.getElementById('promptForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const prompt = document.getElementById('prompt').value.trim();

    if (prompt) {
        // Show loading indicator
        document.getElementById('loading').style.display = 'block';
        document.getElementById('error').textContent = ''; // Clear previous error messages

        try {
            const response = await fetch('/sendPrompt', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ prompt })
            });

            const result = await response.json();
            if (response.ok) {
                // Hide loading indicator
                document.getElementById('loading').style.display = 'none';

                // Create and display new image
                const img = document.createElement('img');
                img.src = result.imagePath; // Assuming the image path is returned
                img.alt = 'Generated Image';
                img.id = 'generatedImage';

                const imageContainer = document.getElementById('imageContainer');
                imageContainer.innerHTML = ''; // Remove previous image
                imageContainer.appendChild(img);

                // Show download button
                const downloadButton = document.getElementById('downloadButton');
                downloadButton.style.display = 'block';
                downloadButton.onclick = () => {
                    const a = document.createElement('a');
                    a.href = img.src;
                    a.download = 'generated_image.jpg';
                    a.click();
                };
            } else {
                document.getElementById('error').textContent = result.error;
            }
        } catch (error) {
            console.error('Error:', error);
            document.getElementById('error').textContent = 'An error occurred. Please try again later.';
        }
    } else {
        document.getElementById('error').textContent = 'Prompt cannot be empty.';
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
    const statusBadge = document.getElementById('statusBadge');
    statusBadge.textContent = 'Reconnecting...';
    statusBadge.className = 'reconnecting';
});

// Handle WebSocket reconnection success
socket.on('reconnect', () => {
    const statusBadge = document.getElementById('statusBadge');
    statusBadge.textContent = 'Reconnected';
    statusBadge.className = 'connected';
});

// Handle WebSocket reconnection failure
socket.on('reconnect_failed', () => {
    const statusBadge = document.getElementById('statusBadge');
    statusBadge.textContent = 'Reconnection Failed';
    statusBadge.className = 'disconnected';
    document.getElementById('error').textContent = 'Failed to reconnect to the server. Please refresh the page or try again later.';
});
