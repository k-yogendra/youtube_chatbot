chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "getTranscript") {
        // Forward the message to the content script in the active tab
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0]) {
                chrome.tabs.sendMessage(tabs[0].id, request, (response) => {
                    if (chrome.runtime.lastError) {
                        // Handle error if the content script isn't ready
                        sendResponse({ error: "Could not connect to the YouTube page. Please refresh the page and try again." });
                    } else {
                        sendResponse(response);
                    }
                });
            }
        });
        return true; // Keep the message channel open for the asynchronous response
    }
});