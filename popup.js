document.addEventListener('DOMContentLoaded', () => {
    // Initialize the markdown-it library
    const md = window.markdownit();
    // Speech Synthesis support check
    const canSpeak = 'speechSynthesis' in window;
    const synth = window.speechSynthesis;
    // Speech Recognition (voice input)
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const canListen = !!SpeechRecognition;

    // Request mic permission proactively (works around 'not-allowed')
    async function ensureMicPermission() {
        if (!('mediaDevices' in navigator) || !navigator.mediaDevices.getUserMedia) return true;
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            stream.getTracks().forEach(t => t.stop());
            return true;
        } catch (err) {
            addMessageToChat('bot', 'Microphone permission is blocked. Please allow it in browser settings and try again.');
            return false;
        }
    }
    
    let recog = null;
    if (canListen) {
        recog = new SpeechRecognition();
        recog.continuous = false;
        recog.interimResults = true;
        recog.lang = navigator.language || 'en-US';
    }


    function stripHTML(html) {
        const tmp = document.createElement('div');
        tmp.innerHTML = html;
        return tmp.textContent || tmp.innerText || '';
    }

    function speakText(text) {
        if (!canSpeak) return;
        // Cancel any ongoing speech first
        synth.cancel();
        const utter = new SpeechSynthesisUtterance(text);
        utter.rate = 1.0;
        utter.pitch = 1.0;
        utter.lang = navigator.language || 'en-US';
        synth.speak(utter);
    }


    // UI Elements
    const apiKeySection = document.getElementById('api-key-section');
    const chatSection = document.getElementById('chat-section');
    const apiKeyInput = document.getElementById('api-key-input');
    const saveKeyBtn = document.getElementById('save-key-btn');
    
    const getTranscriptBtn = document.getElementById('get-transcript-btn');
    const statusArea = document.getElementById('status-area');
    const statusText = document.getElementById('status-text');
    
    
// Load saved chat history
chrome.storage.local.get(['chat_history'], (result) => {
    if (result.chat_history && Array.isArray(result.chat_history)) {
        result.chat_history.forEach(msg => {
            addMessageToChat(msg.sender, msg.text);
        });
    }
});

function saveMessage(sender, text) {
    chrome.storage.local.get(['chat_history'], (result) => {
        const history = result.chat_history || [];
        history.push({ sender, text });
        chrome.storage.local.set({ chat_history: history });
    });
}
const chatWindow = document.getElementById('chat-window');
    const userQuestionInput = document.getElementById('user-question');
    const sendBtn = document.getElementById('send-btn');
    const messageTemplate = document.getElementById('chat-message-template');
    const micBtn = document.getElementById('mic-btn');
    const clearBtn = document.getElementById('clear-chat-btn');
let transcript = '';
    let apiKey = '';

        // --- Core Functions ---

    // --- Mic (voice-to-text) ---
    if (micBtn) {
        micBtn.addEventListener('click', async () => {
            if (!canListen) {
                addMessageToChat('bot', 'Voice input is not supported in this browser.');
                return;
            }
            if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
                try {
                    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                    stream.getTracks().forEach(t => t.stop());
                } catch (err) {
                    addMessageToChat('bot', 'Microphone permission is blocked. Please allow it and try again.');
                    return;
                }
            }
            try { synth.cancel(); } catch (_) {}
            userQuestionInput.focus();
            micBtn.classList.add('listening');
            userQuestionInput.placeholder = 'Listening...';

            let finalText = '';
            recog.onresult = (e) => {
                let interim = '';
                for (let i = e.resultIndex; i < e.results.length; i++) {
                    const t = e.results[i][0].transcript;
                    if (e.results[i].isFinal) finalText += t;
                    else interim += t;
                }
                userQuestionInput.value = (finalText + ' ' + interim).trim();
            };
            recog.onerror = (evt) => {
                micBtn.classList.remove('listening');
                userQuestionInput.placeholder = 'Ask a question...';
                addMessageToChat('bot', `Mic error: ${evt.error || 'unknown error'}`);
            
                if (evt && evt.error === 'not-allowed') {
                    const settingsUrl = `chrome://settings/content/siteDetails?site=chrome-extension://${chrome.runtime.id}`;
                    try { chrome.tabs.create({ url: settingsUrl }); } catch (_) {}
                }
        };
            recog.onend = () => {
                micBtn.classList.remove('listening');
                userQuestionInput.placeholder = 'Ask a question...';
                const q = userQuestionInput.value.trim();
                if (q) sendBtn.click();
            };
            try {
                recog.start();
            } catch (e) {
                try { recog.stop(); } catch(_) {}
                setTimeout(() => { try { recog.start(); } catch(_) {} }, 150);
            }
        });
    }

    // --- Clear chat ---
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

    const clearChatBtn = document.getElementById('clear-chat-btn');
// Clear chat
    clearChatBtn?.addEventListener('click', () => {
        chatWindow.innerHTML = '';
        chrome.storage.local.set({ chat_history: [] });
    });

});