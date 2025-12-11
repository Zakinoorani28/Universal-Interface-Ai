import React, { useState, useRef, useEffect } from "react";
import { runUniversalInterface } from "../services/gemini";
import ChatPanel from "./ChatPanel";
import PdfPreviewModal from "./PdfPreviewModal";
import { 
  Upload, AlertCircle, FileImage, 
  Copy, Download, Play, Pause, Square, 
  History, ChevronRight, Menu, X, Trash2, MessageCircle, FileText,
  PanelLeftClose, PanelLeftOpen, Monitor
} from "lucide-react";
import ReactMarkdown from "react-markdown";

// --- Helper: Clean Markdown for Plain Text ---
const cleanMarkdown = (md: string) => {
  return md
    .replace(/^### /gm, '')
    .replace(/^## /gm, '')
    .replace(/^# /gm, '')
    .replace(/[*`>]/g, '')
    .replace(/\[(.*?)\]\(.*?\)/g, '$1') // Remove links
    .replace(/\n{2,}/g, '\n\n')
    .trim();
};

// --- Helper: Parse Markdown into Sections for Collapsible UI ---
export interface Section {
  title: string;
  content: string;
}

export const parseSections = (markdown: string): Section[] => {
  if (!markdown) return [];
  
  // Split by ### headers
  const parts = markdown.split(/(^|\n)### /g);
  
  const sections: Section[] = [];
  
  // If there is introductory text before the first header, add it as "Overview"
  if (parts[0] && parts[0].trim().length > 0 && !markdown.startsWith("###")) {
     sections.push({ title: "Overview", content: parts[0] });
  }

  const lines = markdown.split('\n');
  let currentTitle = "Overview";
  let currentContent: string[] = [];
  
  lines.forEach(line => {
    if (line.startsWith('### ')) {
      if (currentContent.length > 0 || currentTitle !== "Overview") {
        sections.push({ 
          title: currentTitle, 
          content: currentContent.join('\n') 
        });
      }
      currentTitle = line.replace('### ', '').trim();
      currentContent = [];
    } else {
      currentContent.push(line);
    }
  });
  
  if (currentContent.length > 0) {
    sections.push({ 
      title: currentTitle, 
      content: currentContent.join('\n') 
    });
  }

  return sections;
};

// --- Types ---
interface HistoryItem {
  id: string;
  timestamp: number;
  task: string;
  result: string;
}

const WebUITool = () => {
  // Core State
  const [image, setImage] = useState<File | null>(null);
  const [task, setTask] = useState("");
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // History State
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [showHistoryMobile, setShowHistoryMobile] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  // Chat State
  const [isChatOpen, setIsChatOpen] = useState(false);

  // PDF Modal State
  const [isPdfModalOpen, setIsPdfModalOpen] = useState(false);

  // Voice State
  const [speechState, setSpeechState] = useState<'idle' | 'playing' | 'paused'>('idle');
  const speechRef = useRef<SpeechSynthesisUtterance | null>(null);

  // Load History on Mount
  useEffect(() => {
    const saved = localStorage.getItem('uia_history');
    if (saved) {
      try {
        setHistory(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to load history", e);
      }
    }
  }, []);

  // Save History Helper
  const saveToHistory = (newResult: string, taskPrompt: string) => {
    const newItem: HistoryItem = {
      id: Date.now().toString(),
      timestamp: Date.now(),
      task: taskPrompt,
      result: newResult
    };
    
    // Check if duplicate task/result to avoid clutter
    const isDuplicate = history.some(h => h.task === taskPrompt && h.result === newResult);
    if (isDuplicate) return;

    const updated = [newItem, ...history].slice(0, 20); // Keep last 20 items
    setHistory(updated);
    localStorage.setItem('uia_history', JSON.stringify(updated));
  };

  const clearHistory = () => {
    if (window.confirm("Are you sure you want to clear all history?")) {
      setHistory([]);
      localStorage.removeItem('uia_history');
    }
  };

  const deleteHistoryItem = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = history.filter(item => item.id !== id);
    setHistory(updated);
    localStorage.setItem('uia_history', JSON.stringify(updated));
  };

  const loadHistoryItem = (item: HistoryItem) => {
    setTask(item.task);
    setResult(item.result);
    // Optionally restore screenshot if we had it stored, but for now we just show text result
    // To properly restore context we might need to store more data, but basic result recall is key.
    
    setShowHistoryMobile(false);
    stopSpeech(); 
    
    // On mobile, maybe close menu automatically? Yes above.
    // On desktop, user might want to keep sidebar open.
  };

  // --- Handlers ---

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setImage(e.target.files[0]);
      setError(null);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setImage(e.dataTransfer.files[0]);
      setError(null);
    }
  };

  const handleRun = async () => {
    if (!image) {
      setError("Please upload a website screenshot.");
      return;
    }
    if (!task.trim()) {
      setError("Please describe the task you want to perform.");
      return;
    }

    setLoading(true);
    setResult(null);
    setError(null);
    stopSpeech();

    try {
      const response = await runUniversalInterface({
        website_image: image,
        task_prompt: task,
        page_url: url,
      });
      setResult(response);
      saveToHistory(response, task);
    } catch (err: any) {
      setError(err.message || "An error occurred while analyzing the interface. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // --- Action Handlers ---

  const copyToClipboard = () => {
    if (!result) return;
    const plain = cleanMarkdown(result);
    navigator.clipboard.writeText(plain);
  };

  const downloadAsText = () => {
    if (!result) return;
    const plain = cleanMarkdown(result);
    const fileName = `UIA_Result_${Date.now()}.txt`;
    const blob = new Blob([plain], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(url);
  };

  // --- Voice Engine ---

  const stopSpeech = () => {
    window.speechSynthesis.cancel();
    setSpeechState('idle');
    speechRef.current = null;
  };

  const toggleSpeech = () => {
    if (!result) return;

    if (speechState === 'idle') {
      const plain = cleanMarkdown(result);
      const utter = new SpeechSynthesisUtterance(plain);
      utter.rate = 1.0;
      utter.pitch = 1.0;
      
      utter.onend = () => {
        setSpeechState('idle');
        speechRef.current = null;
      };
      
      speechRef.current = utter;
      window.speechSynthesis.speak(utter);
      setSpeechState('playing');
    } else if (speechState === 'playing') {
      window.speechSynthesis.pause();
      setSpeechState('paused');
    } else if (speechState === 'paused') {
      window.speechSynthesis.resume();
      setSpeechState('playing');
    }
  };

  const examplePrompts = [
    "Find the 'Sign Up' button",
    "Summarize the dashboard metrics", 
    "How do I contact support?",
    "Check for accessibility issues"
  ];

  const sections = result ? parseSections(result) : [];

  return (
    <div className="flex w-full h-full overflow-hidden relative">
      
      {/* --- DESKTOP SIDEBAR --- */}
      {/* 
          Using a fixed width inner container pattern for smooth transitions.
          The outer aside transitions width, while the inner div stays fixed.
      */}
      <aside 
        className={`
          hidden md:block 
          flex-shrink-0 
          bg-slate-50 dark:bg-slate-900/50 
          border-r border-slate-200 dark:border-slate-800 
          overflow-hidden 
          transition-[width] duration-300 ease-in-out
          ${isSidebarOpen ? 'w-[280px]' : 'w-0 border-none'}
        `}
      >
        <div className="w-[280px] h-full flex flex-col">
          {/* Sidebar Header */}
          <div className="p-4 flex items-center justify-between border-b border-slate-200 dark:border-slate-800 min-h-[65px]">
            <h2 className="font-semibold flex items-center gap-2 text-slate-700 dark:text-slate-200">
              <History className="w-4 h-4" /> History
            </h2>
            <div className="flex items-center gap-1">
              {history.length > 0 && (
                <button 
                  onClick={clearHistory} 
                  className="text-xs text-red-500 hover:text-red-600 px-2 py-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                >
                  Clear All
                </button>
              )}
              <button 
                onClick={() => setIsSidebarOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-md transition-colors"
                title="Close Sidebar"
              >
                <PanelLeftClose className="w-4 h-4" />
              </button>
            </div>
          </div>
          
          {/* History List */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {history.length === 0 ? (
              <div className="text-center p-8 text-sm text-slate-400">
                No recent analysis.
              </div>
            ) : (
              history.map((item) => (
                <div 
                  key={item.id}
                  className="group relative w-full rounded-lg hover:bg-white dark:hover:bg-slate-800 border border-transparent hover:border-slate-200 dark:hover:border-slate-700 transition-all cursor-pointer"
                  onClick={() => loadHistoryItem(item)}
                >
                  <div className="p-3 pr-8">
                    <p className="font-medium text-sm text-slate-700 dark:text-slate-200 line-clamp-2 leading-tight">
                      {item.task}
                    </p>
                    <p className="text-[10px] uppercase tracking-wider text-slate-400 mt-2 font-medium">
                      {new Date(item.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                    </p>
                  </div>
                  
                  {/* Delete Item Button */}
                  <button
                    onClick={(e) => deleteHistoryItem(item.id, e)}
                    className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 p-1.5 text-slate-400 hover:text-red-500 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-md transition-all"
                    title="Delete item"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </aside>

      {/* --- MOBILE SIDEBAR (DRAWER) --- */}
      {showHistoryMobile && (
        <div className="fixed inset-0 z-50 bg-black/50 md:hidden animate-in fade-in duration-200" onClick={() => setShowHistoryMobile(false)}>
           <div 
             className="absolute left-0 top-0 bottom-0 w-[85%] max-w-[320px] bg-white dark:bg-slate-900 shadow-2xl p-4 overflow-y-auto animate-in slide-in-from-left duration-300"
             onClick={e => e.stopPropagation()}
           >
             <div className="flex items-center justify-between mb-6">
               <h2 className="font-bold text-lg flex items-center gap-2"><History className="w-5 h-5"/> History</h2>
               <button onClick={() => setShowHistoryMobile(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"><X className="w-5 h-5"/></button>
             </div>
             
             {history.length > 0 && (
                <div className="mb-4 flex justify-end">
                   <button onClick={clearHistory} className="text-xs text-red-500 font-medium px-3 py-1.5 bg-red-50 dark:bg-red-900/10 rounded-full">Clear All History</button>
                </div>
             )}

             <div className="space-y-3">
                {history.map((item) => (
                  <div key={item.id} className="relative group bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800 overflow-hidden">
                    <button
                      onClick={() => loadHistoryItem(item)}
                      className="w-full text-left p-4 pr-12 active:bg-slate-100 dark:active:bg-slate-800 transition-colors"
                    >
                      <p className="font-medium text-sm text-slate-800 dark:text-slate-200 line-clamp-2">{item.task}</p>
                      <p className="text-xs text-slate-500 mt-2">{new Date(item.timestamp).toLocaleDateString()} • {new Date(item.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</p>
                    </button>
                    <button
                      onClick={(e) => deleteHistoryItem(item.id, e)}
                      className="absolute right-2 top-3 p-2 text-slate-400 hover:text-red-500 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
                {history.length === 0 && <p className="text-slate-500 text-sm text-center py-10">No history yet.</p>}
             </div>
           </div>
        </div>
      )}

      {/* --- MAIN CONTENT AREA --- */}
      <div className="flex-1 flex flex-col h-full overflow-hidden relative">
        
        {/* Desktop Sidebar Toggle Button (Visible when sidebar CLOSED) */}
        <div className={`hidden md:block absolute top-4 left-4 z-20 transition-opacity duration-300 ${isSidebarOpen ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
           <button 
             onClick={() => setIsSidebarOpen(true)}
             className="p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-sm text-slate-500 hover:text-blue-600 hover:bg-slate-50 dark:hover:bg-slate-700 transition-all transform hover:scale-105"
             title="Open Sidebar"
           >
             <PanelLeftOpen className="w-5 h-5" />
           </button>
        </div>

        {/* Mobile Sidebar Toggle Header */}
        <div className="md:hidden p-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-white dark:bg-slate-900 z-10">
           <button onClick={() => setShowHistoryMobile(true)} className="flex items-center gap-2 text-sm font-medium text-slate-600 dark:text-slate-300 px-3 py-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
             <Menu className="w-5 h-5" /> Past Analysis
           </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 p-4 md:p-8 w-full">
          <div className="max-w-4xl mx-auto flex flex-col gap-8 pb-32">
            
            {/* INPUT CARD */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              
              {/* Image Upload */}
              <div className="flex flex-col gap-3">
                <label className="text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-xs">1</span>
                  Source
                </label>
                <div 
                  className={`
                    relative flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-xl transition-all cursor-pointer h-52
                    ${image 
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/10' 
                      : 'border-slate-300 dark:border-slate-700 hover:border-blue-400 hover:bg-slate-50 dark:hover:bg-slate-900'
                    }
                  `}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileChange} />
                  
                  {image ? (
                    <div className="flex flex-col items-center text-center animate-in fade-in zoom-in duration-300 w-full">
                       <FileImage className="w-10 h-10 text-blue-600 dark:text-blue-400 mb-2" />
                       <p className="font-medium text-sm truncate max-w-[80%]">{image.name}</p>
                       <p className="text-xs text-slate-500 mt-1">{(image.size / 1024 / 1024).toFixed(2)} MB</p>
                       <button 
                          onClick={(e) => { e.stopPropagation(); setImage(null); }}
                          className="mt-3 px-3 py-1 bg-white dark:bg-slate-800 text-red-500 shadow-sm border border-slate-200 dark:border-slate-700 rounded-full text-xs font-medium hover:bg-red-50"
                       >
                          Remove
                       </button>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center text-center text-slate-500 dark:text-slate-400">
                      <Upload className="w-8 h-8 mb-2 opacity-60" />
                      <p className="font-medium">Upload Screenshot</p>
                      <p className="text-xs mt-1 opacity-70">Drag & drop supported</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Task Input */}
              <div className="flex flex-col gap-3">
                 <label className="text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-2">
                   <span className="w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-xs">2</span>
                   Task
                 </label>
                 <div className="flex flex-col gap-3 h-full">
                   <textarea
                     className="w-full flex-1 p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all resize-none text-base shadow-sm"
                     placeholder="What do you want to achieve on this page?"
                     value={task}
                     onChange={(e) => setTask(e.target.value)}
                   />

                   {/* Suggestion Chips */}
                 <div className="flex flex-wrap gap-2 items-center">
                   <span className="text-xs font-medium text-slate-400">Try:</span>
                   {examplePrompts.map((prompt) => (
                   <button
                     key={prompt}
                     onClick={() => setTask(prompt)}
                     className="px-2.5 py-1 text-xs font-medium rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-300 transition-colors border border-transparent hover:border-slate-300 dark:hover:border-slate-600"
                   >
                     {prompt}
                   </button>
                   ))}
                 </div>
                 </div>
              </div>
            </div>

            {/* Optional URL + Button */}
            <div className="flex flex-col md:flex-row gap-4 items-end">
               <div className="w-full md:w-2/3">
                  <input
                    type="text"
                    className="w-full p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-transparent text-sm focus:ring-2 focus:ring-blue-500 outline-none placeholder:text-slate-400"
                    placeholder="Page URL (Optional - helps with accuracy)"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                  />
               </div>
               <div className="w-full md:w-1/3">
                 <button 
                    onClick={handleRun}
                    disabled={loading}
                    className={`w-full py-3 rounded-lg text-white font-semibold shadow-md hover:shadow-lg transition-all active:scale-[0.98] ${
                       loading ? "bg-slate-400 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-700"
                    }`}
                  >
                    {loading ? (
                      <div className="flex items-center justify-center gap-2">
                         <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                         Analyzing...
                      </div>
                    ) : (
                      "Start Analysis"
                    )}
                  </button>
               </div>
            </div>

            {/* Error Display */}
            {error && (
              <div className="p-4 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-300 border border-red-200 dark:border-red-900 flex items-center gap-2 animate-in fade-in">
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                {error}
              </div>
            )}

            {/* --- RESULTS PANEL --- */}
            {result && (
              <div className="w-full animate-in fade-in slide-in-from-bottom-8 duration-700">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-4">
                  <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                    <div className="w-2 h-6 bg-blue-500 rounded-full"></div>
                    Analysis Results
                  </h3>
                  
                  <div className="flex items-center gap-2 flex-wrap">
                    {/* Voice Controls */}
                    <div className="flex items-center mr-2 bg-slate-100 dark:bg-slate-800 rounded-lg p-1 border border-slate-200 dark:border-slate-700">
                       <button 
                         onClick={toggleSpeech}
                         className="p-2 rounded-md hover:bg-white dark:hover:bg-slate-700 shadow-sm transition-all text-slate-700 dark:text-slate-200"
                         title={speechState === 'playing' ? "Pause" : "Play"}
                       >
                         {speechState === 'playing' ? <Pause className="w-4 h-4 fill-current"/> : <Play className="w-4 h-4 fill-current"/>}
                       </button>
                       {speechState !== 'idle' && (
                         <button 
                           onClick={stopSpeech}
                           className="p-2 rounded-md hover:bg-red-100 dark:hover:bg-red-900/50 text-red-500 ml-1 transition-all"
                           title="Stop"
                         >
                           <Square className="w-4 h-4 fill-current"/>
                         </button>
                       )}
                    </div>

                    <button onClick={copyToClipboard} className="p-2.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 transition-colors text-slate-600 dark:text-slate-300" title="Copy Text">
                      <Copy className="w-4 h-4" />
                    </button>
                    <button onClick={downloadAsText} className="p-2.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 transition-colors text-slate-600 dark:text-slate-300" title="Download .txt">
                      <Download className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => setIsPdfModalOpen(true)}
                      className="p-2.5 px-4 rounded-lg bg-blue-600 hover:bg-blue-700 text-white shadow-md transition-colors flex items-center gap-2 text-sm font-medium"
                      title="Generate PDF"
                    >
                      <FileText className="w-4 h-4" />
                      <span className="hidden sm:inline">Export PDF</span>
                    </button>
                  </div>
                </div>

                <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden ring-1 ring-slate-900/5">
                   {sections.map((section, idx) => (
                     <details 
                        key={idx} 
                        open 
                        className="group border-b border-slate-100 dark:border-slate-800 last:border-0"
                     >
                       <summary className="cursor-pointer p-4 bg-slate-50/50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center justify-between select-none">
                          <span className="font-semibold text-base md:text-lg text-slate-800 dark:text-slate-200">{section.title}</span>
                          <div className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
                            <ChevronRight className="w-5 h-5 text-slate-400 transform group-open:rotate-90 transition-transform duration-200" />
                          </div>
                       </summary>
                       <div className="p-6 prose prose-slate dark:prose-invert max-w-none text-base leading-relaxed animate-in slide-in-from-top-2 duration-200">
                          <ReactMarkdown
                            components={{
                               code({children, className}) {
                                   const lang = className?.replace("language-","") || "text";
                                   return (
                                     <div className="relative group my-4 rounded-lg overflow-hidden bg-[#0f172a] border border-slate-700 shadow-inner">
                                       <div className="flex items-center justify-between px-4 py-2 bg-slate-900/80 text-[10px] tracking-widest text-slate-400 font-mono uppercase border-b border-slate-800/50">
                                         <span>{lang}</span>
                                       </div>
                                       <pre className="p-4 overflow-x-auto text-sm text-slate-300 font-mono leading-relaxed custom-scrollbar">
                                         <code className={className}>{children}</code>
                                       </pre>
                                     </div>
                                   );
                               }
                            }}
                          >
                            {section.content}
                          </ReactMarkdown>
                       </div>
                     </details>
                   ))}
                </div>
                
                {/* Footer Tip */}
                <div className="mt-8 mb-8 text-center">
                   <p className="text-xs text-slate-400 font-medium">Universal Interface AI • Powered by Gemini 3 Pro</p>
                </div>
              </div>
            )}

            {!result && !loading && (
              <div className="flex flex-col items-center justify-center py-16 opacity-40 select-none">
                <div className="w-24 h-24 rounded-2xl bg-slate-100 dark:bg-slate-800 mb-6 flex items-center justify-center">
                   <Monitor className="w-10 h-10 text-slate-300 dark:text-slate-600" />
                </div>
                <p className="text-slate-500 font-medium text-lg">Waiting for input...</p>
                <p className="text-slate-400 text-sm mt-2">Upload a screenshot to get started</p>
              </div>
            )}
            
          </div>
        </div>

        {/* --- Floating Chat Button --- */}
        {result && (
          <button 
            onClick={() => setIsChatOpen(true)}
            className="fixed bottom-6 right-6 z-40 px-5 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-xl hover:shadow-2xl transition-all transform hover:-translate-y-1 flex items-center gap-2 group animate-in slide-in-from-bottom-10 fade-in duration-500 active:scale-95"
          >
            <MessageCircle className="w-6 h-6 group-hover:rotate-12 transition-transform" />
            <span className="font-semibold hidden md:inline">Ask Questions</span>
          </button>
        )}

        {/* --- Chat Panel --- */}
        {result && (
          <ChatPanel 
            isOpen={isChatOpen} 
            onClose={() => setIsChatOpen(false)} 
            analysisContext={result} 
          />
        )}

        {/* --- PDF Preview Modal --- */}
        {result && (
          <PdfPreviewModal
            isOpen={isPdfModalOpen}
            onClose={() => setIsPdfModalOpen(false)}
            data={{
              task: task,
              result: result,
              imageFile: image,
              url: url,
              timestamp: Date.now(),
              sections: parseSections(result)
            }}
          />
        )}

      </div>
    </div>
  );
};

export default WebUITool;