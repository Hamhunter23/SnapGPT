document.addEventListener('DOMContentLoaded', function() {
  console.log('Popup loaded');
  const exportButton = document.getElementById('exportButton');
  const statusText = document.getElementById('status');
  
  // First, check if we're on the ChatGPT website
  chrome.tabs.query({active: true, currentWindow: true}, async function(tabs) {
    console.log('Current tab:', tabs[0]);
    const currentUrl = tabs[0].url;
    
    // Check for both old and new ChatGPT domains
    if (!currentUrl.includes('chat.openai.com') && !currentUrl.includes('chatgpt.com')) {
      console.log('Not on ChatGPT website');
      // Disable the button and show a message if not on ChatGPT
      exportButton.disabled = true;
      exportButton.textContent = "Please navigate to ChatGPT";
      exportButton.style.backgroundColor = "#ccc";
      exportButton.style.cursor = "not-allowed";
      
      // Create and show an error message
      const errorMsg = document.createElement('div');
      errorMsg.textContent = "This extension only works on ChatGPT";
      errorMsg.style.color = "#ff4a4a";
      errorMsg.style.marginTop = "10px";
      errorMsg.style.fontSize = "12px";
      errorMsg.style.textAlign = "center";
      document.body.appendChild(errorMsg);
      return;
    }
    
    console.log('On ChatGPT website, setting up click handler');
    // If on the ChatGPT site, set up the click handler
    exportButton.addEventListener('click', async function() {
      try {
        // Disable the button while processing
        exportButton.disabled = true;
        statusText.textContent = 'Preparing export...';

        // Get the active tab
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        
        if (!tab) {
          throw new Error('No active tab found');
        }

        // Check if we're on a ChatGPT page
        if (!tab.url.includes('chat.openai.com') && !tab.url.includes('chatgpt.com')) {
          throw new Error('Please navigate to ChatGPT to export a conversation');
        }

        // Inject content scripts
        statusText.textContent = 'Initializing...';
        try {
          await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: ['lib/pdfkit.standalone.js']
          });
          console.log('PDFKit script injected');

          await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: ['content.js']
          });
          console.log('Content script injected');

          // Wait a brief moment for scripts to initialize
          await new Promise(resolve => setTimeout(resolve, 500));
        } catch (err) {
          console.error('Error injecting scripts:', err);
          throw new Error('Failed to initialize. Please refresh the page and try again.');
        }

        statusText.textContent = 'Exporting conversation...';

        // Send message to content script with timeout
        const response = await Promise.race([
          chrome.tabs.sendMessage(tab.id, { action: "export_chat" }),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Export timed out. Please refresh the page and try again.')), 30000)
          )
        ]);

        if (!response) {
          throw new Error('No response from content script. Please refresh the page and try again.');
        }

        if (!response.success) {
          throw new Error(response.error || 'Failed to export conversation');
        }

        // Success!
        statusText.textContent = 'Conversation exported successfully!';
        statusText.style.color = '#10a37f';
        
        // Reset button after 3 seconds
        setTimeout(() => {
          exportButton.disabled = false;
          statusText.textContent = '';
        }, 3000);

      } catch (error) {
        console.error('Export error:', error);
        statusText.textContent = error.message;
        statusText.style.color = '#ff4a4a';
        
        // Reset button after 3 seconds
        setTimeout(() => {
          exportButton.disabled = false;
          statusText.textContent = '';
        }, 3000);
      }
    });
  });
}); 