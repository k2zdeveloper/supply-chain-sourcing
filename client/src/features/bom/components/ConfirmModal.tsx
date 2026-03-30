import type { ConfirmModalConfig } from '../types';

type ConfirmModalProps = {
  config: ConfirmModalConfig;
  onClose: () => void;
};

export const ConfirmModal = ({ config, onClose }: ConfirmModalProps) => {
  if (!config.isOpen) return null;
  
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95">
        <div className="p-6">
          <h3 className="text-xl font-bold text-slate-900 mb-2">{config.title}</h3>
          <p className="text-sm text-slate-500 mb-6 leading-relaxed">{config.message}</p>
          <div className="flex justify-end gap-3">
            <button onClick={onClose} className="px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors focus:outline-none">
              Cancel
            </button>
            <button 
              onClick={() => { config.onConfirm(); onClose(); }} 
              className={`px-4 py-2 text-sm font-bold text-white rounded-lg transition-colors shadow-sm focus:outline-none ${config.variant === 'danger' ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'}`}
            >
              {config.confirmText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};