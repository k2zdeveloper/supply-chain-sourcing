import { memo } from 'react';
import { CheckCircle2, AlertCircle, X } from 'lucide-react';

// 1. Export the type here so your BomManager.tsx can import it without TS errors
export type AppNotification = {
  title: string;
  message: string;
  type: 'error' | 'success';
};

interface GlobalNotificationProps {
  notification: AppNotification | null;
  onClose: () => void;
}

export const GlobalNotification = memo(({ notification, onClose }: GlobalNotificationProps) => {
  if (!notification) return null;

  const isSuccess = notification.type === 'success';

  // 2. Premium Color Palettes for High Contrast and softer aesthetics
  const theme = isSuccess ? {
    border: 'border-emerald-500',
    icon: <CheckCircle2 className="w-5 h-5 text-emerald-500" aria-hidden="true" />,
    titleText: 'text-emerald-900',
    messageText: 'text-emerald-700',
    buttonHover: 'hover:bg-emerald-50 text-emerald-500',
    focusRing: 'focus:ring-emerald-500'
  } : {
    border: 'border-red-500',
    icon: <AlertCircle className="w-5 h-5 text-red-500" aria-hidden="true" />,
    titleText: 'text-red-900',
    messageText: 'text-red-700',
    buttonHover: 'hover:bg-red-50 text-red-500',
    focusRing: 'focus:ring-red-500'
  };

  return (
    <div 
      className="fixed bottom-6 right-6 z-[100] w-full max-w-sm animate-in slide-in-from-bottom-4 fade-in duration-300 print:hidden" 
      role="alert" 
      aria-live="assertive"
    >
      <div className={`relative overflow-hidden bg-white border-l-4 ${theme.border} rounded-2xl shadow-2xl flex items-start p-4 w-full ring-1 ring-slate-900/5`}>
        
        {/* Icon */}
        <div className="shrink-0 mr-3 mt-0.5">
          {theme.icon}
        </div>

        {/* Content - strictly constrained to prevent text overflow */}
        <div className="flex-1 min-w-0">
          <h3 className={`text-sm font-bold tracking-tight ${theme.titleText}`}>
            {notification.title}
          </h3>
          <p className={`mt-1 text-sm leading-relaxed break-words ${theme.messageText}`}>
            {notification.message}
          </p>
        </div>

        {/* Action / Close */}
        <div className="shrink-0 ml-4">
          <button
            onClick={onClose}
            className={`inline-flex rounded-lg p-1.5 focus:outline-none focus:ring-2 focus:ring-offset-1 transition-colors ${theme.buttonHover} ${theme.focusRing}`}
          >
            <span className="sr-only">Close notification</span>
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );
});

GlobalNotification.displayName = 'GlobalNotification';