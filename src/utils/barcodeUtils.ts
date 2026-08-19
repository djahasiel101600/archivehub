import QRCode from 'qrcode';
import JsBarcode from 'jsbarcode';

/**
 * Generate a QR Code Data URL string for image rendering.
 */
export async function generateQRCodeDataUrl(text: string): Promise<string> {
  try {
    return await QRCode.toDataURL(text, {
      margin: 1,
      width: 280,
      color: {
        dark: '#1e293b',
        light: '#ffffff'
      }
    });
  } catch (err) {
    console.error('Failed to generate QR Code:', err);
    return '';
  }
}

/**
 * Render Code 128 Barcode onto a canvas element.
 */
export function renderBarcodeOnCanvas(canvas: HTMLCanvasElement, text: string): void {
  try {
    JsBarcode(canvas, text, {
      format: 'CODE128',
      displayValue: true,
      fontSize: 14,
      height: 50,
      margin: 10,
      lineColor: '#0f172a',
      background: '#ffffff'
    });
  } catch (err) {
    console.error('Failed to render barcode:', err);
  }
}
