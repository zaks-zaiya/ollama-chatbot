
const { app, BrowserWindow, Menu, ipcMain } = require('electron');

let mainWindow;
let currentRequest = null;
let currentController = null;
let currentReader = null;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        show: false,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        }
    });

    const menuTemplate = [];

    const menu = Menu.buildFromTemplate(menuTemplate);
    Menu.setApplicationMenu(menu);

    mainWindow.loadFile('src/index.html');
    mainWindow.maximize();
    mainWindow.show();
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});

ipcMain.handle('stop-generation', () => {
    if (currentController) {
        currentController.abort();
        currentController = null;
    }
});

ipcMain.on('stop-generation', () => {
    if (currentController) {
        currentController.abort();
        currentController = null;
    }
    if (currentReader) {
        currentReader.cancel().catch(console.error);
        currentReader = null;
    }
});

ipcMain.handle('chat-request', async (event, message) => {
    try {
        let showLoading = true;

        currentController = new AbortController();
        const { signal } = currentController;

        event.sender.send('updateResponse', '...');
        await new Promise(resolve => setTimeout(resolve, 100)); // Small delay for UI update

        const response = await fetch('http://127.0.0.1:11434/api/generate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: 'llama3.1:8b-instruct-q5_K_M',
                prompt: 'analyze this: \n' + message + '\n if that math question, then answer quick step by step how to solve it. if that not math question, then absolutely no need any explanation. just reply with: "You are only allow to ask math queaion."',
            }),
            signal
        });

        currentReader = response.body.getReader();
        let fullResponse = '';

        try {
            while (true) {
                const { done, value } = await currentReader.read();
                if (done) break;

                const chunk = new TextDecoder().decode(value);
                const lines = chunk.split('\n');

                for (const line of lines) {
                    if (line.trim()) {
                        try {
                            const json = JSON.parse(line);
                            if (showLoading) {
                                fullResponse = '';
                                showLoading = false;
                            }
                            fullResponse += json.response;
                            event.sender.send('updateResponse', fullResponse);
                        } catch (e) {
                            console.error('Error parsing JSON:', e);
                        }
                    }
                }
            }
        } catch (error) {
            if (error.name === 'AbortError') {
                return fullResponse;
            }
            console.error('Error reading response:', error);
        } finally {
            currentReader = null;
        }

        return fullResponse;
    } catch (error) {
        if (error.name === 'AbortError') {
            return '';
        } else {
            console.error('Request error:', error);
            throw error;
        }
    } finally {
        if (currentRequest?.body?.cancel) {
            currentRequest.body.cancel();
        }
        currentRequest = null;
        currentController = null;
    }
});