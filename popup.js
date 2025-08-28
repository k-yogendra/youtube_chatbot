document.addEventListener('DOMContentLoaded', () => {
    // Initialize the markdown-it library
    const md = window.markdownit();

    // UI Elements (with the new button)
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
    const clearChatBtn = document.getElementById('clear-chat-btn'); // NEW
    const messageTemplate = document.getElementById('chat-message-template');

    // State variables
    let apiKey = '';
    let chatHistory = [];
    let currentVideoId = null;
    let transcript = '';
    let videoTitle = '';
    let videoDescription = '';

    // --- NEW: Chat Reset Function ---
    function resetChatState() {
        if (!currentVideoId) return;
        
        // 1. Clear session storage for this video
        const storageKey = `chat_session_${currentVideoId}`;
        chrome.storage.session.remove(storageKey, () => {
            console.log("Session cleared for video:", currentVideoId);
        });

        // 2. Reset local state variables
        chatHistory = [];
        transcript = '';
        videoTitle = '';
        videoDescription = '';

        // 3. Reset the UI
        chatWindow.innerHTML = '';
        getTranscriptBtn.classList.remove('hidden');
        toggleChatInput(false);
        clearChatBtn.disabled = true;
    }

    // --- Session Management ---
    function loadSession() {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0]?.url?.includes("youtube.com/watch")) {
                try {
                    currentVideoId = new URL(tabs[0].url).searchParams.get("v");
                    if (!currentVideoId) return;

                    const storageKey = `chat_session_${currentVideoId}`;
                    chrome.storage.session.get(storageKey, (result) => {
                        if (result[storageKey]) {
                            const sessionData = result[storageKey];
                            transcript = sessionData.transcript;
                            videoTitle = sessionData.title;
                            videoDescription = sessionData.description;
                            chatHistory = sessionData.history || [];
                            
                            rebuildChatFromHistory();
                            toggleChatInput(true);
                            getTranscriptBtn.classList.add('hidden');
                            clearChatBtn.disabled = false; // Enable clear button
                            hideStatus();
                        }
                    });
                } catch (e) { console.error("Could not parse URL:", e); }
            }
        });
    }

    // ... saveSession, rebuildChatFromHistory, and other core functions are unchanged ...
    
    // --- Event Listeners and Logic ---

    // NEW: Add click listener for the clear button
    clearChatBtn.addEventListener('click', resetChatState);

    getTranscriptBtn.addEventListener('click', () => {
        // ... (existing logic)
        // Inside the success callback:
        if (response && response.videoData) {
            // ... (existing logic)
            clearChatBtn.disabled = false; // Enable clear button
            const welcomeMessage = 'I have the video transcript, title, and description ready. What would you like to know?';
            addMessageToChat('bot', welcomeMessage);
            // ... (existing logic)
        }
    });

    // --- Full, complete code for easy copy-pasting ---

    function saveSession() { if (!currentVideoId) return; const storageKey = `chat_session_${currentVideoId}`; const sessionData = { transcript: transcript, title: videoTitle, description: videoDescription, history: chatHistory }; chrome.storage.session.set({ [storageKey]: sessionData }); }
    function rebuildChatFromHistory() { chatWindow.innerHTML = ''; chatHistory.forEach(message => addMessageToChat(message.sender, message.text, false)); }
    function showStatus(text, showLoader = false) { statusArea.classList.remove('hidden'); statusText.textContent = text; statusArea.querySelector('.loader').style.display = showLoader ? 'block' : 'none'; }
    function hideStatus() { statusArea.classList.add('hidden'); }
    function toggleChatInput(enabled) { userQuestionInput.disabled = !enabled; sendBtn.disabled = !enabled; }
    function addMessageToChat(sender, text, shouldSave = true) { if (shouldSave) { chatHistory.push({ sender, text }); saveSession(); } const messageClone = messageTemplate.content.cloneNode(true); const messageDiv = messageClone.querySelector('.message'); const contentDiv = messageClone.querySelector('.message-content'); const copyBtn = messageClone.querySelector('.copy-btn'); messageDiv.classList.add(`${sender}-message`); if (sender === 'bot' && text === '...') { contentDiv.classList.add('thinking-message'); const loader = document.createElement('div'); loader.className = 'loader'; contentDiv.appendChild(loader); messageDiv.id = 'thinking-bubble'; copyBtn.remove(); } else { const rawText = text; contentDiv.innerHTML = md.render(rawText); if (sender === 'user') { copyBtn.remove(); } else { copyBtn.addEventListener('click', () => { navigator.clipboard.writeText(rawText); copyBtn.title = 'Copied!'; setTimeout(() => { copyBtn.title = 'Copy text'; }, 2000); }); } } chatWindow.appendChild(messageClone); chatWindow.scrollTop = chatWindow.scrollHeight; }
    chrome.storage.local.get(['openai_api_key'], (result) => { if (result.openai_api_key) { apiKey = result.openai_api_key; apiKeySection.classList.add('hidden'); chatSection.classList.remove('hidden'); loadSession(); } });
    saveKeyBtn.addEventListener('click', () => { const key = apiKeyInput.value.trim(); if (key) { apiKey = key; chrome.storage.local.set({ 'openai_api_key': key }, () => { apiKeySection.classList.add('hidden'); chatSection.classList.remove('hidden'); }); } });
    getTranscriptBtn.addEventListener('click', () => { showStatus('Connecting to page...', true); getTranscriptBtn.disabled = true; chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => { const tabId = tabs[0].id; chrome.scripting.executeScript({ target: { tabId: tabId }, files: ['content.js'] }, () => { if (chrome.runtime.lastError) { showStatus(`Error injecting script: ${chrome.runtime.lastError.message}`); getTranscriptBtn.disabled = false; return; } showStatus('Getting transcript & metadata...', true); chrome.tabs.sendMessage(tabId, { action: 'getTranscript' }, (response) => { getTranscriptBtn.disabled = false; if (chrome.runtime.lastError) { showStatus(`Error: ${chrome.runtime.lastError.message}. Please refresh the page.`); return; } if (response && response.videoData) { const { transcript: newTranscript, title, description } = response.videoData; transcript = newTranscript; videoTitle = title; videoDescription = description; getTranscriptBtn.classList.add('hidden'); showStatus('Ready to chat!'); toggleChatInput(true); clearChatBtn.disabled = false; const welcomeMessage = 'I have the video transcript, title, and description ready. What would you like to know?'; addMessageToChat('bot', welcomeMessage); userQuestionInput.focus(); setTimeout(hideStatus, 3000); } else { const errorMsg = (response && response.error) ? response.error : 'An unknown error occurred.'; showStatus(`Error: ${errorMsg}`); } }); }); }); });
    sendBtn.addEventListener('click', sendMessage);
    userQuestionInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') sendMessage(); });
    function sendMessage() { const question = userQuestionInput.value.trim(); if (!question) return; addMessageToChat('user', question); userQuestionInput.value = ''; toggleChatInput(false); addMessageToChat('bot', '...', false); callChatGPT(); }
    async function callChatGPT() { const systemPrompt = `You are an expert AI assistant for YouTube videos. Your primary directive is to answer questions using only the information from the video's Title, Description, and Transcript provided in the context. Do not use any external knowledge. When you answer, speak directly and naturally. Crucially, do not mention the transcript itself. Answer as if you have absorbed the video's content. You are permitted to synthesize information from all provided sources to give a complete answer. If the answer cannot be found in the provided context, you must state: "I'm sorry, that information wasn't mentioned in the video." Use natural paragraphs and apply Markdown formatting only when it genuinely improves clarity.`; const apiMessages = []; apiMessages.push({ role: 'system', content: systemPrompt }); const contextBlock = `--- Start of Context ---\nVideo Title: "${videoTitle}"\nVideo Description: "${videoDescription}"\nVideo Transcript:\n${transcript}\n--- End of Context ---`; chatHistory.forEach((message, index) => { const role = message.sender === 'user' ? 'user' : 'assistant'; let content = message.text; if (role === 'user' && index === 0) { content = `${contextBlock}\n\nMy first question is: "${content}"`; } apiMessages.push({ role, content }); }); try { const response = await fetch('https://api.openai.com/v1/chat/completions', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` }, body: JSON.stringify({ model: 'gpt-3.5-turbo', messages: apiMessages }) }); const thinkingBubble = document.getElementById('thinking-bubble'); if (thinkingBubble) thinkingBubble.remove(); if (!response.ok) { const errorData = await response.json(); throw new Error(errorData.error.message); } const data = await response.json(); const botResponse = data.choices[0].message.content; addMessageToChat('bot', botResponse); } catch (error) { const thinkingBubble = document.getElementById('thinking-bubble'); if (thinkingBubble) thinkingBubble.remove(); addMessageToChat('bot', `Error: ${error.message}`); } finally { toggleChatInput(true); userQuestionInput.focus(); } }
});