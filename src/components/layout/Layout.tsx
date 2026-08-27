import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { Zap, Rocket, ChevronDown, LogOut } from 'lucide-react';
import { BrandMark } from '../ui/BrandMark';

interface LayoutProps {
  children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  const { user, logout, userEmail, userName, userPhoto } = useAuth();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowUserMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = async () => {
    try {
      await logout();
      setShowUserMenu(false);
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#030712] via-[#0a1628] to-[#030712]">
      {/* Header */}
      <header className="glass border-b border-slate-800/50 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <BrandMark size="md" className="hover:scale-105 transition-transform cursor-pointer" />
              <div>
                <span className="text-xl font-bold text-white tracking-tight">ScriptFlow Pro</span>
                <span className="hidden sm:inline ml-2 text-xs text-blue-400 bg-blue-500/20 px-2 py-0.5 rounded-full">v2.0</span>
              </div>
            </div>

            <div className="flex items-center gap-4">
              {user && (
                <div className="relative" ref={menuRef}>
                  <button
                    onClick={() => setShowUserMenu(!showUserMenu)}
                    className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-slate-800/50 transition-all duration-200 group"
                  >
                    <div className="flex items-center gap-3">
                      {userPhoto ? (
                        <img 
                          src={userPhoto} 
                          alt={userName || 'User'} 
                          className="w-8 h-8 rounded-full ring-2 ring-blue-500/50 object-cover transition-all group-hover:ring-blue-400" 
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-semibold text-sm transition-all group-hover:scale-105">
                          {userName?.charAt(0).toUpperCase() || 'U'}
                        </div>
                      )}
                      <span className="text-sm text-slate-300 hidden md:block">
                        {userName || userEmail}
                      </span>
                    </div>
                    <ChevronDown size={16} className={`text-slate-400 transition-transform duration-200 ${showUserMenu ? 'rotate-180' : ''}`} aria-hidden="true" />
                  </button>

                  {/* Dropdown Menu */}
                  {showUserMenu && (
                    <div className="absolute right-0 mt-2 w-64 glass rounded-xl border border-slate-800/50 shadow-2xl overflow-hidden animate-fade-in">
                      <div className="p-4 border-b border-slate-800/50">
                        <div className="flex items-center gap-3">
                          {userPhoto ? (
                            <img 
                              src={userPhoto} 
                              alt={userName || 'User'} 
                              className="w-10 h-10 rounded-full ring-2 ring-blue-500/50 object-cover" 
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-semibold text-lg">
                              {userName?.charAt(0).toUpperCase() || 'U'}
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-white font-medium text-sm truncate">{userName || 'User'}</p>
                            <p className="text-slate-400 text-xs truncate">{userEmail}</p>
                          </div>
                        </div>
                      </div>
                      <div className="p-2">
                        <button
                          onClick={handleLogout}
                          className="w-full px-4 py-2.5 text-left text-red-400 hover:bg-red-500/10 rounded-lg transition-all duration-200 flex items-center gap-3 text-sm font-medium group"
                        >
                          <LogOut size={16} className="transition-transform group-hover:translate-x-1" aria-hidden="true" />
                          Sign Out
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/50 mt-12 py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
            <p className="text-xs text-slate-500">
              © 2026 ScriptFlow Pro. All rights reserved.
            </p>
            <div className="flex items-center gap-6 text-xs text-slate-500">
              <span className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse"></span>
                Secure
              </span>
              <span className="flex items-center gap-1"><Zap size={12} /> Fast</span>
              <span className="flex items-center gap-1"><Rocket size={12} /> Professional</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Layout;