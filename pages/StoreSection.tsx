import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronDown, Download } from 'lucide-react';
import type { Item, InflowTransaction, ConsumptionTransaction, Formula, User, ToastMessage, Supplier, PurchaseOrder } from '../types';
import Stock from './Stock';
import Inflow from './Inflow';
import Consumption from './Consumption';
import RawMaterials from './RawMaterials';
import BatchCost from './BatchCost';
import { Card } from '../components/Card';
import { PlusIcon } from '../components/Icon';
import CreateSupplierModal from '../components/CreateSupplierModal';
import CreatePurchaseOrderModal from '../components/CreatePurchaseOrderModal';

declare const XLSX: any;
declare const jspdf: any;

interface StoreSectionProps {
    items: Item[];
    stockLevels: Record<string, number>;
    inflowTransactions: InflowTransaction[];
    consumptionTransactions: ConsumptionTransaction[];
    formulas: Formula[];
    suppliers: Supplier[];
    purchaseOrders: PurchaseOrder[];
    addToast: (message: string, type: ToastMessage['type']) => void;
    totalBatches: number;

    addItem: (item: Omit<Item, 'id' | 'createdAt'>) => void;
    updateItem: (item: Item) => void;
    deleteItem: (itemId: string) => void;

    addInflowTransaction: (tx: Omit<InflowTransaction, 'id' | 'createdAt' | 'totalCost'>) => void;
    createItemAndInflow: (itemData: Omit<Item, 'id' | 'createdAt'>, txData: Omit<InflowTransaction, 'id' | 'createdAt' | 'totalCost' | 'itemId'>) => void;
    updateInflowTransaction: (tx: InflowTransaction) => void;
    deleteInflowTransaction: (transactionId: string) => void;
    
    addMultipleConsumptionTransactions: (txs: Omit<ConsumptionTransaction, 'id' | 'createdAt'>[]) => void;
    updateConsumptionTransaction: (tx: ConsumptionTransaction) => void;
    deleteConsumptionTransaction: (txId: string) => void;

    addFormula: (formula: Omit<Formula, 'id' | 'createdAt'>) => void;
    updateFormula: (formula: Formula) => void;
    deleteFormula: (formulaId: string) => void;

    addSupplier: (supplier: Omit<Supplier, 'id' | 'createdAt'>) => void;
    updateSupplier: (supplier: Supplier) => void;
    deleteSupplier: (id: string) => void;

    addPurchaseOrder: (po: Omit<PurchaseOrder, 'id' | 'createdAt' | 'updatedAt'>) => void;
    updatePurchaseOrder: (po: PurchaseOrder) => void;
    deletePurchaseOrder: (id: string) => void;
    updatePOStatus: (id: string, status: PurchaseOrder['status']) => void;
    initialTab?: Tab;
}

type Tab = 'Stock' | 'Inflow' | 'Consumption' | 'Materials' | 'Forecasting' | 'Suppliers' | 'PurchaseOrders' | 'BatchCost';

const StoreSection = (props) => {
    const [activeTab, setActiveTab] = useState<Tab>(props.initialTab || 'Stock');
    const [isSupplierModalOpen, setIsSupplierModalOpen] = useState(false);
    const [isPOModalOpen, setIsPOModalOpen] = useState(false);

    React.useEffect(() => {
        if (props.initialTab) {
            setActiveTab(props.initialTab);
        }
    }, [props.initialTab]);

    const tabs: { id: Tab; label: string }[] = [
        { id: 'Stock', label: 'Current Stock' },
        { id: 'Inflow', label: 'Inflow (Purchase)' },
        { id: 'Consumption', label: 'Consumption (Log)' },
        { id: 'Materials', label: 'Materials List' },
        { id: 'Forecasting', label: 'Forecasting' },
        { id: 'Suppliers', label: 'Suppliers' },
        { id: 'PurchaseOrders', label: 'Purchase Orders' },
        { id: 'BatchCost', label: 'Batch Cost' },
    ];

    const forecastingData = useMemo(() => {
        return props.items.map(item => {
            const currentStock = props.stockLevels[item.id] || 0;
            const itemConsumption = props.consumptionTransactions
                .filter(tx => tx.itemId === item.id && !tx.deletedAt)
                .reduce((sum, tx) => sum + tx.quantity, 0);
            
            // Average daily consumption over last 30 days (mock logic)
            const avgDaily = itemConsumption / 30;
            const daysRemaining = avgDaily > 0 ? Math.floor(currentStock / avgDaily) : Infinity;
            
            return {
                ...item,
                currentStock,
                avgDaily,
                daysRemaining
            };
        }).sort((a, b) => a.daysRemaining - b.daysRemaining);
    }, [props.items, props.stockLevels, props.consumptionTransactions]);

    const handleExportForecastingExcel = () => {
        try {
            const headers = ['Item SKU', 'Item Name', 'Current Stock', 'Avg Daily Consumption', 'Days Remaining', 'Status'];
            const rows = forecastingData.map(item => [
                item.sku || 'N/A',
                item.name || 'N/A',
                `${item.currentStock} ${item.uom}`,
                item.avgDaily.toFixed(2),
                item.daysRemaining === Infinity ? 'Infinite' : item.daysRemaining,
                item.daysRemaining < 7 ? 'Critical' : item.daysRemaining < 14 ? 'Warning' : 'Healthy'
            ]);

            const wb = XLSX.utils.book_new();
            const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
            XLSX.utils.book_append_sheet(wb, ws, 'Depletion Forecast');
            
            const dateStr = new Date().toISOString().split('T')[0];
            XLSX.writeFile(wb, `Inventory_Forecast_${dateStr}.xlsx`);
            props.addToast('Successfully downloaded Forecast Excel sheet!', 'success');
        } catch (e) {
            console.error(e);
            props.addToast('Failed to export forecast.', 'error');
        }
    };

    const handleExportForecastingPdf = () => {
        try {
            const headers = ['SKU', 'Item Name', 'Current Stock', 'Avg Daily', 'Days Left', 'Status'];
            const rows = forecastingData.map(item => [
                item.sku || 'N/A',
                item.name || 'N/A',
                `${item.currentStock} ${item.uom}`,
                item.avgDaily.toFixed(2),
                item.daysRemaining === Infinity ? 'Infinite' : item.daysRemaining,
                item.daysRemaining < 7 ? 'Critical' : item.daysRemaining < 14 ? 'Warning' : 'Healthy'
            ]);

            const { jsPDF } = jspdf;
            const doc = new jsPDF({ orientation: 'landscape' });
            
            const generatedDate = new Date().toLocaleDateString();
            doc.text(`Inventory Depletion Forecast`, 14, 15);
            doc.setFontSize(10);
            doc.text(`Generated on: ${generatedDate} | Record Count: ${rows.length}`, 14, 20);

            doc.autoTable({
                head: [headers],
                body: rows,
                startY: 24,
                theme: 'grid',
                styles: { fontSize: 8 },
                headStyles: { fillColor: [30, 41, 59], fontStyle: 'bold' },
                alternateRowStyles: { fillColor: [248, 250, 252] },
            });

            const dateStr = new Date().toISOString().split('T')[0];
            doc.save(`Inventory_Forecast_${dateStr}.pdf`);
            props.addToast('Successfully downloaded Forecast PDF report!', 'success');
        } catch (e) {
            console.error(e);
            props.addToast('Failed to generate PDF document.', 'error');
        }
    };

    const handleExportSuppliersExcel = () => {
        try {
            const headers = ['Supplier Name', 'Contact Person', 'Phone Number', 'Rating', 'Lead Time (Days)', 'Address'];
            const rows = props.suppliers.map(s => [
                s.name || 'N/A',
                s.contactPerson || 'N/A',
                s.phone || 'N/A',
                s.rating || 5,
                s.leadTimeDays || 3,
                s.address || 'N/A'
            ]);

            const wb = XLSX.utils.book_new();
            const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
            XLSX.utils.book_append_sheet(wb, ws, 'Suppliers List');
            
            const dateStr = new Date().toISOString().split('T')[0];
            XLSX.writeFile(wb, `Suppliers_List_${dateStr}.xlsx`);
            props.addToast('Successfully downloaded Suppliers Excel sheet!', 'success');
        } catch (e) {
            console.error(e);
            props.addToast('Failed to export suppliers.', 'error');
        }
    };

    const handleExportSuppliersPdf = () => {
        try {
            const headers = ['Supplier Name', 'Contact Person', 'Phone', 'Rating', 'Lead Time (d)', 'Address'];
            const rows = props.suppliers.map(s => [
                s.name || 'N/A',
                s.contactPerson || 'N/A',
                s.phone || 'N/A',
                s.rating || 5,
                s.leadTimeDays || 3,
                s.address || 'N/A'
            ]);

            const { jsPDF } = jspdf;
            const doc = new jsPDF({ orientation: 'landscape' });
            
            const generatedDate = new Date().toLocaleDateString();
            doc.text(`Suppliers List`, 14, 15);
            doc.setFontSize(10);
            doc.text(`Generated on: ${generatedDate} | Record Count: ${rows.length}`, 14, 20);

            doc.autoTable({
                head: [headers],
                body: rows,
                startY: 24,
                theme: 'grid',
                styles: { fontSize: 8 },
                headStyles: { fillColor: [30, 41, 59], fontStyle: 'bold' },
                alternateRowStyles: { fillColor: [248, 250, 252] },
            });

            const dateStr = new Date().toISOString().split('T')[0];
            doc.save(`Suppliers_List_${dateStr}.pdf`);
            props.addToast('Successfully downloaded Suppliers PDF report!', 'success');
        } catch (e) {
            console.error(e);
            props.addToast('Failed to generate PDF document.', 'error');
        }
    };

    const handleExportPOExcel = () => {
        try {
            const headers = ['PO Number', 'Supplier Name', 'Total Amount (INR)', 'Status', 'Expected Date'];
            const rows = props.purchaseOrders.map(po => {
                const supplier = props.suppliers.find(s => s.id === po.supplierId);
                return [
                    po.poNumber || 'N/A',
                    supplier?.name || 'Unknown',
                    po.totalAmount || 0,
                    po.status || 'SENT',
                    po.expectedDate ? new Date(po.expectedDate).toLocaleDateString() : 'N/A'
                ];
            });

            const wb = XLSX.utils.book_new();
            const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
            XLSX.utils.book_append_sheet(wb, ws, 'Purchase Orders');
            
            const dateStr = new Date().toISOString().split('T')[0];
            XLSX.writeFile(wb, `Purchase_Orders_${dateStr}.xlsx`);
            props.addToast('Successfully downloaded Purchase Orders Excel!', 'success');
        } catch (e) {
            console.error(e);
            props.addToast('Failed to export Purchase Orders.', 'error');
        }
    };

    const handleExportPOPdf = () => {
        try {
            const headers = ['PO Number', 'Supplier Name', 'Total Amount', 'Status', 'Expected Date'];
            const rows = props.purchaseOrders.map(po => {
                const supplier = props.suppliers.find(s => s.id === po.supplierId);
                return [
                    po.poNumber || 'N/A',
                    supplier?.name || 'Unknown',
                    `INR ${po.totalAmount?.toLocaleString() || 0}`,
                    po.status || 'SENT',
                    po.expectedDate ? new Date(po.expectedDate).toLocaleDateString() : 'N/A'
                ];
            });

            const { jsPDF } = jspdf;
            const doc = new jsPDF({ orientation: 'landscape' });
            
            const generatedDate = new Date().toLocaleDateString();
            doc.text(`Purchase Orders`, 14, 15);
            doc.setFontSize(10);
            doc.text(`Generated on: ${generatedDate} | Record Count: ${rows.length}`, 14, 20);

            doc.autoTable({
                head: [headers],
                body: rows,
                startY: 24,
                theme: 'grid',
                styles: { fontSize: 8 },
                headStyles: { fillColor: [30, 41, 59], fontStyle: 'bold' },
                alternateRowStyles: { fillColor: [248, 250, 252] },
            });

            const dateStr = new Date().toISOString().split('T')[0];
            doc.save(`Purchase_Orders_${dateStr}.pdf`);
            props.addToast('Successfully downloaded Purchase Orders PDF!', 'success');
        } catch (e) {
            console.error(e);
            props.addToast('Failed to generate PDF document.', 'error');
        }
    };

    return (
        <div className="space-y-10">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div>
                    <h1 className="text-4xl font-display font-black text-slate-900 dark:text-white uppercase tracking-tighter italic">RM Section Operations</h1>
                    <p className="text-slate-500 font-medium mt-1">Raw material inventory intelligence, logistics tracking, and RM suppliers.</p>
                </div>
            </div>

            <div className="p-1.5 bg-slate-100 dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-inner flex overflow-x-auto scrollbar-none gap-1.5 no-print w-full flex-nowrap lg:flex-wrap">
                {tabs.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`px-3.5 sm:px-5 py-2 sm:py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-200 shrink-0 text-center whitespace-nowrap ${
                            activeTab === tab.id
                                ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-sm'
                                : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
                        }`}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            <AnimatePresence mode="wait">
                <motion.div 
                    key={activeTab}
                    initial={{ opacity: 0, y: 15, scale: 0.99 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -15, scale: 0.99 }}
                    transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                >
                {activeTab === 'Stock' && (
                    <Stock
                        items={props.items}
                        stockLevels={props.stockLevels}
                        transactions={props.inflowTransactions}
                        consumptionTransactions={props.consumptionTransactions}
                        deleteItem={props.deleteItem}
                        updateItem={props.updateItem}
                        totalBatches={props.totalBatches}
                        addToast={props.addToast}
                    />
                )}
                {activeTab === 'Inflow' && (
                    <Inflow
                        items={props.items}
                        transactions={props.inflowTransactions}
                        addTransaction={props.addInflowTransaction}
                        createItemAndInflow={props.createItemAndInflow}
                        deleteTransaction={props.deleteInflowTransaction}
                        updateTransaction={props.updateInflowTransaction}
                        addToast={props.addToast}
                    />
                )}
                {activeTab === 'Consumption' && (
                    <Consumption
                        items={props.items}
                        consumptionTransactions={props.consumptionTransactions}
                        addMultipleConsumptionTransactions={props.addMultipleConsumptionTransactions}
                        updateConsumptionTransaction={props.updateConsumptionTransaction}
                        deleteConsumptionTransaction={props.deleteConsumptionTransaction}
                        formulas={props.formulas}
                        addFormula={props.addFormula}
                        updateFormula={props.updateFormula}
                        deleteFormula={props.deleteFormula}
                        addToast={props.addToast}
                    />
                )}
                {activeTab === 'Materials' && (
                    <RawMaterials
                        items={props.items}
                        deleteItem={props.deleteItem}
                        updateItem={props.updateItem}
                        addItem={props.addItem}
                        addToast={props.addToast}
                    />
                )}
                {activeTab === 'Forecasting' && (
                    <Card>
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 border-b pb-4 dark:border-gray-700">
                            <div>
                                <h2 className="text-xl font-display font-black uppercase italic text-slate-900 dark:text-white">Inventory Depletion Forecast</h2>
                                <p className="text-sm text-gray-500 mt-1">Run historical depletion logs to predict depletion days remaining.</p>
                            </div>
                            <div className="flex gap-2 w-full sm:w-auto">
                                <button onClick={handleExportForecastingExcel} className="flex-1 sm:flex-initial bg-slate-800 text-white px-3 py-1.5 rounded text-xs font-bold hover:bg-slate-700 transition-colors flex items-center justify-center gap-1">
                                    <Download className="w-3.5 h-3.5" /> Excel
                                </button>
                                <button onClick={handleExportForecastingPdf} className="flex-1 sm:flex-initial bg-slate-800 text-white px-3 py-1.5 rounded text-xs font-bold hover:bg-slate-700 transition-colors flex items-center justify-center gap-1">
                                    <Download className="w-3.5 h-3.5" /> PDF
                                </button>
                            </div>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left text-gray-500 dark:text-gray-400">
                                <thead className="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-gray-700 dark:text-gray-400">
                                    <tr>
                                        <th className="px-6 py-3">Item</th>
                                        <th className="px-6 py-3 text-right">Stock</th>
                                        <th className="px-6 py-3 text-right">Avg Daily</th>
                                        <th className="px-6 py-3 text-right">Days Left</th>
                                        <th className="px-6 py-3 text-center">Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {forecastingData.map(item => (
                                        <tr key={item.id} className="bg-white border-b dark:bg-gray-800 dark:border-gray-700">
                                            <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">{item.name}</td>
                                            <td className="px-6 py-4 text-right">{item.currentStock} {item.uom}</td>
                                            <td className="px-6 py-4 text-right">{item.avgDaily.toFixed(2)}</td>
                                            <td className="px-6 py-4 text-right font-bold">
                                                {item.daysRemaining === Infinity ? '∞' : item.daysRemaining}
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <span className={`px-2 py-1 rounded-full text-xs ${
                                                    item.daysRemaining < 7 ? 'bg-red-100 text-red-800' : 
                                                    item.daysRemaining < 14 ? 'bg-yellow-100 text-yellow-800' : 
                                                    'bg-green-100 text-green-800'
                                                }`}>
                                                    {item.daysRemaining < 7 ? 'Critical' : item.daysRemaining < 14 ? 'Warning' : 'Healthy'}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </Card>
                )}
                {activeTab === 'Suppliers' && (
                    <Card>
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 border-b pb-4 dark:border-gray-700">
                            <div>
                                <h2 className="text-xl font-display font-black uppercase italic text-slate-900 dark:text-white">Supplier Management</h2>
                                <p className="text-sm text-gray-500 mt-1">Manage raw material vendors and performance metrics.</p>
                            </div>
                            <div className="flex flex-wrap gap-2 w-full sm:w-auto">
                                <button onClick={handleExportSuppliersExcel} className="flex-1 sm:flex-initial bg-slate-800 text-white px-3 py-1.5 rounded text-xs font-bold hover:bg-slate-700 transition-colors flex items-center justify-center gap-1">
                                    <Download className="w-3.5 h-3.5" /> Excel
                                </button>
                                <button onClick={handleExportSuppliersPdf} className="flex-1 sm:flex-initial bg-slate-800 text-white px-3 py-1.5 rounded text-xs font-bold hover:bg-slate-700 transition-colors flex items-center justify-center gap-1">
                                    <Download className="w-3.5 h-3.5" /> PDF
                                </button>
                                <button 
                                    onClick={() => setIsSupplierModalOpen(true)}
                                    className="flex-1 sm:flex-initial bg-blue-600 text-white px-3 py-1.5 rounded text-xs font-bold hover:bg-blue-700 transition-colors flex items-center justify-center gap-1"
                                >
                                    <PlusIcon className="w-3.5 h-3.5" /> Add Supplier
                                </button>
                            </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {props.suppliers.map(s => (
                                <div key={s.id} className="p-4 border dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-700/30 group relative">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <h3 className="font-bold text-gray-900 dark:text-white">{s.name}</h3>
                                            <p className="text-xs text-gray-500">{s.contactPerson} | {s.phone}</p>
                                        </div>
                                        <div className="text-right">
                                            <span className="text-yellow-500 font-bold">★ {s.rating}</span>
                                            <p className="text-[10px] text-gray-400">Lead Time: {s.leadTimeDays}d</p>
                                        </div>
                                    </div>
                                    <div className="mt-2 text-xs text-gray-600 dark:text-gray-400">
                                        {s.address}
                                    </div>
                                    <button 
                                        onClick={() => {
                                            if(window.confirm('Are you sure you want to delete this supplier?')) {
                                                props.deleteSupplier(s.id);
                                                props.addToast('Supplier deleted', 'info');
                                            }
                                        }}
                                        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 p-1 text-red-500 hover:bg-red-50 rounded transition-all"
                                    >
                                        ✕
                                    </button>
                                </div>
                            ))}
                            {props.suppliers.length === 0 && (
                                <div className="col-span-2 text-center py-12 text-gray-500 bg-gray-50 dark:bg-gray-800/50 rounded-xl border-2 border-dashed dark:border-gray-700">
                                    No suppliers found. Click "Add Supplier" to get started.
                                </div>
                            )}
                        </div>
                    </Card>
                )}
                {activeTab === 'PurchaseOrders' && (
                    <Card>
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 border-b pb-4 dark:border-gray-700">
                            <div>
                                <h2 className="text-xl font-display font-black uppercase italic text-slate-900 dark:text-white">Purchase Orders</h2>
                                <p className="text-sm text-gray-500 mt-1">Track and manage raw material procurement workflows.</p>
                            </div>
                            <div className="flex flex-wrap gap-2 w-full sm:w-auto">
                                <button onClick={handleExportPOExcel} className="flex-1 sm:flex-initial bg-slate-800 text-white px-3 py-1.5 rounded text-xs font-bold hover:bg-slate-700 transition-colors flex items-center justify-center gap-1">
                                    <Download className="w-3.5 h-3.5" /> Excel
                                </button>
                                <button onClick={handleExportPOPdf} className="flex-1 sm:flex-initial bg-slate-800 text-white px-3 py-1.5 rounded text-xs font-bold hover:bg-slate-700 transition-colors flex items-center justify-center gap-1">
                                    <Download className="w-3.5 h-3.5" /> PDF
                                </button>
                                <button 
                                    onClick={() => setIsPOModalOpen(true)}
                                    className="flex-1 sm:flex-initial bg-blue-600 text-white px-3 py-1.5 rounded text-xs font-bold hover:bg-blue-700 transition-colors flex items-center justify-center gap-1"
                                >
                                    <PlusIcon className="w-3.5 h-3.5" /> New PO
                                </button>
                            </div>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left text-gray-500 dark:text-gray-400">
                                <thead className="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-gray-700 dark:text-gray-400">
                                    <tr>
                                        <th className="px-6 py-3">PO #</th>
                                        <th className="px-6 py-3">Supplier</th>
                                        <th className="px-6 py-3 text-right">Amount</th>
                                        <th className="px-6 py-3 text-center">Status</th>
                                        <th className="px-6 py-3">Expected</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {props.purchaseOrders.map(po => {
                                        const supplier = props.suppliers.find(s => s.id === po.supplierId);
                                        return (
                                            <tr key={po.id} className="bg-white border-b dark:bg-gray-800 dark:border-gray-700">
                                                <td className="px-6 py-4 font-mono font-bold">{po.poNumber}</td>
                                                <td className="px-6 py-4">{supplier?.name || 'Unknown'}</td>
                                                <td className="px-6 py-4 text-right font-mono">₹{(po.totalAmount || 0).toLocaleString()}</td>
                                                <td className="px-6 py-4 text-center">
                                                    <span className={`px-2 py-1 rounded-full text-[10px] font-bold ${
                                                        po.status === 'RECEIVED' ? 'bg-green-100 text-green-800' :
                                                        po.status === 'SENT' ? 'bg-blue-100 text-blue-800' :
                                                        'bg-gray-100 text-gray-800'
                                                    }`}>
                                                        {po.status}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-xs">
                                                    {po.expectedDate ? new Date(po.expectedDate).toLocaleDateString() : '-'}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </Card>
                )}
                {activeTab === 'BatchCost' && (
                    <BatchCost
                        formulas={props.formulas}
                        items={props.items}
                        updateItem={props.updateItem}
                        updateFormula={props.updateFormula}
                    />
                )}
            </motion.div>
            </AnimatePresence>

            <CreateSupplierModal
                isOpen={isSupplierModalOpen}
                onClose={() => setIsSupplierModalOpen(false)}
                onSave={(s) => {
                    props.addSupplier(s);
                    props.addToast('Supplier added successfully!', 'success');
                }}
            />

            <CreatePurchaseOrderModal
                isOpen={isPOModalOpen}
                onClose={() => setIsPOModalOpen(false)}
                onSave={props.addPurchaseOrder}
                suppliers={props.suppliers}
                items={props.items}
            />
        </div>
    );
};

export default StoreSection;
