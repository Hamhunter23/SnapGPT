// Listen for download requests from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "download_pdf") {
    console.log('[Background] Received download_pdf action:', request);
    chrome.downloads.download({
      url: request.url,
      filename: request.filename,
      saveAs: false
    }, (downloadId) => {
      if (chrome.runtime.lastError) {
        console.error('[Background] Download failed:', chrome.runtime.lastError);
        sendResponse({ success: false, error: chrome.runtime.lastError.message });
      } else {
        console.log('[Background] Download started with ID:', downloadId);
        sendResponse({ success: true });
      }
    });
    return true;
  }
  return false;
}); 