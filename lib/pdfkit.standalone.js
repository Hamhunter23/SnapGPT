// PDFDocument module
(function(global) {
  if (global.PDFDocument) {
    // PDFDocument already exists, don't redefine
    return;
  }

  class PDFDocument {
    constructor(options = {}) {
      this.options = {
        size: 'A4',
        margin: 50,
        lineGap: 4, // Add default line gap
        ...options
      };
      this.currentPage = 0;
      this.pages = [];
      this.currentY = this.options.margin; // Track current Y position
      this.currentFontSize = 12; // Default font size
      this.lineGap = this.options.lineGap;
      this.addPage();
    }

    fontSize(size) {
      this.currentFontSize = size;
      return this;
    }

    font(fontName) {
      this.currentFont = fontName;
      return this;
    }

    fillColor(color) {
      // Convert hex color to RGB format
      if (color.startsWith('#')) {
        const r = parseInt(color.slice(1, 3), 16) / 255;
        const g = parseInt(color.slice(3, 5), 16) / 255;
        const b = parseInt(color.slice(5, 7), 16) / 255;
        this.currentColor = `${r.toFixed(3)} ${g.toFixed(3)} ${b.toFixed(3)}`;
      } else {
        this.currentColor = color;
      }
      return this;
    }

    addPage() {
      this.currentPage++;
      this.currentY = this.options.margin;
      this.pages.push({
        content: [],
        height: 0
      });
      return this;
    }

    text(text, options = {}) {
      const words = text.split(' ');
      let line = '';
      
      for (let i = 0; i < words.length; i++) {
        const testLine = line + words[i] + ' ';
        const metrics = this.getTextMetrics(testLine);
        
        if (metrics.width > this.getPageWidth() - (2 * this.options.margin)) {
          this.addTextToPage(line, this.currentY);
          line = words[i] + ' ';
          this.currentY += metrics.height + this.lineGap;
          
          if (this.currentY > this.getPageHeight() - this.options.margin) {
            this.addPage();
            this.currentY = this.options.margin;
          }
        } else {
          line = testLine;
        }
      }
      
      if (line.trim().length > 0) {
        this.addTextToPage(line, this.currentY);
        this.currentY += this.getTextMetrics(line).height + this.lineGap;
      }
      
      return this;
    }

    addTextToPage(text, y, x) {
      const currentX = x !== undefined ? x : this.options.margin; 
      const currentPage = this.pages[this.currentPage - 1];
      currentPage.content.push({
        type: 'text',
        text: text, 
        x: currentX, 
        y: y,
        fontSize: this.currentFontSize,
        font: this.currentFont || 'Helvetica',
        color: this.currentColor || '0 0 0'
      });
      currentPage.height = Math.max(currentPage.height, y + (this.currentFontSize * 1.2)); 
    }

    getPageWidth() {
      return 595.28; // A4 width in points
    }

    getPageHeight() {
      return 841.89; // A4 height in points
    }

    getTextMetrics(text) {
      // More accurate text metrics calculation
      const fontSize = this.currentFontSize || 12;
      return {
        width: text.length * (fontSize * 0.5), // Approximate width based on font size
        height: fontSize * 1.2 // Line height based on font size
      };
    }

    moveDown(lines = 1) {
      const lineHeight = this.currentFontSize + this.lineGap;
      const totalMove = lineHeight * lines;
      this.currentY += totalMove;
      
      // Check if we need a new page
      if (this.currentY > this.getPageHeight() - this.options.margin) {
        this.addPage();
        this.currentY = this.options.margin;
      }
      
      return this;
    }

    renderMarkdown(markdownText) {
      if (!markdownText || typeof markdownText !== 'string') return this;

      const lines = markdownText.trim().split('\n');
      let inCodeBlock = false;
      let codeLang = '';

      for (let i = 0; i < lines.length; i++) {
        let line = lines[i];

        // --- Code Block Handling ---
        if (line.startsWith('```')) {
          if (!inCodeBlock) {
            inCodeBlock = true;
            codeLang = line.substring(3).trim(); 
            this.moveDown(0.5); 
            continue; 
          } else {
            inCodeBlock = false;
            this.moveDown(0.5); 
            continue; 
          }
        }
        if (inCodeBlock) {
          this.font('Courier').fontSize(10).fillColor('#333333');
          this.text(line); // Use standard text for code blocks to get wrapping
          continue; 
        }
        
        // Reset to default font/size/color for paragraphs/lists etc.
        this.font('Helvetica').fontSize(11).fillColor('#000000');

        // --- Block Element Handling ---
        let isBlockElement = false;

        // Headings
        if (line.startsWith('#')) {
          const level = line.match(/^#+/)[0].length;
          const text = line.substring(level).trim();
          const fontSize = Math.max(11, 18 - level * 2);
          this.font('Helvetica-Bold').fontSize(fontSize).text(text);
          this.moveDown(level <= 2 ? 0.8 : 0.5);
          isBlockElement = true;
        }
        // Horizontal Rule
        else if (line.match(/^---+$/)) {
          this.moveDown(0.5);
          this.moveDown(1); // Add space for HR
          isBlockElement = true;
        }
        // Blockquotes
        else if (line.startsWith('>')) {
            const text = line.substring(1).trim();
            // TODO: Improve blockquote styling (indent?)
            this.fillColor('#555555'); // Keep color change
            this.text(text); // Use standard text for potential wrapping
            this.fillColor('#000000'); // Reset color
            isBlockElement = true; // Consider it block level for spacing
        }
        // Lists
        const listItemMatch = !isBlockElement && line.match(/^\s*([*\-+])\s+(.*)/);
        const orderedItemMatch = !isBlockElement && line.match(/^\s*(\d+)\.\s+(.*)/);
        if (listItemMatch) {
          const itemText = listItemMatch[2];
          // TODO: Handle inline bold/italic within list items if needed (complex)
           this.text(`• ${itemText}`); // Use standard text for wrapping
           isBlockElement = true;
        } else if (orderedItemMatch) {
          const itemNumber = orderedItemMatch[1];
          const itemText = orderedItemMatch[2];
          // TODO: Handle inline bold/italic within list items if needed (complex)
           this.text(`${itemNumber}. ${itemText}`); // Use standard text for wrapping
           isBlockElement = true;
        }

        // If it was handled as a block element, continue to next line
        if (isBlockElement) {
            continue;
        }

        // --- Handle regular paragraphs with inline bold ---
        if (line.trim()) {
            const boldRegex = /(\*{2}.*?\*{2})/g;
            const segments = line.split(boldRegex).filter(s => s && s.length > 0);
            let currentX = this.options.margin; // Start at the left margin for this line
            const pageContentWidth = this.getPageWidth() - this.options.margin; // Right boundary

            let lineProcessedInline = false; // Flag to check if we used inline logic

            if (segments.length > 1 || (segments.length === 1 && boldRegex.test(segments[0]))) {
                let hasBold = segments.some(segment => segment.startsWith('**') && segment.endsWith('**'));

                if (hasBold) {
                    lineProcessedInline = true; // We are processing this line segment by segment
                    let lineMaxHeight = 0; // Track max height for this line
                    segments.forEach(segment => {
                        let segmentText = segment;
                        let isBoldSegment = false;

                        if (segment.startsWith('**') && segment.endsWith('**')) {
                            segmentText = segment.slice(2, -2);
                            isBoldSegment = true;
                            this.font('Helvetica-Bold').fontSize(11);
                        } else {
                             this.font('Helvetica').fontSize(11);
                        }

                        if (segmentText) { 
                            const metrics = this.getTextMetrics(segmentText);
                            lineMaxHeight = Math.max(lineMaxHeight, metrics.height); // Update max height
                            
                            if (currentX + metrics.width > pageContentWidth) {
                                this.moveDown(1); 
                                currentX = this.options.margin; 
                            }
                            
                            this.addTextToPage(segmentText, this.currentY, currentX);
                            
                            // Revert to adding full width (no subtraction)
                            currentX += metrics.width; 
                        }
                    });
                    // Manually update currentY after processing all segments of the line
                    this.currentY += lineMaxHeight + this.lineGap; 
                    // Check for page break after manual Y update
                    if (this.currentY > this.getPageHeight() - this.options.margin) {
                        this.addPage();
                        this.currentY = this.options.margin;
                    }
                }
            }

            // If the line wasn't processed inline (no valid bold found), render it normally
            if (!lineProcessedInline) {
                 this.font('Helvetica').fontSize(11); // Ensure regular font
                 this.text(line.trim()); // Use the standard text method for wrapping
            }
        } else {
            // Handle empty lines - add a small space?
            this.moveDown(0.5); // Example: Add half line space for explicitly empty lines
        }

      }

      // NO final moveDown here - spacing is handled after each line/block

      return this;
    }

    escapeString(text) {
      // Escape PDF special characters and filter non-ASCII chars
      let result = '';
      for (let i = 0; i < text.length; i++) {
        const char = text[i];
        const charCode = text.charCodeAt(i);

        // Escape standard PDF special characters
        if (char === '(' || char === ')' || char === '\\') {
          result += '\\' + char;
        } 
        // Only include printable ASCII characters (32-126) and common whitespace (like tab 9, newline 10, return 13)
        else if ((charCode >= 32 && charCode <= 126) || charCode === 9 || charCode === 10 || charCode === 13) {
            result += char;
        } 
        // Replace other non-printable/non-ASCII chars with a placeholder or omit
        // else { result += '?'; } // Optional: replace with placeholder
      }
      return result;
    }

    pipe() {
      // Convert content to PDF format
      let pdfContent = '%PDF-1.7\n%\xFF\xFF\xFF\xFF\n';
      
      // Add objects
      let objects = [];
      
      // Add font objects
      objects.push({
        content: '1 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>\nendobj\n'
      });

      objects.push({
        content: '2 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>\nendobj\n'
      });

      objects.push({
        content: '3 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Courier /Encoding /WinAnsiEncoding >>\nendobj\n'
      });

      // Add page objects
      const pageRefs = [];
      this.pages.forEach((pageContent, pageNum) => {
        // Add page object
        const pageObjNum = 4 + (pageNum * 2);
        pageRefs.push(`${pageObjNum} 0 R`);
        
        objects.push({
          content: `${pageObjNum} 0 obj\n<< /Type /Page /MediaBox [0 0 ${this.getPageWidth()} ${this.getPageHeight()}] /Resources << /Font << /F1 1 0 R /F2 2 0 R /F3 3 0 R >> >> /Contents ${pageObjNum + 1} 0 R /Parent ${4 + (this.pages.length * 2)} 0 R >>\nendobj\n`
        });

        // Generate content stream for this page
        let contentStream = '';
        pageContent.content.forEach(item => {
          if (item.type === 'text') {
            // Map font names to their PDF object references
            const fontMap = {
              'Helvetica': 'F1',
              'Helvetica-Bold': 'F2',
              'Courier': 'F3'
            };
            
            const font = fontMap[item.font] || 'F1';
            const fontSize = item.fontSize || 12;
            const color = item.color || '0 0 0';
            const x = item.x || this.options.margin;
            const y = this.getPageHeight() - item.y - fontSize; // Adjust y-coordinate for PDF coordinate system
            
            // Escape special characters in the text
            const escapedText = this.escapeString(item.text);
            
            // Add text drawing operators to content stream
            contentStream += `BT\n`;
            contentStream += `/${font} ${fontSize} Tf\n`;
            contentStream += `${color} rg\n`;
            contentStream += `${x} ${y} Td\n`;
            contentStream += `(${escapedText}) Tj\n`;
            contentStream += `ET\n`;
          }
        });

        // Add content stream object
        objects.push({
          content: `${pageObjNum + 1} 0 obj\n<< /Length ${contentStream.length} >>\nstream\n${contentStream}endstream\nendobj\n`
        });
      });

      // Add pages object
      objects.push({
        content: `${4 + (this.pages.length * 2)} 0 obj\n<< /Type /Pages /Kids [${pageRefs.join(' ')}] /Count ${this.pages.length} >>\nendobj\n`
      });

      // Add catalog object
      objects.push({
        content: `${5 + (this.pages.length * 2)} 0 obj\n<< /Type /Catalog /Pages ${4 + (this.pages.length * 2)} 0 R >>\nendobj\n`
      });

      // Add all objects to PDF
      let offset = pdfContent.length;
      const xref = ['xref', '0 ' + (objects.length + 1), '0000000000 65535 f '];

      objects.forEach((obj, index) => {
        const paddedOffset = offset.toString().padStart(10, '0');
        xref.push(paddedOffset + ' 00000 n ');
        pdfContent += obj.content;
        offset = pdfContent.length;
      });

      // Add cross-reference table
      pdfContent += xref.join('\n') + '\n';

      // Add trailer
      pdfContent += 'trailer\n<< /Size ' + (objects.length + 1) + ' /Root ' + (5 + (this.pages.length * 2)) + ' 0 R >>\n';
      pdfContent += 'startxref\n' + offset + '\n%%EOF';

      return new Uint8Array(new TextEncoder().encode(pdfContent));
    }
  }

  // Blob creation helper
  function createPDFBlob(content) {
    return new Blob([content], { type: 'application/pdf' });
  }

  // Export to global scope
  global.PDFDocument = PDFDocument;
  global.createPDFBlob = createPDFBlob;
})(typeof window !== 'undefined' ? window : global); 