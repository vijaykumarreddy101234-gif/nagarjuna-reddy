import React, { useState, useMemo, useRef, useEffect } from 'react';
import type { Item, InflowTransaction, ConsumptionTransaction, Profile, ProfileTransaction } from '../types';
import StockTable from '../components/StockTable';
import StockMovementTable from '../components/StockMovementTable';
import { SearchIcon, ChevronDownIcon } from '../components/Icon';
import EditItemModal from '../components/EditItemModal';
import { useStore } from '../store/useStore';
import { Layers, Warehouse, RefreshCw, AlertCircle, Plus, Search } from 'lucide-react';

// FIX: Declare XLSX to resolve compilation error for Excel export.
declare const XLSX: any;
declare const jspdf: any;

interface StockProps {
    items: Item[];
    stockLevels: Record<string, number>;
    transactions: InflowTransaction[];
    consumptionTransactions: ConsumptionTransaction[];
    deleteItem: (itemId: string) => void;
    updateItem: (item: Item) => void;
    totalBatches: number;
    addToast: (message: string, type: any) => void;
}

type StockTab = 'current' | 'movement';
type StockSegment = 'raw' | 'profiles';

const Stock = ({ items, stockLevels, transactions, consumptionTransactions, deleteItem, updateItem, totalBatches, addToast }: StockProps) => {
    const store = useStore();
    const [segment, setSegment] = useState<StockSegment>('raw');
    const [activeTab, setActiveTab] = useState<StockTab>('current');
    const [editingItem, setEditingItem] = useState<Item | null>(null);
    const [isDownloadMenuOpen, setIsDownloadMenuOpen] = useState(false);
    const downloadMenuRef = useRef<HTMLDivElement>(null);

    // Profile State & Actions from Store
    const profiles = store.profiles;
    const profileTransactions = store.profileTransactions;
    const brands = store.brands || [];
    const updateProfile = store.updateProfile;

    const computedTotalBatches = useMemo(() => {
        return new Set(consumptionTransactions.filter(tx => !tx.deletedAt && tx.refNo).map(tx => tx.refNo)).size;
    }, [consumptionTransactions]);

    const tabs: { id: StockTab; label: string }[] = [
        { id: 'current', label: 'Current Stock' },
        { id: 'movement', label: 'Stock Movement' },
    ];

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (downloadMenuRef.current && !downloadMenuRef.current.contains(event.target as Node)) {
                setIsDownloadMenuOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [downloadMenuRef]);

    // Calculate live profile stock values
    const processedProfiles = useMemo(() => {
        return profiles.filter(p => !p.deletedAt).map(p => {
            const relevantTxns = profileTransactions.filter(t => t.profileId === p.id && !t.deletedAt);
            const production = relevantTxns.filter(t => t.type === 'PRODUCTION' || t.type === 'RETURN').reduce((sum, t) => sum + Number(t.quantity || 0), 0);
            const dispatch = relevantTxns.filter(t => t.type === 'DISPATCH').reduce((sum, t) => sum + Number(t.quantity || 0), 0);
            const scrap = relevantTxns.filter(t => t.type === 'SCRAP').reduce((sum, t) => {
                 const qty = Number(t.quantity || 0);
                 if (t.uom === 'Kgs' && p.weight && p.weight > 0) return sum + (qty / p.weight);
                 return sum + qty;
            }, 0);
            const reserved = relevantTxns.filter(t => t.type === 'QUOTATION' && t.status === 'PENDING').reduce((sum, t) => sum + Number(t.quantity || 0), 0);
            const currentStock = (Number(p.openingStock) || Number((p as any).initialStock) || 0) + (production || 0) - (dispatch || 0) - (scrap || 0);
            const reorderPoint = (p.reorderPoint !== undefined && p.reorderPoint !== null && p.reorderPoint > 0) ? p.reorderPoint : 50;
            return { 
                ...p, 
                reorderPoint,
                currentStock: isNaN(currentStock) ? 0 : currentStock, 
                reservedStock: isNaN(reserved) ? 0 : reserved,
                availableStock: isNaN(currentStock - reserved) ? 0 : (currentStock - reserved),
                movement: {
                    production: isNaN(production) ? 0 : production,
                    dispatch: isNaN(dispatch) ? 0 : dispatch,
                    scrap: isNaN(scrap) ? 0 : scrap
                }
            };
        });
    }, [profiles, profileTransactions]);

    const handleExportPdf = () => {
        const { jsPDF } = jspdf;
        const doc = new jsPDF({ orientation: 'landscape' });
    
        const activeTableId = segment === 'raw' ? `${activeTab}-stock-view` : `${activeTab}-profile-stock-view`;
        const tableContainer = document.getElementById(activeTableId);
        if (!tableContainer) return;
    
        const tableElement = tableContainer.querySelector('table');
        if (!tableElement) return;
    
        const reportTitle = `${segment === 'raw' ? 'Raw Materials' : 'Profiles'} - ${tabs.find(t => t.id === activeTab)?.label || 'Stock Report'}`;
        const date = new Date().toLocaleDateString();
        doc.text(`${reportTitle} - Generated on: ${date}`, 14, 15);
    
        const clonedTable = tableElement.cloneNode(true) as HTMLTableElement;
        const noPrintColumns = clonedTable.querySelectorAll('th:last-child[class*="no-print"], td:last-child[class*="no-print"]');
        
        // Strip off action columns
        Array.from(clonedTable.rows).forEach(row => {
            if (row.cells.length > 0) {
                row.deleteCell(row.cells.length - 1);
            }
        });
    
        doc.autoTable({
            html: clonedTable,
            startY: 20,
            theme: 'grid',
            styles: { fontSize: 8 },
            headStyles: { fillColor: [55, 74, 103] },
        });
    
        doc.save(`${reportTitle.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`);
        setIsDownloadMenuOpen(false);
    };

    const handleExportExcel = () => {
        const activeTableId = segment === 'raw' ? `${activeTab}-stock-view` : `${activeTab}-profile-stock-view`;
        const tableContainer = document.getElementById(activeTableId);
        if (!tableContainer) {
            console.error('Printable element not found:', activeTableId);
            return;
        }
        const tableElement = tableContainer.querySelector('table');
        if (!tableElement) {
            console.error('Table element not found in:', activeTableId);
            return;
        }
        
        const clonedTable = tableElement.cloneNode(true) as HTMLTableElement;

        // Strip last column
        Array.from(clonedTable.rows).forEach(row => {
            if (row.cells.length > 0) {
                row.deleteCell(row.cells.length - 1);
            }
        });

        const wb = XLSX.utils.table_to_book(clonedTable, { sheet: "Sheet1" });
        const date = new Date().toISOString().split('T')[0];
        const reportTitle = `${segment === 'raw' ? 'Raw_Materials' : 'Profiles'}_${tabs.find(t => t.id === activeTab)?.label?.replace(/\s+/g, '_') || 'Stock_Report'}`;
        XLSX.writeFile(wb, `${reportTitle}_${date}.xlsx`);
        setIsDownloadMenuOpen(false);
    };

    return (
        <>
            <div className="space-y-6">
                {/* Header Banner */}
                <div className="flex justify-between items-center flex-wrap gap-4 no-print bg-slate-50 dark:bg-slate-900/40 p-6 rounded-3xl border border-slate-100 dark:border-slate-800">
                    <div>
                        <h2 className="text-2xl font-display font-black text-slate-900 dark:text-white uppercase tracking-tight italic">Stock & Ledger</h2>
                        <p className="text-xs font-semibold text-slate-500">Unified live inventory levels and audit trails across Raw Materials & Profiles.</p>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="px-5 py-2.5 bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-100/50 dark:border-indigo-900/50 rounded-2xl text-center">
                            <h3 className="text-[10px] font-black text-indigo-400 uppercase tracking-widest leading-none mb-1">Total batches</h3>
                            <p className="text-xl font-display font-black text-indigo-600 dark:text-indigo-400">{computedTotalBatches}</p>
                        </div>
                        <div className="relative" ref={downloadMenuRef}>
                            <button
                                onClick={() => setIsDownloadMenuOpen(prev => !prev)}
                                className="bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 px-5 py-3 rounded-2xl text-xs font-black uppercase tracking-wider transition-all duration-200 flex items-center gap-2 shadow-lg cursor-pointer"
                            >
                                <span>Export Report</span>
                                <ChevronDownIcon className={`w-4 h-4 transition-transform ${isDownloadMenuOpen ? 'rotate-180' : ''}`} />
                            </button>
                            {isDownloadMenuOpen && (
                                <div className="absolute right-0 mt-3 w-48 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl py-2 z-30 border border-slate-100 dark:border-slate-800 overflow-hidden">
                                    <button onClick={handleExportPdf} className="block w-full text-left px-5 py-3 text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                                        Download as PDF
                                    </button>
                                    <button onClick={handleExportExcel} className="block w-full text-left px-5 py-3 text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                                        Download as Excel
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Primary Segment Selection & Tab Group Selector */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-2">
                    {/* Raw Materials vs Profiles Segment Toggle */}
                    <div className="inline-flex rounded-2xl bg-slate-200/60 dark:bg-slate-900 p-1">
                        <button
                            onClick={() => setSegment('raw')}
                            className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 ${
                                segment === 'raw'
                                    ? 'bg-blue-600 text-white shadow-md shadow-blue-500/10'
                                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                            }`}
                        >
                            <Warehouse className="w-3.5 h-3.5" />
                            <span>RM Section (Raw Materials)</span>
                        </button>
                        <button
                            onClick={() => setSegment('profiles')}
                            className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 ${
                                segment === 'profiles'
                                    ? 'bg-blue-600 text-white shadow-md shadow-blue-500/10'
                                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                            }`}
                        >
                            <Layers className="w-3.5 h-3.5" />
                            <span>Profiles & Stock</span>
                        </button>
                    </div>

                    {/* Sub tabs: Current Stock vs Movement */}
                    <div className="p-1 bg-slate-100 dark:bg-slate-900/80 rounded-2xl border border-slate-200 dark:border-slate-800/80 shadow-inner flex gap-1 w-fit no-print">
                        {tabs.map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`px-5 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-200 ${
                                    activeTab === tab.id
                                        ? 'bg-white dark:bg-slate-800 text-primary-600 dark:text-primary-400 shadow-sm'
                                        : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
                                }`}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Main Content Area */}
                <div>
                    {segment === 'raw' ? (
                        <div>
                            <div id="current-stock-view" style={{ display: activeTab === 'current' ? 'block' : 'none' }}>
                                <CurrentStockView 
                                    items={items} 
                                    stockLevels={stockLevels} 
                                    inflowTransactions={transactions}
                                    consumptionTransactions={consumptionTransactions}
                                    deleteItem={deleteItem} 
                                    onEditItem={setEditingItem} 
                                />
                            </div>
                            <div id="movement-stock-view" style={{ display: activeTab === 'movement' ? 'block' : 'none' }}>
                                <StockMovementTable 
                                    items={items} 
                                    inflow={transactions} 
                                    consumption={consumptionTransactions} 
                                />
                            </div>
                        </div>
                    ) : (
                        <div>
                            <div id="current-profile-stock-view" style={{ display: activeTab === 'current' ? 'block' : 'none' }}>
                                <CurrentProfilesStockView 
                                    profiles={processedProfiles} 
                                    brands={brands}
                                    updateProfile={updateProfile}
                                />
                            </div>
                            <div id="movement-profile-stock-view" style={{ display: activeTab === 'movement' ? 'block' : 'none' }}>
                                <ProfilesStockMovementTable 
                                    profiles={profiles} 
                                    transactions={profileTransactions} 
                                />
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {editingItem && (
                <EditItemModal
                    isOpen={!!editingItem}
                    onClose={() => setEditingItem(null)}
                    item={editingItem}
                    onUpdate={updateItem}
                    addToast={addToast}
                />
            )}
        </>
    );
};

// --- SUB-COMPONENTS FOR RAW MATERIALS STOCK ---

interface CurrentStockViewProps {
    items: Item[];
    stockLevels: Record<string, number>;
    inflowTransactions: InflowTransaction[];
    consumptionTransactions: ConsumptionTransaction[];
    deleteItem: (itemId: string) => void;
    onEditItem: (item: Item) => void;
}

const CurrentStockView = ({ items, stockLevels, inflowTransactions, consumptionTransactions, deleteItem, onEditItem }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [showLowStockOnly, setShowLowStockOnly] = useState(false);

    const combinedItemData = useMemo(() => {
        return items.map(item => {
            const totalInflow = inflowTransactions
                .filter(t => t.itemId === item.id && !t.deletedAt)
                .reduce((sum, t) => sum + t.quantity, 0);

            const totalOutflow = consumptionTransactions
                .filter(t => t.itemId === item.id && !t.deletedAt)
                .reduce((sum, t) => sum + t.quantity, 0);

            return {
                ...item,
                currentStock: stockLevels[item.id] ?? 0,
                totalInflow: totalInflow,
                totalOutflow: totalOutflow
            };
        }).sort((a, b) => a.name.localeCompare(b.name));
    }, [items, stockLevels, inflowTransactions, consumptionTransactions]);

    const filteredItems = useMemo(() => {
        let filtered = combinedItemData;

        if (showLowStockOnly) {
            filtered = filtered.filter(item => item.currentStock < item.reorderPoint);
        }

        if (!searchTerm) return filtered;
        const lowercasedFilter = searchTerm.toLowerCase();
        return filtered.filter(item =>
            item.name.toLowerCase().includes(lowercasedFilter) ||
            item.sku.toLowerCase().includes(lowercasedFilter)
        );
    }, [combinedItemData, searchTerm, showLowStockOnly]);

    const searchInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === '/' && document.activeElement !== searchInputRef.current) {
                e.preventDefault();
                searchInputRef.current?.focus();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    return (
        <div className="space-y-6">
             <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 no-print bg-slate-50 dark:bg-slate-900/10 p-4 rounded-2xl border border-slate-200/50 dark:border-slate-800/50">
                  <button
                    onClick={() => setShowLowStockOnly(prev => !prev)}
                    className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all border ${
                        showLowStockOnly 
                            ? 'bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 border-red-200 dark:border-red-800/50 shadow-md shadow-red-500/5' 
                            : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800'
                    }`}
                  >
                    <span className={`w-2.5 h-2.5 rounded-full ${showLowStockOnly ? 'bg-red-500 animate-pulse' : 'bg-slate-300 dark:bg-slate-700'}`} />
                    <span>Low Stock Only</span>
                  </button>
                <div className="relative flex-1 sm:max-w-md">
                    <input
                        ref={searchInputRef}
                        type="text"
                        placeholder="Search items by name or SKU..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-11 pr-14 py-3 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-primary-500 dark:focus:ring-primary-400 focus:border-transparent transition-all placeholder:text-slate-400"
                        aria-label="Search items"
                    />
                    <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none px-2 py-1 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-[9px] font-mono font-black text-slate-400">
                        /
                    </div>
                </div>
            </div>
            <StockTable items={filteredItems} deleteItem={deleteItem} onEditItem={onEditItem} />
        </div>
    );
};

// --- SUB-COMPONENTS FOR UPVC PROFILES STOCK ---

interface CurrentProfilesStockViewProps {
    profiles: any[];
    brands: string[];
    updateProfile: (profile: Profile) => void;
}

const CurrentProfilesStockView = ({ profiles, brands, updateProfile }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [brandFilter, setBrandFilter] = useState('All');
    const [showLowStockOnly, setShowLowStockOnly] = useState(false);

    const filteredProfiles = useMemo(() => {
        return profiles.filter(p => {
            const matchesSearch = !searchTerm || 
                p.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
                p.name.toLowerCase().includes(searchTerm.toLowerCase());
            
            const matchesBrand = brandFilter === 'All' || p.brand === brandFilter;
            const matchesLowStock = !showLowStockOnly || p.currentStock < (p.reorderPoint || 0);

            return matchesSearch && matchesBrand && matchesLowStock;
        });
    }, [profiles, searchTerm, brandFilter, showLowStockOnly]);

    return (
        <div className="space-y-6">
            {/* Filter Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 no-print bg-slate-50 dark:bg-slate-900/10 p-4 rounded-2xl border border-slate-200/50 dark:border-slate-800/50">
                <div className="flex items-center gap-3 flex-wrap">
                    <button
                        onClick={() => setShowLowStockOnly(prev => !prev)}
                        className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all border ${
                            showLowStockOnly 
                                ? 'bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 border-red-200 dark:border-red-800/50 shadow-md shadow-red-500/5' 
                                : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800'
                        }`}
                    >
                        <span className={`w-2.5 h-2.5 rounded-full ${showLowStockOnly ? 'bg-red-500 animate-pulse' : 'bg-slate-300 dark:bg-slate-700'}`} />
                        <span>Low Stock Only</span>
                    </button>

                    <select
                        value={brandFilter}
                        onChange={(e) => setBrandFilter(e.target.value)}
                        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-black uppercase tracking-wider py-2.5 px-4 outline-none focus:ring-2 focus:ring-blue-500 transition-all text-slate-600 dark:text-slate-400"
                    >
                        <option value="All">All Brands</option>
                        {brands.map(b => <option key={b} value={b}>{b}</option>)}
                    </select>
                </div>

                <div className="relative flex-1 sm:max-w-md">
                    <input
                        type="text"
                        placeholder="Search profiles by SKU or Name..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-11 py-3 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-primary-500 dark:focus:ring-primary-400 focus:border-transparent transition-all placeholder:text-slate-400"
                    />
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                </div>
            </div>

            {/* Custom Profiles Stock Table */}
            <div className="overflow-x-auto shadow-xl rounded-xl">
                <table className="w-full text-xs text-center border-collapse bg-white dark:bg-gray-800">
                    <thead className="bg-gray-100 dark:bg-gray-900 uppercase font-black text-[10px] text-slate-700 dark:text-slate-300 tracking-wider">
                        <tr className="border-b dark:border-gray-700">
                            <th className="p-3 text-left">SKU / Code</th>
                            <th className="p-3 text-left">Description</th>
                            <th className="p-3">Brand</th>
                            <th className="p-3">UOM</th>
                            <th className="p-3">L/Pkt</th>
                            <th className="p-3">Length</th>
                            <th className="p-3">Weight</th>
                            <th className="p-3 text-red-600 dark:text-red-400">Reorder Pt</th>
                            <th className="p-3 text-right bg-slate-50/50 dark:bg-slate-800/20">Opening Bal</th>
                            <th className="p-3 text-emerald-600 dark:text-emerald-400 bg-emerald-50/20 dark:bg-emerald-950/10">Inflow (+)</th>
                            <th className="p-3 text-rose-600 dark:text-rose-400 bg-rose-50/20 dark:bg-rose-950/10">Outflow (-)</th>
                            <th className="p-3 text-right text-primary-600 dark:text-primary-400 bg-blue-50/30 dark:bg-slate-800/40 font-black">Closing Bal</th>
                            <th className="p-3">Status</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y dark:divide-gray-700">
                        {filteredProfiles.map((p, index) => {
                            const isLow = p.currentStock < (p.reorderPoint || 0);
                            const openingBal = Number(p.openingStock) || Number(p.initialStock) || 0;
                            const inflow = p.movement?.production || 0;
                            const outflow = (p.movement?.dispatch || 0) + (p.movement?.scrap || 0);

                            return (
                                <tr key={`${p.id || index}_${index}`} className={`hover:bg-slate-50/50 dark:hover:bg-slate-700/30 transition-all ${isLow ? 'bg-red-50/25 dark:bg-red-950/10' : ''}`}>
                                    <td className="p-3 text-left font-mono font-black text-slate-900 dark:text-white">{p.sku}</td>
                                    <td className="p-3 text-left font-semibold text-slate-800 dark:text-slate-200">{p.name}</td>
                                    <td className="p-3 font-bold text-slate-500 uppercase">{p.brand}</td>
                                    <td className="p-3 font-mono">{p.uom}</td>
                                    <td className="p-3 font-mono">{p.piecesPerPacket || '-'}</td>
                                    <td className="p-3 font-mono">{p.length ? `${p.length}m` : '-'}</td>
                                    <td className="p-3 font-mono">{p.weight ? `${p.weight}kg` : '-'}</td>
                                    <td className="p-3 text-red-600 font-bold">
                                        <input 
                                            type="number"
                                            defaultValue={p.reorderPoint || 0}
                                            onBlur={(e) => {
                                                const val = parseInt(e.target.value);
                                                if (!isNaN(val) && val !== p.reorderPoint) {
                                                    updateProfile({ ...p, reorderPoint: val });
                                                }
                                            }}
                                            className="w-16 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded px-1.5 py-0.5 text-center focus:ring-1 focus:ring-blue-500 font-bold focus:outline-none text-xs"
                                        />
                                    </td>
                                    <td className="p-3 text-right font-mono font-bold text-gray-500 bg-slate-50/30 dark:bg-slate-800/10">
                                        {openingBal.toLocaleString()}
                                    </td>
                                    <td className="p-3 text-emerald-600 font-bold font-mono bg-emerald-50/10 dark:bg-emerald-950/5">
                                        {inflow.toLocaleString()}
                                    </td>
                                    <td className="p-3 text-rose-600 font-bold font-mono bg-rose-50/10 dark:bg-rose-950/5">
                                        {outflow.toLocaleString()}
                                    </td>
                                    <td className={`p-3 text-right font-black font-mono text-sm bg-blue-50/10 dark:bg-slate-850/20 ${isLow ? 'text-red-500 underline decoration-double' : 'text-slate-900 dark:text-white'}`}>
                                        {Number(p.currentStock || 0).toLocaleString()}
                                    </td>
                                    <td className="p-3">
                                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${
                                            isLow ? 'bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400' : 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400'
                                        }`}>
                                            {isLow ? 'LOW STOCK' : 'IN STOCK'}
                                        </span>
                                    </td>
                                </tr>
                            );
                        })}
                        {filteredProfiles.length === 0 && (
                            <tr>
                                <td colSpan={13} className="p-8 text-center text-gray-500 font-bold uppercase tracking-wider text-xs">No profile records found.</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

// --- PROFILES STOCK MOVEMENT TABLE ---

interface ProfilesStockMovementTableProps {
    profiles: Profile[];
    transactions: ProfileTransaction[];
}

const ProfilesStockMovementTable = ({ profiles, transactions }) => {
    const [searchTerm, setSearchTerm] = useState('');

    const profileMap = useMemo(() => new Map(profiles.map(p => [p.id, p])), [profiles]);

    const filteredMovements = useMemo(() => {
        const list = transactions
            .filter(t => !t.deletedAt)
            .map(t => {
                const profile = profileMap.get(t.profileId);
                const isPositive = t.type === 'PRODUCTION' || t.type === 'RETURN';
                return {
                    ...t,
                    profile,
                    isPositive
                };
            })
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

        if (!searchTerm) return list;
        const query = searchTerm.toLowerCase();
        return list.filter(m => 
            m.refNo?.toLowerCase().includes(query) ||
            m.profile?.name?.toLowerCase().includes(query) ||
            m.profile?.sku?.toLowerCase().includes(query) ||
            m.brand?.toLowerCase().includes(query)
        );
    }, [transactions, profileMap, searchTerm]);

    return (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow border border-gray-100 dark:border-gray-700 overflow-hidden">
            <div className="p-4 flex justify-end no-print bg-slate-50 dark:bg-slate-900/10">
                <div className="relative w-full max-w-md">
                    <input
                        type="text"
                        placeholder="Search profile code, description, brand, reference..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 rounded-xl focus:ring-blue-500 focus:border-blue-500 text-sm"
                    />
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                </div>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full text-xs text-left text-gray-600 dark:text-gray-400">
                    <thead className="text-[10px] text-gray-700 dark:text-gray-300 uppercase bg-gray-50 dark:bg-gray-700 tracking-wider font-black">
                        <tr>
                            <th className="px-6 py-4">Date</th>
                            <th className="px-6 py-4">Type</th>
                            <th className="px-6 py-4">Profile Description</th>
                            <th className="px-6 py-4">Brand</th>
                            <th className="px-6 py-4">Reference</th>
                            <th className="px-6 py-4 text-right">Qty Change</th>
                            <th className="px-6 py-4">Details</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y dark:divide-gray-700">
                        {filteredMovements.map((m, index) => {
                            return (
                                <tr key={`${m.id || index}_${index}`} className="bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                    <td className="px-6 py-4 whitespace-nowrap font-mono">{new Date(m.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                                    <td className="px-6 py-4">
                                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${
                                            m.isPositive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                                        }`}>
                                            {m.type}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 font-semibold text-slate-900 dark:text-white">
                                        {m.profile?.name || 'Unknown Profile'}
                                        <div className="text-[10px] text-gray-400 font-mono italic">{m.profile?.sku}</div>
                                    </td>
                                    <td className="px-6 py-4 font-bold text-gray-500 uppercase">{m.brand || m.profile?.brand || 'GENERAL'}</td>
                                    <td className="px-6 py-4 font-mono font-bold">{m.refNo}</td>
                                    <td className={`px-6 py-4 text-right font-black font-mono text-sm ${m.isPositive ? 'text-green-600' : 'text-red-600'}`}>
                                        {m.isPositive ? '+' : '-'}{Number(m.quantity || 0).toLocaleString()}
                                    </td>
                                    <td className="px-6 py-4 text-gray-500 font-medium">
                                        {m.customer ? `Customer: ${m.customer}` : (m.machine ? `Machine ${m.machine}` : 'Stock Adjustment')}
                                    </td>
                                </tr>
                            );
                        })}
                        {filteredMovements.length === 0 && (
                            <tr>
                                <td colSpan={7} className="px-6 py-8 text-center text-gray-400 font-semibold uppercase tracking-wider">No profile transactions recorded.</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default Stock;
