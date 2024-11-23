// Establish WebSocket connection
const socket = io(); // Socket.IO für die Echtzeit-Verbindung mit dem Server

// Update status badge on connection
socket.on('connect', () => {
    updateStatusBadge('Connected', 'connected');
});

socket.on('disconnect', () => {
    updateStatusBadge('Disconnected', 'disconnected');
});

// Funktion zur Statusanzeige
function updateStatusBadge(text, className) {
    const statusBadge = document.getElementById('statusBadge');
    if (statusBadge) {
        statusBadge.textContent = text;
        statusBadge.className = className;
    }
}

// Handle form submission
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM fully loaded and parsed');

    const promptForm = document.getElementById('promptForm');
    const activeImage = document.getElementById('activeImage');
    const loadingIndicator = document.getElementById('loading');
    const errorDisplay = document.getElementById('error');
    const downloadButton = document.getElementById('downloadButton');

    if (promptForm) {
        console.log('Found promptForm element');

        promptForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            console.log('Form submit event triggered');

            const prompt = document.getElementById('prompt').value.trim();

            if (prompt) {
                console.log('Sending prompt to server:', prompt);

                // Zeige Ladeanzeige
                loadingIndicator.style.display = 'block';
                errorDisplay.textContent = ''; // Vorherige Fehlermeldungen löschen

                try {
                    const response = await fetch('/sendPrompt', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ prompt })
                    });

                    const result = await response.json();

                    if (response.ok) {
                        console.log('Received image path from server:', result.imagePath);

                        // Ladeanzeige ausblenden
                        loadingIndicator.style.display = 'none';

                        // Aktualisiere das Bild
                        activeImage.src = result.imagePath;

                        // Download-Button anzeigen und konfigurieren
                        downloadButton.style.display = 'block';
                        downloadButton.onclick = () => {
                            initiateDownload(activeImage.src);
                        };

                        // WebSocket initialisieren
                        initializeWebSocket(result.websocketPort, activeImage);
                    } else {
                        console.error('Error from server:', result.error);
                        errorDisplay.textContent = result.error;
                    }
                } catch (error) {
                    console.error('Error:', error);
                    errorDisplay.textContent = 'An error occurred. Please try again later.';
                }
            } else {
                console.error('Prompt cannot be empty.');
                errorDisplay.textContent = 'Prompt cannot be empty.';
            }
        });
    } else {
        console.error('promptForm element not found');
    }
});

// Funktion: WebSocket-Initialisierung
function initializeWebSocket(port, activeImage) {
    const ws = new WebSocket(`ws://localhost:${port}`);

    ws.addEventListener('open', () => {
        console.log('WebSocket connection established');
    });

    ws.addEventListener('message', (event) => {
        const data = JSON.parse(event.data);
        console.log('WebSocket message received:', data);

        if (data.imagePath) {
            activeImage.src = data.imagePath;
            console.log('Active image updated via WebSocket:', activeImage.src);
        }
    });

    ws.addEventListener('error', (error) => {
        console.error('WebSocket error:', error);
        document.getElementById('error').textContent = 'WebSocket error. Please try again later.';
    });

    ws.addEventListener('close', () => {
        console.log('WebSocket connection closed');
    });
}

// Funktion: Download-Button
function initiateDownload(imageSrc) {
    const a = document.createElement('a');
    a.href = imageSrc;
    a.download = 'generated_image.jpg';
    a.click();
    console.log('Download initiated for:', imageSrc);
}

// WebSocket-Fehlerbehandlung (Socket.IO)
socket.on('error', (error) => {
    console.error('WebSocket error:', error);
    document.getElementById('error').textContent = 'WebSocket error. Please try again later.';
});

socket.on('connect_error', (error) => {
    console.error('WebSocket connection error:', error);
    document.getElementById('error').textContent = 'Unable to connect to the server. Please check your internet connection and try again.';
});

socket.on('reconnect_attempt', () => {
    updateStatusBadge('Reconnecting...', 'reconnecting');
});

socket.on('reconnect', () => {
    updateStatusBadge('Reconnected', 'connected');
});

socket.on('reconnect_failed', () => {
    updateStatusBadge('Reconnection Failed', 'disconnected');
    document.getElementById('error').textContent = 'Failed to reconnect to the server. Please refresh the page or try again later.';
});
