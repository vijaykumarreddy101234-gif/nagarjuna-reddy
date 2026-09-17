import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'motion/react';
import { Card } from '../components/Card';
import { WarningIcon, SparklesIcon, SpinnerIcon, PlusIcon, TruckIcon, FileTextIcon } from '../components/Icon';
import { RefreshCw, Layers, ShieldCheck, ArrowRight, UploadCloud, CheckCircle2, AlertTriangle, Package, Boxes, FileSpreadsheet, Eye } from 'lucide-react';
import type { Item, Formula, BatchForecastResult, ToastMessage, ID, Page, Profile, ProfileTransaction } from '../types';
import { useStore } from '../store/useStore';
import ItemListModal from '../components/ItemListModal';
import LowStockItemsModal from '../components/LowStockItemsModal';
import InventoryValueModal from '../components/InventoryValueModal';
import BatchCalculator from '../components/BatchCalculator';
import BatchForecastModal from '../components/BatchForecastModal';
import MarkdownRenderer from '../components/MarkdownRenderer';


declare const Chart: any;

// --- PORTAL COMPONENT ---
// This lifts the modals out of the current component's DOM tree and renders them at the top level (document.body).
// This is essential to bypass CSS stacking context issues caused by parent animations (like animate-fade-in-right).
const Portal = ({ children }) => {
    return createPortal(children, document.body);
};


export interface ReorderSuggestion {
    itemId: ID;
    name: string;
    sku: string;
    currentStock: number;
    suggestedReorder: number;
    uom: string;
    reason: string;
}

interface DashboardStats {
    totalItems: number;
    lowStockItems: (Item & { currentStock: number })[];
    totalInventoryValue: number;
    inventoryValueDistribution: { name: string, value: number }[];
    monthlyOperations: { [key: string]: { inflow: number, consumption: number } };
    totalBatches: number;
    smartReorderSuggestions: ReorderSuggestion[];
    categoryStats: Record<string, { count: number, value: number }>;
}

interface DashboardProps {
    items: Item[];
    stockLevels: Record<string, number>;
    stats: DashboardStats;
    formulas: Formula[];
    addToast: (message: string, type: ToastMessage['type']) => void;
    navigate: (page: string, initialTab?: string, initialSubTab?: string, openModal?: string) => void;
}

const Dashboard = ({ items, stockLevels, stats, formulas, addToast, navigate }) => {
    const [isItemsModalOpen, setIsItemsModalOpen] = useState(false);
    const [isLowStockModalOpen, setIsLowStockModalOpen] = useState(false);
    const [isInventoryValueModalOpen, setIsInventoryValueModalOpen] = useState(false);
    const [isForecastModalOpen, setIsForecastModalOpen] = useState(false);
    const [forecastData, setForecastData] = useState<BatchForecastResult | null>(null);

    // --- BRAND-WISE PROFILES & STOCK SYNCHRONIZATION STATE ---
    const storeProfiles = useStore(state => state.profiles);
    const storeProfileTxns = useStore(state => state.profileTransactions);
    const storeFilms = useStore(state => state.protectiveFilmItems);
    const storeDies = useStore(state => state.dies);
    const storeBrands = useStore(state => state.brands);
    const syncProfilesToStock = useStore(state => state.syncProfilesToStock);

    const [selectedBrand, setSelectedBrand] = useState<string>('All');
    const [isSyncingBrand, setIsSyncingBrand] = useState(false);

    const brandProfiles = useMemo(() => {
        return storeProfiles.filter(p => !p.deletedAt && (!p.profileType || p.profileType === 'WINDOW'));
    }, [storeProfiles]);

    const activeBrands = useMemo(() => {
        const brandSet = new Set<string>();
        storeBrands.forEach(b => brandSet.add(b));
        brandProfiles.forEach(p => { if (p.brand) brandSet.add(p.brand); });
        return Array.from(brandSet);
    }, [storeBrands, brandProfiles]);

    // Calculate live stock per profile
    const profileStockMap = useMemo(() => {
        // Group transactions by profileId once for O(1) lookup
        const txByProfile = new Map<string, ProfileTransaction[]>();
        storeProfileTxns.forEach(t => {
            if (!t.deletedAt && t.profileId) {
                const list = txByProfile.get(t.profileId) || [];
                list.push(t);
                txByProfile.set(t.profileId, list);
            }
        });

        const map = new Map<string, { currentStock: number; packets: number; weightKg: number; reservedStock: number; isLowStock: boolean }>();
        brandProfiles.forEach(p => {
            const txns = txByProfile.get(p.id) || [];
            
            let prod = 0;
            let disp = 0;
            let scrap = 0;
            let reserved = 0;

            txns.forEach(t => {
                const qty = Number(t.quantity || 0);
                if (t.type === 'PRODUCTION' || t.type === 'RETURN') {
                    prod += qty;
                } else if (t.type === 'DISPATCH') {
                    disp += qty;
                } else if (t.type === 'SCRAP') {
                    scrap += qty;
                } else if (t.type === 'QUOTATION' && t.status === 'PENDING') {
                    reserved += qty;
                }
            });

            const curStock = Math.max(0, prod - disp - scrap);
            const pPerPkt = p.piecesPerPacket || 1;
            const pkts = pPerPkt > 0 ? Math.floor(curStock / pPerPkt) : 0;
            const wt = curStock * (p.weight || 0);
            const reorderPoint = (p.reorderPoint !== undefined && p.reorderPoint > 0) ? p.reorderPoint : 50;
            
            map.set(p.id, {
                currentStock: curStock,
                packets: pkts,
                weightKg: wt,
                reservedStock: reserved,
                isLowStock: curStock <= reorderPoint
            });
        });
        return map;
    }, [brandProfiles, storeProfileTxns]);

    // Brand filtered metrics
    const brandFilteredProfiles = useMemo(() => {
        if (selectedBrand === 'All') return brandProfiles;
        return brandProfiles.filter(p => (p.brand || 'General').toLowerCase() === selectedBrand.toLowerCase());
    }, [brandProfiles, selectedBrand]);

    const brandStats = useMemo(() => {
        let totalPieces = 0;
        let totalWeightKg = 0;
        let totalValue = 0;
        let lowStockCount = 0;
        let filmMappedCount = 0;

        brandFilteredProfiles.forEach(p => {
            const stock = profileStockMap.get(p.id) || { currentStock: 0, weightKg: 0, isLowStock: false };
            totalPieces += stock.currentStock;
            totalWeightKg += stock.weightKg;
            totalValue += stock.currentStock * (p.price || 150);
            if (stock.isLowStock) lowStockCount++;
            const hasFilm = storeFilms.some(f => 
                String(f.profileCode || '').toLowerCase() === String(p.sku || '').toLowerCase() && 
                String(f.brand || 'General').toLowerCase() === String(p.brand || 'General').toLowerCase() &&
                Boolean(f.topFilmWidth)
            );
            if (hasFilm) filmMappedCount++;
        });

        const filmCoveragePercent = brandFilteredProfiles.length > 0 
            ? Math.round((filmMappedCount / brandFilteredProfiles.length) * 100) 
            : 100;

        return {
            totalProfiles: brandFilteredProfiles.length,
            totalPieces,
            totalWeightKg,
            totalValue,
            lowStockCount,
            filmCoveragePercent
        };
    }, [brandFilteredProfiles, profileStockMap, storeFilms]);

    const handleSyncBrandNow = () => {
        setIsSyncingBrand(true);
        syncProfilesToStock();
        setTimeout(() => {
            setIsSyncingBrand(false);
            addToast(`Brand profile & stock synchronized across all tabs (Profiles, Stock, Films, Dies, Quotes)!`, 'success');
        }, 300);
    };

    const [aiInsights, setAiInsights] = useState<string>('');
    const [isGeneratingInsights, setIsGeneratingInsights] = useState(false);

    const valueChartRef = useRef<HTMLCanvasElement>(null);
    const opsChartRef = useRef<HTMLCanvasElement>(null);
    const valueChartInstance = useRef<any>(null);
    const opsChartInstance = useRef<any>(null);

    // --- FORECAST STATE LIFTED FROM BATCH CALCULATOR ---
    const [selectedFormulaId, setSelectedFormulaId] = useState<string>(formulas[0]?.id || '');
    const itemMap = useMemo(() => new Map<string, Item>(items.map(item => [item.id, item])), [items]);

    const calculationResult = useMemo<BatchForecastResult | null>(() => {
        if (!selectedFormulaId) return null;
        const formula = formulas.find(f => f.id === selectedFormulaId);
        if (!formula) return null;

        let maxBatches = Infinity;
        let limitingIngredientId: string | null = null;

        const ingredientDetails = formula.ingredients.map(ingredient => {
            const item = itemMap.get(ingredient.itemId);
            const requiredQty = ingredient.quantity;
            const availableStock = stockLevels[ingredient.itemId] ?? 0;
            const possibleBatches = requiredQty > 0 ? Math.floor(availableStock / requiredQty) : Infinity;

            if (possibleBatches < maxBatches) {
                maxBatches = possibleBatches;
                limitingIngredientId = ingredient.itemId;
            }

            return {
                itemId: ingredient.itemId,
                name: item?.name || 'Unknown Item',
                uom: item?.uom || '',
                requiredQty,
                availableStock,
                possibleBatches,
            };
        });

        if (maxBatches === Infinity) {
             maxBatches = 0; // case where formula has no ingredients or all reqs are 0
        }

        return {
            maxBatches,
            limitingIngredientId,
            ingredientDetails,
            formula,
        };
    }, [selectedFormulaId, formulas, stockLevels, itemMap]);
    // ---------------------------------------------------

    const handleGenerateInsights = async () => {
        setIsGeneratingInsights(true);
        setAiInsights('');

        const simplifiedLowStock = stats.lowStockItems.map(({ name, sku, currentStock, reorderPoint, uom }) => 
            ({ name, sku, currentStock, reorderPoint, uom })
        );

        const dataForAI = {
            total_items: stats.totalItems,
            low_stock_items_count: simplifiedLowStock.length,
            low_stock_items_details: simplifiedLowStock,
            total_inventory_value_inr: stats.totalInventoryValue,
            last_6_months_operations: stats.monthlyOperations,
        };

        try {
            const res = await fetch('/api/ai/insights', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ inventoryData: dataForAI })
            });
            const data = await res.json();
            if (data.insights) {
                setAiInsights(data.insights);
            } else {
                setAiInsights('### 📊 Inventory Intelligence Summary\n- Stock data processed successfully.\n- Verify low stock items and reorder points in the dashboard.');
            }
        } catch (error) {
            console.warn("AI insight generation fetch notice:", error);
            addToast("Generated local inventory intelligence summary.", "info");
            setAiInsights(`### 📊 Inventory Intelligence Summary\n- **Inventory Scale**: ${stats.totalItems} active materials.\n- **Low Stock Watch**: ${simplifiedLowStock.length} items near or below reorder threshold.\n- **Total Stock Valuation**: ₹${Number(stats.totalInventoryValue || 0).toLocaleString('en-IN')}`);
        } finally {
            setIsGeneratingInsights(false);
        }
    };

    useEffect(() => {
        if (typeof Chart === 'undefined') return;

        const isDarkMode = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
        const gridColor = isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)';
        const textColor = isDarkMode ? '#E5E7EB' : '#374151';

        // Inventory Value Distribution Chart
        if (valueChartRef.current && stats.inventoryValueDistribution && stats.inventoryValueDistribution.length > 0) {
            if(valueChartInstance.current) valueChartInstance.current.destroy();
            const top5 = stats.inventoryValueDistribution.slice(0, 5);
            const othersValue = stats.inventoryValueDistribution.slice(5).reduce((acc, item) => acc + item.value, 0);
            const labels = [...top5.map(item => item.name), ...(othersValue > 0 ? ['Others'] : [])];
            const data = [...top5.map(item => item.value), ...(othersValue > 0 ? [othersValue] : [])];

            const ctx = valueChartRef.current.getContext('2d');
            if (ctx) {
                valueChartInstance.current = new Chart(ctx, {
                    type: 'pie',
                    data: {
                        labels: labels,
                        datasets: [{
                            label: 'Inventory Value',
                            data: data,
                            backgroundColor: ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#6B7280'],
                            borderColor: isDarkMode ? '#1F2937' : '#FFFFFF',
                            borderWidth: 2,
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: { legend: { position: 'right', labels: { color: textColor } }, title: { display: false } }
                    }
                });
            }
        }

        // Monthly Operations Chart
        if (opsChartRef.current && stats.monthlyOperations && Object.keys(stats.monthlyOperations).length > 0) {
            if(opsChartInstance.current) opsChartInstance.current.destroy();
            const labels = Object.keys(stats.monthlyOperations).map(key => new Date(key + '-02').toLocaleString('default', { month: 'short' }));
            const inflowData = Object.values(stats.monthlyOperations).map((d: any) => d.inflow);
            const consumptionData = Object.values(stats.monthlyOperations).map((d: any) => d.consumption);
            
            const ctx = opsChartRef.current.getContext('2d');
            if (ctx) {
                opsChartInstance.current = new Chart(ctx, {
                    type: 'bar',
                    data: {
                        labels,
                        datasets: [
                            { label: 'Inflow Value', data: inflowData, backgroundColor: '#3B82F6' },
                            { label: 'Consumption Value', data: consumptionData, backgroundColor: '#F59E0B' }
                        ]
                    },
                    options: {
                        responsive: true, maintainAspectRatio: false,
                        scales: {
                            y: { ticks: { color: textColor }, grid: { color: gridColor } },
                            x: { ticks: { color: textColor }, grid: { color: gridColor } }
                        },
                        plugins: { legend: { position: 'top', labels: { color: textColor } }, title: { display: false } }
                    }
                });
            }
        }
        
        return () => {
            if(valueChartInstance.current) valueChartInstance.current.destroy();
            if(opsChartInstance.current) opsChartInstance.current.destroy();
        };

    }, [stats]);
    
    const handleForecastClick = (result: BatchForecastResult) => {
        setForecastData(result);
        setIsForecastModalOpen(true);
    };

    return (
        <div className="space-y-12">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div>
                    <motion.h1 
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="text-4xl font-display font-black text-slate-900 dark:text-white uppercase tracking-tighter italic"
                    >
                        Operations Overview
                    </motion.h1>
                    <p className="text-slate-500 font-medium mt-1">Real-time intelligence and inventory monitoring.</p>
                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 lg:gap-6">
                <motion.button 
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => navigate('Profiles & Stock', 'Production', 'Inflow', 'ADD_PRODUCTION')}
                    className="group relative overflow-hidden flex items-center justify-between p-4 sm:p-6 lg:p-8 bg-emerald-600 text-white rounded-2xl sm:rounded-3xl shadow-xl shadow-emerald-500/20 transition-all duration-300 text-left cursor-pointer"
                >
                    <div className="relative z-10">
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-80 mb-1 sm:mb-2">Manufacturing</p>
                        <span className="text-xl sm:text-2xl font-display font-black uppercase tracking-tight italic">Add Production</span>
                        <p className="text-xs font-semibold text-emerald-100/90 mt-1">Record extrusion output & inflow</p>
                    </div>
                    <div className="relative z-10 w-10 h-10 sm:w-12 sm:h-12 bg-white/20 rounded-2xl flex items-center justify-center group-hover:rotate-12 transition-transform shrink-0 ml-3">
                        <PlusIcon className="w-5 h-5 sm:w-6 sm:h-6" />
                    </div>
                    <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-16 -mt-16 group-hover:scale-150 transition-transform duration-500 pointer-events-none" />
                </motion.button>

                <motion.button 
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => navigate('Profiles & Stock', 'Production', 'Outflow', 'DISPATCH_ORDER')}
                    className="group relative overflow-hidden flex items-center justify-between p-4 sm:p-6 lg:p-8 bg-blue-600 text-white rounded-2xl sm:rounded-3xl shadow-xl shadow-blue-500/20 transition-all duration-300 text-left cursor-pointer"
                >
                    <div className="relative z-10">
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-80 mb-1 sm:mb-2">Logistics</p>
                        <span className="text-xl sm:text-2xl font-display font-black uppercase tracking-tight italic">Dispatch Order</span>
                        <p className="text-xs font-semibold text-blue-100/90 mt-1">Record customer dispatch & DC</p>
                    </div>
                    <div className="relative z-10 w-10 h-10 sm:w-12 sm:h-12 bg-white/20 rounded-2xl flex items-center justify-center group-hover:-rotate-12 transition-transform shrink-0 ml-3">
                        <TruckIcon className="w-5 h-5 sm:w-6 sm:h-6" />
                    </div>
                    <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-16 -mt-16 group-hover:scale-150 transition-transform duration-500 pointer-events-none" />
                </motion.button>

                <motion.button 
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => navigate('Profiles & Stock', 'Quotations', undefined, 'NEW_QUOTATION')}
                    className="group relative overflow-hidden flex items-center justify-between p-4 sm:p-6 lg:p-8 bg-indigo-600 text-white rounded-2xl sm:rounded-3xl shadow-xl shadow-indigo-500/20 transition-all duration-300 text-left cursor-pointer sm:col-span-2 lg:col-span-1"
                >
                    <div className="relative z-10">
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-80 mb-1 sm:mb-2">Commercial</p>
                        <span className="text-xl sm:text-2xl font-display font-black uppercase tracking-tight italic">New Quotation</span>
                        <p className="text-xs font-semibold text-indigo-100/90 mt-1">Create price estimate & quote</p>
                    </div>
                    <div className="relative z-10 w-10 h-10 sm:w-12 sm:h-12 bg-white/20 rounded-2xl flex items-center justify-center group-hover:rotate-12 transition-transform shrink-0 ml-3">
                        <FileTextIcon className="w-5 h-5 sm:w-6 sm:h-6" />
                    </div>
                    <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-16 -mt-16 group-hover:scale-150 transition-transform duration-500 pointer-events-none" />
                </motion.button>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4 lg:gap-6">
                 {[
                    { label: 'Asset Collection', sub: 'Total Unique SKUs', value: stats.totalItems, onClick: () => setIsItemsModalOpen(true), color: 'blue', icon: '📦' },
                    { label: 'Inventory Capital', sub: 'Calculated Net Value', value: stats.totalInventoryValue.toLocaleString('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }), onClick: () => setIsInventoryValueModalOpen(true), color: 'emerald', isCurrency: true, icon: '🏛️' },
                    { label: 'Production Ceiling', sub: 'Max Possible Runs', value: calculationResult?.maxBatches ?? 'N/A', onClick: () => calculationResult && handleForecastClick(calculationResult), color: 'indigo', disabled: !calculationResult, icon: '⚡' },
                    { label: 'Total Batches Run', sub: 'Completed Production Batches', value: stats.totalBatches, onClick: () => navigate('RM Section', 'Consumption'), color: 'purple', icon: '🧪' },
                    { label: 'Stock Criticality', sub: 'Action Required Items', value: stats.lowStockItems.length, onClick: () => setIsLowStockModalOpen(true), color: 'orange', disabled: stats.lowStockItems.length === 0, icon: '🚨' }
                 ].map((stat, idx) => {
                    const dotColors: Record<string, string> = {
                        blue: 'bg-blue-500',
                        emerald: 'bg-emerald-500',
                        indigo: 'bg-indigo-500',
                        orange: 'bg-orange-500',
                        purple: 'bg-purple-500'
                    };
                    return (
                        <motion.button 
                            key={stat.label}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: idx * 0.1 }}
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={stat.onClick}
                            disabled={stat.disabled}
                            className={`group text-left focus:outline-none focus:ring-2 rounded-2xl sm:rounded-3xl transition-all ${stat.disabled ? 'opacity-70 cursor-default' : `focus:ring-${stat.color}-500 shadow-md hover:shadow-xl`}`}
                        >
                            <Card className="h-full border-b-4 border-slate-100 dark:border-slate-800 p-4 sm:p-6 lg:p-8 flex flex-col justify-between">
                                <div className="flex justify-between items-start mb-4 sm:mb-6">
                                    <div className="p-2.5 sm:p-3 bg-slate-100 dark:bg-slate-800 rounded-xl sm:rounded-2xl text-xl sm:text-2xl group-hover:scale-110 transition-transform">
                                        {stat.icon}
                                    </div>
                                    <div className={`w-2 h-2 rounded-full ${dotColors[stat.color] || 'bg-primary-500'} animate-pulse`} />
                                </div>
                                <div>
                                    <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">{stat.label}</h2>
                                    <p className={`text-2xl sm:text-3xl font-display font-black tracking-tight ${stat.isCurrency ? 'text-emerald-600' : stat.color === 'orange' && Number(stat.value) > 0 ? 'text-orange-500' : 'text-slate-900 dark:text-white'}`}>
                                        {stat.value}
                                    </p>
                                    <p className="text-[10px] text-slate-500 mt-2 font-semibold italic">{stat.sub}</p>
                                </div>
                            </Card>
                        </motion.button>
                    );
                 })}
            </div>

            <motion.div 
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
            >
                <BatchCalculator 
                    formulas={formulas}
                    selectedFormulaId={selectedFormulaId}
                    onFormulaChange={setSelectedFormulaId}
                    calculationResult={calculationResult}
                    onForecastClick={handleForecastClick}
                />
            </motion.div>

            <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
                <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                    viewport={{ once: true }}
                    className="lg:col-span-2"
                >
                    <Card className="h-[450px] flex flex-col p-8">
                        <div className="mb-8">
                            <h2 className="text-xl font-display font-black uppercase tracking-tight italic">Category Capital</h2>
                            <p className="text-xs font-medium text-slate-500">Distribution of stock value across groups.</p>
                        </div>
                        <div className="flex-1 overflow-y-auto space-y-4 pr-2 scrollbar-style">
                            {stats.categoryStats && Object.entries(stats.categoryStats).map(([category, data]) => {
                                const catData = data as { count: number, value: number };
                                return (
                                    <div key={category} className="group flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl hover:bg-white dark:hover:bg-slate-800 transition-all border border-transparent hover:border-slate-200 dark:hover:border-slate-700">
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 rounded-xl bg-slate-200 dark:bg-slate-700 flex items-center justify-center font-black text-slate-500 text-xs">
                                                {category.charAt(0)}
                                            </div>
                                            <div>
                                                <p className="font-black text-slate-900 dark:text-white tracking-tight">{category}</p>
                                                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{catData.count} items tracked</p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className="font-mono font-bold text-emerald-600">
                                                {catData.value.toLocaleString('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })}
                                            </p>
                                            <div className="mt-1 w-24 h-1 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                                                <div className="h-full bg-emerald-500" style={{ width: `${Math.min(100, (catData.value / stats.totalInventoryValue) * 100)}%` }} />
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </Card>
                </motion.div>
                <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                    viewport={{ once: true }}
                    className="lg:col-span-3"
                >
                     <Card className="h-[450px] p-8 flex flex-col">
                        <div className="mb-8">
                             <h2 className="text-xl font-display font-black uppercase tracking-tight italic">Operations Velocity</h2>
                             <p className="text-xs font-medium text-slate-500">Value of material inflow vs. consumption metrics.</p>
                        </div>
                         <div className="flex-1"><canvas ref={opsChartRef}></canvas></div>
                    </Card>
                </motion.div>
            </div>

             <motion.div 
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                className="relative overflow-hidden"
             >
                <Card className="border-l-8 border-l-indigo-600 p-10 bg-gradient-to-br from-indigo-50/50 to-transparent dark:from-indigo-900/10">
                     <div className="flex items-center justify-between mb-8">
                        <div className="flex items-center">
                            <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-500/20 mr-6">
                                <SparklesIcon className="w-6 h-6 text-white"/>
                            </div>
                            <div>
                                <h2 className="text-2xl font-display font-black tracking-tight italic uppercase">AI STRATEGIST</h2>
                                <p className="text-xs text-indigo-600/80 font-bold uppercase tracking-widest">Generative Intelligence Insights</p>
                            </div>
                        </div>
                        {aiInsights && !isGeneratingInsights && (
                            <button
                                onClick={handleGenerateInsights}
                                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:scale-105 transition-all shadow-lg"
                            >
                                <SpinnerIcon className={`w-3 h-3 ${isGeneratingInsights ? 'animate-spin' : ''}`} />
                                Refine Intelligence
                            </button>
                        )}
                    </div>

                    <div className="bg-white/50 dark:bg-slate-950/50 rounded-3xl p-8 border border-white/20 backdrop-blur-sm min-h-[200px]">
                        {isGeneratingInsights ? (
                            <div className="flex flex-col items-center justify-center h-48 space-y-6">
                                <div className="relative">
                                    <div className="w-20 h-20 border-4 border-indigo-600/20 rounded-full animate-ping" />
                                    <SpinnerIcon className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 animate-spin text-indigo-600" />
                                </div>
                                <p className="text-sm font-bold text-slate-500 uppercase tracking-widest animate-pulse">Scanning infrastructure & synthesizing data...</p>
                            </div>
                        ) : aiInsights ? (
                            <div className="markdown-body prose prose-indigo max-w-none prose-sm dark:prose-invert">
                                <MarkdownRenderer content={aiInsights} />
                            </div>
                        ) : (
                            <div className="text-center h-48 flex flex-col justify-center items-center">
                                <p className="text-slate-500 font-medium mb-6 max-w-md">Unlock hidden patterns in your inventory. Our AI analyzes turnover, stockout risks, and financial efficiency.</p>
                                <button 
                                    onClick={handleGenerateInsights}
                                    className="group relative px-8 py-4 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-2xl font-black text-xs uppercase tracking-widest hover:scale-105 transition-all duration-300 shadow-2xl"
                                >
                                    <span className="flex items-center gap-3">
                                        <SparklesIcon className="w-4 h-4 text-indigo-500"/>
                                        Initialize Intelligence Scan
                                    </span>
                                </button>
                            </div>
                        )}
                    </div>
                </Card>
            </motion.div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <motion.div 
                    initial={{ opacity: 0, x: -20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                >
                    <Card className="p-8">
                        <div className="flex items-center justify-between mb-8">
                            <div className="flex items-center">
                                <WarningIcon className="w-8 h-8 text-orange-500 mr-4"/>
                                <h2 className="text-xl font-display font-black uppercase tracking-tight italic">Critical Alerts</h2>
                            </div>
                            <span className="px-3 py-1 bg-orange-100 dark:bg-orange-500/10 text-orange-600 text-[10px] font-black rounded-lg uppercase tracking-widest">
                                {stats.lowStockItems.length} Warnings
                            </span>
                        </div>
                        {stats.lowStockItems && stats.lowStockItems.length > 0 ? (
                            <div className="table-container border-none shadow-none -mx-8 sm:mx-0">
                                <table className="w-full text-left">
                                    <thead className="text-[10px] font-black uppercase tracking-widest bg-slate-50 dark:bg-slate-800 text-slate-500">
                                        <tr>
                                            <th className="px-6 py-4">Identification</th>
                                            <th className="px-6 py-4 text-center">Status</th>
                                            <th className="px-6 py-4 text-center">Deficit</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                        {stats.lowStockItems.slice(0, 6).map(item => (
                                            <tr key={item.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                                                <td className="px-6 py-5">
                                                    <div className="font-black text-slate-900 dark:text-slate-100 tracking-tight">{item.name}</div>
                                                    <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">{item.sku}</div>
                                                </td>
                                                <td className="px-6 py-5 text-center">
                                                    <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-red-50 dark:bg-red-500/10 text-red-600 rounded-full text-[10px] font-black uppercase">
                                                        <div className="w-1 h-1 bg-red-600 rounded-full animate-pulse" />
                                                        Low Stock
                                                    </div>
                                                </td>
                                                <td className="px-6 py-5 text-center">
                                                    <div className="text-sm font-black text-orange-500">
                                                        {item.currentStock} <span className="text-[10px] text-slate-400">/ {item.reorderPoint}</span>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <div className="py-12 text-center">
                                <div className="text-4xl mb-4">✅</div>
                                <p className="text-slate-500 font-medium tracking-tight">Optimal Stock Levels maintained.</p>
                            </div>
                        )}
                    </Card>
                </motion.div>

                <motion.div 
                    initial={{ opacity: 0, x: 20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                >
                    <Card className="p-8">
                        <div className="flex items-center justify-between mb-8">
                            <div className="flex items-center">
                                <TruckIcon className="w-8 h-8 text-indigo-500 mr-4"/>
                                <h2 className="text-xl font-display font-black uppercase tracking-tight italic">Procurement Intelligence</h2>
                            </div>
                            <span className="px-3 py-1 bg-indigo-100 dark:bg-indigo-500/10 text-indigo-600 text-[10px] font-black rounded-lg uppercase tracking-widest">
                                Optimizer
                            </span>
                        </div>
                        {stats.smartReorderSuggestions && stats.smartReorderSuggestions.length > 0 ? (
                            <div className="space-y-4">
                                {stats.smartReorderSuggestions.slice(0, 5).map(suggestion => (
                                    <div key={suggestion.itemId} className="flex items-center gap-4 p-4 rounded-2xl bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 shadow-sm hover:shadow-md transition-shadow">
                                        <div className="w-12 h-12 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 rounded-xl flex flex-col items-center justify-center">
                                            <span className="text-[10px] font-black">REQ</span>
                                            <span className="text-sm font-black">+{suggestion.suggestedReorder}</span>
                                        </div>
                                        <div className="flex-1">
                                            <div className="font-black text-slate-900 dark:text-slate-100 tracking-tight">{suggestion.name}</div>
                                            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest tracking-tighter">{suggestion.sku} • {suggestion.reason}</div>
                                        </div>
                                        <button 
                                            onClick={() => navigate('RM Section', 'Suppliers')}
                                            className="p-3 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-colors"
                                        >
                                            <TruckIcon className="w-5 h-5 text-slate-400" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="py-12 text-center">
                                <div className="text-4xl mb-4">🔍</div>
                                <p className="text-slate-500 font-medium tracking-tight">System stabilized. No procurement triggers detected.</p>
                            </div>
                        )}
                    </Card>
                </motion.div>
            </div>

            {/* BRAND-WISE PROFILES & FINISHED GOODS STOCK SYNCHRONIZATION SECTION */}
            <motion.div 
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                className="space-y-6"
            >
                <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 text-white rounded-3xl p-6 lg:p-8 shadow-2xl border border-slate-700/50">
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-6 border-b border-slate-700/60">
                        <div>
                            <div className="flex items-center gap-2 mb-1">
                                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-blue-500/20 text-blue-300 border border-blue-400/30 flex items-center gap-1.5">
                                    <RefreshCw className="w-3 h-3 text-blue-400" /> Real-time Cross-tab Sync
                                </span>
                                <span className="text-xs text-slate-400">• Profiles, Stock, Films, Tooling & Quotes</span>
                            </div>
                            <h2 className="text-2xl lg:text-3xl font-display font-black uppercase tracking-tight italic flex items-center gap-3 text-white">
                                <Boxes className="w-8 h-8 text-blue-400" />
                                Brand-Wise Profiles & Finished Stock
                            </h2>
                            <p className="text-sm text-slate-300 mt-1">
                                Real-time inventory balances and automated sync across all ERP modules.
                            </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                            <button
                                onClick={handleSyncBrandNow}
                                disabled={isSyncingBrand}
                                className="px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 shadow-lg shadow-emerald-500/20 active:scale-95 disabled:opacity-50 cursor-pointer"
                                title="Run automatic synchronization for profiles, stock and protective films across all tabs"
                            >
                                <RefreshCw className={`w-4 h-4 ${isSyncingBrand ? 'animate-spin' : ''}`} />
                                {isSyncingBrand ? 'Syncing...' : 'Sync All Tabs Now'}
                            </button>
                            <button
                                onClick={() => navigate('Profiles & Stock', 'Stock')}
                                className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-1.5 shadow-lg shadow-blue-500/20 active:scale-95 cursor-pointer"
                            >
                                <UploadCloud className="w-4 h-4" /> Upload Brand Data
                            </button>
                        </div>
                    </div>

                    {/* Brand Selector Pills */}
                    <div className="flex items-center gap-2 overflow-x-auto py-4 scrollbar-none">
                        <span className="text-xs font-black uppercase tracking-widest text-slate-400 shrink-0 mr-2">Brand:</span>
                        <button
                            onClick={() => setSelectedBrand('All')}
                            className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all shrink-0 flex items-center gap-2 cursor-pointer ${
                                selectedBrand === 'All'
                                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30'
                                    : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700/80 hover:text-white border border-slate-700'
                            }`}
                        >
                            <span>All Brands</span>
                            <span className="px-1.5 py-0.5 text-[10px] rounded-md bg-white/20 text-white font-mono">
                                {brandProfiles.length}
                            </span>
                        </button>
                        {activeBrands.map(brand => {
                            const count = brandProfiles.filter(p => (p.brand || 'General').toLowerCase() === brand.toLowerCase()).length;
                            return (
                                <button
                                    key={brand}
                                    onClick={() => setSelectedBrand(brand)}
                                    className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all shrink-0 flex items-center gap-2 cursor-pointer ${
                                        selectedBrand.toLowerCase() === brand.toLowerCase()
                                            ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30'
                                            : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700/80 hover:text-white border border-slate-700'
                                    }`}
                                >
                                    <span>{brand}</span>
                                    <span className="px-1.5 py-0.5 text-[10px] rounded-md bg-white/20 text-white font-mono">
                                        {count}
                                    </span>
                                </button>
                            );
                        })}
                    </div>

                    {/* Brand KPI Summary Cards */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 pt-2">
                        <div className="p-4 rounded-2xl bg-slate-800/60 border border-slate-700/70">
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Unique Profiles</p>
                            <div className="text-2xl font-black text-white font-mono mt-1">{brandStats.totalProfiles}</div>
                            <span className="text-[10px] text-blue-400 font-bold">Catalog SKUs</span>
                        </div>
                        <div className="p-4 rounded-2xl bg-slate-800/60 border border-slate-700/70">
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Stock Balance</p>
                            <div className="text-2xl font-black text-emerald-400 font-mono mt-1">{brandStats.totalPieces.toLocaleString()}</div>
                            <span className="text-[10px] text-emerald-300/80 font-bold">Pieces in Plant</span>
                        </div>
                        <div className="p-4 rounded-2xl bg-slate-800/60 border border-slate-700/70">
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Stock Weight</p>
                            <div className="text-2xl font-black text-cyan-400 font-mono mt-1">{Math.round(brandStats.totalWeightKg).toLocaleString()}</div>
                            <span className="text-[10px] text-cyan-300/80 font-bold">Kg Finished Extrusion</span>
                        </div>
                        <div className="p-4 rounded-2xl bg-slate-800/60 border border-slate-700/70">
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Stock Valuation</p>
                            <div className="text-xl font-black text-yellow-400 font-mono mt-1">₹{Math.round(brandStats.totalValue).toLocaleString('en-IN')}</div>
                            <span className="text-[10px] text-yellow-300/80 font-bold">Estimated Net</span>
                        </div>
                        <div className="p-4 rounded-2xl bg-slate-800/60 border border-slate-700/70">
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Film Coverage</p>
                            <div className="text-2xl font-black text-indigo-400 font-mono mt-1">{brandStats.filmCoveragePercent}%</div>
                            <span className="text-[10px] text-indigo-300/80 font-bold">Protective Spec Ready</span>
                        </div>
                        <div className="p-4 rounded-2xl bg-slate-800/60 border border-slate-700/70">
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Critical Reorder</p>
                            <div className="text-2xl font-black text-rose-400 font-mono mt-1">{brandStats.lowStockCount}</div>
                            <span className="text-[10px] text-rose-300/80 font-bold">Below Reorder Point</span>
                        </div>
                    </div>

                    {/* Quick Module Navigation Links for Brand */}
                    <div className="mt-5 pt-4 border-t border-slate-700/50 flex flex-wrap items-center justify-between gap-3">
                        <span className="text-xs font-black uppercase tracking-widest text-slate-400">Jump to Module:</span>
                        <div className="flex flex-wrap items-center gap-2">
                            <button 
                                onClick={() => navigate('Profiles & Stock', 'Profiles')}
                                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200 hover:text-white transition-all flex items-center gap-1.5 border border-slate-700/60 cursor-pointer"
                            >
                                <Package className="w-3.5 h-3.5 text-blue-400" /> Profiles Master
                            </button>
                            <button 
                                onClick={() => navigate('Profiles & Stock', 'Stock')}
                                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200 hover:text-white transition-all flex items-center gap-1.5 border border-slate-700/60 cursor-pointer"
                            >
                                <Boxes className="w-3.5 h-3.5 text-emerald-400" /> Stock & Movement
                            </button>
                            <button 
                                onClick={() => navigate('Profiles & Stock', 'Protective Films')}
                                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200 hover:text-white transition-all flex items-center gap-1.5 border border-slate-700/60 cursor-pointer"
                            >
                                <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" /> Protective Films
                            </button>
                            <button 
                                onClick={() => navigate('Profiles & Stock', 'Quotations')}
                                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200 hover:text-white transition-all flex items-center gap-1.5 border border-slate-700/60 cursor-pointer"
                            >
                                <FileTextIcon className="w-3.5 h-3.5 text-indigo-400" /> Quotations
                            </button>
                            <button 
                                onClick={() => navigate('Profiles & Stock', 'Extrusion Data Plan')}
                                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200 hover:text-white transition-all flex items-center gap-1.5 border border-slate-700/60 cursor-pointer"
                            >
                                <FileSpreadsheet className="w-3.5 h-3.5 text-amber-400" /> Extrusion Data Plan
                            </button>
                            <button 
                                onClick={() => navigate('Profiles & Stock', 'Brand Sync Planning')}
                                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200 hover:text-white transition-all flex items-center gap-1.5 border border-slate-700/60 cursor-pointer"
                            >
                                <RefreshCw className="w-3.5 h-3.5 text-teal-400" /> Brand Sync Hub
                            </button>
                        </div>
                    </div>

                    {/* Top Profiles & Stock Table for selected brand */}
                    <div className="mt-6 overflow-hidden rounded-2xl border border-slate-700/80 bg-slate-900/80">
                        <div className="p-4 bg-slate-800/80 border-b border-slate-700 flex items-center justify-between">
                            <span className="text-xs font-black uppercase tracking-wider text-slate-200">
                                {selectedBrand === 'All' ? 'All Profiles' : `${selectedBrand} Profiles`} ({brandFilteredProfiles.length})
                            </span>
                            <span className="text-[10px] text-slate-400">Sorted by Live Stock Pieces</span>
                        </div>
                        {brandFilteredProfiles.length > 0 ? (
                            <div className="overflow-x-auto max-h-80 scrollbar-thin">
                                <table className="w-full text-left text-xs">
                                    <thead className="bg-slate-800/40 text-slate-400 uppercase text-[10px] tracking-wider font-black sticky top-0 backdrop-blur-md">
                                        <tr>
                                            <th className="p-3">SKU & Profile</th>
                                            <th className="p-3">Brand</th>
                                            <th className="p-3 text-center">Pack Specs</th>
                                            <th className="p-3 text-right">Stock (Pcs)</th>
                                            <th className="p-3 text-right">Weight (Kg)</th>
                                            <th className="p-3">Protective Film</th>
                                            <th className="p-3 text-center">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-800">
                                        {brandFilteredProfiles
                                            .slice()
                                            .sort((a, b) => {
                                                const stockA = profileStockMap.get(a.id)?.currentStock || 0;
                                                const stockB = profileStockMap.get(b.id)?.currentStock || 0;
                                                return stockB - stockA;
                                            })
                                            .slice(0, 12)
                                            .map(p => {
                                                const stock = profileStockMap.get(p.id) || { currentStock: 0, packets: 0, weightKg: 0, isLowStock: false };
                                                const film = storeFilms.find(f => 
                                                    f.profileCode.toLowerCase() === p.sku.toLowerCase() && 
                                                    (f.brand || 'General').toLowerCase() === (p.brand || 'General').toLowerCase()
                                                );
                                                return (
                                                    <tr key={p.id} className="hover:bg-slate-800/50 transition-colors">
                                                        <td className="p-3">
                                                            <div className="font-mono font-bold text-white">{p.sku}</div>
                                                            <div className="text-[10px] text-slate-400 truncate max-w-xs">{p.name}</div>
                                                        </td>
                                                        <td className="p-3">
                                                            <span className="px-2 py-0.5 rounded-md bg-slate-800 text-[10px] font-bold text-slate-300 border border-slate-700">
                                                                {p.brand || 'General'}
                                                            </span>
                                                        </td>
                                                        <td className="p-3 text-center">
                                                            <div className="font-mono text-slate-300">{p.piecesPerPacket || 1} pcs / pkt</div>
                                                            <div className="text-[10px] text-slate-500">{p.length || 5.9}m</div>
                                                        </td>
                                                        <td className="p-3 text-right">
                                                            <div className="font-mono font-black text-white">{stock.currentStock}</div>
                                                            <div className="text-[10px] text-slate-400 font-mono">({stock.packets} pkts)</div>
                                                        </td>
                                                        <td className="p-3 text-right font-mono text-slate-300">
                                                            {Math.round(stock.weightKg).toLocaleString()} kg
                                                        </td>
                                                        <td className="p-3">
                                                            {film ? (
                                                                <div className="text-[10px] space-y-0.5">
                                                                    <div className="text-slate-300 font-mono">T: {film.topFilmWidth || '-'}mm {film.topStickerName ? `(${film.topStickerName})` : ''}</div>
                                                                    <div className="text-slate-400 font-mono">B: {film.bottomFilmWidth || '-'}mm {film.bottomStickerName ? `(${film.bottomStickerName})` : ''}</div>
                                                                </div>
                                                            ) : (
                                                                <span className="text-[10px] text-slate-500">Not synced</span>
                                                            )}
                                                        </td>
                                                        <td className="p-3 text-center">
                                                            {stock.currentStock === 0 ? (
                                                                <span className="px-2 py-0.5 rounded-md bg-rose-500/20 text-rose-300 text-[10px] font-bold">
                                                                    Out of Stock
                                                                </span>
                                                            ) : stock.isLowStock ? (
                                                                <span className="px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 text-[10px] font-bold">
                                                                    Low Stock
                                                                </span>
                                                            ) : (
                                                                <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 text-[10px] font-bold">
                                                                    Optimal
                                                                </span>
                                                            )}
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <div className="py-10 text-center text-slate-400 text-sm">
                                No profiles found for brand "{selectedBrand}". Upload brand Excel data or add a profile to start tracking.
                            </div>
                        )}
                    </div>
                </div>
            </motion.div>
            
            <Portal>
                <ItemListModal
                    isOpen={isItemsModalOpen}
                    onClose={() => setIsItemsModalOpen(false)}
                    items={items}
                    stockLevels={stockLevels}
                    title="All Items"
                />
            </Portal>
            <Portal>
                <LowStockItemsModal
                    isOpen={isLowStockModalOpen}
                    onClose={() => setIsLowStockModalOpen(false)}
                    items={stats.lowStockItems}
                />
            </Portal>
            <Portal>
                <InventoryValueModal
                    isOpen={isInventoryValueModalOpen}
                    onClose={() => setIsInventoryValueModalOpen(false)}
                    items={items}
                    stockLevels={stockLevels}
                />
            </Portal>
            <Portal>
                <BatchForecastModal
                    isOpen={isForecastModalOpen}
                    onClose={() => setIsForecastModalOpen(false)}
                    calculationResult={forecastData}
                />
            </Portal>
        </div>
    );
};

export default Dashboard;