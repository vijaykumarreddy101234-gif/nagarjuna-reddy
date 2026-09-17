import React, { useState, useMemo } from 'react';
import { useStore } from '../store/useStore';
import { Card } from './Card';
import { 
    Zap, 
    CheckCircle2, 
    AlertTriangle, 
    RefreshCw, 
    Cpu, 
    Shield, 
    FileSpreadsheet, 
    Warehouse, 
    Activity, 
    Calendar, 
    Package, 
    Plus, 
    ArrowRight, 
    Layers, 
    Filter,
    Check,
    Copy
} from 'lucide-react';
import type { Profile, Die, ProtectiveFilmItem } from '../types';
import { DuplicateResolutionModal, DuplicateConflictItem } from './DuplicateResolutionModal';

interface BrandSyncPlanningProps {
    initialBrandFilter?: string;
    onBrandFilterChange?: (brand: string) => void;
    addToast?: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
    onExportStockToDataPlan?: (targetBrand?: string) => void;
}

export const BrandSyncPlanning = ({
    initialBrandFilter = 'All',
    onBrandFilterChange,
    addToast,
    onExportStockToDataPlan
}) => {
    const { 
        profiles: rawProfiles, 
        dies: rawDies, 
        productionPlans: rawPlans, 
        profileTransactions: rawTxns, 
        brands, 
        protectiveFilmItems,
        addDie,
        addProfile,
        updateProfile,
        deleteProfile,
        addBrand,
        syncProfilesToStock
    } = useStore();

    const [selectedBrand, setSelectedBrand] = useState<string>(initialBrandFilter || 'All');
    const [isSyncing, setIsSyncing] = useState(false);
    const [syncLog, setSyncLog] = useState<string[]>([]);
    const [duplicateConflicts, setDuplicateConflicts] = useState<DuplicateConflictItem[]>([]);
    const [isDuplicateModalOpen, setIsDuplicateModalOpen] = useState(false);

    const profiles = useMemo(() => rawProfiles.filter(p => !p.deletedAt), [rawProfiles]);
    const dies = useMemo(() => rawDies.filter(d => !d.deletedAt), [rawDies]);
    const plans = useMemo(() => rawPlans.filter(p => !p.deletedAt), [rawPlans]);
    const transactions = useMemo(() => rawTxns.filter(t => !t.deletedAt), [rawTxns]);

    const handleSelectBrand = (b: string) => {
        setSelectedBrand(b);
        onBrandFilterChange?.(b);
    };

    // Calculate Brand Sync Metrics
    const brandMetrics = useMemo(() => {
        const brandList = selectedBrand === 'All' ? brands : [selectedBrand];

        return brandList.map(b => {
            const brandProfiles = profiles.filter(p => (p.brand || 'General').toLowerCase() === b.toLowerCase());
            const brandDies = dies.filter(d => (d.brand || 'General').toLowerCase() === b.toLowerCase());
            const brandPlans = plans.filter(p => p.dieIds.some(did => brandDies.some(bd => bd.id === did)));
            const brandTxns = transactions.filter(t => (t.brand || 'General').toLowerCase() === b.toLowerCase());
            const brandFilms = protectiveFilmItems.filter(f => (f.brand || 'General').toLowerCase() === b.toLowerCase());

            // Profiles missing dies
            const profilesWithoutDies = brandProfiles.filter(p => !brandDies.some(d => d.profileId === p.id));
            
            // Profiles missing protective film configuration
            const profilesWithoutFilm = brandProfiles.filter(p => !brandFilms.some(f => f.profileCode.toLowerCase() === p.sku.toLowerCase()));

            // Stock calculation
            const inStockProfiles = brandProfiles.filter(p => {
                const txs = brandTxns.filter(t => t.profileId === p.id);
                const prod = txs.filter(t => t.type === 'PRODUCTION' || t.type === 'RETURN').reduce((s, t) => s + Number(t.quantity || 0), 0);
                const disp = txs.filter(t => t.type === 'DISPATCH').reduce((s, t) => s + Number(t.quantity || 0), 0);
                const scrap = txs.filter(t => t.type === 'SCRAP').reduce((s, t) => s + Number(t.quantity || 0), 0);
                return (prod - disp - scrap) > 0;
            });

            // Status: green if profiles have dies and films, yellow if some missing, red if empty
            let healthScore = 100;
            if (brandProfiles.length === 0) {
                healthScore = 0;
            } else {
                const dieRatio = (brandProfiles.length - profilesWithoutDies.length) / brandProfiles.length;
                const filmRatio = (brandProfiles.length - profilesWithoutFilm.length) / brandProfiles.length;
                healthScore = Math.round(((dieRatio + filmRatio) / 2) * 100);
            }

            return {
                brand: b,
                profileCount: brandProfiles.length,
                dieCount: brandDies.length,
                planCount: brandPlans.length,
                txnCount: brandTxns.length,
                filmCount: brandFilms.length,
                profilesWithoutDies,
                profilesWithoutFilm,
                inStockCount: inStockProfiles.length,
                healthScore
            };
        });
    }, [profiles, dies, plans, transactions, protectiveFilmItems, brands, selectedBrand]);

    // Aggregate totals for the top stats banner
    const summaryStats = useMemo(() => {
        const totalProfiles = brandMetrics.reduce((s, m) => s + m.profileCount, 0);
        const totalDies = brandMetrics.reduce((s, m) => s + m.dieCount, 0);
        const totalMissingDies = brandMetrics.reduce((s, m) => s + m.profilesWithoutDies.length, 0);
        const totalMissingFilms = brandMetrics.reduce((s, m) => s + m.profilesWithoutFilm.length, 0);
        const avgHealth = brandMetrics.length > 0 
            ? Math.round(brandMetrics.reduce((s, m) => s + m.healthScore, 0) / brandMetrics.length) 
            : 0;

        return {
            totalProfiles,
            totalDies,
            totalMissingDies,
            totalMissingFilms,
            avgHealth
        };
    }, [brandMetrics]);

    // Action 1: Auto-generate missing dies for a brand (or all brands)
    const handleAutoGenerateDies = (targetBrand?: string) => {
        const brandsToProcess = targetBrand && targetBrand !== 'All' ? [targetBrand] : brands;
        let generatedCount = 0;

        brandsToProcess.forEach(b => {
            const bProfiles = profiles.filter(p => (p.brand || 'General').toLowerCase() === b.toLowerCase());
            const bDies = dies.filter(d => (d.brand || 'General').toLowerCase() === b.toLowerCase());

            bProfiles.forEach(p => {
                const hasDie = bDies.some(d => d.profileId === p.id);
                if (!hasDie) {
                    addDie({
                        dieNo: `DIE-${p.sku}`,
                        profileId: p.id,
                        brand: b,
                        cavities: p.piecesPerPacket && p.piecesPerPacket <= 4 ? 2 : 1,
                        expectedOutputKgHr: 120,
                        lifespanMeters: 50000,
                        status: 'ACTIVE'
                    });
                    generatedCount++;
                }
            });
        });

        if (generatedCount > 0) {
            addToast?.(`Auto-generated ${generatedCount} missing extrusion die(s) for ${targetBrand || 'all brands'}!`, 'success');
            setSyncLog(prev => [`[${new Date().toLocaleTimeString()}] Auto-created ${generatedCount} extrusion die(s).`, ...prev]);
        } else {
            addToast?.(`All profiles for ${targetBrand || 'selected brands'} already have extrusion dies.`, 'info');
        }
    };

    // Action 2: Auto-sync protective film items
    const handleAutoSyncFilms = (targetBrand?: string) => {
        syncProfilesToStock();
        addToast?.(`Synchronized protective films and sticker inventory across all brand profiles.`, 'success');
        setSyncLog(prev => [`[${new Date().toLocaleTimeString()}] Synchronized protective films catalog with master profiles.`, ...prev]);
    };

    // Action 3: Check duplicates for brand
    const handleAuditDuplicates = (targetBrand?: string) => {
        const brandToAudit = targetBrand || selectedBrand;
        const targetProfiles = brandToAudit === 'All' 
            ? profiles 
            : profiles.filter(p => (p.brand || 'General').toLowerCase() === brandToAudit.toLowerCase());

        // Group by SKU + Brand
        const skuMap = new Map<string, Profile[]>();
        targetProfiles.forEach(p => {
            const key = `${(p.brand || 'General').toUpperCase()}:::${p.sku.toUpperCase()}`;
            if (!skuMap.has(key)) skuMap.set(key, []);
            skuMap.get(key)!.push(p);
        });

        const conflicts: DuplicateConflictItem[] = [];
        skuMap.forEach((pList, key) => {
            if (pList.length > 1) {
                // Duplicate group!
                const primary = pList[0];
                for (let i = 1; i < pList.length; i++) {
                    const dup = pList[i];
                    conflicts.push({
                        id: dup.id,
                        sku: dup.sku,
                        brand: dup.brand || 'General',
                        name: dup.name,
                        existing: primary,
                        incoming: dup,
                        action: 'REPLACE',
                        customSku: `${dup.sku}-V${i + 1}`
                    });
                }
            }
        });

        if (conflicts.length > 0) {
            setDuplicateConflicts(conflicts);
            setIsDuplicateModalOpen(true);
        } else {
            addToast?.(`No duplicate profiles detected for ${brandToAudit}. Database is clean!`, 'success');
        }
    };

    // Resolve duplicates from modal
    const handleResolveDuplicates = (resolutions: DuplicateConflictItem[]) => {
        let replaced = 0;
        let skipped = 0;
        let renamed = 0;

        resolutions.forEach(res => {
            if (res.action === 'REPLACE') {
                // Delete the duplicate entry and update the primary
                deleteProfile(res.id);
                if (res.existing.id) {
                    updateProfile({
                        ...(res.existing as Profile),
                        name: res.incoming.name || res.existing.name || '',
                        length: res.incoming.length !== undefined ? res.incoming.length : res.existing.length,
                        weight: res.incoming.weight !== undefined ? res.incoming.weight : res.existing.weight,
                        piecesPerPacket: res.incoming.piecesPerPacket !== undefined ? res.incoming.piecesPerPacket : res.existing.piecesPerPacket,
                        price: res.incoming.price !== undefined ? res.incoming.price : res.existing.price,
                    });
                }
                replaced++;
            } else if (res.action === 'SKIP') {
                // Remove the redundant duplicate
                deleteProfile(res.id);
                skipped++;
            } else if (res.action === 'ADD_AS_NEW') {
                // Update duplicate with custom distinct SKU
                const targetDup = profiles.find(p => p.id === res.id);
                if (targetDup) {
                    updateProfile({
                        ...targetDup,
                        sku: res.customSku || `${targetDup.sku}-COPY`
                    });
                    renamed++;
                }
            }
        });

        addToast?.(`Resolved duplicates: ${replaced} replaced, ${skipped} cleaned, ${renamed} kept as new!`, 'success');
        setSyncLog(prev => [`[${new Date().toLocaleTimeString()}] Duplicate resolution applied: ${replaced} replaced, ${skipped} skipped, ${renamed} renamed.`, ...prev]);
    };

    // Master Action: Unified Brand Sync (All Tabs)
    const handleUnifiedBrandSync = async () => {
        setIsSyncing(true);
        setSyncLog(prev => [`[${new Date().toLocaleTimeString()}] Initiating Unified Brand Sync for ${selectedBrand}...`, ...prev]);

        try {
            // 1. Ensure Brand is registered in brands list
            if (selectedBrand !== 'All' && !brands.includes(selectedBrand)) {
                addBrand(selectedBrand);
                setSyncLog(prev => [`[${new Date().toLocaleTimeString()}] Registered brand "${selectedBrand}" to master brand directory.`, ...prev]);
            }

            // 2. Auto-Generate missing Dies across profiles
            handleAutoGenerateDies(selectedBrand);

            // 3. Auto-Sync Protective Films & Stickers
            handleAutoSyncFilms(selectedBrand);

            // 4. Auto-Export & Map Stock to Data Plan Sheet
            if (onExportStockToDataPlan) {
                onExportStockToDataPlan(selectedBrand);
                setSyncLog(prev => [`[${new Date().toLocaleTimeString()}] Synced live stock balances into Data Plan Sheet.`, ...prev]);
            }

            // 5. Audit duplicates
            const brandToAudit = selectedBrand;
            const targetProfiles = brandToAudit === 'All' 
                ? profiles 
                : profiles.filter(p => (p.brand || 'General').toLowerCase() === brandToAudit.toLowerCase());

            const skuMap = new Map<string, Profile[]>();
            targetProfiles.forEach(p => {
                const key = `${(p.brand || 'General').toUpperCase()}:::${p.sku.toUpperCase()}`;
                if (!skuMap.has(key)) skuMap.set(key, []);
                skuMap.get(key)!.push(p);
            });

            const conflicts: DuplicateConflictItem[] = [];
            skuMap.forEach((pList) => {
                if (pList.length > 1) {
                    const primary = pList[0];
                    for (let i = 1; i < pList.length; i++) {
                        const dup = pList[i];
                        conflicts.push({
                            id: dup.id,
                            sku: dup.sku,
                            brand: dup.brand || 'General',
                            name: dup.name,
                            existing: primary,
                            incoming: dup,
                            action: 'REPLACE',
                            customSku: `${dup.sku}-V${i + 1}`
                        });
                    }
                }
            });

            if (conflicts.length > 0) {
                setDuplicateConflicts(conflicts);
                setIsDuplicateModalOpen(true);
                addToast?.(`Brand sync finished! Detected ${conflicts.length} duplicate items requiring your confirmation.`, 'warning');
            } else {
                addToast?.(`Unified Brand Sync completed successfully across all tabs!`, 'success');
                setSyncLog(prev => [`[${new Date().toLocaleTimeString()}] Unified Brand Sync complete. All tabs in sync.`, ...prev]);
            }
        } catch (error) {
            console.error(error);
            addToast?.('Sync failed unexpectedly. Please check console.', 'error');
        } finally {
            setIsSyncing(false);
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-300">
            {/* Top Hero Banner with Unified Sync Trigger */}
            <div className="bg-gradient-to-r from-blue-700 via-indigo-700 to-purple-800 p-6 md:p-8 rounded-3xl text-white shadow-xl shadow-blue-500/15 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
                    <Zap className="w-80 h-80" />
                </div>

                <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                    <div className="max-w-2xl">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/20 text-[10px] font-black uppercase tracking-widest mb-3 backdrop-blur-md">
                            <Zap className="w-3 h-3 fill-white" /> Live Multi-Tab Synchronization Center
                        </div>
                        <h2 className="text-3xl md:text-4xl font-black tracking-tight leading-tight">
                            Brand-Wise Cross-Tab Synchronization
                        </h2>
                        <p className="text-blue-100 text-sm font-medium mt-2 leading-relaxed">
                            Synchronize your master profiles, extrusion dies, protective film stock, production plans, and data plan sheets brand-wise in one unified action. Automatically resolve duplicates with full control.
                        </p>
                    </div>

                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0">
                        <button
                            type="button"
                            onClick={() => handleAuditDuplicates(selectedBrand)}
                            className="px-5 py-3 bg-white/15 hover:bg-white/25 text-white rounded-2xl text-xs font-black uppercase tracking-wider backdrop-blur-md transition-all flex items-center justify-center gap-2 active:scale-95 cursor-pointer border border-white/20"
                            title="Audit current database for duplicate profiles"
                        >
                            <AlertTriangle className="w-4 h-4 text-amber-300" /> Audit Duplicates
                        </button>

                        <button
                            type="button"
                            onClick={handleUnifiedBrandSync}
                            disabled={isSyncing}
                            className="px-6 py-3.5 bg-white text-blue-800 hover:bg-blue-50 rounded-2xl text-xs font-black uppercase tracking-wider shadow-lg shadow-black/20 transition-all flex items-center justify-center gap-2 active:scale-95 cursor-pointer disabled:opacity-50"
                        >
                            <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin text-blue-600' : 'text-blue-800'}`} />
                            {isSyncing ? 'Synchronizing All Tabs...' : 'Sync All Tabs Brand-Wise'}
                        </button>
                    </div>
                </div>

                {/* Aggregate KPI Strip */}
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mt-6 pt-6 border-t border-white/15">
                    <div className="bg-white/10 rounded-2xl p-3 backdrop-blur-xs">
                        <p className="text-[10px] font-black uppercase tracking-wider text-blue-200">Total Profiles</p>
                        <p className="text-2xl font-black mt-1">{summaryStats.totalProfiles}</p>
                    </div>
                    <div className="bg-white/10 rounded-2xl p-3 backdrop-blur-xs">
                        <p className="text-[10px] font-black uppercase tracking-wider text-blue-200">Extrusion Dies</p>
                        <p className="text-2xl font-black mt-1">{summaryStats.totalDies}</p>
                    </div>
                    <div className="bg-white/10 rounded-2xl p-3 backdrop-blur-xs">
                        <p className="text-[10px] font-black uppercase tracking-wider text-amber-200">Missing Dies</p>
                        <p className="text-2xl font-black mt-1 text-amber-300">{summaryStats.totalMissingDies}</p>
                    </div>
                    <div className="bg-white/10 rounded-2xl p-3 backdrop-blur-xs">
                        <p className="text-[10px] font-black uppercase tracking-wider text-purple-200">Missing Films</p>
                        <p className="text-2xl font-black mt-1 text-purple-300">{summaryStats.totalMissingFilms}</p>
                    </div>
                    <div className="bg-white/10 rounded-2xl p-3 backdrop-blur-xs col-span-2 sm:col-span-1">
                        <p className="text-[10px] font-black uppercase tracking-wider text-emerald-200">Sync Health</p>
                        <p className="text-2xl font-black mt-1 text-emerald-300">{summaryStats.avgHealth}%</p>
                    </div>
                </div>
            </div>

            {/* Brand Filter Selector & Global Actions */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-gray-800 p-4 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-xs">
                <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
                    <span className="text-[10px] font-black uppercase tracking-wider text-gray-400 shrink-0 mr-1">
                        Select Brand:
                    </span>
                    <button
                        onClick={() => handleSelectBrand('All')}
                        className={`px-3.5 py-1.5 rounded-xl text-xs font-black uppercase tracking-tight transition-all shrink-0 ${
                            selectedBrand === 'All'
                                ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/20'
                                : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200'
                        }`}
                    >
                        All Brands ({brands.length})
                    </button>
                    {brands.map(b => (
                        <button
                            key={b}
                            onClick={() => handleSelectBrand(b)}
                            className={`px-3.5 py-1.5 rounded-xl text-xs font-black uppercase tracking-tight transition-all shrink-0 ${
                                selectedBrand === b
                                    ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/20'
                                    : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200'
                            }`}
                        >
                            {b}
                        </button>
                    ))}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                    <button
                        onClick={() => handleAutoGenerateDies(selectedBrand)}
                        className="px-3 py-1.5 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border border-indigo-200 dark:border-indigo-800"
                        title="Automatically create missing dies for profiles"
                    >
                        <Cpu className="w-3.5 h-3.5" /> Auto-Add Missing Dies
                    </button>

                    <button
                        onClick={() => handleAutoSyncFilms(selectedBrand)}
                        className="px-3 py-1.5 bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 hover:bg-purple-100 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border border-purple-200 dark:border-purple-800"
                        title="Synchronize protective films catalogue"
                    >
                        <Shield className="w-3.5 h-3.5" /> Auto-Sync Films
                    </button>
                </div>
            </div>

            {/* Brand Detailed Status Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {brandMetrics.map(item => {
                    const isAllClean = item.profilesWithoutDies.length === 0 && item.profilesWithoutFilm.length === 0 && item.profileCount > 0;

                    return (
                        <div 
                            key={item.brand}
                            className="bg-white dark:bg-gray-800 rounded-3xl p-5 border border-gray-100 dark:border-gray-700 shadow-sm hover:shadow-md transition-all flex flex-col justify-between space-y-4"
                        >
                            {/* Card Header */}
                            <div>
                                <div className="flex items-start justify-between gap-3">
                                    <div>
                                        <span className="px-2 py-0.5 rounded-md bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 text-[10px] font-black uppercase tracking-wider">
                                            Brand Focus
                                        </span>
                                        <h3 className="text-xl font-black text-gray-900 dark:text-white uppercase tracking-tight mt-1">
                                            {item.brand}
                                        </h3>
                                    </div>

                                    <div className="flex items-center gap-1.5">
                                        <span className={`px-2.5 py-1 rounded-xl text-[10px] font-black uppercase tracking-wider ${
                                            item.healthScore >= 90 
                                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300' 
                                                : item.healthScore >= 60 
                                                    ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300' 
                                                    : 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300'
                                        }`}>
                                            {item.healthScore}% Synced
                                        </span>
                                    </div>
                                </div>

                                {/* 7-Tab Coverage Breakdown */}
                                <div className="grid grid-cols-2 gap-2 mt-4 text-xs">
                                    <div className="p-2.5 bg-gray-50 dark:bg-gray-900/50 rounded-xl border border-gray-100 dark:border-gray-700">
                                        <div className="flex items-center justify-between text-gray-500 dark:text-gray-400 mb-0.5">
                                            <span className="flex items-center gap-1 text-[10px] font-bold uppercase"><Package className="w-3 h-3 text-blue-500" /> Profiles</span>
                                            <span className="font-mono font-black text-gray-900 dark:text-white">{item.profileCount}</span>
                                        </div>
                                        <p className="text-[10px] text-gray-400">Master SKUs registered</p>
                                    </div>

                                    <div className="p-2.5 bg-gray-50 dark:bg-gray-900/50 rounded-xl border border-gray-100 dark:border-gray-700">
                                        <div className="flex items-center justify-between text-gray-500 dark:text-gray-400 mb-0.5">
                                            <span className="flex items-center gap-1 text-[10px] font-bold uppercase"><Warehouse className="w-3 h-3 text-emerald-500" /> Stock</span>
                                            <span className="font-mono font-black text-emerald-600 dark:text-emerald-400">{item.inStockCount} Active</span>
                                        </div>
                                        <p className="text-[10px] text-gray-400">In Window Stock</p>
                                    </div>

                                    <div className="p-2.5 bg-gray-50 dark:bg-gray-900/50 rounded-xl border border-gray-100 dark:border-gray-700">
                                        <div className="flex items-center justify-between text-gray-500 dark:text-gray-400 mb-0.5">
                                            <span className="flex items-center gap-1 text-[10px] font-bold uppercase"><Cpu className="w-3 h-3 text-indigo-500" /> Extrusion Dies</span>
                                            <span className="font-mono font-black text-gray-900 dark:text-white">{item.dieCount}</span>
                                        </div>
                                        <p className="text-[10px] text-gray-400">
                                            {item.profilesWithoutDies.length > 0 ? (
                                                <span className="text-amber-500 font-bold">⚠️ {item.profilesWithoutDies.length} unmapped</span>
                                            ) : (
                                                <span className="text-emerald-600 font-bold">✓ All mapped</span>
                                            )}
                                        </p>
                                    </div>

                                    <div className="p-2.5 bg-gray-50 dark:bg-gray-900/50 rounded-xl border border-gray-100 dark:border-gray-700">
                                        <div className="flex items-center justify-between text-gray-500 dark:text-gray-400 mb-0.5">
                                            <span className="flex items-center gap-1 text-[10px] font-bold uppercase"><Shield className="w-3 h-3 text-purple-500" /> Films</span>
                                            <span className="font-mono font-black text-gray-900 dark:text-white">{item.filmCount}</span>
                                        </div>
                                        <p className="text-[10px] text-gray-400">
                                            {item.profilesWithoutFilm.length > 0 ? (
                                                <span className="text-amber-500 font-bold">⚠️ {item.profilesWithoutFilm.length} unlinked</span>
                                            ) : (
                                                <span className="text-emerald-600 font-bold">✓ All linked</span>
                                            )}
                                        </p>
                                    </div>

                                    <div className="p-2.5 bg-gray-50 dark:bg-gray-900/50 rounded-xl border border-gray-100 dark:border-gray-700">
                                        <div className="flex items-center justify-between text-gray-500 dark:text-gray-400 mb-0.5">
                                            <span className="flex items-center gap-1 text-[10px] font-bold uppercase"><Activity className="w-3 h-3 text-rose-500" /> Production</span>
                                            <span className="font-mono font-black text-gray-900 dark:text-white">{item.txnCount}</span>
                                        </div>
                                        <p className="text-[10px] text-gray-400">Inflow & dispatches</p>
                                    </div>

                                    <div className="p-2.5 bg-gray-50 dark:bg-gray-900/50 rounded-xl border border-gray-100 dark:border-gray-700">
                                        <div className="flex items-center justify-between text-gray-500 dark:text-gray-400 mb-0.5">
                                            <span className="flex items-center gap-1 text-[10px] font-bold uppercase"><Calendar className="w-3 h-3 text-cyan-500" /> Plans</span>
                                            <span className="font-mono font-black text-gray-900 dark:text-white">{item.planCount}</span>
                                        </div>
                                        <p className="text-[10px] text-gray-400">Extrusion schedules</p>
                                    </div>
                                </div>
                            </div>

                            {/* Card Footer Quick Actions */}
                            <div className="pt-3 border-t border-gray-100 dark:border-gray-700 flex items-center justify-between gap-2">
                                <button
                                    type="button"
                                    onClick={() => handleAuditDuplicates(item.brand)}
                                    className="px-3 py-1.5 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 text-gray-700 dark:text-gray-300 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all"
                                >
                                    Audit Duplicates
                                </button>

                                <div className="flex items-center gap-1.5">
                                    {item.profilesWithoutDies.length > 0 && (
                                        <button
                                            type="button"
                                            onClick={() => handleAutoGenerateDies(item.brand)}
                                            className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1 shadow-xs"
                                        >
                                            <Plus className="w-3 h-3" /> Add {item.profilesWithoutDies.length} Dies
                                        </button>
                                    )}

                                    {onExportStockToDataPlan && (
                                        <button
                                            type="button"
                                            onClick={() => onExportStockToDataPlan(item.brand)}
                                            className="px-3 py-1.5 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300 hover:bg-blue-100 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1"
                                            title="Sync this brand's stock to Data Plan Sheet"
                                        >
                                            <FileSpreadsheet className="w-3 h-3" /> Data Plan
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Sync Activity Log */}
            {syncLog.length > 0 && (
                <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 border border-gray-100 dark:border-gray-700 shadow-xs">
                    <h4 className="text-xs font-black uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">
                        Recent Sync Activity:
                    </h4>
                    <div className="space-y-1 max-h-36 overflow-y-auto font-mono text-xs text-gray-600 dark:text-gray-300">
                        {syncLog.map((log, idx) => (
                            <div key={idx} className="flex items-center gap-2">
                                <span className="text-emerald-500">✓</span>
                                <span>{log}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Duplicate Resolution Modal */}
            <DuplicateResolutionModal
                isOpen={isDuplicateModalOpen}
                onClose={() => setIsDuplicateModalOpen(false)}
                conflicts={duplicateConflicts}
                nonConflictsCount={0}
                onResolve={handleResolveDuplicates}
            />
        </div>
    );
};
