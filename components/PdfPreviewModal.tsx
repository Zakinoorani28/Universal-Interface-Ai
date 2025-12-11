import React, { useState, useRef } from 'react';
import { X, FileText, Check, Loader2, Monitor } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { fileToBase64 } from '../services/gemini';

interface PdfPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: {
    task: string;
    result: string;
    imageFile: File | null;
    url?: string;
    timestamp: number;
    sections: { title: string; content: string }[];
  };
}

const PdfPreviewModal: React.FC<PdfPreviewModalProps> = ({ isOpen, onClose, data }) => {
  const [includeCover, setIncludeCover] = useState(true);
  const [includeScreenshot, setIncludeScreenshot] = useState(true);
  const [includeJson, setIncludeJson] = useState(true);
  const [includeA11y, setIncludeA11y] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [imgPreview, setImgPreview] = useState<string | null>(null);

  const printRef = useRef<HTMLDivElement>(null);

  // Load image preview once when modal opens
  React.useEffect(() => {
    if (data.imageFile && !imgPreview) {
      fileToBase64(data.imageFile).then(base64 => {
        setImgPreview(`data:${data.imageFile?.type};base64,${base64}`);
      });
    }
  }, [data.imageFile, imgPreview]);

  if (!isOpen) return null;

  const generatePdf = async () => {
    if (!printRef.current) return;
    setIsGenerating(true);

    try {
      // 1. Clone DOM for capture (Off-screen, A4 width, no scaling)
      const temp = document.createElement('div');
      temp.className = 'pdf-capture';
      temp.innerHTML = printRef.current.innerHTML;
      document.body.appendChild(temp);

      // 2. Inject Print-Safe CSS (Runtime)
      const style = document.createElement('style');
      style.textContent = `
        .pdf-capture { 
          position: fixed; left: -9999px; top: 0; width: 794px;
          background: #fff; padding: 40px; box-sizing: border-box;
        }
        .pdf-capture * { 
          transform: none !important; box-shadow: none !important; 
          font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif !important;
        }
        .pdf-capture h1 { font-size: 24pt !important; line-height: 1.2; margin-bottom: 24px; color: #111; }
        .pdf-capture h2 { font-size: 18pt !important; margin-top: 32px; border-bottom: 2px solid #e5e7eb; padding-bottom: 8px; color: #1e40af; page-break-after: avoid; }
        .pdf-capture h3 { font-size: 14pt !important; margin-top: 20px; color: #374151; page-break-after: avoid; }
        .pdf-capture p, .pdf-capture li { font-size: 11pt !important; line-height: 1.5; color: #374151; margin-bottom: 12px; }
        .pdf-capture pre { font-size: 9pt !important; background: #f8fafc; border: 1px solid #e2e8f0; padding: 12px; white-space: pre-wrap; font-family: monospace !important; break-inside: avoid; }
        .pdf-capture img { max-width: 100% !important; height: auto !important; }
        .pdf-capture .break-inside-avoid-page { break-inside: avoid; }
      `;
      temp.appendChild(style);

      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageWidth = 210;
      const pageHeight = 297;
      const margin = 20;
      let cursorY = margin;

      // 3. Handle Screenshot (Separate Page)
      const screenshot = temp.querySelector('img[alt="Screenshot"]');
      if (screenshot && includeScreenshot && imgPreview) {
        screenshot.closest('div')?.remove(); // Remove from text flow
        
        // Add screenshot as Page 2 (Standard Convention)
        pdf.addPage(); 
        const props = pdf.getImageProperties(imgPreview);
        const maxWidth = pageWidth - (margin * 2);
        const maxHeight = pageHeight - (margin * 2);
        const ratio = Math.min(maxWidth / props.width, maxHeight / props.height);
        const w = props.width * ratio;
        const h = props.height * ratio;
        pdf.addImage(imgPreview, 'JPEG', margin + (maxWidth - w)/2, margin, w, h);
        
        // Return to Page 1 for Text
        pdf.setPage(1);
      } else if (screenshot) {
        screenshot.closest('div')?.remove();
      }

      // 4. Capture Text Sections
      // Flatten specific containers to ensure we capture logical blocks
      const blocks: HTMLElement[] = [];
      Array.from(temp.children).forEach(child => {
          if (child.tagName === 'STYLE') return;
          // Expand the main content stack (space-y-8)
          if (child.classList.contains('space-y-8')) {
              Array.from(child.children).forEach(grandchild => blocks.push(grandchild as HTMLElement));
          } else {
              blocks.push(child as HTMLElement);
          }
      });

      for (const block of blocks) {
        if (block.innerText.trim() === '') continue; // skip empty

        const canvas = await html2canvas(block, { scale: 2, useCORS: true, logging: false });
        const imgData = canvas.toDataURL('image/jpeg', 0.95);
        const imgProps = pdf.getImageProperties(imgData);
        const imgHeight = (imgProps.height * (pageWidth - margin * 2)) / imgProps.width;

        // Check overflow
        if (cursorY + imgHeight > pageHeight - margin) {
           pdf.addPage();
           cursorY = margin;
        }

        pdf.addImage(imgData, 'JPEG', margin, cursorY, pageWidth - margin * 2, imgHeight);
        cursorY += imgHeight + 5;
      }

      const dateStr = new Date().toISOString().slice(0, 10);
      pdf.save(`UIA_Summary_${dateStr}.pdf`);
      document.body.removeChild(temp);
    } catch (e) {
      console.error(e);
      alert('PDF Generation failed');
    } finally {
      setIsGenerating(false);
    }
  };

  // Filter sections based on toggles
  const filteredSections = data.sections.filter(section => {
    if (!includeJson && section.title.toLowerCase().includes('automation json')) return false;
    if (!includeA11y && section.title.toLowerCase().includes('accessibility')) return false;
    return true;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 w-full max-w-5xl h-[90vh] rounded-2xl shadow-2xl flex flex-col md:flex-row overflow-hidden border border-slate-200 dark:border-slate-800">
        
        {/* LEFT PANEL: CONFIGURATION */}
        <div className="w-full md:w-1/3 bg-slate-50 dark:bg-slate-950 p-6 flex flex-col border-r border-slate-200 dark:border-slate-800">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <FileText className="w-5 h-5 text-blue-600" />
              Export PDF
            </h2>
            <button onClick={onClose} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg transition-colors">
              <X className="w-5 h-5 text-slate-500" />
            </button>
          </div>

          <div className="space-y-6 flex-1 overflow-y-auto">
            <div className="space-y-4">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-500">Content Options</h3>
              
              <label className="flex items-center justify-between p-3 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 cursor-pointer hover:border-blue-400 transition-colors">
                <span className="font-medium">Include Cover Page</span>
                <input 
                  type="checkbox" 
                  checked={includeCover} 
                  onChange={e => setIncludeCover(e.target.checked)}
                  className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500" 
                />
              </label>

              {imgPreview && (
                <label className="flex items-center justify-between p-3 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 cursor-pointer hover:border-blue-400 transition-colors">
                  <span className="font-medium">Include Screenshot</span>
                  <input 
                    type="checkbox" 
                    checked={includeScreenshot} 
                    onChange={e => setIncludeScreenshot(e.target.checked)}
                    className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500" 
                  />
                </label>
              )}

              <label className="flex items-center justify-between p-3 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 cursor-pointer hover:border-blue-400 transition-colors">
                <span className="font-medium">Automation JSON</span>
                <input 
                  type="checkbox" 
                  checked={includeJson} 
                  onChange={e => setIncludeJson(e.target.checked)}
                  className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500" 
                />
              </label>

              <label className="flex items-center justify-between p-3 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 cursor-pointer hover:border-blue-400 transition-colors">
                <span className="font-medium">Accessibility Notes</span>
                <input 
                  type="checkbox" 
                  checked={includeA11y} 
                  onChange={e => setIncludeA11y(e.target.checked)}
                  className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500" 
                />
              </label>
            </div>
            
            <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg text-sm text-blue-800 dark:text-blue-200 border border-blue-100 dark:border-blue-800/50">
              <p><strong>Note:</strong> PDF is generated securely in your browser. Large screenshots may increase file size.</p>
            </div>
          </div>

          <div className="pt-6 border-t border-slate-200 dark:border-slate-800 mt-auto">
            <button
              onClick={generatePdf}
              disabled={isGenerating}
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <FileText className="w-5 h-5" />
                  Download PDF
                </>
              )}
            </button>
          </div>
        </div>

        {/* RIGHT PANEL: PREVIEW */}
        <div className="w-full md:w-2/3 bg-slate-200 dark:bg-black p-4 md:p-8 overflow-auto flex justify-center">
          <div className="w-fit"> 
            {/* 
              This container replicates A4 dimensions (approx 794px width at 96dpi).
              It acts as the visual source for html2canvas.
              We force light mode colors for the PDF to ensure printability.
            */}
            <div 
              ref={printRef}
              className="w-[794px] min-h-[1123px] bg-white text-slate-900 shadow-2xl mx-auto p-[20mm] box-border relative"
            >
              {/* BRANDING HEADER */}
              <div className="flex items-center justify-between border-b border-slate-300 pb-4 mb-8">
                <div className="flex items-center gap-2">
                  <div className="bg-blue-600 text-white p-1 rounded">
                    <Monitor className="w-5 h-5" />
                  </div>
                  <span className="font-bold text-lg text-slate-800">Universal Interface AI</span>
                </div>
                <div className="text-sm text-slate-500">
                  {new Date(data.timestamp).toLocaleDateString()}
                </div>
              </div>

              {/* COVER PAGE */}
              {includeCover && (
                <div className="flex flex-col mb-16 break-after-page">
                  <div className="flex-1 flex flex-col justify-center gap-6 mt-10">
                    <h1 className="text-4xl font-extrabold text-slate-900 leading-tight">
                      Analysis Summary
                    </h1>
                    <div className="text-xl text-slate-600 font-medium border-l-4 border-blue-500 pl-4 py-2">
                      {data.task}
                    </div>
                    
                    {data.url && (
                      <p className="text-slate-500 flex items-center gap-2">
                        <span className="font-semibold">URL:</span> {data.url}
                      </p>
                    )}

                    {includeScreenshot && imgPreview && (
                      <div className="my-8 border-4 border-slate-100 rounded-xl overflow-hidden shadow-sm">
                        <img src={imgPreview} alt="Screenshot" className="w-full h-auto object-contain max-h-[400px]" />
                        <p className="text-center text-xs text-slate-400 p-2 bg-slate-50">Source Screenshot</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* CONTENT SECTIONS */}
              <div className="space-y-8">
                {filteredSections.map((section, idx) => (
                  <div key={idx} className="mb-8 break-inside-avoid-page">
                    <h2 className="text-2xl font-bold text-blue-800 mb-4 pb-2 border-b border-blue-100">
                      {section.title}
                    </h2>
                    <div className="prose prose-slate max-w-none prose-p:text-slate-700 prose-li:text-slate-700">
                      <ReactMarkdown
                        components={{
                          code({children, className}) {
                            return (
                              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 my-2 text-xs font-mono text-slate-800 whitespace-pre-wrap shadow-sm">
                                {children}
                              </div>
                            );
                          },
                          h3: ({children}) => <h3 className="text-lg font-bold text-slate-800 mt-4 mb-2">{children}</h3>,
                          p: ({children}) => <p className="mb-3 leading-relaxed">{children}</p>,
                          ul: ({children}) => <ul className="list-disc pl-5 mb-4 space-y-1">{children}</ul>,
                          ol: ({children}) => <ol className="list-decimal pl-5 mb-4 space-y-1">{children}</ol>
                        }}
                      >
                        {section.content}
                      </ReactMarkdown>
                    </div>
                  </div>
                ))}
              </div>

              {/* FOOTER */}
              <div className="mt-16 pt-8 border-t border-slate-200 text-center text-sm text-slate-400">
                Generated by Universal Interface AI • Accessibility Focused Workflow
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PdfPreviewModal;