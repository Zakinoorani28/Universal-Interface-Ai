import React from 'react';
import { Monitor, Moon, Sun, Plus } from 'lucide-react';

interface HeaderProps {
  darkMode: boolean;
  toggleDarkMode: () => void;
  onNewChat: () => void;
}

const Header: React.FC<HeaderProps> = ({ darkMode, toggleDarkMode, onNewChat }) => {
  return (
    <header className="flex-shrink-0 h-16 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-between px-4 md:px-6 shadow-sm z-20 relative">
      <div className="flex items-center gap-3">
        <div className="bg-blue-600 w-8 h-8 rounded-lg flex items-center justify-center shadow-lg shadow-blue-600/20">
            <Monitor className="text-white w-5 h-5" />
        </div>
        <h1 className="text-lg md:text-xl font-bold tracking-tight text-slate-900 dark:text-white truncate">
          Universal Interface AI
        </h1>
      </div>

      <div className="flex items-center gap-2 md:gap-3">
        {/* New Chat Button */}
        <button
          onClick={onNewChat}
          className="group flex items-center gap-2 px-3 md:px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-all shadow-md hover:shadow-lg active:scale-95 text-xs md:text-sm"
          title="Start a new analysis"
        >
          <Plus className="w-4 h-4 group-hover:rotate-90 transition-transform duration-300" />
          <span className="hidden sm:inline">New Chat</span>
        </button>

        <div className="h-6 w-px bg-slate-200 dark:bg-slate-800 mx-1"></div>

        {/* Theme Toggle */}
        <button
          onClick={toggleDarkMode}
          className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-slate-600 dark:text-slate-400"
          aria-label="Toggle theme"
        >
          {darkMode ? (
            <Sun className="w-5 h-5 text-yellow-400" />
          ) : (
            <Moon className="w-5 h-5" />
          )}
        </button>
      </div>
    </header>
  );
};

export default Header;