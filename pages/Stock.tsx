import React, { useState, useMemo, useRef, useEffect } from 'react';
import type { Item, InflowTransaction, ConsumptionTransaction, User } from '../types';
import StockTable from '../components/StockTable';
import StockMovementTable from '../components/StockMovementTable';
import { SearchIcon, ChevronDownIcon } from '../components/Icon';
import EditItemModal from '../components/EditItemModal';

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
}

type StockTab = 'current' | 'movement';

const Stock: React.FC<StockProps> = ({ items, stockLevels, transactions, consumptionTransactions, deleteItem, updateItem, totalBatches }) => {
    const [activeTab, setActiveTab] = useState<StockTab>('current');
    const [editingItem, setEditingItem] = useState<Item | null>(null);
    const [isDownloadMenuOpen, setIsDownloadMenuOpen] = useState(false);
    const downloadMenuRef = useRef<HTMLDivElement>(null);
    
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

    const handleExportPdf = () => {
        const { jsPDF } = jspdf;
        const doc = new jsPDF({ orientation: 'landscape' });
    
        const activeTableId = `${activeTab}-stock-view`;
        const tableContainer = document.getElementById(activeTableId);
        if (!tableContainer) return;
    
        const tableElement = tableContainer.querySelector('table');
        if (!tableElement) return;
    
        const reportTitle = tabs.find(t => t.id === activeTab)?.label || 'Stock Report';
        const date = new Date().toLocaleDateString();
        doc.text(`${reportTitle} - Generated on: ${date}`, 14, 15);
    
        const clonedTable = tableElement.cloneNode(true) as HTMLTableElement;
        const noPrintColumn = clonedTable.querySelector('th:last-child[class*="no-print"]');
        if (noPrintColumn) {
            const noPrintColumnIndex = Array.from(noPrintColumn.parentElement!.children).indexOf(noPrintColumn);
            Array.from(clonedTable.rows).forEach(row => {
                row.deleteCell(noPrintColumnIndex);
            });
        }
    
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
        const activeTableId = `${activeTab}-stock-view`;
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

        const headers = Array.from(clonedTable.querySelectorAll('thead th'));
        const noPrintColumnIndices = headers
            .map((th, index) => th.classList.contains('no-print') ? index : -1)
            .filter(index => index !== -1);
        
        if (noPrintColumnIndices.length > 0) {
            Array.from(clonedTable.rows).forEach(row => {
                for (let i = noPrintColumnIndices.length - 1; i >= 0; i--) {
                    if (row.cells[noPrintColumnIndices[i]]) {
                        row.deleteCell(noPrintColumnIndices[i]);
                    }
                }
            });
        }

        const wb = XLSX.utils.table_to_book(clonedTable, { sheet: "Sheet1" });
        const date = new Date().toISOString().split('T')[0];
        const reportTitle = tabs.find(t => t.id === activeTab)?.label?.replace(/\s+/g, '_') || 'Stock_Report';
        XLSX.writeFile(wb, `${reportTitle}_${date}.xlsx`);
        setIsDownloadMenuOpen(false);
    };

    return (
        <>
            <div className="space-y-6">
                <div className="flex justify-between items-center flex-wrap gap-4 no-print bg-slate-50 dark:bg-slate-900/40 p-6 rounded-3xl border border-slate-100 dark:border-slate-800">
                    <div>
                        <h2 className="text-2xl font-display font-black text-slate-900 dark:text-white uppercase tracking-tight italic">Stock & Ledger</h2>
                        <p className="text-xs font-semibold text-slate-500">Live inventory levels and audit trails.</p>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="px-5 py-2.5 bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-100/50 dark:border-indigo-900/50 rounded-2xl text-center">
                            <h3 className="text-[10px] font-black text-indigo-400 uppercase tracking-widest leading-none mb-1">Total batches</h3>
                            <p className="text-xl font-display font-black text-indigo-600 dark:text-indigo-400">{computedTotalBatches}</p>
                        </div>
                        <div className="relative" ref={downloadMenuRef}>
                            <button
                                onClick={() => setIsDownloadMenuOpen(prev => !prev)}
                                className="bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 px-5 py-3 rounded-2xl text-xs font-black uppercase tracking-wider transition-all duration-200 flex items-center gap-2 shadow-lg"
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

                <div className="p-1 bg-slate-100 dark:bg-slate-900/80 rounded-2xl border border-slate-200 dark:border-slate-800/80 shadow-inner flex gap-1 w-fit no-print">
                    {tabs.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-200 ${
                                activeTab === tab.id
                                    ? 'bg-white dark:bg-slate-800 text-primary-600 dark:text-primary-400 shadow-sm'
                                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
                            }`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>
                
                <div>
                    <div id="current-stock-view" style={{ display: activeTab === 'current' ? 'block' : 'none' }}>
                        <CurrentStockView 
                            items={items} 
                            stockLevels={stockLevels} 
                            inflowTransactions={transactions}
                            deleteItem={deleteItem} 
                            onEditItem={setEditingItem} 
                        />
                    </div>
                    <div id="movement-stock-view" style={{ display: activeTab === 'movement' ? 'block' : 'none' }}><StockMovementTable items={items} inflow={transactions} consumption={consumptionTransactions} /></div>
                </div>
            </div>
            {editingItem && (
                <EditItemModal
                    isOpen={!!editingItem}
                    onClose={() => setEditingItem(null)}
                    item={editingItem}
                    onUpdate={updateItem}
                />
            )}
        </>
    );
};

interface CurrentStockViewProps {
    items: Item[];
    stockLevels: Record<string, number>;
    inflowTransactions: InflowTransaction[];
    deleteItem: (itemId: string) => void;
    onEditItem: (item: Item) => void;
}

const CurrentStockView: React.FC<CurrentStockViewProps> = ({ items, stockLevels, inflowTransactions, deleteItem, onEditItem }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [showLowStockOnly, setShowLowStockOnly] = useState(false);

    const combinedItemData = useMemo(() => {
        return items.map(item => {
            // Calculate Total Inflow: Sum of all quantities for this item in inflow transactions
            const totalInflow = inflowTransactions
                .filter(t => t.itemId === item.id)
                .reduce((sum, t) => sum + t.quantity, 0);

            return {
                ...item,
                currentStock: stockLevels[item.id] ?? 0,
                totalInflow: totalInflow
            };
        }).sort((a, b) => a.name.localeCompare(b.name));
    }, [items, stockLevels, inflowTransactions]);

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
    )
}

export default Stock;