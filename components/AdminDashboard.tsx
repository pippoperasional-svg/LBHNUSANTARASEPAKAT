import React, { useEffect, useState } from 'react';
import { AdminUser, Ticket, TicketStatus, DailyStats, ServiceType } from '../types';
import { db } from '../services/database';
import { announceQueue } from '../services/audioService';
import { LogOut, RefreshCw, User, Bell, CheckCircle, SkipForward, Clock, Megaphone, BarChart3, Users, PieChart } from 'lucide-react';

interface AdminDashboardProps {
  user: AdminUser;
  onLogout: () => void;
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({ user, onLogout }) => {
  const [activeTicket, setActiveTicket] = useState<Ticket | null>(null);
  const [waitingTickets, setWaitingTickets] = useState<Ticket[]>([]);
  const [stats, setStats] = useState<DailyStats>({
    total: 0,
    completed: 0,
    cancelled: 0,
    byService: {
      [ServiceType.CONSULTATION]: 0,
      [ServiceType.CRIMINAL]: 0,
      [ServiceType.CIVIL]: 0
    }
  });
  const [isLoading, setIsLoading] = useState(false);

  const fetchData = async () => {
    setIsLoading(true);
    const [queueData, statsData] = await Promise.all([
      db.getAdminQueueData(user.role),
      db.getDailyStats()
    ]);
    setActiveTicket(queueData.active);
    setWaitingTickets(queueData.waiting);
    setStats(statsData);
    setIsLoading(false);
  };

  useEffect(() => {
    fetchData();
    // Poll updates every 5 seconds
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, [user.role]);

  const handleCallTicket = async (ticket: Ticket) => {
    if (activeTicket) {
      await db.updateTicketStatus(activeTicket.id, TicketStatus.COMPLETED);
    }
    
    await db.updateTicketStatus(ticket.id, TicketStatus.CALLED);
    // Play Sound Immediately
    announceQueue(ticket.queueNumber);
    fetchData();
  };

  const handleCompleteActive = async () => {
    if (activeTicket) {
      await db.updateTicketStatus(activeTicket.id, TicketStatus.COMPLETED);
      fetchData();
    }
  };

  const handleRecallActive = async () => {
    if (activeTicket) {
      announceQueue(activeTicket.queueNumber);
    }
  };

  // Helper to calculate percentage for progress bars
  const getPercent = (val: number) => {
    if (stats.total === 0) return 0;
    return Math.round((val / stats.total) * 100);
  };

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col font-sans">
      {/* Navbar */}
      <div className="bg-primary text-white shadow-md p-4 flex justify-between items-center sticky top-0 z-50">
        <div>
           <h1 className="font-bold text-lg leading-none">Admin POSBAKUM</h1>
           <p className="text-xs text-white/80">{user.name} | {user.role === 'ALL' ? 'Semua Layanan' : user.role}</p>
        </div>
        <button 
          onClick={onLogout}
          className="bg-red-500 hover:bg-red-600 text-white p-2 rounded-lg transition-colors flex items-center text-sm font-medium"
        >
          <LogOut size={16} className="mr-2" /> Logout
        </button>
      </div>

      <div className="flex-1 p-4 md:p-6 max-w-7xl mx-auto w-full space-y-6">
        
        {/* Active Ticket & Stats Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
           
           {/* Column 1: Active Ticket (Takes 2 columns space on LG screens) */}
           <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm p-6 border-l-8 border-green-500 flex flex-col justify-between relative overflow-hidden">
              <div className="absolute right-0 top-0 p-6 opacity-5">
                 <Megaphone size={150} />
              </div>
              <div className="relative z-10">
                <div className="flex justify-between items-start mb-4">
                  <h3 className="text-gray-500 font-bold uppercase tracking-wider text-sm">Sedang Dilayani</h3>
                  <span className="bg-green-100 text-green-700 text-xs px-2 py-1 rounded font-bold">LOKET 1</span>
                </div>
                
                {activeTicket ? (
                  <>
                    <div className="flex items-baseline space-x-3 mb-4">
                       <h2 className="text-6xl sm:text-7xl font-bold text-gray-900">{activeTicket.queueNumber}</h2>
                       <span className="text-xl sm:text-2xl text-primary font-medium border-l-2 border-gray-200 pl-3">{activeTicket.serviceType}</span>
                    </div>
                    <div className="space-y-2 bg-gray-50 p-4 rounded-xl border border-gray-100">
                       <p className="text-gray-800 font-bold flex items-center text-lg"><User size={20} className="mr-2 text-gray-400"/> {activeTicket.name}</p>
                       <p className="text-gray-500 text-sm pl-7 italic">"{activeTicket.caseNumber || 'Tidak ada keterangan'}"</p>
                    </div>
                  </>
                ) : (
                   <div className="py-12 text-center text-gray-400 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                      <Megaphone className="mx-auto mb-2 opacity-50" size={32} />
                      <p>Belum ada antrian dipanggil</p>
                   </div>
                )}
              </div>

              {activeTicket && (
                <div className="grid grid-cols-2 gap-3 mt-6 relative z-10">
                   <button 
                     onClick={handleRecallActive}
                     className="bg-yellow-100 text-yellow-800 font-bold py-3 rounded-xl hover:bg-yellow-200 transition-colors flex items-center justify-center"
                   >
                     <Bell size={20} className="mr-2" /> Panggil Ulang
                   </button>
                   <button 
                     onClick={handleCompleteActive}
                     className="bg-green-600 text-white font-bold py-3 rounded-xl hover:bg-green-700 transition-colors flex items-center justify-center"
                   >
                     <CheckCircle size={20} className="mr-2" /> Selesai
                   </button>
                </div>
              )}
           </div>

           {/* Column 2: Today's Statistics */}
           <div className="bg-white rounded-2xl shadow-sm p-5 border border-gray-100 flex flex-col">
              <h3 className="text-gray-800 font-bold flex items-center mb-4 pb-2 border-b border-gray-100">
                 <BarChart3 size={18} className="mr-2 text-primary"/> Statistik Hari Ini
              </h3>
              
              <div className="grid grid-cols-2 gap-3 mb-5">
                 <div className="bg-blue-50 p-3 rounded-xl">
                    <p className="text-xs text-blue-600 mb-1">Total Pengunjung</p>
                    <p className="text-2xl font-bold text-blue-900">{stats.total}</p>
                 </div>
                 <div className="bg-green-50 p-3 rounded-xl">
                    <p className="text-xs text-green-600 mb-1">Selesai</p>
                    <p className="text-2xl font-bold text-green-900">{stats.completed}</p>
                 </div>
              </div>

              <div className="flex-1 space-y-4">
                 <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Distribusi Layanan</p>
                 
                 {Object.values(ServiceType).map((type) => {
                    const count = stats.byService[type] || 0;
                    const percent = getPercent(count);
                    return (
                       <div key={type}>
                          <div className="flex justify-between text-xs mb-1">
                             <span className="text-gray-700 font-medium">{type}</span>
                             <span className="text-gray-500">{count} ({percent}%)</span>
                          </div>
                          <div className="w-full bg-gray-100 rounded-full h-2">
                             <div 
                                className="bg-primary h-2 rounded-full transition-all duration-500" 
                                style={{ width: `${percent}%` }}
                             ></div>
                          </div>
                       </div>
                    );
                 })}
              </div>
           </div>
        </div>

        {/* Waiting List Section */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
           <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <div className="flex items-center space-x-4">
                <h3 className="font-bold text-gray-800 flex items-center">
                  <Clock size={18} className="mr-2 text-gray-500"/> Antrian Menunggu
                </h3>
                {waitingTickets.length > 0 && (
                   <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                     {waitingTickets.length}
                   </span>
                )}
              </div>
              <button onClick={fetchData} className="text-primary hover:bg-primary/10 p-2 rounded-full transition-colors group">
                <RefreshCw size={18} className={`group-hover:rotate-180 transition-transform duration-500 ${isLoading ? 'animate-spin' : ''}`}/>
              </button>
           </div>
           
           <div className="divide-y divide-gray-100 max-h-[500px] overflow-y-auto">
             {waitingTickets.length === 0 ? (
                <div className="p-12 text-center flex flex-col items-center justify-center text-gray-400">
                   <div className="bg-gray-100 p-4 rounded-full mb-3">
                      <CheckCircle size={32} className="text-gray-300" />
                   </div>
                   <p>Tidak ada antrian menunggu</p>
                </div>
             ) : (
                waitingTickets.map((ticket) => (
                  <div key={ticket.id} className="p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center hover:bg-blue-50/50 transition-colors border-l-4 border-transparent hover:border-blue-500">
                     <div className="mb-3 sm:mb-0 w-full sm:w-auto">
                        <div className="flex items-center">
                           <span className="bg-gray-100 text-gray-800 font-bold px-4 py-2 rounded-lg text-xl mr-4 border border-gray-200">
                              {ticket.queueNumber}
                           </span>
                           <div>
                              <p className="font-bold text-gray-900">{ticket.name}</p>
                              <div className="flex items-center text-xs text-gray-500 mt-1">
                                 <span className="bg-gray-100 px-2 py-0.5 rounded text-gray-600 font-medium mr-2">{ticket.serviceType}</span>
                                 <span>• {new Date(ticket.timestamp).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})} WIB</span>
                              </div>
                           </div>
                        </div>
                     </div>
                     <div className="flex space-x-2 w-full sm:w-auto">
                        <button 
                           onClick={() => handleCallTicket(ticket)}
                           className="flex-1 sm:flex-none bg-primary text-white px-6 py-2 rounded-lg font-medium hover:bg-primary/90 transition-colors flex items-center justify-center shadow-sm"
                        >
                           <Megaphone size={16} className="mr-2" /> Panggil
                        </button>
                     </div>
                  </div>
                ))
             )}
           </div>
        </div>

      </div>
    </div>
  );
};

export default AdminDashboard;