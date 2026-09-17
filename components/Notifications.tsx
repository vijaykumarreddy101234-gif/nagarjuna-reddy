
import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import type { ToastMessage } from '../types';

// Toast Component
const Toast = ({ message, onDismiss }: { message: ToastMessage; onDismiss: (id: number) => void }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onDismiss(message.id);
    }, 5000);
    return () => clearTimeout(timer);
  }, [message, onDismiss]);

  const baseClasses = 'p-5 rounded-2xl shadow-2xl text-sm font-bold flex items-center justify-between border-2 backdrop-blur-xl';
  const typeClasses = {
    success: 'bg-emerald-50/90 dark:bg-emerald-950/90 text-emerald-800 dark:text-emerald-200 border-emerald-200 dark:border-emerald-800 shadow-emerald-500/10',
    error: 'bg-red-50/90 dark:bg-red-950/90 text-red-800 dark:text-red-200 border-red-200 dark:border-red-800 shadow-red-500/10',
    info: 'bg-primary-50/90 dark:bg-primary-950/90 text-primary-800 dark:text-primary-200 border-primary-200 dark:border-primary-800 shadow-primary-500/10',
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: -20, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
      layout
      className={`${baseClasses} ${typeClasses[message.type]}`}
    >
      <div className="flex items-center gap-3">
        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${message.type === 'success' ? 'bg-emerald-500 text-white' : message.type === 'error' ? 'bg-red-500 text-white' : 'bg-primary-500 text-white shadow-lg'}`}>
            {message.type === 'success' && <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg>}
            {message.type === 'error' && <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12" /></svg>}
            {message.type === 'info' && <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
        </div>
        <span className="flex-1 leading-tight tracking-tight uppercase text-[11px]">{message.message}</span>
      </div>
      <button onClick={() => onDismiss(message.id)} className="ml-4 -mr-1 p-1.5 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </motion.div>
  );
};

// Toast Container
export const ToastContainer = ({ toasts, dismissToast }: { toasts: ToastMessage[]; dismissToast: (id: number) => void }) => {
  return (
    <div className="fixed bottom-10 right-10 z-[100] w-full max-w-sm space-y-4 pointer-events-none">
      <div className="pointer-events-auto">
        <AnimatePresence mode="popLayout">
          {toasts.map(toast => (
            <Toast key={toast.id} message={toast} onDismiss={dismissToast} />
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
};


// Confirm Modal
interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmModal = ({ isOpen, title, message, onConfirm, onCancel }) => {
    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[200] flex justify-center items-center p-6">
                    <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 bg-slate-950/60 backdrop-blur-md" 
                        onClick={onCancel} 
                    />
                    <motion.div 
                        initial={{ opacity: 0, scale: 0.9, y: 40 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: 40 }}
                        transition={{ type: "spring", damping: 25, stiffness: 300 }}
                        className="bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-2xl p-10 w-full max-w-lg relative z-10 border border-slate-200 dark:border-slate-800" 
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="flex flex-col items-center text-center">
                            <div className="w-16 h-16 bg-red-50 dark:bg-red-500/10 text-red-600 rounded-3xl flex items-center justify-center mb-6">
                                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                            </div>
                            <h2 className="text-3xl font-display font-black mb-3 text-slate-900 dark:text-white uppercase tracking-tighter italic">{title}</h2>
                            <p className="text-slate-500 dark:text-slate-400 mb-10 font-medium leading-relaxed">{message}</p>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4">
                            <button onClick={onCancel} className="px-6 py-4 text-xs font-black uppercase tracking-widest text-slate-500 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-slate-800 rounded-2xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-all active:scale-95">
                                Abort
                            </button>
                            <button onClick={onConfirm} className="px-6 py-4 text-xs font-black uppercase tracking-widest text-white bg-red-600 rounded-2xl hover:bg-red-700 shadow-xl shadow-red-600/20 transition-all active:scale-95">
                                Execute
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
