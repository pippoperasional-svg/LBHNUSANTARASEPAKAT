import { Ticket, ChatMessage, TicketStatus, ServiceType, AdminUser, AppConfig, DailyStats } from '../types';
import { supabase } from './supabaseClient';

// Constants for LocalStorage Keys
const KEYS = {
  TICKET_ID: 'posbakum_active_ticket_id',
  SESSION_ID: 'posbakum_session_id',
  ADMIN_SESSION: 'posbakum_admin_session'
};

// Helper to get or create a persistent session ID for the device
const getSessionId = () => {
  let id = localStorage.getItem(KEYS.SESSION_ID);
  if (!id) {
    // Generate a simple unique ID
    id = Date.now().toString(36) + Math.random().toString(36).substr(2);
    localStorage.setItem(KEYS.SESSION_ID, id);
  }
  return id;
};

// Helper to get prefix based on service type
const getServicePrefix = (type: ServiceType): string => {
  switch (type) {
    case ServiceType.CONSULTATION: return 'A';
    case ServiceType.CRIMINAL: return 'B';
    case ServiceType.CIVIL: return 'C';
    default: return 'A';
  }
};

// Helper to convert Google Drive Sharing Link to Direct Image Link
const convertDriveLink = (url: string): string => {
  if (!url) return url;
  
  // Check if it's a Google Drive link
  if (url.includes('drive.google.com') || url.includes('docs.google.com')) {
    let id = '';
    
    // Pattern 1: /d/ID (common sharing link)
    const parts = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
    if (parts && parts[1]) {
      id = parts[1];
    } 
    
    // Pattern 2: id=ID (query param)
    if (!id) {
      try {
        const urlObj = new URL(url);
        id = urlObj.searchParams.get('id') || '';
      } catch (e) {
        // ignore invalid url
      }
    }

    if (id) {
      // Use thumbnail endpoint with large size (sz=w1000)
      // This is generally more robust for <img> tags than uc?export=view
      // and handles WebP format format better in browsers.
      return `https://drive.google.com/thumbnail?id=${id}&sz=w1000`;
    }
  }
  return url;
};

export const db = {
  // --- APP CONFIGURATION ---

  async getAppSettings(): Promise<AppConfig> {
    const defaults: AppConfig = {
      // Logo LBH (Default fallback)
      logoUrl: "https://upload.wikimedia.org/wikipedia/commons/e/e0/Logo_Pengadilan_Negeri_-_Mahkamah_Agung_RI.png",
      // Logo Pengadilan Negeri (Hardcoded Standard URL)
      courtLogoUrl: "https://drive.google.com/file/d/1IbJtyAL5lX7v28DE8yXp_iY-Qg4Sqza1/view?usp=sharing",
      lbhName: "LBH NUSANTARA SEPAKAT",
      courtName: "PENGADILAN NEGERI KELAS 1 B BANGKINANG",
      posbakumName: "POSBAKUM PADA PENGADILAN NEGERI KELAS 1 B BANGKINANG"
    };

    try {
      const { data, error } = await supabase
        .from('app_settings')
        .select('*')
        .single();

      if (error || !data) {
        return defaults;
      }

      return {
        // Apply the Google Drive link converter here
        logoUrl: convertDriveLink(data.logo_url) || defaults.logoUrl,
        courtLogoUrl: convertDriveLink(data.court_logo_url) || defaults.courtLogoUrl,
        lbhName: data.lbh_name || defaults.lbhName,
        courtName: data.court_name || defaults.courtName,
        posbakumName: data.posbakum_name || defaults.posbakumName
      };
    } catch (e) {
      console.error("Failed to load app settings", e);
      return defaults;
    }
  },

  // --- ADMIN AUTH OPERATIONS ---

  async loginAdmin(username: string, password: string): Promise<AdminUser | null> {
    try {
      // Query admin table in Supabase
      const { data, error } = await supabase
        .from('admins')
        .select('*')
        .eq('username', username)
        .eq('password', password) // Note: In a real production app, compare hashes, do not store plain text!
        .single();

      if (error || !data) {
        console.error("Login failed or user not found");
        return null;
      }

      return {
        username: data.username,
        name: data.name,
        role: data.role as ServiceType | 'ALL'
      };
    } catch (e) {
      console.error("Login error", e);
      return null;
    }
  },

  // Helper to persist admin session locally
  saveAdminSession(user: AdminUser) {
    localStorage.setItem(KEYS.ADMIN_SESSION, JSON.stringify(user));
  },

  // Helper to retrieve admin session
  getAdminSession(): AdminUser | null {
    const data = localStorage.getItem(KEYS.ADMIN_SESSION);
    if (!data) return null;
    try {
      return JSON.parse(data) as AdminUser;
    } catch (e) {
      return null;
    }
  },

  // Helper to clear admin session
  clearAdminSession() {
    localStorage.removeItem(KEYS.ADMIN_SESSION);
  },

  // --- TICKET OPERATIONS (SUPABASE) ---

  async generateQueueNumber(serviceType: ServiceType): Promise<string> {
    try {
      // Get start of today (00:00:00 local time)
      const now = new Date();
      now.setHours(0, 0, 0, 0);
      const startOfDay = now.getTime();

      // Query the last ticket created today for this specific service type
      // We assume 'timestamp' is stored as a bigint/number in the DB as per previous code
      const { data, error } = await supabase
        .from('tickets')
        .select('queue_number')
        .eq('service_type', serviceType)
        .gte('timestamp', startOfDay) 
        .order('timestamp', { ascending: false })
        .limit(1);

      let nextNumber = 1;

      if (data && data.length > 0) {
        const lastQueue = data[0].queue_number;
        // Format is "A-001", split by hyphen
        const parts = lastQueue.split('-');
        if (parts.length > 1) {
          const lastNum = parseInt(parts[1], 10);
          if (!isNaN(lastNum)) {
            nextNumber = lastNum + 1;
          }
        }
      }

      // Format: Prefix-001 (e.g., A-001, B-012)
      const prefix = getServicePrefix(serviceType);
      const formattedNumber = nextNumber.toString().padStart(3, '0');
      
      return `${prefix}-${formattedNumber}`;
    } catch (e) {
      console.error("Error generating queue number:", e);
      // Fallback in case of error, though this might cause duplicates in worst case
      const prefix = getServicePrefix(serviceType);
      const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
      return `${prefix}-${random}`;
    }
  },

  async createTicket(ticket: Ticket): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('tickets')
        .insert([{
          id: ticket.id,
          queue_number: ticket.queueNumber,
          name: ticket.name,
          case_number: ticket.caseNumber, // This now stores the description/keperluan
          service_type: ticket.serviceType,
          status: ticket.status,
          estimated_time: ticket.estimatedTime,
          timestamp: ticket.timestamp
        }]);

      if (error) {
        console.error("Supabase Create Error:", error);
        return false;
      }

      localStorage.setItem(KEYS.TICKET_ID, ticket.id);
      return true;
    } catch (error) {
      console.error("DB Error:", error);
      return false;
    }
  },

  async getActiveTicket(): Promise<Ticket | null> {
    const ticketId = localStorage.getItem(KEYS.TICKET_ID);
    if (!ticketId) return null;

    try {
      const { data, error } = await supabase
        .from('tickets')
        .select('*')
        .eq('id', ticketId)
        .single();

      if (error || !data) {
        if (error?.code === 'PGRST116') {
             localStorage.removeItem(KEYS.TICKET_ID);
        }
        return null;
      }

      // Helper to ensure timestamp is number
      const parseTimestamp = (ts: any) => {
          if (typeof ts === 'string') return parseInt(ts, 10);
          return ts;
      };

      return {
        id: data.id,
        queueNumber: data.queue_number,
        name: data.name || 'Tanpa Nama', // Fallback if name is missing
        caseNumber: data.case_number || '-',
        serviceType: data.service_type as ServiceType,
        status: data.status as TicketStatus,
        estimatedTime: data.estimated_time,
        timestamp: parseTimestamp(data.timestamp)
      };
    } catch (e) {
      console.error("Fetch active ticket error", e);
      return null;
    }
  },

  async cancelTicket(ticketId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('tickets')
        .update({ status: TicketStatus.CANCELLED })
        .eq('id', ticketId);

      if (!error) {
        localStorage.removeItem(KEYS.TICKET_ID);
        return true;
      }
      return false;
    } catch (e) {
      return false;
    }
  },

  // --- ADMIN OPERATIONS ---

  // Get tickets filtered by service type (for specific admin roles)
  async getAdminQueueData(role: ServiceType | 'ALL'): Promise<{ active: Ticket | null; waiting: Ticket[] }> {
    try {
      let activeQuery = supabase
        .from('tickets')
        .select('*')
        .eq('status', TicketStatus.CALLED)
        .order('timestamp', { ascending: false }) // Get most recently called
        .limit(1);

      let waitingQuery = supabase
        .from('tickets')
        .select('*')
        .eq('status', TicketStatus.WAITING)
        .order('timestamp', { ascending: true }); // FIFO

      // Apply Service Type Filter
      if (role !== 'ALL') {
        activeQuery = activeQuery.eq('service_type', role);
        waitingQuery = waitingQuery.eq('service_type', role);
      }

      const [activeRes, waitingRes] = await Promise.all([activeQuery, waitingQuery]);

      const parseTimestamp = (ts: any) => typeof ts === 'string' ? parseInt(ts, 10) : ts;

      let activeTicket: Ticket | null = null;
      if (activeRes.data && activeRes.data.length > 0) {
        const d = activeRes.data[0];
        activeTicket = {
          id: d.id,
          queueNumber: d.queue_number,
          name: d.name,
          caseNumber: d.case_number,
          serviceType: d.service_type,
          status: d.status,
          estimatedTime: d.estimated_time,
          timestamp: parseTimestamp(d.timestamp)
        };
      }

      const waitingTickets: Ticket[] = (waitingRes.data || []).map((d: any) => ({
        id: d.id,
        queueNumber: d.queue_number,
        name: d.name,
        caseNumber: d.case_number,
        serviceType: d.service_type,
        status: d.status,
        estimatedTime: d.estimated_time,
        timestamp: parseTimestamp(d.timestamp)
      }));

      return { active: activeTicket, waiting: waitingTickets };

    } catch (e) {
      console.error("Admin fetch error", e);
      return { active: null, waiting: [] };
    }
  },

  async updateTicketStatus(ticketId: string, newStatus: TicketStatus): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('tickets')
        .update({ status: newStatus })
        .eq('id', ticketId);
        
      if (error) throw error;
      return true;
    } catch (e) {
      console.error("Update status error", e);
      return false;
    }
  },

  async getDailyStats(): Promise<DailyStats> {
    const stats: DailyStats = {
      total: 0,
      completed: 0,
      cancelled: 0,
      byService: {
        [ServiceType.CONSULTATION]: 0,
        [ServiceType.CRIMINAL]: 0,
        [ServiceType.CIVIL]: 0
      }
    };

    try {
      // Get Start of Day
      const now = new Date();
      now.setHours(0, 0, 0, 0);
      const startOfDay = now.getTime();

      // Fetch all tickets created today
      const { data, error } = await supabase
        .from('tickets')
        .select('service_type, status')
        .gte('timestamp', startOfDay);

      if (error || !data) return stats;

      stats.total = data.length;

      data.forEach((row: any) => {
        // Count Status
        if (row.status === TicketStatus.COMPLETED) stats.completed++;
        if (row.status === TicketStatus.CANCELLED) stats.cancelled++;

        // Count Service Type
        const type = row.service_type as ServiceType;
        if (stats.byService[type] !== undefined) {
          stats.byService[type]++;
        }
      });

      return stats;
    } catch (e) {
      console.error("Stats error", e);
      return stats;
    }
  },

  // --- CHAT OPERATIONS (SUPABASE) ---

  async getChatHistory(): Promise<ChatMessage[]> {
    const sessionId = getSessionId();
    try {
      const { data, error } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('session_id', sessionId)
        .order('timestamp', { ascending: true });

      if (error) {
        console.error("Fetch chat error", error);
      }

      if (!data || data.length === 0) {
        return [{ 
          id: 'init', 
          role: 'model', 
          text: 'Halo! Saya asisten virtual POSBAKUM. Ada yang bisa saya bantu mengenai syarat atau prosedur layanan?', 
          timestamp: Date.now() 
        }];
      }

      return data.map((msg: any) => ({
        id: msg.id,
        role: msg.role,
        text: msg.text,
        timestamp: msg.timestamp
      }));

    } catch (e) {
      console.error("Failed to load chat", e);
      return [];
    }
  },

  async saveMessage(message: ChatMessage): Promise<void> {
    const sessionId = getSessionId();
    try {
      await supabase.from('chat_messages').insert({
        id: message.id,
        session_id: sessionId,
        role: message.role,
        text: message.text,
        timestamp: message.timestamp
      });
    } catch (error) {
      console.error("DB Save Message Error:", error);
    }
  },

  async clearChatHistory(): Promise<void> {
    const sessionId = getSessionId();
    await supabase
      .from('chat_messages')
      .delete()
      .eq('session_id', sessionId);
  },

  // --- PUBLIC KIOSK QUEUE UPDATES ---
  
  async getQueueStatus(): Promise<{ currentNumber: string; pending: Ticket[] }> {
    try {
      // For the public board, we just show the most recent CALLED ticket regardless of service (or we could show multiple)
      const { data: currentData } = await supabase
        .from('tickets')
        .select('queue_number')
        .eq('status', TicketStatus.CALLED)
        .order('timestamp', { ascending: false }) // most recently called
        .limit(1)
        .single();

      const { data: pendingData } = await supabase
        .from('tickets')
        .select('*')
        .eq('status', TicketStatus.WAITING)
        .order('timestamp', { ascending: true })
        .limit(10);

      const parseTimestamp = (ts: any) => typeof ts === 'string' ? parseInt(ts, 10) : ts;

      const pendingTickets = (pendingData || []).map((data: any) => ({
        id: data.id,
        queueNumber: data.queue_number,
        name: data.name || 'Tanpa Nama',
        caseNumber: data.case_number || '-',
        serviceType: data.service_type as ServiceType,
        status: data.status as TicketStatus,
        estimatedTime: data.estimated_time,
        timestamp: parseTimestamp(data.timestamp)
      }));

      return {
        currentNumber: currentData?.queue_number || '-',
        pending: pendingTickets
      };

    } catch (e) {
      return { currentNumber: '-', pending: [] };
    }
  }
};
