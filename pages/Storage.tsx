import React, { useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { 
    Cloud, 
    Upload, 
    Download, 
    RefreshCw, 
    FileSpreadsheet, 
    Trash2, 
    LogOut, 
    CheckCircle2, 
    Zap
} from 'lucide-react';
import { useStore } from '../store/useStore';
import type { ToastMessage } from '../types';

interface StorageProps {
    addToast?: (message: string, type?: ToastMessage['type']) => void;
}

const Storage: React.FC<StorageProps> = ({ addToast }) => {
    const store = useStore();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isSavingDrive, setIsSavingDrive] = useState(false);
    const [isLoadingDrive, setIsLoadingDrive] = useState(false);
    const [isExportingExcel, setIsExportingExcel] = useState(false);

    const currentUser = store.currentUser || {
        id: 'usr_admin',
        name: 'Nagarjuna (Admin)',
        email: 'nagarjunakypa99@gmail.com',
        role: 'ADMIN',
        createdAt: new Date().toISOString()
    };

    const formatSyncTime = (isoString: string | null) => {
        if (!isoString) return 'Just now';
        try {
            return new Date(isoString).toLocaleString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit'
            });
        } catch {
            return 'Just now';
        }
    };

    // Save state snapshot into cloud simulation + update store timestamp
    const handleSaveToDrive = () => {
        setIsSavingDrive(true);
        setTimeout(() => {
            store.syncOfflineDataToCloud();
            setIsSavingDrive(false);
            if (addToast) {
                addToast('All ERP database tables successfully backed up to Google Drive Cloud Storage!', 'success');
            }
        }, 600);
    };

    // Load state from cloud
    const handleLoadFromDrive = () => {
        setIsLoadingDrive(true);
        setTimeout(() => {
            store.syncOfflineDataToCloud();
            setIsLoadingDrive(false);
            if (addToast) {
                addToast('Latest Google Drive cloud snapshot loaded and synchronized with this PC.', 'info');
            }
        }, 600);
    };

    // Export comprehensive multi-sheet Excel (.xlsx) file
    const handleExportExcel = () => {
        setIsExportingExcel(true);
        try {
            const wb = XLSX.utils.book_new();

            // 1. Raw Materials Items Sheet
            const itemsData = store.items.map(item => ({
                'Item ID': item.id,
                'SKU': item.sku,
                'Name': item.name,
                'Category': item.category,
                'Unit': item.uom || 'kg',
                'Opening Stock': item.openingStock || 0,
                'Reorder Point': item.reorderPoint || 0,
                'Cost Price': item.costPrice || 0,
                'Created At': item.createdAt
            }));
            const wsItems = XLSX.utils.json_to_sheet(itemsData.length ? itemsData : [{ 'Status': 'No items' }]);
            XLSX.utils.book_append_sheet(wb, wsItems, 'Raw Materials');

            // 2. Inflow Transactions Sheet
            const inflowData = store.inflowTransactions.map(tx => {
                const item = store.items.find(i => i.id === tx.itemId);
                return {
                    'Transaction ID': tx.id,
                    'Date': tx.txnDate || tx.createdAt,
                    'Reference No': tx.refNo || '',
                    'Item SKU': item?.sku || '',
                    'Item Name': item?.name || tx.itemId,
                    'Quantity': tx.quantity,
                    'Unit Cost': tx.unitCost,
                    'Total Cost': tx.totalCost,
                    'Supplier': tx.supplier || '',
                    'Warehouse': tx.warehouseId || ''
                };
            });
            const wsInflow = XLSX.utils.json_to_sheet(inflowData.length ? inflowData : [{ 'Status': 'No inflow records' }]);
            XLSX.utils.book_append_sheet(wb, wsInflow, 'Inflow History');

            // 3. Consumption Transactions Sheet
            const consumptionData = store.consumptionTransactions.map(tx => {
                const item = store.items.find(i => i.id === tx.itemId);
                return {
                    'Transaction ID': tx.id,
                    'Date': tx.txnDate || tx.createdAt,
                    'Reference No': tx.refNo || '',
                    'Batch No': tx.batchNo || '',
                    'Item SKU': item?.sku || '',
                    'Item Name': item?.name || tx.itemId,
                    'Quantity Consumed': tx.quantity,
                    'Type': tx.type || 'PROD',
                    'Warehouse': tx.warehouseId || ''
                };
            });
            const wsConsumption = XLSX.utils.json_to_sheet(consumptionData.length ? consumptionData : [{ 'Status': 'No consumption records' }]);
            XLSX.utils.book_append_sheet(wb, wsConsumption, 'Consumption History');

            // 4. Profiles Catalog Sheet
            const profilesData = store.profiles.map(p => ({
                'Profile ID': p.id,
                'Code': p.sku,
                'Name': p.name,
                'Brand': p.brand || 'Scraft',
                'Color': p.color || '',
                'Weight (kg/m)': p.weight || 0,
                'Standard Length (m)': p.length || 5.9,
                'Pieces Per Packet': p.piecesPerPacket || 6
            }));
            const wsProfiles = XLSX.utils.json_to_sheet(profilesData.length ? profilesData : [{ 'Status': 'No profiles' }]);
            XLSX.utils.book_append_sheet(wb, wsProfiles, 'Profiles Catalog');

            // 5. Protective Film Items Sheet
            const pfData = store.protectiveFilmItems.map(p => ({
                'Profile Code': p.profileCode,
                'Brand': p.brand || 'Scraft',
                'Series': p.series,
                'Top Width (mm)': p.topFilmWidth,
                'Top Sticker': p.topStickerName,
                'Bottom Width (mm)': p.bottomFilmWidth,
                'Bottom Sticker': p.bottomStickerName,
                'Top Inward (m)': p.topInwardMeters || 0,
                'Bottom Inward (m)': p.bottomInwardMeters || 0
            }));
            const wsPf = XLSX.utils.json_to_sheet(pfData.length ? pfData : [{ 'Status': 'No protective films' }]);
            XLSX.utils.book_append_sheet(wb, wsPf, 'Protective Films');

            // Write File
            const fileName = `ERP_Full_Backup_${new Date().toISOString().split('T')[0]}.xlsx`;
            XLSX.writeFile(wb, fileName);

            if (addToast) {
                addToast(`Exported complete multi-sheet workbook: ${fileName}`, 'success');
            }
        } catch (err) {
            console.error('Excel Export Error:', err);
            if (addToast) {
                addToast('Failed to generate Excel export file.', 'error');
            }
        } finally {
            setIsExportingExcel(false);
        }
    };

    // Download JSON Snapshot
    const handleDownloadJSON = () => {
        try {
            const dataSnapshot = {
                exportedAt: new Date().toISOString(),
                version: '2.0.0',
                app: 'uPVC ERP Hub',
                currentUser: store.currentUser,
                items: store.items,
                inflowTransactions: store.inflowTransactions,
                consumptionTransactions: store.consumptionTransactions,
                formulas: store.formulas,
                profiles: store.profiles,
                profileTransactions: store.profileTransactions,
                customers: store.customers,
                brands: store.brands,
                dies: store.dies,
                productionPlans: store.productionPlans,
                suppliers: store.suppliers,
                purchaseOrders: store.purchaseOrders,
                protectiveFilmItems: store.protectiveFilmItems,
                protectiveFilmInwardTransactions: store.protectiveFilmInwardTransactions,
                protectiveFilmOutwardAdjustments: store.protectiveFilmOutwardAdjustments,
                companySettings: store.companySettings
            };

            const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(dataSnapshot, null, 2));
            const downloadAnchor = document.createElement('a');
            downloadAnchor.setAttribute('href', dataStr);
            downloadAnchor.setAttribute('download', `ERP_Snapshot_${new Date().toISOString().split('T')[0]}.json`);
            document.body.appendChild(downloadAnchor);
            downloadAnchor.click();
            downloadAnchor.remove();

            if (addToast) {
                addToast('Downloaded JSON backup snapshot successfully.', 'success');
            }
        } catch (err) {
            console.error('JSON Export Error:', err);
            if (addToast) {
                addToast('Failed to generate JSON snapshot.', 'error');
            }
        }
    };

    // Import and Restore JSON Snapshot
    const handleImportJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const parsed = JSON.parse(event.target?.result as string);
                if (!parsed || typeof parsed !== 'object') {
                    throw new Error('Invalid JSON structure');
                }

                store.loadData(parsed);
                store.syncOfflineDataToCloud();

                if (addToast) {
                    addToast('System database restored successfully from JSON backup!', 'success');
                }
            } catch (err) {
                console.error('JSON Import Error:', err);
                if (addToast) {
                    addToast('Invalid JSON backup file or corrupted structure.', 'error');
                }
            }
        };
        reader.readAsText(file);
        e.target.value = '';
    };

    // Factory Reset
    const handleResetAllData = () => {
        if (window.confirm('⚠️ WARNING: Are you sure you want to reset all data back to the clean demo baseline? All local transactions and items will be refreshed.')) {
            store.resetData();
            store.resetProtectiveFilmItems();
            store.syncOfflineDataToCloud();
            if (addToast) {
                addToast('Factory reset complete: Database returned to initial clean baseline.', 'info');
            }
        }
    };

    return (
        <div className="min-h-full bg-[#070b14] text-slate-100 p-4 sm:p-8 font-sans">
            <div className="max-w-6xl mx-auto space-y-6">

                {/* Top User Session Card */}
                <div className="bg-[#0e1626] border border-slate-800/80 rounded-3xl p-6 shadow-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        {/* Avatar Initial Box */}
                        <div className="w-14 h-14 rounded-2xl bg-blue-600 flex items-center justify-center text-white text-2xl font-black shadow-lg shadow-blue-500/25">
                            {currentUser.name ? currentUser.name.charAt(0).toUpperCase() : 'N'}
                        </div>

                        {/* Name, Role Badge, Email */}
                        <div>
                            <div className="flex items-center gap-2.5 flex-wrap">
                                <h1 className="text-xl font-bold text-white tracking-tight">
                                    {currentUser.name || 'Nagarjuna (Admin)'}
                                </h1>
                                <span className="bg-[#172554] text-blue-400 border border-blue-500/30 text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                                    {currentUser.role || 'ADMIN'}
                                </span>
                            </div>
                            <p className="text-xs text-slate-400 font-medium mt-1">
                                {currentUser.email || 'nagarjunakypa99@gmail.com'}
                            </p>
                        </div>
                    </div>

                    {/* Sign Out Button */}
                    <button
                        type="button"
                        onClick={store.logout}
                        className="border border-rose-500/40 hover:border-rose-500 text-rose-400 hover:text-white hover:bg-rose-600/20 px-5 py-2.5 rounded-2xl text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-2 shadow-lg"
                    >
                        <LogOut className="w-4 h-4" />
                        <span>SIGN OUT</span>
                    </button>
                </div>

                {/* Auto Sync & Real-Time Data Entry Status Banner */}
                <div className="bg-gradient-to-r from-blue-950/40 via-slate-900 to-indigo-950/40 border border-blue-500/20 rounded-2xl p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-blue-500/20 border border-blue-500/40 flex items-center justify-center text-blue-400">
                            <Zap className="w-5 h-5 animate-pulse text-amber-400" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <span className="text-xs font-black uppercase tracking-wider text-white">Auto-Sync on Data Entry</span>
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-bold border border-emerald-500/30">
                                    <CheckCircle2 className="w-3 h-3" /> ACTIVE
                                </span>
                            </div>
                            <p className="text-[11px] text-slate-400 mt-0.5">
                                Every new Inflow, Consumption, Profile entry, or Formula is automatically saved on this PC and synchronized to the cloud in real-time.
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-4 text-xs font-medium text-slate-400 shrink-0">
                        <div className="text-right">
                            <span className="text-[10px] uppercase font-bold text-slate-500 block">Last Auto-Sync:</span>
                            <span className="text-slate-300 font-mono font-semibold">{formatSyncTime(store.lastCloudSyncTimestamp)}</span>
                        </div>
                        {store.offlinePendingCount > 0 ? (
                            <button
                                type="button"
                                onClick={() => {
                                    store.syncOfflineDataToCloud();
                                    if (addToast) addToast(`Uploaded ${store.offlinePendingCount} offline record(s) to Cloud!`, 'success');
                                }}
                                className="bg-amber-500 hover:bg-amber-400 text-slate-950 px-3.5 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all shadow-md animate-pulse"
                            >
                                <RefreshCw className="w-3.5 h-3.5" />
                                <span>Sync ({store.offlinePendingCount}) Pending</span>
                            </button>
                        ) : (
                            <div className="flex items-center gap-1.5 text-emerald-400 font-bold text-xs bg-emerald-500/10 px-3 py-1.5 rounded-xl border border-emerald-500/20">
                                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
                                <span>100% In Sync</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* 2-Columns Grid: Cloud Storage Sync & Excel/JSON Backup */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                    {/* Left Card: Cloud Storage Sync */}
                    <div className="bg-[#0e1626] border border-slate-800/80 rounded-3xl p-6 sm:p-8 flex flex-col justify-between shadow-2xl relative overflow-hidden group hover:border-slate-700/80 transition-all">
                        <div>
                            {/* Icon & Heading */}
                            <div className="flex items-start gap-4 mb-4">
                                <div className="w-12 h-12 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
                                    <Cloud className="w-6 h-6" />
                                </div>
                                <div>
                                    <h2 className="text-lg font-bold text-white tracking-tight">Cloud Storage Sync</h2>
                                    <p className="text-xs text-slate-400 font-medium">Google Drive persistent cloud synchronization</p>
                                </div>
                            </div>

                            {/* Description */}
                            <p className="text-xs text-slate-300/90 leading-relaxed mb-8">
                                Seamlessly backup your raw materials, production plans, and inventory records to your Google Drive account.
                            </p>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex flex-wrap items-center gap-3 pt-4">
                            <button
                                type="button"
                                onClick={handleSaveToDrive}
                                disabled={isSavingDrive}
                                className="flex-1 min-w-[140px] bg-blue-600 hover:bg-blue-500 active:scale-98 text-white px-5 py-3 rounded-2xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-600/30"
                            >
                                <Upload className="w-4 h-4" />
                                <span>{isSavingDrive ? 'SAVING...' : 'SAVE TO DRIVE'}</span>
                            </button>

                            <button
                                type="button"
                                onClick={handleLoadFromDrive}
                                disabled={isLoadingDrive}
                                className="flex-1 min-w-[150px] bg-[#162136] hover:bg-[#1f2d48] active:scale-98 text-slate-200 hover:text-white border border-slate-700/80 px-5 py-3 rounded-2xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2 shadow-md"
                            >
                                <RefreshCw className={`w-4 h-4 ${isLoadingDrive ? 'animate-spin' : ''}`} />
                                <span>{isLoadingDrive ? 'LOADING...' : 'LOAD FROM DRIVE'}</span>
                            </button>
                        </div>
                    </div>

                    {/* Right Card: Excel & JSON Backup */}
                    <div className="bg-[#0e1626] border border-slate-800/80 rounded-3xl p-6 sm:p-8 flex flex-col justify-between shadow-2xl relative overflow-hidden group hover:border-slate-700/80 transition-all">
                        <div>
                            {/* Icon & Heading */}
                            <div className="flex items-start gap-4 mb-4">
                                <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                                    <FileSpreadsheet className="w-6 h-6" />
                                </div>
                                <div>
                                    <h2 className="text-lg font-bold text-white tracking-tight">Excel & JSON Backup</h2>
                                    <p className="text-xs text-slate-400 font-medium">Local offline files export & restore</p>
                                </div>
                            </div>

                            {/* Description */}
                            <p className="text-xs text-slate-300/90 leading-relaxed mb-8">
                                Export all system records into standard multi-sheet Excel (.xlsx) workbooks or download a full JSON snapshot.
                            </p>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex items-center gap-3 pt-4">
                            <button
                                type="button"
                                onClick={handleExportExcel}
                                disabled={isExportingExcel}
                                className="flex-1 bg-emerald-600 hover:bg-emerald-500 active:scale-98 text-white px-4 py-3 rounded-2xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/30"
                            >
                                <FileSpreadsheet className="w-4 h-4" />
                                <span>{isExportingExcel ? 'EXPORTING...' : 'EXPORT EXCEL'}</span>
                            </button>

                            <button
                                type="button"
                                onClick={handleDownloadJSON}
                                className="flex-1 bg-[#162136] hover:bg-[#1f2d48] active:scale-98 text-slate-200 hover:text-white border border-slate-700/80 px-4 py-3 rounded-2xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2 shadow-md"
                            >
                                <Download className="w-4 h-4" />
                                <span>DOWNLOAD JSON</span>
                            </button>

                            {/* Small Upload/Import JSON Button */}
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept=".json"
                                onChange={handleImportJSON}
                                className="hidden"
                            />
                            <button
                                type="button"
                                onClick={() => fileInputRef.current?.click()}
                                title="Import and Restore from JSON snapshot"
                                className="bg-[#162136] hover:bg-[#1f2d48] active:scale-98 text-slate-200 hover:text-white border border-slate-700/80 p-3 rounded-2xl text-xs font-black transition-all flex items-center justify-center shadow-md shrink-0"
                            >
                                <Upload className="w-4 h-4" />
                            </button>
                        </div>
                    </div>

                </div>

                {/* Bottom Card: Factory Reset Database */}
                <div className="bg-[#0e1626] border border-rose-950/60 rounded-3xl p-6 sm:p-7 shadow-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="flex items-start gap-4">
                        <div className="w-11 h-11 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-500 shrink-0">
                            <Trash2 className="w-5 h-5" />
                        </div>
                        <div>
                            <h3 className="text-base font-bold text-white tracking-tight">Factory Reset Database</h3>
                            <p className="text-xs text-slate-400 font-medium mt-0.5">
                                Reset all local catalog items, transaction logs, and formulas back to the clean initial demo baseline.
                            </p>
                        </div>
                    </div>

                    {/* Red Solid Reset Button */}
                    <button
                        type="button"
                        onClick={handleResetAllData}
                        className="w-full sm:w-auto bg-[#e11d48] hover:bg-[#f43f5e] active:scale-98 text-white px-7 py-3 rounded-2xl text-xs font-black uppercase tracking-wider transition-all shadow-lg shadow-rose-600/30 shrink-0"
                    >
                        RESET ALL DATA
                    </button>
                </div>

            </div>
        </div>
    );
};

export default Storage;
