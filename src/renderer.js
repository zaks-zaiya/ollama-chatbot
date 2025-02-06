const { ipcRenderer } = require('electron');

const messagesDiv = document.getElementById('chat-messages');
const userInput = document.getElementById('user-input');
const sendButton = document.getElementById('send-button');

const clearButton = document.createElement('button');
clearButton.innerHTML = 'Clear';
clearButton.className = 'px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600';
sendButton.parentNode.appendChild(clearButton);

const stopButton = document.createElement('button');
stopButton.innerHTML = 'Stop';
stopButton.className = 'px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600';
stopButton.disabled = true;
sendButton.parentNode.appendChild(stopButton);

// Add clear handler
clearButton.addEventListener('click', () => {
    messagesDiv.innerHTML = '';
    addChatHeader();
    addMessage('Hello! How can I help you today?', false);
});

let shouldAutoScroll = true;

function scrollToBottom(force = false) {
    if (force || shouldAutoScroll) {
        messagesDiv.scrollTop = messagesDiv.scrollHeight;
    }
}

function addChatHeader() {
    const chatHeader = document.createElement('div');
    chatHeader.className = "text-center text-lg font-bold mb-4";
    chatHeader.innerHTML = `<div class="flex w-full justify-between"><span class="text-emerald-900">Llama 3.1</span><span class="text-sky-900">Abdullah Hrp</span></div>`;
    messagesDiv.prepend(chatHeader);
}

function formatTimestamp() {
    const now = new Date();
    return now.toLocaleTimeString() + ' ' + now.toLocaleDateString();
}

function addMessage(text, isUser = false, isLoading = false, messageId = null) {
    let messageDiv;

    if (messageId) {
        messageDiv = document.getElementById(messageId);
        if (!messageDiv) return;
        messageDiv.innerHTML = formatMessage(text);
    } else {
        messageDiv = document.createElement('div');
        messageDiv.className = `p-2 mb-2 max-w-[75%] rounded-lg shadow ${isUser ? 'bg-sky-800 text-white ml-auto' : 'bg-emerald-800 text-white mr-auto'
            }`;

        const name = isUser ? '<span class="font-bold text-sm text-white">Abdullah Hrp</span>'
            : '<span class="font-bold text-sm text-white">Llama 3.1</span>';

        const timestamp = `<div class="text-xs opacity-75 mt-1 text-right">${formatTimestamp()}</div>`;

        messageDiv.innerHTML = `${name}<br>` +
            (isLoading ? '<span class="dot-typing"></span>' : formatMessage(text)) +
            timestamp;

        if (!isUser) {
            messageDiv.id = `response-${Date.now()}`;
        }

        messagesDiv.appendChild(messageDiv);
        scrollToBottom();
    }

    return messageDiv.id;
}

messagesDiv.addEventListener('scroll', () => {
    const isAtBottom = messagesDiv.scrollHeight - messagesDiv.clientHeight <= messagesDiv.scrollTop + 10;
    shouldAutoScroll = isAtBottom;
});

function convertMarkdownToHtml(markdown) {
    let html = markdown;
    
    html = html.replace(/^### (.*$)/gm, '<h3>$1</h3>');
    html = html.replace(/^## (.*$)/gm, '<h2>$1</h2>');
    html = html.replace(/^# (.*$)/gm, '<h1>$1</h1>');
    
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    
    html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
    
    html = html.replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>');
    
    html = html.replace(/`(.*?)`/g, '<code>$1</code>');
    
    html = html.replace(/^\s*[-*]\s(.*)/gm, '<li>$1</li>');
    html = html.replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>');
    
    html = html.replace(/\n/g, '<br>');
    
    return html;
}

function formatMessage(text) {
    return convertMarkdownToHtml(text);
}

function setGenerating(isGenerating) {
    userInput.disabled = isGenerating;
    sendButton.disabled = isGenerating;
    stopButton.disabled = !isGenerating;
}

async function sendMessage() {
    const message = userInput.value.trim();
    if (!message) return;

    addMessage(message, true);
    userInput.value = '';
    setGenerating(true);

    const loadingMessageId = addMessage('', false, true);

    try {
        await ipcRenderer.invoke('chat-request', message);
    } catch (error) {
        addMessage('Error: Could not get response from the model', false, false, loadingMessageId);
    } finally {
        setGenerating(false);
    }

    userInput.focus();
}

stopButton.addEventListener('click', async () => {
    stopButton.innerHTML = 'Stopping...';
    stopButton.disabled = true;
    await ipcRenderer.invoke('stop-generation');
    stopButton.innerHTML = 'Stop';
    setGenerating(false);
});

ipcRenderer.on('updateResponse', (event, response) => {
    const lastMessage = messagesDiv.lastChild;
    if (lastMessage) {
        const timestamp = `<div class="text-xs opacity-75 mt-1 text-right">${formatTimestamp()}</div>`;
        lastMessage.innerHTML = `<span class="font-bold text-sm text-white">Llama 3.1</span><br>` + formatMessage(response) + timestamp;
        scrollToBottom();
        hljs.highlightAll();
    }
});

sendButton.addEventListener('click', sendMessage);
userInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        sendMessage();
    }
});

addChatHeader();
