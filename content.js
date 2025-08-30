// Listen for a message from the popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "getTranscript") {
        getTranscriptWithInnerTube().then(transcript => {
            if (typeof transcript === 'string' && transcript.startsWith('Error:')) {
                sendResponse({ error: transcript.substring(7) });
            } else {
                sendResponse({ transcript: transcript });
            }
        }).catch(error => {
            sendResponse({ error: error.message });
        });
        return true; // Indicates that the response is asynchronous
    }
});

/**
 * Extracts the necessary API key and client version from the page's scripts.
 * This mimics the logic of the successful Node.js script.
 * @returns {object|null} An object with apiKey and clientVersion, or null.
 */
function getInnertubeConfig() {
    for (const script of document.getElementsByTagName("script")) {
        const text = script.textContent;
        if (text.includes("INNERTUBE_API_KEY")) {
            const keyMatch = text.match(/"INNERTUBE_API_KEY":"([^"]+)"/);
            const verMatch = text.match(/"INNERTUBE_CLIENT_VERSION":"([^"]+)"/);
            const apiKey = keyMatch?.[1];
            const clientVersion = verMatch?.[1];
            if (apiKey && clientVersion) {
                console.log("Found Innertube API Key and Client Version.");
                return { apiKey, clientVersion };
            }
        }
    }
    console.error("Could not find Innertube API Key or Client Version.");
    return null;
}

/**
 * Main function to get transcript using the InnerTube API, inspired by the Node.js script.
 */
async function getTranscriptWithInnerTube() {
    try {
        const config = getInnertubeConfig();
        if (!config) {
            throw new Error("Could not retrieve Innertube credentials from the page.");
        }
        const { apiKey, clientVersion } = config;

        const videoId = new URLSearchParams(window.location.search).get('v');
        if (!videoId) throw new Error("Could not find video ID in the URL.");

        // Construct a clean, simple context object, just like the Node.js script.
        const payload = {
            context: {
                client: {
                    clientName: "WEB",
                    clientVersion: clientVersion,
                    hl: "en",
                    gl: "US",
                },
            },
            videoId: videoId
        };

        const response = await fetch(`https://www.youtube.com/youtubei/v1/player?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) throw new Error(`Innertube API request failed: ${response.status}`);
        
        const data = await response.json();
        const captionTracks = data?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
        if (!captionTracks || captionTracks.length === 0) {
             const reason = data?.playabilityStatus?.reason || "No caption tracks found (captions may be disabled).";
             throw new Error(reason);
        }
        
        // Use the same track picking logic as the Node.js script for consistency
        const track = captionTracks.find(t => t.languageCode === 'en') || 
                      captionTracks.find(t => t.languageCode?.startsWith('en')) || 
                      captionTracks[0];
                      
        if (!track) throw new Error("Could not find a suitable caption track.");

        const transcriptResponse = await fetch(track.baseUrl);
        if (!transcriptResponse.ok) throw new Error("Failed to fetch the final transcript file.");
        
        const rawData = await transcriptResponse.text();
        if (!rawData || rawData.trim() === "") throw new Error("Downloaded transcript file was empty.");
        
        const transcript = parseTranscriptXML(rawData);
        if (!transcript) throw new Error("Fetched transcript data, but failed to parse it.");
        
        console.log("Successfully retrieved and parsed transcript!");
        return transcript;

    } catch (error) {
        console.error("YouTube Chatbot Error:", error);
        return `Error: ${error.message}`;
    }
}

/**
 * Parses the TimedText XML format into a simple string.
 * This mimics the parsing logic of the Node.js script.
 * @param {string} xmlText The raw XML transcript data.
 * @returns {string|null} The full transcript string without timestamps.
 */
function parseTranscriptXML(xmlText) {
    try {
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlText, "text/xml");
        const textNodes = xmlDoc.querySelectorAll('text, p');
        let fullText = "";
        
        // Use a textarea element to correctly decode HTML entities like &#39;
        const tempElement = document.createElement('textarea');
        
        textNodes.forEach(node => {
            tempElement.innerHTML = node.textContent;
            fullText += tempElement.value + " ";
        });

        const processed = fullText.replace(/\s+/g, ' ').trim();
        return processed || null;

    } catch(e) {
        console.error("Error parsing transcript XML:", e);
        return null;
    }
}