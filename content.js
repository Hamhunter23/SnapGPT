// Prevent script from running multiple times in the same context
if (!window.chatExporterScriptHasRun) {
  window.chatExporterScriptHasRun = true;

  console.log('[Exporter] Content script initialized.');

  // Global state
  let isExporting = false;

  // Listen for messages from the popup
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "export_chat") {
      console.log('[Exporter] Received export_chat action.');
      // Prevent multiple simultaneous exports
      if (isExporting) {
        console.warn('[Exporter] Export already in progress.');
        sendResponse({ success: false, error: "Export already in progress" });
        return false; // Indicate sync response
      }

      try {
        isExporting = true;
        console.log('[Exporter] Starting export process...');

        // Check if PDFDocument is available
        if (typeof PDFDocument === 'undefined') {
          isExporting = false; // Reset flag on error
          throw new Error('PDF generation library not loaded');
        }

        // Create a new PDF document
        const doc = new PDFDocument({
          margin: 50
        });
        console.log('[Exporter] PDFDocument created.');

        // Add title
        doc.font('Helvetica')
          .fontSize(14)
          .text('Conversation exported using SnapGPT', { align: 'center' })
          .moveDown();

        // Add export timestamp
        doc.fontSize(10)
          .text(`Exported on: ${new Date().toLocaleString()}`, { align: 'center' })
          .moveDown();

        // Find the chat thread
        const thread = document.querySelector('div[class*="react-scroll-to-bottom"]') ||
                      document.querySelector('div.chat-thread') ||
                      document.querySelector('main');

        if (!thread) {
          isExporting = false; // Reset flag on error
          throw new Error('Could not find chat thread element');
        }
        console.log('[Exporter] Found chat thread element:', thread);

        // Get all message groups - Use a more specific selector for message turns based on observed HTML
        let messageGroups = Array.from(thread.querySelectorAll('article[data-testid^="conversation-turn-"]')); // Use ARTICLE tag
        console.log('[Exporter] Found raw message groups (using article[data-testid] selector):', messageGroups.length);

        // If the primary selector failed, try a broader one as a fallback (less reliable for duplicates)
        if (messageGroups.length === 0) {
            console.log('[Exporter] article[data-testid] selector found no groups. Trying fallback selector (div[class*=group])...');
            // Fallback to finding divs with 'group' in class and a role attribute
            messageGroups = Array.from(thread.querySelectorAll('div[class*="group"][data-message-author-role]')); 
            console.log('[Exporter] Found raw message groups (using fallback selector):', messageGroups.length);
        }

        // Process each message group for uniqueness (Keep existing logic)
        const processedIds = new Set();
        const uniqueMessageGroups = messageGroups.filter(group => {
          const messageId = group.getAttribute('data-message-id');
          if (messageId) {
            if (processedIds.has(messageId)) { return false; }
            processedIds.add(messageId);
            return true;
          } else {
            const groupText = group.textContent?.trim();
            if (!groupText) { return false; }
            if (processedIds.has(groupText)) { return false; }
            processedIds.add(groupText);
            return true;
          }
        });

        console.log('[Exporter] Unique message groups after filtering:', uniqueMessageGroups.length);

        let messagesFound = 0; // Counter for successfully processed messages

        uniqueMessageGroups.forEach((group, groupIndex) => {
          const groupPrefix = `[Exporter Group ${groupIndex + 1}/${uniqueMessageGroups.length}]`;
          console.log(`${groupPrefix} Processing group...`);

          // --- Role Assignment (Alternating) ---
          const isUser = groupIndex % 2 === 0; // Assume user starts (index 0)
          const isAssistant = !isUser;
          const role = isUser ? 'user' : 'assistant';
          console.log(`${groupPrefix} Assigned Role (Alternating): ${role}`);

          // --- Content Selection ---
          let baseSelectors = [
            'div[class*="markdown"]', 'div.prose',
            'div[data-message-id] > div:first-child',
            'div[data-testid*="message-content"]', 'div.text-base', 'div.items-start',
            ':scope > div > div:not([class])'
          ];
          let userSpecificSelectors = [
              'div.text-message-content',
              'div[data-testid*="conversation-turn-"] div > div:not([class])',
              'div.items-start > div:first-child'
          ];

          let contentSelectors = isUser ? [...new Set([...userSpecificSelectors, ...baseSelectors])] : baseSelectors;

          console.log(`${groupPrefix} Using content selectors:`, contentSelectors);

          let messageContent = null;
          for (const selector of contentSelectors) {
              messageContent = group.querySelector(selector);
              if (messageContent) {
                  console.log(`${groupPrefix} Found content with selector: ${selector}`);
                  break;
              }
          }

          // Refined Fallbacks
          if (!messageContent) {
               console.log(`${groupPrefix} Structured selectors failed. Trying fallbacks...`);
               // 1. Direct child div with text but no nested divs
               messageContent = Array.from(group.querySelectorAll(':scope > div')).find(div => div.textContent?.trim().length > 2 && !div.querySelector('div'));
               if (messageContent) {
                   console.log(`${groupPrefix} Found content with fallback 1 (direct child div).`);
               } else {
                    // 2. Use the group itself if it seems simple and has text
                    if (group.children.length <= 1 && group.textContent?.trim().length > 2) {
                        messageContent = group;
                        console.log(`${groupPrefix} Found content with fallback 2 (group element itself).`);
                    } else {
                         // 3. Final fallback: Use group if it has any significant innerText
                         const groupInnerText = group.innerText?.trim();
                         if (groupInnerText && groupInnerText.length > 2) {
                            messageContent = group; // Use group, will process innerText later
                            console.log(`${groupPrefix} Found content with fallback 3 (using group.innerText).`);
                         } 
                    }
               }
          }

          // Log if content still not found
          if (!messageContent) {
              console.warn(`${groupPrefix} Could not find message content.`);
              console.log(`${groupPrefix} Group textContent:`, group.textContent?.trim()); // Log text content too
              console.log(`${groupPrefix} Group outerHTML:`, group.outerHTML);
              return; // Skip this group
          }
           console.log(`${groupPrefix} Found Message Content Element:`, messageContent);
           // Use innerText for logging if group itself was selected, otherwise textContent
           const logText = (messageContent === group) ? group.innerText : messageContent.textContent;
           console.log(`${groupPrefix} Content Text (start):`, logText?.substring(0, 100).trim() + '...');

          // --- Add to PDF ---
          messagesFound++;
          console.log(`${groupPrefix} Adding message ${messagesFound} to PDF (Role: ${role})`);
          doc.font('Helvetica-Bold')
              .fontSize(12)
              .fillColor(isAssistant ? '#10a37f' : '#444444')
              .text(isAssistant ? 'ChatGPT:' : 'You:')
              .moveDown(0.5);

          doc.font('Helvetica')
              .fontSize(11)
              .fillColor('#000000');

          // Use innerText if we used fallback 3, otherwise convert HTML
          const markdown = (messageContent === group && group.innerText?.trim().length > 2)
                            ? group.innerText.trim() // Use plain innerText if group itself was the best match
                            : convertHtmlToMarkdown(messageContent);

          console.log(`${groupPrefix} Converted Content (start): ${markdown.substring(0, 100)}...`);
          const blocks = markdown.split('\n\n').filter(block => block.trim());

          blocks.forEach((block, index) => {
              doc.renderMarkdown(block); // Still simplified
              if (index < blocks.length - 1) {
                doc.moveDown(0.5);
              }
          });
          doc.moveDown(1.5);
        });

        // Check if any messages were actually added
        if (messagesFound === 0) {
          isExporting = false; // Reset flag
          throw new Error('No valid message content found to export. The page structure might have changed, or the chat is empty.');
        }
        console.log(`[Exporter] Processed ${messagesFound} messages.`);

        // Generate PDF blob and trigger download
        console.log('[Exporter] Generating PDF blob...');
        const pdfBlob = createPDFBlob(doc.pipe());
        const url = URL.createObjectURL(pdfBlob);
        console.log('[Exporter] PDF blob created.');

        // Generate filename
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `ChatGPT-Conversation-${timestamp}.pdf`;

        // Trigger download via background script
        chrome.runtime.sendMessage({
          action: "download_pdf",
          url: url,
          filename: filename
        }, (response) => {
          // Clean up the object URL regardless of success
          URL.revokeObjectURL(url);
          console.log(`[Exporter] Revoked object URL: ${url}`);

          if (response && response.success) {
            console.log('[Exporter] Download message sent successfully.');
            sendResponse({ success: true });
          } else {
            console.error('[Exporter] Failed to send download message or background script reported failure.');
            sendResponse({ success: false, error: "Failed to initiate download via background script" });
          }
          // Ensure isExporting is reset *after* response/callback
          isExporting = false;
          console.log('[Exporter] Export process finished. isExporting reset.');
        });

        return true; // Keep the message channel open for the async response
      } catch (error) {
        console.error('[Exporter] Error during export_chat action:', error);
        // Ensure isExporting is reset in case of synchronous error
        isExporting = false;
        sendResponse({ success: false, error: error.message });
        return false; // Indicate sync response
      }
    }
    // Handle other potential messages if needed
    return false; // Default to sync response if action not handled
  });

  console.log('[Exporter] Content script listener attached.');

} else {
  console.log('[Exporter] Content script already run. Skipping initialization.');
}

// Helper function to convert HTML to Markdown
function convertHtmlToMarkdown(element) {
  // Basic check if element is null or undefined
  if (!element) return '';
  
  let markdown = '';
  element.childNodes.forEach(node => {
    if (node.nodeType === Node.TEXT_NODE) {
      // Preserve significant whitespace and line breaks more carefully
      markdown += node.textContent.replace(/ {2,}/g, ' ').replace(/\n\s*\n/g, '\n\n');
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const tagName = node.tagName.toLowerCase();
      const nodeContent = convertHtmlToMarkdown(node); // Recursive call

      switch (tagName) {
        case 'p': markdown += nodeContent + '\n\n'; break;
        case 'code':
          if (node.closest('pre')) { // More robust check for code block parent
            // Handled by 'pre' case to avoid duplication
          } else {
            markdown += '`' + nodeContent + '`'; // Inline code
          }
          break;
        case 'pre':
          // Find inner code element for language class, default to no language
          const codeElement = node.querySelector('code');
          const language = codeElement?.className.match(/language-(\w+)/)?.[1] || '';
          const codeText = codeElement?.textContent || node.textContent; // Get text content
          markdown += '\n```' + language + '\n' + codeText.trim() + '\n```\n\n';
          break;
        case 'strong': case 'b': markdown += '**' + nodeContent + '**'; break;
        case 'em': case 'i': markdown += '*' + nodeContent + '*'; break;
        case 'ol':
          markdown += '\n';
          Array.from(node.children).forEach((item, index) => {
            if (item.tagName.toLowerCase() === 'li') { markdown += `${index + 1}. ${convertHtmlToMarkdown(item).trim()}\n`; }
          });
          markdown += '\n'; break;
        case 'ul':
          markdown += '\n';
          Array.from(node.children).forEach(item => {
            if (item.tagName.toLowerCase() === 'li') { markdown += `* ${convertHtmlToMarkdown(item).trim()}\n`; }
          });
          markdown += '\n'; break;
        case 'blockquote': markdown += '> ' + nodeContent.split('\n').map(l => l.trim()).filter(l => l).join('\n> ') + '\n\n'; break;
        case 'a': markdown += `[${nodeContent}](${node.getAttribute('href')})`; break;
        case 'img': markdown += `![${node.getAttribute('alt') || ''}](${node.getAttribute('src')})`; break;
        case 'hr': markdown += '\n---\n\n'; break;
        case 'br': markdown += '  \n'; break; // Markdown line break
        case 'h1': markdown += '# ' + nodeContent + '\n\n'; break;
        case 'h2': markdown += '## ' + nodeContent + '\n\n'; break;
        case 'h3': markdown += '### ' + nodeContent + '\n\n'; break;
        case 'h4': markdown += '#### ' + nodeContent + '\n\n'; break;
        case 'h5': markdown += '##### ' + nodeContent + '\n\n'; break;
        case 'h6': markdown += '###### ' + nodeContent + '\n\n'; break;
        case 'table': markdown += convertTableToMarkdown(node) + '\n\n'; break;
        // Skip script/style tags and other non-content elements
        case 'script': case 'style': break; 
        default: markdown += nodeContent; // Process children of unknown tags
      }
    }
  });
  // Trim final result and clean up excessive newlines
  return markdown.trim().replace(/\n{3,}/g, '\n\n');
}

// Helper function to convert HTML Table to Markdown
function convertTableToMarkdown(table) {
  if (!table) return '';
  let markdown = '\n';
  const rows = Array.from(table.rows);
  if (rows.length > 0) {
    // Header Row
    const headerCells = Array.from(rows[0].cells);
    markdown += '| ' + headerCells.map(cell => convertHtmlToMarkdown(cell).trim().replace('|', '\\|')).join(' | ') + ' |\n';
    markdown += '| ' + headerCells.map(() => '---').join(' | ') + ' |\n';
    // Data Rows
    for (let i = 1; i < rows.length; i++) {
      const cells = Array.from(rows[i].cells);
      markdown += '| ' + cells.map(cell => convertHtmlToMarkdown(cell).trim().replace('|', '\\|')).join(' | ') + ' |\n';
    }
  }
  return markdown;
}

// Helper function to create Blob
function createPDFBlob(pdfContent) {
  return new Blob([pdfContent], { type: 'application/pdf' });
} 