import React, { useState, useEffect } from 'react';
import { AlertTriangle, Check, X, RefreshCw, Copy, CheckCircle2, ChevronDown } from 'lucide-react';
import type { Profile } from '../types';

export type DuplicateAction = 'REPLACE' | 'SKIP' | 'ADD_AS_NEW';

export interface DuplicateConflictItem {
    id: string; // internal tracking key
    sku: string;
    brand: string;
    name: string;
    existing: Partial<Profile>;
    incoming: Partial<Profile>;
    action: DuplicateAction;
    customSku?: string;
}

interface DuplicateResolutionModalProps {
    isOpen: boolean;
    onClose: () => void;
    title?: string;
    description?: string;
    conflicts: DuplicateConflictItem[];
    nonConflictsCount: number;
    onResolve: (resolutions: DuplicateConflictItem[]) => void;
}

export const DuplicateResolutionModal = ({
    isOpen,
    onClose,
    title = 'Duplicate Profiles Detected',
    description,
    conflicts: initialConflicts,
    nonConflictsCount,
    onResolve
}: DuplicateResolutionModalProps) => {
    const [conflicts, setConflicts] = useState<DuplicateConflictItem[]>(initialConflicts);

    useEffect(() => {
        setConflicts(initialConflicts.map(c => ({
            ...c,
            action: c.action || 'REPLACE',
            customSku: c.customSku || `${c.sku}-V2`
        })));
    }, [initialConflicts]);

    if (!isOpen || conflicts.length === 0) return null;

    const setAllActions = (action: DuplicateAction) => {
        setConflicts(prev => prev.map(c => ({
            ...c,
            action,
            customSku: action === 'ADD_AS_NEW' ? (c.customSku || `${c.sku}-V2`) : c.customSku
        })));
    };

    const setItemAction = (id: string, action: DuplicateAction) => {
        setConflicts(prev => prev.map(c => c.id === id ? { ...c, action } : c));
    };

    const setItemCustomSku = (id: string, customSku: string) => {
        setConflicts(prev => prev.map(c => c.id === id ? { ...c, customSku } : c));
    };

    const handleConfirm = () => {
        onResolve(conflicts);
        onClose();
    };

    const replaceCount = conflicts.filter(c => c.action === 'REPLACE').length;
    const skipCount = conflicts.filter(c => c.action === 'SKIP').length;
    const addAsNewCount = conflicts.filter(c => c.action === 'ADD_AS_NEW').length;

    return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xs z-50 flex justify-center items-center p-4 overflow-y-auto" onClick={onClose}>
            <div 
                className="bg-white dark:bg-gray-800 rounded-3xl w-full max-w-4xl shadow-2xl border border-gray-100 dark:border-gray-700 overflow-hidden my-8 max-h-[90vh] flex flex-col animate-in fade-in zoom-in-95 duration-200"
                onClick={e => e.stopPropagation()}
            >
                {/* Header Banner */}
                <div className="p-6 bg-gradient-to-r from-amber-500 to-orange-600 text-white flex justify-between items-start">
                    <div className="flex items-start gap-4">
                        <div className="p-3 bg-white/20 rounded-2xl backdrop-blur-sm shadow-inner">
                            <AlertTriangle className="w-7 h-7 text-white animate-pulse" />
                        </div>
                        <div>
                            <span className="inline-block px-2.5 py-0.5 rounded-full bg-white/20 text-[10px] font-black uppercase tracking-widest mb-1.5 backdrop-blur-sm">
                                Duplicate Conflict Resolution
                            </span>
                            <h2 className="text-xl font-black tracking-tight">{title}</h2>
                            <p className="text-xs text-amber-100 mt-1 max-w-2xl font-medium">
                                {description || `We found ${conflicts.length} profile(s) with matching SKU / Brand already registered in your database. ${nonConflictsCount > 0 ? `(${nonConflictsCount} brand-new items will be automatically added.)` : ''} Please select whether you want to replace existing data, skip duplicates, or keep both.`}
                            </p>
                        </div>
                    </div>
                    <button 
                        onClick={onClose}
                        className="p-2 hover:bg-white/20 rounded-xl transition-all text-white/80 hover:text-white"
                        title="Close"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Quick Bulk Action Bar */}
                <div className="p-4 bg-gray-50 dark:bg-gray-900/60 border-b border-gray-100 dark:border-gray-700 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black uppercase tracking-wider text-gray-500 dark:text-gray-400">
                            Apply To All {conflicts.length} Duplicates:
                        </span>
                        <div className="inline-flex rounded-xl bg-gray-200 dark:bg-gray-700 p-0.5">
                            <button
                                type="button"
                                onClick={() => setAllActions('REPLACE')}
                                className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-tight transition-all flex items-center gap-1.5 ${
                                    replaceCount === conflicts.length 
                                        ? 'bg-blue-600 text-white shadow-sm' 
                                        : 'text-gray-700 dark:text-gray-300 hover:text-gray-900'
                                }`}
                            >
                                <RefreshCw className="w-3.5 h-3.5" /> Replace All ({conflicts.length})
                            </button>
                            <button
                                type="button"
                                onClick={() => setAllActions('SKIP')}
                                className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-tight transition-all flex items-center gap-1.5 ${
                                    skipCount === conflicts.length 
                                        ? 'bg-gray-800 text-white shadow-sm dark:bg-gray-600' 
                                        : 'text-gray-700 dark:text-gray-300 hover:text-gray-900'
                                }`}
                            >
                                <X className="w-3.5 h-3.5" /> Skip All ({conflicts.length})
                            </button>
                            <button
                                type="button"
                                onClick={() => setAllActions('ADD_AS_NEW')}
                                className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-tight transition-all flex items-center gap-1.5 ${
                                    addAsNewCount === conflicts.length 
                                        ? 'bg-emerald-600 text-white shadow-sm' 
                                        : 'text-gray-700 dark:text-gray-300 hover:text-gray-900'
                                }`}
                            >
                                <Copy className="w-3.5 h-3.5" /> Keep Both / Add All as New
                            </button>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 text-xs font-bold text-gray-500">
                        <span className="px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300">
                            {replaceCount} Replace
                        </span>
                        <span className="px-2 py-0.5 rounded bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
                            {skipCount} Skip
                        </span>
                        <span className="px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300">
                            {addAsNewCount} New
                        </span>
                    </div>
                </div>

                {/* Conflict List Table */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                    {conflicts.map((item, index) => {
                        const existingSpecs = [
                            item.existing.length ? `${item.existing.length}m` : null,
                            item.existing.weight ? `${item.existing.weight} kg/m` : null,
                            item.existing.piecesPerPacket ? `${item.existing.piecesPerPacket} pcs/pkt` : null,
                            item.existing.price ? `₹${item.existing.price}` : null
                        ].filter(Boolean).join(' • ');

                        const incomingSpecs = [
                            item.incoming.length ? `${item.incoming.length}m` : null,
                            item.incoming.weight ? `${item.incoming.weight} kg/m` : null,
                            item.incoming.piecesPerPacket ? `${item.incoming.piecesPerPacket} pcs/pkt` : null,
                            item.incoming.price ? `₹${item.incoming.price}` : null
                        ].filter(Boolean).join(' • ');

                        return (
                            <div 
                                key={item.id || index}
                                className={`p-4 rounded-2xl border transition-all ${
                                    item.action === 'REPLACE' 
                                        ? 'bg-blue-50/50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900/50' 
                                        : item.action === 'SKIP' 
                                            ? 'bg-gray-50 dark:bg-gray-900/30 border-gray-200 dark:border-gray-800 opacity-75' 
                                            : 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/50'
                                }`}
                            >
                                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                    {/* Left: Item Information */}
                                    <div className="space-y-1 max-w-lg">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className="font-mono font-black text-sm text-gray-900 dark:text-white px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-700">
                                                {item.sku}
                                            </span>
                                            <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300">
                                                {item.brand || 'General'}
                                            </span>
                                            <span className="text-xs font-bold text-gray-700 dark:text-gray-300">
                                                {item.name}
                                            </span>
                                        </div>

                                        {/* Comparison details */}
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] pt-1">
                                            <div className="bg-white/80 dark:bg-gray-800/80 p-2 rounded-xl border border-gray-100 dark:border-gray-700">
                                                <span className="text-[9px] font-black uppercase tracking-wider text-gray-400 block mb-0.5">
                                                    Current in DB:
                                                </span>
                                                <div className="font-semibold text-gray-600 dark:text-gray-300 truncate">
                                                    {item.existing.name || item.name}
                                                </div>
                                                <div className="text-[10px] text-gray-500 font-mono mt-0.5">
                                                    {existingSpecs || 'No specs set'}
                                                </div>
                                            </div>

                                            <div className="bg-white/80 dark:bg-gray-800/80 p-2 rounded-xl border border-gray-100 dark:border-gray-700">
                                                <span className="text-[9px] font-black uppercase tracking-wider text-blue-500 block mb-0.5">
                                                    Incoming Data:
                                                </span>
                                                <div className="font-semibold text-blue-600 dark:text-blue-400 truncate">
                                                    {item.incoming.name || item.name}
                                                </div>
                                                <div className="text-[10px] text-blue-500 font-mono mt-0.5">
                                                    {incomingSpecs || 'Incoming specs'}
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Right: Decision Controls */}
                                    <div className="flex flex-col sm:items-end gap-2 shrink-0">
                                        <div className="flex items-center gap-1.5 p-1 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-xs">
                                            <button
                                                type="button"
                                                onClick={() => setItemAction(item.id, 'REPLACE')}
                                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${
                                                    item.action === 'REPLACE'
                                                        ? 'bg-blue-600 text-white shadow-xs'
                                                        : 'text-gray-600 dark:text-gray-400 hover:text-gray-900'
                                                }`}
                                            >
                                                <RefreshCw className="w-3 h-3" /> Replace
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setItemAction(item.id, 'SKIP')}
                                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${
                                                    item.action === 'SKIP'
                                                        ? 'bg-gray-700 text-white shadow-xs dark:bg-gray-600'
                                                        : 'text-gray-600 dark:text-gray-400 hover:text-gray-900'
                                                }`}
                                            >
                                                <X className="w-3 h-3" /> Skip
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setItemAction(item.id, 'ADD_AS_NEW')}
                                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${
                                                    item.action === 'ADD_AS_NEW'
                                                        ? 'bg-emerald-600 text-white shadow-xs'
                                                        : 'text-gray-600 dark:text-gray-400 hover:text-gray-900'
                                                }`}
                                            >
                                                <Copy className="w-3 h-3" /> Keep Both
                                            </button>
                                        </div>

                                        {item.action === 'ADD_AS_NEW' && (
                                            <div className="flex items-center gap-1.5 text-xs">
                                                <span className="text-[10px] text-gray-400 font-bold uppercase">New SKU:</span>
                                                <input
                                                    type="text"
                                                    value={item.customSku || ''}
                                                    onChange={e => setItemCustomSku(item.id, e.target.value)}
                                                    className="px-2 py-1 bg-white dark:bg-gray-800 border border-emerald-300 dark:border-emerald-700 rounded-lg text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400 outline-none w-36"
                                                    placeholder="e.g. SKU-V2"
                                                />
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Footer Controls */}
                <div className="p-4 bg-gray-50 dark:bg-gray-900 border-t border-gray-100 dark:border-gray-700 flex items-center justify-between gap-4">
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                        {nonConflictsCount > 0 && (
                            <span className="font-bold text-emerald-600 dark:text-emerald-400 mr-2">
                                ✓ +{nonConflictsCount} brand-new item(s) will be added automatically
                            </span>
                        )}
                        <span>Total actions: {replaceCount} replace, {skipCount} skip, {addAsNewCount} new</span>
                    </div>

                    <div className="flex items-center gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-xs font-bold text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-800 rounded-xl transition-all"
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            onClick={handleConfirm}
                            className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-black uppercase tracking-wider rounded-xl shadow-md shadow-blue-500/25 transition-all flex items-center gap-2 cursor-pointer active:scale-95"
                        >
                            <CheckCircle2 className="w-4 h-4" /> Apply & Sync Data
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
