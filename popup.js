document.addEventListener('DOMContentLoaded', () => {
    // Initialize the markdown-it library
    const md = window.markdownit();

    // UI Elements
    const apiKeySection = document.getElementById('api-key-section');
    const chatSection = document.getElementById('chat-section');
    const apiKeyInput = document.getElementById('api-key-input');
    const saveKeyBtn = document.getElementById('save-key-btn');
    
    const getTranscriptBtn = document.getElementById('get-transcript-btn');
    const statusArea = document.getElementById('status-area');
    const statusText = document.getElementById('status-text');
    
    const chatWindow = document.getElementById('chat-window');
    const userQuestionInput = document.getElementById('user-question');
    const sendBtn = document.getElementById('send-btn');
    const messageTemplate = document.getElementById('chat-message-template');

    let transcript = '';
    let apiKey = '';

    // --- Core Functions ---

    function showStatus(text, showLoader = false) {
        statusArea.classList.remove('hidden');
        statusText.textContent = text;
        statusArea.querySelector('.loader').style.display = showLoader ? 'block' : 'none';
    }

    function hideStatus() {
        statusArea.classList.add('hidden');
    }

    function toggleChatInput(enabled) {
        userQuestionInput.disabled = !enabled;
        sendBtn.disabled = !enabled;
    }

    function addMessageToChat(sender, text) {
        const messageClone = messageTemplate.content.cloneNode(true);
        const messageDiv = messageClone.querySelector('.message');
        const contentDiv = messageClone.querySelector('.message-content');
        const copyBtn = messageClone.querySelector('.copy-btn');
        
        messageDiv.classList.add(`${sender}-message`);
        
        if (sender === 'bot' && text === '...') {
            contentDiv.classList.add('thinking-message');
            const loader = document.createElement('div');
            loader.className = 'loader';
            contentDiv.appendChild(loader);
            messageDiv.id = 'thinking-bubble';
            copyBtn.remove();
        } else {
            const rawText = text;
            contentDiv.innerHTML = md.render(rawText);

            if (sender === 'user') {
                copyBtn.remove();
            } else {
                copyBtn.addEventListener('click', () => {
                    navigator.clipboard.writeText(rawText);
                    copyBtn.title = 'Copied!';
                    setTimeout(() => { copyBtn.title = 'Copy text'; }, 2000);
                });
            }
        }
        
        chatWindow.appendChild(messageClone);
        chatWindow.scrollTop = chatWindow.scrollHeight;
    }

    // --- Event Listeners and Logic ---

    chrome.storage.local.get(['openai_api_key'], (result) => {
        if (result.openai_api_key) {
            apiKey = result.openai_api_key;
            apiKeySection.classList.add('hidden');
            chatSection.classList.remove('hidden');
        }
    });

    saveKeyBtn.addEventListener('click', () => {
        const key = apiKeyInput.value.trim();
        if (key) {
            apiKey = key;
            chrome.storage.local.set({ 'openai_api_key': key }, () => {
                apiKeySection.classList.add('hidden');
                chatSection.classList.remove('hidden');
            });
        }
    });

    getTranscriptBtn.addEventListener('click', () => {
        showStatus('Connecting to page...', true);
        getTranscriptBtn.disabled = true;

        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (!tabs[0] || !tabs[0].id) {
                showStatus('Error: Could not find the active tab.');
                getTranscriptBtn.disabled = false;
                return;
            }
            const tabId = tabs[0].id;

            chrome.scripting.executeScript({
                target: { tabId: tabId },
                files: ['content.js']
            }, () => {
                if (chrome.runtime.lastError) {
                    showStatus(`Error injecting script: ${chrome.runtime.lastError.message}`);
                    getTranscriptBtn.disabled = false;
                    return;
                }
                
                showStatus('Getting transcript...', true);
                
                chrome.tabs.sendMessage(tabId, { action: 'getTranscript' }, (response) => {
                    getTranscriptBtn.disabled = false;
                    if (chrome.runtime.lastError) {
                        showStatus(`Error: ${chrome.runtime.lastError.message}. Please refresh the page.`);
                        return;
                    }

                    if (response && response.transcript) {
                        transcript = response.transcript;
                        showStatus('Transcript loaded! Ready to chat.');
                        toggleChatInput(true);
                        
                        addMessageToChat('bot', 'Transcript loaded! Feel free to ask me anything about the video.');

                        userQuestionInput.focus();
                        setTimeout(hideStatus, 3000);
                    } else {
                        const errorMsg = (response && response.error) ? response.error : 'An unknown error occurred.';
                        showStatus(`Error: ${errorMsg}`);
                    }
                });
            });
        });
    });
    
    sendBtn.addEventListener('click', sendMessage);
    userQuestionInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            sendMessage();
        }
    });

    function sendMessage() {
        const question = userQuestionInput.value.trim();
        if (!question) return;
        
        addMessageToChat('user', question);
        userQuestionInput.value = '';
        toggleChatInput(false);
        addMessageToChat('bot', '...');
        
        callChatGPT(question);
    }

    async function callChatGPT(question) {
        // --- THIS IS THE FINAL, POLISHED PROMPT ---
        const systemPrompt = `You are a helpful AI assistant that specializes in answering questions about a YouTube video using a provided transcript.
        Your knowledge is strictly limited to the information within this transcript. Do not use any external knowledge.
        When you answer, speak directly and naturally. **Crucially, do not mention the transcript itself.** Do not say things like "According to the transcript..." or "The transcript says...". Answer the user's question as if you have absorbed the video's content.
        You are permitted to summarize, list key points, or explain concepts based on the text.
        If the answer cannot be found, you must respond with: "I'm sorry, that information wasn't mentioned in the video."
        Use natural paragraphs for your responses, and apply Markdown formatting only when it genuinely makes the answer clearer (e.g., for a list).`;
        
        try {
            const response = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                body: JSON.stringify({
                    model: 'gpt-3.5-turbo',
                    messages: [
                        { role: 'system', content: systemPrompt },
                        { role: 'user', content: `Here is the transcript:\n\n${transcript}\n\nHere is my question:\n\n${question}` }
                    ]
                })
            });

            const thinkingBubble = document.getElementById('thinking-bubble');
            if (thinkingBubble) thinkingBubble.remove();

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error.message);
            }

            const data = await response.json();
            const botResponse = data.choices[0].message.content;
            addMessageToChat('bot', botResponse);

        } catch (error) {
            const thinkingBubble = document.getElementById('thinking-bubble');
            if (thinkingBubble) thinkingBubble.remove();
            addMessageToChat('bot', `Error: ${error.message}`);
        } finally {
            toggleChatInput(true);
            userQuestionInput.focus();
        }
    }
});