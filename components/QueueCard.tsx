import React from 'react';
import { TicketStatus } from '../types';
import { Clock, CheckCircle2, User } from 'lucide-react';

interface QueueCardProps {
  queueNumber: string;
  serviceType: string;
  status: TicketStatus;
  estimatedWait?: string;
  isLarge?: boolean;
}

const QueueCard: React.FC<QueueCardProps> = ({ 
  queueNumber, 
  serviceType, 
  status, 
  estimatedWait,
  isLarge = false
}) => {
  
  const getStatusColor = (s: TicketStatus) => {
    switch(s) {
      case TicketStatus.CALLED: return 'bg-green-100 text-green-800 border-green-200';
      case TicketStatus.WAITING: return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case TicketStatus.COMPLETED: return 'bg-gray-100 text-gray-800 border-gray-200';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (isLarge) {
    return (
      <div className="bg-white rounded-2xl shadow-xl p-6 border border-gray-100 flex flex-col items-center justify-center space-y-4 w-full">
        <div className={`px-4 py-1.5 rounded-full text-sm font-semibold border ${getStatusColor(status)}`}>
          {status}
        </div>
        <div className="text-center">
          <p className="text-gray-500 text-sm uppercase tracking-wider font-semibold">Nomor Antrian</p>
          <h1 className="text-6xl font-bold text-gray-900 tracking-tighter my-2">{queueNumber}</h1>
          <p className="text-primary font-medium">{serviceType}</p>
        </div>
        {status === TicketStatus.WAITING && (
          <div className="flex items-center space-x-2 text-gray-500 bg-gray-50 px-4 py-2 rounded-lg w-full justify-center">
            <Clock size={16} />
            <span className="text-sm">Estimasi: {estimatedWait || '15 menit'}</span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-100 flex justify-between items-center mb-3">
      <div className="flex items-center space-x-4">
        <div className="bg-primary/10 w-12 h-12 rounded-lg flex items-center justify-center text-primary font-bold text-lg">
          {queueNumber.split('-')[0]}
        </div>
        <div>
          <h3 className="font-bold text-gray-900">{queueNumber}</h3>
          <p className="text-xs text-gray-500">{serviceType}</p>
        </div>
      </div>
      <div className={`px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(status)}`}>
        {status}
      </div>
    </div>
  );
};

export default QueueCard;