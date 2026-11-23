import React, { useState, useEffect } from 'react';
import { DocumentItem } from '../../types';
import { useArchive } from '../../context/ArchiveContext';
import { generateQRCodeDataUrl } from '../../utils/barcodeUtils';
import { printHtmlViaHiddenIframe, downloadPrintableHtml, openInNewTabAndPrint } from '../../utils/printUtils';
import { 
  Printer, 
  X, 
  Tag, 
  Building2, 
  ShieldCheck, 
  HardDrive,
  Copy,
  Check,
  Download,
  ExternalLink,
  Columns,
  Grid,
  Sparkles,
  FileText
} from 'lucide-react';

interface BulkTagPrintModalProps {
  documents: DocumentItem[];
  onClose: () => void;
}

export const BulkTagPrintModal: React.FC<BulkTagPrintModalProps> = ({
  documents,
  onClose
}) => {
  const { calculatePath, addNotification } = useArchive();
  const [tagFormat, setTagFormat] = useState<'standard' | 'compact' | 'spine'>('standard');
  const [columns, setColumns] = useState<1 | 2 | 3 | 4>(2);
  const [pageSize, setPageSize] = useState<'letter' | 'a4' | 'legal'>('letter');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [qrCodeMap, setQrCodeMap] = useState<Record<string, string>>({});
  const [isPrinting, setIsPrinting] = useState(false);

  // When format switches, recommend optimal column count while letting user override anytime
  const handleFormatChange = (newFormat: 'standard' | 'compact' | 'spine') => {
    setTagFormat(newFormat);
    if (newFormat === 'compact') {
      setColumns(3);
    } else if (newFormat === 'spine') {
      setColumns(3);
    } else {
      setColumns(2);
    }
  };

  // Generate real QR code image data URLs for all documents
  useEffect(() => {
    let isMounted = true;
    const generateAllQrs = async () => {
      const map: Record<string, string> = {};
      for (const doc of documents) {
        const qrString = doc.qrCode || `ARCHIVE-HUB://DOC/${doc.documentNumber}`;
        try {
          const url = await generateQRCodeDataUrl(qrString);
          map[doc.id] = url;
        } catch (e) {
          map[doc.id] = '';
        }
      }
      if (isMounted) {
        setQrCodeMap(map);
      }
    };
    generateAllQrs();
    return () => {
      isMounted = false;
    };
  }, [documents]);

  const generatePrintableHtml = (): string => {
    const isSpine = tagFormat === 'spine';
    const isCompact = tagFormat === 'compact';

    const stickersHtml = documents.map((doc, idx) => {
      const homePath = calculatePath(doc.homeLocationId);
      const qrUrl = qrCodeMap[doc.id] || '';

      if (isSpine) {
        return `
          <div class="sticker-spine cols-${columns}">
            <div class="spine-header">
              <span class="org-name">${doc.departmentName ? doc.departmentName.split(' ')[0] : 'ARCHIVE'}</span>
              <span class="idx-badge">#${idx + 1}</span>
            </div>
            <div class="doc-num">${doc.documentNumber}</div>
            <div class="doc-title">${doc.title}</div>
            <div class="spine-footer">
              <div class="ref-num">Ref: ${doc.referenceNumber || 'N/A'}</div>
              <div class="loc-badge">Loc: ${homePath}</div>
            </div>
          </div>
        `;
      }

      if (isCompact) {
        return `
          <div class="sticker-compact cols-${columns}">
            <div class="compact-header">
              <div class="compact-header-left">
                <div class="org-sub">NIA ARCHIVES</div>
                <div class="doc-num">${doc.documentNumber}</div>
              </div>
              <div class="qr-box">
                ${qrUrl ? `<img src="${qrUrl}" alt="QR Code" class="qr-img" />` : ''}
              </div>
            </div>
            <div class="doc-title">${doc.title}</div>
            <div class="compact-footer">
              <span class="dept-text">${doc.departmentName}</span>
              <span class="conf-badge">${doc.confidentiality}</span>
            </div>
          </div>
        `;
      }

      // Standard Full Sticker
      return `
        <div class="sticker-card cols-${columns}">
          <div class="card-top">
            <div class="org-badge">
              <span class="logo-box">NIA</span>
              <span class="header-title">PHYSICAL ARCHIVE TAG</span>
            </div>
            <span class="conf-pill">${doc.confidentiality}</span>
          </div>

          <div class="card-body">
            <div class="qr-col">
              <div class="qr-frame">
                ${qrUrl ? `<img src="${qrUrl}" alt="QR" class="qr-img" />` : ''}
              </div>
              <div class="qr-code-text">${doc.qrCode || doc.documentNumber}</div>
            </div>

            <div class="meta-col">
              <div class="doc-num">${doc.documentNumber}</div>
              <div class="ref-text">Ref: ${doc.referenceNumber || 'N/A'}</div>
              <div class="doc-title">${doc.title}</div>
              <div class="dept-line">🏢 ${doc.departmentName}</div>
            </div>
          </div>

          <div class="card-footer">
            <div class="footer-hdr">
              <span>STORAGE REPOSITORY POSITION:</span>
              <span class="type-name">${doc.documentTypeName}</span>
            </div>
            <div class="loc-path">${homePath}</div>
            ${doc.bundleNumber ? `
              <div class="bundle-line">
                <strong>DOSSIER:</strong> <span class="bundle-pill">${doc.bundleNumber}</span> ${doc.bundleTitle || ''}
              </div>
            ` : ''}
          </div>
        </div>
      `;
    }).join('\n');

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Archive Document Tags (${documents.length} Labels - ${columns} Columns)</title>
        <style>
          @page {
            size: ${pageSize} portrait;
            margin: 8mm;
          }
          * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
          }
          body {
            background: #ffffff;
            color: #0f172a;
            padding: 6px;
          }
          .grid-container {
            display: grid;
            grid-template-columns: repeat(${columns}, 1fr);
            gap: ${columns >= 4 ? '6px' : columns === 3 ? '8px' : '10px'};
          }
          
          /* Standard Sticker */
          .sticker-card {
            border: 2px solid #0f172a;
            border-radius: 10px;
            padding: ${columns >= 3 ? '8px' : '12px'};
            background: #ffffff;
            page-break-inside: avoid;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            min-height: ${columns >= 3 ? '150px' : '175px'};
          }
          .card-top {
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 1.5px solid #0f172a;
            padding-bottom: 4px;
            margin-bottom: 6px;
          }
          .org-badge {
            display: flex;
            align-items: center;
            gap: 5px;
          }
          .logo-box {
            background: #4f46e5;
            color: #ffffff;
            font-weight: 800;
            font-size: ${columns >= 3 ? '8px' : '10px'};
            padding: 2px 4px;
            border-radius: 3px;
          }
          .header-title {
            font-size: ${columns >= 3 ? '8.5px' : '10px'};
            font-weight: 900;
            letter-spacing: 0.5px;
            text-transform: uppercase;
          }
          .conf-pill {
            font-size: ${columns >= 3 ? '8px' : '9px'};
            font-weight: 800;
            background: #f1f5f9;
            border: 1px solid #cbd5e1;
            padding: 1px 5px;
            border-radius: 3px;
          }
          .card-body {
            display: flex;
            gap: ${columns >= 3 ? '6px' : '10px'};
            align-items: flex-start;
          }
          .qr-col {
            width: ${columns >= 4 ? '50px' : columns === 3 ? '60px' : '75px'};
            text-align: center;
            flex-shrink: 0;
          }
          .qr-frame {
            width: ${columns >= 4 ? '50px' : columns === 3 ? '60px' : '75px'};
            height: ${columns >= 4 ? '50px' : columns === 3 ? '60px' : '75px'};
            border: 1.5px solid #0f172a;
            border-radius: 6px;
            display: flex;
            align-items: center;
            justify-content: center;
            overflow: hidden;
            background: #ffffff;
          }
          .qr-img {
            width: 100%;
            height: 100%;
            object-fit: contain;
          }
          .qr-code-text {
            font-size: 7.5px;
            font-family: monospace;
            font-weight: 700;
            color: #64748b;
            margin-top: 2px;
            word-break: break-all;
          }
          .meta-col {
            flex: 1;
            min-width: 0;
          }
          .doc-num {
            font-size: ${columns >= 3 ? '11px' : '13px'};
            font-weight: 900;
            color: #4338ca;
            font-family: monospace;
          }
          .ref-text {
            font-size: 8.5px;
            font-family: monospace;
            color: #64748b;
            font-weight: 600;
          }
          .doc-title {
            font-size: ${columns >= 4 ? '9px' : columns === 3 ? '9.5px' : '11px'};
            font-weight: 700;
            line-height: 1.2;
            color: #0f172a;
            margin: 2px 0;
            display: -webkit-box;
            -webkit-line-clamp: ${columns >= 3 ? '2' : '3'};
            -webkit-box-orient: vertical;
            overflow: hidden;
          }
          .dept-line {
            font-size: ${columns >= 3 ? '8px' : '9.5px'};
            font-weight: 600;
            color: #475569;
          }
          .card-footer {
            margin-top: 6px;
            padding: 4px 6px;
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 6px;
            font-size: 8px;
          }
          .footer-hdr {
            display: flex;
            justify-content: space-between;
            font-weight: 800;
            color: #64748b;
            margin-bottom: 2px;
            font-size: ${columns >= 3 ? '7.5px' : '8.5px'};
          }
          .type-name {
            color: #4f46e5;
          }
          .loc-path {
            font-family: monospace;
            font-weight: 700;
            color: #1e293b;
            font-size: ${columns >= 3 ? '8px' : '9px'};
            word-break: break-word;
          }
          .bundle-line {
            margin-top: 2px;
            padding-top: 2px;
            border-top: 1px dashed #cbd5e1;
            color: #92400e;
            font-size: 7.5px;
          }
          .bundle-pill {
            background: #fef3c7;
            padding: 1px 3px;
            border-radius: 2px;
            font-weight: 800;
          }

          /* Compact Sticker */
          .sticker-compact {
            border: 1.5px solid #0f172a;
            border-radius: 8px;
            padding: ${columns >= 3 ? '6px 8px' : '10px'};
            page-break-inside: avoid;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            min-height: ${columns >= 4 ? '95px' : columns === 3 ? '110px' : '125px'};
            background: #ffffff;
          }
          .compact-header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            gap: 4px;
          }
          .compact-header-left {
            flex: 1;
            min-width: 0;
          }
          .org-sub {
            font-size: ${columns >= 3 ? '7px' : '8px'};
            font-weight: 800;
            color: #4f46e5;
            letter-spacing: 0.5px;
          }
          .qr-box {
            width: ${columns >= 4 ? '32px' : columns === 3 ? '38px' : '46px'};
            height: ${columns >= 4 ? '32px' : columns === 3 ? '38px' : '46px'};
            border: 1px solid #0f172a;
            border-radius: 4px;
            overflow: hidden;
            flex-shrink: 0;
            background: #ffffff;
          }
          .compact-footer {
            display: flex;
            justify-content: space-between;
            border-top: 1px solid #e2e8f0;
            padding-top: 3px;
            margin-top: 4px;
            font-size: ${columns >= 3 ? '7.5px' : '8.5px'};
          }
          .dept-text {
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            max-width: ${columns >= 3 ? '95px' : '160px'};
          }
          .conf-badge {
            font-weight: 800;
            font-family: monospace;
          }

          /* Spine Sticker */
          .sticker-spine {
            border: 1.5px solid #0f172a;
            border-radius: 6px;
            padding: 6px;
            page-break-inside: avoid;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            min-height: ${columns >= 4 ? '130px' : '150px'};
            background: #ffffff;
          }
          .spine-header {
            display: flex;
            justify-content: space-between;
            border-bottom: 1.5px solid #0f172a;
            padding-bottom: 3px;
            margin-bottom: 4px;
          }
          .org-name {
            font-size: ${columns >= 3 ? '8px' : '9px'};
            font-weight: 900;
            color: #4338ca;
          }
          .idx-badge {
            font-size: 7.5px;
            background: #0f172a;
            color: #ffffff;
            padding: 1px 3px;
            border-radius: 2px;
            font-weight: 700;
          }
          .spine-footer {
            border-top: 1px solid #cbd5e1;
            padding-top: 3px;
            margin-top: 4px;
            font-size: 7.5px;
          }
          .loc-badge {
            background: #f1f5f9;
            padding: 1px 3px;
            border-radius: 3px;
            font-weight: 700;
            margin-top: 2px;
            word-break: break-word;
          }
        </style>
      </head>
      <body>
        <div class="grid-container">
          ${stickersHtml}
        </div>
      </body>
      </html>
    `;
  };

  const handlePrint = async () => {
    setIsPrinting(true);
    addNotification('info', `Preparing ${documents.length} labels (${columns} columns) for printing...`);
    try {
      const html = generatePrintableHtml();
      await printHtmlViaHiddenIframe(html);
      addNotification('success', `Print dialog triggered successfully.`);
    } catch (err) {
      console.error(err);
      window.print();
    } finally {
      setIsPrinting(false);
    }
  };

  const handleDownloadSheet = () => {
    const html = generatePrintableHtml();
    downloadPrintableHtml(html, `Physical-Archive-Tags-${documents.length}-Labels-${columns}Cols.html`);
    addNotification('success', `Downloaded standalone ${columns}-column HTML sticker sheet.`);
  };

  const handleOpenInNewTab = () => {
    const html = generatePrintableHtml();
    openInNewTabAndPrint(html);
    addNotification('info', `Opened ${columns}-column printable sticker sheet in new tab.`);
  };

  const handleCopyTagText = (doc: DocumentItem) => {
    const text = `DOC: ${doc.documentNumber}\nTITLE: ${doc.title}\nREF: ${doc.referenceNumber}\nDEPT: ${doc.departmentName}\nLOCATION: ${calculatePath(doc.homeLocationId)}\nRETENTION: ${doc.documentTypeName} (${doc.retentionEndDate || 'N/A'})`;
    navigator.clipboard.writeText(text);
    setCopiedId(doc.id);
    setTimeout(() => setCopiedId(null), 2000);
    addNotification('info', `Tag details for #${doc.documentNumber} copied.`);
  };

  // Preview grid columns CSS class
  const previewGridClass = 
    columns === 1 ? 'grid-cols-1 max-w-xl mx-auto' :
    columns === 2 ? 'grid-cols-1 sm:grid-cols-2' :
    columns === 3 ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3' :
    'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4';

  return (
    <div className="fixed inset-0 z-50 bg-zinc-950/70 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 animate-in fade-in">
      <div className="card max-w-5xl w-full max-h-[94vh] flex flex-col overflow-hidden my-auto" role="dialog" aria-modal="true">
        
        {/* Modal Header & Controls Toolbar */}
        <div className="px-5 py-4 border-b border-zinc-100 dark:border-zinc-800 flex-shrink-0 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-teal-600 text-white flex items-center justify-center">
                <Tag className="w-4 h-4" aria-hidden="true" />
              </div>
              <div>
                <h3 className="section-title flex items-center gap-2">
                  <span>Bulk Print Document Tags & Physical Stickers</span>
                  <span className="chip rounded-full font-mono bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300">
                    {documents.length} Labels • {columns} Columns
                  </span>
                </h3>
                <p className="meta">
                  Customizable layout density for standard sheets, multi-column labels, or thermal rolls
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Primary Print Button */}
              <button
                type="button"
                disabled={isPrinting}
                onClick={handlePrint}
                className="btn btn-primary btn-sm"
              >
                <Printer className="w-3.5 h-3.5" aria-hidden="true" />
                <span>{isPrinting ? 'Opening Print...' : `Print All (${documents.length})`}</span>
              </button>

              <button
                type="button"
                onClick={onClose}
                className="btn btn-ghost btn-icon btn-sm"
                aria-label="Close dialog"
              >
                <X className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>
          </div>

          {/* Configuration Controls Bar (Format + Columns + Page Size) */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-zinc-200/60 dark:border-zinc-700/60">
            
            {/* Tag Format Options */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-zinc-600 dark:text-zinc-400">Layout Format:</span>
              <div className="flex items-center bg-zinc-200/80 dark:bg-zinc-700/80 p-0.5 rounded-xl text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => handleFormatChange('standard')}
                  className={`px-2.5 py-1 rounded-lg transition-all ${
                    tagFormat === 'standard'
                      ? 'bg-white dark:bg-zinc-800 text-teal-600 dark:text-teal-400 shadow-xs'
                      : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900'
                  }`}
                >
                  Standard Sticker
                </button>
                <button
                  type="button"
                  onClick={() => handleFormatChange('compact')}
                  className={`px-2.5 py-1 rounded-lg transition-all ${
                    tagFormat === 'compact'
                      ? 'bg-white dark:bg-zinc-800 text-teal-600 dark:text-teal-400 shadow-xs'
                      : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900'
                  }`}
                >
                  Compact Label
                </button>
                <button
                  type="button"
                  onClick={() => handleFormatChange('spine')}
                  className={`px-2.5 py-1 rounded-lg transition-all ${
                    tagFormat === 'spine'
                      ? 'bg-white dark:bg-zinc-800 text-teal-600 dark:text-teal-400 shadow-xs'
                      : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900'
                  }`}
                >
                  Binder Spine
                </button>
              </div>
            </div>

            {/* Column Selector: 1, 2, 3, or 4 Columns */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-zinc-600 dark:text-zinc-400 flex items-center gap-1">
                <Columns className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                Sheet Columns:
              </span>
              <div className="flex items-center bg-zinc-200/80 dark:bg-zinc-700/80 p-0.5 rounded-xl text-xs font-semibold">
                {([1, 2, 3, 4] as const).map((colNum) => (
                  <button
                    key={colNum}
                    type="button"
                    onClick={() => setColumns(colNum)}
                    className={`px-2.5 py-1 rounded-lg transition-all ${
                      columns === colNum
                        ? 'bg-white dark:bg-zinc-800 text-teal-600 dark:text-teal-400 shadow-xs font-bold'
                        : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900'
                    }`}
                  >
                    {colNum} {colNum === 1 ? 'Col' : 'Cols'}
                  </button>
                ))}
              </div>
            </div>

            {/* Paper Type */}
            <div className="hidden md:flex items-center gap-2">
              <span className="text-xs font-bold text-zinc-600 dark:text-zinc-400">Paper:</span>
              <select
                value={pageSize}
                onChange={(e) => setPageSize(e.target.value as any)}
                className="input w-auto h-8 text-xs font-semibold"
              >
                <option value="letter">US Letter</option>
                <option value="a4">A4 Standard</option>
                <option value="legal">Legal</option>
              </select>
            </div>

          </div>
        </div>

        {/* Printable Content Area Live Interactive Preview */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-zinc-100 dark:bg-zinc-950">
          
          <div className={`grid gap-3.5 ${previewGridClass}`}>
            
            {documents.map((doc, idx) => {
              const homePath = calculatePath(doc.homeLocationId);
              const qrDataUrl = qrCodeMap[doc.id];
              
              if (tagFormat === 'spine') {
                return (
                  <div 
                    key={doc.id}
                    className="bg-white text-zinc-900 border-2 border-zinc-800 rounded-xl p-3 shadow-sm flex flex-col justify-between relative overflow-hidden"
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between border-b-2 border-zinc-800 pb-1.5">
                        <span className="font-mono font-black text-xs uppercase tracking-tight text-indigo-700">
                          {doc.departmentName ? doc.departmentName.split(' ')[0] : 'ARCHIVE'} ARCHIVE
                        </span>
                        <span className="font-mono text-[9px] font-bold px-1.5 py-0.2 bg-zinc-900 text-white rounded">
                          #{idx + 1}
                        </span>
                      </div>
                      
                      <div className="font-mono font-black text-sm text-zinc-900 tracking-tight">
                        {doc.documentNumber}
                      </div>

                      <div className="font-bold text-xs line-clamp-3 leading-snug">
                        {doc.title}
                      </div>
                    </div>

                    <div className="mt-3 pt-2 border-t border-zinc-300 space-y-1 text-[10px]">
                      <div className="font-mono font-semibold text-zinc-600 truncate">
                        Ref: {doc.referenceNumber}
                      </div>
                      <div className="font-mono text-[9px] text-zinc-700 bg-zinc-100 p-1 rounded font-bold truncate">
                        Loc: {homePath}
                      </div>
                    </div>
                  </div>
                );
              }

              if (tagFormat === 'compact') {
                return (
                  <div
                    key={doc.id}
                    className="bg-white text-zinc-900 border-2 border-zinc-800 rounded-xl p-3 shadow-sm flex flex-col justify-between relative"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <span className="text-[9px] font-mono font-black uppercase text-indigo-700 tracking-wider block truncate">
                          NIA ARCHIVES
                        </span>
                        <div className="font-mono font-black text-xs text-zinc-900 truncate">
                          {doc.documentNumber}
                        </div>
                      </div>
                      <div className="w-10 h-10 border border-zinc-800 bg-white flex items-center justify-center rounded p-0.5 overflow-hidden flex-shrink-0">
                        {qrDataUrl ? (
                          <img src={qrDataUrl} alt="QR" className="w-full h-full object-contain" />
                        ) : (
                          <div className="w-full h-full bg-zinc-100 animate-pulse" />
                        )}
                      </div>
                    </div>

                    <div className="my-1.5">
                      <div className="font-bold text-[11px] line-clamp-2 leading-tight">
                        {doc.title}
                      </div>
                    </div>

                    <div className="pt-1.5 border-t border-zinc-300 flex items-center justify-between text-[9px] font-mono text-zinc-600">
                      <span className="truncate max-w-[120px]">{doc.departmentName}</span>
                      <span className="font-bold text-zinc-900">{doc.confidentiality}</span>
                    </div>
                  </div>
                );
              }

              // Standard Sticker (Default)
              return (
                <div
                  key={doc.id}
                  className="bg-white text-zinc-900 border-2 border-zinc-900 rounded-2xl p-3.5 shadow-sm relative overflow-hidden flex flex-col justify-between"
                >
                  {/* Corner Accent */}
                  <div className="absolute -top-6 -right-6 w-12 h-12 bg-indigo-600 rotate-45" />

                  {/* Header Row */}
                  <div>
                    <div className="flex items-center justify-between border-b-2 border-zinc-900 pb-1.5 mb-2">
                      <div className="flex items-center gap-1.5">
                        <div className="w-4 h-4 bg-indigo-600 text-white rounded flex items-center justify-center font-bold text-[9px]">
                          NIA
                        </div>
                        <span className="font-mono font-black text-[10px] uppercase tracking-wider text-zinc-900">
                          PHYSICAL ARCHIVE TAG
                        </span>
                      </div>
                      <span className="text-[9px] font-mono font-black px-1.5 py-0.5 bg-zinc-100 text-zinc-800 rounded border border-zinc-300">
                        {doc.confidentiality}
                      </span>
                    </div>

                    {/* Main Tag Body */}
                    <div className="flex gap-2.5 items-start">
                      {/* Left: Barcode / QR Box */}
                      <div className={`${columns >= 3 ? 'w-14' : 'w-18'} flex-shrink-0 text-center space-y-1`}>
                        <div className={`${columns >= 3 ? 'w-14 h-14' : 'w-18 h-18'} border-2 border-zinc-900 rounded-xl bg-white flex items-center justify-center p-0.5 shadow-inner overflow-hidden`}>
                          {qrDataUrl ? (
                            <img src={qrDataUrl} alt="QR" className="w-full h-full object-contain" />
                          ) : (
                            <div className="w-full h-full bg-zinc-100 animate-pulse rounded" />
                          )}
                        </div>
                        <span className="font-mono font-bold text-[8px] text-zinc-500 block truncate">
                          {doc.qrCode || doc.documentNumber}
                        </span>
                      </div>

                      {/* Right: Record Metadata */}
                      <div className="flex-1 min-w-0 space-y-0.5">
                        <div className="font-mono font-black text-xs sm:text-sm text-indigo-700 tracking-tight">
                          {doc.documentNumber}
                        </div>
                        <div className="text-[9px] font-mono text-zinc-500 font-semibold truncate">
                          Ref: {doc.referenceNumber}
                        </div>
                        <div className="font-bold text-[11px] text-zinc-900 line-clamp-2 leading-tight">
                          {doc.title}
                        </div>
                        <div className="text-[9.5px] font-semibold text-zinc-600 flex items-center gap-1">
                          <Building2 className="w-3 h-3 text-zinc-400 flex-shrink-0" />
                          <span className="truncate">{doc.departmentName}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Footer Storage Specifier */}
                  <div className="mt-2.5 pt-1.5 border-t-2 border-zinc-900/40 bg-zinc-50 p-2 rounded-xl border border-zinc-200">
                    <div className="flex items-center justify-between text-[8.5px] font-mono font-bold text-zinc-500 mb-0.5">
                      <span className="uppercase">STORAGE:</span>
                      <span className="text-indigo-600 font-extrabold truncate max-w-[140px]">{doc.documentTypeName}</span>
                    </div>
                    <div className="font-mono font-bold text-[9px] text-zinc-800 truncate">
                      {homePath}
                    </div>
                    {doc.bundleNumber && (
                      <div className="mt-1 pt-1 border-t border-zinc-200 text-[8.5px] font-mono font-bold text-amber-800 flex items-center gap-1">
                        <span>DOSSIER:</span>
                        <span className="bg-amber-100 px-1 py-0.2 rounded font-extrabold">{doc.bundleNumber}</span>
                        <span className="text-zinc-500 truncate">{doc.bundleTitle}</span>
                      </div>
                    )}
                  </div>

                  {/* Screen Copy Action */}
                  <div className="mt-1.5 pt-1 flex justify-end">
                    <button
                      type="button"
                      onClick={() => handleCopyTagText(doc)}
                      className="btn btn-ghost btn-xs text-zinc-500 hover:text-teal-600"
                    >
                      {copiedId === doc.id ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-600" />
                          <span className="text-emerald-600 font-bold">Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" />
                          <span>Copy Label</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}

          </div>

        </div>

        {/* Footer Actions with Multiple Output Options */}
        <div className="px-5 py-4 border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-zinc-500 flex-shrink-0">
          <div className="flex items-center gap-2">
            <span>Rendered at {columns} column(s) per sheet on {pageSize.toUpperCase()} paper</span>
          </div>

          <div className="flex items-center gap-2 flex-wrap justify-end">
            {/* Action 1: Download Standalone HTML/PDF Sticker Sheet */}
            <button
              type="button"
              onClick={handleDownloadSheet}
              className="btn btn-secondary btn-sm"
              title="Download sticker sheet to save, send, or print anytime"
            >
              <Download className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" aria-hidden="true" />
              <span>Download HTML Sheet</span>
            </button>

            {/* Action 2: Open In New Tab */}
            <button
              type="button"
              onClick={handleOpenInNewTab}
              className="btn btn-secondary btn-sm"
              title="Open full page in a new browser tab for clean direct printing"
            >
              <ExternalLink className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" aria-hidden="true" />
              <span>Open in New Tab</span>
            </button>

            {/* Primary Action: Direct Print */}
            <button
              type="button"
              disabled={isPrinting}
              onClick={handlePrint}
              className="btn btn-primary btn-sm"
            >
              <Printer className="w-3.5 h-3.5" aria-hidden="true" />
              <span>{isPrinting ? 'Opening Printer...' : `Print ${columns}-Col Sheet`}</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
