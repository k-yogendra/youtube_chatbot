// Listen for a message from the popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "getTranscript") {
        getTranscriptWithInnerTube().then(videoData => {
            if (videoData.error) {
                sendResponse({ error: videoData.error });
            } else {
                sendResponse({ videoData: videoData });
            }
        }).catch(error => {
            sendResponse({ error: error.message });
        });
        return true; // Indicates that the response is asynchronous
    }
});

/**
 * Extracts the video's title and description from the page.
 * @returns {{title: string, description: string}}
 */
function getVideoMetadata() {
    const title = document.querySelector('h1.ytd-video-primary-info-renderer yt-formatted-string')?.textContent.trim() || 'Title not found';
    
    const descriptionContainer = document.querySelector('#description-inline-expander .content, #description .content');
    const description = descriptionContainer?.textContent.trim() || 'Description not found';
    
    return { title, description };
}

/**
 * Extracts the necessary API key and client version from the page's scripts.
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
 * Main function to get transcript and metadata using the InnerTube API.
 */
async function getTranscriptWithInnerTube() {
    try {
        // 1. Get metadata from the page first.
        const metadata = getVideoMetadata();

        // 2. Get the transcript using the API (existing logic).
        const config = getInnertubeConfig();
        if (!config) throw new Error("Could not retrieve Innertube credentials from the page.");
        const { apiKey, clientVersion } = config;

        const videoId = new URLSearchParams(window.location.search).get('v');
        if (!videoId) throw new Error("Could not find video ID in the URL.");

        // Construct a clean, simple context object.
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
        
        console.log("Successfully retrieved transcript, title, and description!");
        
        // 3. Combine all data into a single object to send back.
        return {
            transcript: transcript,
            title: metadata.title,
            description: metadata.description
        };

    } catch (error) {
        console.error("YouTube Chatbot Error:", error);
        return { error: error.message };
    }
}

/**
 * Parses the TimedText XML format into a simple string.
 * @param {string} xmlText The raw XML transcript data.
 * @returns {string|null} The full transcript string without timestamps.
 */
function parseTranscriptXML(xmlText) {
    try {
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlText, "text/xml");
        const textNodes = xmlDoc.querySelectorAll('text, p');
        let fullText = "";
        
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