import React from 'react';
import { Home, PlusCircle, Ticket, MessageSquare } from 'lucide-react';
import { ViewState } from '../types';

interface NavigationProps {
  currentView: ViewState;
  setView: (view: ViewState) => void;
  hasTicket: boolean;
}

const Navigation: React.FC<NavigationProps> = ({ currentView, setView, hasTicket }) => {
  const navItemClass = (view: ViewState) =>
    `flex flex-col items-center justify-center w-full h-full space-y-1 ${
      currentView === view ? 'text-primary' : 'text-gray-400'
    }`;

  return (
    <div className="fixed bottom-0 left-0 w-full bg-white border-t border-gray-200 h-16 pb-safe z-50 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
      <div className="flex justify-around items-center h-full">
        <button onClick={() => setView(ViewState.HOME)} className={navItemClass(ViewState.HOME)}>
          <Home size={24} strokeWidth={currentView === ViewState.HOME ? 2.5 : 2} />
          <span className="text-[10px] font-medium">Beranda</span>
        </button>
        
        <button onClick={() => setView(ViewState.REGISTER)} className={navItemClass(ViewState.REGISTER)}>
          <PlusCircle size={24} strokeWidth={currentView === ViewState.REGISTER ? 2.5 : 2} />
          <span className="text-[10px] font-medium">Daftar</span>
        </button>

        <button onClick={() => setView(ViewState.TICKET)} className={`${navItemClass(ViewState.TICKET)} relative`}>
          <Ticket size={24} strokeWidth={currentView === ViewState.TICKET ? 2.5 : 2} />
          <span className="text-[10px] font-medium">Tiket Saya</span>
          {hasTicket && (
            <span className="absolute top-1 right-6 w-2.5 h-2.5 bg-red-500 rounded-full border border-white"></span>
          )}
        </button>

        <button onClick={() => setView(ViewState.CHAT)} className={navItemClass(ViewState.CHAT)}>
          <MessageSquare size={24} strokeWidth={currentView === ViewState.CHAT ? 2.5 : 2} />
          <span className="text-[10px] font-medium">Tanya AI</span>
        </button>
      </div>
    </div>
  );
};

export default Navigation;