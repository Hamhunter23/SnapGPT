# SnapGPT: ChatGPT PDF Exporter
<img src="https://github.com/user-attachments/assets/ddcd166d-8257-4477-9484-f78c8d03fab9" alt="icon16" width="90"/>

A Chrome extension that allows you to export your ChatGPT conversations directly to PDF files.

## Features

- Export ChatGPT conversations with a single click directly to PDF.
- Attempts to preserve basic markdown formatting, including:
    - Headings (`#`, `##`, etc.)
    - **Bold text** (`**text**`)
    - Code blocks (```) using Courier font
    - Unordered lists (`*`, `-`)
    - Ordered lists (`1.`, `2.`)
    - Blockquotes (`>`) (basic styling)
- Alternating User/ChatGPT role assignment (assumes User starts).
- Works on both `chat.openai.com` and `chatgpt.com` domains.
- Includes a timestamp in the filename.

## Installation

1.  Download or clone this repository.
2.  Open Chrome and navigate to `chrome://extensions/`.
3.  Enable "Developer mode" using the toggle in the top-right corner.
4.  Click the "Load unpacked" button.
5.  Select the directory where you downloaded/cloned the repository.
6.  The SnapGPT extension icon should appear in your toolbar.

*(Ensure you have the necessary icon files (`icon16.png`, `icon48.png`, `icon128.png`) in the `images` directory as specified in `manifest.json`.)*

## Usage

1.  Navigate to an active ChatGPT conversation page on `chat.openai.com` or `chatgpt.com`.
2.  Click the SnapGPT extension icon in your browser toolbar.
3.  Click the "Export Conversation" button in the popup.
4.  The PDF file will be downloaded automatically to your default download location.

## Known Limitations & Troubleshooting

-   **HTML Structure Dependency:** The extension relies on finding specific HTML elements and attributes (like `article[data-testid^="conversation-turn-"]` and internal content divs) on the ChatGPT page. If OpenAI significantly changes the page structure, the extension might fail to find messages or content. Check the browser's developer console (F12) for "[Exporter]" logs if issues occur.
-   **Role Assignment:** Message roles ("You:", "ChatGPT:") are assigned strictly based on alternating order, assuming the user sends the first message. This may be incorrect for conversations that start differently or have consecutive messages from the same role.
-   **Markdown Support:**
    -   Inline italics (`*text*`) and inline code (`` `code` ``) are **not** currently supported and will render as plain text.
    -   Links and images are **not** rendered in the PDF.
    -   Code blocks do not have a visual background.
    -   Blockquotes have minimal styling (color change only).
    -   Horizontal rules (`---`) are represented by vertical space, not a line.
    -   Table rendering might be incomplete.
-   **Text Spacing/Rendering:** Due to the method used for inline formatting (like bold text) and approximate text measurements, minor spacing inconsistencies or visual differences compared to the web view might occur.
-   **Non-ASCII Characters:** Characters outside the standard printable ASCII range may be filtered out or replaced in the final PDF due to font encoding limitations.
-   **"Failed to initiate download" Error:** If you see this, ensure the extension has the necessary "Downloads" permission and that there isn't an issue with the Chrome download system itself. Reloading the extension and the ChatGPT page might help.
-   **"PDF generation library not loaded" Error:** This might occur if the page or extension didn't load correctly. Try refreshing the ChatGPT page and potentially reloading the extension via `chrome://extensions/`.

## Technology

-   **PDF Generation:** `pdfkit.standalone.js` (a bundled version of PDFKit) running within the content script.
-   **Message Extraction:** DOM manipulation in `content.js` using `querySelectorAll`.
-   **HTML to Markdown:** Basic conversion logic in `content.js`.
-   **Markdown to PDF:** Rendering logic within `pdfkit.standalone.js`.
-   **Download:** Chrome Extension APIs (`chrome.runtime.sendMessage`, `chrome.downloads`).

## License

MIT 
