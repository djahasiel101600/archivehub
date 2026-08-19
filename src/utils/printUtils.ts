/**
 * Universal Printing Utility
 * Supports isolated hidden iframe printing (which bypasses parent CSS and works inside complex React apps),
 * fallback direct window.print, and standalone downloadable printable sticker sheets.
 */

export function printHtmlViaHiddenIframe(htmlContent: string): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      // Remove any existing print frame
      const existingFrame = document.getElementById('archive-hub-print-frame');
      if (existingFrame) {
        existingFrame.remove();
      }

      const iframe = document.createElement('iframe');
      iframe.id = 'archive-hub-print-frame';
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = '0';
      iframe.style.visibility = 'hidden';

      document.body.appendChild(iframe);

      const frameDoc = iframe.contentWindow?.document || iframe.contentDocument;
      if (!frameDoc || !iframe.contentWindow) {
        console.warn('Could not access iframe document, falling back to window.print()');
        window.print();
        resolve(false);
        return;
      }

      frameDoc.open();
      frameDoc.write(htmlContent);
      frameDoc.close();

      // Allow images and fonts to render before printing
      setTimeout(() => {
        try {
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();
          resolve(true);
        } catch (printErr) {
          console.warn('iframe.print() failed, falling back to window.print():', printErr);
          window.print();
          resolve(false);
        } finally {
          setTimeout(() => {
            iframe.remove();
          }, 2000);
        }
      }, 350);
    } catch (err) {
      console.error('printHtmlViaHiddenIframe error:', err);
      try {
        window.print();
      } catch (e) {}
      resolve(false);
    }
  });
}

/**
 * Downloads a standalone, self-contained printable HTML sticker sheet file.
 */
export function downloadPrintableHtml(htmlContent: string, fileName: string = 'Document-Archive-Tags.html'): void {
  const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Opens printable sticker sheet in a new browser tab/window for printing.
 */
export function openInNewTabAndPrint(htmlContent: string): void {
  const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const newWin = window.open(url, '_blank');
  if (!newWin) {
    // If popup blocked, fallback to hidden iframe printing
    printHtmlViaHiddenIframe(htmlContent);
  }
}
