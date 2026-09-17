import React, { useState, useMemo } from 'react';
import { 
    Download, 
    FileSpreadsheet, 
    FileText, 
    Search, 
    Database, 
    Boxes, 
    Layers, 
    Hammer, 
    Eye, 
    X, 
    Info, 
    FileSpreadsheet as ExcelIcon, 
    Check, 
    Building, 
    ClipboardList,
    ShieldAlert
} from 'lucide-react';
import { useStore } from '../store/useStore';
import type { ToastMessage } from '../types';

declare const XLSX: any;
declare const jspdf: any;

interface ExportHubProps {
    addToast: (message: string, type: ToastMessage['type']) => void;
}

interface ExportDataset {
    id: string;
    title: string;
    category: 'Materials' | 'Profiles' | 'Procurement' | 'Config';
    description: string;
    icon: React.ReactNode;
    getHeaders: () => string[];
    getData: () => (string | number)[][];
    getRowsCount: () => number;
    fileName: string;
}

const ExportHub = ({ addToast }) => {
    const store = useStore();
    const [searchQuery, setSearchQuery] = useState('');
    const [activeCategory, setActiveCategory] = useState<string>('All');

    // Live preview state
    const [previewDataset, setPreviewDataset] = useState<ExportDataset | null>(null);
    const [previewSearchQuery, setPreviewSearchQuery] = useState('');
    const [previewPage, setPreviewPage] = useState(1);
    const PREVIEW_ITEMS_PER_PAGE = 8;

    // -------------------------------------------------------------------------
    // CORE STOCK LEVEL CALCULATIONS FOR RAW MATERIALS
    // -------------------------------------------------------------------------
    const stockLevels = useMemo(() => {
        const levels: Record<string, number> = {};
        store.items.forEach(item => {
            const inward = store.inflowTransactions
                .filter(tx => tx.itemId === item.id && !tx.deletedAt)
                .reduce((sum, tx) => sum + tx.quantity, 0);
            const consumption = store.consumptionTransactions
                .filter(tx => tx.itemId === item.id && !tx.deletedAt)
                .reduce((sum, tx) => sum + tx.quantity, 0);
            levels[item.id] = (item.openingStock || 0) + inward - consumption;
        });
        return levels;
    }, [store.items, store.inflowTransactions, store.consumptionTransactions]);

    // -------------------------------------------------------------------------
    // CORE STOCK LEVEL CALCULATIONS FOR WINDOW PROFILES
    // -------------------------------------------------------------------------
    const profileStockMap = useMemo(() => {
        const map = new Map<string, { currentStock: number; packets: number; weightKg: number }>();
        const activeProfiles = store.profiles.filter(p => !p.deletedAt);
        activeProfiles.forEach(p => {
            const txns = store.profileTransactions.filter(t => t.profileId === p.id && !t.deletedAt);
            const prod = txns.filter(t => t.type === 'PRODUCTION' || t.type === 'RETURN').reduce((sum, t) => sum + Number(t.quantity || 0), 0);
            const disp = txns.filter(t => t.type === 'DISPATCH').reduce((sum, t) => sum + Number(t.quantity || 0), 0);
            const scrap = txns.filter(t => t.type === 'SCRAP').reduce((sum, t) => sum + Number(t.quantity || 0), 0);
            const currentStock = Math.max(0, prod - disp - scrap);
            const pPerPkt = p.piecesPerPacket || 1;
            const packets = pPerPkt > 0 ? Math.floor(currentStock / pPerPkt) : 0;
            const weightKg = currentStock * (p.weight || 0);
            map.set(p.id, { currentStock, packets, weightKg });
        });
        return map;
    }, [store.profiles, store.profileTransactions]);

    // -------------------------------------------------------------------------
    // REPORT DATASETS REGISTRY
    // -------------------------------------------------------------------------
    const datasets: ExportDataset[] = useMemo(() => {
        return [
            {
                id: 'rm_stock',
                title: 'Raw Materials Current Stock',
                category: 'Materials',
                description: 'Real-time inventory levels, categories, UOM, and total valuation calculations for raw materials.',
                icon: <Database className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />,
                getHeaders: () => ['SKU Code', 'Item Name', 'Category', 'UOM', 'Opening Stock', 'Current Stock', 'Reorder Point', 'Cost Price (INR)', 'Inventory Value (INR)', 'Status'],
                getRowsCount: () => store.items.filter(i => !i.deletedAt).length,
                fileName: 'Raw_Materials_Inventory_Stock',
                getData: () => {
                    const activeItems = store.items.filter(i => !i.deletedAt);
                    return activeItems.map(item => {
                        const curStock = stockLevels[item.id] || 0;
                        const value = curStock * (item.costPrice || 0);
                        const isLow = curStock <= (item.reorderPoint || 0);
                        return [
                            item.sku || 'N/A',
                            item.name || 'N/A',
                            item.category || 'General',
                            item.uom || 'N/A',
                            item.openingStock || 0,
                            curStock,
                            item.reorderPoint || 0,
                            item.costPrice || 0,
                            value,
                            isLow ? 'LOW STOCK' : 'IN STOCK'
                        ];
                    });
                }
            },
            {
                id: 'rm_inflow',
                title: 'Raw Material Inward History',
                category: 'Materials',
                description: 'Full historical ledger of raw material imports, invoices, suppliers, received quantities, and unit prices.',
                icon: <Boxes className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />,
                getHeaders: () => ['Date', 'Ref / Invoice No', 'SKU Code', 'Material Name', 'Supplier', 'Quantity Received', 'Unit Cost (INR)', 'Total Cost (INR)', 'Warehouse'],
                getRowsCount: () => store.inflowTransactions.filter(tx => !tx.deletedAt).length,
                fileName: 'Raw_Materials_Inflow_Transactions',
                getData: () => {
                    const activeInflows = store.inflowTransactions.filter(tx => !tx.deletedAt);
                    return activeInflows.map(tx => {
                        const item = store.items.find(i => i.id === tx.itemId);
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
                            tx.warehouseId === 'wh1' ? 'Main Store' : tx.warehouseId || 'Main Store'
                        ];
                    });
                }
            },
            {
                id: 'rm_consumption',
                title: 'Production Consumption Logs',
                category: 'Materials',
                description: 'Detailed records of raw material consumption utilized during extruder and window profile extrusion runs.',
                icon: <FileText className="w-5 h-5 text-orange-600 dark:text-orange-400" />,
                getHeaders: () => ['Date', 'Batch Ref No', 'SKU Code', 'Material Name', 'Quantity Consumed', 'Type', 'Warehouse'],
                getRowsCount: () => store.consumptionTransactions.filter(tx => !tx.deletedAt).length,
                fileName: 'Raw_Materials_Consumption_Ledger',
                getData: () => {
                    const activeConsumptions = store.consumptionTransactions.filter(tx => !tx.deletedAt);
                    return activeConsumptions.map(tx => {
                        const item = store.items.find(i => i.id === tx.itemId);
                        return [
                            tx.txnDate || tx.createdAt.slice(0, 10),
                            tx.refNo || 'N/A',
                            item?.sku || 'N/A',
                            item?.name || 'N/A',
                            tx.quantity || 0,
                            tx.type === 'SCRAP' ? 'Scrap / Waste' : 'Production',
                            tx.warehouseId === 'wh1' ? 'Main Store' : tx.warehouseId || 'Main Store'
                        ];
                    });
                }
            },
            {
                id: 'profile_stock',
                title: 'Window Profiles Stock List',
                category: 'Profiles',
                description: 'Comprehensive inventory list of physical pieces, packets, unit weights, and total kilograms for extruded window profiles.',
                icon: <Layers className="w-5 h-5 text-blue-600 dark:text-blue-400" />,
                getHeaders: () => ['Profile SKU', 'Brand', 'Name / Section', 'Color', 'Length (m)', 'PCs per Packet', 'Weight/PC (kg)', 'Current Stock (PCs)', 'Packets', 'Total Weight (kg)', 'Reorder Point'],
                getRowsCount: () => store.profiles.filter(p => !p.deletedAt).length,
                fileName: 'Window_Profiles_Live_Stock',
                getData: () => {
                    const activeProfiles = store.profiles.filter(p => !p.deletedAt);
                    return activeProfiles.map(p => {
                        const stockStats = profileStockMap.get(p.id) || { currentStock: 0, packets: 0, weightKg: 0 };
                        return [
                            p.sku || 'N/A',
                            p.brand || 'General',
                            p.name || 'N/A',
                            p.color || 'Standard',
                            p.length || 6,
                            p.piecesPerPacket || 1,
                            p.weight || 0,
                            stockStats.currentStock,
                            stockStats.packets,
                            Number(stockStats.weightKg.toFixed(2)),
                            p.reorderPoint || 50
                        ];
                    });
                }
            },
            {
                id: 'profile_production',
                title: 'Profile Production (Inflow)',
                category: 'Profiles',
                description: 'Factory production records logged for finished extruded window profile sections in the extrusion yard.',
                icon: <Check className="w-5 h-5 text-teal-600 dark:text-teal-400" />,
                getHeaders: () => ['Date', 'Reference No', 'Profile SKU', 'Section Name', 'Brand', 'Quantity (PCs)', 'Weight (kg)', 'Machine', 'Warehouse'],
                getRowsCount: () => store.profileTransactions.filter(t => !t.deletedAt && (t.type === 'PRODUCTION' || t.type === 'RETURN')).length,
                fileName: 'Profile_Production_Inward_Ledger',
                getData: () => {
                    const txs = store.profileTransactions.filter(t => !t.deletedAt && (t.type === 'PRODUCTION' || t.type === 'RETURN'));
                    return txs.map(tx => {
                        const p = store.profiles.find(i => i.id === tx.profileId);
                        const qty = tx.quantity || 0;
                        const weight = qty * (p?.weight || 0);
                        return [
                            tx.date || tx.createdAt.slice(0, 10),
                            tx.refNo || 'N/A',
                            p?.sku || 'N/A',
                            p?.name || 'N/A',
                            p?.brand || 'General',
                            qty,
                            Number(weight.toFixed(2)),
                            tx.machine || 'N/A',
                            'Main Store'
                        ];
                    });
                }
            },
            {
                id: 'profile_dispatch',
                title: 'Profile Dispatches (Outflow)',
                category: 'Profiles',
                description: 'Historical records of all window profile shipments, dispatches, and sales issued from the warehouse.',
                icon: <Download className="w-5 h-5 text-rose-600 dark:text-rose-400" />,
                getHeaders: () => ['Date', 'Reference No', 'Profile SKU', 'Section Name', 'Brand', 'Quantity Dispatched (PCs)', 'Total Weight (kg)', 'Customer / Details', 'Status'],
                getRowsCount: () => store.profileTransactions.filter(t => !t.deletedAt && t.type === 'DISPATCH').length,
                fileName: 'Profile_Dispatch_Outward_Ledger',
                getData: () => {
                    const txs = store.profileTransactions.filter(t => !t.deletedAt && t.type === 'DISPATCH');
                    return txs.map(tx => {
                        const p = store.profiles.find(i => i.id === tx.profileId);
                        const qty = tx.quantity || 0;
                        const weight = qty * (p?.weight || 0);
                        return [
                            tx.date || tx.createdAt.slice(0, 10),
                            tx.refNo || 'N/A',
                            p?.sku || 'N/A',
                            p?.name || 'N/A',
                            p?.brand || 'General',
                            qty,
                            Number(weight.toFixed(2)),
                            tx.customer || tx.notes || 'N/A',
                            tx.status || 'COMPLETED'
                        ];
                    });
                }
            },
            {
                id: 'profile_scrap',
                title: 'Profile Scrap & Waste Logs',
                category: 'Profiles',
                description: 'Incident logs tracking material extrusion scrap, off-cuts, or QA failure window profiles rejected on production lines.',
                icon: <ShieldAlert className="w-5 h-5 text-red-600 dark:text-red-400" />,
                getHeaders: () => ['Date', 'Reference No', 'Profile SKU', 'Section Name', 'Brand', 'Quantity Scrap (PCs)', 'Total Weight (kg)', 'Reason'],
                getRowsCount: () => store.profileTransactions.filter(t => !t.deletedAt && t.type === 'SCRAP').length,
                fileName: 'Profile_Scrap_And_Waste_Logs',
                getData: () => {
                    const txs = store.profileTransactions.filter(t => !t.deletedAt && t.type === 'SCRAP');
                    return txs.map(tx => {
                        const p = store.profiles.find(i => i.id === tx.profileId);
                        const qty = tx.quantity || 0;
                        const weight = qty * (p?.weight || 0);
                        return [
                            tx.date || tx.createdAt.slice(0, 10),
                            tx.refNo || 'N/A',
                            p?.sku || 'N/A',
                            p?.name || 'N/A',
                            p?.brand || 'General',
                            qty,
                            Number(weight.toFixed(2)),
                            tx.notes || 'Production Defect'
                        ];
                    });
                }
            },
            {
                id: 'dies_inventory',
                title: 'Extrusion Dies Inventory',
                category: 'Config',
                description: 'Listing of core active tooling machinery dies, brand and cavities status.',
                icon: <Hammer className="w-5 h-5 text-amber-600 dark:text-amber-400" />,
                getHeaders: () => ['Die Number', 'Brand', 'Cavities', 'Expected Output (kg/hr)', 'Lifespan (meters)', 'Status'],
                getRowsCount: () => store.dies.length,
                fileName: 'Extrusion_Dies_Inventory',
                getData: () => {
                    return store.dies.map(die => [
                        die.dieNo || 'N/A',
                        die.brand || 'N/A',
                        die.cavities || 0,
                        die.expectedOutputKgHr || 0,
                        die.lifespanMeters || 0,
                        die.status || 'ACTIVE'
                    ]);
                }
            },
            {
                id: 'formulas_list',
                title: 'Manufacturing Formulas',
                category: 'Config',
                description: 'Recipe list and standard proportions of stabilizers, resins, and chemicals utilized in composite mixers.',
                icon: <ClipboardList className="w-5 h-5 text-violet-600 dark:text-violet-400" />,
                getHeaders: () => ['Formula Name', 'Output Product', 'Output Quantity', 'Active Ingredients Listing'],
                getRowsCount: () => store.formulas.length,
                fileName: 'Standard_Mix_Formulas',
                getData: () => {
                    return store.formulas.map(formula => {
                        const ingredientSummary = formula.ingredients.map(ing => {
                            const item = store.items.find(i => i.id === ing.itemId);
                            return `${item?.name || 'Unknown'} (${ing.quantity}${item?.uom || 'kg'})`;
                        }).join(', ');
                        return [
                            formula.name || 'N/A',
                            formula.outputProduct || 'N/A',
                            `${formula.outputQuantity} ${formula.outputUom}`,
                            ingredientSummary || 'None'
                        ];
                    });
                }
            },
            {
                id: 'suppliers_directory',
                title: 'Suppliers & Vendors Directory',
                category: 'Procurement',
                description: 'Master directory details, contact records, and primary mailing address records for raw material suppliers.',
                icon: <Building className="w-5 h-5 text-sky-600 dark:text-sky-400" />,
                getHeaders: () => ['Supplier Name', 'Contact Person', 'Phone Number', 'Email Address', 'Physical Address'],
                getRowsCount: () => store.suppliers.length,
                fileName: 'Suppliers_Master_Directory',
                getData: () => {
                    return store.suppliers.map(s => [
                        s.name || 'N/A',
                        s.contactPerson || 'N/A',
                        s.phone || 'N/A',
                        s.email || 'N/A',
                        s.address || 'N/A'
                    ]);
                }
            },
            {
                id: 'purchase_orders',
                title: 'Purchase Orders Procurement Logs',
                category: 'Procurement',
                description: 'Procurement transaction purchase orders raised to suppliers, dates, net order values, and status flags.',
                icon: <FileSpreadsheet className="w-5 h-5 text-fuchsia-600 dark:text-fuchsia-400" />,
                getHeaders: () => ['PO Number', 'Supplier Name', 'Order Date', 'Expected Delivery', 'PO Value (INR)', 'Status'],
                getRowsCount: () => store.purchaseOrders.length,
                fileName: 'Purchase_Orders_Procurement_Logs',
                getData: () => {
                    return store.purchaseOrders.map(po => {
                        const supplier = store.suppliers.find(s => s.id === po.supplierId);
                        const poValue = po.items.reduce((sum, item) => sum + (item.quantity * item.unitCost), 0);
                        return [
                            po.poNumber || 'N/A',
                            supplier?.name || 'N/A',
                            po.createdAt.slice(0, 10),
                            po.expectedDate || 'N/A',
                            poValue,
                            po.status || 'PENDING'
                        ];
                    });
                }
            },
            {
                id: 'protective_films',
                title: 'Protective Films Inventory',
                category: 'Materials',
                description: 'Live physical stock levels, widths, brand specifications, micron counts, and status for protective films and sticker inventory.',
                icon: <Database className="w-5 h-5 text-blue-600 dark:text-blue-400" />,
                getHeaders: () => ['Film Brand', 'Film Width (mm)', 'Microns', 'Color', 'Current Stock (Meters)', 'Status', 'Description'],
                getRowsCount: () => store.protectiveFilmItems.length,
                fileName: 'Protective_Films_Live_Stock',
                getData: () => {
                    return store.protectiveFilmItems.map(f => [
                        f.brand || 'N/A',
                        f.filmWidth || 'N/A',
                        f.micron || 0,
                        f.color || 'Standard',
                        f.currentStockMeters || 0,
                        f.status || 'ACTIVE',
                        f.description || 'N/A'
                    ]);
                }
            }
        ];
    }, [store, stockLevels, profileStockMap]);

    // Filter datasets based on search query and active category
    const filteredDatasets = useMemo(() => {
        return datasets.filter(d => {
            const matchesSearch = d.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                                  d.description.toLowerCase().includes(searchQuery.toLowerCase());
            const matchesCategory = activeCategory === 'All' || d.category === activeCategory;
            return matchesSearch && matchesCategory;
        });
    }, [datasets, searchQuery, activeCategory]);

    // -------------------------------------------------------------------------
    // EXPORT IMPLEMENTATION (EXCEL)
    // -------------------------------------------------------------------------
    const handleExportExcel = (dataset: ExportDataset) => {
        try {
            const headers = dataset.getHeaders();
            const rows = dataset.getData();
            if (rows.length === 0) {
                addToast('No records available to export for this dataset.', 'error');
                return;
            }

            const wb = XLSX.utils.book_new();
            const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
            XLSX.utils.book_append_sheet(wb, ws, dataset.title.substring(0, 30));
            
            const dateStr = new Date().toISOString().split('T')[0];
            XLSX.writeFile(wb, `${dataset.fileName}_${dateStr}.xlsx`);
            addToast(`Successfully downloaded Excel sheet: ${dataset.title}`, 'success');
        } catch (error) {
            console.error('Excel Export Error:', error);
            addToast('Failed to generate Excel sheet.', 'error');
        }
    };

    // -------------------------------------------------------------------------
    // EXPORT IMPLEMENTATION (PDF)
    // -------------------------------------------------------------------------
    const handleExportPdf = (dataset: ExportDataset) => {
        try {
            const headers = dataset.getHeaders();
            const rows = dataset.getData();
            if (rows.length === 0) {
                addToast('No records available to export for this dataset.', 'error');
                return;
            }

            const { jsPDF } = jspdf;
            const doc = new jsPDF({ orientation: 'landscape' });
            
            const generatedDate = new Date().toLocaleDateString();
            doc.text(`${dataset.title} - ERP Reports`, 14, 15);
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
            doc.save(`${dataset.fileName}_${dateStr}.pdf`);
            addToast(`Successfully downloaded PDF report: ${dataset.title}`, 'success');
        } catch (error) {
            console.error('PDF Export Error:', error);
            addToast('Failed to generate PDF document.', 'error');
        }
    };

    // -------------------------------------------------------------------------
    // PREVIEW FILTER & PAGINATION
    // -------------------------------------------------------------------------
    const previewData = useMemo(() => {
        if (!previewDataset) return { headers: [], rows: [] };
        const headers = previewDataset.getHeaders();
        const rows = previewDataset.getData();
        return { headers, rows };
    }, [previewDataset]);

    const filteredPreviewRows = useMemo(() => {
        if (!previewData.rows) return [];
        if (!previewSearchQuery) return previewData.rows;
        return previewData.rows.filter(row => {
            return row.some(cell => String(cell).toLowerCase().includes(previewSearchQuery.toLowerCase()));
        });
    }, [previewData, previewSearchQuery]);

    const paginatedPreviewRows = useMemo(() => {
        const start = (previewPage - 1) * PREVIEW_ITEMS_PER_PAGE;
        return filteredPreviewRows.slice(start, start + PREVIEW_ITEMS_PER_PAGE);
    }, [filteredPreviewRows, previewPage]);

    const totalPages = Math.ceil(filteredPreviewRows.length / PREVIEW_ITEMS_PER_PAGE);

    return (
        <div className="space-y-6">
            {/* Header section */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm">
                <div>
                    <h1 className="text-2xl font-display font-black text-slate-900 dark:text-white uppercase tracking-tight italic flex items-center gap-2">
                        <Download className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
                        Central Download & Export Hub
                    </h1>
                    <p className="text-xs font-semibold text-slate-500 mt-1">Consolidated portal to export any ERP logs, inventory lists, and procurement history to formatted PDF or Excel.</p>
                </div>
                <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-50/50 dark:bg-blue-950/20 border border-blue-100/50 dark:border-blue-900/50 rounded-xl max-w-sm">
                    <Info className="w-4 h-4 text-blue-500 flex-shrink-0" />
                    <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400">All exports are compiled instantly from real-time database tables.</span>
                </div>
            </div>

            {/* Filter and Search Bar */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-50 dark:bg-slate-900/40 p-4 rounded-2xl border border-slate-100 dark:border-slate-800">
                {/* Search query input */}
                <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input 
                        type="text" 
                        placeholder="Search exportable tables, logs or registries..."
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-700 dark:text-slate-200 shadow-sm"
                    />
                </div>

                {/* Filter Categories tabs */}
                <div className="flex flex-wrap gap-1 p-1 bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm">
                    {['All', 'Materials', 'Profiles', 'Procurement', 'Config'].map(cat => (
                        <button
                            key={cat}
                            onClick={() => { setActiveCategory(cat); setSearchQuery(''); }}
                            className={`px-4 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all duration-200 ${
                                activeCategory === cat 
                                    ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-md' 
                                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700'
                            }`}
                        >
                            {cat === 'Config' ? 'Setup & Config' : cat}
                        </button>
                    ))}
                </div>
            </div>

            {/* Grid of Datasets */}
            {filteredDatasets.length === 0 ? (
                <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 p-12 text-center text-slate-500 font-bold uppercase tracking-widest text-xs">
                    No matching report datasets found. Try adjusting your filters.
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredDatasets.map(dataset => {
                        const count = dataset.getRowsCount();
                        return (
                            <div 
                                key={dataset.id}
                                className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl p-6 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between"
                            >
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-inner">
                                            {dataset.icon}
                                        </div>
                                        <span className="text-[10px] font-black uppercase px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200/50 dark:border-slate-700/50">
                                            {count} {count === 1 ? 'Record' : 'Records'}
                                        </span>
                                    </div>
                                    <div>
                                        <h3 className="text-base font-bold text-slate-900 dark:text-white leading-tight">
                                            {dataset.title}
                                        </h3>
                                        <p className="text-xs text-slate-500 mt-1.5 leading-relaxed font-semibold">
                                            {dataset.description}
                                        </p>
                                    </div>
                                </div>

                                <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800 grid grid-cols-3 gap-2">
                                    <button
                                        onClick={() => { setPreviewDataset(dataset); setPreviewSearchQuery(''); setPreviewPage(1); }}
                                        className="py-2 px-3 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-200/30 dark:border-slate-700/50 rounded-xl text-[10px] font-black uppercase tracking-tight text-slate-700 dark:text-slate-300 transition-colors flex items-center justify-center gap-1.5"
                                        title="Preview raw data"
                                    >
                                        <Eye className="w-3.5 h-3.5 text-slate-500" />
                                        Preview
                                    </button>
                                    <button
                                        onClick={() => handleExportExcel(dataset)}
                                        className="py-2 px-3 bg-emerald-50 dark:bg-emerald-950/20 hover:bg-emerald-100/50 dark:hover:bg-emerald-950/40 border border-emerald-100 dark:border-emerald-900/50 rounded-xl text-[10px] font-black uppercase tracking-tight text-emerald-700 dark:text-emerald-400 transition-colors flex items-center justify-center gap-1.5"
                                    >
                                        <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-500" />
                                        Excel
                                    </button>
                                    <button
                                        onClick={() => handleExportPdf(dataset)}
                                        className="py-2 px-3 bg-rose-50 dark:bg-rose-950/20 hover:bg-rose-100/50 dark:hover:bg-rose-950/40 border border-rose-100 dark:border-rose-900/50 rounded-xl text-[10px] font-black uppercase tracking-tight text-rose-700 dark:text-rose-400 transition-colors flex items-center justify-center gap-1.5"
                                    >
                                        <FileText className="w-3.5 h-3.5 text-rose-500" />
                                        PDF
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Interactive Table Preview Modal / Side Drawer */}
            {previewDataset && (
                <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-center justify-end p-0 md:p-4" onClick={() => setPreviewDataset(null)}>
                    <div 
                        className="bg-white dark:bg-slate-900 w-full max-w-5xl h-full md:h-[90vh] rounded-none md:rounded-3xl shadow-2xl flex flex-col justify-between overflow-hidden border border-slate-100 dark:border-slate-800"
                        onClick={e => e.stopPropagation()}
                    >
                        {/* Drawer Header */}
                        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between flex-wrap gap-4 bg-slate-50 dark:bg-slate-800/20">
                            <div>
                                <span className="text-[10px] font-black uppercase tracking-widest text-indigo-500">Live Report Preview</span>
                                <h2 className="text-lg font-bold text-slate-900 dark:text-white leading-none mt-1">{previewDataset.title}</h2>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => handleExportExcel(previewDataset)}
                                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-colors flex items-center gap-1.5 shadow-sm"
                                >
                                    <FileSpreadsheet className="w-4 h-4" /> Download Excel
                                </button>
                                <button
                                    onClick={() => handleExportPdf(previewDataset)}
                                    className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-colors flex items-center gap-1.5 shadow-sm"
                                >
                                    <FileText className="w-4 h-4" /> Download PDF
                                </button>
                                <button 
                                    onClick={() => setPreviewDataset(null)}
                                    className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-150 dark:hover:bg-slate-800 rounded-xl transition-colors"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                        </div>

                        {/* Search and Metadata inside Preview Drawer */}
                        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between flex-wrap gap-3">
                            <div className="relative w-full max-w-sm">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <input 
                                    type="text" 
                                    placeholder="Search in this preview dataset..."
                                    value={previewSearchQuery}
                                    onChange={e => { setPreviewSearchQuery(e.target.value); setPreviewPage(1); }}
                                    className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-700 dark:text-slate-200"
                                />
                            </div>
                            <div className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                                Total Records: {filteredPreviewRows.length} {filteredPreviewRows.length !== previewData.rows.length && `(filtered from ${previewData.rows.length})`}
                            </div>
                        </div>

                        {/* Table Content */}
                        <div className="flex-1 overflow-auto p-6">
                            {filteredPreviewRows.length === 0 ? (
                                <div className="text-center py-20 text-slate-500 font-bold uppercase tracking-widest text-xs">
                                    No records found matching preview search query.
                                </div>
                            ) : (
                                <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-inner max-w-full">
                                    <table className="w-full text-left text-slate-600 dark:text-slate-300 text-xs">
                                        <thead className="bg-slate-100 dark:bg-slate-800 text-[10px] font-black uppercase text-slate-700 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                                            <tr>
                                                {previewData.headers.map((h, idx) => (
                                                    <th key={idx} className="px-5 py-4 whitespace-nowrap">{h}</th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                            {paginatedPreviewRows.map((row, rowIdx) => (
                                                <tr key={rowIdx} className="hover:bg-slate-50/50 dark:hover:bg-slate-850/50 transition-colors">
                                                    {row.map((cell, cellIdx) => (
                                                        <td key={cellIdx} className="px-5 py-4 whitespace-nowrap font-semibold">
                                                            {typeof cell === 'number' ? cell.toLocaleString() : String(cell)}
                                                        </td>
                                                    ))}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>

                        {/* Drawer Pagination Footer */}
                        {totalPages > 1 && (
                            <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/10 flex items-center justify-between">
                                <button
                                    disabled={previewPage === 1}
                                    onClick={() => setPreviewPage(p => Math.max(1, p - 1))}
                                    className="px-4 py-2 border border-slate-200 dark:border-slate-700 text-xs font-black uppercase rounded-xl disabled:opacity-40 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition-colors"
                                >
                                    Previous
                                </button>
                                <span className="text-xs font-semibold text-slate-500">
                                    Page {previewPage} of {totalPages}
                                </span>
                                <button
                                    disabled={previewPage === totalPages}
                                    onClick={() => setPreviewPage(p => Math.min(totalPages, p + 1))}
                                    className="px-4 py-2 border border-slate-200 dark:border-slate-700 text-xs font-black uppercase rounded-xl disabled:opacity-40 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition-colors"
                                >
                                    Next
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default ExportHub;
