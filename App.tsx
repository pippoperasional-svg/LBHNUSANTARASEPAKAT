import React, { useState, useEffect, useRef } from 'react';
import { ViewState, Ticket, ServiceType, TicketStatus, ChatMessage, AdminUser, AppConfig, DailyStats } from './types';
import Navigation from './components/Navigation';
import QueueCard from './components/QueueCard';
import AdminDashboard from './components/AdminDashboard';
import { chatWithLegalAssistant } from './services/geminiService';
import { db } from './services/database';
import { announceQueue } from './services/audioService';
import { Search, Bell, MapPin, Send, Loader2, Info, ChevronRight, User, MessageSquare, Ticket as TicketIcon, Trash2, BookOpen, Target, Heart, Shield, Users, Phone, Lock, LogIn, Volume2, VolumeX, FileText, CheckCircle, BarChart3, RefreshCw } from 'lucide-react';

const App: React.FC = () => {
  const [currentView, setView] = useState<ViewState>(ViewState.HOME);
  
  // App Config - Hardcoded URLs for stability
  const [config, setConfig] = useState<AppConfig>({
    logoUrl: "https://qboaduixikjbruhzhjau.supabase.co/storage/v1/object/public/images/LBH%20NUSANTARA.png",
    courtLogoUrl: "https://qboaduixikjbruhzhjau.supabase.co/storage/v1/object/public/images/logo%20LBH%20Nusatara%20Sepakat.png",
    lbhName: "LBH NUSANTARA SEPAKAT",
    courtName: "PENGADILAN NEGERI KELAS 1 B BANGKINANG",
    posbakumName: "POSBAKUM PADA PENGADILAN NEGERI KELAS 1 B BANGKINANG"
  });

  // Fallback logo constant
  const DEFAULT_LOGO = "https://upload.wikimedia.org/wikipedia/commons/e/e0/Logo_Pengadilan_Negeri_-_Mahkamah_Agung_RI.png";
  
  // Handler for Broken Images
  const handleLogoError = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    // If the image fails, try the fallback. If fallback matches current, stop to avoid loop.
    if (e.currentTarget.src !== DEFAULT_LOGO) {
        e.currentTarget.src = DEFAULT_LOGO;
    }
  };

  // Data States
  const [myTicket, setMyTicket] = useState<Ticket | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [currentQueueNumber, setCurrentQueueNumber] = useState("-");
  const [pendingQueues, setPendingQueues] = useState<Ticket[]>([]);
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
  
  // Audio State
  const [audioEnabled, setAudioEnabled] = useState(false);
  const lastAnnouncedRef = useRef<string | null>(null);

  // Admin State
  const [adminUser, setAdminUser] = useState<AdminUser | null>(null);
  const [adminUsername, setAdminUsername] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  
  // Loading States
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isTyping, setIsTyping] = useState(false);

  // Form State
  const [formName, setFormName] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formCaseNum, setFormCaseNum] = useState(''); // Used for Description/Keperluan
  const [formService, setFormService] = useState<ServiceType>(ServiceType.CONSULTATION);

  const chatEndRef = useRef<HTMLDivElement>(null);

  // Helper to check if ticket is currently active (cannot register new one)
  const hasActiveTicket = () => {
    return myTicket && (myTicket.status === TicketStatus.WAITING || myTicket.status === TicketStatus.CALLED);
  };

  const fetchGlobalData = async () => {
    try {
      const [status, dailyStats] = await Promise.all([
           db.getQueueStatus(),
           db.getDailyStats()
      ]);
      
      setCurrentQueueNumber(status.currentNumber);
      setPendingQueues(status.pending);
      setStats(dailyStats);
      
      // Audio Notification Logic
      if (status.currentNumber !== '-' && status.currentNumber !== lastAnnouncedRef.current) {
           lastAnnouncedRef.current = status.currentNumber;
           if (audioEnabled) {
               announceQueue(status.currentNumber);
           }
      }
      
      // Sync My Ticket Status
      if (myTicket) {
         const updatedMyTicket = await db.getActiveTicket();
         if (updatedMyTicket) {
           if (updatedMyTicket.status !== myTicket.status) {
              setMyTicket(updatedMyTicket);
           }
         }
      }
    } catch (e) {
      console.error("Polling error", e);
    }
  };

  // Initial Data Loading
  useEffect(() => {
    const loadData = async () => {
      setIsLoadingData(true);
      // Create a minimum delay to show the splash screen branding (2.5 seconds)
      const minDelay = new Promise(resolve => setTimeout(resolve, 2500));

      try {
        const [ticket, chatHistory, queueStatus, settings, statsData, _delay] = await Promise.all([
          db.getActiveTicket(),
          db.getChatHistory(),
          db.getQueueStatus(),
          db.getAppSettings(),
          db.getDailyStats(),
          minDelay // Ensure we wait at least 2.5s
        ]);
        
        setConfig(settings);
        setStats(statsData);
        if (ticket) setMyTicket(ticket);
        setMessages(chatHistory);
        setCurrentQueueNumber(queueStatus.currentNumber);
        setPendingQueues(queueStatus.pending);
        
        // Restore Admin Session if exists
        const savedAdmin = db.getAdminSession();
        if (savedAdmin) {
            setAdminUser(savedAdmin);
            setView(ViewState.ADMIN_DASHBOARD);
        }
        
        // Init ref to prevent announcing on first load
        if (queueStatus.currentNumber !== '-') {
            lastAnnouncedRef.current = queueStatus.currentNumber;
        }
      } catch (error) {
        console.error("Failed to load initial data", error);
      } finally {
        setIsLoadingData(false);
      }
    };

    loadData();
  }, []);

  // Real-time Polling & Background Wake-up Handler
  useEffect(() => {
    if (currentView === ViewState.ADMIN_DASHBOARD) return;

    // 1. Regular Interval Polling
    const intervalId = setInterval(fetchGlobalData, 4000); 

    // 2. Handle Wake Up (User switches back to tab after long wait)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        // Immediate fetch when app becomes visible again
        console.log("App woke up, refreshing data...");
        fetchGlobalData();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      clearInterval(intervalId);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [myTicket, currentView, audioEnabled]);

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    await fetchGlobalData();
    // Simulate a small delay so user sees the spinner
    setTimeout(() => setIsRefreshing(false), 800);
  };

  const handleRegister = async () => {
    // Double check strictly before submit
    if (hasActiveTicket()) {
        alert("Anda masih memiliki antrian aktif. Mohon selesaikan antrian sebelumnya.");
        setView(ViewState.TICKET);
        return;
    }

    if (!formName || !formPhone) {
      alert("Mohon lengkapi Nama dan No. HP");
      return;
    }
    setIsSubmitting(true);
    
    const queueNumber = await db.generateQueueNumber(formService);

    // Calculate Dynamic Estimation
    // Logic: Current pending queues * 15 mins + 15 mins base
    // This is more accurate than hardcoded 45 mins
    const estimatedMinutes = (pendingQueues.length + 1) * 15;
    const estimatedTimeStr = `${estimatedMinutes} menit`;

    const newTicket: Ticket = {
      id: Date.now().toString(),
      queueNumber: queueNumber, 
      name: formName,
      caseNumber: formCaseNum, // Storing description in caseNumber field
      serviceType: formService,
      status: TicketStatus.WAITING,
      estimatedTime: estimatedTimeStr,
      timestamp: Date.now()
    };

    const success = await db.createTicket(newTicket);
    
    if (success) {
      setMyTicket(newTicket);
      setPendingQueues(prev => [...prev, newTicket]);
      setView(ViewState.TICKET);
      
      // RESET FORM FIELDS
      setFormName('');
      setFormPhone('');
      setFormCaseNum('');
      setFormService(ServiceType.CONSULTATION);
    } else {
      alert("Gagal mengambil antrian. Silakan coba lagi.");
    }
    
    setIsSubmitting(false);
  };

  const handleSendMessage = async () => {
    if (!inputMsg.trim()) return;
    
    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      text: inputMsg,
      timestamp: Date.now()
    };
    
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setInputMsg('');
    setIsTyping(true);
    db.saveMessage(userMsg);

    const replyText = await chatWithLegalAssistant(
      userMsg.text, 
      messages.map(m => ({ role: m.role, text: m.text }))
    );
    
    setIsTyping(false);
    
    const botMsg: ChatMessage = {
      id: (Date.now() + 1).toString(),
      role: 'model',
      text: replyText,
      timestamp: Date.now()
    };

    setMessages(prev => [...prev, botMsg]);
    db.saveMessage(botMsg);
  };

  const clearChat = async () => {
    if (confirm('Hapus riwayat chat?')) {
      await db.clearChatHistory();
      const initialMsgs = await db.getChatHistory();
      setMessages(initialMsgs);
    }
  };

  const handleCancelTicket = async () => {
    if (confirm('Batalkan antrian?') && myTicket) {
      await db.cancelTicket(myTicket.id);
      // We explicitly update local state to cancelled
      setMyTicket({...myTicket, status: TicketStatus.CANCELLED});
    }
  };

  const handleNewTicket = () => {
      setMyTicket(null);
      setView(ViewState.REGISTER);
  };

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminUsername || !adminPassword) {
      alert("Mohon isi username dan password");
      return;
    }

    setIsLoggingIn(true);
    try {
      const user = await db.loginAdmin(adminUsername, adminPassword);
      if (user) {
        setAdminUser(user);
        db.saveAdminSession(user); 
        setView(ViewState.ADMIN_DASHBOARD);
        setAdminUsername('');
        setAdminPassword('');
      } else {
        alert('Username atau Password salah!');
      }
    } catch (e) {
      alert('Terjadi kesalahan koneksi.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleAdminLogout = () => {
    db.clearAdminSession();
    setAdminUser(null);
    setView(ViewState.HOME);
  };

  const toggleAudio = () => {
      setAudioEnabled(!audioEnabled);
  };

  // Helper for safe date formatting
  const formatTime = (timestamp: number) => {
    try {
      const date = new Date(timestamp);
      if (isNaN(date.getTime())) return '-';
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch (e) {
      return '-';
    }
  };

  const [inputMsg, setInputMsg] = useState('');

  // Loading Screen (Splash Screen)
  if (isLoadingData) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-white via-slate-50 to-gray-100 relative overflow-hidden font-sans">
        
        {/* Abstract Background Shapes */}
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0">
            <div className="absolute -top-[10%] -left-[10%] w-[50%] h-[50%] bg-primary/5 rounded-full blur-[80px]"></div>
            <div className="absolute top-[40%] right-[0%] w-[40%] h-[40%] bg-yellow-400/5 rounded-full blur-[60px]"></div>
            <div className="absolute -bottom-[10%] left-[20%] w-[60%] h-[40%] bg-primary/5 rounded-full blur-[70px]"></div>
        </div>

        <div className="relative z-10 flex flex-col items-center justify-center w-full max-w-sm px-6 text-center">
           
           {/* Animated Logo Section */}
           <div className="flex items-center justify-center space-x-4 mb-10">
              {/* PN Logo */}
              <div className="bg-white p-4 rounded-2xl shadow-xl shadow-gray-200/50 border border-white ring-1 ring-gray-100 transform transition-transform duration-700 hover:scale-105">
                 <img 
                    src={config.courtLogoUrl} 
                    onError={handleLogoError}
                    alt="PN Logo"
                    className="w-16 h-16 object-contain"
                 />
              </div>
              
              {/* Connector */}
              <div className="h-px w-8 bg-gray-300"></div>
              
              {/* LBH Logo */}
              <div className="bg-white p-4 rounded-2xl shadow-xl shadow-gray-200/50 border border-white ring-1 ring-gray-100 transform transition-transform duration-700 hover:scale-105">
                 <img 
                    src={config.logoUrl} 
                    onError={handleLogoError}
                    alt="LBH Logo"
                    className="w-16 h-16 object-contain"
                 />
              </div>
           </div>
           
           {/* Typography */}
           <div className="space-y-3 mb-12 animate-fade-in-up">
              <h1 className="text-3xl font-extrabold text-gray-800 tracking-tight leading-none">
                <span className="text-primary">POSBAKUM LBH NUNSATARA SEPAKAT</span>
              </h1>
              <div className="flex justify-center my-3">
                 <div className="h-1 w-16 bg-gradient-to-r from-primary to-yellow-400 rounded-full"></div>
              </div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-widest leading-relaxed px-4">
                {config.courtName}
              </p>
           </div>

           {/* Custom Loader */}
           <div className="flex flex-col items-center w-full max-w-[160px] space-y-3">
             <div className="w-full h-1 bg-gray-200 rounded-full overflow-hidden">
                <div className="h-full bg-primary rounded-full animate-indeterminate-bar"></div>
             </div>
             <p className="text-[10px] text-gray-400 font-medium animate-pulse">Memuat Aplikasi...</p>
           </div>
        </div>

        {/* Footer Branding */}
        <div className="absolute bottom-10 z-10 text-center w-full px-6">
            <p className="text-[9px] text-gray-400 uppercase tracking-wider mb-1">Powered by</p>
            <p className="text-xs font-bold text-gray-700 tracking-wide">{config.lbhName}</p>
        </div>

        <style>{`
          @keyframes indeterminate {
            0% { transform: translateX(-100%) scaleX(0.2); }
            50% { transform: translateX(0%) scaleX(0.5); }
            100% { transform: translateX(100%) scaleX(0.2); }
          }
          .animate-indeterminate-bar {
            animation: indeterminate 1.5s infinite linear;
            width: 100%;
          }
          @keyframes fadeInUp {
            from { opacity: 0; transform: translateY(20px); }
            to { opacity: 1; transform: translateY(0); }
          }
          .animate-fade-in-up {
            animation: fadeInUp 0.8s ease-out forwards;
          }
        `}</style>
      </div>
    );
  }

  // --- Views Renders ---

  const renderAdminLogin = () => (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center p-6">
       <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-sm">
          <div className="text-center mb-8">
             <div className="bg-primary/10 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <img 
                  src={config.logoUrl} 
                  onError={handleLogoError}
                  referrerPolicy="no-referrer"
                  alt="Logo" 
                  className="w-10 h-10 object-contain" 
                />
             </div>
             <h2 className="text-2xl font-bold text-gray-800">Login Petugas</h2>
             <p className="text-gray-500 text-sm">Masuk untuk mengelola antrian</p>
          </div>
          
          <form onSubmit={handleAdminLogin} className="space-y-4">
             <div>
               <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
               <input 
                 type="text" 
                 className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-primary outline-none"
                 value={adminUsername}
                 onChange={e => setAdminUsername(e.target.value)}
                 placeholder="Username"
               />
             </div>
             <div>
               <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
               <input 
                 type="password" 
                 className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-primary outline-none"
                 value={adminPassword}
                 onChange={e => setAdminPassword(e.target.value)}
                 placeholder="Password"
               />
             </div>
             <button 
               type="submit" 
               disabled={isLoggingIn}
               className="w-full bg-primary text-white font-bold py-3 rounded-xl shadow-lg hover:bg-primary/90 transition-all mt-4 flex items-center justify-center"
             >
               {isLoggingIn ? <Loader2 className="animate-spin" /> : "Masuk"}
             </button>
          </form>

          <button onClick={() => setView(ViewState.HOME)} className="w-full text-center text-gray-500 text-sm mt-6 hover:text-primary">
             Kembali ke Beranda
          </button>
       </div>
    </div>
  );

  const renderHome = () => (
    <div className="pb-24">
      {/* Header */}
      <div className="bg-primary text-white p-6 rounded-b-3xl shadow-lg relative overflow-hidden">
        
        <div className="flex justify-between items-start mb-6 relative z-10">
          <div className="flex flex-1 items-start pr-3 min-w-0">
            
            {/* Logo Container - Order: PN then LBH, space-x-1 */}
            <div className="flex items-center space-x-1 mr-3 flex-shrink-0">
               {/* PN Logo Wrapper (FIRST) */}
               <div className="w-11 h-11 flex items-center justify-center">
                  <img 
                      src={config.courtLogoUrl} 
                      onError={handleLogoError}
                      referrerPolicy="no-referrer"
                      alt="Logo PN" 
                      className="w-full h-full object-contain drop-shadow-sm" 
                  />
               </div>
               
               {/* LBH Logo Wrapper (SECOND) */}
               <div className="w-11 h-11 flex items-center justify-center">
                  <img 
                      src={config.logoUrl} 
                      onError={handleLogoError}
                      referrerPolicy="no-referrer"
                      alt="Logo LBH" 
                      className="w-full h-full object-contain drop-shadow-sm" 
                  />
               </div>
            </div>
            
            {/* Text Container - Added min-w-0 to allow text wrapping */}
            <div className="flex-1 min-w-0">
              <p className="text-white text-sm font-bold mb-1 truncate">{config.lbhName}</p>
              <h1 className="text-white text-sm font-bold leading-snug mb-2 uppercase break-words">{config.courtName}</h1>
              <div className="inline-flex items-center bg-white/10 px-3 py-1 rounded-lg backdrop-blur-sm">
                  <Shield size={14} className="mr-2 text-secondary flex-shrink-0" />
                  <p className="text-white text-sm font-bold uppercase tracking-wide">POSBAKUM</p>
              </div>
            </div>
          </div>
          
          <div className="flex flex-col space-y-2 flex-shrink-0 ml-2">
              <div className="bg-white/20 p-2 rounded-full backdrop-blur-sm cursor-pointer hover:bg-white/30 transition-all flex-shrink-0" onClick={() => setView(ViewState.ABOUT)}>
                <Info size={20} />
              </div>
              <div 
                className={`p-2 rounded-full backdrop-blur-sm cursor-pointer transition-all flex-shrink-0 ${audioEnabled ? 'bg-white text-primary' : 'bg-white/20 text-white hover:bg-white/30'}`} 
                onClick={toggleAudio}
              >
                {audioEnabled ? <Volume2 size={20} /> : <VolumeX size={20} />}
              </div>
          </div>
        </div>

        <div className="bg-white/10 backdrop-blur-md rounded-xl p-4 border border-white/20 relative z-10">
          <p className="text-xs text-white/80 mb-1">Antrian Sedang Dilayani</p>
          <div className="flex justify-between items-end">
             <h2 className="text-4xl font-bold">{currentQueueNumber}</h2>
             <span className="text-xs bg-secondary text-yellow-900 px-2 py-1 rounded font-bold mb-1">LOKET 1</span>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="px-6 -mt-6 mb-6 relative z-20">
        <div className="bg-white rounded-xl shadow-lg p-4 grid grid-cols-3 gap-2">
            <div 
              className="text-center cursor-pointer hover:bg-gray-50 rounded-lg py-2 transition-colors" 
              onClick={() => {
                 // Check if user has active ticket before going to register
                 if (hasActiveTicket()) {
                    setView(ViewState.TICKET);
                 } else {
                    setView(ViewState.REGISTER);
                 }
              }}
            >
                <div className="bg-primary/10 w-10 h-10 rounded-full flex items-center justify-center mx-auto mb-2 text-primary">
                    <Search size={20} />
                </div>
                <p className="text-[10px] font-medium text-gray-700">Ambil Antrian</p>
            </div>
            <div className="text-center cursor-pointer hover:bg-gray-50 rounded-lg py-2 transition-colors" onClick={() => setView(ViewState.CHAT)}>
                <div className="bg-orange-100 w-10 h-10 rounded-full flex items-center justify-center mx-auto mb-2 text-orange-600">
                    <MessageSquare size={20} />
                </div>
                <p className="text-[10px] font-medium text-gray-700">Tanya AI</p>
            </div>
            <div className="text-center cursor-pointer hover:bg-gray-50 rounded-lg py-2 transition-colors" onClick={() => setView(ViewState.ABOUT)}>
                <div className="bg-blue-100 w-10 h-10 rounded-full flex items-center justify-center mx-auto mb-2 text-blue-600">
                    <BookOpen size={20} />
                </div>
                <p className="text-[10px] font-medium text-gray-700">Profil LBH</p>
            </div>
        </div>
      </div>

      {/* Stats Section */}
      <div className="px-6 mb-6">
          <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-100">
             <h3 className="font-bold text-gray-800 text-xs uppercase tracking-wider mb-3 flex items-center">
               <BarChart3 size={14} className="mr-1.5 text-primary"/> Statistik Antrian
             </h3>
             <div className="grid grid-cols-3 gap-4 mb-4">
                <div className="flex flex-col items-center">
                   <div className="text-2xl font-bold text-blue-600">{stats.total}</div>
                   <div className="text-[10px] text-gray-500 font-medium text-center">Total</div>
                </div>
                <div className="flex flex-col items-center border-x border-gray-100 px-2">
                   <div className="text-2xl font-bold text-green-600">{stats.completed}</div>
                   <div className="text-[10px] text-gray-500 font-medium text-center">Selesai</div>
                </div>
                <div className="flex flex-col items-center">
                   <div className="text-2xl font-bold text-orange-500">{Math.max(0, stats.total - stats.completed - stats.cancelled)}</div>
                   <div className="text-[10px] text-gray-500 font-medium text-center">Menunggu</div>
                </div>
             </div>

             {/* Service Breakdown */}
             <div className="pt-4 border-t border-gray-100">
               <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-3">Berdasarkan Layanan</h4>
               <div className="space-y-3">
                  {/* Konsultasi */}
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-gray-600">Konsultasi Hukum</span>
                      <span className="font-bold text-gray-800">{stats.byService[ServiceType.CONSULTATION]}</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-1.5">
                      <div className="bg-blue-500 h-1.5 rounded-full" style={{ width: `${(stats.byService[ServiceType.CONSULTATION] / (stats.total || 1)) * 100}%` }}></div>
                    </div>
                  </div>

                  {/* Pidana */}
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-gray-600">Pidana</span>
                      <span className="font-bold text-gray-800">{stats.byService[ServiceType.CRIMINAL]}</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-1.5">
                      <div className="bg-red-500 h-1.5 rounded-full" style={{ width: `${(stats.byService[ServiceType.CRIMINAL] / (stats.total || 1)) * 100}%` }}></div>
                    </div>
                  </div>

                  {/* Perdata */}
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-gray-600">Perdata</span>
                      <span className="font-bold text-gray-800">{stats.byService[ServiceType.CIVIL]}</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-1.5">
                      <div className="bg-orange-500 h-1.5 rounded-full" style={{ width: `${(stats.byService[ServiceType.CIVIL] / (stats.total || 1)) * 100}%` }}></div>
                    </div>
                  </div>
               </div>
            </div>
          </div>
      </div>

      {/* Queue List */}
      <div className="px-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-bold text-gray-800 text-lg">Antrian Berikutnya</h3>
          <span className="text-xs text-primary font-medium">Lihat Semua</span>
        </div>
        <div className="space-y-3">
          {pendingQueues.length > 0 ? (
             pendingQueues.map(ticket => (
              <QueueCard 
                key={ticket.id}
                queueNumber={ticket.queueNumber}
                serviceType={ticket.serviceType}
                status={ticket.status}
              />
            ))
          ) : (
            <div className="text-center py-8 bg-gray-100 rounded-xl border border-dashed border-gray-300">
               <p className="text-gray-400 text-sm">Tidak ada antrian menunggu</p>
            </div>
          )}
        </div>
      </div>
      
      {/* Admin Login Link */}
      <div className="text-center mt-10">
         <button onClick={() => setView(ViewState.ADMIN_LOGIN)} className="text-xs text-gray-400 flex items-center justify-center mx-auto hover:text-primary transition-colors">
            <LogIn size={12} className="mr-1" /> Login Petugas
         </button>
      </div>
    </div>
  );

  const renderRegister = () => {
    // Session Guard
    if (hasActiveTicket()) {
        return (
            <div className="p-6 min-h-screen bg-white flex flex-col items-center justify-center text-center">
                <div className="bg-yellow-50 p-6 rounded-full mb-6">
                    <TicketIcon size={48} className="text-yellow-600" />
                </div>
                <h2 className="text-xl font-bold text-gray-800 mb-2">Antrian Masih Aktif</h2>
                <p className="text-gray-500 mb-8 max-w-xs">
                    Anda masih memiliki nomor antrian yang belum selesai. Mohon selesaikan antrian saat ini sebelum mengambil yang baru.
                </p>
                <button 
                  onClick={() => setView(ViewState.TICKET)}
                  className="bg-primary text-white px-8 py-3 rounded-xl font-medium shadow-lg w-full max-w-xs"
                >
                  Lihat Tiket Saya
                </button>
            </div>
        );
    }

    return (
      <div className="p-6 pb-24 min-h-screen bg-white">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Ambil Antrian</h2>
        
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nama Lengkap</label>
            <div className="relative">
               <User className="absolute left-3 top-3 text-gray-400" size={20} />
               <input 
                  type="text" 
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all text-gray-900"
                  placeholder="Sesuai KTP"
               />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nomor WhatsApp</label>
             <input 
                type="tel" 
                value={formPhone}
                onChange={(e) => {
                   // Only allow numbers
                   const val = e.target.value.replace(/[^0-9]/g, '');
                   setFormPhone(val);
                }}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary outline-none text-gray-900"
                placeholder="0812..."
             />
             <p className="text-xs text-gray-500 mt-1">*Notifikasi antrian akan dikirim via WA.</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Jenis Layanan</label>
            <div className="grid grid-cols-1 gap-3">
              {Object.values(ServiceType).map((type) => (
                <div 
                  key={type}
                  onClick={() => setFormService(type)}
                  className={`p-4 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                    formService === type 
                    ? 'border-primary bg-primary/5 shadow-md' 
                    : 'border-gray-200 bg-white hover:bg-gray-50'
                  }`}
                >
                  <span className={`font-medium ${formService === type ? 'text-primary' : 'text-gray-700'}`}>{type}</span>
                  {formService === type && <div className="w-4 h-4 rounded-full bg-primary" />}
                </div>
              ))}
            </div>
          </div>

          <div>
             <label className="block text-sm font-medium text-gray-700 mb-1">Keperluan / Keterangan (Opsional)</label>
             <div className="relative">
               <textarea 
                  value={formCaseNum} // We reuse this state to keep DB compatibility
                  onChange={(e) => setFormCaseNum(e.target.value)}
                  className="w-full p-4 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary outline-none text-gray-900"
                  placeholder="Jelaskan singkat maksud dan tujuan Anda..."
                  rows={3}
               />
               <FileText className="absolute right-3 top-3 text-gray-400" size={20} />
             </div>
             <p className="text-xs text-gray-500 mt-1">Isi detail ini agar petugas memahami kebutuhan layanan Anda.</p>
          </div>

          <button 
            onClick={handleRegister}
            disabled={isSubmitting}
            className="w-full bg-primary text-white font-bold py-4 rounded-xl shadow-lg hover:bg-primary/90 transition-colors flex items-center justify-center mt-8 disabled:opacity-70"
          >
            {isSubmitting ? (
               <>
                 <Loader2 className="animate-spin mr-2" /> Memproses...
               </>
            ) : (
              'Dapatkan Nomor Antrian'
            )}
          </button>
        </div>
      </div>
    );
  };

  const renderTicket = () => {
    if (!myTicket) {
      return (
        <div className="flex flex-col items-center justify-center h-screen px-6 pb-24 text-center">
          <div className="bg-gray-100 p-6 rounded-full mb-6">
            <TicketIcon size={48} className="text-gray-400" />
          </div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">Belum Ada Tiket</h2>
          <p className="text-gray-500 mb-8">Anda belum mendaftar antrian hari ini.</p>
          <button 
            onClick={() => setView(ViewState.REGISTER)}
            className="bg-primary text-white px-8 py-3 rounded-xl font-medium shadow-lg"
          >
            Ambil Antrian Sekarang
          </button>
        </div>
      );
    }

    return (
      <div className="p-6 pb-24 min-h-screen bg-gray-50">
        <div className="flex justify-between items-center mb-6">
           <h2 className="text-2xl font-bold text-gray-900">Tiket Saya</h2>
           <button 
             onClick={handleManualRefresh}
             className="bg-white p-2 rounded-full shadow-sm text-primary border border-gray-100 hover:bg-gray-50 transition-colors flex items-center"
           >
             <RefreshCw size={18} className={isRefreshing ? "animate-spin" : ""} />
             <span className="text-xs font-medium ml-2">{isRefreshing ? 'Updating...' : 'Refresh'}</span>
           </button>
        </div>
        
        <QueueCard 
          queueNumber={myTicket.queueNumber}
          serviceType={myTicket.serviceType}
          status={myTicket.status}
          estimatedWait={myTicket.estimatedTime}
          isLarge={true}
        />

        <div className="mt-8 bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
           <h3 className="font-bold text-gray-800 mb-4 border-b pb-2">Detail Antrian</h3>
           <div className="space-y-3 text-sm">
             <div className="flex justify-between">
               <span className="text-gray-500">Nama</span>
               <span className="font-medium text-right text-gray-900">{myTicket.name || '-'}</span>
             </div>
             <div className="flex flex-col space-y-1 py-2 border-t border-dashed border-gray-100">
               <span className="text-gray-500">Keperluan</span>
               <span className="font-medium text-gray-900 italic text-sm">{myTicket.caseNumber || '-'}</span>
             </div>
             <div className="flex justify-between border-t border-dashed border-gray-100 pt-2">
               <span className="text-gray-500">Waktu Daftar</span>
               <span className="font-medium text-right text-gray-900">{formatTime(myTicket.timestamp)}</span>
             </div>
           </div>
           
           <div className="flex flex-col items-center justify-center mt-6 mb-2">
             <div className="bg-white p-2 border border-gray-200 rounded-xl">
               <img 
                 src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${myTicket.id}`}
                 alt="QR Code Antrian"
                 className="w-32 h-32 object-contain"
               />
             </div>
             <p className="text-xs text-gray-400 mt-2">Kode: {myTicket.id.slice(-6)}</p>
           </div>

           <div className="mt-6 p-4 bg-blue-50 text-blue-800 rounded-xl text-xs leading-relaxed flex items-start">
              <Info size={16} className="mr-2 flex-shrink-0 mt-0.5" />
              <p>Mohon hadir di ruang tunggu 15 menit sebelum estimasi waktu panggilan. Tekan tombol Refresh di kanan atas jika Anda sudah menunggu lama.</p>
           </div>
        </div>

        {/* Action Buttons based on Status */}
        {(myTicket.status === TicketStatus.COMPLETED || myTicket.status === TicketStatus.CANCELLED) ? (
            <button 
              className="w-full mt-6 bg-primary text-white font-bold py-3 rounded-xl hover:bg-primary/90 transition-colors flex items-center justify-center"
              onClick={handleNewTicket}
            >
              <CheckCircle size={20} className="mr-2" /> Buat Antrian Baru
            </button>
        ) : (
            <button 
              className="w-full mt-6 border-2 border-red-500 text-red-500 font-bold py-3 rounded-xl hover:bg-red-50 transition-colors"
              onClick={handleCancelTicket}
            >
              Batalkan Antrian
            </button>
        )}
      </div>
    );
  };

  const renderChat = () => (
    <div className="flex flex-col h-screen bg-white pb-16">
      <div className="bg-white border-b p-4 flex justify-between items-center shadow-sm z-10 sticky top-0">
        <div className="flex items-center space-x-3">
          <div className="bg-primary/10 p-2 rounded-full">
             <MessageSquare size={20} className="text-primary" />
          </div>
          <div>
             <h2 className="font-bold text-gray-800">Asisten POSBAKUM</h2>
             <p className="text-xs text-green-600 flex items-center">
               <span className="w-2 h-2 bg-green-500 rounded-full mr-1"></span> Online
             </p>
          </div>
        </div>
        <button onClick={clearChat} className="text-gray-400 hover:text-red-500 p-2">
          <Trash2 size={18} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div 
              className={`max-w-[80%] p-4 rounded-2xl text-sm leading-relaxed shadow-sm ${
                msg.role === 'user' 
                ? 'bg-primary text-white rounded-br-none' 
                : 'bg-white text-gray-800 border border-gray-200 rounded-bl-none'
              }`}
            >
              {msg.text}
            </div>
          </div>
        ))}
        {isTyping && (
           <div className="flex justify-start">
             <div className="bg-white p-3 rounded-2xl rounded-bl-none border border-gray-200 shadow-sm flex space-x-1 items-center">
               <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
               <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-75"></div>
               <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-150"></div>
             </div>
           </div>
        )}
        <div ref={chatEndRef} />
      </div>

      <div className="p-4 bg-white border-t flex items-center space-x-3 safe-area-bottom">
        <input 
          type="text" 
          value={inputMsg}
          onChange={(e) => setInputMsg(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
          placeholder="Tanya syarat, prosedur..."
          className="flex-1 bg-gray-100 border-none rounded-full px-4 py-3 focus:ring-2 focus:ring-primary outline-none text-sm"
        />
        <button 
          onClick={handleSendMessage}
          disabled={!inputMsg.trim() || isTyping}
          className="bg-primary text-white p-3 rounded-full hover:bg-primary/90 disabled:opacity-50 transition-all"
        >
          <Send size={20} />
        </button>
      </div>
    </div>
  );

  const renderAbout = () => (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Header */}
      <div className="bg-primary text-white px-6 pt-8 pb-12 rounded-b-[40px] shadow-lg relative overflow-hidden">
        {/* Background Logo - REDUCED OPACITY to prevent text coverage issues */}
        <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
           <img 
              src={config.logoUrl} 
              onError={handleLogoError}
              referrerPolicy="no-referrer"
              alt="Background Logo" 
              className="w-40 h-40 object-contain grayscale brightness-200 mix-blend-multiply" 
           />
        </div>
        <div className="relative z-10 text-center">
           {/* Changed from bg-white to transparent glass effect to none for PNG */}
           <div className="w-32 h-32 flex items-center justify-center mx-auto mb-4">
             {/* Main About Logo */}
             <img 
                src={config.logoUrl} 
                onError={handleLogoError}
                referrerPolicy="no-referrer"
                alt="Logo LBH" 
                className="w-full h-full object-contain drop-shadow-lg" 
             />
           </div>
           <h1 className="text-base font-bold mb-2 uppercase">{config.lbhName}</h1>
           <div className="border-t border-white/30 pt-3 mx-10">
              <p className="text-white text-base font-bold tracking-widest uppercase leading-relaxed">
                {config.posbakumName}
              </p>
           </div>
        </div>
      </div>

      <div className="px-5 -mt-8 space-y-5 relative z-20">
         {/* Visi */}
         <section className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
            <h3 className="text-primary font-bold text-lg mb-3 flex items-center border-b border-gray-100 pb-2">
              <Target className="mr-2 text-secondary" size={20} /> Visi
            </h3>
            <p className="text-gray-700 leading-relaxed text-sm italic text-center text-balance">
              "Menjadi lembaga bantuan hukum yang terdepan dalam memberikan akses keadilan bagi masyarakat, mempromosikan hak asasi manusia, dan membangun masyarakat yang adil dan demokratis."
            </p>
         </section>

         {/* Misi */}
         <section className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
            <h3 className="text-primary font-bold text-lg mb-4 flex items-center border-b border-gray-100 pb-2">
               <BookOpen className="mr-2 text-secondary" size={20} /> Misi
            </h3>
            <ul className="space-y-4">
              {[
                { title: "Meningkatkan Akses Keadilan", text: "Menyediakan layanan bantuan hukum yang berkualitas, terjangkau, dan berkeadilan bagi masyarakat, terutama bagi mereka yang kurang mampu." },
                { title: "Mempromosikan Hak Asasi Manusia", text: "Meningkatkan kesadaran dan mempromosikan hak asasi manusia, serta memantau dan melaporkan pelanggaran hak asasi manusia." },
                { title: "Membangun Masyarakat yang Adil", text: "Berpartisipasi dalam pembangunan masyarakat yang adil, demokratis, dan berkeadilan, serta mempromosikan supremasi hukum." },
                { title: "Meningkatkan Kapasitas", text: "Meningkatkan kapasitas dan profesionalisme staf dan relawan LBH Nusantara Sepakat, serta mempromosikan budaya kerja yang berintegritas dan beretika." },
                { title: "Kerjasama dan Kolaborasi", text: "Berkolaborasi dengan lembaga lain, pemerintah, dan masyarakat sipil untuk meningkatkan akses keadilan dan mempromosikan hak asasi manusia." }
              ].map((item, idx) => (
                <li key={idx} className="flex flex-col text-sm text-gray-700">
                   <div className="flex items-center font-bold text-gray-900 mb-1">
                      <span className="w-1.5 h-1.5 bg-secondary rounded-full mr-2"></span>
                      {item.title}
                   </div>
                   <p className="text-gray-600 pl-3.5 leading-relaxed text-xs">{item.text}</p>
                </li>
              ))}
            </ul>
         </section>

         {/* Tujuan */}
         <section className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
            <h3 className="text-primary font-bold text-lg mb-3 flex items-center border-b border-gray-100 pb-2">
               <Target className="mr-2 text-secondary" size={20} /> Tujuan
            </h3>
            <ul className="space-y-3">
              {[
                "Meningkatkan jumlah masyarakat yang mendapatkan akses keadilan melalui layanan bantuan hukum LBH Nusantara Sepakat.",
                "Meningkatkan kesadaran dan pemahaman masyarakat tentang hak asasi manusia dan supremasi hukum.",
                "Meningkatkan kapasitas dan profesionalisme staf dan relawan LBH Nusantara Sepakat.",
                "Meningkatkan kerjasama dan kolaborasi dengan lembaga lain untuk meningkatkan akses keadilan dan mempromosikan hak asasi manusia."
              ].map((item, idx) => (
                 <li key={idx} className="flex items-start text-sm text-gray-700 bg-gray-50 p-3 rounded-lg">
                   <div className="min-w-[20px] h-5 bg-primary/10 text-primary rounded-full flex items-center justify-center text-xs font-bold mr-3 mt-0.5">{idx + 1}</div>
                   <span className="leading-snug">{item}</span>
                 </li>
              ))}
            </ul>
         </section>

          {/* Nilai-nilai */}
          <section className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
             <h3 className="text-primary font-bold text-lg mb-3 flex items-center border-b border-gray-100 pb-2">
               <Heart className="mr-2 text-secondary" size={20} /> Nilai-nilai
             </h3>
             <div className="grid grid-cols-1 gap-3">
               {[
                 { t: "Keadilan", d: "Menjunjung tinggi keadilan dan kesetaraan bagi semua orang.", c: "bg-blue-50 text-blue-700 border-blue-100" },
                 { t: "Integritas", d: "Menjaga integritas dan profesionalisme dalam setiap tindakan.", c: "bg-green-50 text-green-700 border-green-100" },
                 { t: "Empati", d: "Menunjukkan empati dan kepedulian terhadap masyarakat.", c: "bg-orange-50 text-orange-700 border-orange-100" },
                 { t: "Kolaborasi", d: "Berkolaborasi dengan lembaga lain untuk meningkatkan akses keadilan.", c: "bg-purple-50 text-purple-700 border-purple-100" },
                 { t: "Transparansi", d: "Menjaga transparansi dalam setiap tindakan dan keputusan.", c: "bg-cyan-50 text-cyan-700 border-cyan-100" }
               ].map((item, idx) => (
                 <div key={idx} className={`p-3 rounded-xl border ${item.c}`}>
                   <h4 className="font-bold text-sm mb-0.5">{item.t}</h4>
                   <p className="text-xs opacity-80 leading-snug">{item.d}</p>
                 </div>
               ))}
             </div>
          </section>

          {/* Kontak & Lokasi */}
          <section className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
             <h3 className="text-primary font-bold text-lg mb-3 flex items-center border-b border-gray-100 pb-2">
                <Phone className="mr-2 text-secondary" size={20} /> Kontak & Lokasi
             </h3>
             <div className="space-y-4">
               <div className="flex items-start">
                  <div className="bg-green-50 p-2 rounded-full text-green-600 mr-3 mt-1">
                     <MapPin size={18} />
                  </div>
                  <div>
                     <h4 className="font-bold text-gray-800 text-sm">Alamat Kantor</h4>
                     <p className="text-gray-600 text-sm leading-relaxed">Jl. Letnan Boyak No. 77 Bangkinang 28412 Kab. Kampar Propinsi Riau</p>
                  </div>
               </div>
               
               <div className="flex items-start">
                  <div className="bg-green-50 p-2 rounded-full text-green-600 mr-3 mt-1">
                     <Phone size={18} />
                  </div>
                  <div>
                     <h4 className="font-bold text-gray-800 text-sm">Telepon / WhatsApp</h4>
                     <p className="text-gray-600 text-sm font-medium">085353338792</p>
                  </div>
               </div>
             </div>
          </section>

          {/* Motto */}
          <section className="bg-gradient-to-br from-secondary to-orange-400 text-white p-6 rounded-2xl text-center shadow-lg relative overflow-hidden mb-6">
             <div className="absolute top-0 right-0 p-2 opacity-20">
                 <Target size={80} />
             </div>
             <div className="relative z-10">
               <h3 className="font-bold text-sm mb-2 opacity-90 uppercase tracking-widest">Motto</h3>
               <p className="text-xl font-serif italic text-white drop-shadow-md">"Menuju Keadilan, Membangun Bangsa"</p>
             </div>
          </section>
      </div>
    </div>
  );

  return (
    <div className={`min-h-screen bg-gray-50 font-sans shadow-2xl overflow-hidden relative ${currentView === ViewState.ADMIN_DASHBOARD ? 'w-full' : 'max-w-md mx-auto'}`}>
      
      {currentView === ViewState.HOME && renderHome()}
      {currentView === ViewState.REGISTER && renderRegister()}
      {currentView === ViewState.TICKET && renderTicket()}
      {currentView === ViewState.CHAT && renderChat()}
      {currentView === ViewState.ABOUT && renderAbout()}
      
      {currentView === ViewState.ADMIN_LOGIN && renderAdminLogin()}
      {currentView === ViewState.ADMIN_DASHBOARD && adminUser && (
        <AdminDashboard user={adminUser} onLogout={handleAdminLogout} />
      )}

      {/* Only show bottom nav for user views */}
      {[ViewState.HOME, ViewState.REGISTER, ViewState.TICKET, ViewState.CHAT, ViewState.ABOUT].includes(currentView) && (
        <Navigation 
          currentView={currentView} 
          setView={setView} 
          hasTicket={!!myTicket} 
        />
      )}
    </div>
  );
};

export default App;
