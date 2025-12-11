import { useState, useEffect } from 'react';
import WebUITool from './components/WebUITool';
import Header from './components/Header';

const App = () => {
  // Simple dark mode management
  const [darkMode, setDarkMode] = useState(false);
  
  // Session Key: Changing this forces WebUITool to re-mount, 
  // effectively resetting its internal state (inputs, results, chat) for a "New Chat"
  const [sessionKey, setSessionKey] = useState(0);

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  const handleNewChat = () => {
    // Increment key to reset the tool
    setSessionKey(prev => prev + 1);
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 overflow-x-hidden">
      
      {/* Header Component */}
      <Header 
        darkMode={darkMode} 
        toggleDarkMode={() => setDarkMode(!darkMode)} 
        onNewChat={handleNewChat}
      />

      {/* Main Content */}
      <main className="flex-1">
        {/* We use the key prop to force a complete reset of the component when New Chat is clicked */}
        <WebUITool key={sessionKey} />
      </main>
      
    </div>
  );
};

export default App;