export enum ServiceType {
  CONSULTATION = 'Konsultasi Hukum',
  CRIMINAL = 'Pidana',
  CIVIL = 'Perdata'
}

export enum TicketStatus {
  WAITING = 'Menunggu',
  CALLED = 'Dipanggil',
  COMPLETED = 'Selesai',
  CANCELLED = 'Dibatalkan'
}

export interface Ticket {
  id: string;
  queueNumber: string; // e.g., A-001
  name: string;
  caseNumber?: string; // Optional
  serviceType: ServiceType;
  status: TicketStatus;
  estimatedTime: string;
  timestamp: number;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: number;
}

export enum ViewState {
  HOME = 'HOME',
  REGISTER = 'REGISTER',
  TICKET = 'TICKET',
  CHAT = 'CHAT',
  ABOUT = 'ABOUT',
  ADMIN_LOGIN = 'ADMIN_LOGIN',
  ADMIN_DASHBOARD = 'ADMIN_DASHBOARD'
}

export interface AdminUser {
  username: string;
  name: string;
  role: ServiceType | 'ALL';
}

export interface AppConfig {
  logoUrl: string;
  lbhName: string;
  courtName: string;
  posbakumName: string;
}

export interface DailyStats {
  total: number;
  completed: number;
  cancelled: number;
  byService: {
    [key in ServiceType]: number;
  };
}