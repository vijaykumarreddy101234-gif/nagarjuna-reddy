import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useStore } from '../store/useStore';
import type { ToastMessage, Profile, ProfileTransaction, Customer, BrandLogo, CompanySettings } from '../types';
import { TransactionTable, TransactionModal, EditTransactionModal } from '../components/ProfileTransactions';
import { 
    Search, 
    Edit2, 
    Trash2, 
    Warehouse, 
    UploadCloud, 
    User, 
    AlertTriangle, 
    Sparkles, 
    ChevronDown,
    BarChart3,
    PieChart as PieChartIcon,
    TrendingUp,
    Package,
    DollarSign,
    Layers,
    Filter,
    ArrowUpRight,
    ArrowDownRight,
    History,
    Settings,
    Calendar,
    Activity,
    ClipboardList,
    Cpu,
    Plus,
    FileSpreadsheet,
    Zap,
    RefreshCw,
    DownloadCloud,
    CheckCircle2,
    X,
    Send,
    Download,
    Printer,
    ArrowRight,
    Shield
} from 'lucide-react';
import { 
    BarChart, 
    Bar, 
    XAxis, 
    YAxis, 
    CartesianGrid, 
    Tooltip, 
    ResponsiveContainer, 
    PieChart, 
    Pie, 
    Cell, 
    LineChart, 
    Line, 
    AreaChart, 
    Area,
    Legend
} from 'recharts';
import AddProfileModal from '../components/AddProfileModal';
import CustomerModal from '../components/CustomerModal';
import Quotation from './Quotation';
import CreateQuotationModal from '../components/CreateQuotationModal'; 
import { Card } from '../components/Card';
import { DataPlanSheet } from '../components/DataPlanSheet';
import { ProtectiveFilms } from '../components/ProtectiveFilms';
import { BrandSyncPlanning } from '../components/BrandSyncPlanning';
import { DuplicateResolutionModal, DuplicateConflictItem } from '../components/DuplicateResolutionModal';
import { INITIAL_DATA_PLAN_COLUMNS, INITIAL_DATA_PLAN_ROWS } from '../data/defaultDataPlan';

// Custom icons to match existing ones if needed, but using lucide-react now
const SearchIcon = Search;
const PencilIcon = Edit2;
const TrashIcon = Trash2;
const WarehouseIcon = Warehouse;
const CloudUploadIcon = UploadCloud;
const UserIcon = User;
const WarningIcon = AlertTriangle;
const SparklesIcon = Sparkles;
const ChevronDownIcon = ChevronDown;

declare const XLSX: any;
declare const jspdf: any;

interface ProfileSectionProps {
    addToast: (message: string, type: ToastMessage['type']) => void;
    initialTab?: Tab;
    initialSubTab?: string;
    initialAction?: string | null;
    onResetInitialAction?: () => void;
}

type Tab = 'Dashboard' | 'Stock' | 'Production' | 'Reinforcement Stock' | 'Reinforcement Inflow' | 'Planning' | 'Data plan' | 'Analysis' | 'Quotations' | 'Profiles' | 'Protective Films' | 'Customers' | 'Scrap' | 'Dies' | 'Brand Sync Planning';
type ProductionSubTab = 'Inflow' | 'Outflow';
type ProfileSubTab = 'Profiles' | 'Protective Films';

const Portal: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    return createPortal(children, document.body);
};

// --- CUSTOM HOOKS ---
function useFilteredTransactions(
    transactions: ProfileTransaction[],
    searchTerm: string,
    getProfile: (id: string) => Profile | undefined,
    type: 'PRODUCTION' | 'DISPATCH' | 'SCRAP' | 'QUOTATION',
    brandFilter: string
) {
    return useMemo(() => {
        let filtered = transactions.filter(t => (t.type === type || (type === 'PRODUCTION' && t.type === 'RETURN')) && !t.deletedAt);
        
        if (brandFilter !== 'All') {
            filtered = filtered.filter(t => {
                const profile = getProfile(t.profileId);
                return (t.brand || profile?.brand) === brandFilter;
            });
        }

        if (searchTerm) {
            const lowerSearch = searchTerm.toLowerCase();
            filtered = filtered.filter(t => {
                const profile = getProfile(t.profileId);
                return (
                    t.refNo.toLowerCase().includes(lowerSearch) ||
                    profile?.name.toLowerCase().includes(lowerSearch) ||
                    profile?.sku.toLowerCase().includes(lowerSearch) ||
                    t.customer?.toLowerCase().includes(lowerSearch)
                );
            });
        }

        return filtered.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [transactions, searchTerm, getProfile, type, brandFilter]);
}

// --- DASHBOARD LIST MODAL ---
const DashboardListModal: React.FC<{ 
    isOpen: boolean; 
    onClose: () => void; 
    items: any[]; 
    title: string; 
    type?: 'value' | 'lowstock' | 'list';
    onAddProduction?: (profileId: string, brand?: string) => void;
    onPlan?: (profileId: string) => void;
    brands?: string[];
}> = ({ isOpen, onClose, items, title, type = 'list', onAddProduction, onPlan, brands = [] }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedBrand, setSelectedBrand] = useState('All');
    const [statusFilter, setStatusFilter] = useState<'All' | 'In Stock' | 'Low Stock' | 'Out of Stock'>('All');
    const [lowStockFilter, setLowStockFilter] = useState<'All' | 'Critical' | 'Warning'>('All');

    const processedItems = useMemo(() => {
        return items.map(p => {
            const reorder = (p.reorderPoint !== undefined && p.reorderPoint !== null && p.reorderPoint > 0) ? p.reorderPoint : 50;
            const current = Number(p.currentStock) || 0;
            const reserved = Number(p.reservedStock) || 0;
            const available = current - reserved;
            const price = Number(p.price) || 0;
            const itemValue = current * price;
            const deficit = Math.max(0, reorder - available);
            const isZero = available <= 0;
            const isLow = available < reorder;
            
            return {
                ...p,
                reorderThreshold: reorder,
                calculatedAvailable: available,
                calculatedValue: itemValue,
                stockDeficit: deficit,
                isZeroStock: isZero,
                isLowStock: isLow
            };
        });
    }, [items]);

    const totalInventoryValue = useMemo(() => {
        return processedItems.reduce((sum, p) => sum + (p.calculatedValue || 0), 0);
    }, [processedItems]);

    const filteredItems = useMemo(() => {
        let list = [...processedItems];

        // Brand filter
        if (selectedBrand !== 'All') {
            list = list.filter(p => p.brand === selectedBrand);
        }

        // Search filter
        if (searchTerm.trim()) {
            const term = searchTerm.toLowerCase();
            list = list.filter(p => 
                (p.name && p.name.toLowerCase().includes(term)) || 
                (p.sku && p.sku.toLowerCase().includes(term)) ||
                (p.brand && p.brand.toLowerCase().includes(term))
            );
        }

        // Status filter for general list
        if (type === 'list') {
            if (statusFilter === 'In Stock') {
                list = list.filter(p => p.calculatedAvailable > p.reorderThreshold);
            } else if (statusFilter === 'Low Stock') {
                list = list.filter(p => p.calculatedAvailable <= p.reorderThreshold && p.calculatedAvailable > 0);
            } else if (statusFilter === 'Out of Stock') {
                list = list.filter(p => p.calculatedAvailable <= 0);
            }
        }

        // Low stock filter
        if (type === 'lowstock') {
            if (lowStockFilter === 'Critical') {
                list = list.filter(p => p.calculatedAvailable <= 0);
            } else if (lowStockFilter === 'Warning') {
                list = list.filter(p => p.calculatedAvailable > 0 && p.calculatedAvailable <= p.reorderThreshold);
            }
        }

        // Sorting
        if (type === 'value') {
            list.sort((a, b) => b.calculatedValue - a.calculatedValue);
        } else if (type === 'lowstock') {
            list.sort((a, b) => {
                // Critical zero first, then by lowest available stock
                if (a.isZeroStock && !b.isZeroStock) return -1;
                if (!a.isZeroStock && b.isZeroStock) return 1;
                return a.calculatedAvailable - b.calculatedAvailable;
            });
        } else {
            list.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        }

        return list;
    }, [processedItems, selectedBrand, searchTerm, statusFilter, lowStockFilter, type]);

    if (!isOpen) return null;

    const availableBrands = ['All', ...Array.from(new Set(items.map(p => p.brand).filter(Boolean)))];

    return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xs z-[150] flex justify-center items-center p-4 animate-in fade-in duration-200" onClick={onClose}>
            <div 
                className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-800 w-full max-w-5xl flex flex-col max-h-[90vh] overflow-hidden" 
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="p-6 border-b border-gray-100 dark:border-gray-800 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gray-50/50 dark:bg-gray-850">
                    <div>
                        <div className="flex items-center gap-3">
                            <div className={`p-2.5 rounded-xl ${
                                type === 'lowstock' ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300' :
                                type === 'value' ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300' :
                                'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
                            }`}>
                                {type === 'lowstock' ? <AlertTriangle className="w-5 h-5" /> :
                                 type === 'value' ? <DollarSign className="w-5 h-5" /> :
                                 <Package className="w-5 h-5" />}
                            </div>
                            <div>
                                <h2 className="text-xl font-black text-gray-900 dark:text-white uppercase tracking-tight flex items-center gap-2">
                                    {title}
                                    <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
                                        {filteredItems.length} {filteredItems.length === 1 ? 'item' : 'items'}
                                    </span>
                                </h2>
                                <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                                    {type === 'lowstock' && "Profiles that have reached or fallen below minimum safety reorder thresholds"}
                                    {type === 'value' && "Detailed valuation calculated per physical stock unit and rate"}
                                    {type === 'list' && "Complete master profiles catalog with live stock status and reserved quantities"}
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        {/* Search Bar */}
                        <div className="relative flex-1 md:w-64">
                            <input 
                                autoFocus 
                                type="text" 
                                placeholder="Search SKU, name, brand..." 
                                value={searchTerm} 
                                onChange={e => setSearchTerm(e.target.value)} 
                                className="w-full pl-9 pr-4 py-2 text-xs bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none dark:text-white shadow-xs font-medium" 
                            />
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            {searchTerm && (
                                <button onClick={() => setSearchTerm('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                                    <X className="w-3.5 h-3.5" />
                                </button>
                            )}
                        </div>

                        {/* Brand Filter */}
                        <select 
                            value={selectedBrand} 
                            onChange={e => setSelectedBrand(e.target.value)}
                            className="bg-white dark:bg-gray-800 text-xs font-bold border border-gray-300 dark:border-gray-700 rounded-xl px-3 py-2 text-gray-700 dark:text-gray-200 focus:ring-2 focus:ring-blue-500 shadow-xs cursor-pointer"
                        >
                            {availableBrands.map(b => (
                                <option key={b} value={b}>{b === 'All' ? 'All Brands' : b}</option>
                            ))}
                        </select>

                        <button 
                            onClick={onClose}
                            className="p-2 rounded-xl text-gray-400 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Sub-Filters / Status Pills */}
                <div className="px-6 py-2.5 bg-gray-100/70 dark:bg-gray-800/60 border-b border-gray-200 dark:border-gray-700 flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-1.5 overflow-x-auto py-0.5">
                        {type === 'list' && (
                            <>
                                <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mr-1">Status:</span>
                                {(['All', 'In Stock', 'Low Stock', 'Out of Stock'] as const).map(status => (
                                    <button
                                        key={status}
                                        onClick={() => setStatusFilter(status)}
                                        className={`px-3 py-1 rounded-lg font-bold text-xs transition-all ${
                                            statusFilter === status 
                                                ? 'bg-blue-600 text-white shadow-xs' 
                                                : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                                        }`}
                                    >
                                        {status}
                                    </button>
                                ))}
                            </>
                        )}

                        {type === 'lowstock' && (
                            <>
                                <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mr-1">Severity:</span>
                                {(['All', 'Critical', 'Warning'] as const).map(sev => (
                                    <button
                                        key={sev}
                                        onClick={() => setLowStockFilter(sev)}
                                        className={`px-3 py-1 rounded-lg font-bold text-xs transition-all ${
                                            lowStockFilter === sev 
                                                ? 'bg-red-600 text-white shadow-xs' 
                                                : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                                        }`}
                                    >
                                        {sev === 'All' ? 'All Alerts' : sev === 'Critical' ? '🔴 Critical (0 Stock)' : '🟡 Warning (Low Stock)'}
                                    </button>
                                ))}
                            </>
                        )}

                        {type === 'value' && (
                            <div className="flex items-center gap-2 text-gray-600 dark:text-gray-300 font-bold">
                                <span>Portfolio Valuation:</span>
                                <span className="text-sm font-black text-green-600 font-mono">₹{totalInventoryValue.toLocaleString('en-IN')}</span>
                            </div>
                        )}
                    </div>

                    <div className="text-[11px] font-semibold text-gray-500">
                        Showing {filteredItems.length} of {processedItems.length} records
                    </div>
                </div>

                {/* Table Content */}
                <div className="overflow-y-auto flex-1 bg-white dark:bg-gray-900">
                    <table className="w-full text-xs text-left border-collapse">
                        <thead className="bg-gray-50 dark:bg-gray-800 text-[10px] uppercase font-black tracking-wider text-gray-500 dark:text-gray-400 sticky top-0 z-10 border-b dark:border-gray-700 shadow-xs">
                            <tr>
                                <th className="px-4 py-3">SKU & Code</th>
                                <th className="px-4 py-3">Profile Name</th>
                                <th className="px-3 py-3">Brand</th>
                                {type === 'list' && (
                                    <>
                                        <th className="px-3 py-3">Type</th>
                                        <th className="px-3 py-3 text-right">Physical Stock</th>
                                        <th className="px-3 py-3 text-right">Reserved</th>
                                        <th className="px-3 py-3 text-right font-black text-blue-600">Available</th>
                                        <th className="px-3 py-3 text-right">Min Reorder</th>
                                        <th className="px-3 py-3 text-right">Rate (₹)</th>
                                        <th className="px-4 py-3 text-center">Status</th>
                                        <th className="px-4 py-3 text-right">Actions</th>
                                    </>
                                )}
                                {type === 'lowstock' && (
                                    <>
                                        <th className="px-3 py-3 text-right font-black text-red-600">Available (Pcs)</th>
                                        <th className="px-3 py-3 text-right font-bold text-gray-700 dark:text-gray-300">Reorder Level</th>
                                        <th className="px-3 py-3 text-right font-black text-orange-600">Deficit (To Add)</th>
                                        <th className="px-4 py-3 text-center">Urgency</th>
                                        <th className="px-4 py-3 text-right">Quick Action</th>
                                    </>
                                )}
                                {type === 'value' && (
                                    <>
                                        <th className="px-3 py-3 text-right font-bold">Physical Stock</th>
                                        <th className="px-3 py-3 text-right">Weight (Kg)</th>
                                        <th className="px-3 py-3 text-right font-bold">Rate / Pc (₹)</th>
                                        <th className="px-4 py-3 text-right font-black text-green-600">Total Valuation (₹)</th>
                                        <th className="px-3 py-3 text-right">% Portfolio</th>
                                    </>
                                )}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                            {filteredItems.map(p => {
                                const valShare = totalInventoryValue > 0 ? ((p.calculatedValue / totalInventoryValue) * 100).toFixed(1) : '0.0';
                                
                                return (
                                    <tr key={p.id} className="hover:bg-blue-50/40 dark:hover:bg-gray-800/60 transition-colors group">
                                        {/* SKU */}
                                        <td className="px-4 py-3 font-mono font-bold text-gray-900 dark:text-white">
                                            {p.sku}
                                        </td>

                                        {/* Name */}
                                        <td className="px-4 py-3">
                                            <div className="font-bold text-gray-900 dark:text-white">{p.name}</div>
                                            {p.hsnCode && (
                                                <div className="text-[10px] text-gray-400 font-mono">HSN: {p.hsnCode}</div>
                                            )}
                                        </td>

                                        {/* Brand */}
                                        <td className="px-3 py-3">
                                            <span className="px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700">
                                                {p.brand || 'General'}
                                            </span>
                                        </td>

                                        {/* Type = 'list' */}
                                        {type === 'list' && (
                                            <>
                                                <td className="px-3 py-3">
                                                    <span className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase ${
                                                        p.profileType === 'REINFORCEMENT' ? 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300' : 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300'
                                                    }`}>
                                                        {p.profileType === 'REINFORCEMENT' ? 'Reinf' : 'Win'}
                                                    </span>
                                                </td>
                                                <td className="px-3 py-3 text-right font-mono font-medium text-gray-700 dark:text-gray-300">
                                                    {p.currentStock || 0}
                                                </td>
                                                <td className="px-3 py-3 text-right font-mono text-gray-400">
                                                    {p.reservedStock || 0}
                                                </td>
                                                <td className={`px-3 py-3 text-right font-mono font-black text-sm ${
                                                    p.calculatedAvailable <= 0 ? 'text-red-600' : 
                                                    p.calculatedAvailable <= p.reorderThreshold ? 'text-amber-600' : 'text-green-600'
                                                }`}>
                                                    {p.calculatedAvailable}
                                                </td>
                                                <td className="px-3 py-3 text-right font-mono text-gray-500">
                                                    {p.reorderThreshold}
                                                </td>
                                                <td className="px-3 py-3 text-right font-mono font-bold text-gray-800 dark:text-gray-200">
                                                    ₹{(p.price || 0).toLocaleString('en-IN')}
                                                </td>
                                                <td className="px-4 py-3 text-center">
                                                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${
                                                        p.calculatedAvailable <= 0 ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300' :
                                                        p.calculatedAvailable <= p.reorderThreshold ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' :
                                                        'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300'
                                                    }`}>
                                                        {p.calculatedAvailable <= 0 ? 'Out of Stock' :
                                                         p.calculatedAvailable <= p.reorderThreshold ? 'Low Stock' : 'In Stock'}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 text-right">
                                                    <div className="flex items-center justify-end gap-1.5">
                                                        {onAddProduction && (
                                                            <button
                                                                onClick={() => {
                                                                    onClose();
                                                                    onAddProduction(p.id, p.brand);
                                                                }}
                                                                className="px-2 py-1 bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300 hover:bg-green-100 rounded-md font-bold text-[10px] flex items-center gap-1 transition-colors"
                                                                title="Add Production"
                                                            >
                                                                <Plus className="w-3 h-3" /> Produce
                                                            </button>
                                                        )}
                                                        {onPlan && (
                                                            <button
                                                                onClick={() => {
                                                                    onClose();
                                                                    onPlan(p.id);
                                                                }}
                                                                className="px-2 py-1 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 hover:bg-blue-100 rounded-md font-bold text-[10px] flex items-center gap-1 transition-colors"
                                                                title="Schedule in Production Plan"
                                                            >
                                                                Plan
                                                            </button>
                                                        )}
                                                    </div>
                                                </td>
                                            </>
                                        )}

                                        {/* Type = 'lowstock' */}
                                        {type === 'lowstock' && (
                                            <>
                                                <td className="px-3 py-3 text-right font-mono font-black text-sm text-red-600">
                                                    {p.calculatedAvailable} Pcs
                                                </td>
                                                <td className="px-3 py-3 text-right font-mono font-bold text-gray-700 dark:text-gray-300">
                                                    {p.reorderThreshold} Pcs
                                                </td>
                                                <td className="px-3 py-3 text-right font-mono font-black text-orange-600 bg-orange-50/50 dark:bg-orange-950/20">
                                                    +{p.stockDeficit} Pcs
                                                </td>
                                                <td className="px-4 py-3 text-center">
                                                    <span className={`px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider ${
                                                        p.isZeroStock 
                                                            ? 'bg-red-600 text-white animate-pulse' 
                                                            : 'bg-amber-500 text-white'
                                                    }`}>
                                                        {p.isZeroStock ? '🔴 Critical: Zero' : '🟡 Low Stock'}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 text-right">
                                                    <div className="flex items-center justify-end gap-1.5">
                                                        {onAddProduction && (
                                                            <button
                                                                onClick={() => {
                                                                    onClose();
                                                                    onAddProduction(p.id, p.brand);
                                                                }}
                                                                className="px-2.5 py-1 bg-green-600 hover:bg-green-700 text-white rounded-lg font-bold text-[10px] flex items-center gap-1 shadow-xs transition-colors"
                                                            >
                                                                <Plus className="w-3.5 h-3.5" /> Produce
                                                            </button>
                                                        )}
                                                        {onPlan && (
                                                            <button
                                                                onClick={() => {
                                                                    onClose();
                                                                    onPlan(p.id);
                                                                }}
                                                                className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold text-[10px] flex items-center gap-1 shadow-xs transition-colors"
                                                            >
                                                                Plan Die
                                                            </button>
                                                        )}
                                                    </div>
                                                </td>
                                            </>
                                        )}

                                        {/* Type = 'value' */}
                                        {type === 'value' && (
                                            <>
                                                <td className="px-3 py-3 text-right font-mono font-black text-gray-900 dark:text-white">
                                                    {p.currentStock || 0} Pcs
                                                </td>
                                                <td className="px-3 py-3 text-right font-mono text-gray-500">
                                                    {p.weight ? `${p.weight} kg` : '-'}
                                                </td>
                                                <td className="px-3 py-3 text-right font-mono font-bold text-gray-700 dark:text-gray-300">
                                                    ₹{(p.price || 0).toLocaleString('en-IN')}
                                                </td>
                                                <td className="px-4 py-3 text-right font-mono font-black text-green-600 text-sm">
                                                    ₹{(p.calculatedValue || 0).toLocaleString('en-IN')}
                                                </td>
                                                <td className="px-3 py-3 text-right font-mono text-xs text-gray-400">
                                                    {valShare}%
                                                </td>
                                            </>
                                        )}
                                    </tr>
                                );
                            })}

                            {filteredItems.length === 0 && (
                                <tr>
                                    <td colSpan={10} className="px-6 py-12 text-center text-gray-400 dark:text-gray-500">
                                        <div className="flex flex-col items-center justify-center gap-2">
                                            <Package className="w-8 h-8 text-gray-300 dark:text-gray-600" />
                                            <p className="font-bold text-sm">No profiles found matching current filters.</p>
                                            <p className="text-xs">Try clearing search keywords or selecting a different brand/status filter.</p>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Footer Summary */}
                <div className="p-4 bg-gray-50 dark:bg-gray-850 border-t border-gray-100 dark:border-gray-800 flex flex-col sm:flex-row items-center justify-between gap-3">
                    <div className="flex items-center gap-4 text-xs text-gray-600 dark:text-gray-400 font-medium">
                        <div>
                            Total Items: <span className="font-black text-gray-900 dark:text-white font-mono">{filteredItems.length}</span>
                        </div>
                        <div>
                            Total Available Pcs: <span className="font-black text-blue-600 font-mono">
                                {filteredItems.reduce((s, p) => s + (p.calculatedAvailable || 0), 0).toLocaleString()}
                            </span>
                        </div>
                        <div>
                            Total Value: <span className="font-black text-green-600 font-mono">
                                ₹{filteredItems.reduce((s, p) => s + (p.calculatedValue || 0), 0).toLocaleString('en-IN')}
                            </span>
                        </div>
                    </div>

                    <button 
                        onClick={onClose} 
                        className="px-5 py-2 bg-gray-900 hover:bg-black dark:bg-gray-700 dark:hover:bg-gray-600 text-white rounded-xl font-bold text-xs transition-colors shadow-xs"
                    >
                        Close Window
                    </button>
                </div>
            </div>
        </div>
    );
};

// --- DASHBOARD COMPONENT ---
const ProfileDashboard: React.FC<{
    profiles: Profile[];
    transactions: ProfileTransaction[];
    allStockData: any[];
    brands: string[];
    onQuickAction?: (type: 'PRODUCTION' | 'DISPATCH' | 'QUOTATION' | 'DATA_PLAN') => void;
    onNavigateTab?: (tab: Tab) => void;
    onAddProductionForProfile?: (profileId: string, brand?: string) => void;
    onPlanForProfile?: (profileId: string) => void;
    dies?: any[];
    productionPlans?: any[];
}> = ({ 
    profiles, 
    transactions, 
    allStockData, 
    brands, 
    onQuickAction, 
    onNavigateTab, 
    onAddProductionForProfile, 
    onPlanForProfile,
    dies = [],
    productionPlans = []
}) => {
    const [isListOpen, setIsListOpen] = useState(false);
    const [isLowStockOpen, setIsLowStockOpen] = useState(false);
    const [isValueOpen, setIsValueOpen] = useState(false);
    const [dashboardBrand, setDashboardBrand] = useState('All');

    // Filter stockData and transactions by dashboardBrand
    const filteredStockData = useMemo(() => {
        const base = allStockData || [];
        if (dashboardBrand === 'All') return base;
        return base.filter((p: any) => p.brand === dashboardBrand);
    }, [allStockData, dashboardBrand]);

    const filteredTransactions = useMemo(() => {
        const base = transactions || [];
        if (dashboardBrand === 'All') return base;
        return base.filter((t: any) => {
            const profile = profiles.find((p: any) => p.id === t.profileId);
            return (t.brand || profile?.brand) === dashboardBrand;
        });
    }, [transactions, dashboardBrand, profiles]);

    // Brand-wise aggregation
    const brandStats = useMemo(() => {
        const stats: Record<string, { qty: number; value: number; count: number; packets: number; weightKg: number }> = {};
        if (brands && Array.isArray(brands)) {
            brands.forEach((b: string) => {
                stats[b] = { qty: 0, value: 0, count: 0, packets: 0, weightKg: 0 };
            });
        }
        
        (allStockData || []).forEach((p: any) => {
            const brand = p.brand || 'Unknown';
            if (!stats[brand]) stats[brand] = { qty: 0, value: 0, count: 0, packets: 0, weightKg: 0 };
            const available = (Number(p.currentStock) || 0) - (Number(p.reservedStock) || 0);
            const current = Number(p.currentStock) || 0;
            const price = Number(p.price) || 0;
            const pPerPkt = Number(p.piecesPerPacket) || 1;
            const wt = Number(p.weight) || 0;

            stats[brand].qty += isNaN(available) ? 0 : available;
            stats[brand].value += isNaN(current * price) ? 0 : (current * price);
            stats[brand].count += 1;
            stats[brand].packets += pPerPkt > 0 ? Math.floor(Math.max(0, available) / pPerPkt) : 0;
            stats[brand].weightKg += isNaN(available * wt) ? 0 : (Math.max(0, available) * wt);
        });
        
        return Object.entries(stats).map(([name, data]) => ({ name, ...data }));
    }, [allStockData, brands]);

    // Trend data (last 7 days)
    const trendData = useMemo(() => {
        const last7Days = Array.from({ length: 7 }, (_, i) => {
            const d = new Date();
            d.setDate(d.getDate() - i);
            return d.toISOString().split('T')[0];
        }).reverse();

        return last7Days.map(date => {
            const dayTxs = filteredTransactions.filter((t: any) => t.date && t.date.startsWith(date) && !t.deletedAt);
            return {
                date: new Date(date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }),
                production: dayTxs.filter((t: any) => t.type === 'PRODUCTION' || t.type === 'RETURN').reduce((s: number, t: any) => s + Number(t.quantity || 0), 0),
                dispatch: dayTxs.filter((t: any) => t.type === 'DISPATCH').reduce((s: number, t: any) => s + Number(t.quantity || 0), 0),
                scrap: dayTxs.filter((t: any) => t.type === 'SCRAP').reduce((s: number, t: any) => s + Number(t.quantity || 0), 0),
            };
        });
    }, [filteredTransactions]);

    const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16'];

    // Metric Calculations
    const totalProfilesCount = useMemo(() => {
        if (dashboardBrand === 'All') return profiles.length;
        return profiles.filter((p: any) => p.brand === dashboardBrand).length;
    }, [profiles, dashboardBrand]);

    const windowProfilesCount = useMemo(() => {
        const list = dashboardBrand === 'All' ? profiles : profiles.filter((p: any) => p.brand === dashboardBrand);
        return list.filter((p: any) => p.profileType !== 'REINFORCEMENT').length;
    }, [profiles, dashboardBrand]);

    const reinforcementProfilesCount = useMemo(() => {
        const list = dashboardBrand === 'All' ? profiles : profiles.filter((p: any) => p.brand === dashboardBrand);
        return list.filter((p: any) => p.profileType === 'REINFORCEMENT').length;
    }, [profiles, dashboardBrand]);

    const lowStockItems = useMemo(() => {
        return filteredStockData.filter((p: any) => {
            const reorder = (p.reorderPoint !== undefined && p.reorderPoint !== null && p.reorderPoint > 0) ? p.reorderPoint : 50;
            const available = (Number(p.currentStock) || 0) - (Number(p.reservedStock) || 0);
            return available < reorder;
        });
    }, [filteredStockData]);

    const criticalZeroStockCount = useMemo(() => {
        return filteredStockData.filter((p: any) => {
            const available = (Number(p.currentStock) || 0) - (Number(p.reservedStock) || 0);
            return available <= 0;
        }).length;
    }, [filteredStockData]);

    const totalValue = useMemo(() => {
        return filteredStockData.reduce((sum: number, p: any) => sum + ((Number(p.currentStock) || 0) * (Number(p.price) || 0)), 0);
    }, [filteredStockData]);

    const totalAvailable = useMemo(() => {
        return filteredStockData.reduce((s: number, p: any) => s + ((Number(p.currentStock) || 0) - (Number(p.reservedStock) || 0)), 0);
    }, [filteredStockData]);

    const totalPackets = useMemo(() => {
        return filteredStockData.reduce((s: number, p: any) => {
            const avail = (Number(p.currentStock) || 0) - (Number(p.reservedStock) || 0);
            const pPerPkt = Number(p.piecesPerPacket) || 1;
            return s + (pPerPkt > 0 ? Math.floor(Math.max(0, avail) / pPerPkt) : 0);
        }, 0);
    }, [filteredStockData]);

    const totalWeightKg = useMemo(() => {
        return filteredStockData.reduce((s: number, p: any) => {
            const avail = (Number(p.currentStock) || 0) - (Number(p.reservedStock) || 0);
            const wt = Number(p.weight) || 0;
            return s + (Math.max(0, avail) * wt);
        }, 0);
    }, [filteredStockData]);

    return (
        <div className="space-y-6">
            {/* Dashboard Header & Brand Filter Bar */}
            <div className="bg-white dark:bg-gray-800 p-4 rounded-2xl border border-gray-200/80 dark:border-gray-700 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 rounded-xl">
                        <BarChart3 className="w-5 h-5" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h2 className="text-lg font-black text-gray-900 dark:text-white uppercase tracking-tight">Executive Inventory Dashboard</h2>
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300">
                                Live Sync
                            </span>
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                            Real-time profile metrics, reorder thresholds, inventory valuation, and production flow
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                    <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-900 px-3 py-1.5 rounded-xl border border-gray-200 dark:border-gray-700">
                        <Filter className="w-4 h-4 text-gray-400" />
                        <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Brand:</span>
                        <select 
                            value={dashboardBrand} 
                            onChange={(e) => setDashboardBrand(e.target.value)}
                            className="bg-transparent text-xs font-black text-gray-800 dark:text-gray-100 border-none focus:ring-0 cursor-pointer pr-6 py-0.5"
                        >
                            <option value="All">All Brands Overview</option>
                            {brands.map((b: string) => <option key={b} value={b}>{b}</option>)}
                        </select>
                    </div>

                    {dashboardBrand !== 'All' && (
                        <button 
                            onClick={() => setDashboardBrand('All')}
                            className="px-2.5 py-1.5 text-xs font-bold text-gray-500 hover:text-gray-800 dark:hover:text-white bg-gray-100 dark:bg-gray-700 rounded-xl transition-colors"
                        >
                            Reset
                        </button>
                    )}
                </div>
            </div>

            {/* Top 4 KPI Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                {/* 1. Total Profiles */}
                <button 
                    onClick={() => setIsListOpen(true)} 
                    className="group text-left focus:outline-none"
                >
                    <div className="h-full bg-white dark:bg-gray-800 rounded-2xl p-5 border border-gray-200/80 dark:border-gray-700 shadow-xs hover:shadow-md transition-all duration-200 border-l-4 border-l-blue-500 flex flex-col justify-between">
                        <div>
                            <div className="flex justify-between items-start mb-2">
                                <p className="text-[11px] font-black text-gray-500 dark:text-gray-400 uppercase tracking-wider">Total Profiles</p>
                                <div className="p-2 bg-blue-50 dark:bg-blue-900/30 rounded-xl text-blue-600 dark:text-blue-400 group-hover:scale-110 transition-transform">
                                    <Package className="w-5 h-5" />
                                </div>
                            </div>
                            <h4 className="text-3xl font-black text-gray-900 dark:text-white font-mono tracking-tight">{totalProfilesCount}</h4>
                            <div className="flex items-center gap-1.5 mt-2 text-[10px] text-gray-500 font-medium">
                                <span className="px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-bold">{windowProfilesCount} Win</span>
                                <span className="px-1.5 py-0.5 rounded bg-orange-50 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 font-bold">{reinforcementProfilesCount} Reinf</span>
                            </div>
                        </div>
                        <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-700/60 flex items-center justify-between text-[11px] text-blue-600 dark:text-blue-400 font-bold uppercase tracking-wider">
                            <span>View Master Catalog</span>
                            <ArrowUpRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                        </div>
                    </div>
                </button>

                {/* 2. Low Stock Alerts */}
                <button 
                    onClick={() => setIsLowStockOpen(true)} 
                    className="group text-left focus:outline-none"
                >
                    <div className={`h-full bg-white dark:bg-gray-800 rounded-2xl p-5 border border-gray-200/80 dark:border-gray-700 shadow-xs hover:shadow-md transition-all duration-200 border-l-4 ${
                        lowStockItems.length > 0 ? 'border-l-red-500' : 'border-l-green-500'
                    } flex flex-col justify-between`}>
                        <div>
                            <div className="flex justify-between items-start mb-2">
                                <p className="text-[11px] font-black text-gray-500 dark:text-gray-400 uppercase tracking-wider">Low Stock Alerts</p>
                                <div className={`p-2 rounded-xl group-hover:scale-110 transition-transform ${
                                    lowStockItems.length > 0 
                                        ? 'bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400' 
                                        : 'bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400'
                                }`}>
                                    <AlertTriangle className="w-5 h-5" />
                                </div>
                            </div>
                            <div className="flex items-baseline gap-2">
                                <h4 className={`text-3xl font-black font-mono tracking-tight ${
                                    lowStockItems.length > 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-white'
                                }`}>
                                    {lowStockItems.length}
                                </h4>
                                {criticalZeroStockCount > 0 && (
                                    <span className="text-[10px] font-black text-white bg-red-600 px-1.5 py-0.5 rounded-full uppercase">
                                        {criticalZeroStockCount} Zero
                                    </span>
                                )}
                            </div>
                            <p className="mt-2 text-[10px] text-gray-500 font-medium">
                                {lowStockItems.length > 0 
                                    ? `${criticalZeroStockCount} critical out of stock, ${lowStockItems.length - criticalZeroStockCount} near reorder`
                                    : "All profiles maintained at or above safety thresholds"}
                            </p>
                        </div>
                        <div className={`mt-4 pt-3 border-t border-gray-100 dark:border-gray-700/60 flex items-center justify-between text-[11px] font-bold uppercase tracking-wider ${
                            lowStockItems.length > 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'
                        }`}>
                            <span>{lowStockItems.length > 0 ? 'Action Required' : 'Optimal Status'}</span>
                            <ArrowUpRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                        </div>
                    </div>
                </button>

                {/* 3. Inventory Value */}
                <button 
                    onClick={() => setIsValueOpen(true)} 
                    className="group text-left focus:outline-none"
                >
                    <div className="h-full bg-white dark:bg-gray-800 rounded-2xl p-5 border border-gray-200/80 dark:border-gray-700 shadow-xs hover:shadow-md transition-all duration-200 border-l-4 border-l-green-500 flex flex-col justify-between">
                        <div>
                            <div className="flex justify-between items-start mb-2">
                                <p className="text-[11px] font-black text-gray-500 dark:text-gray-400 uppercase tracking-wider">Inventory Value</p>
                                <div className="p-2 bg-green-50 dark:bg-green-900/30 rounded-xl text-green-600 dark:text-green-400 group-hover:scale-110 transition-transform">
                                    <DollarSign className="w-5 h-5" />
                                </div>
                            </div>
                            <h4 className="text-2xl lg:text-3xl font-black text-gray-900 dark:text-white font-mono tracking-tight">
                                ₹{totalValue.toLocaleString('en-IN')}
                            </h4>
                            <p className="mt-2 text-[10px] text-gray-500 font-medium">
                                Based on current physical quantities & profile unit rates
                            </p>
                        </div>
                        <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-700/60 flex items-center justify-between text-[11px] text-green-600 dark:text-green-400 font-bold uppercase tracking-wider">
                            <span>Financial Breakdown</span>
                            <ArrowUpRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                        </div>
                    </div>
                </button>

                {/* 4. Net Available Stock */}
                <div className="h-full bg-white dark:bg-gray-800 rounded-2xl p-5 border border-gray-200/80 dark:border-gray-700 shadow-xs border-l-4 border-l-indigo-500 flex flex-col justify-between">
                    <div>
                        <div className="flex justify-between items-start mb-2">
                            <p className="text-[11px] font-black text-gray-500 dark:text-gray-400 uppercase tracking-wider">Available Stock</p>
                            <div className="p-2 bg-indigo-50 dark:bg-indigo-900/30 rounded-xl text-indigo-600 dark:text-indigo-400">
                                <Layers className="w-5 h-5" />
                            </div>
                        </div>
                        <h4 className="text-3xl font-black text-gray-900 dark:text-white font-mono tracking-tight">
                            {totalAvailable.toLocaleString()} <span className="text-xs font-bold text-gray-400 font-sans">Pcs</span>
                        </h4>
                        <div className="flex items-center gap-2 mt-2 text-[10px] text-gray-500 font-medium">
                            <span className="px-1.5 py-0.5 rounded bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 font-bold">~{totalPackets} Pkts</span>
                            <span className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-bold">~{(totalWeightKg / 1000).toFixed(2)} MT</span>
                        </div>
                    </div>
                    <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-700/60 flex items-center justify-between text-[11px] text-indigo-600 dark:text-indigo-400 font-bold uppercase tracking-wider">
                        <span>Net Free Stock</span>
                        <span className="text-gray-400 font-normal">Physical - Reserved</span>
                    </div>
                </div>
            </div>

            {/* Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Brand Distribution Donut */}
                <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-200/80 dark:border-gray-700 shadow-xs flex flex-col justify-between">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-xs font-black uppercase text-gray-500 dark:text-gray-400 tracking-wider flex items-center gap-2">
                            <PieChartIcon className="w-4 h-4 text-blue-500" /> Brand Distribution (Pcs)
                        </h3>
                        <span className="text-[10px] font-mono font-bold text-gray-400">{brandStats.length} Brands</span>
                    </div>
                    <div className="h-64 relative">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={brandStats}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={55}
                                    outerRadius={78}
                                    paddingAngle={4}
                                    dataKey="qty"
                                >
                                    {brandStats.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip 
                                    contentStyle={{ 
                                        borderRadius: '12px', 
                                        backgroundColor: '#1F2937', 
                                        color: '#FFFFFF',
                                        border: 'none', 
                                        boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.2)' 
                                    }}
                                    formatter={(value: any, name: any) => [`${Number(value).toLocaleString()} Pcs`, name]}
                                />
                                <Legend verticalAlign="bottom" height={36} iconType="circle" />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Production vs Dispatch Trend */}
                <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-200/80 dark:border-gray-700 shadow-xs lg:col-span-2">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-xs font-black uppercase text-gray-500 dark:text-gray-400 tracking-wider flex items-center gap-2">
                            <TrendingUp className="w-4 h-4 text-green-500" /> 7-Day Activity Trends (Pcs)
                        </h3>
                        <div className="flex items-center gap-3 text-[10px] font-bold">
                            <span className="flex items-center gap-1 text-green-600"><span className="w-2 h-2 rounded-full bg-green-500"></span> Production</span>
                            <span className="flex items-center gap-1 text-blue-600"><span className="w-2 h-2 rounded-full bg-blue-500"></span> Dispatch</span>
                            <span className="flex items-center gap-1 text-red-500"><span className="w-2 h-2 rounded-full bg-red-400"></span> Scrap</span>
                        </div>
                    </div>
                    <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={trendData}>
                                <defs>
                                    <linearGradient id="colorProd" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#10B981" stopOpacity={0.25}/>
                                        <stop offset="95%" stopColor="#10B981" stopOpacity={0}/>
                                    </linearGradient>
                                    <linearGradient id="colorDisp" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.25}/>
                                        <stop offset="95%" stopColor="#3B82F6" stopOpacity={0}/>
                                    </linearGradient>
                                    <linearGradient id="colorScrap" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#EF4444" stopOpacity={0.25}/>
                                        <stop offset="95%" stopColor="#EF4444" stopOpacity={0}/>
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#9CA3AF' }} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#9CA3AF' }} />
                                <Tooltip 
                                    contentStyle={{ 
                                        borderRadius: '12px', 
                                        backgroundColor: '#1F2937', 
                                        color: '#FFFFFF',
                                        border: 'none', 
                                        boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.2)' 
                                    }}
                                />
                                <Area type="monotone" dataKey="production" name="Production" stroke="#10B981" fillOpacity={1} fill="url(#colorProd)" strokeWidth={2.5} />
                                <Area type="monotone" dataKey="dispatch" name="Dispatch" stroke="#3B82F6" fillOpacity={1} fill="url(#colorDisp)" strokeWidth={2.5} />
                                <Area type="monotone" dataKey="scrap" name="Scrap" stroke="#EF4444" fillOpacity={1} fill="url(#colorScrap)" strokeWidth={2} />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            {/* Bottom Section: Brand Summary Breakdown & Recent Activity */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Brand Summary Table */}
                <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-200/80 dark:border-gray-700 shadow-xs">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-xs font-black uppercase text-gray-500 dark:text-gray-400 tracking-wider flex items-center gap-2">
                            <Filter className="w-4 h-4 text-blue-500" /> Brand Master Summary
                        </h3>
                        <span className="text-[10px] text-gray-400 font-bold">Aggregated by Brand</span>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-xs text-left">
                            <thead className="text-gray-400 dark:text-gray-500 uppercase tracking-wider border-b dark:border-gray-700 text-[10px] font-black">
                                <tr>
                                    <th className="pb-3 font-bold">Brand</th>
                                    <th className="pb-3 text-right font-bold">Profiles</th>
                                    <th className="pb-3 text-right font-bold">Stock (Pcs)</th>
                                    <th className="pb-3 text-right font-bold">Packets</th>
                                    <th className="pb-3 text-right font-bold">Valuation (₹)</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                                {brandStats.map((brand, idx) => (
                                    <tr key={brand.name} className="hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors">
                                        <td className="py-3 flex items-center gap-2">
                                            <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: COLORS[idx % COLORS.length] }}></div>
                                            <span className="font-black text-gray-900 dark:text-white uppercase">{brand.name}</span>
                                        </td>
                                        <td className="py-3 text-right font-mono text-gray-500">{brand.count}</td>
                                        <td className="py-3 text-right font-black text-gray-900 dark:text-white font-mono">{(brand.qty || 0).toLocaleString()}</td>
                                        <td className="py-3 text-right font-mono text-gray-500">{(brand.packets || 0).toLocaleString()}</td>
                                        <td className="py-3 text-right font-black text-green-600 font-mono">₹{(brand.value || 0).toLocaleString('en-IN')}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Recent Manufacturing & Dispatch Activity Stream */}
                <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-200/80 dark:border-gray-700 shadow-xs">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-xs font-black uppercase text-gray-500 dark:text-gray-400 tracking-wider flex items-center gap-2">
                            <History className="w-4 h-4 text-indigo-500" /> Recent Operations Log
                        </h3>
                        {onNavigateTab && (
                            <button 
                                onClick={() => onNavigateTab('Stock')}
                                className="text-[10px] font-black text-blue-600 hover:text-blue-700 uppercase tracking-tight flex items-center gap-1"
                            >
                                View Stock Movements <ArrowRight className="w-3 h-3" />
                            </button>
                        )}
                    </div>
                    <div className="space-y-3">
                        {filteredTransactions.slice(0, 5).map((t: any) => {
                            const profile = profiles.find((p: any) => p.id === t.profileId);
                            const isProd = t.type === 'PRODUCTION' || t.type === 'RETURN';
                            const isDisp = t.type === 'DISPATCH';
                            const isScrap = t.type === 'SCRAP';

                            return (
                                <div key={t.id} className="flex items-center justify-between p-3 rounded-xl bg-gray-50/80 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700 transition-all">
                                    <div className="flex items-center gap-3">
                                        <div className={`p-2 rounded-xl ${
                                            isProd ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300' : 
                                            isDisp ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' : 
                                            'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'
                                        }`}>
                                            {isProd ? <ArrowDownRight className="w-4 h-4" /> : <ArrowUpRight className="w-4 h-4" />}
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs font-black text-gray-900 dark:text-white uppercase leading-none">
                                                    {t.type} {t.refNo ? `• ${t.refNo}` : ''}
                                                </span>
                                                {profile?.brand && (
                                                    <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
                                                        {profile.brand}
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-[10px] text-gray-500 font-medium mt-1">
                                                {profile ? `${profile.sku} - ${profile.name}` : 'Unknown Profile'} • {new Date(t.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className={`text-sm font-black font-mono ${
                                            isProd ? 'text-green-600' : isDisp ? 'text-blue-600' : 'text-red-600'
                                        }`}>
                                            {isProd ? '+' : '-'}{t.quantity} Pcs
                                        </p>
                                        {t.customerName && (
                                            <p className="text-[9px] text-gray-400 max-w-[120px] truncate">{t.customerName}</p>
                                        )}
                                    </div>
                                </div>
                            );
                        })}

                        {filteredTransactions.length === 0 && (
                            <div className="text-center py-10 text-gray-400 text-xs font-bold uppercase tracking-wider">
                                No recent activity recorded for this brand selection.
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Modals with Portals */}
            <Portal>
                <DashboardListModal 
                    isOpen={isListOpen} 
                    onClose={() => setIsListOpen(false)} 
                    items={filteredStockData} 
                    title={dashboardBrand === 'All' ? "Master Profiles Catalog" : `${dashboardBrand} Profiles`} 
                    type="list"
                    brands={brands}
                    onAddProduction={onAddProductionForProfile}
                    onPlan={onPlanForProfile}
                />
            </Portal>
            <Portal>
                <DashboardListModal 
                    isOpen={isLowStockOpen} 
                    onClose={() => setIsLowStockOpen(false)} 
                    items={lowStockItems} 
                    title="Low Stock Alerts & Reorder Requirements" 
                    type="lowstock"
                    brands={brands}
                    onAddProduction={onAddProductionForProfile}
                    onPlan={onPlanForProfile}
                />
            </Portal>
            <Portal>
                <DashboardListModal 
                    isOpen={isValueOpen} 
                    onClose={() => setIsValueOpen(false)} 
                    items={filteredStockData} 
                    title="Inventory Valuation Breakdown" 
                    type="value"
                    brands={brands}
                    onAddProduction={onAddProductionForProfile}
                    onPlan={onPlanForProfile}
                />
            </Portal>
        </div>
    );
};

// --- MAIN PROFILE SECTION ---
const ProfileSection: React.FC<ProfileSectionProps> = ({ 
    addToast, 
    initialTab,
    initialSubTab,
    initialAction,
    onResetInitialAction
}) => {
    const [activeTab, setActiveTab] = useState<Tab>(initialTab || 'Profiles');
    const [profileSubTab, setProfileSubTab] = useState<ProfileSubTab>(
        (initialSubTab as ProfileSubTab) || 'Profiles'
    );
    const [productionSubTab, setProductionSubTab] = useState<ProductionSubTab>(
        (initialSubTab as ProductionSubTab) || 'Inflow'
    );
    const [stockSubTab, setStockSubTab] = useState<'Current Stock' | 'Stock Movement'>('Current Stock');
    const [transactionFilterType, setTransactionFilterType] = useState<'WINDOW' | 'REINFORCEMENT' | null>(null);
    const syncProfilesToStock = useStore(state => state.syncProfilesToStock);
    const savedFilters = useStore(state => state.uiState.profileFilters);
    const setSavedFilters = useStore(state => state.setProfileFilters);
    const [searchTerm, setSearchTerm] = useState(savedFilters.searchTerm || '');
    const [brandFilter, setBrandFilter] = useState(savedFilters.brand || 'All');
    const [typeFilter, setTypeFilter] = useState<'All' | 'WINDOW' | 'REINFORCEMENT'>('All');
    
    useEffect(() => { setSavedFilters({ searchTerm, brand: brandFilter }); }, [searchTerm, brandFilter, setSavedFilters]);

    // Keep activeTab in sync with external navigation state
    useEffect(() => {
        if (initialTab) {
            setActiveTab(initialTab);
        }
    }, [initialTab]);

    // Keep subTabs in sync with external navigation state
    useEffect(() => {
        if (initialSubTab) {
            if (initialSubTab === 'Inflow' || initialSubTab === 'Outflow') {
                setProductionSubTab(initialSubTab as ProductionSubTab);
            } else if (initialSubTab === 'Profiles' || initialSubTab === 'Protective Films') {
                setProfileSubTab(initialSubTab as ProfileSubTab);
            }
        }
    }, [initialSubTab]);

    const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
    const [editingProfile, setEditingProfile] = useState<Profile | null>(null);
    const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
    const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
    const [isTransactionModalOpen, setIsTransactionModalOpen] = useState(false);
    const [transactionType, setTransactionType] = useState<'PRODUCTION' | 'DISPATCH' | 'SCRAP'>('PRODUCTION');
    const [initialTransactionProfile, setInitialTransactionProfile] = useState<string | null>(null);
    const [initialTransactionBrand, setInitialTransactionBrand] = useState<string | null>(null);
    const [editingTransaction, setEditingTransaction] = useState<ProfileTransaction | null>(null);
    const [isQuotationModalOpen, setIsQuotationModalOpen] = useState(false);
    const [editingQuotation, setEditingQuotation] = useState<ProfileTransaction[] | null>(null);
    const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);

    // Auto-trigger requested actions (e.g. from Dashboard switches)
    useEffect(() => {
        if (!initialAction) return;

        if (initialAction === 'ADD_PRODUCTION') {
            setActiveTab('Production');
            setProductionSubTab('Inflow');
            setTransactionType('PRODUCTION');
            setTransactionFilterType(null);
            setEditingTransaction(null);
            setIsTransactionModalOpen(true);
            onResetInitialAction?.();
        } else if (initialAction === 'DISPATCH_ORDER') {
            setActiveTab('Production');
            setProductionSubTab('Outflow');
            setTransactionType('DISPATCH');
            setTransactionFilterType(null);
            setEditingTransaction(null);
            setIsTransactionModalOpen(true);
            onResetInitialAction?.();
        } else if (initialAction === 'NEW_QUOTATION') {
            setActiveTab('Quotations');
            setIsQuotationModalOpen(true);
            onResetInitialAction?.();
        }
    }, [initialAction, onResetInitialAction]);
    const [isManageBrandsModalOpen, setIsManageBrandsModalOpen] = useState(false);
    const [isManageMachinesModalOpen, setIsManageMachinesModalOpen] = useState(false);
    const [isExportStockModalOpen, setIsExportStockModalOpen] = useState(false);
    const [isPlanModalOpen, setIsPlanModalOpen] = useState(false);
    const [editingPlan, setEditingPlan] = useState<any>(null);
    const [isDieModalOpen, setIsDieModalOpen] = useState(false);
    const [editingDie, setEditingDie] = useState<any>(null);
    const [logSheetDie, setLogSheetDie] = useState<any>(null);
    const [analysisMonth, setAnalysisMonth] = useState(new Date().toISOString().substring(0, 7));
    const [isUploadingPdf, setIsUploadingPdf] = useState(false);
    const [isCatalogueBrandModalOpen, setIsCatalogueBrandModalOpen] = useState(false);
    const [pendingCatalogueFile, setPendingCatalogueFile] = useState<{ base64: string, mimeType: string, name: string } | null>(null);
    const [isDuplicateModalOpen, setIsDuplicateModalOpen] = useState(false);
    const [duplicateConflicts, setDuplicateConflicts] = useState<DuplicateConflictItem[]>([]);
    const [duplicateNonConflicts, setDuplicateNonConflicts] = useState<any[]>([]);
    const [duplicateCallback, setDuplicateCallback] = useState<((resolutions: DuplicateConflictItem[]) => void) | null>(null);
    const pdfFileInputRef = useRef<HTMLInputElement>(null);
    const excelFileInputRef = useRef<HTMLInputElement>(null);

    const [isDownloadStockMenuOpen, setIsDownloadStockMenuOpen] = useState(false);
    const [isDownloadProfileMenuOpen, setIsDownloadProfileMenuOpen] = useState(false);
    const downloadStockMenuRef = useRef<HTMLDivElement>(null);
    const downloadProfileMenuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (downloadStockMenuRef.current && !downloadStockMenuRef.current.contains(event.target as Node)) {
                setIsDownloadStockMenuOpen(false);
            }
            if (downloadProfileMenuRef.current && !downloadProfileMenuRef.current.contains(event.target as Node)) {
                setIsDownloadProfileMenuOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, []);

    const handleExportStockExcel = () => {
        try {
            let headers: string[] = [];
            let rows: any[][] = [];
            let fileName = '';
            let sheetName = '';

            if (stockSubTab === 'Current Stock') {
                headers = ['SKU', 'Profile Name', 'Brand', 'Category', 'Std Length (m)', 'Weight (kg)', 'Current Pieces', 'Total Weight (kg)', 'Reorder Level'];
                rows = filteredProfiles.map(p => {
                    const pieces = p.currentStock || 0;
                    const totalWeight = pieces * (p.weight || 0);
                    return [
                        p.sku || 'N/A',
                        p.name || 'N/A',
                        p.brand || 'General',
                        p.category || 'N/A',
                        p.length || 0,
                        p.weight || 0,
                        pieces,
                        totalWeight.toFixed(2),
                        p.reorderPoint || 50
                    ];
                });
                fileName = 'Current_Stock';
                sheetName = 'Current Stock';
            } else {
                headers = ['Date', 'Ref No', 'SKU', 'Profile Name', 'Brand', 'Customer', 'Type', 'UoM', 'Quantity', 'Status'];
                const txs = profileTransactions.filter(t => !t.deletedAt && (typeFilter === 'All' || (typeFilter === 'WINDOW' && (!getProfile(t.profileId)?.profileType || getProfile(t.profileId)?.profileType === 'WINDOW')) || (typeFilter === 'REINFORCEMENT' && getProfile(t.profileId)?.profileType === 'REINFORCEMENT')));
                rows = txs.map(t => {
                    const p = getProfile(t.profileId);
                    return [
                        t.date || t.createdAt?.slice(0, 10) || 'N/A',
                        t.refNo || 'N/A',
                        p?.sku || 'N/A',
                        p?.name || 'N/A',
                        t.brand || p?.brand || 'General',
                        t.customer || 'N/A',
                        t.type || 'N/A',
                        t.uom || 'Pcs',
                        t.quantity || 0,
                        t.status || 'N/A'
                    ];
                });
                fileName = 'Stock_Movement';
                sheetName = 'Stock Movement';
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
            setIsDownloadStockMenuOpen(false);
        } catch (error) {
            console.error('Stock Excel Export Error:', error);
            addToast('Failed to generate Excel sheet.', 'error');
        }
    };

    const handleExportStockPdf = () => {
        try {
            let headers: string[] = [];
            let rows: any[][] = [];
            let title = '';
            let fileName = '';

            if (stockSubTab === 'Current Stock') {
                headers = ['SKU', 'Profile Name', 'Brand', 'Category', 'Length(m)', 'Weight(kg)', 'Reorder'];
                rows = filteredProfiles.map(p => {
                    const pieces = p.currentStock || 0;
                    const totalWeight = pieces * (p.weight || 0);
                    return [
                        p.sku || 'N/A',
                        p.name || 'N/A',
                        p.brand || 'General',
                        p.category || 'N/A',
                        `${p.length || 0}m`,
                        `${pieces} Pcs (${totalWeight.toFixed(1)} kg)`,
                        p.reorderPoint || 50
                    ];
                });
                title = 'Current Profile Stock Status';
                fileName = 'Current_Stock';
            } else {
                headers = ['Date', 'Ref No', 'SKU', 'Profile Name', 'Type', 'Qty', 'Customer'];
                const txs = profileTransactions.filter(t => !t.deletedAt && (typeFilter === 'All' || (typeFilter === 'WINDOW' && (!getProfile(t.profileId)?.profileType || getProfile(t.profileId)?.profileType === 'WINDOW')) || (typeFilter === 'REINFORCEMENT' && getProfile(t.profileId)?.profileType === 'REINFORCEMENT')));
                rows = txs.map(t => {
                    const p = getProfile(t.profileId);
                    return [
                        t.date || t.createdAt?.slice(0, 10) || 'N/A',
                        t.refNo || 'N/A',
                        p?.sku || 'N/A',
                        p?.name || 'N/A',
                        t.type || 'N/A',
                        `${t.quantity} ${t.uom || 'Pcs'}`,
                        t.customer || 'N/A'
                    ];
                });
                title = 'Stock Movement Logs';
                fileName = 'Stock_Movement';
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
                headStyles: { fillColor: [59, 130, 246], fontStyle: 'bold' },
                alternateRowStyles: { fillColor: [248, 250, 252] },
            });

            const dateStr = new Date().toISOString().split('T')[0];
            doc.save(`${fileName}_${dateStr}.pdf`);
            addToast(`Successfully downloaded ${stockSubTab} PDF report!`, 'success');
            setIsDownloadStockMenuOpen(false);
        } catch (error) {
            console.error('Stock PDF Export Error:', error);
            addToast('Failed to generate PDF document.', 'error');
        }
    };

    const handleExportProfilesExcel = () => {
        try {
            const headers = ['SKU', 'Profile Name', 'Brand', 'Category', 'Standard Length (m)', 'Weight (kg/m)', 'Pcs/Packet', 'Status'];
            const rows = filteredProfiles.map(p => [
                p.sku || 'N/A',
                p.name || 'N/A',
                p.brand || 'General',
                p.category || 'N/A',
                p.length || 0,
                p.weight || 0,
                p.piecesPerPacket || 4,
                'Active'
            ]);

            if (rows.length === 0) {
                addToast('No records available to export.', 'error');
                return;
            }

            const wb = XLSX.utils.book_new();
            const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
            XLSX.utils.book_append_sheet(wb, ws, 'Profiles Catalog');
            
            const dateStr = new Date().toISOString().split('T')[0];
            XLSX.writeFile(wb, `Profiles_Catalog_${dateStr}.xlsx`);
            addToast('Successfully downloaded Profiles Catalog Excel sheet!', 'success');
            setIsDownloadProfileMenuOpen(false);
        } catch (error) {
            console.error('Profiles Excel Export Error:', error);
            addToast('Failed to generate Excel sheet.', 'error');
        }
    };

    const handleExportProfilesPdf = () => {
        try {
            const headers = ['SKU', 'Profile Name', 'Brand', 'Category', 'Length (m)', 'Weight (kg/m)', 'Pcs/Packet'];
            const rows = filteredProfiles.map(p => [
                p.sku || 'N/A',
                p.name || 'N/A',
                p.brand || 'General',
                p.category || 'N/A',
                p.length || 0,
                p.weight || 0,
                p.piecesPerPacket || 4
            ]);

            if (rows.length === 0) {
                addToast('No records available to export.', 'error');
                return;
            }

            const { jsPDF } = jspdf;
            const doc = new jsPDF({ orientation: 'landscape' });
            
            const generatedDate = new Date().toLocaleDateString();
            doc.text(`Profiles Master Catalogue`, 14, 15);
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
            doc.save(`Profiles_Catalog_${dateStr}.pdf`);
            addToast('Successfully downloaded Profiles Catalog PDF report!', 'success');
            setIsDownloadProfileMenuOpen(false);
        } catch (error) {
            console.error('Profiles PDF Export Error:', error);
            addToast('Failed to generate PDF document.', 'error');
        }
    };

    const handleExcelCatalogueUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (evt) => {
            try {
                const data = evt.target?.result;
                const workbook = XLSX.read(data, { type: 'binary' });
                const firstSheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[firstSheetName];
                const json = XLSX.utils.sheet_to_json(worksheet);
                
                const rowsToProcess: any[] = [];
                json.forEach((row: any) => {
                    const sku = String(row['SKU'] || row['Code'] || row['Profile Code'] || row['profileCode'] || '').trim();
                    if (!sku) return;
                    const name = String(row['Description'] || row['Name'] || row['Profile Name'] || row['name'] || sku).trim();
                    const brand = String(row['Brand'] || row['brand'] || (brandFilter !== 'All' ? brandFilter : brands[0]) || 'General').trim();
                    const category = String(row['Series'] || row['Category'] || row['series'] || '80.5 SERIES').trim();
                    const length = Number(row['Length'] || row['eachLengthMtrs'] || row['length'] || 5.9);
                    const weight = Number(row['Weight'] || row['meterWeight'] || row['weight'] || 0);
                    const piecesPerPacket = Number(row['Pieces/Packet'] || row['lengthsPerPacket'] || row['piecesPerPacket'] || 6);
                    const topFilmWidth = String(row['Top Film Width'] || row['topFilmWidth'] || row['Top/Right Film'] || '38');
                    const topStickerName = String(row['Top Sticker Name'] || row['topStickerName'] || row['Top Sticker'] || '');
                    const bottomFilmWidth = String(row['Bottom Film Width'] || row['bottomFilmWidth'] || row['Bottom/Left Film'] || '38');
                    const bottomStickerName = String(row['Bottom Sticker Name'] || row['bottomStickerName'] || row['Bottom Sticker'] || '');
                    const openingStock = Number(
                        row['Opening Stock'] || 
                        row['Stock'] || 
                        row['Quantity'] || 
                        row['Current Stock'] || 
                        row['Balance'] || 
                        row['Qty'] || 
                        row['Pieces'] || 
                        row['stock'] || 
                        row['Opening Qty'] ||
                        0
                    );

                    rowsToProcess.push({
                        sku,
                        name,
                        category,
                        profileType: 'WINDOW',
                        uom: 'Pcs',
                        length,
                        weight,
                        piecesPerPacket,
                        price: Number(row['Price'] || row['price'] || 150),
                        brand,
                        hsnCode: String(row['HSN'] || '39162099'),
                        topFilmWidth,
                        topStickerName,
                        bottomFilmWidth,
                        bottomStickerName,
                        openingStock
                    });
                });

                if (rowsToProcess.length === 0) {
                    addToast('No valid profiles found in Excel file.', 'info');
                    return;
                }

                // Check duplicates against existing profiles
                const conflicts: DuplicateConflictItem[] = [];
                const nonConflicts: any[] = [];

                rowsToProcess.forEach((item, idx) => {
                    const existing = profiles.find(p => 
                        !p.deletedAt &&
                        p.sku.toLowerCase() === item.sku.toLowerCase() &&
                        (p.brand || 'General').toLowerCase() === (item.brand || 'General').toLowerCase()
                    );

                    if (existing) {
                        conflicts.push({
                            id: `conflict_excel_${idx}_${Date.now()}`,
                            sku: item.sku,
                            brand: item.brand,
                            name: item.name,
                            existing,
                            incoming: item,
                            action: 'REPLACE',
                            customSku: `${item.sku}-V2`
                        });
                    } else {
                        nonConflicts.push(item);
                    }
                });

                const executeImport = (resolutions: DuplicateConflictItem[]) => {
                    let replacedCount = 0;
                    let skippedCount = 0;
                    let addedAsNewCount = 0;

                    resolutions.forEach(res => {
                        if (res.action === 'REPLACE') {
                            if (res.existing && res.existing.id) {
                                updateProfile({
                                    ...(res.existing as Profile),
                                    name: res.incoming.name || res.existing.name || '',
                                    length: res.incoming.length !== undefined ? res.incoming.length : res.existing.length,
                                    weight: res.incoming.weight !== undefined ? res.incoming.weight : res.existing.weight,
                                    piecesPerPacket: res.incoming.piecesPerPacket !== undefined ? res.incoming.piecesPerPacket : res.existing.piecesPerPacket,
                                    price: res.incoming.price !== undefined ? res.incoming.price : res.existing.price,
                                    topFilmWidth: res.incoming.topFilmWidth || (res.existing as any).topFilmWidth,
                                    bottomFilmWidth: res.incoming.bottomFilmWidth || (res.existing as any).bottomFilmWidth,
                                    topStickerName: res.incoming.topStickerName || (res.existing as any).topStickerName,
                                    bottomStickerName: res.incoming.bottomStickerName || (res.existing as any).bottomStickerName,
                                });

                                if (Number(res.incoming.openingStock) > 0) {
                                    addProfileTransaction({
                                        profileId: res.existing.id,
                                        brand: res.existing.brand || res.incoming.brand || 'General',
                                        type: 'PRODUCTION',
                                        quantity: Number(res.incoming.openingStock),
                                        piecesPerPacket: res.incoming.piecesPerPacket || res.existing.piecesPerPacket || 1,
                                        weight: res.incoming.weight || res.existing.weight || 0,
                                        unitPrice: res.incoming.price || res.existing.price || 0,
                                        date: new Date().toISOString(),
                                        status: 'COMPLETED',
                                        refNo: `INIT-${res.existing.sku}`,
                                        notes: 'Replaced profile opening stock sync',
                                    });
                                }
                                replacedCount++;
                            }
                        } else if (res.action === 'ADD_AS_NEW') {
                            addProfile({
                                name: res.incoming.name || res.name || res.sku,
                                category: res.incoming.category || 'Profile',
                                profileType: res.incoming.profileType || 'WINDOW',
                                uom: res.incoming.uom || 'Pcs',
                                length: Number(res.incoming.length) || 5.9,
                                weight: Number(res.incoming.weight) || 0,
                                piecesPerPacket: Number(res.incoming.piecesPerPacket) || 6,
                                price: Number(res.incoming.price) || 150,
                                hsnCode: res.incoming.hsnCode || '39162099',
                                ...res.incoming,
                                sku: res.customSku || `${res.sku}-V2`,
                                brand: res.brand || res.incoming.brand || 'General',
                            });
                            addedAsNewCount++;
                        } else {
                            skippedCount++;
                        }
                    });

                    nonConflicts.forEach(item => {
                        addProfile(item);
                        if (!brands.includes(item.brand)) {
                            addBrand(item.brand);
                        }
                    });

                    syncProfilesToStock();

                    const distinctBrands = Array.from(new Set(rowsToProcess.map(r => r.brand).filter(Boolean)));
                    if (distinctBrands.length === 1 && distinctBrands[0]) {
                        setBrandFilter(distinctBrands[0]);
                    }

                    addToast(
                        `Brand sync complete: ${nonConflicts.length} new added, ${replacedCount} replaced, ${skippedCount} skipped. All tabs (Profiles, Stock, Protective Films, Tooling & Quotes) synchronized!`, 
                        'success'
                    );
                };

                if (conflicts.length > 0) {
                    setDuplicateConflicts(conflicts);
                    setDuplicateNonConflicts(nonConflicts);
                    setDuplicateCallback(() => executeImport);
                    setIsDuplicateModalOpen(true);
                } else {
                    // All new, no conflicts
                    nonConflicts.forEach(item => {
                        addProfile(item);
                        if (!brands.includes(item.brand)) {
                            addBrand(item.brand);
                        }
                    });
                    syncProfilesToStock();
                    const distinctBrands = Array.from(new Set(rowsToProcess.map(r => r.brand).filter(Boolean)));
                    if (distinctBrands.length === 1 && distinctBrands[0]) {
                        setBrandFilter(distinctBrands[0]);
                    }
                    addToast(`Successfully imported & synced ${nonConflicts.length} profiles across all tabs!`, 'success');
                }
            } catch (err) {
                console.error(err);
                addToast('Failed to parse Excel file. Ensure valid columns (SKU, Description, Brand, Top Film Width, Bottom Film Width, etc.)', 'error');
            } finally {
                if (excelFileInputRef.current) excelFileInputRef.current.value = '';
            }
        };
        reader.readAsBinaryString(file);
    };

    const handlePdfCatalogueUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = (event) => {
            const dataUrl = event.target?.result as string;
            const base64Data = dataUrl.split(',')[1];
            setPendingCatalogueFile({
                base64: base64Data,
                mimeType: file.type,
                name: file.name
            });
            setIsCatalogueBrandModalOpen(true);
        };
        reader.readAsDataURL(file);
        if (pdfFileInputRef.current) pdfFileInputRef.current.value = '';
    };

    const confirmCatalogueUpload = async (brand: string) => {
        if (!pendingCatalogueFile) return;
        setIsCatalogueBrandModalOpen(false);
        setIsUploadingPdf(true);
        
        try {
            const res = await fetch('/api/ai/parse-catalogue', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    fileData: pendingCatalogueFile.base64, 
                    mimeType: pendingCatalogueFile.mimeType,
                    fileName: pendingCatalogueFile.name,
                    brandName: brand
                })
            });
            const data = await res.json();
            if (data.profiles && Array.isArray(data.profiles)) {
                const rowsToProcess: any[] = [];
                data.profiles.forEach((p: any) => {
                    if (p.sku) {
                        const profType = String(p.profileType || '').toUpperCase();
                        rowsToProcess.push({
                            sku: p.sku,
                            name: p.name || p.sku,
                            category: p.category || 'Profile',
                            profileType: (profType === 'REINFORCEMENT' ? 'REINFORCEMENT' : profType === 'DOOR' ? 'DOOR' : 'WINDOW') as any,
                            uom: p.uom || 'Pcs',
                            length: Number(p.length) || 5.9,
                            weight: Number(p.weight) || 0,
                            meterWeight: Number(p.meterWeight) || (p.weight && p.length ? p.weight / p.length : 0),
                            piecesPerPacket: Number(p.piecesPerPacket) || 6,
                            price: Number(p.price) || 150,
                            brand: brand,
                            hsnCode: p.hsnCode || (profType === 'REINFORCEMENT' ? '72165000' : '39162099'),
                            topFilmWidth: p.topFilmWidth,
                            bottomFilmWidth: p.bottomFilmWidth,
                        });
                    }
                });

                const conflicts: DuplicateConflictItem[] = [];
                const nonConflicts: any[] = [];

                rowsToProcess.forEach((item, idx) => {
                    const existing = profiles.find(p => 
                        !p.deletedAt &&
                        p.sku.toLowerCase() === item.sku.toLowerCase() &&
                        (p.brand || 'General').toLowerCase() === (item.brand || 'General').toLowerCase()
                    );

                    if (existing) {
                        conflicts.push({
                            id: `conflict_pdf_${idx}_${Date.now()}`,
                            sku: item.sku,
                            brand: item.brand,
                            name: item.name,
                            existing,
                            incoming: item,
                            action: 'REPLACE',
                            customSku: `${item.sku}-V2`
                        });
                    } else {
                        nonConflicts.push(item);
                    }
                });

                const executePdfImport = (resolutions: DuplicateConflictItem[]) => {
                    let replacedCount = 0;
                    let skippedCount = 0;
                    let addedAsNewCount = 0;

                    resolutions.forEach(res => {
                        if (res.action === 'REPLACE' && res.existing && res.existing.id) {
                            updateProfile({
                                ...(res.existing as Profile),
                                name: res.incoming.name || res.existing.name || '',
                                length: res.incoming.length !== undefined ? res.incoming.length : res.existing.length,
                                weight: res.incoming.weight !== undefined ? res.incoming.weight : res.existing.weight,
                                piecesPerPacket: res.incoming.piecesPerPacket !== undefined ? res.incoming.piecesPerPacket : res.existing.piecesPerPacket,
                            });
                            replacedCount++;
                        } else if (res.action === 'ADD_AS_NEW') {
                            addProfile({
                                name: res.incoming.name || res.name || res.sku,
                                category: res.incoming.category || 'Profile',
                                profileType: res.incoming.profileType || 'WINDOW',
                                uom: res.incoming.uom || 'Pcs',
                                length: Number(res.incoming.length) || 5.9,
                                weight: Number(res.incoming.weight) || 0,
                                piecesPerPacket: Number(res.incoming.piecesPerPacket) || 6,
                                price: Number(res.incoming.price) || 150,
                                hsnCode: res.incoming.hsnCode || '39162099',
                                ...res.incoming,
                                sku: res.customSku || `${res.sku}-V2`,
                                brand: res.brand || res.incoming.brand || 'General',
                            });
                            addedAsNewCount++;
                        } else {
                            skippedCount++;
                        }
                    });

                    nonConflicts.forEach(item => {
                        addProfile(item);
                    });

                    if (!brands.includes(brand)) {
                        addBrand(brand);
                    }

                    addToast(
                        `Catalogue import complete: ${nonConflicts.length} new added, ${replacedCount} replaced, ${skippedCount} skipped, ${addedAsNewCount} added as new!`, 
                        'success'
                    );
                };

                if (conflicts.length > 0) {
                    setDuplicateConflicts(conflicts);
                    setDuplicateNonConflicts(nonConflicts);
                    setDuplicateCallback(() => executePdfImport);
                    setIsDuplicateModalOpen(true);
                } else {
                    nonConflicts.forEach(item => addProfile(item));
                    if (!brands.includes(brand)) addBrand(brand);

                    if (data.fallbackNote) {
                        addToast(`Imported ${nonConflicts.length} profile templates for ${brand}. (Note: ${data.fallbackNote})`, 'info');
                    } else {
                        addToast(`Successfully imported ${nonConflicts.length} profiles for brand ${brand}!`, 'success');
                    }
                }
            } else {
                addToast(data.error || 'No profiles found in catalogue.', 'error');
            }
        } catch (err) {
            console.error(err);
            addToast('Failed to parse catalogue.', 'error');
        } finally {
            setIsUploadingPdf(false);
            setPendingCatalogueFile(null);
        }
    };

    const tabs = [
        { id: 'Profiles' as Tab, label: 'Profiles', icon: Package },
        { id: 'Protective Films' as Tab, label: 'Protective Films', icon: Shield },
        { id: 'Dashboard' as Tab, label: 'Dashboard', icon: BarChart3 },
        { id: 'Quotations' as Tab, label: 'Quotations', icon: ClipboardList },
        { id: 'Stock' as Tab, label: 'Stock (Window)', icon: Warehouse },
        { id: 'Production' as Tab, label: 'Production (Window Inflow)', icon: Activity },
        { id: 'Reinforcement Stock' as Tab, label: 'Reinforcement Stock', icon: Layers },
        { id: 'Reinforcement Inflow' as Tab, label: 'Reinforcement Inflow', icon: CloudUploadIcon },
        { id: 'Data plan' as Tab, label: 'Data Plan', icon: FileSpreadsheet },
        { id: 'Planning' as Tab, label: 'Planning', icon: Calendar },
        { id: 'Scrap' as Tab, label: 'Scrap', icon: Trash2 },
        { id: 'Analysis' as Tab, label: 'Analysis', icon: PieChartIcon },
        { id: 'Dies' as Tab, label: 'Dies', icon: Cpu },
        { id: 'Customers' as Tab, label: 'Customers', icon: User },
        { id: 'Brand Sync Planning' as Tab, label: 'Brand Sync', icon: Zap },
    ];

    const { 
        profiles: rawProfiles, 
        profileTransactions: rawProfileTransactions, 
        addProfileTransaction, 
        updateProfileTransaction, 
        deleteProfileTransaction,
        resolveQuotation,
        customers: rawCustomers,
        addCustomer,
        updateCustomer,
        deleteCustomer,
        brands,
        companySettings,
        updateCompanySettings,
        addProfile,
        updateProfile,
        deleteProfile,
        dies: rawDies,
        productionPlans: rawProductionPlans,
        addProductionPlan,
        updateProductionPlan,
        deleteProductionPlan,
        machines,
        addMachine,
        deleteMachine,
        addDie,
        updateDie,
        deleteDie,
        addBrand,
        updateBrand,
        deleteBrand,
        dataPlanSheet,
        updateDataPlanSheet
    } = useStore();

    const profiles = useMemo(() => rawProfiles.filter(p => !p.deletedAt), [rawProfiles]);
    const profileTransactions = useMemo(() => rawProfileTransactions.filter(t => !t.deletedAt), [rawProfileTransactions]);
    const dies = useMemo(() => rawDies.filter(d => !d.deletedAt), [rawDies]);
    const productionPlans = useMemo(() => rawProductionPlans.filter(p => !p.deletedAt), [rawProductionPlans]);
    const customers = useMemo(() => rawCustomers.filter(c => !c.deletedAt), [rawCustomers]);

    // Export Live Stock to Data Plan Sheet
    const handleExportStockToDataPlan = useCallback((targetBrandFilter?: string) => {
        const normalizeName = (str: string) => str.toUpperCase().replace(/[.\-_/\\]/g, ' ').replace(/\s+/g, ' ').trim();

        updateDataPlanSheet(prev => {
            const curCols = [...(prev.columns && prev.columns.length > 0 ? prev.columns : INITIAL_DATA_PLAN_COLUMNS)];
            const activeBrandsList = ['S CRAFT', 'SMART', ...(brands || [])].filter((v, i, a) => a.indexOf(v) === i);

            // Ensure columns exist for all registered brands
            activeBrandsList.forEach(brandName => {
                const isSCraft = brandName.toUpperCase().includes('CRAFT');
                const isSmart = brandName.toUpperCase() === 'SMART';
                
                if (isSCraft && !curCols.some(c => c.id === 'scraftTotal')) {
                    curCols.splice(1, 0, {
                        id: 'scraftTotal',
                        label: 'S CRAFT TOTAL (L)',
                        type: 'brand',
                        brandName: 'S CRAFT',
                        width: '150px',
                        align: 'right'
                    });
                } else if (isSmart && !curCols.some(c => c.id === 'smartTotal')) {
                    const prodIdx = curCols.findIndex(c => c.id === 'product');
                    curCols.splice(prodIdx !== -1 ? prodIdx + 1 : 2, 0, {
                        id: 'smartTotal',
                        label: 'TOTAL SMART (L)',
                        type: 'brand',
                        brandName: 'SMART',
                        width: '150px',
                        align: 'right'
                    });
                } else if (!isSCraft && !isSmart) {
                    const existingCol = curCols.find(c => c.brandName?.toUpperCase() === brandName.toUpperCase() || c.label?.toUpperCase().includes(brandName.toUpperCase()));
                    if (!existingCol) {
                        const colId = `brand_${brandName.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
                        const twoBIdx = curCols.findIndex(c => c.id === 'twoBrandsTotal');
                        const insertPos = twoBIdx !== -1 ? twoBIdx : curCols.length - 4;
                        curCols.splice(insertPos, 0, {
                            id: colId,
                            label: `${brandName} (L)`,
                            type: 'brand',
                            brandName: brandName,
                            width: '140px',
                            align: 'right'
                        });
                    }
                }
            });

            // Map Profile Stock data brand-wise into sheet rows
            const currentRows = [...(prev.rows && prev.rows.length > 0 ? prev.rows : INITIAL_DATA_PLAN_ROWS)];
            const brandCols = curCols.filter(c => c.type === 'brand' || c.id === 'scraftTotal' || c.id === 'smartTotal');

            let matchedCount = 0;
            let totalStockExported = 0;

            const updatedRows = currentRows.map(row => {
                const nextRow = { ...row };
                const normProd = normalizeName(String(row.product || ''));

                brandCols.forEach(bCol => {
                    const bName = bCol.brandName || (bCol.id === 'scraftTotal' ? 'S CRAFT' : 'SMART');
                    if (targetBrandFilter && targetBrandFilter !== 'All' && bName.toUpperCase() !== targetBrandFilter.toUpperCase()) {
                        return;
                    }

                    // Find all matching profiles for this row and brand
                    const matchingProfiles = profiles.filter(p => {
                        const pBrand = (p.brand || '').toUpperCase();
                        const targetBrand = bName.toUpperCase();
                        const brandMatch = pBrand === targetBrand || (targetBrand.includes('CRAFT') && pBrand.includes('CRAFT'));
                        if (!brandMatch) return false;

                        const normName = normalizeName(p.name || '');
                        const normSku = normalizeName(p.sku || '');
                        return normName === normProd || normSku === normProd || normProd.includes(normName) || normName.includes(normProd);
                    });

                    if (matchingProfiles.length > 0) {
                        const totalStockPieces = matchingProfiles.reduce((sum, p) => {
                            const txns = profileTransactions.filter(t => t.profileId === p.id && !t.deletedAt);
                            const prod = txns.filter(t => t.type === 'PRODUCTION' || t.type === 'RETURN').reduce((s, t) => s + Number(t.quantity || 0), 0);
                            const disp = txns.filter(t => t.type === 'DISPATCH').reduce((s, t) => s + Number(t.quantity || 0), 0);
                            const scr = txns.filter(t => t.type === 'SCRAP').reduce((s, t) => s + Number(t.quantity || 0), 0);
                            return sum + Math.max(0, prod - disp - scr);
                        }, 0);

                        nextRow[bCol.id] = totalStockPieces;
                        matchedCount++;
                        totalStockExported += totalStockPieces;

                        const firstP = matchingProfiles[0];
                        if (firstP.piecesPerPacket && (!nextRow.eachPacket || nextRow.eachPacket === '0' || nextRow.eachPacket === 0)) {
                            nextRow.eachPacket = firstP.piecesPerPacket;
                        }
                        if (firstP.weight && firstP.piecesPerPacket && (!nextRow.packetWeight || nextRow.packetWeight === '0' || nextRow.packetWeight === 0)) {
                            nextRow.packetWeight = Number((firstP.weight * firstP.piecesPerPacket).toFixed(3));
                        }
                    }
                });

                // Calculate smart formulas for this row
                let totalBrandLength = 0;
                let brandColCount = 0;
                curCols.forEach(c => {
                    if (c.type === 'brand' || c.id === 'scraftTotal' || c.id === 'smartTotal') {
                        const val = parseFloat(String(nextRow[c.id] || '0').replace(/[^0-9.-]/g, '')) || 0;
                        totalBrandLength += val;
                        brandColCount++;
                    }
                });
                nextRow.twoBrandsTotal = totalBrandLength;

                const eachPacket = parseFloat(String(nextRow.eachPacket || '0').replace(/[^0-9.-]/g, '')) || 0;
                if (eachPacket > 0 && totalBrandLength > 0) {
                    const totalPkts = totalBrandLength / eachPacket;
                    nextRow.totalPackets = totalPkts % 1 === 0 ? totalPkts : Number(totalPkts.toFixed(3));
                    nextRow.avrPacket = Math.round(brandColCount > 0 ? (totalPkts / brandColCount) : (totalPkts / 2));
                }

                const qtyFactor = parseFloat(String(nextRow.qtyFactor || '0').replace(/[^0-9.-]/g, '')) || 0;
                const pktWeight = parseFloat(String(nextRow.packetWeight || '0').replace(/[^0-9.-]/g, '')) || 0;
                if (qtyFactor > 0 && pktWeight > 0) {
                    nextRow.totalWeight = Number((qtyFactor * pktWeight).toFixed(3));
                }

                return nextRow;
            });

            return {
                ...prev,
                columns: curCols,
                rows: updatedRows,
                lastSaved: new Date().toISOString()
            };
        });

        addToast(`📤 Live stock successfully exported to Data Plan sheet!`, 'success');
        setIsExportStockModalOpen(false);
    }, [brands, profiles, profileTransactions, updateDataPlanSheet, addToast]);

    const importQuotationPresets = useCallback(() => {
        const presets = [
            // 53 & 60 Sliding Series
            { sku: '53ET', name: '2 TRACK (53mm)', category: 'Sliding Series', profileType: 'WINDOW', uom: 'Pcs', length: 5.9, piecesPerPacket: 6, weight: 4.897, price: 150, brand: 'RAVIRAJA', hsnCode: '39162099' },
            { sku: '60SH', name: 'SLIDING SASH', category: 'Sliding Series', profileType: 'WINDOW', uom: 'Pcs', length: 5.9, piecesPerPacket: 8, weight: 4.610, price: 150, brand: 'RAVIRAJA', hsnCode: '39162099' },
            { sku: '38IL', name: 'INTERLOCK (38mm)', category: 'Auxiliary', profileType: 'WINDOW', uom: 'Pcs', length: 5.9, piecesPerPacket: 20, weight: 1.160, price: 150, brand: 'RAVIRAJA', hsnCode: '39162099' },
            { sku: '17.5 EB', name: 'SINGLE BEAD (17.5mm)', category: 'Glazing Bead', profileType: 'WINDOW', uom: 'Pcs', length: 5.9, piecesPerPacket: 25, weight: 1.121, price: 150, brand: 'RAVIRAJA', hsnCode: '39162099' },
            
            // 62, 80, 92, 95 & 112 Sliding Series
            { sku: '62T', name: '2 TRACK (62mm)', category: 'Sliding Series', profileType: 'WINDOW', uom: 'Pcs', length: 5.9, piecesPerPacket: 6, weight: 5.587, price: 150, brand: 'RAVIRAJA', hsnCode: '39162099' },
            { sku: '80.5F', name: '2.5 TRACK (80.5mm)', category: 'Sliding Series', profileType: 'WINDOW', uom: 'Pcs', length: 5.9, piecesPerPacket: 6, weight: 6.997, price: 150, brand: 'RAVIRAJA', hsnCode: '39162099' },
            { sku: '92T', name: '2.5 TRACK (92mm)', category: 'Sliding Series', profileType: 'WINDOW', uom: 'Pcs', length: 5.9, piecesPerPacket: 4, weight: 7.596, price: 150, brand: 'RAVIRAJA', hsnCode: '39162099' },
            { sku: '95ET', name: '3 TRACK (95mm)', category: 'Sliding Series', profileType: 'WINDOW', uom: 'Pcs', length: 5.9, piecesPerPacket: 4, weight: 7.971, price: 150, brand: 'RAVIRAJA', hsnCode: '39162099' },
            { sku: '112T', name: '3 TRACK (112mm)', category: 'Sliding Series', profileType: 'WINDOW', uom: 'Pcs', length: 5.9, piecesPerPacket: 4, weight: 9.785, price: 150, brand: 'RAVIRAJA', hsnCode: '39162099' },
            
            // Sashes & Mesh Profiles
            { sku: '59SS', name: 'SMALL SASH', category: 'Sash', profileType: 'WINDOW', uom: 'Pcs', length: 5.9, piecesPerPacket: 6, weight: 5.150, price: 150, brand: 'RAVIRAJA', hsnCode: '39162099' },
            { sku: '67MS', name: 'MEDIUM SASH', category: 'Sash', profileType: 'WINDOW', uom: 'Pcs', length: 5.9, piecesPerPacket: 6, weight: 5.633, price: 150, brand: 'RAVIRAJA', hsnCode: '39162099' },
            { sku: '84BS', name: 'BIG SASH', category: 'Sash', profileType: 'WINDOW', uom: 'Pcs', length: 5.9, piecesPerPacket: 6, weight: 7.154, price: 150, brand: 'RAVIRAJA', hsnCode: '39162099' },
            { sku: '84BS-WSG', name: 'BIG SASH (WSG)', category: 'Sash', profileType: 'WINDOW', uom: 'Pcs', length: 5.9, piecesPerPacket: 6, weight: 6.904, price: 150, brand: 'RAVIRAJA', hsnCode: '39162099' },
            { sku: '53M', name: 'MESH', category: 'Mesh', profileType: 'WINDOW', uom: 'Pcs', length: 5.9, piecesPerPacket: 12, weight: 2.850, price: 150, brand: 'RAVIRAJA', hsnCode: '39162099' },
            { sku: '62MM', name: 'MULLION MESH', category: 'Mesh', profileType: 'WINDOW', uom: 'Pcs', length: 5.9, piecesPerPacket: 12, weight: 3.602, price: 150, brand: 'RAVIRAJA', hsnCode: '39162099' },
            { sku: '68OM', name: 'OPERNABLE MESH', category: 'Mesh', profileType: 'WINDOW', uom: 'Pcs', length: 5.9, piecesPerPacket: 6, weight: 5.111, price: 150, brand: 'RAVIRAJA', hsnCode: '39162099' },

            // Casement 60 & 70 Series
            { sku: '60OF', name: 'CASMENT OUTER (60mm)', category: 'Casement Series', profileType: 'WINDOW', uom: 'Pcs', length: 5.9, piecesPerPacket: 6, weight: 6.075, price: 150, brand: 'RAVIRAJA', hsnCode: '39162099' },
            { sku: '72OF', name: 'CASMENT OUTER (72mm)', category: 'Casement Series', profileType: 'WINDOW', uom: 'Pcs', length: 5.9, piecesPerPacket: 6, weight: 7.350, price: 125, brand: 'RAVIRAJA', hsnCode: '39162099' },
            { sku: '60CS', name: 'CASEMENT SASH', category: 'Casement Series', profileType: 'WINDOW', uom: 'Pcs', length: 5.9, piecesPerPacket: 6, weight: 5.890, price: 150, brand: 'RAVIRAJA', hsnCode: '39162099' },
            { sku: '74ZM', name: 'Z-MULION (74mm)', category: 'Mullion', profileType: 'WINDOW', uom: 'Pcs', length: 5.9, piecesPerPacket: 6, weight: 6.545, price: 150, brand: 'RAVIRAJA', hsnCode: '39162099' },
            { sku: '60TM', name: 'T-MULLION (60mm)', category: 'Mullion', profileType: 'WINDOW', uom: 'Pcs', length: 5.9, piecesPerPacket: 6, weight: 6.220, price: 150, brand: 'RAVIRAJA', hsnCode: '39162099' },
            { sku: '60FM', name: 'FALSE MULLION', category: 'Mullion', profileType: 'WINDOW', uom: 'Pcs', length: 5.9, piecesPerPacket: 8, weight: 4.350, price: 150, brand: 'RAVIRAJA', hsnCode: '39162099' },

            // Glazing Beads
            { sku: '11.5 DGB', name: 'DG BEAD (11.5mm)', category: 'Glazing Bead', profileType: 'WINDOW', uom: 'Pcs', length: 5.9, piecesPerPacket: 20, weight: 1.180, price: 150, brand: 'RAVIRAJA', hsnCode: '39162099' },
            { sku: '24.5 ESB', name: 'SMALL BEAD (24.5mm)', category: 'Glazing Bead', profileType: 'WINDOW', uom: 'Pcs', length: 5.9, piecesPerPacket: 20, weight: 1.535, price: 150, brand: 'RAVIRAJA', hsnCode: '39162099' },
            { sku: '35CB', name: 'BIGG BEAD (35mm)', category: 'Glazing Bead', profileType: 'WINDOW', uom: 'Pcs', length: 5.9, piecesPerPacket: 20, weight: 2.050, price: 150, brand: 'RAVIRAJA', hsnCode: '39162099' },
            { sku: '18GB', name: 'DOUBLE GLAZE BEAD (18mm)', category: 'Glazing Bead', profileType: 'WINDOW', uom: 'Pcs', length: 5.9, piecesPerPacket: 20, weight: 1.320, price: 150, brand: 'RAVIRAJA', hsnCode: '39162099' },
            { sku: '28GB', name: 'TRIPLE GLAZE BEAD (28mm)', category: 'Glazing Bead', profileType: 'WINDOW', uom: 'Pcs', length: 5.9, piecesPerPacket: 20, weight: 1.680, price: 150, brand: 'RAVIRAJA', hsnCode: '39162099' },

            // Auxiliary & Panels
            { sku: '44IL', name: 'INTERLOCK (44mm)', category: 'Auxiliary', profileType: 'WINDOW', uom: 'Pcs', length: 5.9, piecesPerPacket: 20, weight: 1.215, price: 150, brand: 'RAVIRAJA', hsnCode: '39162099' },
            { sku: '12PP', name: 'PANNEL BOARD (12mm)', category: 'Auxiliary', profileType: 'WINDOW', uom: 'Pcs', length: 5.9, piecesPerPacket: 8, weight: 3.106, price: 150, brand: 'RAVIRAJA', hsnCode: '39162099' },
            { sku: '20PP', name: 'PANNEL BOARD (20mm)', category: 'Auxiliary', profileType: 'DOOR', uom: 'Pcs', length: 5.9, piecesPerPacket: 6, weight: 4.250, price: 150, brand: 'RAVIRAJA', hsnCode: '39162099' },
            { sku: '90CP', name: '90 DEGREE CORNER POST', category: 'Auxiliary', profileType: 'WINDOW', uom: 'Pcs', length: 5.9, piecesPerPacket: 4, weight: 5.800, price: 150, brand: 'RAVIRAJA', hsnCode: '39162099' },
            { sku: '135CP', name: '135 DEGREE BAY COUPLER', category: 'Auxiliary', profileType: 'WINDOW', uom: 'Pcs', length: 5.9, piecesPerPacket: 4, weight: 6.100, price: 150, brand: 'RAVIRAJA', hsnCode: '39162099' },
            { sku: '180CP', name: '180 DEGREE COUPLER', category: 'Auxiliary', profileType: 'WINDOW', uom: 'Pcs', length: 5.9, piecesPerPacket: 8, weight: 3.450, price: 150, brand: 'RAVIRAJA', hsnCode: '39162099' },
            { sku: 'SIL', name: 'SUB SILL / THRESHOLD', category: 'Auxiliary', profileType: 'WINDOW', uom: 'Pcs', length: 5.9, piecesPerPacket: 6, weight: 4.200, price: 150, brand: 'RAVIRAJA', hsnCode: '39162099' },
            { sku: 'TRIM', name: 'WALL ARCHITRAVE TRIM', category: 'Auxiliary', profileType: 'WINDOW', uom: 'Pcs', length: 5.9, piecesPerPacket: 12, weight: 2.150, price: 150, brand: 'RAVIRAJA', hsnCode: '39162099' },
            { sku: 'SF-40', name: 'SUB FRAME (40mm)', category: 'Auxiliary', profileType: 'WINDOW', uom: 'Pcs', length: 5.9, piecesPerPacket: 8, weight: 3.200, price: 150, brand: 'RAVIRAJA', hsnCode: '39162099' },
            { sku: 'DR-WEATHER', name: 'DRIP RAIL / WEATHER BAR', category: 'Auxiliary', profileType: 'WINDOW', uom: 'Pcs', length: 5.9, piecesPerPacket: 16, weight: 1.450, price: 150, brand: 'RAVIRAJA', hsnCode: '39162099' },

            // Reinforcements (43+ Library)
            { sku: '13X28X13', name: 'Galvanised Plain/Steel (80.SERIES)', category: 'Reinforcement', profileType: 'REINFORCEMENT', uom: 'Pcs', length: 0, piecesPerPacket: 0, weight: 2.139, price: 95, brand: 'REINFORCEMENT', hsnCode: '80.SERIES' },
            { sku: '14X30X14', name: 'Galvanised Plain/Steel (2 TRACK)', category: 'Reinforcement', profileType: 'REINFORCEMENT', uom: 'Pcs', length: 0, piecesPerPacket: 0, weight: 2.319, price: 95, brand: 'REINFORCEMENT', hsnCode: '2 TRACK' },
            { sku: '16X20X16', name: 'Galvanised Plain/Steel (MESH)', category: 'Reinforcement', profileType: 'REINFORCEMENT', uom: 'Pcs', length: 0, piecesPerPacket: 0, weight: 2.135, price: 95, brand: 'REINFORCEMENT', hsnCode: 'MESH' },
            { sku: '14X30X14-2.5', name: 'Galvanised Plain/Steel (2.5 TRACK)', category: 'Reinforcement', profileType: 'REINFORCEMENT', uom: 'Pcs', length: 0, piecesPerPacket: 0, weight: 2.319, price: 95, brand: 'REINFORCEMENT', hsnCode: '2.5 TRACK' },
            { sku: '14X30X14-3T', name: 'Galvanised Plain/Steel (3 Track)', category: 'Reinforcement', profileType: 'REINFORCEMENT', uom: 'Pcs', length: 0, piecesPerPacket: 0, weight: 2.319, price: 95, brand: 'REINFORCEMENT', hsnCode: '3 Track' },
            { sku: '17X30X17', name: 'Galvanised Plain/Steel (SMALL SASH)', category: 'Reinforcement', profileType: 'REINFORCEMENT', uom: 'Pcs', length: 0, piecesPerPacket: 0, weight: 2.579, price: 95, brand: 'REINFORCEMENT', hsnCode: 'SMALL SASH' },
            { sku: '17X30X17-MS', name: 'Galvanised Plain/Steel (Medium Sash)', category: 'Reinforcement', profileType: 'REINFORCEMENT', uom: 'Pcs', length: 0, piecesPerPacket: 0, weight: 2.579, price: 95, brand: 'REINFORCEMENT', hsnCode: 'Medium Sash' },
            { sku: '28X28X28', name: 'Galvanised Plain/Steel (Big Sash 84)', category: 'Reinforcement', profileType: 'REINFORCEMENT', uom: 'Pcs', length: 0, piecesPerPacket: 0, weight: 3.158, price: 95, brand: 'REINFORCEMENT', hsnCode: 'Big Sash 84' },
            { sku: '24X27X24', name: 'Galvanised Plain/Steel (CASMENT OUTER)', category: 'Reinforcement', profileType: 'REINFORCEMENT', uom: 'Pcs', length: 0, piecesPerPacket: 0, weight: 3.086, price: 95, brand: 'REINFORCEMENT', hsnCode: 'CASMENT OUTER' },
            { sku: '13X34X25', name: 'Galvanised Plain/Steel (78 Window)', category: 'Reinforcement', profileType: 'REINFORCEMENT', uom: 'Pcs', length: 0, piecesPerPacket: 0, weight: 2.162, price: 95, brand: 'REINFORCEMENT', hsnCode: '78 Window' },
            { sku: '20X25X20', name: 'Galvanised Plain/Steel (T MULLION)', category: 'Reinforcement', profileType: 'REINFORCEMENT', uom: 'Pcs', length: 0, piecesPerPacket: 0, weight: 2.162, price: 95, brand: 'REINFORCEMENT', hsnCode: 'T MULLION' },
        ];

        let addedCount = 0;
        presets.forEach(p => {
            const exists = profiles.find(pr => pr.sku === p.sku);
            if (!exists) {
                addProfile(p as any);
                addedCount++;
            }
        });

        if (addedCount > 0) {
            addToast(`Successfully imported ${addedCount} profiles.`, 'success');
        } else {
            addToast('All templates already exist.', 'info');
        }
    }, [profiles, addToast, addProfile]);

    const getProfile = useCallback((id: string) => profiles.find(p => p.id === id), [profiles]);
    const getProfileName = useCallback((id: string) => getProfile(id)?.name || 'Unknown Profile', [getProfile]);
    const getBrandBadge = useCallback((brand?: string) => (<span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300 uppercase tracking-tighter border border-gray-200 dark:border-gray-600">{brand || 'NO BRAND'}</span>), []);

    const generateInvoicePDF = useCallback((data: any) => {
        const { jsPDF } = jspdf;
        const doc = new jsPDF({ orientation: 'landscape' }); // Landscape for more columns
        const isQuotation = !!data.items;
        const txData = isQuotation ? data.items : [data];
        const refTx = txData[0];
        const profile = getProfile(refTx.profileId);
        const brandName = refTx.brand || profile?.brand || 'Smart';

        let logoLeft = companySettings.logoUrl;
        let logoRight = companySettings.logoRightUrl;
        const brandLogoEntry = companySettings.brandLogos?.find(bl => bl.brand === brandName);
        if (brandLogoEntry) {
            if (brandLogoEntry.logoUrl) logoLeft = brandLogoEntry.logoUrl;
            if (brandLogoEntry.logoRightUrl) logoRight = brandLogoEntry.logoRightUrl;
        }

        const addLogoSafely = (url: string, x: number, y: number, w: number, h: number) => {
            try {
                let format = 'PNG';
                if (url.startsWith('data:image/')) {
                    const match = url.match(/data:image\/([a-zA-Z]*);base64/);
                    if (match && match[1]) format = match[1].toUpperCase();
                }
                if (format === 'JPG') format = 'JPEG';
                doc.addImage(url, format, x, y, w, h);
            } catch (e) {
                console.error('PDF Logo failed to load:', e);
            }
        };

        if (logoLeft) addLogoSafely(logoLeft, 14, 10, 30, 15);
        if (logoRight) addLogoSafely(logoRight, 250, 10, 30, 15);

        doc.setFontSize(16); doc.setFont("helvetica", "bold"); 
        doc.text(isQuotation ? "QUOTATION" : "DISPATCH NOTE", 148, 25, { align: 'center' });

        doc.setFontSize(8);
        doc.text(`Supplier Registered Address:`, 14, 35);
        doc.setFont("helvetica", "normal");
        doc.text(`${companySettings.name}\n${companySettings.addressLine1}\n${companySettings.cityStateZip}`, 14, 40);
        
        doc.setFont("helvetica", "bold");
        doc.text(`Factory Address:`, 100, 35);
        doc.setFont("helvetica", "normal");
        doc.text(companySettings.factoryAddress || companySettings.addressLine1, 100, 40);

        doc.setFont("helvetica", "bold");
        doc.text(`Billed & Delivered to:`, 14, 60);
        doc.setFont("helvetica", "normal");
        doc.text(`${refTx.customer || 'Cash'}\n${refTx.customerAddress || ''}`, 14, 65);

        doc.setFont("helvetica", "bold");
        doc.text(`Quotation No: ${refTx.refNo}`, 200, 60);
        doc.text(`Date: ${new Date(refTx.date).toLocaleDateString('en-IN')}`, 200, 65);
        doc.text(`Place of Supply: ${refTx.invoiceDetails?.placeOfSupply || companySettings.state || ''}`, 200, 70);
        doc.text(`State Code: ${refTx.invoiceDetails?.state || companySettings.stateCode || ''}`, 200, 75);

        let totalTaxable = 0;
        let totalWeightKgs = 0;

        const tableBody = txData.map((t: any, i: number) => {
            const p = getProfile(t.profileId);
            const qty = Number(t.quantity || 0); 
            const pricePerKg = Number(t.unitPrice ?? p?.price ?? 0);
            const weightPerPc = Number(t.weight ?? p?.weight ?? 0);
            const lengthPerPc = Number(p?.length ?? 5.9);
            const totalWeight = qty * weightPerPc;
            const amt = totalWeight * pricePerKg;
            
            totalTaxable += amt;
            totalWeightKgs += totalWeight;

            const ratePerMtr = lengthPerPc > 0 ? (amt / (qty * lengthPerPc)) : 0;

            return [ 
                i + 1, 
                t.profileNameOverride || p?.name || 'Unknown', 
                t.hsnCode || p?.hsnCode || '39162099', 
                t.profileSkuOverride || p?.sku || '', 
                t.packets || 0,
                p?.piecesPerPacket || 0,
                (qty * lengthPerPc).toFixed(2),
                lengthPerPc.toFixed(1),
                totalWeight.toFixed(3),
                pricePerKg.toFixed(2),
                ratePerMtr.toFixed(2),
                amt > 0 ? amt.toLocaleString('en-IN', { minimumFractionDigits: 2 }) : '-'
            ];
        });

        doc.autoTable({
            startY: 85, theme: 'grid', styles: { fontSize: 7, halign: 'center' },
            head: [['Sl.No', 'Description', 'HSN', 'Code', 'Packets', 'Pcs/Pkt', 'Total Mtrs', 'Each L', 'Total Wt', 'Rate/kg', 'Rate/Mtr', 'Amount Rs']],
            body: tableBody, margin: { left: 10, right: 10 }
        });

        const finalY = (doc as any).lastAutoTable.finalY;
        
        // IGST vs CGST/SGST Logic
        const companyState = (companySettings.state || 'TELANGANA').toUpperCase();
        const supplyState = (refTx.invoiceDetails?.placeOfSupply || companyState).toUpperCase();
        const isInterState = supplyState !== companyState;
        
        const igstRate = companySettings.igstRate || 18;
        const cgstRate = companySettings.cgstRate || 9;
        const sgstRate = companySettings.sgstRate || 9;

        const igstValue = isInterState ? (totalTaxable * igstRate / 100) : 0;
        const cgstValue = !isInterState ? (totalTaxable * cgstRate / 100) : 0;
        const sgstValue = !isInterState ? (totalTaxable * sgstRate / 100) : 0;
        const totalTax = igstValue + cgstValue + sgstValue;

        doc.autoTable({
            startY: finalY + 5, theme: 'grid', styles: { fontSize: 8 },
            body: [
                [ { content: 'Total Taxable Value', colSpan: 11, styles: { halign: 'right', fontStyle: 'bold' } }, { content: totalTaxable.toLocaleString('en-IN', { minimumFractionDigits: 2 }), styles: { halign: 'right' } } ],
                isInterState 
                    ? [ { content: `IGST @ ${igstRate}%`, colSpan: 11, styles: { halign: 'right' } }, { content: igstValue.toLocaleString('en-IN', { minimumFractionDigits: 2 }), styles: { halign: 'right' } } ]
                    : [ { content: `CGST @ ${cgstRate}%`, colSpan: 11, styles: { halign: 'right' } }, { content: cgstValue.toLocaleString('en-IN', { minimumFractionDigits: 2 }), styles: { halign: 'right' } } ],
                !isInterState 
                    ? [ { content: `SGST @ ${sgstRate}%`, colSpan: 11, styles: { halign: 'right' } }, { content: sgstValue.toLocaleString('en-IN', { minimumFractionDigits: 2 }), styles: { halign: 'right' } } ]
                    : null,
                [ { content: 'Total Invoice Value', colSpan: 11, styles: { halign: 'right', fontStyle: 'bold', fillColor: [240,240,240] } }, { content: Math.round(totalTaxable + totalTax).toLocaleString('en-IN'), styles: { halign: 'right', fontStyle: 'bold', fillColor: [240,240,240] } } ]
            ].filter(Boolean), 
            margin: { left: 10, right: 10 }
        });

        const bottomY = (doc as any).lastAutoTable.finalY + 10;
        doc.setFontSize(8);
        doc.text(`Bank Details: ${companySettings.bankName} | A/c: ${companySettings.accountNo} | IFSC: ${companySettings.ifsc}`, 14, bottomY);
        doc.text(`PAN: ${companySettings.pan || ''}`, 14, bottomY + 5);
        
        doc.text(`For ${companySettings.name}`, 240, bottomY, { align: 'center' });
        doc.text(`Authorised Signature`, 240, bottomY + 15, { align: 'center' });

        doc.save(`${isQuotation ? 'Quotation' : 'Invoice'}_${refTx.refNo}.pdf`);
    }, [getProfile, companySettings]);

    const allStockData = useMemo(() => {
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
            const currentStock = (production || 0) - (dispatch || 0) - (scrap || 0);
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

    const stockData = useMemo(() => {
        return brandFilter === 'All' ? allStockData : allStockData.filter(p => (p.brand || 'General').toLowerCase() === brandFilter.toLowerCase());
    }, [allStockData, brandFilter]);

    const filteredProfiles = useMemo(() => {
        let base = stockData;
        if (searchTerm) {
            base = base.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()) || p.sku.toLowerCase().includes(searchTerm.toLowerCase()));
        }
        
        if (typeFilter !== 'All') {
            base = base.filter(p => p.profileType === typeFilter || (typeFilter === 'WINDOW' && !p.profileType));
        }

        if (activeTab === 'Profiles') {
            return base;
        } else if (activeTab === 'Stock') {
            return base.filter(p => !p.profileType || p.profileType === 'WINDOW' || p.profileType === 'DOOR');
        } else if (activeTab === 'Reinforcement Stock') {
            return base.filter(p => p.profileType === 'REINFORCEMENT');
        }
        
        return base;
    }, [stockData, searchTerm, activeTab, typeFilter]);
    
    const productionTransactions = useFilteredTransactions(profileTransactions, searchTerm, getProfile, 'PRODUCTION', brandFilter);
    const dispatchTransactions = useFilteredTransactions(profileTransactions, searchTerm, getProfile, 'DISPATCH', brandFilter);

    const windowProductionTransactions = useMemo(() => {
        return productionTransactions.filter(t => {
            const p = getProfile(t.profileId);
            return !p?.profileType || p?.profileType === 'WINDOW';
        });
    }, [productionTransactions, getProfile]);

    const reinforcementInflowTransactions = useMemo(() => {
        return productionTransactions.filter(t => {
            const p = getProfile(t.profileId);
            return p?.profileType === 'REINFORCEMENT';
        });
    }, [productionTransactions, getProfile]);

    const groupedQuotations = useMemo(() => {
        const groups: Record<string, any> = {};
        profileTransactions.filter(t => (t.type === 'QUOTATION' || t.status === 'COMPLETED') && !t.deletedAt).forEach(t => {
            const p = getProfile(t.profileId);
            const brand = t.brand || p?.brand;
            if (brandFilter !== 'All' && brand !== brandFilter) return;
            if (!groups[t.refNo]) groups[t.refNo] = { refNo: t.refNo, date: t.date, customer: t.customer, status: t.status, totalAmount: 0, items: [], brand: brand };
            groups[t.refNo].totalAmount += (Number(t.quantity || 0) * (t.unitPrice || p?.price || 0));
            groups[t.refNo].items.push(t);
        });
        let result = Object.values(groups).sort((a:any, b:any) => new Date(b.date).getTime() - new Date(a.date).getTime());
        if (searchTerm) result = result.filter((g:any) => g.refNo.toLowerCase().includes(searchTerm.toLowerCase()) || g.customer?.toLowerCase().includes(searchTerm.toLowerCase()));
        return result;
    }, [profileTransactions, searchTerm, getProfile, brandFilter]);

    const brandWiseStockStats = useMemo(() => {
        const stats: Record<string, { count: number; pieces: number; packets: number; weight: number }> = {};
        
        brands.forEach(b => {
            stats[b] = { count: 0, pieces: 0, packets: 0, weight: 0 };
        });

        profiles.filter(p => !p.deletedAt).forEach(p => {
            const b = p.brand || 'NO BRAND';
            if (!stats[b]) stats[b] = { count: 0, pieces: 0, packets: 0, weight: 0 };
            
            const relevantTxns = profileTransactions.filter(t => t.profileId === p.id && !t.deletedAt);
            const prod = relevantTxns.filter(t => t.type === 'PRODUCTION' || t.type === 'RETURN').reduce((sum, t) => sum + Number(t.quantity || 0), 0);
            const disp = relevantTxns.filter(t => t.type === 'DISPATCH').reduce((sum, t) => sum + Number(t.quantity || 0), 0);
            const scrap = relevantTxns.filter(t => t.type === 'SCRAP').reduce((sum, t) => sum + Number(t.quantity || 0), 0);
            const curStock = Math.max(0, prod - disp - scrap);
            
            const pPerPkt = p.piecesPerPacket || 1;
            const pkts = pPerPkt > 0 ? Math.floor(curStock / pPerPkt) : 0;
            const wt = curStock * (p.weight || 0);

            stats[b].count += 1;
            stats[b].pieces += curStock;
            stats[b].packets += pkts;
            stats[b].weight += wt;
        });

        return stats;
    }, [brands, profiles, profileTransactions]);

    const handleQuotationAction = (refNo: string, action: 'CONFIRM_DISPATCH' | 'CONFIRM_RETURN' | 'CANCEL') => {
        const txns = profileTransactions.filter(t => t.refNo === refNo);
        txns.forEach(t => resolveQuotation(t.id, action));
        addToast(`Quotation ${(action || '').replace('_', ' ')} processed.`, 'success');
    };

    const handleQuickAction = (action: string) => {
        if (action === 'PRODUCTION') {
            setTransactionType('PRODUCTION');
            setEditingTransaction(null);
            setIsTransactionModalOpen(true);
        } else if (action === 'DISPATCH') {
            setTransactionType('DISPATCH');
            setEditingTransaction(null);
            setIsTransactionModalOpen(true);
        } else if (action === 'QUOTATION') {
            setIsQuotationModalOpen(true);
        } else if (action === 'PLAN') {
            setActiveTab('Planning');
        }
    };

    return (
        <div className="space-y-6">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black text-gray-900 dark:text-white tracking-tighter uppercase flex items-center gap-3">
                        <WarehouseIcon className="w-8 h-8 text-blue-600" />
                        Profiles & Inventory
                    </h1>
                    <p className="text-gray-500 text-sm font-medium">Manufacturing Unit Management • UPVC Window Profiles</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <button 
                        onClick={() => {
                            syncProfilesToStock();
                            addToast('Brand-wise data synchronized across all tabs (Profiles, Stock, Films, Tooling & Quotes)!', 'success');
                        }} 
                        className="px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-xl font-black uppercase tracking-tighter text-xs hover:from-emerald-700 hover:to-teal-700 transition-all shadow-md shadow-emerald-500/20 flex items-center gap-2 cursor-pointer active:scale-95"
                        title="Auto-synchronize brand profiles, stock, protective films, extrusion tooling and quotations"
                    >
                        <RefreshCw className="w-4 h-4" /> Sync All Tabs
                    </button>
                    <button onClick={() => setIsSettingsModalOpen(true)} className="p-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-900 transition-all shadow-sm">
                        <Settings className="w-5 h-5" />
                    </button>
                    <button onClick={() => setIsManageBrandsModalOpen(true)} className="px-4 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-700 dark:text-gray-300 font-black uppercase tracking-tighter text-xs hover:bg-gray-50 dark:hover:bg-gray-900 transition-all shadow-sm flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-yellow-500" /> Manage Brands
                    </button>
                    <button onClick={() => { setEditingProfile(null); setIsProfileModalOpen(true); }} className="px-5 py-2.5 bg-blue-600 text-white rounded-xl font-black uppercase tracking-tighter text-xs hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/25 flex items-center gap-2">
                        <Package className="w-4 h-4" /> Add Profile
                    </button>
                </div>
            </div>

            {/* Navigation Tabs */}
            <div className="p-1.5 bg-gray-100 dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-inner flex overflow-x-auto scrollbar-none gap-1.5 no-print w-full flex-nowrap lg:flex-wrap">
                {tabs.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`flex items-center justify-center gap-2 px-3.5 sm:px-5 py-2 sm:py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-200 shrink-0 text-center whitespace-nowrap ${
                            activeTab === tab.id 
                                ? 'bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 shadow-sm' 
                                : 'text-gray-500 hover:text-gray-900 dark:hover:text-gray-200'
                        }`}
                    >
                        <tab.icon className={`w-4 h-4 ${activeTab === tab.id ? 'text-blue-600' : 'text-gray-400'}`} />
                        <span>{tab.label}</span>
                    </button>
                ))}
            </div>

            {/* Tab Content */}
            <div className="min-h-[600px]">
                {activeTab === 'Dashboard' && (
                    <div className="space-y-6">
                        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                            <div className="lg:col-span-3">
                                <ProfileDashboard 
                                    profiles={profiles} 
                                    transactions={profileTransactions} 
                                    allStockData={allStockData} 
                                    brands={brands}
                                    onQuickAction={handleQuickAction}
                                    onNavigateTab={setActiveTab}
                                    onAddProductionForProfile={(profileId, brand) => {
                                        setInitialTransactionProfile(profileId);
                                        setInitialTransactionBrand(brand || null);
                                        setTransactionType('PRODUCTION');
                                        setIsTransactionModalOpen(true);
                                    }}
                                    onPlanForProfile={(_profileId) => {
                                        setActiveTab('Planning');
                                    }}
                                    dies={dies}
                                    productionPlans={productionPlans}
                                />
                            </div>
                            <div className="space-y-6">
                                <QuickEntryCard onAction={handleQuickAction} />
                                <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 border border-gray-200/80 dark:border-gray-700 shadow-xs">
                                    <h3 className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-4 flex items-center justify-between">
                                        <span>Production Health</span>
                                        <Activity className="w-3.5 h-3.5 text-blue-500" />
                                    </h3>
                                    <div className="space-y-4">
                                        <div className="flex justify-between items-end p-3 rounded-xl bg-gray-50 dark:bg-gray-900/50">
                                            <div>
                                                <p className="text-[10px] font-bold text-gray-400 uppercase">Active Dies</p>
                                                <span className="text-2xl font-black text-gray-900 dark:text-white font-mono">{dies.filter(d => d.status === 'ACTIVE').length}</span>
                                            </div>
                                            <span className="text-[10px] font-bold text-green-600 px-2 py-0.5 rounded-md bg-green-50 dark:bg-green-950/40">Operational</span>
                                        </div>
                                        <div className="flex justify-between items-end p-3 rounded-xl bg-gray-50 dark:bg-gray-900/50">
                                            <div>
                                                <p className="text-[10px] font-bold text-gray-400 uppercase">Pending Plans</p>
                                                <span className="text-2xl font-black text-gray-900 dark:text-white font-mono">{productionPlans.length}</span>
                                            </div>
                                            <span className="text-[10px] font-bold text-blue-600 px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-950/40">Scheduled</span>
                                        </div>
                                        <div className="pt-2 border-t dark:border-gray-700">
                                            <button 
                                                onClick={() => setActiveTab('Planning')} 
                                                className="w-full py-2.5 px-3 text-xs font-black text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-all shadow-xs flex items-center justify-center gap-1.5"
                                            >
                                                <Calendar className="w-3.5 h-3.5" /> View Production Schedule
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'Stock' && (
                    <div className="space-y-4">
                        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white dark:bg-gray-800 p-4 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm">
                            <div className="flex flex-col md:flex-row items-center gap-4 flex-1">
                                <div className="p-1 bg-gray-100 dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-inner flex flex-wrap gap-1">
                                    <button
                                        onClick={() => setStockSubTab('Current Stock')}
                                        className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-200 flex-1 md:flex-initial text-center ${
                                            stockSubTab === 'Current Stock' ? 'bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-gray-500 hover:text-gray-900 dark:hover:text-gray-200'
                                        }`}
                                    >
                                        Current Stock
                                    </button>
                                    <button
                                        onClick={() => setStockSubTab('Stock Movement')}
                                        className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-200 flex-1 md:flex-initial text-center ${
                                            stockSubTab === 'Stock Movement' ? 'bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-gray-500 hover:text-gray-900 dark:hover:text-gray-200'
                                        }`}
                                    >
                                        Stock Movement
                                    </button>
                                </div>
                                <div className="relative flex-1 max-w-md w-full">
                                    <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                    <input
                                        type="text"
                                        placeholder="Search profiles by name or SKU..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="w-full pl-10 pr-4 py-2.5 bg-gray-50 dark:bg-gray-900 border-none rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                                    />
                                </div>
                            </div>
                            <div className="flex items-center gap-2 flex-wrap">
                                <button
                                    onClick={() => excelFileInputRef.current?.click()}
                                    className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[10px] font-black uppercase tracking-tighter transition-all flex items-center gap-1.5 shadow-sm shadow-emerald-500/20 active:scale-95 cursor-pointer"
                                    title="Upload brand profile and stock catalogue (Excel/CSV) with duplicate conflict resolution"
                                >
                                    <UploadCloud className="w-3.5 h-3.5" /> Upload Brand Data
                                </button>
                                <button
                                    onClick={() => {
                                        syncProfilesToStock();
                                        addToast('Brand-wise data synchronized across Profiles, Stock, Films, Tooling & Quotes!', 'success');
                                    }}
                                    className="px-3 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-xl text-[10px] font-black uppercase tracking-tighter hover:bg-gray-200 dark:hover:bg-gray-600 transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
                                    title="Ensure profiles and stock are in sync across all tabs"
                                >
                                    <RefreshCw className="w-3.5 h-3.5" /> Sync Tabs
                                </button>
                                <button
                                    onClick={() => setIsExportStockModalOpen(true)}
                                    className="px-3.5 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-tighter hover:from-blue-700 hover:to-indigo-700 transition-all flex items-center gap-1.5 shadow-sm shadow-blue-500/20 active:scale-95 cursor-pointer"
                                    title="Export live stock quantities to Data Plan sheet"
                                >
                                    <UploadCloud className="w-3.5 h-3.5" /> Export to Data Plan
                                </button>
                                <div className="relative" ref={downloadStockMenuRef}>
                                    <button
                                        onClick={() => setIsDownloadStockMenuOpen(prev => !prev)}
                                        className="px-3.5 py-2 bg-slate-800 dark:bg-gray-700 text-white rounded-xl text-[10px] font-black uppercase tracking-tighter hover:bg-slate-700 dark:hover:bg-gray-600 transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-sm active:scale-95"
                                        title="Download stock records in Excel or PDF format"
                                    >
                                        <Download className="w-3.5 h-3.5" />
                                        <span>Export Report</span>
                                        <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isDownloadStockMenuOpen ? 'rotate-180' : ''}`} />
                                    </button>
                                    {isDownloadStockMenuOpen && (
                                        <div className="absolute right-0 mt-2 w-40 bg-white dark:bg-slate-800 rounded-xl shadow-lg py-1.5 z-30 border border-gray-100 dark:border-gray-700">
                                            <button onClick={handleExportStockExcel} className="block w-full text-left px-4 py-2 text-xs font-bold text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700">
                                                Download Excel
                                            </button>
                                            <button onClick={handleExportStockPdf} className="block w-full text-left px-4 py-2 text-xs font-bold text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700">
                                                Download PDF
                                            </button>
                                        </div>
                                    )}
                                </div>
                                <Filter className="w-4 h-4 text-gray-400" />
                                <select
                                    value={brandFilter}
                                    onChange={(e) => setBrandFilter(e.target.value)}
                                    className="bg-gray-50 dark:bg-gray-900 border-none rounded-xl text-xs font-black uppercase tracking-tighter py-2.5 px-4 outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                                >
                                    <option value="All">All Brands</option>
                                    {brands.map(b => <option key={b} value={b}>{b}</option>)}
                                </select>
                                <button
                                    onClick={() => {
                                        setTransactionType('PRODUCTION');
                                        setTransactionFilterType(null);
                                        setInitialTransactionProfile(null);
                                        setInitialTransactionBrand(brandFilter === 'All' ? null : brandFilter);
                                        setIsTransactionModalOpen(true);
                                    }}
                                    className="px-4 py-2 bg-green-600 text-white rounded-xl text-[10px] font-black uppercase tracking-tighter hover:bg-green-700 transition-all flex items-center gap-2"
                                >
                                    <Plus className="w-4 h-4" /> Add Stock
                                </button>
                            </div>
                        </div>

                        {/* Brand Wise Stock Summary Strip */}
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                            {brands.map(b => {
                                const bStat = brandWiseStockStats[b] || { count: 0, pieces: 0, packets: 0, weight: 0 };
                                const isSelected = brandFilter === b;
                                return (
                                    <div 
                                        key={b}
                                        onClick={() => setBrandFilter(isSelected ? 'All' : b)}
                                        className={`p-3 rounded-2xl border transition-all cursor-pointer relative overflow-hidden group ${
                                            isSelected 
                                                ? 'bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-500/20' 
                                                : 'bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-700'
                                        }`}
                                    >
                                        <div className="flex items-center justify-between mb-1.5">
                                            <span className={`text-[10px] font-black uppercase tracking-wider ${isSelected ? 'text-blue-100' : 'text-gray-500 dark:text-gray-400'}`}>
                                                {b}
                                            </span>
                                            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                                                isSelected ? 'bg-blue-500 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
                                            }`}>
                                                {bStat.count} items
                                            </span>
                                        </div>
                                        <div className="flex items-baseline justify-between">
                                            <div>
                                                <div className={`text-base font-black tracking-tight leading-none ${isSelected ? 'text-white' : 'text-gray-900 dark:text-white'}`}>
                                                    {(bStat.pieces || 0).toLocaleString()} <span className="text-[10px] font-semibold opacity-80">Pcs</span>
                                                </div>
                                                <div className={`text-[10px] font-bold mt-1 ${isSelected ? 'text-blue-100' : 'text-gray-400'}`}>
                                                    {(bStat.packets || 0).toLocaleString()} Pkts • {Math.round(bStat.weight || 0).toLocaleString()} Kg
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                        
                        {stockSubTab === 'Current Stock' ? (
                            <div className="space-y-4">
                                <div className="p-1 bg-gray-100 dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-inner flex flex-wrap gap-1">
                                    <button
                                        onClick={() => setTypeFilter('All')}
                                        className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-200 flex-1 md:flex-initial text-center ${
                                            typeFilter === 'All' ? 'bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-gray-500 hover:text-gray-900 dark:hover:text-gray-200'
                                        }`}
                                    >
                                        All Types
                                    </button>
                                    <button
                                        onClick={() => setTypeFilter('WINDOW')}
                                        className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-200 flex-1 md:flex-initial text-center ${
                                            typeFilter === 'WINDOW' ? 'bg-white dark:bg-gray-800 text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-900 dark:hover:text-gray-200'
                                        }`}
                                    >
                                        Profiles
                                    </button>
                                    <button
                                        onClick={() => setTypeFilter('REINFORCEMENT')}
                                        className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-200 flex-1 md:flex-initial text-center ${
                                            typeFilter === 'REINFORCEMENT' ? 'bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-gray-500 hover:text-gray-900 dark:hover:text-gray-200'
                                        }`}
                                    >
                                        Reinforcements
                                    </button>
                                </div>
                                <StockTable 
                                    stockData={filteredProfiles} 
                                    onEditProfile={(p:Profile) => {setEditingProfile(p); setIsProfileModalOpen(true);}}
                                    onAddStock={(p: Profile) => {
                                        setTransactionType('PRODUCTION');
                                        setInitialTransactionProfile(p.id);
                                        setInitialTransactionBrand(p.brand);
                                        setIsTransactionModalOpen(true);
                                    }}
                                    onDeleteProfile={deleteProfile}
                                    getBrandBadge={getBrandBadge}
                                    updateProfile={updateProfile}
                                />
                            </div>
                        ) : (
                            <TransactionTable 
                                transactions={profileTransactions.filter(t => !t.deletedAt && (typeFilter === 'All' || (typeFilter === 'WINDOW' && (!getProfile(t.profileId)?.profileType || getProfile(t.profileId)?.profileType === 'WINDOW')) || (typeFilter === 'REINFORCEMENT' && getProfile(t.profileId)?.profileType === 'REINFORCEMENT')))} 
                                getProfileName={getProfileName}
                                onEdit={(tx:any) => { setEditingTransaction(tx); setIsTransactionModalOpen(true); }}
                                onDelete={deleteProfileTransaction}
                                type="PRODUCTION"
                                getBrandBadge={getBrandBadge}
                                getProfile={getProfile}
                                isMovementView={true}
                            />
                        )}
                    </div>
                )}

                {activeTab === 'Production' && (
                    <div className="space-y-4">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div className="p-1 bg-gray-100 dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-inner flex flex-wrap gap-1">
                                <button
                                    onClick={() => setProductionSubTab('Inflow')}
                                    className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-200 flex-1 md:flex-initial text-center ${
                                        productionSubTab === 'Inflow' ? 'bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-gray-500 hover:text-gray-900 dark:hover:text-gray-200'
                                    }`}
                                >
                                    Inflow (Production)
                                </button>
                                <button
                                    onClick={() => setProductionSubTab('Outflow')}
                                    className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-200 flex-1 md:flex-initial text-center ${
                                        productionSubTab === 'Outflow' ? 'bg-white dark:bg-gray-800 text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-900 dark:hover:text-gray-200'
                                    }`}
                                >
                                    Outflow (Dispatch)
                                </button>
                            </div>
                            <div className="flex items-center gap-2">
                                <button 
                                    onClick={() => { setTransactionType(productionSubTab === 'Inflow' ? 'PRODUCTION' : 'DISPATCH'); setTransactionFilterType(null); setEditingTransaction(null); setIsTransactionModalOpen(true); }}
                                    className="px-4 py-2 bg-blue-600 text-white rounded-xl text-[10px] font-black uppercase tracking-tighter hover:bg-blue-700 transition-all flex items-center gap-2"
                                >
                                    <UploadCloud className="w-3 h-3" /> Record {productionSubTab === 'Inflow' ? 'Production' : 'Dispatch'}
                                </button>
                            </div>
                        </div>
                        {productionSubTab === 'Inflow' ? (
                            <TransactionTable 
                                transactions={windowProductionTransactions} 
                                getProfileName={getProfileName}
                                onEdit={(tx:any) => { setEditingTransaction(tx); setIsTransactionModalOpen(true); }}
                                onDelete={deleteProfileTransaction}
                                type="PRODUCTION"
                                getBrandBadge={getBrandBadge}
                                getProfile={getProfile}
                            />
                        ) : (
                            <div className="space-y-6">
                                <div className="px-6 pt-4 flex items-center justify-between">
                                    <h3 className="text-xs font-black uppercase text-gray-400 tracking-widest">Dispatch Records</h3>
                                </div>
                                <TransactionTable 
                                    transactions={dispatchTransactions} 
                                    getProfileName={getProfileName}
                                    onEdit={(tx:any) => { setEditingTransaction(tx); setIsTransactionModalOpen(true); }}
                                    onDelete={deleteProfileTransaction}
                                    onPrint={generateInvoicePDF}
                                    type="DISPATCH"
                                    getBrandBadge={getBrandBadge}
                                    getProfile={getProfile}
                                />
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'Data plan' && (
                    <DataPlanSheet 
                        onOpenManageBrands={() => setIsManageBrandsModalOpen(true)} 
                        onNavigateToPlanning={() => setActiveTab('Planning')}
                    />
                )}

                {activeTab === 'Scrap' && (
                    <div className="space-y-4">
                        <div className="flex justify-between items-center">
                            <h2 className="text-xl font-black text-gray-900 dark:text-white uppercase tracking-tighter">Scrap Records</h2>
                            <button 
                                onClick={() => { setTransactionType('SCRAP'); setIsTransactionModalOpen(true); }}
                                className="px-4 py-2 bg-red-600 text-white rounded-xl text-[10px] font-black uppercase tracking-tighter hover:bg-red-700 transition-all flex items-center gap-2"
                            >
                                <Trash2 className="w-4 h-4" /> Record Scrap
                            </button>
                        </div>
                        <TransactionTable 
                            transactions={profileTransactions.filter(t => t.type === 'SCRAP')}
                            getProfileName={getProfileName}
                            onEdit={(tx: any) => { setEditingTransaction(tx); setIsTransactionModalOpen(true); }}
                            onDelete={deleteProfileTransaction}
                            type="SCRAP"
                            getBrandBadge={getBrandBadge}
                            getProfile={getProfile}
                        />
                    </div>
                )}

                {activeTab === 'Planning' && (
                    <div className="space-y-4">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div>
                                <h2 className="text-xl font-black text-gray-900 dark:text-white uppercase tracking-tighter">Machine Production Schedule</h2>
                                <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Extruder Die Shifts & Monthly Length Planning</p>
                            </div>
                            <div className="flex items-center gap-2">
                                <button 
                                    onClick={() => setIsManageMachinesModalOpen(true)}
                                    className="px-3.5 py-2 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-xl text-[10px] font-black uppercase tracking-tighter hover:bg-gray-200 dark:hover:bg-gray-700 transition-all flex items-center gap-1.5 cursor-pointer border dark:border-gray-700"
                                    title="Manage Extruder Machines and Production Lines"
                                >
                                    <Cpu className="w-4 h-4 text-blue-600" /> Manage Machines
                                </button>
                                <button 
                                    onClick={() => setActiveTab('Data plan')}
                                    className="px-4 py-2 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800 rounded-xl text-[10px] font-black uppercase tracking-tighter hover:bg-emerald-100 transition-all flex items-center gap-1.5 cursor-pointer"
                                    title="Open Data Plan Sheet to run 3-month sales analysis and automatic die calculations"
                                >
                                    <FileSpreadsheet className="w-4 h-4 text-emerald-600" /> 3M Sales Data Plan
                                </button>
                                <button 
                                    onClick={() => { setEditingPlan(null); setIsPlanModalOpen(true); }}
                                    className="px-4 py-2 bg-blue-600 text-white rounded-xl text-[10px] font-black uppercase tracking-tighter hover:bg-blue-700 transition-all flex items-center gap-2 cursor-pointer shadow-sm"
                                >
                                    <Calendar className="w-4 h-4" /> Create New Plan
                                </button>
                            </div>
                        </div>
                        <PlanningTable 
                            plans={productionPlans} 
                            dies={dies} 
                            profiles={profiles}
                            onEdit={(plan: any) => { setEditingPlan(plan); setIsPlanModalOpen(true); }}
                            onDelete={(id: string) => { if(confirm('Delete this plan?')) deleteProductionPlan(id); }}
                        />
                    </div>
                )}

                {activeTab === 'Brand Sync Planning' && (
                    <div className="space-y-6">
                        <BrandSyncPlanning 
                            initialBrandFilter={brandFilter}
                            onBrandFilterChange={(b) => setBrandFilter(b)}
                            addToast={addToast}
                            onExportStockToDataPlan={handleExportStockToDataPlan}
                        />
                    </div>
                )}

                {activeTab === 'Analysis' && (
                    <div className="space-y-4">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-gray-800 p-4 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm">
                            <div>
                                <h2 className="text-lg font-black text-gray-900 dark:text-white uppercase tracking-tighter">Monthly Stock Analysis</h2>
                                <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Opening vs Closing Inventory</p>
                            </div>
                            <div className="flex items-center gap-3">
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Select Month</label>
                                <input 
                                    type="month" 
                                    value={analysisMonth} 
                                    onChange={(e) => setAnalysisMonth(e.target.value)}
                                    className="bg-gray-50 dark:bg-gray-900 border-none rounded-xl text-xs font-black uppercase tracking-tighter py-2.5 px-4 outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                                />
                            </div>
                        </div>
                        <MonthlyAnalysis profiles={profiles} transactions={profileTransactions} month={analysisMonth} />
                    </div>
                )}

                {activeTab === 'Dies' && (
                    <div className="space-y-4">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div>
                                <h2 className="text-xl font-black text-gray-900 dark:text-white uppercase tracking-tighter">Die Master Parameters</h2>
                                <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Extrusion tooling & cavity specifications</p>
                            </div>
                            <div className="flex items-center gap-2 flex-wrap">
                                <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-900 px-3 py-1.5 rounded-xl border border-gray-200/50 dark:border-gray-700/50">
                                    <Filter className="w-3.5 h-3.5 text-gray-400" />
                                    <select
                                        value={brandFilter}
                                        onChange={(e) => setBrandFilter(e.target.value)}
                                        className="bg-transparent border-none text-xs font-black uppercase tracking-wider py-1 outline-none text-gray-700 dark:text-gray-200 cursor-pointer"
                                    >
                                        <option value="All">All Brands ({dies.length})</option>
                                        {brands.map(b => (
                                            <option key={b} value={b}>
                                                {b} ({dies.filter(d => (d.brand || 'General').toLowerCase() === b.toLowerCase()).length})
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <button 
                                    onClick={() => { setEditingDie(null); setIsDieModalOpen(true); }}
                                    className="px-4 py-2 bg-blue-600 text-white rounded-xl text-[10px] font-black uppercase tracking-tighter hover:bg-blue-700 transition-all flex items-center gap-2"
                                >
                                    <Settings className="w-4 h-4" /> Add New Die
                                </button>
                            </div>
                        </div>
                        <DieTable 
                            dies={dies.filter(d => brandFilter === 'All' || (d.brand || 'General').toLowerCase() === brandFilter.toLowerCase())} 
                            profiles={profiles}
                            onEdit={(die: any) => { setEditingDie(die); setIsDieModalOpen(true); }}
                            onDelete={(id: string) => { if(confirm('Delete this die?')) deleteDie(id); }}
                            onLogSheet={(die: any) => setLogSheetDie(die)}
                        />
                    </div>
                )}

                {activeTab === 'Quotations' && (
                    <div className="space-y-4">
                        <Quotation defaultBrand={brandFilter} />
                    </div>
                )}

                {activeTab === 'Profiles' && (
                    <div className="space-y-6">
                        {/* Sub-tab Navigation Bar */}
                        <div className="flex items-center justify-between bg-white dark:bg-gray-800 p-2 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm flex-wrap gap-2">
                            <div className="flex items-center gap-1.5 p-1 bg-gray-100 dark:bg-gray-900/60 rounded-xl">
                                <button
                                    onClick={() => setProfileSubTab('Profiles')}
                                    className={`px-4 py-2 rounded-lg text-xs font-black uppercase tracking-tight transition-all flex items-center gap-2 ${
                                        profileSubTab === 'Profiles'
                                            ? 'bg-white dark:bg-gray-800 text-blue-600 shadow-sm'
                                            : 'text-gray-500 hover:text-gray-800 dark:hover:text-gray-200'
                                    }`}
                                >
                                    <Package className="w-3.5 h-3.5" /> Profiles Master Catalogue
                                </button>
                                <button
                                    onClick={() => setProfileSubTab('Protective Films')}
                                    className={`px-4 py-2 rounded-lg text-xs font-black uppercase tracking-tight transition-all flex items-center gap-2 ${
                                        profileSubTab === 'Protective Films'
                                            ? 'bg-white dark:bg-gray-800 text-blue-600 shadow-sm'
                                            : 'text-gray-500 hover:text-gray-800 dark:hover:text-gray-200'
                                    }`}
                                >
                                    <Shield className="w-3.5 h-3.5 text-blue-500" /> Protective Films & Sticker Stock
                                </button>
                            </div>

                            {profileSubTab === 'Protective Films' && (
                                <span className="text-[11px] font-bold text-gray-500 px-3 hidden sm:inline">
                                    ⚡ Real-time sticker auto-deduction from profile production
                                </span>
                            )}
                        </div>

                        {profileSubTab === 'Protective Films' ? (
                            <ProtectiveFilms defaultBrand={brandFilter} onOpenManageBrands={() => setIsManageBrandsModalOpen(true)} />
                        ) : (
                            <>
                                {/* AI Ingestion Hero */}
                                <div className="bg-gradient-to-br from-emerald-600 to-teal-700 p-8 rounded-[2rem] text-white shadow-xl shadow-emerald-500/20 overflow-hidden relative group border border-white/10">
                                    <div className="absolute -top-12 -right-12 p-8 opacity-10 group-hover:opacity-20 transition-opacity">
                                        <Sparkles className="w-64 h-64" />
                                    </div>
                                    <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-8">
                                        <div className="max-w-3xl">
                                            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/20 text-[10px] font-black uppercase tracking-widest mb-6 backdrop-blur-md">
                                                <Zap className="w-3 h-3 fill-white" /> AI System Active
                                            </div>
                                            <h3 className="text-4xl font-black tracking-tighter mb-4 leading-none">AI PDF Catalogue Ingestion</h3>
                                            <p className="text-emerald-50 text-lg font-medium leading-relaxed opacity-90 max-w-2xl">
                                                Automatically extract SKUs, Descriptions, Lengths, Piece Weights, and Meter Weights. 
                                                Seamlessly sync multi-brand catalogues into your master database in seconds.
                                            </p>
                                        </div>
                                        <div className="flex-shrink-0">
                                            <button 
                                                onClick={() => pdfFileInputRef.current?.click()}
                                                disabled={isUploadingPdf}
                                                className="px-10 py-5 bg-white text-emerald-700 rounded-2xl font-black uppercase tracking-widest text-sm hover:bg-emerald-50 transition-all shadow-2xl shadow-black/20 flex items-center gap-3 disabled:opacity-50 active:scale-95 group/btn"
                                            >
                                                {isUploadingPdf ? (
                                                    <>
                                                        <RefreshCw className="w-6 h-6 animate-spin" />
                                                        Analyzing Data...
                                                    </>
                                                ) : (
                                                    <>
                                                        <UploadCloud className="w-6 h-6 group-hover/btn:-translate-y-1 transition-transform" />
                                                        Upload PDF Catalogue
                                                    </>
                                                )}
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white dark:bg-gray-800 p-4 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm">
                                    <div className="flex flex-col md:flex-row items-center gap-4 flex-1">
                                        <div className="relative flex-1 max-w-md w-full">
                                            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                            <input
                                                type="text"
                                                placeholder="Search profile master data by name or SKU..."
                                                value={searchTerm}
                                                onChange={(e) => setSearchTerm(e.target.value)}
                                                className="w-full pl-10 pr-4 py-2.5 bg-gray-50 dark:bg-gray-900 border-none rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                                            />
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <Filter className="w-4 h-4 text-gray-400" />
                                        <select
                                            value={brandFilter}
                                            onChange={(e) => setBrandFilter(e.target.value)}
                                            className="bg-gray-50 dark:bg-gray-900 border-none rounded-xl text-xs font-black uppercase tracking-tighter py-2.5 px-4 outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                                        >
                                            <option value="All">All Brands</option>
                                            {brands.map(b => <option key={b} value={b}>{b}</option>)}
                                        </select>
                                        <button 
                                            onClick={() => setIsManageBrandsModalOpen(true)}
                                            className="px-4 py-2 bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white rounded-xl text-[10px] font-black uppercase tracking-tighter hover:bg-gray-200 dark:hover:bg-gray-700 transition-all flex items-center gap-2 border dark:border-gray-700"
                                        >
                                            <SparklesIcon className="w-4 h-4 text-blue-500" /> Manage Brands
                                        </button>
                                         <input 
                                             type="file" 
                                             ref={pdfFileInputRef} 
                                             onChange={handlePdfCatalogueUpload} 
                                             accept=".pdf,.txt,.csv" 
                                             className="hidden" 
                                         />
                                         <input 
                                             type="file" 
                                             ref={excelFileInputRef} 
                                             onChange={handleExcelCatalogueUpload} 
                                             accept=".xlsx,.xls,.csv" 
                                             className="hidden" 
                                         />
                                         <button 
                                             onClick={() => excelFileInputRef.current?.click()}
                                             className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-[10px] font-black uppercase tracking-tighter hover:bg-emerald-700 transition-all flex items-center gap-2"
                                         >
                                             <FileSpreadsheet className="w-4 h-4" /> Upload Excel Catalogue
                                         </button>
                                        <div className="relative" ref={downloadProfileMenuRef}>
                                            <button
                                                onClick={() => setIsDownloadProfileMenuOpen(prev => !prev)}
                                                className="px-4 py-2 bg-slate-800 dark:bg-gray-700 text-white rounded-xl text-[10px] font-black uppercase tracking-tighter hover:bg-slate-700 dark:hover:bg-gray-600 transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-sm active:scale-95"
                                                title="Download profiles catalog in Excel or PDF format"
                                            >
                                                <Download className="w-3.5 h-3.5" />
                                                <span>Export Report</span>
                                                <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isDownloadProfileMenuOpen ? 'rotate-180' : ''}`} />
                                            </button>
                                            {isDownloadProfileMenuOpen && (
                                                <div className="absolute right-0 mt-2 w-40 bg-white dark:bg-slate-800 rounded-xl shadow-lg py-1.5 z-30 border border-gray-100 dark:border-gray-700">
                                                    <button onClick={handleExportProfilesExcel} className="block w-full text-left px-4 py-2 text-xs font-bold text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700">
                                                        Download Excel
                                                    </button>
                                                    <button onClick={handleExportProfilesPdf} className="block w-full text-left px-4 py-2 text-xs font-bold text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700">
                                                        Download PDF
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                        <button 
                                            onClick={() => { setEditingProfile(null); setIsProfileModalOpen(true); }}
                                            className="px-4 py-2 bg-blue-600 text-white rounded-xl text-[10px] font-black uppercase tracking-tighter hover:bg-blue-700 transition-all flex items-center gap-2"
                                        >
                                            <Package className="w-4 h-4" /> Add New Profile
                                        </button>
                                    </div>
                                </div>

                                {/* Brand Wise Summary Cards */}
                                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                                    {brands.map(b => {
                                        const bStat = brandWiseStockStats[b] || { count: 0, pieces: 0, weight: 0 };
                                        const isSelected = brandFilter === b;
                                        return (
                                            <div 
                                                key={b}
                                                onClick={() => setBrandFilter(isSelected ? 'All' : b)}
                                                className={`p-3 rounded-2xl border transition-all cursor-pointer relative overflow-hidden group ${
                                                    isSelected 
                                                        ? 'bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-500/20' 
                                                        : 'bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-700'
                                                }`}
                                            >
                                                <div className="flex items-center justify-between mb-1.5">
                                                    <span className={`text-[10px] font-black uppercase tracking-wider ${isSelected ? 'text-blue-100' : 'text-gray-500 dark:text-gray-400'}`}>
                                                        {b}
                                                    </span>
                                                    <span className={`px-1.5 py-0.5 rounded-lg text-[9px] font-mono font-black ${isSelected ? 'bg-white/20 text-white' : 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'}`}>
                                                        {bStat.count} Profiles
                                                    </span>
                                                </div>
                                                <div className="flex items-baseline gap-2">
                                                    <span className="text-sm font-black font-mono tracking-tight">{(bStat.pieces || 0).toLocaleString()} Pcs</span>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>

                                <ProfileListTable 
                                    profiles={filteredProfiles} 
                                    onEdit={(p:Profile) => { setEditingProfile(p); setIsProfileModalOpen(true); }}
                                    onDelete={deleteProfile}
                                    getBrandBadge={getBrandBadge}
                                    updateProfile={updateProfile}
                                />
                            </>
                        )}
                    </div>
                )}

                {activeTab === 'Protective Films' && (
                    <div className="space-y-6">
                        <ProtectiveFilms defaultBrand={brandFilter} onOpenManageBrands={() => setIsManageBrandsModalOpen(true)} />
                    </div>
                )}

                {activeTab === 'Reinforcement Stock' && (
                    <div className="space-y-4">
                        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white dark:bg-gray-800 p-4 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm">
                             <div className="flex flex-col md:flex-row items-center gap-4 flex-1">
                                <div className="relative flex-1 max-w-md w-full">
                                    <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                    <input
                                        type="text"
                                        placeholder="Search reinforcement stock by name or SKU..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="w-full pl-10 pr-4 py-2.5 bg-gray-50 dark:bg-gray-900 border-none rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                                    />
                                </div>
                            </div>
                             <div className="flex items-center gap-2">
                                <button 
                                    onClick={importQuotationPresets}
                                    className="px-4 py-2 bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white rounded-xl text-[10px] font-black uppercase tracking-tighter hover:bg-gray-200 dark:hover:bg-gray-700 transition-all flex items-center gap-2 border dark:border-gray-700"
                                >
                                    <SparklesIcon className="w-4 h-4 text-orange-500" /> Import Presets
                                </button>
                                <button 
                                    onClick={() => { setEditingProfile(null); setIsProfileModalOpen(true); }}
                                    className="px-4 py-2 bg-orange-600 text-white rounded-xl text-[10px] font-black uppercase tracking-tighter hover:bg-orange-700 transition-all flex items-center gap-2"
                                >
                                    <Layers className="w-4 h-4" /> Add New Reinforcement
                                </button>
                            </div>
                        </div>
                        <StockTable 
                            stockData={filteredProfiles} 
                            onEditProfile={(p:Profile) => {setEditingProfile(p); setIsProfileModalOpen(true);}}
                            onAddStock={(p: Profile) => {
                                setTransactionType('PRODUCTION');
                                setTransactionFilterType('REINFORCEMENT');
                                setInitialTransactionProfile(p.id);
                                setInitialTransactionBrand(p.brand);
                                setIsTransactionModalOpen(true);
                            }}
                            onDeleteProfile={deleteProfile}
                            getBrandBadge={getBrandBadge}
                            updateProfile={updateProfile}
                        />
                    </div>
                )}

                {activeTab === 'Reinforcement Inflow' && (
                    <div className="space-y-4">
                        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white dark:bg-gray-800 p-4 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm">
                             <div className="flex flex-col md:flex-row items-center gap-4 flex-1">
                                <div className="relative flex-1 max-w-md w-full">
                                    <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                    <input
                                        type="text"
                                        placeholder="Search reinforcement inflow records..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="w-full pl-10 pr-4 py-2.5 bg-gray-50 dark:bg-gray-900 border-none rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                                    />
                                </div>
                            </div>
                             <div className="flex items-center gap-2">
                                <button 
                                    onClick={() => { setTransactionType('PRODUCTION'); setTransactionFilterType('REINFORCEMENT'); setEditingTransaction(null); setIsTransactionModalOpen(true); }}
                                    className="px-4 py-2 bg-blue-600 text-white rounded-xl text-[10px] font-black uppercase tracking-tighter hover:bg-blue-700 transition-all flex items-center gap-2"
                                >
                                    <CloudUploadIcon className="w-3 h-3" /> Record Reinforcement Inflow
                                </button>
                            </div>
                        </div>
                        <TransactionTable 
                            transactions={reinforcementInflowTransactions} 
                            getProfileName={getProfileName}
                            onEdit={(tx:any) => { setEditingTransaction(tx); setIsTransactionModalOpen(true); }}
                            onDelete={deleteProfileTransaction}
                            type="PRODUCTION"
                            getBrandBadge={getBrandBadge}
                            getProfile={getProfile}
                        />
                    </div>
                )}

                {activeTab === 'Customers' && (
                    <div className="space-y-4">
                        <div className="flex justify-between items-center">
                            <h2 className="text-xl font-black text-gray-900 dark:text-white uppercase tracking-tighter">Customer Database</h2>
                            <button 
                                onClick={() => { setEditingCustomer(null); setIsCustomerModalOpen(true); }}
                                className="px-4 py-2 bg-blue-600 text-white rounded-xl text-[10px] font-black uppercase tracking-tighter hover:bg-blue-700 transition-all flex items-center gap-2"
                            >
                                <UserIcon className="w-4 h-4" /> Add New Customer
                            </button>
                        </div>
                        <CustomerTable 
                            customers={customers.filter(c => c.name.toLowerCase().includes(searchTerm.toLowerCase()))} 
                            onEdit={(c:Customer) => { setEditingCustomer(c); setIsCustomerModalOpen(true); }}
                            onDelete={deleteCustomer}
                        />
                    </div>
                )}
            </div>

            {/* Global Modals */}
            <Portal>
                <AddProfileModal 
                    isOpen={isProfileModalOpen} 
                    onClose={() => {setIsProfileModalOpen(false); setEditingProfile(null);}} 
                    onAdd={editingProfile ? (data) => { updateProfile({...editingProfile, ...data}); return {...editingProfile, ...data}; } : addProfile} 
                    onUpdate={updateProfile}
                    existingProfiles={profiles}
                    brands={brands} 
                    addToast={addToast} 
                    initialData={editingProfile} 
                    initialProfileType={activeTab === 'Reinforcement Stock' ? 'REINFORCEMENT' : 'WINDOW'}
                />
            </Portal>

            <Portal>
                <DuplicateResolutionModal 
                    isOpen={isDuplicateModalOpen}
                    onClose={() => {
                        setIsDuplicateModalOpen(false);
                        setDuplicateCallback(null);
                    }}
                    conflicts={duplicateConflicts}
                    nonConflictsCount={duplicateNonConflicts.length}
                    onResolve={(resolutions) => {
                        if (duplicateCallback) {
                            duplicateCallback(resolutions);
                        }
                        setIsDuplicateModalOpen(false);
                        setDuplicateCallback(null);
                    }}
                />
            </Portal>

            <Portal>
                <CustomerModal 
                    isOpen={isCustomerModalOpen} 
                    onClose={() => { setIsCustomerModalOpen(false); setEditingCustomer(null); }} 
                    onSave={editingCustomer ? (data) => updateCustomer({...editingCustomer, ...data}) : addCustomer} 
                    customer={editingCustomer} 
                    addToast={addToast} 
                />
            </Portal>

            <Portal>
                <TransactionModal 
                    isOpen={isTransactionModalOpen} 
                    onClose={() => { setIsTransactionModalOpen(false); setEditingTransaction(null); setTransactionFilterType(null); setInitialTransactionProfile(null); setInitialTransactionBrand(null); }} 
                    type={transactionType} 
                    profiles={profiles} 
                    brands={brands} 
                    onAdd={addProfileTransaction} 
                    addToast={addToast} 
                    customers={customers} 
                    filterType={transactionFilterType}
                    initialProfileId={initialTransactionProfile}
                    initialBrand={initialTransactionBrand}
                    onAddNewProfile={() => { setIsTransactionModalOpen(false); setEditingProfile(null); setIsProfileModalOpen(true); }}
                />
            </Portal>

            <Portal>
                <EditTransactionModal 
                    isOpen={!!editingTransaction} 
                    onClose={() => setEditingTransaction(null)} 
                    transaction={editingTransaction} 
                    onUpdate={updateProfileTransaction} 
                />
            </Portal>

            <Portal>
                <CreateQuotationModal 
                    isOpen={isQuotationModalOpen} 
                    onClose={() => {setIsQuotationModalOpen(false); setEditingQuotation(null);}} 
                    profiles={profiles} 
                    customers={customers} 
                    onAddMultiple={(txs) => txs.forEach(addProfileTransaction)} 
                    addCustomer={addCustomer} 
                    addToast={addToast} 
                    existingTransactions={editingQuotation ? editingQuotation : undefined} 
                    brands={brands} 
                    addBrand={addBrand} 
                    deleteBrand={deleteBrand} 
                    companySettings={companySettings}
                />
            </Portal>

            <Portal>
                <ProductionPlanModal 
                    isOpen={isPlanModalOpen} 
                    onClose={() => setIsPlanModalOpen(false)} 
                    plan={editingPlan}
                    dies={dies}
                    profiles={profiles}
                    machines={machines}
                    addMachine={addMachine}
                    deleteMachine={deleteMachine}
                    addProfile={addProfile}
                    addDie={addDie}
                    onSave={(plan: any) => {
                        if (editingPlan) updateProductionPlan({ ...editingPlan, ...plan });
                        else addProductionPlan(plan);
                        setIsPlanModalOpen(false);
                        addToast(`Production plan ${editingPlan ? 'updated' : 'created'}!`, 'success');
                    }}
                    addToast={addToast}
                    brands={brands}
                />
            </Portal>

            <Portal>
                <DieModal 
                    isOpen={isDieModalOpen} 
                    onClose={() => {setIsDieModalOpen(false); setEditingDie(null);}} 
                    die={editingDie}
                    profiles={profiles}
                    brands={brands}
                    onSave={(data: any) => {
                        if (editingDie) updateDie({ ...editingDie, ...data });
                        else addDie(data);
                        setIsDieModalOpen(false);
                        addToast(`Die ${editingDie ? 'updated' : 'added'}!`, 'success');
                    }}
                    addToast={addToast}
                    addProfile={addProfile}
                />
            </Portal>

            <Portal>
                <ProcessLogSheetModal 
                    isOpen={!!logSheetDie} 
                    onClose={() => setLogSheetDie(null)} 
                    die={logSheetDie}
                    addToast={addToast}
                />
            </Portal>

            <Portal>
                <CompanySettingsModal 
                    isOpen={isSettingsModalOpen} 
                    onClose={() => setIsSettingsModalOpen(false)} 
                    settings={companySettings} 
                    updateSettings={updateCompanySettings} 
                    brands={brands} 
                    addToast={addToast} 
                />
            </Portal>

            <Portal>
                <ManageBrandsModal 
                    isOpen={isManageBrandsModalOpen} 
                    onClose={() => setIsManageBrandsModalOpen(false)} 
                    brands={brands} 
                    addBrand={addBrand} 
                    updateBrand={updateBrand} 
                    deleteBrand={deleteBrand} 
                    addToast={addToast} 
                />
            </Portal>

            <Portal>
                <ManageMachinesModal 
                    isOpen={isManageMachinesModalOpen} 
                    onClose={() => setIsManageMachinesModalOpen(false)} 
                    machines={machines} 
                    addMachine={addMachine} 
                    deleteMachine={deleteMachine} 
                    addToast={addToast} 
                />
            </Portal>

            <Portal>
                <ExportStockToDataPlanModal
                    isOpen={isExportStockModalOpen}
                    onClose={() => setIsExportStockModalOpen(false)}
                    brands={brands}
                    profiles={profiles}
                    profileTransactions={profileTransactions}
                    onExport={handleExportStockToDataPlan}
                    onOpenDataPlanTab={() => {
                        setIsExportStockModalOpen(false);
                        setActiveTab('Data plan');
                    }}
                />
            </Portal>

            <Portal>
                <CatalogueBrandModal 
                    isOpen={isCatalogueBrandModalOpen}
                    onClose={() => { setIsCatalogueBrandModalOpen(false); setPendingCatalogueFile(null); }}
                    onConfirm={confirmCatalogueUpload}
                    brands={brands}
                />
            </Portal>
        </div>
    );
};

// --- EXPORT STOCK TO DATA PLAN MODAL ---
const ExportStockToDataPlanModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    brands: string[];
    profiles: Profile[];
    profileTransactions: ProfileTransaction[];
    onExport: (selectedBrand?: string) => void;
    onOpenDataPlanTab: () => void;
}> = ({ isOpen, onClose, brands, profiles, profileTransactions, onExport, onOpenDataPlanTab }) => {
    const [selectedBrand, setSelectedBrand] = useState('All');
    const [isProcessing, setIsProcessing] = useState(false);

    if (!isOpen) return null;

    // Calculate live summary by brand
    const activeBrands = ['S CRAFT', 'SMART', ...brands].filter((v, i, a) => a.indexOf(v) === i);
    const brandStats: Record<string, { count: number; pieces: number; weight: number }> = {};
    let grandTotalPcs = 0;
    let grandTotalWt = 0;

    activeBrands.forEach(b => {
        const brandProfs = profiles.filter(p => {
            const pb = (p.brand || '').toUpperCase();
            const tb = b.toUpperCase();
            return pb === tb || (tb.includes('CRAFT') && pb.includes('CRAFT'));
        });

        let bPieces = 0;
        let bWeight = 0;

        brandProfs.forEach(p => {
            const txns = profileTransactions.filter(t => t.profileId === p.id && !t.deletedAt);
            const prod = txns.filter(t => t.type === 'PRODUCTION' || t.type === 'RETURN').reduce((s, t) => s + Number(t.quantity || 0), 0);
            const disp = txns.filter(t => t.type === 'DISPATCH').reduce((s, t) => s + Number(t.quantity || 0), 0);
            const scr = txns.filter(t => t.type === 'SCRAP').reduce((s, t) => s + Number(t.quantity || 0), 0);
            const stock = Math.max(0, prod - disp - scr);
            bPieces += stock;
            bWeight += (stock * Number(p.weight || 0));
        });

        brandStats[b] = { count: brandProfs.length, pieces: bPieces, weight: bWeight };
        grandTotalPcs += bPieces;
        grandTotalWt += bWeight;
    });

    const handleExecute = (brand?: string) => {
        setIsProcessing(true);
        setTimeout(() => {
            onExport(brand || selectedBrand);
            setIsProcessing(false);
        }, 150);
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[170] flex justify-center items-center p-4" onClick={onClose}>
            <div className="bg-white dark:bg-gray-800 rounded-3xl max-w-xl w-full p-6 shadow-2xl border border-gray-100 dark:border-gray-700 animate-in fade-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-5">
                    <div className="flex items-center gap-3">
                        <div className="p-3 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-2xl text-white shadow-lg shadow-blue-500/20">
                            <UploadCloud className="w-5 h-5" />
                        </div>
                        <div>
                            <h3 className="text-lg font-black text-gray-900 dark:text-white uppercase tracking-tight">Export Live Stock to Data Plan</h3>
                            <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">Export current warehouse inventory into the Data Plan sheet</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 transition-all">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Stock Stats Preview */}
                <div className="p-4 bg-blue-50/60 dark:bg-blue-950/20 border border-blue-200/60 dark:border-blue-800/30 rounded-2xl mb-5 space-y-3">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-black uppercase tracking-wider text-blue-900 dark:text-blue-300">Live Inventory Ready for Export</span>
                        <span className="text-[11px] font-bold text-blue-700 dark:text-blue-400 font-mono">
                            {grandTotalPcs.toLocaleString()} Total Pcs ({grandTotalWt.toFixed(1)} Kg)
                        </span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 pt-2 border-t border-blue-200/50 dark:border-blue-800/30 text-center">
                        <div className="p-2.5 bg-white/90 dark:bg-gray-800/90 rounded-xl border border-blue-100 dark:border-gray-700 shadow-2xs">
                            <div className="text-[10px] font-black uppercase tracking-tight text-gray-400">S CRAFT Stock</div>
                            <div className="text-sm font-black text-amber-600 dark:text-amber-400 font-mono">
                                {(brandStats['S CRAFT']?.pieces || 0).toLocaleString()} <span className="text-[10px] text-gray-500 font-normal">Pcs</span>
                            </div>
                        </div>
                        <div className="p-2.5 bg-white/90 dark:bg-gray-800/90 rounded-xl border border-blue-100 dark:border-gray-700 shadow-2xs">
                            <div className="text-[10px] font-black uppercase tracking-tight text-gray-400">SMART Stock</div>
                            <div className="text-sm font-black text-purple-600 dark:text-purple-400 font-mono">
                                {(brandStats['SMART']?.pieces || 0).toLocaleString()} <span className="text-[10px] text-gray-500 font-normal">Pcs</span>
                            </div>
                        </div>
                        <div className="p-2.5 bg-white/90 dark:bg-gray-800/90 rounded-xl border border-blue-100 dark:border-gray-700 shadow-2xs">
                            <div className="text-[10px] font-black uppercase tracking-tight text-gray-400">Other Brands</div>
                            <div className="text-sm font-black text-blue-600 dark:text-blue-400 font-mono">
                                {activeBrands.filter(b => b !== 'S CRAFT' && b !== 'SMART').reduce((sum, b) => sum + (brandStats[b]?.pieces || 0), 0).toLocaleString()} <span className="text-[10px] text-gray-500 font-normal">Pcs</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Scope Selection & Notes */}
                <div className="space-y-4 mb-6">
                    <div>
                        <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">Export Scope</label>
                        <select 
                            value={selectedBrand} 
                            onChange={(e) => setSelectedBrand(e.target.value)}
                            className="w-full p-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-bold text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                        >
                            <option value="All">🚀 All Brands Stock (Complete Export to Data Plan)</option>
                            {activeBrands.map(b => (
                                <option key={b} value={b}>Only Brand: {b} ({(brandStats[b]?.pieces || 0).toLocaleString()} Pcs)</option>
                            ))}
                        </select>
                    </div>

                    <div className="p-3.5 bg-gray-50 dark:bg-gray-900/50 rounded-2xl border border-gray-100 dark:border-gray-700 text-xs text-gray-600 dark:text-gray-300 space-y-1.5 font-medium">
                        <div className="flex items-center gap-2 font-bold text-gray-800 dark:text-white">
                            <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" /> Seamless Data Plan Integration
                        </div>
                        <p className="text-[11px] leading-relaxed text-gray-500 dark:text-gray-400 pl-6">
                            Exporting will transfer your actual stock numbers into the corresponding brand columns in the Data Plan sheet. The Data Plan uses these stock figures alongside 3-month sales history to calculate exact production lengths and machine die schedules.
                        </p>
                    </div>
                </div>

                <div className="flex items-center justify-between pt-4 border-t dark:border-gray-700">
                    <button
                        onClick={onOpenDataPlanTab}
                        className="text-xs font-black text-blue-600 hover:text-blue-700 dark:text-blue-400 flex items-center gap-1 cursor-pointer"
                    >
                        <FileSpreadsheet className="w-3.5 h-3.5" /> Go to Data Plan <ArrowRight className="w-3 h-3" />
                    </button>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={onClose}
                            className="px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-tighter text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-all"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={() => handleExecute()}
                            disabled={isProcessing}
                            className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl text-xs font-black uppercase tracking-tighter hover:from-blue-700 hover:to-indigo-700 transition-all flex items-center gap-2 shadow-lg shadow-blue-500/20 active:scale-95 disabled:opacity-50 cursor-pointer"
                        >
                            {isProcessing ? (
                                <>
                                    <RefreshCw className="w-4 h-4 animate-spin" /> Exporting...
                                </>
                            ) : (
                                <>
                                    <UploadCloud className="w-4 h-4" /> Export Stock Now
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

// --- NEW SUB-COMPONENTS FOR PLANNING & ANALYSIS ---
const DieTable: React.FC<any> = ({ dies, profiles, onEdit, onDelete, onLogSheet }) => (
    <div className="overflow-x-auto bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm">
        <table className="w-full text-sm text-left">
            <thead className="text-[10px] text-gray-400 dark:text-gray-500 uppercase tracking-widest bg-gray-50/50 dark:bg-gray-900/50 border-b dark:border-gray-700">
                <tr>
                    <th className="px-6 py-4 font-black">Die No</th>
                    <th className="px-6 py-4 font-black">Brand</th>
                    <th className="px-6 py-4 font-black">Profile</th>
                    <th className="px-6 py-4 text-center font-black">Cavities</th>
                    <th className="px-6 py-4 text-center font-black">Output (Kg/Hr)</th>
                    <th className="px-6 py-4 text-center font-black">Status</th>
                    <th className="px-6 py-4 text-right font-black">Actions</th>
                </tr>
            </thead>
            <tbody className="divide-y dark:divide-gray-700">
                {dies.length === 0 ? (
                    <tr><td colSpan={7} className="px-6 py-12 text-center text-gray-400 font-medium italic">No dies registered.</td></tr>
                ) : (
                    dies.map((die: any) => {
                        const profile = profiles.find((p: any) => p.id === die.profileId);
                        const brandName = die.brand || profile?.brand || 'General';
                        return (
                            <tr key={die.id} className="hover:bg-gray-50 dark:hover:bg-gray-900/30 transition-all">
                                <td className="px-6 py-4 font-black text-gray-900 dark:text-white">{die.dieNo}</td>
                                <td className="px-6 py-4">
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-700">
                                        {brandName}
                                    </span>
                                </td>
                                <td className="px-6 py-4 text-gray-600 dark:text-gray-400">{profile?.name || 'Unknown'}</td>
                                <td className="px-6 py-4 text-center font-bold">{die.cavities}</td>
                                <td className="px-6 py-4 text-center font-bold">{die.expectedOutputKgHr}</td>
                                <td className="px-6 py-4 text-center">
                                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-tighter ${
                                        die.status === 'ACTIVE' ? 'bg-green-100 text-green-800' : 
                                        die.status === 'MAINTENANCE' ? 'bg-orange-100 text-orange-800' : 
                                        'bg-gray-100 text-gray-800'
                                    }`}>
                                        {die.status}
                                    </span>
                                </td>
                                <td className="px-6 py-4 text-right">
                                    <div className="flex justify-end gap-1">
                                        <button onClick={() => onLogSheet(die)} className="p-2 text-purple-500 hover:bg-purple-50 dark:hover:bg-purple-900/30 rounded-lg transition-all" title="Process Log Sheet"><Cpu className="w-4 h-4" /></button>
                                        <button onClick={() => onEdit(die)} className="p-2 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-all"><Edit2 className="w-4 h-4" /></button>
                                        <button onClick={() => onDelete(die.id)} className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-all"><Trash2 className="w-4 h-4" /></button>
                                    </div>
                                </td>
                            </tr>
                        );
                    })
                )}
            </tbody>
        </table>
    </div>
);

const DieModal: React.FC<any> = ({ isOpen, onClose, die, profiles, onSave, addToast, brands, addProfile }) => {
    const [form, setForm] = useState({
        dieNo: '',
        profileId: '',
        brand: '',
        cavities: 1,
        expectedOutputKgHr: 0,
        lifespanMeters: 0,
        status: 'ACTIVE'
    });
    const [isAddingProfile, setIsAddingProfile] = useState(false);
    const [newProfileForm, setNewProfileForm] = useState({
        sku: '',
        name: '',
        brand: '',
        profileType: 'WINDOW',
        uom: 'PCS',
        length: 5.9,
        weight: 4.89,
        piecesPerPacket: 6,
        price: 150,
        hsnCode: '391620'
    });

    useEffect(() => {
        if (die) setForm(die);
        else setForm({
            dieNo: '',
            profileId: '',
            brand: brands[0] || '',
            cavities: 1,
            expectedOutputKgHr: 0,
            lifespanMeters: 0,
            status: 'ACTIVE'
        });
        setIsAddingProfile(false);
    }, [die, isOpen, brands]);

    if (!isOpen) return null;

    const handleCreateProfile = (e: React.FormEvent) => {
        e.preventDefault();
        if (!newProfileForm.name.trim()) return addToast('Please enter a Profile / Item Name', 'error');
        const generatedSku = newProfileForm.sku.trim() || `PRF-${Date.now().toString().slice(-4)}`;
        const newProfile = {
            id: `p-${Date.now()}`,
            sku: generatedSku,
            name: newProfileForm.name.trim(),
            brand: newProfileForm.brand || form.brand || brands[0] || 'RAVIRAJA',
            profileType: newProfileForm.profileType as 'WINDOW' | 'REINFORCEMENT',
            uom: newProfileForm.uom || 'PCS',
            length: Number(newProfileForm.length) || 5.9,
            weight: Number(newProfileForm.weight) || 0,
            piecesPerPacket: Number(newProfileForm.piecesPerPacket) || 1,
            price: Number(newProfileForm.price) || 0,
            hsnCode: newProfileForm.hsnCode || '391620',
            reorderPoint: 50,
            initialStock: 0,
                    };
        if (addProfile) {
            addProfile(newProfile);
        }
        setForm(prev => ({ ...prev, profileId: newProfile.id, brand: newProfile.brand }));
        setIsAddingProfile(false);
        addToast(`New profile "${newProfile.name}" created and linked to this die!`, 'success');
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.profileId) return addToast('Please select an Associated Profile', 'error');
        onSave(form);
    };

    const inputClass = "w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 p-2.5 rounded-xl text-sm dark:text-white outline-none focus:ring-2 focus:ring-blue-500 transition-all";
    const labelClass = "text-[10px] font-black uppercase text-gray-500 mb-1.5 block tracking-widest";

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 z-[200] flex justify-center items-center p-4 backdrop-blur-sm" onClick={onClose}>
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border dark:border-gray-700 max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
                <div className="px-6 py-4 bg-gray-900 text-white flex justify-between items-center shrink-0">
                    <h2 className="text-lg font-black uppercase tracking-tighter">{die ? 'Edit' : 'Add'} Die</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-white text-2xl font-bold">&times;</button>
                </div>
                <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto flex-1">
                    <div>
                        <label className={labelClass}>Die Number / Code</label>
                        <input value={form.dieNo} onChange={e => setForm({...form, dieNo: e.target.value})} className={inputClass} required placeholder="e.g. D-101 or DIE-SF-60" />
                    </div>
                    <div>
                        <label className={labelClass}>Brand</label>
                        <select value={form.brand} onChange={e => setForm({...form, brand: e.target.value})} className={inputClass}>
                            {brands.map((b: string) => <option key={b} value={b}>{b}</option>)}
                        </select>
                    </div>

                    {/* Associated Profile Selection & Inline Creation */}
                    <div className="space-y-2">
                        <div className="flex justify-between items-center">
                            <label className={labelClass}>Associated Profile / Item</label>
                            <button
                                type="button"
                                onClick={() => {
                                    setNewProfileForm({
                                        sku: '',
                                        name: '',
                                        brand: form.brand || brands[0] || 'RAVIRAJA',
                                        profileType: 'WINDOW',
                                        uom: 'PCS',
                                        length: 5.9,
                                        weight: 4.89,
                                        piecesPerPacket: 6,
                                        price: 150,
                                        hsnCode: '391620'
                                    });
                                    setIsAddingProfile(!isAddingProfile);
                                }}
                                className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 flex items-center gap-1 bg-indigo-50 dark:bg-indigo-950/40 px-2.5 py-1 rounded-lg border border-indigo-200 dark:border-indigo-800 active:scale-95 transition-all"
                            >
                                <Plus className="w-3 h-3" /> {isAddingProfile ? "Hide Form" : "+ Add New Profile / Item"}
                            </button>
                        </div>

                        {/* Inline Create Profile Form */}
                        {isAddingProfile && (
                            <div className="p-3.5 bg-indigo-50/70 dark:bg-indigo-950/40 border-2 border-indigo-200 dark:border-indigo-800 rounded-2xl space-y-3 mb-2 animate-fadeIn shadow-sm">
                                <div className="flex justify-between items-center">
                                    <span className="text-[11px] font-black uppercase text-indigo-800 dark:text-indigo-300 tracking-wider flex items-center gap-1.5">
                                        <Plus className="w-3.5 h-3.5 text-indigo-600" /> Create New Profile / Item
                                    </span>
                                    <button 
                                        type="button" 
                                        onClick={() => setIsAddingProfile(false)}
                                        className="text-xs font-bold text-gray-400 hover:text-gray-600"
                                    >
                                        ✕
                                    </button>
                                </div>
                                <div className="grid grid-cols-2 gap-2.5">
                                    <div>
                                        <label className="text-[9px] font-black uppercase text-gray-500 mb-1 block">Profile Code (SKU)</label>
                                        <input 
                                            value={newProfileForm.sku}
                                            onChange={e => setNewProfileForm({...newProfileForm, sku: e.target.value})}
                                            placeholder="e.g. PRF-60-SF"
                                            className="w-full text-xs p-2 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[9px] font-black uppercase text-gray-500 mb-1 block">Brand</label>
                                        <select 
                                            value={newProfileForm.brand}
                                            onChange={e => setNewProfileForm({...newProfileForm, brand: e.target.value})}
                                            className="w-full text-xs p-2 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
                                        >
                                            {brands.map((b: string) => <option key={b} value={b}>{b}</option>)}
                                        </select>
                                    </div>
                                </div>
                                <div>
                                    <label className="text-[9px] font-black uppercase text-gray-500 mb-1 block">Profile Description / Name</label>
                                    <input 
                                        value={newProfileForm.name}
                                        onChange={e => setNewProfileForm({...newProfileForm, name: e.target.value})}
                                        placeholder="e.g. Sliding Frame 60mm 3 Track"
                                        className="w-full text-xs p-2 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
                                    />
                                </div>
                                <div className="grid grid-cols-3 gap-2">
                                    <div>
                                        <label className="text-[9px] font-black uppercase text-gray-500 mb-1 block">Type</label>
                                        <select 
                                            value={newProfileForm.profileType}
                                            onChange={e => setNewProfileForm({...newProfileForm, profileType: e.target.value})}
                                            className="w-full text-xs p-2 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white outline-none"
                                        >
                                            <option value="WINDOW">Window Profile</option>
                                            <option value="REINFORCEMENT">Reinforcement</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-[9px] font-black uppercase text-gray-500 mb-1 block">Length (m)</label>
                                        <input 
                                            type="number"
                                            step="0.01"
                                            value={newProfileForm.length}
                                            onChange={e => setNewProfileForm({...newProfileForm, length: Number(e.target.value)})}
                                            className="w-full text-xs p-2 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white outline-none"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[9px] font-black uppercase text-gray-500 mb-1 block">Weight (kg)</label>
                                        <input 
                                            type="number"
                                            step="0.01"
                                            value={newProfileForm.weight}
                                            onChange={e => setNewProfileForm({...newProfileForm, weight: Number(e.target.value)})}
                                            className="w-full text-xs p-2 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white outline-none"
                                        />
                                    </div>
                                </div>
                                <div className="flex justify-end gap-2 pt-1 border-t border-indigo-200 dark:border-indigo-800">
                                    <button 
                                        type="button" 
                                        onClick={() => setIsAddingProfile(false)}
                                        className="px-3 py-1.5 text-xs font-bold text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                                    >
                                        Cancel
                                    </button>
                                    <button 
                                        type="button"
                                        onClick={handleCreateProfile}
                                        className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-sm transition-all active:scale-95"
                                    >
                                        + Save & Select Profile
                                    </button>
                                </div>
                            </div>
                        )}

                        <select 
                            value={form.profileId} 
                            onChange={e => {
                                if (e.target.value === '__ADD_PROFILE__') {
                                    setIsAddingProfile(true);
                                } else {
                                    setForm({...form, profileId: e.target.value});
                                }
                            }} 
                            className={inputClass} 
                            required
                        >
                            <option value="">-- Select Profile --</option>
                            {profiles.filter((p: any) => p.brand === form.brand || !form.brand).map((p: any) => (
                                <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>
                            ))}
                            <option value="__ADD_PROFILE__">+ Create New Profile / Item...</option>
                        </select>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className={labelClass}>Cavities</label>
                            <input type="number" value={form.cavities} onChange={e => setForm({...form, cavities: parseInt(e.target.value)})} className={inputClass} required />
                        </div>
                        <div>
                            <label className={labelClass}>Output (Kg/Hr)</label>
                            <input type="number" value={form.expectedOutputKgHr} onChange={e => setForm({...form, expectedOutputKgHr: parseFloat(e.target.value)})} className={inputClass} required />
                        </div>
                    </div>
                    <div>
                        <label className={labelClass}>Lifespan (Meters)</label>
                        <input type="number" value={form.lifespanMeters} onChange={e => setForm({...form, lifespanMeters: parseFloat(e.target.value)})} className={inputClass} required />
                    </div>
                    <div>
                        <label className={labelClass}>Status</label>
                        <select value={form.status} onChange={e => setForm({...form, status: e.target.value})} className={inputClass}>
                            <option value="ACTIVE">Active</option>
                            <option value="INACTIVE">Inactive</option>
                            <option value="MAINTENANCE">Maintenance</option>
                        </select>
                    </div>
                    <div className="flex justify-end gap-3 pt-4 border-t dark:border-gray-700 shrink-0">
                        <button type="button" onClick={onClose} className="px-6 py-2.5 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-black uppercase tracking-widest text-gray-500 hover:bg-gray-50 transition-all">Cancel</button>
                        <button type="submit" className="px-8 py-2.5 bg-blue-600 text-white rounded-xl text-xs font-black uppercase tracking-widest shadow-lg shadow-blue-500/20 hover:bg-blue-700 transition-all">Save Die</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

const ProcessLogSheetModal: React.FC<any> = ({ isOpen, onClose, die }) => {
    if (!isOpen || !die) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 z-[200] flex justify-center items-center p-4 backdrop-blur-sm" onClick={onClose}>
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden border dark:border-gray-700 flex flex-col" onClick={e => e.stopPropagation()}>
                <div className="px-6 py-4 bg-gray-900 text-white flex justify-between items-center">
                    <h2 className="text-lg font-black uppercase tracking-tighter">Process Log Sheet - Die {die.dieNo}</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-white text-2xl font-bold">&times;</button>
                </div>
                <div className="p-8 overflow-y-auto flex-1">
                    <div className="bg-blue-50 dark:bg-blue-900/20 p-6 rounded-2xl border border-blue-100 dark:border-blue-800 text-center">
                        <Cpu className="w-12 h-12 text-blue-600 mx-auto mb-4" />
                        <h3 className="text-xl font-black text-blue-900 dark:text-blue-100 uppercase tracking-tight mb-2">Process Log Entry Coming Soon</h3>
                        <p className="text-blue-700 dark:text-blue-300 text-sm font-medium max-w-md mx-auto">
                            We are currently developing the full interactive log sheet for tracking temperature parameters, extruder RPM, and vacuum settings for each production run.
                        </p>
                    </div>
                    
                    <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-xl border dark:border-gray-700">
                            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1">Die Number</span>
                            <span className="text-lg font-black text-gray-900 dark:text-white uppercase">{die.dieNo}</span>
                        </div>
                        <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-xl border dark:border-gray-700">
                            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1">Cavities</span>
                            <span className="text-lg font-black text-gray-900 dark:text-white uppercase">{die.cavities}</span>
                        </div>
                        <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-xl border dark:border-gray-700">
                            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1">Expected Output</span>
                            <span className="text-lg font-black text-gray-900 dark:text-white uppercase">{die.expectedOutputKgHr} Kg/Hr</span>
                        </div>
                    </div>
                </div>
                <div className="px-6 py-4 bg-gray-50 dark:bg-gray-900 border-t dark:border-gray-700 flex justify-end">
                    <button onClick={onClose} className="px-8 py-2.5 bg-gray-900 text-white rounded-xl text-xs font-black uppercase tracking-widest shadow-lg hover:bg-gray-800 transition-all">Close</button>
                </div>
            </div>
        </div>
    );
};

const QuickEntryCard: React.FC<{ onAction: (action: string) => void }> = ({ onAction }) => (
    <Card className="bg-gradient-to-br from-blue-600 to-blue-800 text-white border-none shadow-xl shadow-blue-500/20">
        <h3 className="text-[10px] font-black uppercase tracking-widest text-blue-100 mb-4 opacity-70">Quick Operations</h3>
        <div className="grid grid-cols-2 gap-3">
            <button onClick={() => onAction('PRODUCTION')} className="flex flex-col items-center justify-center p-3 bg-white/10 hover:bg-white/20 rounded-xl transition-all group">
                <Activity className="w-5 h-5 mb-2 group-hover:scale-110 transition-transform" />
                <span className="text-[9px] font-black uppercase tracking-tighter">Production</span>
            </button>
            <button onClick={() => onAction('DISPATCH')} className="flex flex-col items-center justify-center p-3 bg-white/10 hover:bg-white/20 rounded-xl transition-all group">
                <CloudUploadIcon className="w-5 h-5 mb-2 group-hover:scale-110 transition-transform" />
                <span className="text-[9px] font-black uppercase tracking-tighter">Dispatch</span>
            </button>
            <button onClick={() => onAction('QUOTATION')} className="flex flex-col items-center justify-center p-3 bg-white/10 hover:bg-white/20 rounded-xl transition-all group">
                <DollarSign className="w-5 h-5 mb-2 group-hover:scale-110 transition-transform" />
                <span className="text-[9px] font-black uppercase tracking-tighter">Quotation</span>
            </button>
            <button onClick={() => onAction('PLAN')} className="flex flex-col items-center justify-center p-3 bg-white/10 hover:bg-white/20 rounded-xl transition-all group">
                <Calendar className="w-5 h-5 mb-2 group-hover:scale-110 transition-transform" />
                <span className="text-[9px] font-black uppercase tracking-tighter">Planning</span>
            </button>
        </div>
    </Card>
);

const PlanningTable: React.FC<any> = ({ plans, dies, profiles, onEdit, onDelete }) => (
    <div className="overflow-x-auto bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm">
        <table className="w-full text-sm text-left">
            <thead className="text-[10px] text-gray-400 dark:text-gray-500 uppercase tracking-widest bg-gray-50/50 dark:bg-gray-900/50 border-b dark:border-gray-700">
                <tr>
                    <th className="px-6 py-4 font-black">Date / Shift</th>
                    <th className="px-6 py-4 font-black">Machine</th>
                    <th className="px-6 py-4 font-black">Dies / Profiles</th>
                    <th className="px-6 py-4 text-right font-black">Target (Lengths)</th>
                    <th className="px-6 py-4 text-center font-black">Status</th>
                    <th className="px-6 py-4 text-right font-black">Actions</th>
                </tr>
            </thead>
            <tbody className="divide-y dark:divide-gray-700">
                {(!plans || plans.length === 0) ? (
                    <tr><td colSpan={6} className="px-6 py-12 text-center text-gray-400 font-medium italic">No production plans scheduled.</td></tr>
                ) : (
                    plans.map((plan: any) => {
                        const planDieIds = plan.dieIds || (plan.dieId ? [plan.dieId] : []);
                        const planDies = planDieIds.map((id: string) => dies.find((d: any) => d.id === id)).filter(Boolean);
                        const machineNo = plan.machineNo || plan.machine || 'EXT-01';
                        const targetLengths = plan.targetLengths !== undefined ? plan.targetLengths : (plan.targetLength || 0);
                        const planDate = plan.date ? (isNaN(new Date(plan.date).getTime()) ? plan.date : new Date(plan.date + (plan.date.includes('T') ? '' : 'T00:00:00')).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })) : 'N/A';
                        
                        return (
                            <tr key={plan.id} className="hover:bg-gray-50 dark:hover:bg-gray-900/30 transition-all">
                                <td className="px-6 py-4">
                                    <div className="flex flex-col">
                                        <span className="font-black text-gray-900 dark:text-white text-xs">{planDate}</span>
                                        <span className="text-[10px] font-bold text-blue-600 uppercase">({plan.shift || 'A'}) Shift</span>
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    <span className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded-lg text-[10px] font-black text-gray-600 dark:text-gray-400 uppercase tracking-tighter">{machineNo}</span>
                                </td>
                                <td className="px-6 py-4">
                                    <div className="flex flex-col gap-1">
                                        {planDies.map((die: any) => {
                                            const profile = profiles.find((p: any) => p.id === die?.profileId);
                                            return (
                                                <div key={die?.id || Math.random()} className="flex flex-col">
                                                    <span className="font-bold text-gray-800 dark:text-gray-200 text-xs">{die?.dieNo || 'Unknown Die'}</span>
                                                    <span className="text-[10px] text-gray-500">{profile?.name || 'Unknown Profile'}</span>
                                                </div>
                                            );
                                        })}
                                        {planDies.length === 0 && <span className="text-xs text-gray-400 italic">No dies selected</span>}
                                    </div>
                                </td>
                                <td className="px-6 py-4 text-right font-mono text-xs font-black text-gray-900 dark:text-white">
                                    {Number(targetLengths || 0).toLocaleString()}
                                </td>
                                <td className="px-6 py-4 text-center">
                                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-tighter ${
                                        plan.status === 'COMPLETED' ? 'bg-green-100 text-green-800' : 
                                        plan.status === 'IN_PROGRESS' ? 'bg-blue-100 text-blue-800' : 
                                        'bg-yellow-100 text-yellow-800'
                                    }`}>
                                        {(plan.status || 'PENDING').replace('_', ' ')}
                                    </span>
                                </td>
                                <td className="px-6 py-4 text-right">
                                    <div className="flex justify-end gap-1">
                                        <button onClick={() => onEdit(plan)} className="p-2 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-all"><Edit2 className="w-4 h-4" /></button>
                                        <button onClick={() => onDelete(plan.id)} className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-all"><Trash2 className="w-4 h-4" /></button>
                                    </div>
                                </td>
                            </tr>
                        );
                    })
                )}
            </tbody>
        </table>
    </div>
);

const MonthlyAnalysis: React.FC<any> = ({ profiles, transactions, month }) => {
    const analysisData = useMemo(() => {
        const startOfMonth = new Date(month + '-01');
        const endOfMonth = new Date(startOfMonth.getFullYear(), startOfMonth.getMonth() + 1, 0);
        
        return profiles.map((p: any) => {
            const monthTxs = transactions.filter((t: any) => {
                const d = new Date(t.date);
                return d >= startOfMonth && d <= endOfMonth && t.profileId === p.id;
            });

            const openingStock = transactions
                .filter((t: any) => new Date(t.date) < startOfMonth && t.profileId === p.id)
                .reduce((acc: number, t: any) => {
                    if (t.type === 'PRODUCTION' || t.type === 'RETURN') return acc + t.quantity;
                    return acc - t.quantity;
                }, p.initialStock || 0);

            const production = monthTxs.filter((t: any) => t.type === 'PRODUCTION').reduce((acc: number, t: any) => acc + t.quantity, 0);
            const dispatch = monthTxs.filter((t: any) => t.type === 'DISPATCH').reduce((acc: number, t: any) => acc + t.quantity, 0);
            const scrap = monthTxs.filter((t: any) => t.type === 'SCRAP').reduce((acc: number, t: any) => acc + t.quantity, 0);
            const closingStock = openingStock + production - dispatch - scrap;

            return {
                ...p,
                openingStock,
                production,
                dispatch,
                scrap,
                closingStock
            };
        });
    }, [profiles, transactions, month]);

    const exportToExcel = () => {
        const data = analysisData.map(d => ({
            'SKU': d.sku,
            'Name': d.name,
            'Brand': d.brand,
            'Opening Stock': d.openingStock,
            'Production (+)': d.production,
            'Dispatch (-)': d.dispatch,
            'Scrap (-)': d.scrap,
            'Closing Stock': d.closingStock
        }));
        
        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Monthly Analysis");
        XLSX.writeFile(wb, `Stock_Analysis_${month}.xlsx`);
    };

    return (
        <div className="space-y-4">
            <div className="flex justify-end">
                <button 
                    onClick={exportToExcel}
                    className="px-4 py-2 bg-green-600 text-white rounded-xl text-[10px] font-black uppercase tracking-tighter hover:bg-green-700 transition-all flex items-center gap-2"
                >
                    <CloudUploadIcon className="w-4 h-4" /> Export to Excel
                </button>
            </div>
            <div className="overflow-x-auto bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm">
            <table className="w-full text-sm text-left">
                <thead className="text-[10px] text-gray-400 dark:text-gray-500 uppercase tracking-widest bg-gray-50/50 dark:bg-gray-900/50 border-b dark:border-gray-700">
                    <tr>
                        <th className="px-6 py-4 font-black">Profile SKU</th>
                        <th className="px-6 py-4 text-right font-black">Opening</th>
                        <th className="px-6 py-4 text-right font-black">Production (+)</th>
                        <th className="px-6 py-4 text-right font-black">Dispatch (-)</th>
                        <th className="px-6 py-4 text-right font-black">Scrap (-)</th>
                        <th className="px-6 py-4 text-right font-black">Closing</th>
                    </tr>
                </thead>
                <tbody className="divide-y dark:divide-gray-700">
                    {analysisData.map((data: any) => (
                        <tr key={data.id} className="hover:bg-gray-50 dark:hover:bg-gray-900/30 transition-all">
                            <td className="px-6 py-4">
                                <div className="flex flex-col">
                                    <span className="font-black text-gray-900 dark:text-white text-xs font-mono">{data.sku}</span>
                                    <span className="text-[10px] text-gray-500">{data.name}</span>
                                </div>
                            </td>
                            <td className="px-6 py-4 text-right font-mono text-xs font-bold text-gray-500">{data.openingStock}</td>
                            <td className="px-6 py-4 text-right font-mono text-xs font-black text-green-600">+{data.production}</td>
                            <td className="px-6 py-4 text-right font-mono text-xs font-black text-red-600">-{data.dispatch}</td>
                            <td className="px-6 py-4 text-right font-mono text-xs font-black text-orange-600">-{data.scrap}</td>
                            <td className="px-6 py-4 text-right font-mono text-sm font-black text-blue-600 bg-blue-50/30 dark:bg-blue-900/10">{data.closingStock}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
            </div>
        </div>
    );
};

const ProductionPlanModal: React.FC<any> = ({ 
    isOpen, 
    onClose, 
    plan, 
    dies, 
    profiles, 
    onSave, 
    addToast, 
    brands, 
    addDie,
    machines = ['Machine 1', 'Machine 2', 'Machine 3', 'Machine 4', 'Machine 5', 'Machine 6', 'Line 1 (Twin Screw)', 'Line 2 (Single Screw)'],
    addMachine,
    deleteMachine,
    addProfile
}) => {
    const defaultMachine = (machines && machines.length > 0) ? machines[0] : 'Machine 1';
    const [form, setForm] = useState({
        date: new Date().toISOString().split('T')[0],
        shift: 'A',
        machineNo: defaultMachine,
        dieIds: [] as string[],
        targetLengths: 500,
        status: 'PENDING',
        notes: ''
    });
    const [brandFilter, setBrandFilter] = useState('All');
    
    // Machine state
    const [isAddingMachine, setIsAddingMachine] = useState(false);
    const [newMachineName, setNewMachineName] = useState('');

    // Die state
    const [isAddingDie, setIsAddingDie] = useState(false);
    const [isAddingProfileInDie, setIsAddingProfileInDie] = useState(false);

    const [newDieForm, setNewDieForm] = useState({
        dieNo: '',
        brand: '',
        profileId: '',
        cavities: 1,
        expectedOutputKgHr: 120,
        lifespanMeters: 50000,
        status: 'ACTIVE'
    });

    const [newProfileForm, setNewProfileForm] = useState({
        sku: '',
        name: '',
        brand: '',
        profileType: 'WINDOW',
        uom: 'PCS',
        length: 5.9,
        weight: 4.89,
        piecesPerPacket: 6,
        price: 150,
        hsnCode: '391620'
    });

    useEffect(() => {
        if (plan) {
            const dieIds = plan.dieIds || (plan.dieId ? [plan.dieId] : []);
            setForm({
                date: plan.date || new Date().toISOString().split('T')[0],
                shift: plan.shift || 'A',
                machineNo: plan.machineNo || plan.machine || defaultMachine,
                dieIds: dieIds,
                targetLengths: plan.targetLengths !== undefined ? plan.targetLengths : (plan.targetLength || 500),
                status: plan.status || 'PENDING',
                notes: plan.notes || ''
            });
        } else {
            setForm({
                date: new Date().toISOString().split('T')[0],
                shift: 'A',
                machineNo: defaultMachine,
                dieIds: [],
                targetLengths: 500,
                status: 'PENDING',
                notes: ''
            });
        }
        setIsAddingDie(false);
        setIsAddingMachine(false);
        setIsAddingProfileInDie(false);
    }, [plan, isOpen, machines]);

    if (!isOpen) return null;

    const availableMachines = (machines && machines.length > 0) 
        ? machines 
        : ['Machine 1', 'Machine 2', 'Machine 3', 'Machine 4', 'Machine 5', 'Machine 6'];

    const filteredDies = brandFilter === 'All' ? dies : dies.filter((d: any) => d.brand === brandFilter);

    const handleAddNewMachine = (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        const trimmed = newMachineName.trim();
        if (!trimmed) return addToast('Please enter a machine or line name', 'error');
        if (addMachine) {
            addMachine(trimmed);
        }
        setForm(prev => ({ ...prev, machineNo: trimmed }));
        setNewMachineName('');
        setIsAddingMachine(false);
        addToast(`Machine "${trimmed}" added and selected!`, 'success');
    };

    const handleCreateProfileInDie = (e: React.FormEvent) => {
        e.preventDefault();
        if (!newProfileForm.name.trim()) return addToast('Please enter a Profile / Item Name', 'error');
        const generatedSku = newProfileForm.sku.trim() || `PRF-${Date.now().toString().slice(-4)}`;
        const newProfile = {
            id: `p-${Date.now()}`,
            sku: generatedSku,
            name: newProfileForm.name.trim(),
            brand: newProfileForm.brand || newDieForm.brand || (brandFilter !== 'All' ? brandFilter : brands[0] || 'RAVIRAJA'),
            profileType: newProfileForm.profileType as 'WINDOW' | 'REINFORCEMENT',
            uom: newProfileForm.uom || 'PCS',
            length: Number(newProfileForm.length) || 5.9,
            weight: Number(newProfileForm.weight) || 0,
            piecesPerPacket: Number(newProfileForm.piecesPerPacket) || 1,
            price: Number(newProfileForm.price) || 0,
            hsnCode: newProfileForm.hsnCode || '391620',
            reorderPoint: 50,
            initialStock: 0,
                    };
        if (addProfile) {
            addProfile(newProfile);
        }
        setNewDieForm(prev => ({ ...prev, profileId: newProfile.id, brand: newProfile.brand }));
        setIsAddingProfileInDie(false);
        addToast(`New profile "${newProfile.name}" created and linked!`, 'success');
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (form.dieIds.length === 0) return addToast('Please select at least one die', 'error');
        onSave({ 
            ...form, 
            targetLengths: Number(form.targetLengths) || 500,
            targetLength: Number(form.targetLengths) || 500,
            machineNo: form.machineNo,
            machine: form.machineNo
        });
    };

    const toggleDie = (dieId: string) => {
        setForm(prev => ({
            ...prev,
            dieIds: prev.dieIds.includes(dieId) 
                ? prev.dieIds.filter(id => id !== dieId)
                : [...prev.dieIds, dieId]
        }));
    };

    const handleCreateDie = (e: React.FormEvent) => {
        e.preventDefault();
        if (!newDieForm.dieNo.trim()) return addToast('Please enter a Die Number', 'error');
        if (!newDieForm.profileId) return addToast('Please select an Associated Profile', 'error');

        const newId = `die-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
        const createdDie = {
            id: newId,
            dieNo: newDieForm.dieNo.trim(),
            brand: newDieForm.brand || (brandFilter !== 'All' ? brandFilter : brands[0] || 'RAVIRAJA'),
            profileId: newDieForm.profileId,
            cavities: Number(newDieForm.cavities) || 1,
            expectedOutputKgHr: Number(newDieForm.expectedOutputKgHr) || 0,
            lifespanMeters: Number(newDieForm.lifespanMeters) || 0,
            status: newDieForm.status || 'ACTIVE',
                    };

        if (addDie) {
            addDie(createdDie);
        }

        // Auto-select the newly created die in the production plan
        setForm(prev => ({
            ...prev,
            dieIds: Array.from(new Set([...prev.dieIds, newId]))
        }));

        setIsAddingDie(false);
        addToast(`Die "${createdDie.dieNo}" created and selected in plan!`, 'success');
    };

    const inputClass = "w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 p-2.5 rounded-xl text-sm dark:text-white outline-none focus:ring-2 focus:ring-blue-500 transition-all";
    const labelClass = "text-[10px] font-black uppercase text-gray-500 mb-1.5 block tracking-widest";

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 z-[200] flex justify-center items-center p-4 backdrop-blur-sm" onClick={onClose}>
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border dark:border-gray-700 max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
                <div className="px-6 py-4 bg-gray-900 text-white flex justify-between items-center shrink-0">
                    <h2 className="text-lg font-black uppercase tracking-tighter">{plan ? 'Edit' : 'Create'} Production Plan</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-white text-2xl font-bold">&times;</button>
                </div>
                <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto flex-1">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className={labelClass}>Date</label>
                            <input type="date" value={form.date} onChange={e => setForm({...form, date: e.target.value})} className={inputClass} required />
                        </div>
                        <div>
                            <label className={labelClass}>Shift</label>
                            <select value={form.shift} onChange={e => setForm({...form, shift: e.target.value})} className={inputClass}>
                                <option value="DAY">Day Shift</option>
                                <option value="NIGHT">Night Shift</option>
                            </select>
                        </div>
                    </div>

                    {/* Machine Management Section */}
                    <div>
                        <div className="flex justify-between items-center mb-1">
                            <label className={labelClass}>Machine Number / Extrusion Line</label>
                            <button
                                type="button"
                                onClick={() => setIsAddingMachine(!isAddingMachine)}
                                className="text-[10px] font-black text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 flex items-center gap-1 bg-blue-50 dark:bg-blue-900/40 px-2.5 py-0.5 rounded-lg border border-blue-200 dark:border-blue-800 active:scale-95 transition-all"
                            >
                                <Plus className="w-3 h-3" /> {isAddingMachine ? "Hide" : "+ Add Machine"}
                            </button>
                        </div>

                        {/* Inline Add Machine Box */}
                        {isAddingMachine && (
                            <div className="p-3 bg-blue-50/80 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 rounded-xl mb-2 space-y-2">
                                <span className="text-[10px] font-black uppercase text-blue-800 dark:text-blue-300 tracking-wider flex items-center gap-1">
                                    <Plus className="w-3 h-3 text-blue-600" /> New Machine Name / Line ID
                                </span>
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        value={newMachineName}
                                        onChange={e => setNewMachineName(e.target.value)}
                                        placeholder="e.g. Machine 7 or Line 3 (Twin Screw)"
                                        className="flex-1 text-xs p-2 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => handleAddNewMachine()}
                                        className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black uppercase tracking-wider active:scale-95 transition-all shrink-0"
                                    >
                                        + Add & Select
                                    </button>
                                </div>
                            </div>
                        )}

                        <select 
                            value={form.machineNo} 
                            onChange={e => {
                                if (e.target.value === '__ADD_MACHINE__') {
                                    setIsAddingMachine(true);
                                } else {
                                    setForm({...form, machineNo: e.target.value});
                                }
                            }} 
                            className={inputClass}
                        >
                            {availableMachines.map(m => (
                                <option key={m} value={m}>
                                    {m.startsWith('Machine') || m.startsWith('Line') ? m : `Machine ${m}`}
                                </option>
                            ))}
                            <option value="__ADD_MACHINE__">+ Add New Machine...</option>
                        </select>
                    </div>

                    {/* Die Selection & Inline Creation Section */}
                    <div className="space-y-2">
                        <div className="flex justify-between items-center">
                            <label className={labelClass}>Select Dies (Multiple Allowed)</label>
                            <button 
                                type="button"
                                onClick={() => {
                                    setNewDieForm({
                                        dieNo: '',
                                        brand: brandFilter !== 'All' ? brandFilter : (brands[0] || 'RAVIRAJA'),
                                        profileId: profiles[0]?.id || '',
                                        cavities: 1,
                                        expectedOutputKgHr: 120,
                                        lifespanMeters: 50000,
                                        status: 'ACTIVE'
                                    });
                                    setIsAddingDie(!isAddingDie);
                                }}
                                className="text-[10px] font-black text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 flex items-center gap-1 bg-blue-50 dark:bg-blue-900/40 px-2.5 py-1 rounded-lg border border-blue-200 dark:border-blue-800 active:scale-95 transition-all"
                            >
                                <Plus className="w-3 h-3" /> {isAddingDie ? "Hide Die Form" : "+ Add Die Option"}
                            </button>
                        </div>

                        {/* Inline Create Die Sub-card */}
                        {isAddingDie && (
                            <div className="p-3.5 bg-blue-50/70 dark:bg-blue-950/40 border-2 border-blue-200 dark:border-blue-800 rounded-2xl space-y-3 mb-2 animate-fadeIn shadow-sm">
                                <div className="flex justify-between items-center">
                                    <span className="text-[11px] font-black uppercase text-blue-800 dark:text-blue-300 tracking-wider flex items-center gap-1.5">
                                        <Plus className="w-3.5 h-3.5 text-blue-600" /> Create & Add New Die
                                    </span>
                                    <button 
                                        type="button" 
                                        onClick={() => setIsAddingDie(false)}
                                        className="text-xs font-bold text-gray-400 hover:text-gray-600"
                                    >
                                        ✕
                                    </button>
                                </div>
                                <div className="grid grid-cols-2 gap-2.5">
                                    <div>
                                        <label className="text-[9px] font-black uppercase text-gray-500 mb-1 block">Die No / Code</label>
                                        <input 
                                            value={newDieForm.dieNo}
                                            onChange={e => setNewDieForm({...newDieForm, dieNo: e.target.value})}
                                            placeholder="e.g. DIE-SF-03"
                                            className="w-full text-xs p-2 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[9px] font-black uppercase text-gray-500 mb-1 block">Brand</label>
                                        <select 
                                            value={newDieForm.brand}
                                            onChange={e => setNewDieForm({...newDieForm, brand: e.target.value})}
                                            className="w-full text-xs p-2 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                                        >
                                            {brands.map((b: string) => <option key={b} value={b}>{b}</option>)}
                                        </select>
                                    </div>
                                </div>

                                {/* Associated Profile in Die Form */}
                                <div>
                                    <div className="flex justify-between items-center mb-1">
                                        <label className="text-[9px] font-black uppercase text-gray-500 block">Associated Profile / Item</label>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setNewProfileForm({
                                                    sku: '',
                                                    name: '',
                                                    brand: newDieForm.brand || brands[0] || 'RAVIRAJA',
                                                    profileType: 'WINDOW',
                                                    uom: 'PCS',
                                                    length: 5.9,
                                                    weight: 4.89,
                                                    piecesPerPacket: 6,
                                                    price: 150,
                                                    hsnCode: '391620'
                                                });
                                                setIsAddingProfileInDie(!isAddingProfileInDie);
                                            }}
                                            className="text-[9px] font-black text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 flex items-center gap-0.5"
                                        >
                                            <Plus className="w-2.5 h-2.5" /> {isAddingProfileInDie ? "Hide" : "+ New Profile"}
                                        </button>
                                    </div>

                                    {isAddingProfileInDie && (
                                        <div className="p-2.5 bg-indigo-50/80 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 rounded-xl space-y-2 mb-2">
                                            <div className="grid grid-cols-2 gap-2">
                                                <div>
                                                    <label className="text-[8px] font-black uppercase text-gray-500 block">SKU Code</label>
                                                    <input
                                                        value={newProfileForm.sku}
                                                        onChange={e => setNewProfileForm({...newProfileForm, sku: e.target.value})}
                                                        placeholder="e.g. PRF-SF-60"
                                                        className="w-full text-xs p-1.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="text-[8px] font-black uppercase text-gray-500 block">Profile Name</label>
                                                    <input
                                                        value={newProfileForm.name}
                                                        onChange={e => setNewProfileForm({...newProfileForm, name: e.target.value})}
                                                        placeholder="e.g. Sliding Sash 60mm"
                                                        className="w-full text-xs p-1.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                                                    />
                                                </div>
                                            </div>
                                            <div className="flex justify-end">
                                                <button
                                                    type="button"
                                                    onClick={handleCreateProfileInDie}
                                                    className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[10px] font-black uppercase tracking-wider"
                                                >
                                                    + Save Profile
                                                </button>
                                            </div>
                                        </div>
                                    )}

                                    <select 
                                        value={newDieForm.profileId} 
                                        onChange={e => {
                                            if (e.target.value === '__ADD_PROFILE__') {
                                                setIsAddingProfileInDie(true);
                                            } else {
                                                setNewDieForm({...newDieForm, profileId: e.target.value});
                                            }
                                        }} 
                                        className="w-full text-xs p-2 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                                    >
                                        <option value="">-- Choose Profile --</option>
                                        {profiles.filter((p: any) => !newDieForm.brand || p.brand === newDieForm.brand).map((p: any) => (
                                            <option key={p.id} value={p.id}>{p.name} ({p.sku}) {p.brand ? `[${p.brand}]` : ''}</option>
                                        ))}
                                        {newDieForm.brand && profiles.filter((p: any) => p.brand !== newDieForm.brand).length > 0 && (
                                            <optgroup label="Other Brands">
                                                {profiles.filter((p: any) => p.brand !== newDieForm.brand).map((p: any) => (
                                                    <option key={p.id} value={p.id}>{p.name} ({p.sku}) [{p.brand}]</option>
                                                ))}
                                            </optgroup>
                                        )}
                                        <option value="__ADD_PROFILE__" className="font-bold text-blue-600 dark:text-blue-400">+ Create New Profile / Item...</option>
                                    </select>
                                </div>

                                <div className="grid grid-cols-2 gap-2.5">
                                    <div>
                                        <label className="text-[9px] font-black uppercase text-gray-500 mb-1 block">Cavities</label>
                                        <input 
                                            type="number" 
                                            value={newDieForm.cavities} 
                                            onChange={e => setNewDieForm({...newDieForm, cavities: Number(e.target.value)})} 
                                            className="w-full text-xs p-2 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white outline-none" 
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[9px] font-black uppercase text-gray-500 mb-1 block">Output (Kg/Hr)</label>
                                        <input 
                                            type="number" 
                                            value={newDieForm.expectedOutputKgHr} 
                                            onChange={e => setNewDieForm({...newDieForm, expectedOutputKgHr: Number(e.target.value)})} 
                                            className="w-full text-xs p-2 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white outline-none" 
                                        />
                                    </div>
                                </div>
                                <div className="flex justify-end gap-2 pt-1 border-t border-blue-200 dark:border-blue-800">
                                    <button 
                                        type="button" 
                                        onClick={() => setIsAddingDie(false)} 
                                        className="px-3 py-1.5 text-xs font-bold text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                                    >
                                        Cancel
                                    </button>
                                    <button 
                                        type="button" 
                                        onClick={handleCreateDie} 
                                        className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-sm transition-all active:scale-95"
                                    >
                                        + Save & Select Die
                                    </button>
                                </div>
                            </div>
                        )}

                        <div className="flex items-center gap-2 mb-2">
                            <select 
                                value={brandFilter} 
                                onChange={(e) => setBrandFilter(e.target.value)} 
                                className={`${inputClass} bg-gray-50 dark:bg-gray-900 font-bold text-xs`}
                            >
                                <option value="All">All Brands</option>
                                {brands.map((b: string) => <option key={b} value={b}>{b}</option>)}
                            </select>
                        </div>

                        <div className="max-h-40 overflow-y-auto border dark:border-gray-700 rounded-xl p-2 space-y-1 bg-gray-50 dark:bg-gray-900/50">
                            {filteredDies.map((d: any) => {
                                const profile = profiles.find((p: any) => p.id === d.profileId);
                                return (
                                    <label key={d.id} className="flex items-center gap-3 p-2 hover:bg-white dark:hover:bg-gray-800 rounded-lg cursor-pointer transition-all">
                                        <input 
                                            type="checkbox" 
                                            checked={form.dieIds.includes(d.id)} 
                                            onChange={() => toggleDie(d.id)} 
                                            className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" 
                                        />
                                        <div className="flex flex-col">
                                            <span className="text-xs font-black text-gray-900 dark:text-white">{d.dieNo}</span>
                                            <span className="text-[10px] text-gray-500">{profile?.name || 'Unknown Profile'} {d.brand ? `(${d.brand})` : ''}</span>
                                        </div>
                                    </label>
                                );
                            })}
                            {filteredDies.length === 0 && <div className="text-center py-4 text-xs text-gray-400 italic">No dies found for this brand. Click "+ Add Die Option" to create one.</div>}
                        </div>
                    </div>

                    <div>
                        <label className={labelClass}>Target Length (Lengths)</label>
                        <input type="number" value={form.targetLengths} onChange={e => setForm({...form, targetLengths: +e.target.value})} className={inputClass} required placeholder="e.g. 500" />
                    </div>
                    <div>
                        <label className={labelClass}>Status</label>
                        <select value={form.status} onChange={e => setForm({...form, status: e.target.value})} className={inputClass}>
                            <option value="PENDING">Pending</option>
                            <option value="IN_PROGRESS">In Progress</option>
                            <option value="COMPLETED">Completed</option>
                        </select>
                    </div>
                    <div className="flex justify-end gap-3 pt-4 border-t dark:border-gray-700 shrink-0">
                        <button type="button" onClick={onClose} className="px-6 py-2.5 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-black uppercase tracking-widest text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all">Cancel</button>
                        <button type="submit" className="px-8 py-2.5 bg-blue-600 text-white rounded-xl text-xs font-black uppercase tracking-widest shadow-lg shadow-blue-500/20 hover:bg-blue-700 transition-all">Save Plan</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

// --- TABLE SUB-COMPONENTS ---
const StockTable: React.FC<any> = ({ stockData, onEditProfile, onAddStock, onDeleteProfile, getBrandBadge, updateProfile }) => (
    <div className="overflow-x-auto shadow-xl rounded-xl">
        <table className="w-full text-[9px] border-collapse border border-black text-center dark:border-gray-600 bg-white dark:bg-gray-800">
            <thead className="bg-gray-100 dark:bg-gray-900 uppercase font-black tracking-tighter">
                <tr className="border-b-2 border-black dark:border-gray-600">
                    <th className="border-r border-black dark:border-gray-600 p-2 w-16">CODE</th>
                    <th className="border-r border-black dark:border-gray-600 p-2 text-left px-4">DESCRIPTION</th>
                    <th className="border-r border-black dark:border-gray-600 p-2">BRAND</th>
                    <th className="border-r border-black dark:border-gray-600 p-2">UOM</th>
                    <th className="border-r border-black dark:border-gray-600 p-2">L/PKT</th>
                    <th className="border-r border-black dark:border-gray-600 p-2">EACH L.</th>
                    <th className="border-r border-black dark:border-gray-600 p-2">LEN WT</th>
                    <th className="border-r border-black dark:border-gray-600 p-2 italic text-[7px] text-gray-500">MTR WT</th>
                    <th className="border-r border-black dark:border-gray-600 p-2 text-red-600 bg-red-50 dark:bg-red-900/10 w-20">REORDER</th>
                    <th className="border-r border-black dark:border-gray-600 p-2 bg-blue-50 dark:bg-blue-900/20 text-blue-800 dark:text-blue-200">RECEIVED</th>
                    <th className="border-r border-black dark:border-gray-600 p-2 bg-yellow-50 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-200">STOCK</th>
                    <th className="border-r border-black dark:border-gray-600 p-2">STATUS</th>
                    <th className="p-2 no-print">ACTION</th>
                </tr>
            </thead>
            <tbody className="divide-y divide-black dark:divide-gray-600">
                {stockData.map((p: any) => {
                    const isLow = p.currentStock < (p.reorderPoint || 0);
                    const meterWeight = (p.weight && p.length) ? (p.weight / p.length).toFixed(3) : '-';
                    
                    return (
                        <tr key={p.id} className={`group hover:bg-yellow-50/10 transition-colors ${isLow ? 'bg-red-50/20' : ''}`}>
                            <td className="border-r border-black dark:border-gray-600 p-2 font-mono font-black">{p.sku}</td>
                            <td className="border-r border-black dark:border-gray-600 p-2 text-left px-4 font-bold uppercase">{p.name}</td>
                            <td className="border-r border-black dark:border-gray-600 p-2 text-[8px]">{p.brand}</td>
                            <td className="border-r border-black dark:border-gray-600 p-2 uppercase">{p.uom}</td>
                            <td className="border-r border-black dark:border-gray-600 p-2 font-mono">{p.piecesPerPacket || '-'}</td>
                            <td className="border-r border-black dark:border-gray-600 p-2 font-mono">{p.length ? `${p.length}m` : '-'}</td>
                            <td className="border-r border-black dark:border-gray-600 p-2 font-mono">{p.weight ? `${p.weight}kg` : '-'}</td>
                            <td className="border-r border-black dark:border-gray-600 p-2 font-mono italic">{meterWeight}</td>
                            <td className="border-r border-black dark:border-gray-600 p-2 font-mono font-black text-red-600 bg-red-50/10">
                                <input 
                                    type="number"
                                    defaultValue={p.reorderPoint || 0}
                                    onBlur={(e) => {
                                        const val = parseInt(e.target.value);
                                        if (!isNaN(val) && val !== p.reorderPoint) {
                                            updateProfile({ ...p, reorderPoint: val });
                                        }
                                    }}
                                    className="w-full bg-transparent border-none text-center focus:ring-0 focus:outline-none"
                                />
                            </td>
                            <td className="border-r border-black dark:border-gray-600 p-2 font-black text-blue-600 font-mono italic bg-blue-50/10">{p.movement.production}</td>
                            <td className={`border-r border-black dark:border-gray-600 p-2 font-black font-mono text-xs ${isLow ? 'text-red-600 underline decoration-double' : 'text-gray-900 dark:text-white'}`}>
                                {p.currentStock}
                            </td>
                            <td className="border-r border-black dark:border-gray-600 p-2">
                                <span className={`px-1.5 py-0.5 rounded text-[7px] font-black uppercase tracking-tighter ${
                                    isLow ? 'bg-red-600 text-white' : 'bg-green-600 text-white'
                                }`}>
                                    {isLow ? 'LOW' : 'OK'}
                                </span>
                            </td>
                            <td className="p-2 no-print">
                                <div className="flex items-center justify-center gap-1">
                                    <button 
                                        onClick={() => onAddStock?.(p)} 
                                        title="Quick Stock In"
                                        className="p-1 hover:bg-green-100 dark:hover:bg-green-900/30 rounded transition-colors"
                                    >
                                        <Plus className="w-3 h-3 text-green-600" />
                                    </button>
                                    <button 
                                        onClick={() => onEditProfile?.(p)} 
                                        className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                                    >
                                        <Edit2 className="w-3 h-3 text-blue-500" />
                                    </button>
                                    <button 
                                        onClick={() => { if(confirm('Are you sure you want to delete this profile?')) onDeleteProfile?.(p.id); }} 
                                        className="p-1 hover:bg-red-100 dark:hover:bg-red-900/30 rounded transition-colors"
                                    >
                                        <Trash2 className="w-3 h-3 text-red-500" />
                                    </button>
                                </div>
                            </td>
                        </tr>
                    );
                })}
                {stockData.length === 0 && (
                    <tr><td colSpan={12} className="p-8 text-center text-gray-400 font-medium italic uppercase tracking-widest bg-gray-50 dark:bg-gray-900/50">No profiles found matching constraints.</td></tr>
                )}
            </tbody>
        </table>
    </div>
);

const QuotationTable: React.FC<any> = ({ groupedQuotations, onAction, onEdit, onDelete, onPrint, getBrandBadge }) => (
    <div className="overflow-x-auto">
        <table className="w-full text-sm text-left text-gray-600 dark:text-gray-400">
            <thead className="text-[10px] text-gray-400 dark:text-gray-500 uppercase tracking-widest bg-gray-50/50 dark:bg-gray-800/50 border-b dark:border-gray-700">
                <tr>
                    <th className="px-6 py-4 font-black">Brand</th>
                    <th className="px-6 py-4 font-black">Date / Client</th>
                    <th className="px-6 py-4 text-right font-black">Total Value</th>
                    <th className="px-6 py-4 text-center font-black">Resolution</th>
                    <th className="px-6 py-4 text-center font-black">Status</th>
                    <th className="px-6 py-4 text-right no-print font-black">Actions</th>
                </tr>
            </thead>
            <tbody className="divide-y dark:divide-gray-700">
                {groupedQuotations.map((group: any) => (
                    <tr key={group.refNo} className={`group hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-all duration-200 ${group.status === 'CANCELLED' ? 'opacity-50 grayscale' : ''}`}>
                        <td className="px-6 py-4">{getBrandBadge(group.brand)}</td>
                        <td className="px-6 py-4">
                            <div className="flex flex-col">
                                <span className="text-[10px] font-bold text-gray-400 uppercase">{new Date(group.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</span>
                                <span className="font-black text-gray-900 dark:text-white text-xs">{group.customer}</span>
                                <span className="text-[10px] text-gray-500 font-mono">{group.refNo}</span>
                            </div>
                        </td>
                        <td className="px-6 py-4 text-right font-black text-gray-900 dark:text-white text-xs font-mono">
                            ₹ {(group.totalAmount || 0).toLocaleString('en-IN')}
                        </td>
                        <td className="px-6 py-4 text-center">
                            {group.status === 'PENDING' && (
                                <div className="flex flex-col gap-1 items-center">
                                    <button onClick={() => onAction(group.refNo, 'CONFIRM_DISPATCH')} className="px-3 py-1 rounded-md text-[9px] font-black uppercase bg-green-50 text-green-700 border border-green-100 hover:bg-green-100 transition-all w-28">Confirm Out</button>
                                    <button onClick={() => onAction(group.refNo, 'CONFIRM_RETURN')} className="px-3 py-1 rounded-md text-[9px] font-black uppercase bg-orange-50 text-orange-700 border border-orange-100 hover:bg-orange-100 transition-all w-28">Reverse In</button>
                                </div>
                            )}
                            {group.status === 'COMPLETED' && (
                                <button onClick={() => onAction(group.refNo, 'CANCEL')} className="px-3 py-1 rounded-md text-[9px] font-black uppercase bg-red-50 text-red-600 border border-red-100 hover:bg-red-100 transition-all">Rollback</button>
                            )}
                        </td>
                        <td className="px-6 py-4 text-center">
                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-tighter ${
                                group.status === 'COMPLETED' ? 'bg-green-100 text-green-800' : 
                                group.status === 'CANCELLED' ? 'bg-red-100 text-red-800' : 
                                'bg-yellow-100 text-yellow-800'
                            }`}>
                                {group.status}
                            </span>
                        </td>
                        <td className="px-6 py-4 text-right no-print whitespace-nowrap">
                            <div className="flex justify-end gap-1">
                                <button onClick={() => onPrint(group)} className="p-2 text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-all">
                                    <History className="w-4 h-4" />
                                </button>
                                <button onClick={() => onEdit(group.refNo)} className="p-2 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-all">
                                    <Edit2 className="w-4 h-4" />
                                </button>
                                <button onClick={() => onDelete(group.refNo)} className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-all">
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        </td>
                    </tr>
                ))}
            </tbody>
        </table>
    </div>
);

const ProfileListTable: React.FC<any> = ({ profiles, onEdit, onDelete, getBrandBadge, updateProfile }) => (
    <div className="overflow-x-auto shadow-xl rounded-xl">
        <table className="w-full text-[9px] border-collapse border border-black text-center dark:border-gray-600 bg-white dark:bg-gray-800">
            <thead className="bg-[#1e293b] text-white uppercase font-black tracking-tighter">
                <tr className="border-b border-black">
                    <th className="border-r border-black p-2 w-12">TYPE</th>
                    <th className="border-r border-black p-2 w-20">CODE (SKU)</th>
                    <th className="border-r border-black p-2 text-left px-4">DESCRIPTION</th>
                    <th className="border-r border-black p-2 w-16">HSN</th>
                    <th className="border-r border-black p-2">BRAND</th>
                    <th className="border-r border-black p-2">UOM</th>
                    <th className="border-r border-black p-2">EACH L.</th>
                    <th className="border-r border-black p-2">L/PKT</th>
                    <th className="border-r border-black p-2">LEN WT</th>
                    <th className="border-r border-black p-2">MTR WT</th>
                    <th className="border-r border-black p-2 bg-blue-900 text-blue-100 min-w-[130px]">TOP / RIGHT FILM</th>
                    <th className="border-r border-black p-2 bg-indigo-900 text-indigo-100 min-w-[130px]">BOTTOM / LEFT FILM</th>
                    <th className="border-r border-black p-2 text-red-100 w-20">MIN STOCK</th>
                    <th className="border-r border-black p-2 bg-yellow-900">PRICE/PC</th>
                    <th className="p-2 no-print">ACTIONS</th>
                </tr>
            </thead>
            <tbody className="divide-y divide-black dark:divide-gray-600">
                {profiles.map((p: any) => (
                    <tr key={p.id} className="group hover:bg-gray-50 transition-colors">
                        <td className="border-r border-black p-2">
                             <span className={`px-1 py-0.5 rounded text-[7px] font-black ${p.profileType === 'REINFORCEMENT' ? 'bg-orange-100 text-orange-800' : 'bg-blue-100 text-blue-800'}`}>
                                {p.profileType === 'REINFORCEMENT' ? 'REINF' : 'WIN'}
                             </span>
                        </td>
                        <td className="border-r border-black p-2 font-mono font-black">{p.sku}</td>
                        <td className="border-r border-black p-2 text-left px-4 font-bold uppercase">{p.name}</td>
                        <td className="border-r border-black p-2 font-mono">{p.hsnCode || '-'}</td>
                        <td className="border-r border-black p-2 text-[8px]">{p.brand}</td>
                        <td className="border-r border-black p-2 uppercase">{p.uom}</td>
                        <td className="border-r border-black p-2 font-mono">{p.length ? `${p.length}m` : '-'}</td>
                        <td className="border-r border-black p-2 font-mono">{p.piecesPerPacket || '-'}</td>
                        <td className="border-r border-black p-2 font-mono">{p.weight ? `${p.weight}kg` : '-'}</td>
                        <td className="border-r border-black p-2 font-mono">{p.meterWeight ? `${Number(p.meterWeight).toFixed(3)}kg/m` : (p.weight && p.length ? `${(p.weight / p.length).toFixed(3)}kg/m` : '-')}</td>
                        
                        {/* TOP / RIGHT FILM */}
                        <td className="border-r border-black p-1.5 bg-blue-50/20">
                            <div className="flex flex-col gap-1">
                                <div className="flex items-center gap-1">
                                    <span className="text-[8px] text-gray-500 font-bold">W:</span>
                                    <input 
                                        type="text"
                                        defaultValue={p.topFilmWidth || '38'}
                                        onBlur={(e) => {
                                            const val = e.target.value;
                                            if (val !== p.topFilmWidth) {
                                                updateProfile({ ...p, topFilmWidth: val });
                                            }
                                        }}
                                        className="w-12 bg-white dark:bg-gray-900 border border-gray-300 rounded text-center text-[9px] font-mono font-bold"
                                        placeholder="38"
                                    />
                                </div>
                                <input 
                                    type="text"
                                    defaultValue={p.topStickerName || ''}
                                    onBlur={(e) => {
                                        const val = e.target.value;
                                        if (val !== p.topStickerName) {
                                            updateProfile({ ...p, topStickerName: val });
                                        }
                                    }}
                                    className="w-full bg-white dark:bg-gray-900 border border-gray-300 rounded px-1 text-[9px]"
                                    placeholder="Top Sticker Name"
                                />
                            </div>
                        </td>

                        {/* BOTTOM / LEFT FILM */}
                        <td className="border-r border-black p-1.5 bg-indigo-50/20">
                            <div className="flex flex-col gap-1">
                                <div className="flex items-center gap-1">
                                    <span className="text-[8px] text-gray-500 font-bold">W:</span>
                                    <input 
                                        type="text"
                                        defaultValue={p.bottomFilmWidth || '38'}
                                        onBlur={(e) => {
                                            const val = e.target.value;
                                            if (val !== p.bottomFilmWidth) {
                                                updateProfile({ ...p, bottomFilmWidth: val });
                                            }
                                        }}
                                        className="w-12 bg-white dark:bg-gray-900 border border-gray-300 rounded text-center text-[9px] font-mono font-bold"
                                        placeholder="38"
                                    />
                                </div>
                                <input 
                                    type="text"
                                    defaultValue={p.bottomStickerName || ''}
                                    onBlur={(e) => {
                                        const val = e.target.value;
                                        if (val !== p.bottomStickerName) {
                                            updateProfile({ ...p, bottomStickerName: val });
                                        }
                                    }}
                                    className="w-full bg-white dark:bg-gray-900 border border-gray-300 rounded px-1 text-[9px]"
                                    placeholder="Bottom Sticker Name"
                                />
                            </div>
                        </td>

                        <td className="border-r border-black p-2 font-black text-red-500">
                             <input 
                                type="number"
                                defaultValue={p.reorderPoint || 0}
                                onBlur={(e) => {
                                    const val = parseInt(e.target.value);
                                    if (!isNaN(val) && val !== p.reorderPoint) {
                                        updateProfile({ ...p, reorderPoint: val });
                                    }
                                }}
                                className="w-full bg-transparent border-none text-center focus:ring-0 focus:outline-none"
                            />
                        </td>
                        <td className="border-r border-black p-2 font-black font-mono text-orange-600 bg-yellow-50/20 italic">₹{p.price?.toLocaleString('en-IN')}</td>
                        <td className="p-2 no-print">
                            <div className="flex justify-center gap-1">
                                <button onClick={() => onEdit(p)} className="p-1 hover:bg-gray-100 rounded transition-all" title="Edit Profile">
                                    <Edit2 className="w-3 h-3 text-blue-500" />
                                </button>
                                <button onClick={() => onDelete(p.id)} className="p-1 hover:bg-red-50 rounded transition-all" title="Delete Profile">
                                    <Trash2 className="w-3 h-3 text-red-500" />
                                </button>
                            </div>
                        </td>
                    </tr>
                ))}
                {profiles.length === 0 && (
                    <tr><td colSpan={15} className="p-8 text-center text-gray-400 font-medium italic uppercase tracking-widest">No profiles found.</td></tr>
                )}
            </tbody>
        </table>
    </div>
);

const CustomerTable: React.FC<any> = ({ customers, onEdit, onDelete }) => (
    <table className="w-full text-sm text-left text-gray-600 dark:text-gray-400">
        <thead className="text-xs text-gray-700 dark:text-gray-300 uppercase bg-gray-50 dark:bg-gray-700"><tr><th className="px-6 py-3">Name</th><th className="px-6 py-3">Phone</th><th className="px-6 py-3 text-right no-print">Actions</th></tr></thead>
        <tbody>
            {customers.map((c: any) => (
                <tr key={c.id} className="border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors">
                    <td className="px-6 py-4 font-bold text-gray-900 dark:text-white flex items-center gap-2"><UserIcon className="w-4 h-4 text-gray-400"/> {c.name}</td><td className="px-6 py-4 font-mono">{c.phone || '-'}</td>
                    <td className="px-6 py-4 text-right space-x-3 no-print"><button onClick={() => onEdit(c)} className="text-blue-500 hover:underline">Edit</button><button onClick={() => onDelete(c.id)} className="text-red-500 hover:underline">Del</button></td>
                </tr>
            ))}
        </tbody>
    </table>
);

// --- UPDATED COMPANY SETTINGS MODAL ---
const CompanySettingsModal: React.FC<any> = ({ isOpen, onClose, settings, updateSettings, brands, addToast }) => {
    const [form, setForm] = useState<CompanySettings>(settings);
    const [selectedBrandForLogo, setSelectedBrandForLogo] = useState<string>(brands[0] || '');
    const [logoScale, setLogoScale] = useState(100);

    useEffect(() => { if(isOpen) setForm(settings); }, [isOpen, settings]);
    if(!isOpen) return null;

    const inputStyle = "w-full border border-gray-300 dark:border-gray-600 p-2.5 rounded-lg dark:bg-gray-700 dark:text-white text-sm outline-none focus:ring-2 focus:ring-blue-500 transition-all";
    const labelStyle = "text-[10px] font-black uppercase text-gray-500 mb-1.5 block tracking-widest";

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, type: 'logo' | 'logoRight', brand?: string) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
            const base64 = event.target?.result as string;
            if (brand) {
                const currentLogos = [...(form.brandLogos || [])];
                const idx = currentLogos.findIndex(bl => bl.brand === brand);
                if (idx > -1) currentLogos[idx] = { ...currentLogos[idx], [type === 'logo' ? 'logoUrl' : 'logoRightUrl']: base64 };
                else currentLogos.push({ brand, logoUrl: type === 'logo' ? base64 : '', logoRightUrl: type === 'logoRight' ? base64 : '' });
                setForm({ ...form, brandLogos: currentLogos });
            } else {
                setForm({ ...form, [type === 'logo' ? 'logoUrl' : 'logoRightUrl']: base64 });
            }
        };
        reader.readAsDataURL(file);
    };

    const handleRemoveLogo = (type: 'logo' | 'logoRight', brand?: string) => {
        if (brand) {
            const currentLogos = [...(form.brandLogos || [])];
            const idx = currentLogos.findIndex(bl => bl.brand === brand);
            if (idx > -1) {
                currentLogos[idx] = { ...currentLogos[idx], [type === 'logo' ? 'logoUrl' : 'logoRightUrl']: '' };
                setForm({ ...form, brandLogos: currentLogos });
            }
        } else {
            setForm({ ...form, [type === 'logo' ? 'logoUrl' : 'logoRightUrl']: '' });
        }
    };

    const currentBrandLogo = form.brandLogos?.find(bl => bl.brand === selectedBrandForLogo);

    return (
        <div className="fixed inset-0 bg-black bg-opacity-70 z-[160] flex justify-center items-center p-4 backdrop-blur-sm" onClick={onClose}>
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-5xl max-h-[95vh] overflow-y-auto flex flex-col border border-gray-200 dark:border-gray-700" onClick={e => e.stopPropagation()}>
                <div className="px-8 py-6 bg-gray-900 text-white rounded-t-2xl flex justify-between items-center sticky top-0 z-20">
                    <div>
                        <h2 className="text-2xl font-black uppercase tracking-tighter">Organization Designer</h2>
                        <p className="text-xs text-gray-400 font-medium">Customize your brand identity and document presentation.</p>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-white text-3xl font-bold transition-colors">&times;</button>
                </div>
                
                <div className="p-8 space-y-12">
                    {/* Live Preview Header Section */}
                    <section className="relative">
                        <div className="flex flex-col sm:flex-row items-center justify-between mb-6 gap-4">
                            <div className="flex items-center gap-3"><div className="h-8 w-1.5 bg-blue-600 rounded-full"></div><h3 className="text-sm font-black uppercase text-gray-800 dark:text-white tracking-widest">Header Layout (Logos Only)</h3></div>
                            <div className="flex items-center gap-6 bg-gray-50 dark:bg-gray-900/50 p-3 rounded-xl border dark:border-gray-700">
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-bold text-gray-400 uppercase">Logo Scale</span>
                                    <input type="range" min="30" max="150" value={logoScale} onChange={e=>setLogoScale(+e.target.value)} className="w-24 h-1.5 bg-blue-200 rounded-lg appearance-none cursor-pointer" />
                                </div>
                                <div className="flex items-center gap-2">
                                    <label className="text-[10px] font-bold text-gray-400 uppercase">Brand Theme:</label>
                                    <select value={selectedBrandForLogo} onChange={e => setSelectedBrandForLogo(e.target.value)} className="bg-white dark:bg-gray-700 border dark:border-gray-600 px-3 py-1 rounded font-black text-xs outline-none">
                                        {brands.map(b => <option key={b} value={b}>{b}</option>)}
                                    </select>
                                </div>
                            </div>
                        </div>

                        <div className="bg-white p-8 rounded-xl border-2 border-dashed border-gray-200 shadow-inner group min-h-[140px] relative overflow-hidden transition-all duration-500">
                            <div className="flex justify-between items-center gap-4">
                                {/* Left Logo Slot */}
                                <div className="w-1/3 flex flex-col items-center justify-center relative border border-gray-100 rounded-lg h-28 bg-gray-50/30 group/slot transition-all hover:border-blue-300">
                                    {currentBrandLogo?.logoUrl || form.logoUrl ? (
                                        <img src={currentBrandLogo?.logoUrl || form.logoUrl} style={{ height: `${logoScale}%`, objectFit: 'contain' }} className="max-h-full max-w-full" />
                                    ) : (
                                        <div className="flex flex-col items-center opacity-30"><CloudUploadIcon className="w-6 h-6 mb-1" /><span className="text-[8px] font-bold">PRIMARY LOGO</span></div>
                                    )}
                                    <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover/slot:opacity-100 transition-opacity rounded-lg">
                                        <input type="file" id="l-upload" className="hidden" onChange={e => handleFileUpload(e, 'logo', selectedBrandForLogo)} />
                                        <label htmlFor="l-upload" className="text-white text-[10px] font-black cursor-pointer bg-blue-600 px-3 py-1 rounded-md hover:bg-blue-500">REPLACE</label>
                                        {(currentBrandLogo?.logoUrl || form.logoUrl) && <button onClick={() => handleRemoveLogo('logo', selectedBrandForLogo)} className="ml-2 bg-red-600 text-white p-1 rounded-md hover:bg-red-500"><TrashIcon className="w-3 h-3"/></button>}
                                    </div>
                                </div>

                                {/* Center Slot: Empty as requested to remove center branding from header */}
                                <div className="flex-1 h-28 flex items-center justify-center border-x border-dashed border-gray-100 bg-gray-50/10">
                                    <p className="text-[9px] font-bold text-gray-300 uppercase tracking-widest">Header Center - Empty</p>
                                </div>

                                {/* Right Logo Slot */}
                                <div className="w-1/3 flex flex-col items-center justify-center relative border border-gray-100 rounded-lg h-28 bg-gray-50/30 group/slot transition-all hover:border-blue-300">
                                    {currentBrandLogo?.logoRightUrl || form.logoRightUrl ? (
                                        <img src={currentBrandLogo?.logoRightUrl || form.logoRightUrl} style={{ height: `${logoScale}%`, objectFit: 'contain' }} className="max-h-full max-w-full" />
                                    ) : (
                                        <div className="flex flex-col items-center opacity-30"><CloudUploadIcon className="w-6 h-6 mb-1" /><span className="text-[8px] font-bold">SECONDARY LOGO</span></div>
                                    )}
                                    <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover/slot:opacity-100 transition-opacity rounded-lg">
                                        <input type="file" id="r-upload" className="hidden" onChange={e => handleFileUpload(e, 'logoRight', selectedBrandForLogo)} />
                                        <label htmlFor="r-upload" className="text-white text-[10px] font-black cursor-pointer bg-blue-600 px-3 py-1 rounded-md hover:bg-blue-500">REPLACE</label>
                                        {(currentBrandLogo?.logoRightUrl || form.logoRightUrl) && <button onClick={() => handleRemoveLogo('logoRight', selectedBrandForLogo)} className="ml-2 bg-red-600 text-white p-1 rounded-md hover:bg-red-500"><TrashIcon className="w-3 h-3"/></button>}
                                    </div>
                                </div>
                            </div>
                        </div>
                        <p className="text-[10px] text-gray-400 mt-2 italic">* Branding and address will appear in the body of the documents.</p>
                    </section>

                    {/* Core Identity & Financials */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                        <section className="space-y-6">
                            <div className="flex items-center gap-3 mb-6"><div className="h-8 w-1.5 bg-green-600 rounded-full"></div><h3 className="text-sm font-black uppercase text-gray-800 dark:text-white tracking-widest">Business Information</h3></div>
                            <div className="grid grid-cols-1 gap-5">
                                <div><label className={labelStyle}>Company Name</label><input value={form.name} onChange={e => setForm({...form, name: e.target.value})} className={inputStyle} placeholder="Full Registered Name" /></div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div><label className={labelStyle}>GSTIN Number</label><input value={form.gstin} onChange={e => setForm({...form, gstin: e.target.value})} className={`${inputStyle} font-mono`} placeholder="15-digit code" /></div>
                                    <div><label className={labelStyle}>Contact Hotline</label><input value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} className={inputStyle} /></div>
                                </div>
                                <div><label className={labelStyle}>Primary Email</label><input value={form.email} onChange={e => setForm({...form, email: e.target.value})} className={inputStyle} /></div>
                                <div><label className={labelStyle}>Company Address</label><input value={form.addressLine1} onChange={e => setForm({...form, addressLine1: e.target.value})} className={inputStyle} placeholder="Street, Industrial Estate" /></div>
                                <div><label className={labelStyle}>City, State, Zip</label><input value={form.cityStateZip} onChange={e => setForm({...form, cityStateZip: e.target.value})} className={inputStyle} placeholder="City, State, Pincode" /></div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div><label className={labelStyle}>State Name</label><input value={form.state || ''} onChange={e => setForm({...form, state: e.target.value})} className={inputStyle} placeholder="e.g. TELANGANA" /></div>
                                    <div><label className={labelStyle}>State Code</label><input value={form.stateCode || ''} onChange={e => setForm({...form, stateCode: e.target.value})} className={inputStyle} placeholder="e.g. 36" /></div>
                                </div>
                                <div><label className={labelStyle}>PAN Number</label><input value={form.pan || ''} onChange={e => setForm({...form, pan: e.target.value})} className={inputStyle} /></div>
                                <div><label className={labelStyle}>Factory Address</label><textarea rows={2} value={form.factoryAddress || ''} onChange={e => setForm({...form, factoryAddress: e.target.value})} className={inputStyle} /></div>
                            </div>
                        </section>

                        <section className="space-y-6">
                            <div className="flex items-center gap-3 mb-6"><div className="h-8 w-1.5 bg-purple-600 rounded-full"></div><h3 className="text-sm font-black uppercase text-gray-800 dark:text-white tracking-widest">Financial Node Details</h3></div>
                            <div className="p-6 bg-gray-50 dark:bg-gray-900/50 rounded-2xl border dark:border-gray-700 grid grid-cols-2 gap-5 shadow-sm">
                                <div className="col-span-2"><label className={labelStyle}>Bank Institution</label><input value={form.bankName || ''} onChange={e => setForm({...form, bankName: e.target.value})} className={inputStyle} /></div>
                                <div className="col-span-2"><label className={labelStyle}>Account Number</label><input value={form.accountNo || ''} onChange={e => setForm({...form, accountNo: e.target.value})} className={`${inputStyle} font-mono`} /></div>
                                <div><label className={labelStyle}>IFSC Protocol</label><input value={form.ifsc || ''} onChange={e => setForm({...form, ifsc: e.target.value})} className={`${inputStyle} font-mono`} /></div>
                                <div><label className={labelStyle}>Branch Node</label><input value={form.branch || ''} onChange={e => setForm({...form, branch: e.target.value})} className={inputStyle} /></div>
                            </div>
                            <div className="pt-4">
                                <label className={labelStyle}>Terms & Conditions</label>
                                <textarea rows={4} value={form.terms} onChange={e => setForm({...form, terms: e.target.value})} className={`${inputStyle} resize-none`} placeholder="Standard terms for invoices..."></textarea>
                            </div>
                        </section>
                    </div>
                </div>

                <div className="px-8 py-6 bg-gray-900 border-t dark:border-gray-700 flex justify-end gap-3 rounded-b-2xl sticky bottom-0 z-10">
                    <button onClick={onClose} className="px-8 py-3 border border-gray-600 rounded-xl font-black text-gray-300 uppercase text-xs tracking-widest transition-all hover:bg-gray-800">Discard</button>
                    <button onClick={() => { updateSettings(form); addToast('Branding Synced Successfully!', 'success'); onClose(); }} className="px-10 py-3 bg-blue-600 text-white rounded-xl font-black shadow-xl hover:bg-blue-700 transition-all uppercase text-xs tracking-widest hover:scale-105 active:scale-95">Commit All Changes</button>
                </div>
            </div>
        </div>
    );
};

const ManageBrandsModal: React.FC<any> = ({ isOpen, onClose, brands, addBrand, updateBrand, deleteBrand, addToast }) => {
    const [newB, setNewB] = useState('');
    const [editingBrand, setEditingBrand] = useState<string | null>(null);
    const [editValue, setEditValue] = useState('');
    const [confirmDeleteBrand, setConfirmDeleteBrand] = useState<string | null>(null);

    if (!isOpen) return null;
    const handleAdd = () => { if (newB.trim() && !brands.includes(newB.trim())) { addBrand(newB.trim()); setNewB(''); } else { addToast('Identity already exists.', 'error'); } };
    const handleSaveEdit = (oldB: string) => { if (editValue.trim() && !brands.includes(editValue.trim())) { updateBrand(oldB, editValue.trim()); setEditingBrand(null); } };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 z-[180] flex justify-center items-center p-4" onClick={onClose}>
            <div className="bg-white dark:bg-gray-800 p-8 rounded-2xl w-full max-w-md shadow-2xl border dark:border-gray-700" onClick={e => e.stopPropagation()}>
                <h3 className="font-black mb-6 dark:text-white uppercase text-sm tracking-widest">Master Brand List</h3>
                
                {confirmDeleteBrand ? (
                    <div className="bg-red-50 dark:bg-red-900/20 p-6 rounded-2xl border border-red-100 dark:border-red-900/30 mb-6 animate-in fade-in slide-in-from-top-4 duration-300">
                        <p className="text-red-600 dark:text-red-400 text-sm font-black uppercase tracking-tight mb-4 text-center">Erase "{confirmDeleteBrand}" from system?</p>
                        <div className="flex gap-3">
                            <button onClick={() => setConfirmDeleteBrand(null)} className="flex-1 py-3 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border dark:border-gray-700 rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-gray-50 transition-all">Cancel</button>
                            <button 
                                onClick={() => { deleteBrand(confirmDeleteBrand); setConfirmDeleteBrand(null); addToast('Brand identity removed.', 'info'); }} 
                                className="flex-1 py-3 bg-red-600 text-white rounded-xl font-black uppercase text-[10px] tracking-widest shadow-lg shadow-red-500/20 hover:bg-red-700 transition-all"
                            >
                                Confirm Delete
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="flex gap-2 mb-6">
                        <input value={newB} onChange={e => setNewB(e.target.value)} className="border border-gray-200 dark:border-gray-700 p-3 flex-1 rounded-xl text-sm dark:bg-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500" placeholder="New Brand Identity..." />
                        <button onClick={handleAdd} className="bg-blue-600 text-white px-6 rounded-xl text-xs font-black uppercase hover:bg-blue-700">Add</button>
                    </div>
                )}

                <div className="max-h-64 overflow-y-auto border border-gray-100 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-900/30 p-2 space-y-1">
                    {brands.map((b:string) => (
                        <div key={b} className={`flex justify-between items-center p-3 rounded-lg border transition-all ${confirmDeleteBrand === b ? 'bg-red-50 dark:bg-red-900/10 border-red-200' : 'bg-white dark:bg-gray-800 dark:border-gray-700'}`}>
                            {editingBrand === b ? (
                                <div className="flex-1 flex gap-2 items-center">
                                    <input 
                                        value={editValue} 
                                        onChange={e => setEditValue(e.target.value)} 
                                        onKeyDown={e => { if (e.key === 'Enter') handleSaveEdit(b); if (e.key === 'Escape') setEditingBrand(null); }}
                                        className="text-sm p-1 border-b dark:bg-gray-700 w-full outline-none font-bold text-gray-900 dark:text-white" 
                                        autoFocus 
                                    />
                                    <button onClick={() => handleSaveEdit(b)} className="px-2 py-1 bg-green-500 hover:bg-green-600 text-white rounded text-xs font-black">Save</button>
                                    <button onClick={() => setEditingBrand(null)} className="px-2 py-1 bg-gray-300 dark:bg-gray-600 hover:bg-gray-400 text-gray-800 dark:text-gray-200 rounded text-xs font-black">Cancel</button>
                                </div>
                            ) : (
                                <>
                                    <span className={`text-sm font-black ${confirmDeleteBrand === b ? 'text-red-600' : 'text-gray-700 dark:text-gray-200'}`}>{b}</span>
                                    <div className="flex gap-1">
                                        <button onClick={() => { setEditingBrand(b); setEditValue(b); setConfirmDeleteBrand(null); }} className="p-1.5 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-md" title="Rename"><PencilIcon className="w-3.5 h-3.5"/></button>
                                        <button onClick={() => setConfirmDeleteBrand(b)} className={`p-1.5 rounded-md transition-colors ${confirmDeleteBrand === b ? 'bg-red-600 text-white' : 'text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30'}`} title="Delete"><TrashIcon className="w-3.5 h-3.5"/></button>
                                    </div>
                                </>
                            )}
                        </div>
                    ))}
                </div>
                <button onClick={onClose} className="mt-6 w-full py-3 bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-white font-black rounded-xl uppercase text-xs tracking-widest hover:bg-gray-200">Close</button>
            </div>
        </div>
    );
};

const ManageMachinesModal: React.FC<any> = ({ isOpen, onClose, machines = [], addMachine, deleteMachine, addToast }) => {
    const [newMachine, setNewMachine] = useState('');

    if (!isOpen) return null;

    const handleAdd = () => {
        const trimmed = newMachine.trim();
        if (!trimmed) return addToast('Please enter a machine name or line ID', 'error');
        if (machines.includes(trimmed)) return addToast('Machine already exists in list', 'error');
        if (addMachine) {
            addMachine(trimmed);
            setNewMachine('');
            addToast(`Machine "${trimmed}" added!`, 'success');
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 z-[180] flex justify-center items-center p-4" onClick={onClose}>
            <div className="bg-white dark:bg-gray-800 p-8 rounded-2xl w-full max-w-md shadow-2xl border dark:border-gray-700" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h3 className="font-black dark:text-white uppercase text-sm tracking-widest flex items-center gap-2">
                            <Cpu className="w-4 h-4 text-blue-600" /> Extrusion Machines & Lines
                        </h3>
                        <p className="text-[10px] text-gray-400 font-bold uppercase mt-0.5">Manage production extruder lines</p>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-lg font-bold">✕</button>
                </div>

                <div className="flex gap-2 mb-6">
                    <input 
                        value={newMachine} 
                        onChange={e => setNewMachine(e.target.value)} 
                        onKeyDown={e => { if (e.key === 'Enter') handleAdd(); }}
                        className="border border-gray-200 dark:border-gray-700 p-3 flex-1 rounded-xl text-sm dark:bg-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500" 
                        placeholder="e.g. Machine 6 or Line 3..." 
                    />
                    <button onClick={handleAdd} className="bg-blue-600 text-white px-5 rounded-xl text-xs font-black uppercase hover:bg-blue-700 active:scale-95 transition-all">
                        + Add
                    </button>
                </div>

                <div className="max-h-64 overflow-y-auto border border-gray-100 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-900/30 p-2 space-y-1.5">
                    {machines.map((m: string) => (
                        <div key={m} className="flex justify-between items-center p-3 rounded-xl bg-white dark:bg-gray-800 border dark:border-gray-700 group shadow-xs">
                            <div className="flex items-center gap-2.5">
                                <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                                <span className="text-xs font-black text-gray-800 dark:text-gray-200">
                                    {m.startsWith('Machine') || m.startsWith('Line') ? m : `Machine ${m}`}
                                </span>
                            </div>
                            <button 
                                onClick={() => {
                                    if (confirm(`Remove "${m}" from machine list?`)) {
                                        if (deleteMachine) deleteMachine(m);
                                        addToast(`Machine "${m}" removed`, 'info');
                                    }
                                }} 
                                className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity" 
                                title="Delete Machine"
                            >
                                <TrashIcon className="w-3.5 h-3.5" />
                            </button>
                        </div>
                    ))}
                    {machines.length === 0 && (
                        <div className="text-center py-6 text-xs text-gray-400 italic">No machines registered.</div>
                    )}
                </div>

                <button onClick={onClose} className="mt-6 w-full py-3 bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-white font-black rounded-xl uppercase text-xs tracking-widest hover:bg-gray-200 transition-all">
                    Done
                </button>
            </div>
        </div>
    );
};


const CatalogueBrandModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (brand: string) => void;
    brands: string[];
}> = ({ isOpen, onClose, onConfirm, brands }) => {
    const [selectedBrand, setSelectedBrand] = useState('');
    const [newBrand, setNewBrand] = useState('');

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 z-[200] flex items-center justify-center p-4 backdrop-blur-sm" onClick={onClose}>
            <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border border-gray-100 dark:border-gray-700 animate-in fade-in zoom-in duration-300" onClick={e => e.stopPropagation()}>
                <div className="p-8 bg-emerald-600 text-white">
                    <h3 className="text-2xl font-black tracking-tighter uppercase mb-1">Select Catalogue Brand</h3>
                    <p className="text-emerald-50 text-xs font-medium opacity-80">Identify the brand before AI processing begins</p>
                </div>
                <div className="p-8 space-y-6">
                    <div>
                        <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest block mb-2">Existing Brands</label>
                        <select 
                            className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 p-3 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
                            value={selectedBrand}
                            onChange={(e) => { setSelectedBrand(e.target.value); setNewBrand(''); }}
                        >
                            <option value="">-- Choose Existing Brand --</option>
                            {brands.map(b => <option key={b} value={b}>{b}</option>)}
                        </select>
                    </div>
                    <div className="relative">
                        <div className="absolute inset-0 flex items-center" aria-hidden="true">
                            <div className="w-full border-t border-gray-100 dark:border-gray-700"></div>
                        </div>
                        <div className="relative flex justify-center">
                            <span className="bg-white dark:bg-gray-800 px-2 text-[10px] font-black text-gray-300 uppercase">OR</span>
                        </div>
                    </div>
                    <div>
                        <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest block mb-2">New Brand Identity</label>
                        <input 
                            type="text"
                            placeholder="Enter new brand name..."
                            className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 p-3 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
                            value={newBrand}
                            onChange={(e) => { setNewBrand(e.target.value); setSelectedBrand(''); }}
                        />
                    </div>
                    <div className="flex gap-3 pt-4">
                        <button onClick={onClose} className="flex-1 py-4 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-gray-200 transition-all">Cancel</button>
                        <button 
                            disabled={!selectedBrand && !newBrand}
                            onClick={() => onConfirm(newBrand || selectedBrand)}
                            className="flex-1 py-4 bg-emerald-600 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-lg shadow-emerald-500/20 hover:bg-emerald-700 disabled:opacity-50 transition-all"
                        >
                            Sync Catalogue
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ProfileSection;
