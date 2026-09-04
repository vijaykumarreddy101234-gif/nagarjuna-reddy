import React, { useState, useEffect, useMemo } from 'react';
import type { Profile, ToastMessage } from '../types';
import { AlertTriangle, RefreshCw, Copy, Check, X, ShieldAlert } from 'lucide-react';

interface AddProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (profile: Omit<Profile, 'id' | 'createdAt'>) => void;
  onUpdate?: (profile: Profile) => void;
  brands: string[];
  addToast: (message: string, type: ToastMessage['type']) => void;
  initialData?: Profile | null;
  initialProfileType?: 'WINDOW' | 'REINFORCEMENT';
  existingProfiles?: Profile[];
}

const AddProfileModal: React.FC<AddProfileModalProps> = ({ 
    isOpen, 
    onClose, 
    onAdd, 
    onUpdate,
    brands, 
    addToast, 
    initialData, 
    initialProfileType,
    existingProfiles = []
}) => {
    const getInitialState = () => ({ 
        sku: initialData?.sku || '', 
        name: initialData?.name || '', 
        brand: initialData?.brand || brands[0] || '', 
        profileType: initialData?.profileType || initialProfileType || 'WINDOW',
        uom: initialData?.uom || 'Pcs', 
        length: initialData?.length?.toString() || '', 
        piecesPerPacket: initialData?.piecesPerPacket?.toString() || '', 
        weight: initialData?.weight?.toString() || '', 
        price: initialData?.price?.toString() || '', 
        reorderPoint: initialData?.reorderPoint?.toString() || '',
        size: initialData?.size || '',
        color: initialData?.color || '',
        hsnCode: initialData?.hsnCode || ''
    });

    const [form, setForm] = useState(getInitialState());
    const [selectedBrands, setSelectedBrands] = useState<string[]>([]);
    const [duplicatePrompt, setDuplicatePrompt] = useState<{
        isOpen: boolean;
        conflictingProfiles: Profile[];
        pendingData: any;
    } | null>(null);

    useEffect(() => {
        if (isOpen) {
            setForm(getInitialState());
            setSelectedBrands(initialData?.brand ? [initialData.brand] : (brands.length > 0 ? [brands[0]] : []));
            setDuplicatePrompt(null);
        }
    }, [isOpen, brands, initialData, initialProfileType]);

    useEffect(() => {
        const handleEsc = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
        if (isOpen) window.addEventListener('keydown', handleEsc);
        return () => window.removeEventListener('keydown', handleEsc);
    }, [isOpen, onClose]);

    // Check for live duplicate matches as user types
    const matchingDuplicates = useMemo(() => {
        const trimmedSku = form.sku.trim().toLowerCase();
        if (!trimmedSku) return [];

        const targetBrands = (initialData && initialData.id) 
            ? [form.brand] 
            : (selectedBrands.length > 0 ? selectedBrands : [form.brand]);

        return existingProfiles.filter(p => 
            !p.deletedAt &&
            (!initialData || p.id !== initialData.id) &&
            p.sku.toLowerCase() === trimmedSku &&
            targetBrands.some(b => (b || 'General').toLowerCase() === (p.brand || 'General').toLowerCase())
        );
    }, [form.sku, form.brand, selectedBrands, existingProfiles, initialData]);

    if (!isOpen) return null;

    const executeSave = (strategy: 'REPLACE' | 'ADD_AS_NEW' | 'SKIP_DUPLICATES' | 'NORMAL', customSkuPrefix?: string) => {
        const baseProfile = {
            ...form, 
            category: 'Profile' as const,
            profileType: form.profileType as 'WINDOW' | 'REINFORCEMENT',
            length: parseFloat(form.length) || undefined, 
            piecesPerPacket: parseFloat(form.piecesPerPacket) || undefined,
            weight: parseFloat(form.weight) || undefined, 
            price: parseFloat(form.price) || undefined, 
            reorderPoint: parseFloat(form.reorderPoint) || undefined,
            size: form.size || undefined,
            color: form.color || undefined
        };

        const brandsToApply = (initialData && initialData.id) ? [form.brand] : (selectedBrands.length > 0 ? selectedBrands : [form.brand]);

        let addedCount = 0;
        let replacedCount = 0;

        brandsToApply.forEach(b => {
            const existing = existingProfiles.find(p => 
                !p.deletedAt &&
                (!initialData || p.id !== initialData.id) &&
                p.sku.toLowerCase() === form.sku.trim().toLowerCase() &&
                (p.brand || 'General').toLowerCase() === (b || 'General').toLowerCase()
            );

            if (existing) {
                if (strategy === 'REPLACE') {
                    if (onUpdate) {
                        onUpdate({
                            ...existing,
                            name: baseProfile.name,
                            category: baseProfile.category,
                            profileType: baseProfile.profileType,
                            length: baseProfile.length,
                            weight: baseProfile.weight,
                            piecesPerPacket: baseProfile.piecesPerPacket,
                            price: baseProfile.price,
                            reorderPoint: baseProfile.reorderPoint,
                            size: baseProfile.size,
                            color: baseProfile.color,
                            hsnCode: baseProfile.hsnCode,
                            brand: b
                        });
                    } else {
                        onAdd({ ...baseProfile, brand: b });
                    }
                    replacedCount++;
                } else if (strategy === 'ADD_AS_NEW') {
                    const newSku = `${baseProfile.sku}-V2`;
                    onAdd({ ...baseProfile, sku: newSku, brand: b });
                    addedCount++;
                }
                // if SKIP_DUPLICATES, do nothing for this brand
            } else {
                onAdd({ ...baseProfile, brand: b });
                addedCount++;
            }
        });

        if (replacedCount > 0 && addedCount > 0) {
            addToast(`Replaced ${replacedCount} existing profile(s) and added ${addedCount} new!`, 'success');
        } else if (replacedCount > 0) {
            addToast(`Replaced and updated ${replacedCount} existing profile(s)!`, 'success');
        } else if (addedCount > 0) {
            addToast(`Successfully saved profile across ${addedCount} brand(s)!`, 'success');
        } else {
            addToast(`No changes made (duplicate skipped).`, 'info');
        }

        setDuplicatePrompt(null);
        onClose();
    };

    const handleSubmit = (e: React.FormEvent) => { 
        e.preventDefault(); 
        
        if (!form.sku.trim() || !form.name.trim()) {
            addToast('SKU and Name are required.', 'error');
            return;
        }

        const brandsToApply = (initialData && initialData.id) ? [form.brand] : (selectedBrands.length > 0 ? selectedBrands : [form.brand]);
        if (brandsToApply.length === 0 || !brandsToApply[0]) {
            addToast('Please select at least one brand.', 'error');
            return;
        }

        // If editing the existing profile itself, just save
        if (initialData && initialData.id) {
            executeSave('REPLACE');
            return;
        }

        // Check if duplicate exists
        if (matchingDuplicates.length > 0) {
            setDuplicatePrompt({
                isOpen: true,
                conflictingProfiles: matchingDuplicates,
                pendingData: form
            });
            return;
        }

        // Standard save if no duplicates
        executeSave('NORMAL');
    };

    const toggleBrand = (b: string) => {
        if (selectedBrands.includes(b)) {
            setSelectedBrands(selectedBrands.filter(item => item !== b));
        } else {
            setSelectedBrands([...selectedBrands, b]);
        }
    };

    const selectAllBrands = () => {
        setSelectedBrands([...brands]);
    };

    const clearAllBrands = () => {
        setSelectedBrands([]);
    };

    const inputClass = "w-full border p-2.5 rounded-xl dark:bg-gray-700 dark:text-white dark:border-gray-600 text-xs outline-none focus:ring-2 focus:ring-blue-500 transition-all";

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex justify-center items-center p-4 overflow-y-auto" onClick={onClose}>
            <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl w-full max-w-lg shadow-2xl border border-gray-100 dark:border-gray-700 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                
                {/* Header */}
                <div className="flex justify-between items-center mb-4">
                    <div>
                        <h3 className="text-base font-black text-gray-900 dark:text-white">
                            {(initialData && initialData.id) ? 'Edit Profile' : 'Add New Profile (Multi-Brand Support)'}
                        </h3>
                        <p className="text-[11px] text-gray-400 font-bold uppercase tracking-wider">
                            Brand-wise Technical Specifications
                        </p>
                    </div>

                    <div className="flex gap-1.5 p-0.5 bg-gray-100 dark:bg-gray-700 rounded-xl">
                        <button 
                            type="button"
                            onClick={() => setForm({...form, profileType: 'WINDOW'})}
                            className={`px-3 py-1 text-[10px] font-black uppercase rounded-lg transition-all ${form.profileType === 'WINDOW' ? 'bg-blue-600 text-white shadow-xs' : 'text-gray-500 hover:text-gray-900'}`}
                        >
                            Profile
                        </button>
                        <button 
                            type="button"
                            onClick={() => setForm({...form, profileType: 'REINFORCEMENT'})}
                            className={`px-3 py-1 text-[10px] font-black uppercase rounded-lg transition-all ${form.profileType === 'REINFORCEMENT' ? 'bg-orange-600 text-white shadow-xs' : 'text-gray-500 hover:text-gray-900'}`}
                        >
                            Reinforce
                        </button>
                    </div>
                </div>

                {/* Duplicate Warning Indicator Banner */}
                {matchingDuplicates.length > 0 && !duplicatePrompt?.isOpen && (
                    <div className="mb-4 p-3 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200 flex items-start gap-2.5 text-xs">
                        <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                        <div>
                            <span className="font-bold">Duplicate Notice:</span> SKU &quot;{form.sku}&quot; already exists in {matchingDuplicates.map(d => d.brand).join(', ')}. When you click save, we will ask if you want to replace existing data, skip, or keep both.
                        </div>
                    </div>
                )}

                {/* Duplicate Interception Dialog (In-Modal) */}
                {duplicatePrompt?.isOpen ? (
                    <div className="space-y-4 p-4 rounded-2xl bg-amber-500/10 border border-amber-400 dark:border-amber-600">
                        <div className="flex items-center gap-2">
                            <ShieldAlert className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                            <h4 className="text-sm font-black text-gray-900 dark:text-white">
                                Duplicate SKU Detected
                            </h4>
                        </div>
                        <p className="text-xs text-gray-600 dark:text-gray-300">
                            A profile with code <span className="font-mono font-bold text-gray-900 dark:text-white">{form.sku}</span> already exists for brand(s): <span className="font-bold text-purple-600">{matchingDuplicates.map(d => d.brand).join(', ')}</span>. What would you like to do?
                        </p>

                        <div className="space-y-2 pt-2">
                            <button
                                type="button"
                                onClick={() => executeSave('REPLACE')}
                                className="w-full p-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-black uppercase tracking-wider flex items-center justify-between transition-all"
                            >
                                <span className="flex items-center gap-2"><RefreshCw className="w-4 h-4" /> Replace Existing Profile Data</span>
                                <span className="text-[10px] opacity-80">Overwrites specs</span>
                            </button>

                            <button
                                type="button"
                                onClick={() => executeSave('ADD_AS_NEW')}
                                className="w-full p-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black uppercase tracking-wider flex items-center justify-between transition-all"
                            >
                                <span className="flex items-center gap-2"><Copy className="w-4 h-4" /> Keep Both (Save as {form.sku}-V2)</span>
                                <span className="text-[10px] opacity-80">Creates new SKU</span>
                            </button>

                            <button
                                type="button"
                                onClick={() => executeSave('SKIP_DUPLICATES')}
                                className="w-full p-3 rounded-xl bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 text-xs font-black uppercase tracking-wider flex items-center justify-between transition-all"
                            >
                                <span className="flex items-center gap-2"><X className="w-4 h-4" /> Skip Existing (Do Not Duplicate)</span>
                                <span className="text-[10px] opacity-80">Leaves original</span>
                            </button>

                            <button
                                type="button"
                                onClick={() => setDuplicatePrompt(null)}
                                className="w-full py-2 text-xs font-bold text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 text-center"
                            >
                                Go Back & Edit SKU
                            </button>
                        </div>
                    </div>
                ) : (
                    /* Standard Profile Form */
                    <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Profile Code (SKU) *</label>
                            <input 
                                placeholder="e.g. D-80-01" 
                                value={form.sku} 
                                onChange={e => setForm({...form, sku: e.target.value})} 
                                className={inputClass} 
                                required
                            />
                        </div>

                        <div>
                            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Description (Name) *</label>
                            <input 
                                placeholder="e.g. 80.5 Sliding Outer Frame" 
                                value={form.name} 
                                onChange={e => setForm({...form, name: e.target.value})} 
                                className={inputClass} 
                                required
                            />
                        </div>

                        <div>
                            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">HSN Code</label>
                            <input 
                                placeholder="39162099" 
                                value={form.hsnCode || ''} 
                                onChange={e => setForm({...form, hsnCode: e.target.value})} 
                                className={inputClass}
                            />
                        </div>

                        <div>
                            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Unit of Measure (UOM)</label>
                            <select value={form.uom} onChange={e => setForm({...form, uom: e.target.value})} className={inputClass}>
                                <option value="Pcs">Pcs</option>
                                <option value="Mtrs">Meters</option>
                                <option value="Kgs">Kgs</option>
                            </select>
                        </div>
                        
                        {initialData && initialData.id ? (
                            <div className="col-span-2">
                                <label className="text-[10px] font-bold text-gray-500 dark:text-gray-400 block mb-1">Brand</label>
                                <select value={form.brand} onChange={e => setForm({...form, brand: e.target.value})} className={inputClass}>
                                    <option value="">-- No Brand --</option>
                                    {brands.map((b: string) => <option key={b} value={b}>{b}</option>)}
                                </select>
                            </div>
                        ) : (
                            <div className="col-span-2 bg-gray-50 dark:bg-gray-900/50 p-3 rounded-2xl border dark:border-gray-700">
                                <div className="flex justify-between items-center mb-2">
                                    <label className="text-xs font-black uppercase tracking-tight text-gray-700 dark:text-gray-300">
                                        Apply to Brands (All data synced across brands):
                                    </label>
                                    <div className="space-x-2">
                                        <button type="button" onClick={selectAllBrands} className="text-[10px] font-black text-blue-600 hover:underline">Select All</button>
                                        <button type="button" onClick={clearAllBrands} className="text-[10px] font-black text-gray-500 hover:underline">Clear</button>
                                    </div>
                                </div>
                                <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto p-1">
                                    {brands.length === 0 ? (
                                        <span className="text-xs text-gray-400 italic">No brands defined. Please add brands in Manage Brands.</span>
                                    ) : (
                                        brands.map((b: string) => {
                                            const isChecked = selectedBrands.includes(b);
                                            return (
                                                <button
                                                    key={b}
                                                    type="button"
                                                    onClick={() => toggleBrand(b)}
                                                    className={`px-3 py-1 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                                                        isChecked 
                                                            ? 'bg-blue-600 text-white shadow-xs' 
                                                            : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border dark:border-gray-700'
                                                    }`}
                                                >
                                                    <span>{b}</span>
                                                </button>
                                            );
                                        })
                                    )}
                                </div>
                            </div>
                        )}

                        <div>
                            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Each Length (m)</label>
                            <input placeholder="5.9" type="number" step="0.01" value={form.length} onChange={e => setForm({...form, length: e.target.value})} className={inputClass}/>
                        </div>

                        <div>
                            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Lengths / Packet (Pcs)</label>
                            <input placeholder="6" type="number" value={form.piecesPerPacket} onChange={e => setForm({...form, piecesPerPacket: e.target.value})} className={inputClass}/>
                        </div>

                        <div>
                            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Length Weight (Kg)</label>
                            <input placeholder="6.250" type="number" step="0.001" value={form.weight} onChange={e => setForm({...form, weight: e.target.value})} className={inputClass}/>
                        </div>

                        <div>
                            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Price (₹)</label>
                            <input placeholder="150" type="number" step="0.01" value={form.price} onChange={e => setForm({...form, price: e.target.value})} className={inputClass}/>
                        </div>

                        <div>
                            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Size</label>
                            <input placeholder="80.5mm" value={form.size} onChange={e => setForm({...form, size: e.target.value})} className={inputClass}/>
                        </div>

                        <div>
                            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Color</label>
                            <input placeholder="White" value={form.color} onChange={e => setForm({...form, color: e.target.value})} className={inputClass}/>
                        </div>

                        <div className="col-span-2 flex justify-end gap-2 mt-4 pt-3 border-t dark:border-gray-700">
                            <button type="button" onClick={onClose} className="px-4 py-2 border dark:border-gray-700 rounded-xl text-xs font-bold text-gray-700 dark:text-gray-300 hover:bg-gray-100">
                                Cancel
                            </button>
                            <button type="submit" className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-md shadow-blue-500/20 active:scale-95 transition-all">
                                Save Profile(s)
                            </button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
};

export default AddProfileModal;
