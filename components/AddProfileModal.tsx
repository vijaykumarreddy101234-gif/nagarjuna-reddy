import React, { useState, useEffect, useMemo } from 'react';
import type { Profile, ToastMessage } from '../types';
import { AlertTriangle, RefreshCw, Copy, Check, X, ShieldAlert, FileSpreadsheet, Plus, Trash2, Clipboard, Layers, Sparkles } from 'lucide-react';

interface ExcelBatchRow {
    id: string;
    sku: string;
    name: string;
    profileType: 'WINDOW' | 'REINFORCEMENT' | 'DOOR';
    brand: string;
    uom: string;
    length: string;
    piecesPerPacket: string;
    weight: string;
    meterWeight: string;
    hsnCode: string;
    price: string;
    reorderPoint: string;
    topFilmWidth: string;
    bottomFilmWidth: string;
}

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
        hsnCode: initialData?.hsnCode || '',
        openingStock: initialData?.openingStock?.toString() || (initialData as any)?.initialStock?.toString() || '',
        topFilmWidth: initialData?.topFilmWidth || '38',
        bottomFilmWidth: initialData?.bottomFilmWidth || '38'
    });

    const [form, setForm] = useState(getInitialState());
    const [selectedBrands, setSelectedBrands] = useState<string[]>([]);
    const [entryMode, setEntryMode] = useState<'form' | 'excel'>('form');

    const createEmptyBatchRow = (idx: number): ExcelBatchRow => ({
        id: `batch_${Date.now()}_${idx}_${Math.random().toString(36).substr(2, 4)}`,
        sku: '',
        name: '',
        profileType: (initialProfileType || 'WINDOW') as any,
        brand: brands[0] || 'General',
        uom: 'Pcs',
        length: '5.8',
        piecesPerPacket: '10',
        weight: '',
        meterWeight: '',
        hsnCode: '',
        price: '0',
        reorderPoint: '50',
        topFilmWidth: '38',
        bottomFilmWidth: '38'
    });

    const [excelRows, setExcelRows] = useState<ExcelBatchRow[]>([
        createEmptyBatchRow(1),
        createEmptyBatchRow(2),
        createEmptyBatchRow(3)
    ]);

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
            setEntryMode('form');
            setExcelRows([
                createEmptyBatchRow(1),
                createEmptyBatchRow(2),
                createEmptyBatchRow(3)
            ]);
        }
    }, [isOpen, brands, initialData, initialProfileType]);

    // Batch Excel Operations
    const addBatchRows = (count: number) => {
        setExcelRows(prev => {
            const next = [...prev];
            for (let i = 0; i < count; i++) {
                next.push(createEmptyBatchRow(prev.length + i + 1));
            }
            return next;
        });
    };

    const updateBatchRow = (id: string, field: keyof ExcelBatchRow, val: string) => {
        setExcelRows(prev => prev.map(row => {
            if (row.id !== id) return row;
            const updated = { ...row, [field]: val };
            // Auto calculate meterWeight
            if (field === 'length' || field === 'weight') {
                const l = parseFloat(field === 'length' ? val : row.length);
                const w = parseFloat(field === 'weight' ? val : row.weight);
                if (l && w && l > 0) {
                    updated.meterWeight = (w / l).toFixed(3);
                }
            }
            return updated;
        }));
    };

    const removeBatchRow = (id: string) => {
        setExcelRows(prev => {
            if (prev.length <= 1) return [createEmptyBatchRow(1)];
            return prev.filter(r => r.id !== id);
        });
    };

    const handlePasteFromClipboard = async () => {
        let text = '';
        try {
            text = await navigator.clipboard.readText();
        } catch {
            text = window.prompt('Paste your copied Excel table rows here (Tab or Comma separated):') || '';
        }

        if (!text || !text.trim()) return;

        const lines = text.trim().split(/\r?\n/);
        const parsedRows: ExcelBatchRow[] = [];

        lines.forEach((line, idx) => {
            const delimiter = line.includes('\t') ? '\t' : ',';
            const parts = line.split(delimiter).map(p => p.trim().replace(/^"|"$/g, ''));
            if (parts.length >= 1 && (parts[0] || parts[1])) {
                // If it looks like header row, skip
                if (idx === 0 && (parts[0].toLowerCase().includes('sku') || parts[0].toLowerCase().includes('code'))) {
                    return;
                }
                const sku = parts[0] || `SKU-${Date.now().toString().slice(-4)}`;
                const name = parts[1] || sku;
                const length = parts[2] || '5.8';
                const piecesPerPacket = parts[3] || '10';
                const weight = parts[4] || '';
                const brand = parts[5] || brands[0] || 'General';
                const price = parts[6] || '0';
                const lNum = parseFloat(length) || 0;
                const wNum = parseFloat(weight) || 0;
                const meterWeight = (lNum > 0 && wNum > 0) ? (wNum / lNum).toFixed(3) : '';

                parsedRows.push({
                    id: `paste_${Date.now()}_${idx}`,
                    sku,
                    name,
                    profileType: (initialProfileType || 'WINDOW') as any,
                    brand,
                    uom: 'Pcs',
                    length,
                    piecesPerPacket,
                    weight,
                    meterWeight,
                    hsnCode: '',
                    price,
                    reorderPoint: '50',
                    topFilmWidth: '38',
                    bottomFilmWidth: '38'
                });
            }
        });

        if (parsedRows.length > 0) {
            setExcelRows(parsedRows);
            addToast(`Pasted ${parsedRows.length} rows from Excel clipboard!`, 'success');
        } else {
            addToast('No valid row data detected from clipboard.', 'error');
        }
    };

    const handleSaveBatchExcel = () => {
        const validRows = excelRows.filter(r => r.sku.trim() || r.name.trim());
        if (validRows.length === 0) {
            addToast('Please enter at least one profile with SKU or Name.', 'error');
            return;
        }

        let addedCount = 0;
        validRows.forEach(row => {
            const sku = row.sku.trim() || `SKU-${Date.now().toString().slice(-4)}`;
            const name = row.name.trim() || sku;
            const l = parseFloat(row.length) || 5.8;
            const w = parseFloat(row.weight) || 0;
            const mWeight = parseFloat(row.meterWeight) || (l > 0 && w > 0 ? parseFloat((w / l).toFixed(3)) : undefined);

            onAdd({
                sku,
                name,
                category: 'Profile',
                profileType: row.profileType,
                brand: row.brand || brands[0] || 'General',
                uom: row.uom || 'Pcs',
                length: l,
                piecesPerPacket: parseInt(row.piecesPerPacket) || 10,
                weight: w,
                meterWeight: mWeight,
                hsnCode: row.hsnCode || undefined,
                price: parseFloat(row.price) || 0,
                reorderPoint: parseInt(row.reorderPoint) || 50,
                topFilmWidth: row.topFilmWidth || '38',
                bottomFilmWidth: row.bottomFilmWidth || '38'
            });
            addedCount++;
        });

        addToast(`Successfully added ${addedCount} profiles to master catalogue!`, 'success');
        onClose();
    };

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
            color: form.color || undefined,
            openingStock: parseFloat(form.openingStock) || 0
        };

        // If editing an existing profile, update it directly
        if (initialData && initialData.id) {
            if (onUpdate) {
                onUpdate({
                    ...initialData,
                    ...baseProfile,
                    brand: form.brand
                });
                addToast(`Successfully updated profile ${form.sku}!`, 'success');
            } else {
                onAdd({ ...baseProfile, brand: form.brand });
            }
            setDuplicatePrompt(null);
            onClose();
            return;
        }

        const brandsToApply = selectedBrands.length > 0 ? selectedBrands : [form.brand];

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
                            brand: b,
                            openingStock: baseProfile.openingStock,
                            topFilmWidth: baseProfile.topFilmWidth,
                            bottomFilmWidth: baseProfile.bottomFilmWidth
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
            <div className={`bg-white dark:bg-gray-800 p-6 rounded-3xl w-full ${entryMode === 'excel' && !initialData ? 'max-w-6xl' : 'max-w-lg'} shadow-2xl border border-gray-100 dark:border-gray-700 max-h-[92vh] overflow-y-auto transition-all`} onClick={e => e.stopPropagation()}>
                
                {/* Header */}
                <div className="flex justify-between items-center mb-3">
                    <div>
                        <h3 className="text-base font-black text-gray-900 dark:text-white flex items-center gap-2">
                            {(initialData && initialData.id) ? 'Edit Profile' : 'Add Profile Master Data'}
                            {entryMode === 'excel' && !initialData && (
                                <span className="px-2 py-0.5 bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 rounded-full text-[10px] font-black tracking-wider uppercase">
                                    Excel Setup
                                </span>
                            )}
                        </h3>
                        <p className="text-[11px] text-gray-400 font-bold uppercase tracking-wider">
                            Brand-wise Technical Specifications &amp; Master Catalogue
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

                {/* Mode Switcher when creating new profiles */}
                {!initialData && (
                    <div className="flex items-center gap-1 p-1 bg-gray-100 dark:bg-gray-700/60 rounded-xl mb-4">
                        <button
                            type="button"
                            onClick={() => setEntryMode('form')}
                            className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-black uppercase tracking-tight flex items-center justify-center gap-1.5 transition-all ${
                                entryMode === 'form' 
                                    ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-xs' 
                                    : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
                            }`}
                        >
                            <Layers className="w-3.5 h-3.5" />
                            <span>Single Profile Form</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => setEntryMode('excel')}
                            className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-black uppercase tracking-tight flex items-center justify-center gap-1.5 transition-all ${
                                entryMode === 'excel' 
                                    ? 'bg-indigo-600 text-white shadow-xs' 
                                    : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
                            }`}
                        >
                            <FileSpreadsheet className="w-3.5 h-3.5" />
                            <span>Excel Spreadsheet Setup</span>
                        </button>
                    </div>
                )}

                {/* EXCEL SPREADSHEET BATCH MODE */}
                {entryMode === 'excel' && !initialData ? (
                    <div className="space-y-4">
                        {/* Excel Toolbar */}
                        <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-slate-50 dark:bg-slate-900/60 rounded-2xl border border-slate-200 dark:border-slate-800">
                            <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                                    Excel Tools:
                                </span>
                                <button
                                    type="button"
                                    onClick={() => addBatchRows(1)}
                                    className="px-3 py-1.5 bg-white dark:bg-slate-800 hover:bg-slate-100 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-bold border border-slate-200 dark:border-slate-700 flex items-center gap-1 shadow-2xs cursor-pointer"
                                >
                                    <Plus className="w-3.5 h-3.5 text-blue-500" /> Add Row
                                </button>
                                <button
                                    type="button"
                                    onClick={() => addBatchRows(5)}
                                    className="px-3 py-1.5 bg-white dark:bg-slate-800 hover:bg-slate-100 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-bold border border-slate-200 dark:border-slate-700 flex items-center gap-1 shadow-2xs cursor-pointer"
                                >
                                    <Plus className="w-3.5 h-3.5 text-blue-500" /> +5 Rows
                                </button>
                                <button
                                    type="button"
                                    onClick={handlePasteFromClipboard}
                                    className="px-3 py-1.5 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 rounded-lg text-xs font-bold border border-emerald-200 dark:border-emerald-800 flex items-center gap-1 shadow-2xs cursor-pointer"
                                    title="Paste tab/comma separated rows from clipboard"
                                >
                                    <Clipboard className="w-3.5 h-3.5 text-emerald-600" /> Paste from Excel
                                </button>
                            </div>
                            <div className="text-xs font-bold text-slate-400">
                                {excelRows.length} profile rows ready
                            </div>
                        </div>

                        {/* Interactive Table */}
                        <div className="overflow-x-auto border border-slate-200 dark:border-slate-700 rounded-2xl max-h-[50vh]">
                            <table className="w-full text-left text-xs border-collapse">
                                <thead className="sticky top-0 z-10 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-black uppercase text-[10px] tracking-wider border-b border-slate-200 dark:border-slate-700">
                                    <tr>
                                        <th className="p-2 w-10 text-center">#</th>
                                        <th className="p-2 min-w-[130px]">SKU *</th>
                                        <th className="p-2 min-w-[180px]">Profile Name / Desc *</th>
                                        <th className="p-2 min-w-[110px]">Type</th>
                                        <th className="p-2 min-w-[120px]">Brand</th>
                                        <th className="p-2 min-w-[85px]">Len (m)</th>
                                        <th className="p-2 min-w-[85px]">Pcs/Pkt</th>
                                        <th className="p-2 min-w-[95px]">Len Wt(kg)</th>
                                        <th className="p-2 min-w-[95px]">Mtr Wt(kg)</th>
                                        <th className="p-2 min-w-[90px]">Price (₹)</th>
                                        <th className="p-2 min-w-[80px]">Min Stk</th>
                                        <th className="p-2 min-w-[75px]">Top Film</th>
                                        <th className="p-2 min-w-[75px]">Bot Film</th>
                                        <th className="p-2 w-10 text-center">Del</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900">
                                    {excelRows.map((row, idx) => (
                                        <tr key={row.id} className="hover:bg-blue-50/40 dark:hover:bg-blue-900/10 transition-colors">
                                            <td className="p-1.5 text-center text-slate-400 font-mono font-bold text-[11px] bg-slate-50 dark:bg-slate-800/40">
                                                {idx + 1}
                                            </td>
                                            <td className="p-1">
                                                <input
                                                    type="text"
                                                    placeholder="e.g. WF-6001"
                                                    value={row.sku}
                                                    onChange={e => updateBatchRow(row.id, 'sku', e.target.value)}
                                                    className="w-full px-2 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-mono font-bold uppercase focus:ring-1 focus:ring-indigo-500 outline-none"
                                                />
                                            </td>
                                            <td className="p-1">
                                                <input
                                                    type="text"
                                                    placeholder="Profile description..."
                                                    value={row.name}
                                                    onChange={e => updateBatchRow(row.id, 'name', e.target.value)}
                                                    className="w-full px-2 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs focus:ring-1 focus:ring-indigo-500 outline-none"
                                                />
                                            </td>
                                            <td className="p-1">
                                                <select
                                                    value={row.profileType}
                                                    onChange={e => updateBatchRow(row.id, 'profileType', e.target.value as any)}
                                                    className="w-full px-2 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold focus:ring-1 focus:ring-indigo-500 outline-none"
                                                >
                                                    <option value="WINDOW">WINDOW</option>
                                                    <option value="REINFORCEMENT">REINFORCE</option>
                                                    <option value="DOOR">DOOR</option>
                                                </select>
                                            </td>
                                            <td className="p-1">
                                                <select
                                                    value={row.brand}
                                                    onChange={e => updateBatchRow(row.id, 'brand', e.target.value)}
                                                    className="w-full px-2 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold focus:ring-1 focus:ring-indigo-500 outline-none"
                                                >
                                                    {brands.map(b => (
                                                        <option key={b} value={b}>{b}</option>
                                                    ))}
                                                </select>
                                            </td>
                                            <td className="p-1">
                                                <input
                                                    type="number"
                                                    step="0.1"
                                                    value={row.length}
                                                    onChange={e => updateBatchRow(row.id, 'length', e.target.value)}
                                                    className="w-full px-2 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-right focus:ring-1 focus:ring-indigo-500 outline-none font-mono"
                                                />
                                            </td>
                                            <td className="p-1">
                                                <input
                                                    type="number"
                                                    value={row.piecesPerPacket}
                                                    onChange={e => updateBatchRow(row.id, 'piecesPerPacket', e.target.value)}
                                                    className="w-full px-2 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-right focus:ring-1 focus:ring-indigo-500 outline-none font-mono"
                                                />
                                            </td>
                                            <td className="p-1">
                                                <input
                                                    type="number"
                                                    step="0.001"
                                                    placeholder="0.000"
                                                    value={row.weight}
                                                    onChange={e => updateBatchRow(row.id, 'weight', e.target.value)}
                                                    className="w-full px-2 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-right font-bold text-indigo-600 dark:text-indigo-400 focus:ring-1 focus:ring-indigo-500 outline-none font-mono"
                                                />
                                            </td>
                                            <td className="p-1">
                                                <input
                                                    type="number"
                                                    step="0.001"
                                                    placeholder="auto"
                                                    value={row.meterWeight}
                                                    onChange={e => updateBatchRow(row.id, 'meterWeight', e.target.value)}
                                                    className="w-full px-2 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-right text-slate-500 focus:ring-1 focus:ring-indigo-500 outline-none font-mono"
                                                />
                                            </td>
                                            <td className="p-1">
                                                <input
                                                    type="number"
                                                    step="0.01"
                                                    value={row.price}
                                                    onChange={e => updateBatchRow(row.id, 'price', e.target.value)}
                                                    className="w-full px-2 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-right focus:ring-1 focus:ring-indigo-500 outline-none font-mono"
                                                />
                                            </td>
                                            <td className="p-1">
                                                <input
                                                    type="number"
                                                    value={row.reorderPoint}
                                                    onChange={e => updateBatchRow(row.id, 'reorderPoint', e.target.value)}
                                                    className="w-full px-2 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-right focus:ring-1 focus:ring-indigo-500 outline-none font-mono"
                                                />
                                            </td>
                                            <td className="p-1">
                                                <input
                                                    type="text"
                                                    value={row.topFilmWidth}
                                                    onChange={e => updateBatchRow(row.id, 'topFilmWidth', e.target.value)}
                                                    className="w-full px-2 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-center focus:ring-1 focus:ring-indigo-500 outline-none"
                                                />
                                            </td>
                                            <td className="p-1">
                                                <input
                                                    type="text"
                                                    value={row.bottomFilmWidth}
                                                    onChange={e => updateBatchRow(row.id, 'bottomFilmWidth', e.target.value)}
                                                    className="w-full px-2 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-center focus:ring-1 focus:ring-indigo-500 outline-none"
                                                />
                                            </td>
                                            <td className="p-1 text-center">
                                                <button
                                                    type="button"
                                                    onClick={() => removeBatchRow(row.id)}
                                                    className="p-1 hover:bg-rose-100 dark:hover:bg-rose-900/30 text-rose-500 rounded-md transition-colors cursor-pointer"
                                                    title="Delete row"
                                                >
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Excel Setup Footer Buttons */}
                        <div className="flex justify-between items-center pt-3 border-t border-slate-200 dark:border-slate-700">
                            <button
                                type="button"
                                onClick={onClose}
                                className="px-4 py-2 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                            >
                                Cancel
                            </button>
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => addBatchRows(1)}
                                    className="px-3 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold cursor-pointer"
                                >
                                    + Add Row
                                </button>
                                <button
                                    type="button"
                                    onClick={handleSaveBatchExcel}
                                    className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-md shadow-indigo-500/20 active:scale-95 transition-all flex items-center gap-2 cursor-pointer"
                                >
                                    <Check className="w-4 h-4" /> Save All to Catalogue
                                </button>
                            </div>
                        </div>
                    </div>
                ) : (
                    <>
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

                        <div>
                            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1 text-blue-500">Top/Right Film (mm)</label>
                            <input placeholder="38" value={form.topFilmWidth} onChange={e => setForm({...form, topFilmWidth: e.target.value})} className={inputClass}/>
                        </div>

                        <div>
                            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1 text-blue-600">Bottom/Left Film (mm)</label>
                            <input placeholder="38" value={form.bottomFilmWidth} onChange={e => setForm({...form, bottomFilmWidth: e.target.value})} className={inputClass}/>
                        </div>

                        <div className="col-span-2">
                            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Opening Balance (Qty / Pcs)</label>
                            <input placeholder="e.g. 1500" type="number" value={form.openingStock} onChange={e => setForm({...form, openingStock: e.target.value})} className={inputClass}/>
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
                    </>
                )}
            </div>
        </div>
    );
};

export default AddProfileModal;
