import React, { useEffect, useRef, useState } from 'react';
import { generateQRCodeDataUrl, renderBarcodeOnCanvas } from '../../utils/barcodeUtils';
import { printHtmlViaHiddenIframe, downloadPrintableHtml, openInNewTabAndPrint } from '../../utils/printUtils';
import { QrCode, Barcode, Printer, Copy, Check, X, Download, ExternalLink } from 'lucide-react';

interface QRBarcodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  qrValue: string;
  barcodeValue: string;
  entityType: 'DOCUMENT' | 'LOCATION';
  entityCode: string;
  pathString?: string;
}

export const QRBarcodeModal: React.FC<QRBarcodeModalProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  qrValue,
  barcodeValue,
  entityType,
  entityCode,
  pathString
}) => {
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);
  const [isPrinting, setIsPrinting] = useState<boolean>(false);
  const barcodeCanvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (isOpen) {
      // Generate QR
      generateQRCodeDataUrl(qrValue).then(url => setQrDataUrl(url));

      // Render Barcode
      setTimeout(() => {
        if (barcodeCanvasRef.current && barcodeValue) {
          renderBarcodeOnCanvas(barcodeCanvasRef.current, barcodeValue);
        }
      }, 50);
    }
  }, [isOpen, qrValue, barcodeValue]);

  if (!isOpen) return null;

  const handleCopyCode = () => {
    navigator.clipboard.writeText(qrValue);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getTagHtml = (): string => {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>${entityType === 'DOCUMENT' ? 'Document Tag' : 'Location Storage Tag'} - ${entityCode}</title>
        <style>
          @page { size: auto; margin: 10mm; }
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            background: #ffffff;
            color: #0f172a;
            display: flex;
            justify-content: center;
            padding: 20px;
          }
          .tag-card {
            border: 2px solid #0f172a;
            border-radius: 16px;
            padding: 24px;
            max-width: 360px;
            width: 100%;
            text-align: center;
            box-sizing: border-box;
          }
          .badge {
            display: inline-block;
            background: #e0e7ff;
            color: #3730a3;
            font-family: monospace;
            font-weight: 800;
            font-size: 12px;
            padding: 4px 10px;
            border-radius: 6px;
            margin-bottom: 8px;
            letter-spacing: 0.5px;
          }
          .title {
            font-size: 16px;
            font-weight: 800;
            margin: 4px 0;
            line-height: 1.3;
          }
          .subtitle {
            font-size: 12px;
            color: #64748b;
            margin-bottom: 8px;
          }
          .loc-path {
            font-size: 11px;
            font-family: monospace;
            background: #f1f5f9;
            padding: 6px 10px;
            border-radius: 8px;
            margin: 10px 0;
            text-align: left;
            word-break: break-word;
          }
          .qr-container {
            border: 1px solid #cbd5e1;
            padding: 10px;
            border-radius: 12px;
            margin: 12px auto;
            width: 190px;
            height: 190px;
            display: flex;
            align-items: center;
            justify-content: center;
          }
          .qr-container img {
            width: 100%;
            height: 100%;
            object-fit: contain;
          }
          .qr-label {
            font-size: 10px;
            font-family: monospace;
            color: #475569;
            font-weight: 700;
            margin-top: 4px;
            word-break: break-all;
          }
        </style>
      </head>
      <body>
        <div class="tag-card">
          <span class="badge">${entityCode}</span>
          <div class="title">${title}</div>
          ${subtitle ? `<div class="subtitle">${subtitle}</div>` : ''}
          ${pathString ? `<div class="loc-path">📍 ${pathString}</div>` : ''}
          <div class="qr-container">
            ${qrDataUrl ? `<img src="${qrDataUrl}" alt="QR" />` : ''}
          </div>
          <div class="qr-label">${qrValue}</div>
        </div>
      </body>
      </html>
    `;
  };

  const handlePrint = async () => {
    setIsPrinting(true);
    try {
      const html = getTagHtml();
      await printHtmlViaHiddenIframe(html);
    } catch (e) {
      window.print();
    } finally {
      setIsPrinting(false);
    }
  };

  const handleDownload = () => {
    const html = getTagHtml();
    downloadPrintableHtml(html, `Tag-${entityCode}.html`);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 max-w-md w-full overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40">
          <div className="flex items-center gap-2">
            <QrCode className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            <h3 className="font-semibold text-slate-900 dark:text-slate-100">
              {entityType === 'DOCUMENT' ? 'Document Tag' : 'Location Storage Tag'}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Printable Physical Tag Content */}
        <div className="p-6 space-y-5 text-center printable-area">
          <div>
            <span className="inline-block px-2.5 py-0.5 text-xs font-mono font-bold tracking-wider uppercase bg-indigo-100 text-indigo-800 dark:bg-indigo-900/50 dark:text-indigo-300 rounded-md mb-1">
              {entityCode}
            </span>
            <h4 className="text-lg font-bold text-slate-900 dark:text-slate-100 line-clamp-2">
              {title}
            </h4>
            {subtitle && (
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                {subtitle}
              </p>
            )}
            {pathString && (
              <p className="text-[11px] font-mono text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 p-2 rounded-lg mt-2 text-left line-clamp-2">
                📍 {pathString}
              </p>
            )}
          </div>

          {/* QR Code Graphic */}
          <div className="flex flex-col items-center justify-center p-3 bg-white border border-slate-200 rounded-xl shadow-inner mx-auto max-w-[220px]">
            {qrDataUrl ? (
              <img src={qrDataUrl} alt={`QR Code for ${qrValue}`} className="w-48 h-48" />
            ) : (
              <div className="w-48 h-48 flex items-center justify-center text-slate-400 text-xs">
                Generating QR...
              </div>
            )}
            <span className="text-[11px] font-mono font-semibold text-slate-700 mt-1">
              {qrValue}
            </span>
          </div>

          {/* Barcode Graphic */}
          <div className="flex flex-col items-center justify-center p-2 bg-white border border-slate-200 rounded-xl shadow-inner">
            <canvas ref={barcodeCanvasRef} className="max-w-full h-auto" />
          </div>
        </div>

        {/* Actions Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopyCode}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
              {copied ? 'Copied' : 'Copy Code'}
            </button>

            <button
              type="button"
              onClick={handleDownload}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
              title="Download standalone HTML tag"
            >
              <Download className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              <span>Download</span>
            </button>
          </div>

          <button
            type="button"
            disabled={isPrinting}
            onClick={handlePrint}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 shadow-sm transition-colors cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            {isPrinting ? 'Opening...' : 'Print Tag'}
          </button>
        </div>
      </div>
    </div>
  );
};
