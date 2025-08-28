# 🎬 YouTube Chatbot - Chrome Extension

A powerful Google Chrome extension that allows you to have a conversation with any YouTube video. It extracts the video's transcript and uses the OpenAI API (ChatGPT) to answer your questions about the content, saving you time and helping you quickly grasp key information.

*(Feel free to replace this placeholder image with a screenshot or GIF of your own!)*

---

## ✨ About The Project

Ever wanted to get the summary of a long lecture, find a specific topic in a tutorial, or understand the key arguments of a podcast without watching the entire video? This extension is the solution.

By leveraging YouTube's internal API to reliably fetch transcripts and connecting to the powerful language understanding of ChatGPT, this tool transforms passive video watching into an interactive Q&A session.

### Key Features

- **Reliable Transcript Extraction:** Uses YouTube's internal InnerTube API to fetch transcripts, making it more robust than traditional web scrapers.
- **Interactive Chat Interface:** Ask questions in a clean, modern, dark-themed chat window and get instant answers.
- **Powered by ChatGPT:** Integrates with the OpenAI API (GPT-3.5-Turbo) for intelligent and context-aware responses.
- **Secure API Key Storage:** Your OpenAI API key is stored securely in your browser's local storage and is never shared.
- **Markdown Support:** The bot's responses are beautifully formatted with lists, bolding, and more for easy readability.
- **User-Friendly UX:** Includes loading animations for feedback, a welcome message, and a copy-to-clipboard button for the bot's answers.

### 🛠️ Built With

- JavaScript (ES6)
- HTML5 & CSS3
- Chrome Extension APIs (Manifest V3)
- [OpenAI API](https://platform.openai.com/docs/api-reference)
- [markdown-it](https://github.com/markdown-it/markdown-it) for rendering formatted responses.

---

## 🚀 Getting Started

Follow these steps to get the extension up and running on your local machine.

### Prerequisites

You will need an API key from OpenAI to use this extension.

- Sign up or log in at [OpenAI Platform](https://platform.openai.com/).
- Navigate to the [API keys](https://platform.openai.com/api-keys) section and create a new secret key.
- **Note:** Using the OpenAI API is a paid service. While it's very cheap for this kind of usage, please be aware of the costs.

### Installation

1. **Clone the repository (or download the ZIP)**

   ```sh
   git clone https://github.com/your-username/youtube-chatbot.git
   ```

   (Or download the ZIP and extract it to a folder on your computer).
2. **Open Google Chrome** and navigate to the extensions page by typing `chrome://extensions` in the address bar.
3. **Enable Developer Mode** by clicking the toggle switch in the top-right corner of the page.
4. **Load the Extension**

   - Click the **"Load unpacked"** button that appears.
   - In the file dialog, navigate to and select the `youtube-chatbot` folder that you cloned or downloaded.
5. The **YouTube Chatbot** extension should now appear in your list of extensions and in your Chrome toolbar!

---

## 📖 How to Use

1. **Navigate to a YouTube Video**
   Open any YouTube video that has subtitles/captions available.
2. **Open the Extension**
   Click the YouTube Chatbot icon in your Chrome toolbar.
3. **Enter Your API Key**
   The first time you use the extension, it will ask for your OpenAI API key. Paste your key and click "Save Key". This is a one-time setup.
4. **Get the Transcript**
   Click the **"Get Video Transcript"** button. A loader will appear, and in a few seconds, the status will update and the chatbot will greet you.
5. **Start Chatting!**
   You can now ask questions about the video's content. For example:

   - `"Can you summarize this video in 5 points?"`
   - `"What are the main arguments made by the speaker?"`
   - `"Explain the section about artificial intelligence."`

---

## 📂 Project Structure

Here's a brief overview of the files in this project:

**youtube-chatbot/**
├── manifest.json # The core configuration file for the extension.
├── popup.html # The HTML structure for the extension's popup UI.
├── style.css # The CSS for styling the popup.
├── popup.js # The main JavaScript logic for the UI, user input, and API calls.
├── content.js # The script that runs on the YouTube page to extract the transcript.
├── background.js # A service worker to manage communication between scripts.
└── markdown-it.min.js # The library used for rendering formatted chat responses.


---
## 🙏 Acknowledgments

-   Inspiration for the final transcript extraction method came from the [yt-transcript.js script](https://gist.github.com/iulian-onofrei/9e37b39b972304da1a2729a6338b816a) and the associated [Medium article](https://medium.com/@aqib-2/extract-youtube-transcripts-using-innertube-api-2025-javascript-guide-dc417b762f49).
---
## 📄 License

Distributed under the MIT License. See `LICENSE` for more information.
*(Note: You can create a file named `LICENSE` in your folder and paste the standard MIT License text into it if you wish.)*
