import React, { useState, useEffect, useMemo, useRef } from 'react';
import { ChevronDown, Download } from 'lucide-react';
import type { Item, ConsumptionTransaction, Formula, User, ToastMessage } from '../types';
import ConsumptionTable from '../components/ConsumptionTable';
import CreateConsumptionModal from '../components/CreateConsumptionModal';
import EditConsumptionModal from '../components/EditConsumptionModal';
import FormulasView from '../components/FormulasView';
import { useStore } from '../store/useStore';

declare const XLSX: any;
declare const jspdf: any;

interface ConsumptionProps {
    items: Item[];
    consumptionTransactions: ConsumptionTransaction[];
    addMultipleConsumptionTransactions: (txs: Omit<ConsumptionTransaction, 'id' | 'createdAt'>[]) => void;
    updateConsumptionTransaction: (tx: ConsumptionTransaction) => void;
    deleteConsumptionTransaction: (txId: string) => void;
    formulas: Formula[];
    addFormula: (formula: Omit<Formula, 'id' | 'createdAt'>) => void;
    updateFormula: (formula: Formula) => void;
    deleteFormula: (formulaId: string) => void;
    addToast: (message: string, type: ToastMessage['type']) => void;
}

type ConsumptionTab = 'log' | 'formula';

const Consumption = (props) => {
    const savedFilters = useStore(state => state.uiState.consumptionFilters);
    const saveFiltersAction = useStore(state => state.setConsumptionFilters);

    const [activeTab, setActiveTab] = useState<ConsumptionTab>('log');
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [editingTransaction, setEditingTransaction] = useState<ConsumptionTransaction | null>(null);
    const [filters, setFilters] = useState(savedFilters);
    const [formulaToUse, setFormulaToUse] = useState<string | null>(null);
    const [isDownloadMenuOpen, setIsDownloadMenuOpen] = useState(false);
    const downloadMenuRef = useRef<HTMLDivElement>(null);
    const { addToast } = props;

    const canRecordConsumption = true; // All permissions enabled
    const canManageFormulas = true; // All permissions enabled

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
            let headers: string[] = [];
            let rows: any[][] = [];
            let fileName = '';
            let sheetName = '';

            if (activeTab === 'log') {
                headers = ['Date', 'Reference / Batch No', 'Item SKU', 'Item Name', 'Quantity Consumed', 'Operation Type', 'Warehouse'];
                rows = filteredTransactions.map(tx => {
                    const item = props.items.find(i => i.id === tx.itemId);
                    return [
                        tx.txnDate || tx.createdAt.slice(0, 10),
                        tx.refNo || 'N/A',
                        item?.sku || 'N/A',
                        item?.name || 'N/A',
                        tx.quantity || 0,
                        tx.type || 'PRODUCTION',
                        tx.warehouseId || 'Main Store'
                    ];
                });
                fileName = 'Consumption_Logs';
                sheetName = 'Consumption History';
            } else {
                headers = ['Formula Name', 'Output Product', 'Output Quantity', 'Output Unit', 'Active Ingredients Listing'];
                rows = props.formulas.map(formula => {
                    const ingredientSummary = (formula.ingredients || []).map(ing => {
                        const ingItem = props.items.find(it => it.id === ing.itemId);
                        return `${ingItem?.name || ing.itemId}: ${ing.quantity}%`;
                    }).join(', ');
                    return [
                        formula.name || 'N/A',
                        formula.outputProduct || 'N/A',
                        formula.outputQuantity || 0,
                        formula.outputUom || 'kg',
                        ingredientSummary || 'None'
                    ];
                });
                fileName = 'Standard_Mix_Formulas';
                sheetName = 'Formulas';
            }

            if (rows.length === 0) {
                addToast('No records available to export.', 'error');
                return;
            }

            const wb = XLSX.utils.book_new();
            const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
            XLSX.utils.book_append_sheet(wb, ws, sheetName);
            
            const dateStr = new Date().toISOString().split('T')[0];
            XLSX.writeFile(wb, `${fileName}_${dateStr}.xlsx`);
            addToast(`Successfully downloaded ${sheetName} Excel sheet!`, 'success');
            setIsDownloadMenuOpen(false);
        } catch (error) {
            console.error('Excel Export Error:', error);
            addToast('Failed to generate Excel sheet.', 'error');
        }
    };

    const handleExportPdf = () => {
        try {
            let headers: string[] = [];
            let rows: any[][] = [];
            let title = '';
            let fileName = '';

            if (activeTab === 'log') {
                headers = ['Date', 'Batch No', 'SKU', 'Item Name', 'Qty Consumed', 'Type', 'Warehouse'];
                rows = filteredTransactions.map(tx => {
                    const item = props.items.find(i => i.id === tx.itemId);
                    return [
                        tx.txnDate || tx.createdAt.slice(0, 10),
                        tx.refNo || 'N/A',
                        item?.sku || 'N/A',
                        item?.name || 'N/A',
                        tx.quantity || 0,
                        tx.type || 'PRODUCTION',
                        tx.warehouseId || 'Main Store'
                    ];
                });
                title = 'Consumption Log - ERP Reports';
                fileName = 'Consumption_Logs';
            } else {
                headers = ['Formula Name', 'Output Product', 'Output Qty', 'Unit', 'Active Ingredients Listing'];
                rows = props.formulas.map(formula => {
                    const ingredientSummary = (formula.ingredients || []).map(ing => {
                        const ingItem = props.items.find(it => it.id === ing.itemId);
                        return `${ingItem?.name || ing.itemId}: ${ing.quantity}%`;
                    }).join(', ');
                    return [
                        formula.name || 'N/A',
                        formula.outputProduct || 'N/A',
                        formula.outputQuantity || 0,
                        formula.outputUom || 'kg',
                        ingredientSummary || 'None'
                    ];
                });
                title = 'Standard Mix Formulas - ERP Recipes';
                fileName = 'Standard_Mix_Formulas';
            }

            if (rows.length === 0) {
                addToast('No records available to export.', 'error');
                return;
            }

            const { jsPDF } = jspdf;
            const doc = new jsPDF({ orientation: 'landscape' });
            
            const generatedDate = new Date().toLocaleDateString();
            doc.text(title, 14, 15);
            doc.setFontSize(10);
            doc.text(`Generated on: ${generatedDate} | Record Count: ${rows.length}`, 14, 20);

            doc.autoTable({
                head: [headers],
                body: rows,
                startY: 24,
                theme: 'grid',
                styles: { fontSize: 8 },
                headStyles: { fillColor: [220, 95, 30], fontStyle: 'bold' }, // Dark orange to match consumption theme
                alternateRowStyles: { fillColor: [254, 244, 230] },
            });

            const dateStr = new Date().toISOString().split('T')[0];
            doc.save(`${fileName}_${dateStr}.pdf`);
            addToast(`Successfully downloaded ${activeTab === 'log' ? 'Consumption Logs' : 'Formulas'} PDF report!`, 'success');
            setIsDownloadMenuOpen(false);
        } catch (error) {
            console.error('PDF Export Error:', error);
            addToast('Failed to generate PDF document.', 'error');
        }
    };

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.altKey && e.key.toLowerCase() === 'c' && activeTab === 'log' && canRecordConsumption) {
                e.preventDefault();
                setIsCreateModalOpen(true);
            }
        };
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [activeTab, canRecordConsumption]);

    const handleUseFormula = (formulaId: string) => {
        setFormulaToUse(formulaId);
        setIsCreateModalOpen(true);
    };

    const handleCloseCreateModal = () => {
        setIsCreateModalOpen(false);
        setFormulaToUse(null);
    };

    const handleFilterChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFilters(prev => ({ ...prev, [name]: value }));
    };

    const resetFilters = () => {
        const defaultFilters = { dateFrom: '', dateTo: '', itemId: '', batchNo: '', quantity: '' };
        setFilters(defaultFilters);
        saveFiltersAction(defaultFilters);
        addToast('Filters have been reset and cleared from memory.', 'info');
    };

    const handleSaveFilters = () => {
        saveFiltersAction(filters);
        addToast('Current filters have been saved for your next visit.', 'success');
    };

    const filteredTransactions = useMemo(() => {
        return props.consumptionTransactions.filter(tx => {
            if (filters.itemId && tx.itemId !== filters.itemId) return false;
            if (filters.batchNo && !tx.refNo?.toLowerCase().includes(filters.batchNo.toLowerCase())) return false;
            if (filters.quantity && tx.quantity !== parseFloat(filters.quantity)) return false;
            if (filters.dateFrom && tx.txnDate.substring(0, 10) < filters.dateFrom) return false;
            if (filters.dateTo && tx.txnDate.substring(0, 10) > filters.dateTo) return false;
            return true;
        });
    }, [props.consumptionTransactions, filters]);
    
    const tabs: { id: ConsumptionTab; label: string }[] = useMemo(() => {
        const allTabs: { id: ConsumptionTab; label: string }[] = [
            { id: 'log', label: 'Consumption Log' },
        ];
        if (canManageFormulas) {
            allTabs.push({ id: 'formula', label: 'Formulas' });
        }
        return allTabs;
    }, [canManageFormulas]);
    
    useEffect(() => {
        if (!tabs.some(t => t.id === activeTab)) {
            setActiveTab('log');
        }
    }, [tabs, activeTab]);

    const inputStyles = "block w-full px-3 py-1.5 text-sm bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500";


    return (
        <>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 no-print">
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Consumption</h1>
                 <div className="w-full sm:w-auto flex flex-wrap items-center gap-2">
                    {activeTab === 'log' && canRecordConsumption && (
                        <button 
                            onClick={() => setIsCreateModalOpen(true)}
                            className="w-full sm:w-auto bg-orange-600 text-white px-5 py-2 rounded-md text-sm font-semibold hover:bg-orange-700 shadow focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500"
                            title="Record Consumption (Alt + C)"
                        >
                            Record Consumption
                        </button>
                    )}
                    <div className="relative w-full sm:w-auto" ref={downloadMenuRef}>
                        <button
                            onClick={() => setIsDownloadMenuOpen(prev => !prev)}
                            className="w-full sm:w-auto bg-slate-800 dark:bg-gray-700 text-white px-5 py-2 rounded-md text-sm font-semibold hover:bg-slate-700 dark:hover:bg-gray-600 transition-colors flex items-center justify-center gap-2"
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
            
            <div className="mb-6 border-b border-gray-200 dark:border-gray-700 no-print">
                <nav className="-mb-px flex space-x-6 overflow-x-auto" aria-label="Tabs">
                    {tabs.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`${
                                activeTab === tab.id
                                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:border-gray-500'
                            } whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm focus:outline-none`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </nav>
            </div>

            <div>
                {activeTab === 'log' && (
                    <>
                        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow mb-6 no-print">
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-4 items-end">
                                <div>
                                    <label htmlFor="dateFrom" className="text-sm">From</label>
                                    <input type="date" name="dateFrom" value={filters.dateFrom} onChange={handleFilterChange} className={inputStyles}/>
                                </div>
                                <div>
                                    <label htmlFor="dateTo" className="text-sm">To</label>
                                    <input type="date" name="dateTo" value={filters.dateTo} onChange={handleFilterChange} className={inputStyles}/>
                                </div>
                                 <div>
                                    <label htmlFor="itemId" className="text-sm">Item</label>
                                    <select name="itemId" value={filters.itemId} onChange={handleFilterChange} className={inputStyles}>
                                        <option value="">All Items</option>
                                        {props.items.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label htmlFor="batchNo" className="text-sm">Batch No.</label>
                                    <input type="text" name="batchNo" value={filters.batchNo} onChange={handleFilterChange} placeholder="Batch ref..." className={inputStyles}/>
                                </div>
                                <div>
                                    <label htmlFor="quantity" className="text-sm">Quantity</label>
                                    <input type="number" name="quantity" value={filters.quantity} onChange={handleFilterChange} placeholder="e.g., 100" className={inputStyles}/>
                                </div>
                                <div className="col-span-1 xl:col-span-2 flex gap-2">
                                     <button onClick={handleSaveFilters} className="w-full bg-blue-600 text-white px-4 py-1.5 rounded-md text-sm font-semibold hover:bg-blue-700 shadow-sm">Save</button>
                                     <button onClick={resetFilters} className="w-full bg-gray-200 dark:bg-gray-600 px-4 py-1.5 rounded-md text-sm font-semibold hover:bg-gray-300 dark:hover:bg-gray-500 shadow-sm">Reset</button>
                                </div>
                            </div>
                        </div>
                        <ConsumptionTable
                            transactions={filteredTransactions}
                            items={props.items}
                            onEdit={setEditingTransaction}
                            onDelete={props.deleteConsumptionTransaction}
                        />
                    </>
                )}
                {activeTab === 'formula' && canManageFormulas && (
                    <FormulasView
                        items={props.items}
                        formulas={props.formulas}
                        addFormula={props.addFormula}
                        updateFormula={props.updateFormula}
                        deleteFormula={props.deleteFormula}
                        onUseFormula={handleUseFormula}
                    />
                )}
            </div>
            <CreateConsumptionModal
                isOpen={isCreateModalOpen}
                onClose={handleCloseCreateModal}
                items={props.items}
                formulas={props.formulas}
                onAdd={props.addMultipleConsumptionTransactions}
                initialFormulaId={formulaToUse}
            />
            {editingTransaction && (
                <EditConsumptionModal
                    isOpen={!!editingTransaction}
                    onClose={() => setEditingTransaction(null)}
                    transaction={editingTransaction}
                    onUpdate={props.updateConsumptionTransaction}
                    items={props.items}
                />
            )}
        </>
    );
};
export default Consumption;