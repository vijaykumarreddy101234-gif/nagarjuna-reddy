import React, { useState, useEffect, useMemo, useRef } from 'react';
import { ChevronDown, Download } from 'lucide-react';
import type { Item, InflowTransaction, ToastMessage, User } from '../types';
import ItemDetails from '../components/ItemDetails';
import CreateInflowModal from '../components/CreateInflowModal';
import EditInflowModal from '../components/EditInflowModal';
import { useStore } from '../store/useStore';

declare const XLSX: any;
declare const jspdf: any;

interface InflowProps {
    items: Item[];
    transactions: InflowTransaction[];
    addTransaction: (tx: Omit<InflowTransaction, 'id' | 'createdAt' | 'totalCost'>) => void;
    createItemAndInflow: (itemData: Omit<Item, 'id' | 'createdAt'>, txData: Omit<InflowTransaction, 'id' | 'createdAt' | 'totalCost' | 'itemId'>) => void;
    deleteTransaction: (transactionId: string) => void;
    updateTransaction: (tx: InflowTransaction) => void;
    addToast: (message: string, type: ToastMessage['type']) => void;
    pageFilters?: any;
    clearPageFilters?: () => void;
}

const Inflow: React.FC<InflowProps> = ({ items, transactions, addTransaction, createItemAndInflow, deleteTransaction, updateTransaction, addToast, pageFilters, clearPageFilters }) => {
    const savedFilters = useStore(state => state.uiState.inflowFilters);
    const saveFiltersAction = useStore(state => state.setInflowFilters);

    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [editingTransaction, setEditingTransaction] = useState<InflowTransaction | null>(null);
    const [filters, setFilters] = useState(savedFilters);
    const [isDownloadMenuOpen, setIsDownloadMenuOpen] = useState(false);
    const downloadMenuRef = useRef<HTMLDivElement>(null);

    const canCreate = true; // All permissions enabled

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
    }, []);

    const handleExportExcel = () => {
        try {
            const headers = ['Date', 'Reference No', 'Item SKU', 'Item Name', 'Supplier', 'Quantity Received', 'Unit Cost (INR)', 'Total Cost (INR)', 'Warehouse'];
            const rows = filteredTransactions.map(tx => {
                const item = items.find(i => i.id === tx.itemId);
                const totalCost = tx.totalCost || (tx.quantity * (tx.unitCost || 0));
                return [
                    tx.txnDate || tx.createdAt.slice(0, 10),
                    tx.refNo || 'N/A',
                    item?.sku || 'N/A',
                    item?.name || 'N/A',
                    tx.supplier || 'Local/Cash',
                    tx.quantity || 0,
                    tx.unitCost || 0,
                    totalCost,
                    tx.warehouseId || 'Main Store'
                ];
            });

            if (rows.length === 0) {
                addToast('No records available to export.', 'error');
                return;
            }

            const wb = XLSX.utils.book_new();
            const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
            XLSX.utils.book_append_sheet(wb, ws, 'Inflow History');
            
            const dateStr = new Date().toISOString().split('T')[0];
            XLSX.writeFile(wb, `Inflow_Transactions_${dateStr}.xlsx`);
            addToast('Successfully downloaded Inflow Excel sheet!', 'success');
            setIsDownloadMenuOpen(false);
        } catch (error) {
            console.error('Excel Export Error:', error);
            addToast('Failed to generate Excel sheet.', 'error');
        }
    };

    const handleExportPdf = () => {
        try {
            const headers = ['Date', 'Reference No', 'Item SKU', 'Item Name', 'Supplier', 'Qty', 'Unit Cost', 'Total Cost', 'Warehouse'];
            const rows = filteredTransactions.map(tx => {
                const item = items.find(i => i.id === tx.itemId);
                const totalCost = tx.totalCost || (tx.quantity * (tx.unitCost || 0));
                return [
                    tx.txnDate || tx.createdAt.slice(0, 10),
                    tx.refNo || 'N/A',
                    item?.sku || 'N/A',
                    item?.name || 'N/A',
                    tx.supplier || 'Local/Cash',
                    tx.quantity || 0,
                    tx.unitCost || 0,
                    totalCost,
                    tx.warehouseId || 'Main Store'
                ];
            });

            if (rows.length === 0) {
                addToast('No records available to export.', 'error');
                return;
            }

            const { jsPDF } = jspdf;
            const doc = new jsPDF({ orientation: 'landscape' });
            
            const generatedDate = new Date().toLocaleDateString();
            doc.text(`Inflow History - ERP Reports`, 14, 15);
            doc.setFontSize(10);
            doc.text(`Generated on: ${generatedDate} | Record Count: ${rows.length}`, 14, 20);

            doc.autoTable({
                head: [headers],
                body: rows,
                startY: 24,
                theme: 'grid',
                styles: { fontSize: 8 },
                headStyles: { fillColor: [59, 130, 246], fontStyle: 'bold' },
                alternateRowStyles: { fillColor: [248, 250, 252] },
            });

            const dateStr = new Date().toISOString().split('T')[0];
            doc.save(`Inflow_Transactions_${dateStr}.pdf`);
            addToast('Successfully downloaded Inflow PDF report!', 'success');
            setIsDownloadMenuOpen(false);
        } catch (error) {
            console.error('PDF Export Error:', error);
            addToast('Failed to generate PDF document.', 'error');
        }
    };

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.altKey && e.key.toLowerCase() === 'n' && canCreate) {
                e.preventDefault();
                setIsCreateModalOpen(true);
            }
        };
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [canCreate]);

    useEffect(() => {
        if (pageFilters && clearPageFilters) {
            setFilters(prev => ({ 
                ...prev, 
                ...pageFilters
            }));
            clearPageFilters();
        }
    }, [pageFilters, clearPageFilters]);

    const handleFilterChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFilters(prev => ({ ...prev, [name]: value }));
    };

    const resetFilters = () => {
        const defaultFilters = { dateFrom: '', dateTo: '', itemId: '', supplier: '', quantity: '', unitCost: '' };
        setFilters(defaultFilters);
        saveFiltersAction(defaultFilters);
        addToast('Filters have been reset and cleared from memory.', 'info');
    };

    const handleSaveFilters = () => {
        saveFiltersAction(filters);
        addToast('Current filters have been saved for your next visit.', 'success');
    };

    const filteredTransactions = useMemo(() => {
        return transactions.filter(tx => {
            if (filters.itemId && tx.itemId !== filters.itemId) return false;
            if (filters.supplier && !tx.supplier?.toLowerCase().includes(filters.supplier.toLowerCase())) return false;
            if (filters.quantity && tx.quantity !== parseFloat(filters.quantity)) return false;
            if (filters.unitCost && tx.unitCost !== parseFloat(filters.unitCost)) return false;
            if (filters.dateFrom && tx.txnDate.substring(0, 10) < filters.dateFrom) return false;
            if (filters.dateTo && tx.txnDate.substring(0, 10) > filters.dateTo) return false;
            return true;
        });
    }, [transactions, filters]);

    const inputStyles = "block w-full px-3 py-1.5 text-sm bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500";


    return (
        <>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Inflow</h1>
                 <div className="w-full sm:w-auto flex flex-wrap items-center gap-2">
                     {canCreate && (
                        <button 
                            onClick={() => setIsCreateModalOpen(true)}
                            className="w-full sm:w-auto bg-[#3B82F6] text-white px-4 py-2 rounded-md text-sm font-semibold hover:bg-blue-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 focus:ring-blue-500"
                            title="Create New Inflow (Alt + N)"
                        >
                            Create Inflow
                        </button>
                    )}
                    <div className="relative w-full sm:w-auto" ref={downloadMenuRef}>
                        <button
                            onClick={() => setIsDownloadMenuOpen(prev => !prev)}
                            className="w-full sm:w-auto bg-slate-800 dark:bg-gray-700 text-white px-4 py-2 rounded-md text-sm font-semibold hover:bg-slate-700 dark:hover:bg-gray-600 transition-colors flex items-center justify-center gap-2"
                        >
                            <Download className="w-4 h-4" />
                            <span>Export Report</span>
                            <ChevronDown className={`w-4 h-4 transition-transform ${isDownloadMenuOpen ? 'rotate-180' : ''}`} />
                        </button>
                        {isDownloadMenuOpen && (
                            <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-slate-800 rounded-md shadow-lg py-1 z-30 border border-gray-200 dark:border-gray-700">
                                <button onClick={handleExportExcel} className="block w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700">
                                    Download Excel
                                </button>
                                <button onClick={handleExportPdf} className="block w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700">
                                    Download PDF
                                </button>
                            </div>
                        )}
                    </div>
                 </div>
            </div>

            <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow mb-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-4 items-end">
                    <div>
                        <label htmlFor="dateFrom" className="text-sm font-medium text-gray-700 dark:text-gray-300">From</label>
                        <input type="date" name="dateFrom" id="dateFrom" value={filters.dateFrom} onChange={handleFilterChange} className={inputStyles}/>
                    </div>
                    <div>
                        <label htmlFor="dateTo" className="text-sm font-medium text-gray-700 dark:text-gray-300">To</label>
                        <input type="date" name="dateTo" id="dateTo" value={filters.dateTo} onChange={handleFilterChange} className={inputStyles}/>
                    </div>
                     <div>
                        <label htmlFor="itemId" className="text-sm font-medium text-gray-700 dark:text-gray-300">Item</label>
                        <select name="itemId" id="itemId" value={filters.itemId} onChange={handleFilterChange} className={inputStyles}>
                            <option value="">All Items</option>
                            {items.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
                        </select>
                    </div>
                    <div>
                        <label htmlFor="supplier" className="text-sm font-medium text-gray-700 dark:text-gray-300">Supplier</label>
                        <input type="text" name="supplier" id="supplier" value={filters.supplier} onChange={handleFilterChange} placeholder="Supplier name..." className={inputStyles}/>
                    </div>
                    <div>
                        <label htmlFor="quantity" className="text-sm font-medium text-gray-700 dark:text-gray-300">Quantity</label>
                        <input type="number" name="quantity" id="quantity" value={filters.quantity} onChange={handleFilterChange} placeholder="e.g., 100" className={inputStyles}/>
                    </div>
                    <div>
                        <label htmlFor="unitCost" className="text-sm font-medium text-gray-700 dark:text-gray-300">Unit Cost</label>
                        <input type="number" name="unitCost" id="unitCost" value={filters.unitCost} onChange={handleFilterChange} placeholder="e.g., 50.25" className={inputStyles}/>
                    </div>
                    <div className="flex gap-2">
                         <button onClick={handleSaveFilters} className="w-full bg-blue-600 text-white px-4 py-1.5 rounded-md text-sm font-semibold hover:bg-blue-700 shadow-sm">Save</button>
                         <button onClick={resetFilters} className="w-full bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-gray-200 px-4 py-1.5 rounded-md text-sm font-semibold hover:bg-gray-300 dark:hover:bg-gray-500 shadow-sm">Reset</button>
                    </div>
                </div>
            </div>

            <ItemDetails 
                transactions={filteredTransactions} 
                items={items}
                deleteTransaction={deleteTransaction} 
                onEditTransaction={setEditingTransaction}
            />
            <CreateInflowModal 
                isOpen={isCreateModalOpen} 
                onClose={() => setIsCreateModalOpen(false)}
                items={items}
                addTransaction={addTransaction}
                createItemAndInflow={createItemAndInflow}
                addToast={addToast}
            />
            {editingTransaction && (
                <EditInflowModal
                    isOpen={!!editingTransaction}
                    onClose={() => setEditingTransaction(null)}
                    transaction={editingTransaction}
                    onUpdate={updateTransaction}
                    items={items}
                />
            )}
        </>
    );
};
export default Inflow;