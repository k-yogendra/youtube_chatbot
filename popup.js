document.addEventListener('DOMContentLoaded', () => {
  // ---------- Markdown ----------
  const md = window.markdownit();

  // ---------- TTS (Listen) ----------
  const canSpeak = 'speechSynthesis' in window;
  const synth = window.speechSynthesis;
  function stripHTML(html) {
    const el = document.createElement('div');
    el.innerHTML = html;
    return el.textContent || el.innerText || '';
  }
  function speakText(text) {
    if (!canSpeak) return;
    synth.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 1.0;
    u.pitch = 1.0;
    u.lang = navigator.language || 'en-US';
    synth.speak(u);
  }

  // ---------- Speech Recognition (Mic) ----------
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const canListen = !!SpeechRecognition;
  let recog = null;
  if (canListen) {
    recog = new SpeechRecognition();
    recog.continuous = false;
    recog.interimResults = true;
    recog.lang = navigator.language || 'en-US';
  }

  // ---------- UI ----------
  const apiKeySection = document.getElementById('api-key-section');
  const chatSection   = document.getElementById('chat-section');
  const apiKeyInput   = document.getElementById('api-key-input');
  const saveKeyBtn    = document.getElementById('save-key-btn');

  const statusArea = document.getElementById('status-area');
  const statusText = document.getElementById('status-text');
  const getTranscriptBtn = document.getElementById('get-transcript-btn');

  const chatWindow = document.getElementById('chat-window');
  const userQuestionInput = document.getElementById('user-question');
  const sendBtn = document.getElementById('send-btn');
  const messageTemplate = document.getElementById('chat-message-template');
  const micBtn = document.getElementById('mic-btn');
  const clearChatBtn = document.getElementById('clear-chat-btn');

  // ---------- State ----------
  let transcript = '';
  let apiKey = '';

  // ---------- Status helpers ----------
  function showStatus(text, showLoader = false) {
    if (statusText) statusText.textContent = text;
    if (statusArea) {
      statusArea.classList.remove('hidden');
      if (showLoader) statusArea.classList.add('loading');
      else statusArea.classList.remove('loading');
    }
  }
  function hideStatus() {
    if (statusArea) {
      statusArea.classList.add('hidden');
      statusArea.classList.remove('loading');
    }
  }
  function toggleChatInput(enabled) {
    userQuestionInput.disabled = !enabled;
    sendBtn.disabled = !enabled;
  }

  // ---------- Chat helpers ----------
  function saveMessage(sender, text) {
    chrome.storage.local.get(['chat_history'], (result) => {
      const history = result.chat_history || [];
      history.push({ sender, text });
      chrome.storage.local.set({ chat_history: history });
    });
  }

  function addMessageToChat(sender, text) {
    const messageClone = messageTemplate.content.cloneNode(true);
    const messageDiv = messageClone.querySelector('.message');
    const contentDiv = messageClone.querySelector('.message-content');
    const copyBtn = messageClone.querySelector('.copy-btn');
    const ttsBtn = messageClone.querySelector('.tts-btn');

    messageDiv.classList.add(`${sender}-message`);

    if (sender === 'bot' && text === '...') {
      // thinking bubble
      contentDiv.classList.add('thinking-message');
      const loader = document.createElement('div');
      loader.className = 'loader';
      contentDiv.appendChild(loader);
      messageDiv.id = 'thinking-bubble';
      if (copyBtn) copyBtn.remove();
      if (ttsBtn) ttsBtn.remove();
    } else {
      const rawText = text;
      contentDiv.innerHTML = md.render(rawText);

      if (sender === 'user') {
        if (copyBtn) copyBtn.remove();
        if (ttsBtn) ttsBtn.remove();
      } else {
        if (copyBtn) {
          copyBtn.addEventListener('click', () => {
            navigator.clipboard.writeText(rawText);
            copyBtn.title = 'Copied!';
            setTimeout(() => { copyBtn.title = 'Copy'; }, 1200);
          });
        }
        if (ttsBtn) {
          if (!canSpeak) {
            ttsBtn.title = 'Text-to-speech not supported';
            ttsBtn.disabled = true;
            ttsBtn.style.opacity = '0.5';
          } else {
            ttsBtn.addEventListener('click', () => {
              const toSpeak = stripHTML(md.render(rawText));
              speakText(toSpeak);
            });
          }
        }
      }
    }

    chatWindow.appendChild(messageClone);
    chatWindow.scrollTop = chatWindow.scrollHeight;

    if (!(sender === 'bot' && text === '...')) {
      saveMessage(sender, text);
    }
  }

  // ---------- Load saved history ----------
  chrome.storage.local.get(['chat_history'], (result) => {
    if (Array.isArray(result.chat_history)) {
      result.chat_history.forEach(m => addMessageToChat(m.sender, m.text));
    }
  });

  // ---------- Mic (click) ----------
  if (micBtn) {
    micBtn.addEventListener('click', async () => {
      if (!canListen) {
        addMessageToChat('bot', 'Voice input is not supported in this browser.');
        return;
      }
      // Proactively request mic permission to avoid "not-allowed"
      if (navigator.mediaDevices?.getUserMedia) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          stream.getTracks().forEach(t => t.stop());
        } catch (err) {
          addMessageToChat('bot', 'Microphone permission is blocked. Allow it in Chrome settings and try again.');
          return;
        }
      }
      try { synth.cancel(); } catch(_) {}
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
        addMessageToChat('bot', `Mic error: ${evt?.error || 'unknown'}`);
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

  // ---------- Clear chat ----------
  clearChatBtn?.addEventListener('click', () => {
    chatWindow.innerHTML = '';
    chrome.storage.local.set({ chat_history: [] });
  });

  // ---------- Key restore ----------
  chrome.storage.local.get(['openai_api_key'], (result) => {
    if (result.openai_api_key) {
      apiKey = result.openai_api_key;
      apiKeySection.classList.add('hidden');
      chatSection.classList.remove('hidden');
    }
  });

  // ---------- Save key ----------
  saveKeyBtn.addEventListener('click', () => {
    const key = apiKeyInput.value.trim();
    if (key) {
      apiKey = key;
      chrome.storage.local.set({ openai_api_key: key }, () => {
        apiKeySection.classList.add('hidden');
        chatSection.classList.remove('hidden');
      });
    }
  });

  // ---------- Get transcript ----------
  getTranscriptBtn.addEventListener('click', () => {
    showStatus('Connecting to page...', true);
    getTranscriptBtn.disabled = true;

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs[0]?.id) {
        showStatus('Error: Could not find the active tab.');
        getTranscriptBtn.disabled = false;
        return;
      }
      const tabId = tabs[0].id;

      chrome.scripting.executeScript(
        { target: { tabId }, files: ['content.js'] },
        () => {
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

            if (response?.transcript) {
              transcript = response.transcript;
              showStatus('Transcript loaded! Ready to chat.');
              toggleChatInput(true);
              addMessageToChat('bot', 'Transcript loaded! Feel free to ask me anything about the video.');
              userQuestionInput.focus();
              setTimeout(hideStatus, 3000);
            } else {
              const msg = response?.error || 'An unknown error occurred.';
              showStatus(`Error: ${msg}`);
            }
          });
        }
      );
    });
  });

  // ---------- Chat sending ----------
  sendBtn.addEventListener('click', sendMessage);
  userQuestionInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendMessage();
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
    const systemPrompt = `You are a helpful AI assistant that specializes in answering questions about a YouTube video using a provided transcript.
Your knowledge is strictly limited to the information within this transcript. Do not use any external knowledge.
When you answer, speak directly and naturally. **Crucially, do not mention the transcript itself.** Do not say things like "According to the transcript..." or "The transcript says...". Answer the user's question as if you have absorbed the video's content.
You are permitted to summarize, list key points, or explain concepts based on the text.
If the answer cannot be found, you must respond with: "I'm sorry, that information wasn't mentioned in the video."
Use natural paragraphs for your responses, and apply Markdown formatting only when it genuinely makes the answer clearer (e.g., for a list).`;

    try {
      const resp = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: 'gpt-3.5-turbo',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: `Here is the transcript:\n\n${transcript}\n\nHere is my question:\n\n${question}` }
          ]
        })
      });

      const thinking = document.getElementById('thinking-bubble');
      if (thinking) thinking.remove();

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err?.error?.message || `HTTP ${resp.status}`);
      }

      const data = await resp.json();
      const botResponse = data.choices?.[0]?.message?.content || '(no response)';
      addMessageToChat('bot', botResponse);
    } catch (e) {
      const thinking = document.getElementById('thinking-bubble');
      if (thinking) thinking.remove();
      addMessageToChat('bot', `Error: ${e.message}`);
    } finally {
      toggleChatInput(true);
      userQuestionInput.focus();
    }
  }
});
