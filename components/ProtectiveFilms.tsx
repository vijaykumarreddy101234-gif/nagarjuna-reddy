import React, { useState, useMemo } from 'react';
import { 
    Shield, Layers, Plus, Search, Download, Printer, 
    RotateCcw, Edit3, Trash2, ArrowUpRight, ArrowDownRight, ArrowDownLeft,
    CheckCircle2, AlertTriangle, Package, Calendar, 
    FileSpreadsheet, X, Info, Sliders, RefreshCw, BarChart3, 
    TrendingUp, Check, Eye, Tag, AlertCircle, ArrowRight,
    Building2, Activity, Box, Filter, CheckCircle, ExternalLink, Database
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { useStore } from '../store/useStore';
import { ProtectiveFilmItem, ProtectiveFilmInwardTransaction, ProtectiveFilmOutwardAdjustment, Profile, ProfileTransaction } from '../types';
import { ManageBrandsModal } from './ManageBrandsModal';
import { BrandStockOverview } from './BrandStockOverview';

interface ProtectiveFilmsProps {
    defaultBrand?: string;
    onOpenManageBrands?: () => void;
}

type FilmSubTab = 'SPECIFICATIONS' | 'ROLL_INVENTORY' | 'INWARD_LOG' | 'OUTWARD_LOG' | 'ANALYTICS';
type CalculationMode = 'LIVE_PRODUCTION' | 'CURRENT_STOCK' | 'SIMULATION';
export type KpiDrillDownType = 'TOTAL_INWARD' | 'CONSUMED_OUTWARD' | 'LIVE_NET_BALANCE' | 'FILM_WIDTH_TYPES' | 'PROFILE_ITEMS' | 'LOW_STOCK_ALERTS' | null;

const STANDARD_WIDTH_PRESETS = [
    '19', '24', '25', '30', '32', '34', '35', '38', 
    '40', '42', '45', '48', '50', '52', '55', '60', 
    '65', '70', '75', '80', '90', '100'
];

export const ProtectiveFilms = ({ defaultBrand = 'All', onOpenManageBrands }) => {
    const {
        protectiveFilmItems = [],
        protectiveFilmInwardTransactions = [],
        protectiveFilmOutwardAdjustments = [],
        profiles = [],
        profileTransactions = [],
        brands = [],
        addProtectiveFilmItem,
        updateProtectiveFilmItem,
        deleteProtectiveFilmItem,
        resetProtectiveFilmItems,
        addProtectiveFilmInward,
        updateProtectiveFilmInward,
        deleteProtectiveFilmInward,
        addProtectiveFilmOutwardAdjustment,
        updateProtectiveFilmOutwardAdjustment,
        deleteProtectiveFilmOutwardAdjustment,
        syncProfilesToStock
    } = useStore();

    // UI state
    const [subTab, setSubTab] = useState<FilmSubTab>('SPECIFICATIONS');
    const [selectedBrand, setSelectedBrand] = useState<string>(defaultBrand || 'All');
    const [searchTerm, setSearchTerm] = useState<string>('');
    const [selectedSeries, setSelectedSeries] = useState<string>('All');
    const [selectedWidthFilter, setSelectedWidthFilter] = useState<string>('All');
    const [showLowStockOnly, setShowLowStockOnly] = useState<boolean>(false);
    const [calcMode, setCalcMode] = useState<CalculationMode>('LIVE_PRODUCTION');
    const [simulationLengths, setSimulationLengths] = useState<Record<string, number>>({});

    // Keep selectedBrand in sync when defaultBrand prop changes from parent tabs
    React.useEffect(() => {
        if (defaultBrand) {
            setSelectedBrand(defaultBrand);
        }
    }, [defaultBrand]);

    const normBrand = (b?: string | null) => (b || 'General').trim().toLowerCase().replace(/[\s_-]/g, '');

    // Interactive Switch Drilldown State & Modal
    const [activeKpiModal, setActiveKpiModal] = useState<KpiDrillDownType>(null);
    const [modalBrandFilter, setModalBrandFilter] = useState<string>('All');
    const [modalSearchTerm, setModalSearchTerm] = useState<string>('');

    // Modals
    const [isManageBrandsModalOpen, setIsManageBrandsModalOpen] = useState(false);
    const [manageBrandsInitialTab, setManageBrandsInitialTab] = useState<'OVERVIEW' | 'STICKER_CATALOG' | 'BATCH_UPDATE' | 'IMPORT_EXCEL'>('OVERVIEW');
    const [isInwardModalOpen, setIsInwardModalOpen] = useState(false);
    const [editingInwardTx, setEditingInwardTx] = useState<ProtectiveFilmInwardTransaction | null>(null);
    
    const [isAdjustmentModalOpen, setIsAdjustmentModalOpen] = useState(false);
    const [editingAdjTx, setEditingAdjTx] = useState<ProtectiveFilmOutwardAdjustment | null>(null);
    
    const [isEditProfileModalOpen, setIsEditProfileModalOpen] = useState(false);
    const [isAddProfileModalOpen, setIsAddProfileModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<ProtectiveFilmItem | null>(null);

    // Inward Form State
    const [inwardForm, setInwardForm] = useState({
        selectedProfileId: '',
        brand: 'Scraft',
        filmWidth: '38',
        customWidthInput: '',
        side: 'GENERAL' as 'TOP' | 'BOTTOM' | 'BOTH' | 'GENERAL',
        meters: 5000,
        rollCount: 1,
        refNo: `ROLL-IN-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`,
        supplier: '',
        costPerMeter: 0,
        notes: '',
        date: new Date().toISOString().split('T')[0],
        updateItemBaseStock: false
    });

    // Adjustment Form State
    const [adjForm, setAdjForm] = useState({
        selectedProfileId: '',
        brand: 'Scraft',
        filmWidth: '38',
        customWidthInput: '',
        meters: 50,
        type: 'TOP' as 'TOP' | 'BOTTOM' | 'BOTH',
        reason: 'SCRAP' as 'SCRAP' | 'DAMAGE' | 'MANUAL_DISPATCH' | 'ADJUSTMENT' | 'SAMPLING',
        refNo: `ADJ-${Math.floor(1000 + Math.random() * 9000)}`,
        notes: '',
        date: new Date().toISOString().split('T')[0]
    });

    // Edit/Add Item Form State
    const [itemForm, setItemForm] = useState<Partial<ProtectiveFilmItem>>({
        sNo: protectiveFilmItems.length + 1,
        series: '80.5 SERIES',
        description: '',
        profileCode: '',
        packets: '',
        lengthsPerPacket: 6,
        eachLengthMtrs: 5.9,
        meterWeight: 0,
        lengthWeightWithGasket: 0,
        topFilmWidth: '38',
        topInwardMeters: 5000,
        topMtrPerLength: 5.9,
        topStickerName: '',
        bottomFilmWidth: '38',
        bottomInwardMeters: 5000,
        bottomMtrPerLength: 5.9,
        bottomStickerName: '',
        brand: 'All'
    });

    // Unique Series list
    const seriesList = useMemo(() => {
        const set = new Set<string>();
        protectiveFilmItems.forEach(i => {
            if (i.series) set.add(i.series);
        });
        return Array.from(set);
    }, [protectiveFilmItems]);

    // Unique Film Widths list (from all items and presets)
    const filmWidthsList = useMemo(() => {
        const set = new Set<string>(STANDARD_WIDTH_PRESETS);
        protectiveFilmItems.forEach(i => {
            const topW = i.topFilmWidth !== undefined && i.topFilmWidth !== null ? String(i.topFilmWidth).trim() : '';
            const botW = i.bottomFilmWidth !== undefined && i.bottomFilmWidth !== null ? String(i.bottomFilmWidth).trim() : '';
            if (topW && topW !== 'NILL') set.add(topW);
            if (botW && botW !== 'NILL') set.add(botW);
        });
        protectiveFilmInwardTransactions.forEach(t => {
            const fw = t.filmWidth !== undefined && t.filmWidth !== null ? String(t.filmWidth).trim() : '';
            if (fw) set.add(fw);
        });
        return Array.from(set).sort((a, b) => {
            const numA = parseFloat(a) || 0;
            const numB = parseFloat(b) || 0;
            return numA - numB;
        });
    }, [protectiveFilmItems, protectiveFilmInwardTransactions]);

    // Map profileCode / SKU to live produced lengths and current stock
    const profileProductionMap = useMemo(() => {
        const map: Record<string, { producedLengths: number; currentStockLengths: number }> = {};
        const norm = (s: string) => (s || '').trim().toUpperCase();

        profileTransactions.forEach(tx => {
            if (tx.deletedAt) return;
            const profile = profiles.find(p => !p.deletedAt && (p.id === tx.profileId || (p.sku && norm(p.sku) === norm(tx.profileId))));
            const profBrand = tx.brand || profile?.brand || 'General';
            
            if (selectedBrand !== 'All' && normBrand(profBrand) !== normBrand(selectedBrand)) {
                return;
            }

            const code = profile?.sku || tx.profileId;
            if (!code) return;
            const key = `${normBrand(profBrand)}::${norm(code)}`;
            const fallbackKey = norm(code);

            if (!map[key]) {
                map[key] = { producedLengths: 0, currentStockLengths: 0 };
            }
            if (!map[fallbackKey]) {
                map[fallbackKey] = { producedLengths: 0, currentStockLengths: 0 };
            }

            if (tx.type === 'PRODUCTION' || tx.type === 'RETURN') {
                map[key].producedLengths += Number(tx.quantity || 0);
                map[key].currentStockLengths += Number(tx.quantity || 0);
                map[fallbackKey].producedLengths += Number(tx.quantity || 0);
                map[fallbackKey].currentStockLengths += Number(tx.quantity || 0);
            } else if (tx.type === 'DISPATCH' || tx.type === 'SCRAP') {
                map[key].currentStockLengths -= Number(tx.quantity || 0);
                map[fallbackKey].currentStockLengths -= Number(tx.quantity || 0);
            }
        });

        return map;
    }, [profileTransactions, profiles, selectedBrand]);

    // Live calculations for each Protective Film Item
    const calculatedRows = useMemo(() => {
        return protectiveFilmItems.map(item => {
            const normCode = (item.profileCode || '').trim().toUpperCase();
            const brandKey = `${normBrand(item.brand)}::${normCode}`;
            const prodData = profileProductionMap[brandKey] || profileProductionMap[normCode] || { producedLengths: 0, currentStockLengths: 0 };
            
            let activeLengths = 0;
            if (calcMode === 'LIVE_PRODUCTION') {
                activeLengths = prodData.producedLengths;
            } else if (calcMode === 'CURRENT_STOCK') {
                activeLengths = Math.max(0, prodData.currentStockLengths);
            } else if (calcMode === 'SIMULATION') {
                activeLengths = simulationLengths[item.id] !== undefined ? simulationLengths[item.id] : prodData.producedLengths;
            }

            // Top Film Calculations
            const isTopActive = item.topFilmWidth && item.topFilmWidth !== 'NILL' && item.topFilmWidth !== '';
            const topMtrPerLen = item.topMtrPerLength || item.eachLengthMtrs || 5.9;
            const topOutwardMtrs = isTopActive ? activeLengths * topMtrPerLen : 0;
            const topInwardMtrs = item.topInwardMeters || 0;
            const topBalanceMtrs = isTopActive ? topInwardMtrs - topOutwardMtrs : 0;
            const topLengthsRemaining = isTopActive && topMtrPerLen > 0 ? Math.floor(topBalanceMtrs / topMtrPerLen) : 0;

            // Bottom Film Calculations
            const isBottomActive = item.bottomFilmWidth && item.bottomFilmWidth !== 'NILL' && item.bottomFilmWidth !== '';
            const bottomMtrPerLen = item.bottomMtrPerLength || item.eachLengthMtrs || 5.9;
            const bottomOutwardMtrs = isBottomActive ? activeLengths * bottomMtrPerLen : 0;
            const bottomInwardMtrs = item.bottomInwardMeters || 0;
            const bottomBalanceMtrs = isBottomActive ? bottomInwardMtrs - bottomOutwardMtrs : 0;
            const bottomLengthsRemaining = isBottomActive && bottomMtrPerLen > 0 ? Math.floor(bottomBalanceMtrs / bottomMtrPerLen) : 0;

            // Total meters for row
            const totalOutwardMtrs = topOutwardMtrs + bottomOutwardMtrs;
            const totalInwardMtrs = (isTopActive ? topInwardMtrs : 0) + (isBottomActive ? bottomInwardMtrs : 0);
            const totalBalanceMtrs = totalInwardMtrs - totalOutwardMtrs;
            const totalLengthsRemaining = (topLengthsRemaining || 0) + (bottomLengthsRemaining || 0);

            return {
                ...item,
                activeLengths,
                topOutwardMtrs,
                topBalanceMtrs,
                topLengthsRemaining,
                bottomOutwardMtrs,
                bottomBalanceMtrs,
                bottomLengthsRemaining,
                totalInwardMtrs,
                totalOutwardMtrs,
                totalBalanceMtrs,
                totalLengthsRemaining
            };
        });
    }, [protectiveFilmItems, profileProductionMap, calcMode, simulationLengths]);

    // Filtered rows for UI
    const filteredRows = useMemo(() => {
        return calculatedRows.filter(row => {
            const matchesSearch = !searchTerm || 
                row.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                row.profileCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
                row.series.toLowerCase().includes(searchTerm.toLowerCase());
            
            const matchesSeries = selectedSeries === 'All' || row.series === selectedSeries;
            const prof = profiles.find(p => !p.deletedAt && p.sku?.toUpperCase() === row.profileCode?.toUpperCase() && (normBrand(p.brand) === normBrand(row.brand) || !row.brand || row.brand === 'All')) ||
                         profiles.find(p => !p.deletedAt && p.sku?.toUpperCase() === row.profileCode?.toUpperCase());
            const rowBrand = row.brand && row.brand !== 'All' ? row.brand : (prof?.brand || 'General');
            const matchesBrand = selectedBrand === 'All' || normBrand(rowBrand) === normBrand(selectedBrand);

            const matchesWidth = selectedWidthFilter === 'All' || 
                row.topFilmWidth === selectedWidthFilter || 
                row.bottomFilmWidth === selectedWidthFilter;

            const matchesLowStock = !showLowStockOnly || 
                (row.topFilmWidth && row.topFilmWidth !== 'NILL' && row.topBalanceMtrs < 1000) ||
                (row.bottomFilmWidth && row.bottomFilmWidth !== 'NILL' && row.bottomBalanceMtrs < 1000) ||
                (row.totalBalanceMtrs < 1000);

            return matchesSearch && matchesSeries && matchesBrand && matchesWidth && matchesLowStock;
        });
    }, [calculatedRows, searchTerm, selectedSeries, selectedBrand, selectedWidthFilter, showLowStockOnly, profiles]);

    // Grouped by Series
    const seriesGroups = useMemo(() => {
        const groups: Record<string, typeof filteredRows> = {};
        filteredRows.forEach(row => {
            const s = row.series || 'Other';
            if (!groups[s]) groups[s] = [];
            groups[s].push(row);
        });
        return groups;
    }, [filteredRows]);

    // Roll inventory summary grouped by Film Width (mm)
    const rollInventorySummary = useMemo(() => {
        const cleanW = (val: string | number | undefined | null): string => {
            if (!val) return '38';
            const s = String(val).trim();
            if (s.toUpperCase() === 'NILL' || s.toUpperCase() === 'NIL' || s.toUpperCase() === 'NONE' || s === '-') return 'NILL';
            const match = s.match(/(\d+(\.\d+)?)/);
            return match ? match[1] : s.replace(/\s*mm$/i, '').trim();
        };

        const summary: Record<string, {
            width: string;
            profilesUsing: string[];
            totalInwardMtrs: number;
            totalOutwardMtrs: number;
            manualInwardMtrs: number;
            manualAdjMtrs: number;
            balanceMtrs: number;
            approxRolls: number;
            equivalentLengths: number;
        }> = {};

        // 1. Accumulate from profile item specifications & consumption
        filteredRows.forEach(r => {
            if (r.topFilmWidth && r.topFilmWidth !== 'NILL' && r.topFilmWidth !== '') {
                const wNum = cleanW(r.topFilmWidth);
                if (wNum !== 'NILL') {
                    const w = `${wNum} mm`;
                    if (!summary[w]) {
                        summary[w] = {
                            width: w,
                            profilesUsing: [],
                            totalInwardMtrs: 0,
                            totalOutwardMtrs: 0,
                            manualInwardMtrs: 0,
                            manualAdjMtrs: 0,
                            balanceMtrs: 0,
                            approxRolls: 0,
                            equivalentLengths: 0
                        };
                    }
                    if (!summary[w].profilesUsing.includes(r.profileCode)) {
                        summary[w].profilesUsing.push(r.profileCode);
                    }
                    summary[w].totalInwardMtrs += r.topInwardMeters || 0;
                    summary[w].totalOutwardMtrs += r.topOutwardMtrs;
                }
            }

            if (r.bottomFilmWidth && r.bottomFilmWidth !== 'NILL' && r.bottomFilmWidth !== '') {
                const wNum = cleanW(r.bottomFilmWidth);
                if (wNum !== 'NILL') {
                    const w = `${wNum} mm`;
                    if (!summary[w]) {
                        summary[w] = {
                            width: w,
                            profilesUsing: [],
                            totalInwardMtrs: 0,
                            totalOutwardMtrs: 0,
                            manualInwardMtrs: 0,
                            manualAdjMtrs: 0,
                            balanceMtrs: 0,
                            approxRolls: 0,
                            equivalentLengths: 0
                        };
                    }
                    if (!summary[w].profilesUsing.includes(r.profileCode)) {
                        summary[w].profilesUsing.push(r.profileCode);
                    }
                    summary[w].totalInwardMtrs += r.bottomInwardMeters || 0;
                    summary[w].totalOutwardMtrs += r.bottomOutwardMtrs;
                }
            }
        });

        // 2. Add extra inward receipts
        protectiveFilmInwardTransactions.forEach(tx => {
            if (tx.deletedAt) return;
            const txBrand = tx.brand && tx.brand !== 'All' ? tx.brand : 'General';
            if (selectedBrand !== 'All' && normBrand(txBrand) !== normBrand(selectedBrand)) return;
            const wNum = cleanW(tx.filmWidth);
            if (wNum === 'NILL') return;
            const w = `${wNum} mm`;
            if (!summary[w]) {
                summary[w] = {
                    width: w,
                    profilesUsing: [],
                    totalInwardMtrs: 0,
                    totalOutwardMtrs: 0,
                    manualInwardMtrs: 0,
                    manualAdjMtrs: 0,
                    balanceMtrs: 0,
                    approxRolls: 0,
                    equivalentLengths: 0
                };
            }
            summary[w].manualInwardMtrs += Number(tx.meters || 0);
            summary[w].totalInwardMtrs += Number(tx.meters || 0);
        });

        // 3. Add extra outward adjustments
        protectiveFilmOutwardAdjustments.forEach(adj => {
            if (adj.deletedAt) return;
            const adjBrand = adj.brand && adj.brand !== 'All' ? adj.brand : 'General';
            if (selectedBrand !== 'All' && normBrand(adjBrand) !== normBrand(selectedBrand)) return;
            const wNum = cleanW(adj.filmWidth);
            if (wNum === 'NILL') return;
            const w = `${wNum} mm`;
            if (summary[w]) {
                summary[w].manualAdjMtrs += Number(adj.meters || 0);
                summary[w].totalOutwardMtrs += Number(adj.meters || 0);
            }
        });

        // 4. Calculate Net Balances
        Object.keys(summary).forEach(k => {
            const item = summary[k];
            item.balanceMtrs = item.totalInwardMtrs - item.totalOutwardMtrs;
            item.approxRolls = Math.max(1, Math.round(item.balanceMtrs / 5000));
            item.equivalentLengths = Math.floor(item.balanceMtrs / 5.9);
        });

        return Object.values(summary).sort((a, b) => {
            const numA = parseFloat(a.width) || 0;
            const numB = parseFloat(b.width) || 0;
            return numA - numB;
        });
    }, [filteredRows, protectiveFilmInwardTransactions, protectiveFilmOutwardAdjustments, selectedBrand]);

    // Filtered Roll Inventory for UI (incorporating search, width filter, and low stock switch)
    const filteredRollInventory = useMemo(() => {
        return rollInventorySummary.filter(roll => {
            const matchesSearch = !searchTerm || 
                roll.width.toLowerCase().includes(searchTerm.toLowerCase()) ||
                roll.profilesUsing.some(p => p.toLowerCase().includes(searchTerm.toLowerCase()));
                
            const rawW = roll.width.replace(' mm', '').trim();
            const matchesWidth = selectedWidthFilter === 'All' || rawW === selectedWidthFilter.trim();

            const matchesLowStock = !showLowStockOnly || roll.balanceMtrs < 1000;

            return matchesSearch && matchesWidth && matchesLowStock;
        });
    }, [rollInventorySummary, searchTerm, selectedWidthFilter, showLowStockOnly]);

    // Top Totals
    const stats = useMemo(() => {
        let totalInwardMtrs = 0;
        let totalOutwardMtrs = 0;
        rollInventorySummary.forEach(r => {
            totalInwardMtrs += r.totalInwardMtrs;
            totalOutwardMtrs += r.totalOutwardMtrs;
        });
        const netBalanceMtrs = totalInwardMtrs - totalOutwardMtrs;
        const totalRollsEst = Math.round(netBalanceMtrs / 5000 * 10) / 10;
        const lowStockRolls = rollInventorySummary.filter(r => r.balanceMtrs < 1000).length;

        return {
            totalInwardMtrs,
            totalOutwardMtrs,
            netBalanceMtrs,
            totalRollsEst,
            lowStockRolls,
            activeFilmWidthsCount: rollInventorySummary.length
        };
    }, [rollInventorySummary]);

    // Dynamic list of all available brands in system
    const allAvailableBrands = useMemo(() => {
        return brands.filter(b => b && b.trim() !== '').map(b => b.trim()).sort();
    }, [brands]);

    // Comprehensive Brand-Wise Breakdown Metrics
    const brandWiseMetrics = useMemo(() => {
        const map: Record<string, {
            brand: string;
            inwardMtrs: number;
            outwardMtrs: number;
            balanceMtrs: number;
            profileCount: number;
            lowStockCount: number;
            rollCountEst: number;
        }> = {};

        allAvailableBrands.forEach(b => {
            map[b] = {
                brand: b,
                inwardMtrs: 0,
                outwardMtrs: 0,
                balanceMtrs: 0,
                profileCount: 0,
                lowStockCount: 0,
                rollCountEst: 0
            };
        });

        // Helper to find existing matching brand key in map
        const findBrandKey = (rawBrand?: string | null) => {
            const norm = normBrand(rawBrand);
            const found = Object.keys(map).find(k => normBrand(k) === norm);
            return found || (rawBrand && rawBrand.trim() ? rawBrand.trim() : 'General');
        };

        // 1. From item specifications & live calculations
        calculatedRows.forEach(item => {
            const prof = profiles.find(p => !p.deletedAt && p.sku?.toUpperCase() === item.profileCode?.toUpperCase() && (normBrand(p.brand) === normBrand(item.brand) || !item.brand || item.brand === 'All')) ||
                         profiles.find(p => !p.deletedAt && p.sku?.toUpperCase() === item.profileCode?.toUpperCase());
            const rawB = item.brand && item.brand !== 'All' ? item.brand : (prof?.brand || 'General');
            const bKey = findBrandKey(rawB);
            if (!map[bKey]) {
                map[bKey] = { brand: bKey, inwardMtrs: 0, outwardMtrs: 0, balanceMtrs: 0, profileCount: 0, lowStockCount: 0, rollCountEst: 0 };
            }
            map[bKey].profileCount += 1;
            map[bKey].inwardMtrs += item.totalInwardMtrs;
            map[bKey].outwardMtrs += item.totalOutwardMtrs;
            map[bKey].balanceMtrs += item.totalBalanceMtrs;
            if (item.totalBalanceMtrs < 1000) {
                map[bKey].lowStockCount += 1;
            }
        });

        // 2. Extra Inward Roll Receipts
        protectiveFilmInwardTransactions.forEach(tx => {
            if (tx.deletedAt) return;
            const bKey = findBrandKey(tx.brand);
            if (!map[bKey]) {
                map[bKey] = { brand: bKey, inwardMtrs: 0, outwardMtrs: 0, balanceMtrs: 0, profileCount: 0, lowStockCount: 0, rollCountEst: 0 };
            }
            map[bKey].inwardMtrs += Number(tx.meters || 0);
            map[bKey].balanceMtrs += Number(tx.meters || 0);
        });

        // 3. Extra Outward Adjustments
        protectiveFilmOutwardAdjustments.forEach(adj => {
            if (adj.deletedAt) return;
            const bKey = findBrandKey(adj.brand);
            if (!map[bKey]) {
                map[bKey] = { brand: bKey, inwardMtrs: 0, outwardMtrs: 0, balanceMtrs: 0, profileCount: 0, lowStockCount: 0, rollCountEst: 0 };
            }
            map[bKey].outwardMtrs += Number(adj.meters || 0);
            map[bKey].balanceMtrs -= Number(adj.meters || 0);
        });

        Object.keys(map).forEach(k => {
            map[k].rollCountEst = Math.max(0, Math.round(map[k].balanceMtrs / 5000 * 10) / 10);
        });

        return map;
    }, [allAvailableBrands, calculatedRows, profiles, protectiveFilmInwardTransactions, protectiveFilmOutwardAdjustments]);

    // Drilldown 1: Inward Detailed List
    const inwardDrilldownList = useMemo(() => {
        const list: Array<{
            id: string;
            type: 'ROLL_RECEIPT' | 'BASE_SPEC';
            brand: string;
            date: string;
            profileCode: string;
            description: string;
            filmWidth: string;
            side: string;
            meters: number;
            rollCount: number;
            supplier: string;
            refNo: string;
            notes: string;
            rawTx?: ProtectiveFilmInwardTransaction;
        }> = [];

        // Inward Roll Transactions
        protectiveFilmInwardTransactions.forEach(tx => {
            if (tx.deletedAt) return;
            const b = String(tx.brand || 'Scraft');
            if (modalBrandFilter !== 'All' && b.toLowerCase() !== String(modalBrandFilter).toLowerCase()) return;
            
            const prof = profiles.find(p => !p.deletedAt && (String(p.sku || '').toLowerCase() === String(tx.refNo || '').toLowerCase() || String(p.sku || '').toLowerCase() === String(tx.notes || '').toLowerCase()));
            const pItem = protectiveFilmItems.find(p => String(p.topFilmWidth || '') === String(tx.filmWidth || '') || String(p.bottomFilmWidth || '') === String(tx.filmWidth || ''));
            const code = prof?.sku || pItem?.profileCode || `${tx.filmWidth}mm Roll`;
            const desc = prof?.name || pItem?.description || tx.notes || `${tx.filmWidth}mm Film Inward Receipt`;

            if (modalSearchTerm) {
                const s = modalSearchTerm.toLowerCase();
                if (!b.toLowerCase().includes(s) && 
                    !String(code || '').toLowerCase().includes(s) && 
                    !String(desc || '').toLowerCase().includes(s) && 
                    !String(tx.filmWidth || '').toLowerCase().includes(s) &&
                    !String(tx.refNo || '').toLowerCase().includes(s) &&
                    !String(tx.supplier || '').toLowerCase().includes(s)) {
                    return;
                }
            }

            list.push({
                id: tx.id,
                type: 'ROLL_RECEIPT',
                brand: b,
                date: tx.date,
                profileCode: code,
                description: desc,
                filmWidth: String(tx.filmWidth || ''),
                side: tx.side || 'GENERAL',
                meters: Number(tx.meters || 0),
                rollCount: tx.rollCount || Math.max(1, Math.round(Number(tx.meters || 0) / 5000)),
                supplier: tx.supplier || 'Standard Supplier',
                refNo: tx.refNo,
                notes: tx.notes,
                rawTx: tx
            });
        });

        // Base Specifications Inward
        calculatedRows.forEach(item => {
            const prof = profiles.find(p => !p.deletedAt && String(p.sku || '').toUpperCase() === String(item.profileCode || '').toUpperCase() && (normBrand(p.brand) === normBrand(item.brand) || !item.brand || item.brand === 'All')) ||
                         profiles.find(p => !p.deletedAt && String(p.sku || '').toUpperCase() === String(item.profileCode || '').toUpperCase());
            const b = item.brand && item.brand !== 'All' ? String(item.brand) : String(prof?.brand || 'Scraft');
            if (modalBrandFilter !== 'All' && b.toLowerCase() !== String(modalBrandFilter).toLowerCase()) return;

            if (modalSearchTerm) {
                const s = modalSearchTerm.toLowerCase();
                if (!b.toLowerCase().includes(s) && 
                    !String(item.profileCode || '').toLowerCase().includes(s) && 
                    !String(item.description || '').toLowerCase().includes(s) && 
                    !String(item.series || '').toLowerCase().includes(s) &&
                    !String(item.topFilmWidth || '').toLowerCase().includes(s) &&
                    !String(item.bottomFilmWidth || '').toLowerCase().includes(s)) {
                    return;
                }
            }

            if (item.topFilmWidth && String(item.topFilmWidth) !== 'NILL' && (item.topInwardMeters || 0) > 0) {
                list.push({
                    id: `spec_top_${item.id}`,
                    type: 'BASE_SPEC',
                    brand: b,
                    date: 'Initial Base Spec',
                    profileCode: item.profileCode,
                    description: `${item.description} (Top Film)`,
                    filmWidth: String(item.topFilmWidth),
                    side: 'TOP',
                    meters: item.topInwardMeters || 0,
                    rollCount: Math.max(1, Math.round((item.topInwardMeters || 0) / 5000)),
                    supplier: 'Base Spec Allocation',
                    refNo: `SPEC-${item.profileCode}`,
                    notes: `${item.series} - Initial allocation`
                });
            }

            if (item.bottomFilmWidth && String(item.bottomFilmWidth) !== 'NILL' && (item.bottomInwardMeters || 0) > 0) {
                list.push({
                    id: `spec_bot_${item.id}`,
                    type: 'BASE_SPEC',
                    brand: b,
                    date: 'Initial Base Spec',
                    profileCode: item.profileCode,
                    description: `${item.description} (Bottom Film)`,
                    filmWidth: String(item.bottomFilmWidth),
                    side: 'BOTTOM',
                    meters: item.bottomInwardMeters || 0,
                    rollCount: Math.max(1, Math.round((item.bottomInwardMeters || 0) / 5000)),
                    supplier: 'Base Spec Allocation',
                    refNo: `SPEC-${item.profileCode}`,
                    notes: `${item.series} - Initial allocation`
                });
            }
        });

        return list;
    }, [protectiveFilmInwardTransactions, calculatedRows, profiles, protectiveFilmItems, modalBrandFilter, modalSearchTerm]);

    // Drilldown 2: Consumed Outward Detailed List
    const outwardDrilldownList = useMemo(() => {
        const list: Array<{
            id: string;
            type: 'EXTRUSION_AUTO' | 'MANUAL_ADJ';
            brand: string;
            date: string;
            profileCode: string;
            description: string;
            filmWidth: string;
            meters: number;
            lengths: number;
            reason: string;
            refNo: string;
            notes: string;
            rawAdj?: ProtectiveFilmOutwardAdjustment;
        }> = [];

        // Extrusion Auto-Deductions
        calculatedRows.forEach(item => {
            const prof = profiles.find(p => !p.deletedAt && String(p.sku || '').toUpperCase() === String(item.profileCode || '').toUpperCase() && (normBrand(p.brand) === normBrand(item.brand) || !item.brand || item.brand === 'All')) ||
                         profiles.find(p => !p.deletedAt && String(p.sku || '').toUpperCase() === String(item.profileCode || '').toUpperCase());
            const b = item.brand && item.brand !== 'All' ? String(item.brand) : String(prof?.brand || 'Scraft');
            if (modalBrandFilter !== 'All' && b.toLowerCase() !== String(modalBrandFilter).toLowerCase()) return;

            if (modalSearchTerm) {
                const s = modalSearchTerm.toLowerCase();
                if (!b.toLowerCase().includes(s) && 
                    !String(item.profileCode || '').toLowerCase().includes(s) && 
                    !String(item.description || '').toLowerCase().includes(s) && 
                    !String(item.series || '').toLowerCase().includes(s)) {
                    return;
                }
            }

            if (item.topOutwardMtrs > 0) {
                list.push({
                    id: `out_top_${item.id}`,
                    type: 'EXTRUSION_AUTO',
                    brand: b,
                    date: 'Live Extrusion Sync',
                    profileCode: item.profileCode,
                    description: `${item.description} (Top: ${item.topFilmWidth}mm)`,
                    filmWidth: String(item.topFilmWidth),
                    meters: item.topOutwardMtrs,
                    lengths: item.activeLengths,
                    reason: 'EXTRUSION PRODUCTION',
                    refNo: `AUTO-EXT-${item.profileCode}`,
                    notes: `${item.activeLengths} lengths produced`
                });
            }

            if (item.bottomOutwardMtrs > 0) {
                list.push({
                    id: `out_bot_${item.id}`,
                    type: 'EXTRUSION_AUTO',
                    brand: b,
                    date: 'Live Extrusion Sync',
                    profileCode: item.profileCode,
                    description: `${item.description} (Bottom: ${item.bottomFilmWidth}mm)`,
                    filmWidth: String(item.bottomFilmWidth),
                    meters: item.bottomOutwardMtrs,
                    lengths: item.activeLengths,
                    reason: 'EXTRUSION PRODUCTION',
                    refNo: `AUTO-EXT-${item.profileCode}`,
                    notes: `${item.activeLengths} lengths produced`
                });
            }
        });

        // Manual Outward Adjustments
        protectiveFilmOutwardAdjustments.forEach(adj => {
            if (adj.deletedAt) return;
            const b = String(adj.brand || 'Scraft');
            if (modalBrandFilter !== 'All' && b.toLowerCase() !== String(modalBrandFilter).toLowerCase()) return;

            const prof = profiles.find(p => !p.deletedAt && (String(p.sku || '').toLowerCase() === String(adj.refNo || '').toLowerCase() || String(p.sku || '').toLowerCase() === String(adj.notes || '').toLowerCase()));
            const pItem = protectiveFilmItems.find(p => String(p.topFilmWidth || '') === String(adj.filmWidth || '') || String(p.bottomFilmWidth || '') === String(adj.filmWidth || ''));
            const code = prof?.sku || pItem?.profileCode || `${adj.filmWidth}mm Roll`;
            const desc = prof?.name || pItem?.description || adj.notes || `${adj.reason} Adjustment`;

            if (modalSearchTerm) {
                const s = modalSearchTerm.toLowerCase();
                if (!b.toLowerCase().includes(s) && 
                    !String(code || '').toLowerCase().includes(s) && 
                    !String(desc || '').toLowerCase().includes(s) && 
                    !String(adj.filmWidth || '').toLowerCase().includes(s) &&
                    !String(adj.refNo || '').toLowerCase().includes(s) &&
                    !String(adj.reason || '').toLowerCase().includes(s)) {
                    return;
                }
            }

            list.push({
                id: adj.id,
                type: 'MANUAL_ADJ',
                brand: b,
                date: adj.date,
                profileCode: code,
                description: desc,
                filmWidth: String(adj.filmWidth || ''),
                meters: Number(adj.meters || 0),
                lengths: Math.floor(Number(adj.meters || 0) / 5.9),
                reason: adj.reason,
                refNo: adj.refNo,
                notes: adj.notes,
                rawAdj: adj
            });
        });

        return list;
    }, [calculatedRows, protectiveFilmOutwardAdjustments, profiles, protectiveFilmItems, modalBrandFilter, modalSearchTerm]);

    // Drilldown 3: Live Net Balance Breakdown
    const balanceDrilldownList = useMemo(() => {
        return calculatedRows.filter(item => {
            const prof = profiles.find(p => !p.deletedAt && String(p.sku || '').toUpperCase() === String(item.profileCode || '').toUpperCase() && (normBrand(p.brand) === normBrand(item.brand) || !item.brand || item.brand === 'All')) ||
                         profiles.find(p => !p.deletedAt && String(p.sku || '').toUpperCase() === String(item.profileCode || '').toUpperCase());
            const b = item.brand && item.brand !== 'All' ? String(item.brand) : String(prof?.brand || 'Scraft');
            if (modalBrandFilter !== 'All' && b.toLowerCase() !== String(modalBrandFilter).toLowerCase()) return false;

            if (modalSearchTerm) {
                const s = modalSearchTerm.toLowerCase();
                return b.toLowerCase().includes(s) ||
                    String(item.profileCode || '').toLowerCase().includes(s) ||
                    String(item.description || '').toLowerCase().includes(s) ||
                    String(item.series || '').toLowerCase().includes(s) ||
                    String(item.topFilmWidth || '').toLowerCase().includes(s) ||
                    String(item.bottomFilmWidth || '').toLowerCase().includes(s);
            }
            return true;
        });
    }, [calculatedRows, profiles, modalBrandFilter, modalSearchTerm]);

    // Drilldown 4: Width Types Breakdown
    const widthDrilldownList = useMemo(() => {
        return rollInventorySummary.filter(roll => {
            if (modalSearchTerm) {
                const s = modalSearchTerm.toLowerCase();
                return roll.width.toLowerCase().includes(s) ||
                    roll.profilesUsing.some(p => p.toLowerCase().includes(s));
            }
            return true;
        });
    }, [rollInventorySummary, modalSearchTerm]);

    // Drilldown 5: Low Stock Alerts Breakdown (< 1000m)
    const lowStockDrilldownList = useMemo(() => {
        const list: Array<{
            id: string;
            name: string;
            brand: string;
            width: string;
            balanceMtrs: number;
            deficitMtrs: number;
            type: 'ROLL_SIZE' | 'PROFILE_ITEM';
            equivalentLengths: number;
            urgency: 'CRITICAL' | 'WARNING';
        }> = [];

        // 1. Roll Sizes below 1,000m
        rollInventorySummary.forEach(r => {
            if (r.balanceMtrs < 1000) {
                const rawW = r.width.replace(' mm', '');
                list.push({
                    id: `low_roll_${r.width}`,
                    name: `${r.width} Protective Film Roll`,
                    brand: modalBrandFilter !== 'All' ? modalBrandFilter : 'General',
                    width: rawW,
                    balanceMtrs: r.balanceMtrs,
                    deficitMtrs: Math.max(0, 1000 - r.balanceMtrs),
                    type: 'ROLL_SIZE',
                    equivalentLengths: r.equivalentLengths,
                    urgency: r.balanceMtrs < 500 ? 'CRITICAL' : 'WARNING'
                });
            }
        });

        // 2. Profile Items with low balance
        calculatedRows.forEach(item => {
            const prof = profiles.find(p => !p.deletedAt && p.sku?.toUpperCase() === item.profileCode?.toUpperCase() && (normBrand(p.brand) === normBrand(item.brand) || !item.brand || item.brand === 'All')) ||
                         profiles.find(p => !p.deletedAt && p.sku?.toUpperCase() === item.profileCode?.toUpperCase());
            const b = item.brand && item.brand !== 'All' ? item.brand : (prof?.brand || 'Scraft');
            if (modalBrandFilter !== 'All' && b.toLowerCase() !== modalBrandFilter.toLowerCase()) return;

            if (item.topFilmWidth && item.topFilmWidth !== 'NILL' && item.topBalanceMtrs < 1000) {
                list.push({
                    id: `low_prof_top_${item.id}`,
                    name: `${item.description} (Top: ${item.topFilmWidth}mm)`,
                    brand: b,
                    width: item.topFilmWidth,
                    balanceMtrs: item.topBalanceMtrs,
                    deficitMtrs: Math.max(0, 1000 - item.topBalanceMtrs),
                    type: 'PROFILE_ITEM',
                    equivalentLengths: item.topLengthsRemaining,
                    urgency: item.topBalanceMtrs < 500 ? 'CRITICAL' : 'WARNING'
                });
            }

            if (item.bottomFilmWidth && item.bottomFilmWidth !== 'NILL' && item.bottomBalanceMtrs < 1000) {
                list.push({
                    id: `low_prof_bot_${item.id}`,
                    name: `${item.description} (Bottom: ${item.bottomFilmWidth}mm)`,
                    brand: b,
                    width: item.bottomFilmWidth,
                    balanceMtrs: item.bottomBalanceMtrs,
                    deficitMtrs: Math.max(0, 1000 - item.bottomBalanceMtrs),
                    type: 'PROFILE_ITEM',
                    equivalentLengths: item.bottomLengthsRemaining,
                    urgency: item.bottomBalanceMtrs < 500 ? 'CRITICAL' : 'WARNING'
                });
            }
        });

        if (modalSearchTerm) {
            const s = modalSearchTerm.toLowerCase();
            return list.filter(i => 
                i.name.toLowerCase().includes(s) || 
                i.brand.toLowerCase().includes(s) || 
                i.width.toLowerCase().includes(s)
            );
        }

        return list;
    }, [rollInventorySummary, calculatedRows, profiles, modalBrandFilter, modalSearchTerm]);

    // Export to Excel
    const handleExportExcel = () => {
        const dataRows: any[] = [];
        calculatedRows.forEach(r => {
            dataRows.push({
                'S.No': r.sNo,
                'Series': r.series,
                'Description': r.description,
                'Profile Code': r.profileCode,
                'Packets': r.packets,
                'Qty / Pkt': r.lengthsPerPacket,
                'Length (Mtrs)': r.eachLengthMtrs,
                'Weight (kg)': r.lengthWeightWithGasket,
                'Active Production Lengths': r.activeLengths,
                'Top Film Width (mm)': r.topFilmWidth,
                'Top Inward (Mtrs)': r.topInwardMeters,
                'Top Outward Consumed (Mtrs)': r.topOutwardMtrs.toFixed(2),
                'Top Balance (Mtrs)': r.topBalanceMtrs.toFixed(2),
                'Bottom Film Width (mm)': r.bottomFilmWidth,
                'Bottom Inward (Mtrs)': r.bottomInwardMeters,
                'Bottom Outward Consumed (Mtrs)': r.bottomOutwardMtrs.toFixed(2),
                'Bottom Balance (Mtrs)': r.bottomBalanceMtrs.toFixed(2),
                'Total Inward (Mtrs)': r.totalInwardMtrs,
                'Total Outward Consumed (Mtrs)': r.totalOutwardMtrs.toFixed(2),
                'Net Balance (Mtrs)': r.totalBalanceMtrs.toFixed(2)
            });
        });

        const ws = XLSX.utils.json_to_sheet(dataRows);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Protective Films Matrix');

        const rollSummaryData = rollInventorySummary.map(r => ({
            'Film Width': r.width,
            'Profiles Applied': r.profilesUsing.join(', '),
            'Base / Initial Inward (Mtrs)': r.totalInwardMtrs - r.manualInwardMtrs,
            'Extra Roll Receipts (Mtrs)': r.manualInwardMtrs,
            'Total Inward (Mtrs)': r.totalInwardMtrs,
            'Auto Outward Consumed (Mtrs)': r.totalOutwardMtrs - r.manualAdjMtrs,
            'Wastage / Manual Adj (Mtrs)': r.manualAdjMtrs,
            'Total Outward (Mtrs)': r.totalOutwardMtrs,
            'Live Balance (Mtrs)': r.balanceMtrs,
            'Remaining Profile Lengths': r.equivalentLengths
        }));
        const wsSummary = XLSX.utils.json_to_sheet(rollSummaryData);
        XLSX.utils.book_append_sheet(wb, wsSummary, 'Roll Inventory');

        XLSX.writeFile(wb, `Protective_Films_Stock_${selectedBrand}_${new Date().toISOString().split('T')[0]}.xlsx`);
    };

    // Export Active Drilldown Modal Data to Excel
    const handleExportDrilldownExcel = () => {
        if (!activeKpiModal) return;
        const wb = XLSX.utils.book_new();

        if (activeKpiModal === 'TOTAL_INWARD') {
            const rows = inwardDrilldownList.map(r => ({
                'Source Type': r.type === 'ROLL_RECEIPT' ? 'Inward Roll Receipt' : 'Base Specification Allocation',
                'Date': r.date,
                'Brand': r.brand,
                'Profile Code': r.profileCode,
                'Description': r.description,
                'Film Width (mm)': r.filmWidth,
                'Side': r.side,
                'Inward Meters': r.meters,
                'Rolls': r.rollCount,
                'Supplier': r.supplier,
                'Reference / Invoice': r.refNo,
                'Notes': r.notes
            }));
            const ws = XLSX.utils.json_to_sheet(rows);
            XLSX.utils.book_append_sheet(wb, ws, 'Total Inward Drilldown');
        } else if (activeKpiModal === 'CONSUMED_OUTWARD') {
            const rows = outwardDrilldownList.map(r => ({
                'Source Type': r.type === 'EXTRUSION_AUTO' ? 'Extrusion Production Auto-Deduction' : 'Manual Scrap / Wastage',
                'Date': r.date,
                'Brand': r.brand,
                'Profile Code': r.profileCode,
                'Description': r.description,
                'Film Width (mm)': r.filmWidth,
                'Consumed (Mtrs)': r.meters,
                'Equivalent Lengths': r.lengths,
                'Reason': r.reason,
                'Ref No': r.refNo,
                'Notes': r.notes
            }));
            const ws = XLSX.utils.json_to_sheet(rows);
            XLSX.utils.book_append_sheet(wb, ws, 'Consumed Outward Drilldown');
        } else if (activeKpiModal === 'LIVE_NET_BALANCE') {
            const rows = balanceDrilldownList.map(r => ({
                'Series': r.series,
                'Profile Code': r.profileCode,
                'Description': r.description,
                'Brand': r.brand || 'Scraft',
                'Top Width (mm)': r.topFilmWidth,
                'Top Inward (m)': r.topInwardMeters,
                'Top Consumed (m)': r.topOutwardMtrs,
                'Top Balance (m)': r.topBalanceMtrs,
                'Bottom Width (mm)': r.bottomFilmWidth,
                'Bottom Inward (m)': r.bottomInwardMeters,
                'Bottom Consumed (m)': r.bottomOutwardMtrs,
                'Bottom Balance (m)': r.bottomBalanceMtrs,
                'Net Balance (m)': r.totalBalanceMtrs,
                'Remaining Lengths': Math.round(r.totalBalanceMtrs / 5.9)
            }));
            const ws = XLSX.utils.json_to_sheet(rows);
            XLSX.utils.book_append_sheet(wb, ws, 'Live Net Balance Drilldown');
        } else if (activeKpiModal === 'FILM_WIDTH_TYPES') {
            const rows = widthDrilldownList.map(r => ({
                'Film Width': r.width,
                'Profiles Applied': r.profilesUsing.join(', '),
                'Total Inward (m)': r.totalInwardMtrs,
                'Total Outward (m)': r.totalOutwardMtrs,
                'Live Balance (m)': r.balanceMtrs,
                'Rolls (~5000m)': Math.max(1, Math.round(r.balanceMtrs / 5000)),
                'Remaining Profile Lengths': r.equivalentLengths
            }));
            const ws = XLSX.utils.json_to_sheet(rows);
            XLSX.utils.book_append_sheet(wb, ws, 'Width Types Drilldown');
        } else if (activeKpiModal === 'PROFILE_ITEMS') {
            const rows = calculatedRows.map(r => ({
                'S.No': r.sNo,
                'Series': r.series,
                'Description': r.description,
                'Profile Code': r.profileCode,
                'Top Width': r.topFilmWidth,
                'Top Inward': r.topInwardMeters,
                'Top Outward': r.topOutwardMtrs,
                'Top Balance': r.topBalanceMtrs,
                'Bottom Width': r.bottomFilmWidth,
                'Bottom Inward': r.bottomInwardMeters,
                'Bottom Outward': r.bottomOutwardMtrs,
                'Bottom Balance': r.bottomBalanceMtrs,
                'Net Balance': r.totalBalanceMtrs
            }));
            const ws = XLSX.utils.json_to_sheet(rows);
            XLSX.utils.book_append_sheet(wb, ws, 'Profile Items Specs');
        } else if (activeKpiModal === 'LOW_STOCK_ALERTS') {
            const rows = lowStockDrilldownList.map(r => ({
                'Item / Roll Name': r.name,
                'Brand': r.brand,
                'Film Width (mm)': r.width,
                'Current Balance (m)': r.balanceMtrs,
                'Target Safety (m)': 1000,
                'Deficit Required (m)': r.deficitMtrs,
                'Urgency': r.urgency
            }));
            const ws = XLSX.utils.json_to_sheet(rows);
            XLSX.utils.book_append_sheet(wb, ws, 'Low Stock Alerts');
        }

        XLSX.writeFile(wb, `Protective_Films_${activeKpiModal}_Drilldown_${modalBrandFilter}_${new Date().toISOString().split('T')[0]}.xlsx`);
    };

    // Handle Item selection in Inward Form
    const handleSelectProfileInInward = (profileId: string) => {
        if (!profileId) {
            setInwardForm(prev => ({ ...prev, selectedProfileId: '' }));
            return;
        }

        // Search in protectiveFilmItems first
        const pItem = protectiveFilmItems.find(p => p.id === profileId || p.profileCode.toLowerCase() === profileId.toLowerCase());
        const masterProf = profiles.find(p => !p.deletedAt && (p.id === profileId || p.sku.toLowerCase() === profileId.toLowerCase()));

        const brand = pItem?.brand || masterProf?.brand || inwardForm.brand;
        let chosenWidth = inwardForm.filmWidth;

        if (pItem) {
            if (pItem.topFilmWidth && pItem.topFilmWidth !== 'NILL') {
                chosenWidth = pItem.topFilmWidth;
            } else if (pItem.bottomFilmWidth && pItem.bottomFilmWidth !== 'NILL') {
                chosenWidth = pItem.bottomFilmWidth;
            }
        }

        setInwardForm(prev => ({
            ...prev,
            selectedProfileId: profileId,
            brand: brand !== 'All' ? brand : prev.brand,
            filmWidth: chosenWidth,
            customWidthInput: ''
        }));
    };

    // Save Inward receipt (Add or Update)
    const handleSaveInward = (e: React.FormEvent) => {
        e.preventDefault();
        const effectiveWidth = inwardForm.customWidthInput.trim() ? inwardForm.customWidthInput.trim() : inwardForm.filmWidth;
        if (!effectiveWidth || inwardForm.meters <= 0) return;

        if (editingInwardTx) {
            updateProtectiveFilmInward({
                ...editingInwardTx,
                brand: inwardForm.brand,
                filmWidth: effectiveWidth,
                side: inwardForm.side,
                meters: Number(inwardForm.meters),
                rollCount: Number(inwardForm.rollCount || 1),
                refNo: inwardForm.refNo,
                supplier: inwardForm.supplier,
                costPerMeter: Number(inwardForm.costPerMeter || 0),
                totalCost: Number(inwardForm.meters) * Number(inwardForm.costPerMeter || 0),
                notes: inwardForm.notes,
                date: inwardForm.date
            });
        } else {
            addProtectiveFilmInward({
                brand: inwardForm.brand,
                filmWidth: effectiveWidth,
                side: inwardForm.side,
                meters: Number(inwardForm.meters),
                rollCount: Number(inwardForm.rollCount || 1),
                refNo: inwardForm.refNo,
                supplier: inwardForm.supplier,
                costPerMeter: Number(inwardForm.costPerMeter || 0),
                totalCost: Number(inwardForm.meters) * Number(inwardForm.costPerMeter || 0),
                notes: inwardForm.notes,
                date: inwardForm.date
            });

            // If user checked "Update base specification inward meters for this profile item"
            if (inwardForm.updateItemBaseStock && inwardForm.selectedProfileId) {
                const targetItem = protectiveFilmItems.find(p => p.id === inwardForm.selectedProfileId || p.profileCode.toLowerCase() === inwardForm.selectedProfileId.toLowerCase());
                if (targetItem) {
                    if (inwardForm.side === 'TOP' || (targetItem.topFilmWidth === effectiveWidth)) {
                        updateProtectiveFilmItem({
                            ...targetItem,
                            topInwardMeters: (targetItem.topInwardMeters || 0) + Number(inwardForm.meters)
                        });
                    } else if (inwardForm.side === 'BOTTOM' || (targetItem.bottomFilmWidth === effectiveWidth)) {
                        updateProtectiveFilmItem({
                            ...targetItem,
                            bottomInwardMeters: (targetItem.bottomInwardMeters || 0) + Number(inwardForm.meters)
                        });
                    }
                }
            }
        }

        setIsInwardModalOpen(false);
        setEditingInwardTx(null);
    };

    // Save Adjustment (Add or Update)
    const handleSaveAdjustment = (e: React.FormEvent) => {
        e.preventDefault();
        const effectiveWidth = adjForm.customWidthInput.trim() ? adjForm.customWidthInput.trim() : adjForm.filmWidth;
        if (!effectiveWidth || adjForm.meters <= 0) return;

        if (editingAdjTx) {
            updateProtectiveFilmOutwardAdjustment({
                ...editingAdjTx,
                brand: adjForm.brand,
                filmWidth: effectiveWidth,
                meters: Number(adjForm.meters),
                reason: adjForm.reason,
                refNo: adjForm.refNo,
                notes: adjForm.notes,
                date: adjForm.date
            });
        } else {
            addProtectiveFilmOutwardAdjustment({
                brand: adjForm.brand,
                filmWidth: effectiveWidth,
                meters: Number(adjForm.meters),
                reason: adjForm.reason,
                refNo: adjForm.refNo,
                notes: adjForm.notes,
                date: adjForm.date
            });
        }

        setIsAdjustmentModalOpen(false);
        setEditingAdjTx(null);
    };

    // Save Edit/Add Item Specification
    const handleSaveItem = (e: React.FormEvent) => {
        e.preventDefault();
        if (!itemForm.description || !itemForm.profileCode) return;

        if (editingItem) {
            updateProtectiveFilmItem({
                ...editingItem,
                ...itemForm,
                sNo: Number(itemForm.sNo || editingItem.sNo),
                eachLengthMtrs: Number(itemForm.eachLengthMtrs || 5.9),
                topInwardMeters: Number(itemForm.topInwardMeters || 0),
                topMtrPerLength: Number(itemForm.topMtrPerLength || 5.9),
                topStickerName: itemForm.topStickerName || '',
                bottomInwardMeters: Number(itemForm.bottomInwardMeters || 0),
                bottomMtrPerLength: Number(itemForm.bottomMtrPerLength || 5.9),
                bottomStickerName: itemForm.bottomStickerName || '',
                brand: itemForm.brand || 'All'
            } as ProtectiveFilmItem);
        } else {
            addProtectiveFilmItem({
                sNo: Number(itemForm.sNo || protectiveFilmItems.length + 1),
                series: itemForm.series || '80.5 SERIES',
                description: itemForm.description,
                profileCode: itemForm.profileCode,
                packets: itemForm.packets || '',
                lengthsPerPacket: itemForm.lengthsPerPacket || 6,
                eachLengthMtrs: Number(itemForm.eachLengthMtrs || 5.9),
                meterWeight: itemForm.meterWeight || 0,
                lengthWeightWithGasket: itemForm.lengthWeightWithGasket || 0,
                topFilmWidth: itemForm.topFilmWidth || 'NILL',
                topInwardMeters: Number(itemForm.topInwardMeters || 5000),
                topMtrPerLength: Number(itemForm.topMtrPerLength || 5.9),
                topStickerName: itemForm.topStickerName || '',
                bottomFilmWidth: itemForm.bottomFilmWidth || 'NILL',
                bottomInwardMeters: Number(itemForm.bottomInwardMeters || 5000),
                bottomMtrPerLength: Number(itemForm.bottomMtrPerLength || 5.9),
                bottomStickerName: itemForm.bottomStickerName || '',
                brand: itemForm.brand || 'All'
            });
        }
        setIsEditProfileModalOpen(false);
        setIsAddProfileModalOpen(false);
        setEditingItem(null);
    };

    // Open Edit Inward Transaction
    const handleOpenEditInward = (tx: ProtectiveFilmInwardTransaction) => {
        setEditingInwardTx(tx);
        setInwardForm({
            selectedProfileId: '',
            brand: tx.brand,
            filmWidth: tx.filmWidth,
            customWidthInput: '',
            side: (tx.side as any) || 'GENERAL',
            meters: tx.meters,
            rollCount: tx.rollCount || 1,
            refNo: tx.refNo,
            supplier: tx.supplier || '',
            costPerMeter: tx.costPerMeter || 0,
            notes: tx.notes || '',
            date: tx.date,
            updateItemBaseStock: false
        });
        setIsInwardModalOpen(true);
    };

    // Open Edit Outward Adjustment
    const handleOpenEditAdjustment = (adj: ProtectiveFilmOutwardAdjustment) => {
        setEditingAdjTx(adj);
        setAdjForm({
            selectedProfileId: '',
            brand: adj.brand,
            filmWidth: adj.filmWidth,
            customWidthInput: '',
            meters: adj.meters,
            reason: adj.reason,
            refNo: adj.refNo,
            notes: adj.notes || '',
            date: adj.date,
            type: 'TOP'
        });
        setIsAdjustmentModalOpen(true);
    };

    // Open Edit Item Specification
    const handleOpenEditItem = (item: ProtectiveFilmItem) => {
        setEditingItem(item);
        setItemForm({ ...item });
        setIsEditProfileModalOpen(true);
    };

    const handlePrint = () => {
        window.print();
    };

    return (
        <div className="space-y-6">
            {/* Header Hero */}
            <div className="bg-gradient-to-br from-indigo-900 via-blue-900 to-slate-900 p-6 md:p-8 rounded-3xl text-white shadow-xl relative overflow-hidden border border-blue-800/40">
                <div className="absolute -top-16 -right-16 opacity-10 pointer-events-none">
                    <Shield className="w-80 h-80 text-blue-300" />
                </div>
                
                <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                    <div>
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/20 text-blue-200 text-xs font-black uppercase tracking-wider mb-3 border border-blue-400/20">
                            <Layers className="w-3.5 h-3.5" /> Protective Films & Sticker Management
                        </div>
                        <h2 className="text-2xl md:text-3xl font-black tracking-tight flex items-center gap-3">
                            Protective Films Ledger & Auto-Deduction Stock
                        </h2>
                        <p className="text-blue-200/80 text-sm max-w-2xl mt-1">
                            Live synchronization between profile production and protective film rolls. 
                            Top and bottom sticker rolls automatically deduct as profile lengths are added.
                        </p>
                    </div>

                    <div className="flex items-center gap-3 flex-wrap">
                        <button
                            onClick={() => {
                                setManageBrandsInitialTab('OVERVIEW');
                                setIsManageBrandsModalOpen(true);
                            }}
                            className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 shadow-lg shadow-blue-900/30 active:scale-95 cursor-pointer"
                            title="Manage Brands, Sticker Names, Sizes & Delete"
                        >
                            <Tag className="w-4 h-4" /> Manage Brands ({allAvailableBrands.length})
                        </button>

                        <button
                            onClick={() => {
                                setManageBrandsInitialTab('IMPORT_EXCEL');
                                setIsManageBrandsModalOpen(true);
                            }}
                            className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 shadow-lg shadow-indigo-900/30 active:scale-95 cursor-pointer"
                            title="Import Excel sheet to auto update film sizes brand-wise & stock"
                        >
                            <FileSpreadsheet className="w-4 h-4" /> Import Excel Sheet
                        </button>

                        <button
                            onClick={() => {
                                setEditingInwardTx(null);
                                setInwardForm({
                                    selectedProfileId: '',
                                    brand: selectedBrand === 'All' ? 'Scraft' : selectedBrand,
                                    filmWidth: '38',
                                    customWidthInput: '',
                                    side: 'GENERAL',
                                    meters: 5000,
                                    rollCount: 1,
                                    refNo: `ROLL-IN-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`,
                                    supplier: '',
                                    costPerMeter: 0,
                                    notes: '',
                                    date: new Date().toISOString().split('T')[0],
                                    updateItemBaseStock: false
                                });
                                setIsInwardModalOpen(true);
                            }}
                            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 shadow-lg shadow-emerald-900/30 active:scale-95 cursor-pointer"
                        >
                            <ArrowDownRight className="w-4 h-4" /> Record Inward Roll
                        </button>

                        <button
                            onClick={() => {
                                setEditingAdjTx(null);
                                setAdjForm({
                                    selectedProfileId: '',
                                    brand: selectedBrand === 'All' ? 'Scraft' : selectedBrand,
                                    filmWidth: '38',
                                    customWidthInput: '',
                                    meters: 50,
                                    reason: 'SCRAP',
                                    refNo: `ADJ-${Math.floor(1000 + Math.random() * 9000)}`,
                                    notes: '',
                                    date: new Date().toISOString().split('T')[0],
                                    type: 'TOP'
                                });
                                setIsAdjustmentModalOpen(true);
                            }}
                            className="px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 shadow-lg shadow-amber-900/30 active:scale-95 cursor-pointer"
                        >
                            <ArrowUpRight className="w-4 h-4" /> Record Outward / Wastage
                        </button>

                        <button
                            onClick={handleExportExcel}
                            className="px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 border border-white/20 active:scale-95 cursor-pointer"
                            title="Export Protective Films to XLSX"
                        >
                            <Download className="w-4 h-4" /> Export XLSX
                        </button>

                        <button
                            onClick={handlePrint}
                            className="px-3.5 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-1.5 border border-white/20 active:scale-95 cursor-pointer"
                            title="Print Ledger"
                        >
                            <Printer className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                {/* Interactive KPI Switcher Cards Row */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mt-6 pt-6 border-t border-white/10">
                    {/* Card 1: Total Inward Switch */}
                    <button
                        onClick={() => {
                            setActiveKpiModal('TOTAL_INWARD');
                            setModalBrandFilter(selectedBrand);
                            setModalSearchTerm('');
                            setSubTab('INWARD_LOG');
                            setShowLowStockOnly(false);
                        }}
                        className={`group relative text-left p-3.5 rounded-2xl border transition-all duration-200 cursor-pointer active:scale-95 focus:outline-none ${
                            activeKpiModal === 'TOTAL_INWARD' || (subTab === 'INWARD_LOG' && !showLowStockOnly)
                                ? 'bg-white/20 border-emerald-400 ring-2 ring-emerald-400/80 shadow-lg shadow-emerald-950/40'
                                : 'bg-white/5 hover:bg-white/12 border-white/10 hover:border-white/25'
                        }`}
                        title="Click to inspect all Inward receipts & brand-wise breakdown"
                    >
                        <div className="flex items-center justify-between">
                            <span className="text-[10px] uppercase font-black tracking-wider text-blue-300">Total Inward</span>
                            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                        </div>
                        <div className="text-lg font-black text-white mt-0.5 font-mono">
                            {stats.totalInwardMtrs.toLocaleString()} <span className="text-xs font-normal opacity-75">m</span>
                        </div>
                        <div className="text-[10px] text-blue-200/80 mt-1 flex items-center justify-between">
                            <span>Total received</span>
                            <span className="opacity-0 group-hover:opacity-100 transition-opacity font-bold text-[9px] text-emerald-300">Inspect & Brand →</span>
                        </div>
                    </button>

                    {/* Card 2: Consumed Outward Switch */}
                    <button
                        onClick={() => {
                            setActiveKpiModal('CONSUMED_OUTWARD');
                            setModalBrandFilter(selectedBrand);
                            setModalSearchTerm('');
                            setSubTab('OUTWARD_LOG');
                            setShowLowStockOnly(false);
                        }}
                        className={`group relative text-left p-3.5 rounded-2xl border transition-all duration-200 cursor-pointer active:scale-95 focus:outline-none ${
                            activeKpiModal === 'CONSUMED_OUTWARD' || (subTab === 'OUTWARD_LOG' && !showLowStockOnly)
                                ? 'bg-white/20 border-amber-400 ring-2 ring-amber-400/80 shadow-lg shadow-amber-950/40'
                                : 'bg-white/5 hover:bg-white/12 border-white/10 hover:border-white/25'
                        }`}
                        title="Click to inspect all Outward consumption & brand-wise breakdown"
                    >
                        <div className="flex items-center justify-between">
                            <span className="text-[10px] uppercase font-black tracking-wider text-amber-300">Consumed Outward</span>
                            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></span>
                        </div>
                        <div className="text-lg font-black text-amber-200 mt-0.5 font-mono">
                            {stats.totalOutwardMtrs.toLocaleString(undefined, { maximumFractionDigits: 1 })} <span className="text-xs font-normal opacity-75">m</span>
                        </div>
                        <div className="text-[10px] text-amber-200/80 mt-1 flex items-center justify-between">
                            <span>Auto-deducted</span>
                            <span className="opacity-0 group-hover:opacity-100 transition-opacity font-bold text-[9px] text-amber-300">Inspect & Brand →</span>
                        </div>
                    </button>

                    {/* Card 3: Live Net Balance Switch */}
                    <button
                        onClick={() => {
                            setActiveKpiModal('LIVE_NET_BALANCE');
                            setModalBrandFilter(selectedBrand);
                            setModalSearchTerm('');
                            setSubTab('ROLL_INVENTORY');
                            setShowLowStockOnly(false);
                            setSelectedWidthFilter('All');
                        }}
                        className={`group relative text-left p-3.5 rounded-2xl border transition-all duration-200 cursor-pointer active:scale-95 focus:outline-none ${
                            activeKpiModal === 'LIVE_NET_BALANCE' || (subTab === 'ROLL_INVENTORY' && !showLowStockOnly && selectedWidthFilter === 'All')
                                ? 'bg-white/20 border-emerald-400 ring-2 ring-emerald-400/80 shadow-lg shadow-emerald-950/40'
                                : 'bg-white/5 hover:bg-white/12 border-white/10 hover:border-white/25'
                        }`}
                        title="Click to inspect Live Net Balance across all items & brands"
                    >
                        <div className="flex items-center justify-between">
                            <span className="text-[10px] uppercase font-black tracking-wider text-emerald-300">Live Net Balance</span>
                            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                        </div>
                        <div className="text-lg font-black text-emerald-300 mt-0.5 font-mono">
                            {stats.netBalanceMtrs.toLocaleString(undefined, { maximumFractionDigits: 1 })} <span className="text-xs font-normal opacity-75">m</span>
                        </div>
                        <div className="text-[10px] text-emerald-200/80 mt-1 flex items-center justify-between">
                            <span>~{stats.totalRollsEst} standard rolls</span>
                            <span className="opacity-0 group-hover:opacity-100 transition-opacity font-bold text-[9px] text-emerald-300">Inspect & Brand →</span>
                        </div>
                    </button>

                    {/* Card 4: Film Width Types Switch */}
                    <button
                        onClick={() => {
                            setActiveKpiModal('FILM_WIDTH_TYPES');
                            setModalBrandFilter(selectedBrand);
                            setModalSearchTerm('');
                            setSubTab('ROLL_INVENTORY');
                            setShowLowStockOnly(false);
                        }}
                        className={`group relative text-left p-3.5 rounded-2xl border transition-all duration-200 cursor-pointer active:scale-95 focus:outline-none ${
                            activeKpiModal === 'FILM_WIDTH_TYPES' || (subTab === 'ROLL_INVENTORY' && !showLowStockOnly)
                                ? 'bg-white/20 border-indigo-400 ring-2 ring-indigo-400/80 shadow-lg shadow-indigo-950/40'
                                : 'bg-white/5 hover:bg-white/12 border-white/10 hover:border-white/25'
                        }`}
                        title="Click to inspect all Film Widths, sizes & brand utilization"
                    >
                        <div className="flex items-center justify-between">
                            <span className="text-[10px] uppercase font-black tracking-wider text-indigo-300">Film Width Types</span>
                            <span className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse"></span>
                        </div>
                        <div className="text-lg font-black text-white mt-0.5 font-mono">
                            {stats.activeFilmWidthsCount} <span className="text-xs font-normal opacity-75">sizes</span>
                        </div>
                        <div className="text-[10px] text-indigo-200/80 mt-1 flex items-center justify-between">
                            <span>19mm to 100mm</span>
                            <span className="opacity-0 group-hover:opacity-100 transition-opacity font-bold text-[9px] text-indigo-300">Inspect Sizes →</span>
                        </div>
                    </button>

                    {/* Card 5: Profile Items Switch */}
                    <button
                        onClick={() => {
                            setActiveKpiModal('PROFILE_ITEMS');
                            setModalBrandFilter(selectedBrand);
                            setModalSearchTerm('');
                            setSubTab('SPECIFICATIONS');
                            setShowLowStockOnly(false);
                            setSelectedSeries('All');
                            setSelectedWidthFilter('All');
                        }}
                        className={`group relative text-left p-3.5 rounded-2xl border transition-all duration-200 cursor-pointer active:scale-95 focus:outline-none ${
                            activeKpiModal === 'PROFILE_ITEMS' || (subTab === 'SPECIFICATIONS' && !showLowStockOnly)
                                ? 'bg-white/20 border-purple-400 ring-2 ring-purple-400/80 shadow-lg shadow-purple-950/40'
                                : 'bg-white/5 hover:bg-white/12 border-white/10 hover:border-white/25'
                        }`}
                        title="Click to inspect Profile Specifications Matrix & brand allocations"
                    >
                        <div className="flex items-center justify-between">
                            <span className="text-[10px] uppercase font-black tracking-wider text-purple-300">Profile Items</span>
                            <span className="w-2 h-2 rounded-full bg-purple-400 animate-pulse"></span>
                        </div>
                        <div className="text-lg font-black text-white mt-0.5 font-mono">
                            {protectiveFilmItems.length} <span className="text-xs font-normal opacity-75">specs</span>
                        </div>
                        <div className="text-[10px] text-purple-200/80 mt-1 flex items-center justify-between">
                            <span>{seriesList.length} Series Groups</span>
                            <span className="opacity-0 group-hover:opacity-100 transition-opacity font-bold text-[9px] text-purple-300">Inspect Matrix →</span>
                        </div>
                    </button>

                    {/* Card 6: Low Stock Alerts Switch */}
                    <button
                        onClick={() => {
                            setActiveKpiModal('LOW_STOCK_ALERTS');
                            setModalBrandFilter(selectedBrand);
                            setModalSearchTerm('');
                            setShowLowStockOnly(true);
                            if (subTab !== 'ROLL_INVENTORY' && subTab !== 'SPECIFICATIONS') {
                                setSubTab('ROLL_INVENTORY');
                            }
                        }}
                        className={`group relative text-left p-3.5 rounded-2xl border transition-all duration-200 cursor-pointer active:scale-95 focus:outline-none ${
                            activeKpiModal === 'LOW_STOCK_ALERTS' || showLowStockOnly
                                ? 'bg-rose-500/25 border-rose-400 ring-2 ring-rose-400/80 shadow-lg shadow-rose-950/50'
                                : 'bg-white/5 hover:bg-white/12 border-white/10 hover:border-white/25'
                        }`}
                        title="Click to inspect Low Stock (< 1,000m) items with brand-wise breakdown"
                    >
                        <div className="flex items-center justify-between">
                            <span className="text-[10px] uppercase font-black tracking-wider text-rose-300">Low Stock Alerts</span>
                            <span className="px-1.5 py-0.5 rounded bg-rose-500 text-white font-black text-[8px] uppercase tracking-wider">
                                {stats.lowStockRolls > 0 ? 'ALERT' : 'OK'}
                            </span>
                        </div>
                        <div className={`text-lg font-black mt-0.5 font-mono ${stats.lowStockRolls > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                            {stats.lowStockRolls} <span className="text-xs font-normal opacity-75">rolls</span>
                        </div>
                        <div className="text-[10px] text-rose-200/80 mt-1 flex items-center justify-between">
                            <span>&lt; 1,000m remaining</span>
                            <span className="opacity-0 group-hover:opacity-100 transition-opacity font-bold text-[9px] text-rose-300">
                                Inspect Alerts →
                            </span>
                        </div>
                    </button>
                </div>

                {/* Brand-Wise Live Overview Bar */}
                <div className="mt-4 pt-3 border-t border-white/10">
                    <div className="flex items-center justify-between gap-2 mb-2">
                        <span className="text-[10px] font-black uppercase tracking-wider text-blue-200 flex items-center gap-1.5">
                            <Building2 className="w-3.5 h-3.5 text-blue-300" /> Brand-Wise Stock Overview:
                        </span>
                        <span className="text-[9px] text-blue-300/80 font-medium">Click any brand to filter view or click KPI card to inspect details</span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
                        {/* All Brands Tile */}
                        <button
                            onClick={() => setSelectedBrand('All')}
                            className={`p-2.5 rounded-xl border text-left transition-all ${
                                selectedBrand === 'All'
                                    ? 'bg-white/20 border-white/40 ring-1 ring-white/50 shadow-md'
                                    : 'bg-white/5 hover:bg-white/10 border-white/10'
                            }`}
                        >
                            <div className="flex items-center justify-between">
                                <span className="text-[10px] font-black text-white uppercase">All Brands</span>
                                <span className="text-[8px] px-1.5 py-0.2 bg-blue-500/40 text-blue-200 rounded font-bold">{allAvailableBrands.length} Brands</span>
                            </div>
                            <div className="text-sm font-black text-emerald-300 font-mono mt-1">
                                {stats.netBalanceMtrs.toLocaleString(undefined, { maximumFractionDigits: 0 })} <span className="text-[9px] font-normal text-white/70">m net</span>
                            </div>
                            <div className="flex items-center justify-between text-[8px] text-white/70 mt-0.5">
                                <span>In: {stats.totalInwardMtrs.toLocaleString(undefined, { maximumFractionDigits: 0 })}m</span>
                                <span>Out: {stats.totalOutwardMtrs.toLocaleString(undefined, { maximumFractionDigits: 0 })}m</span>
                            </div>
                        </button>

                        {/* Individual Brand Tiles */}
                        {allAvailableBrands.map(b => {
                            const m = brandWiseMetrics[b] || { inwardMtrs: 0, outwardMtrs: 0, balanceMtrs: 0, profileCount: 0, lowStockCount: 0 };
                            const isSelected = selectedBrand.toLowerCase() === b.toLowerCase();
                            return (
                                <button
                                    key={b}
                                    onClick={() => setSelectedBrand(b)}
                                    className={`p-2.5 rounded-xl border text-left transition-all relative ${
                                        isSelected
                                            ? 'bg-blue-600/40 border-blue-400 ring-2 ring-blue-400/80 shadow-md'
                                            : 'bg-white/5 hover:bg-white/10 border-white/10'
                                    }`}
                                >
                                    <div className="flex items-center justify-between">
                                        <span className="text-[10px] font-black text-white uppercase truncate">{b}</span>
                                        {m.lowStockCount > 0 ? (
                                            <span className="text-[8px] px-1.5 py-0.2 bg-rose-500/80 text-white rounded font-bold">
                                                {m.lowStockCount} Low
                                            </span>
                                        ) : (
                                            <span className="text-[8px] px-1.5 py-0.2 bg-emerald-500/30 text-emerald-200 rounded font-bold">
                                                OK
                                            </span>
                                        )}
                                    </div>
                                    <div className="text-sm font-black text-blue-200 font-mono mt-1">
                                        {m.balanceMtrs.toLocaleString(undefined, { maximumFractionDigits: 0 })} <span className="text-[9px] font-normal text-white/70">m</span>
                                    </div>
                                    <div className="flex items-center justify-between text-[8px] text-white/70 mt-0.5">
                                        <span>In: {m.inwardMtrs.toLocaleString(undefined, { maximumFractionDigits: 0 })}m</span>
                                        <span>Out: {m.outwardMtrs.toLocaleString(undefined, { maximumFractionDigits: 0 })}m</span>
                                    </div>
                                </button>
                            );
                        })}

                        {/* Manage Brands Quick Button */}
                        <button
                            onClick={() => setIsManageBrandsModalOpen(true)}
                            className="p-2.5 rounded-xl border border-dashed border-white/20 hover:border-white/50 bg-white/5 hover:bg-white/10 text-left transition-all flex flex-col justify-center items-center gap-1 group cursor-pointer"
                            title="Manage Brands, Sticker Sizes & Names"
                        >
                            <Sliders className="w-4 h-4 text-blue-300 group-hover:scale-110 transition-transform" />
                            <span className="text-[10px] font-bold text-white/90 uppercase tracking-tight text-center">Manage Brands</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* Brand Filter & Calculation Mode Toolbar */}
            <div className="bg-white dark:bg-gray-800 p-4 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm space-y-3">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    {/* Brand Selector */}
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-black uppercase tracking-wider text-gray-500 flex items-center gap-1.5">
                            <Tag className="w-3.5 h-3.5 text-blue-500" /> Extrusion Brand:
                        </span>
                        <div className="flex items-center gap-1 p-1 bg-gray-100 dark:bg-gray-900/60 rounded-xl flex-wrap">
                            <button
                                onClick={() => setSelectedBrand('All')}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                                    selectedBrand === 'All'
                                        ? 'bg-white dark:bg-gray-800 text-blue-600 shadow-sm'
                                        : 'text-gray-600 dark:text-gray-400 hover:text-gray-900'
                                }`}
                            >
                                All Brands
                                <span className="text-[10px] px-1.5 py-0.2 bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 rounded-full font-mono">
                                    {protectiveFilmItems.length}
                                </span>
                            </button>
                            {allAvailableBrands.map(b => {
                                const m = brandWiseMetrics[b];
                                return (
                                    <button
                                        key={b}
                                        onClick={() => setSelectedBrand(b)}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                                            selectedBrand.toLowerCase() === b.toLowerCase()
                                                ? 'bg-white dark:bg-gray-800 text-blue-600 shadow-sm'
                                                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900'
                                        }`}
                                    >
                                        {b}
                                        {m && m.lowStockCount > 0 && (
                                            <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping" title={`${m.lowStockCount} low stock items`} />
                                        )}
                                    </button>
                                );
                            })}

                            <button
                                onClick={() => setIsManageBrandsModalOpen(true)}
                                className="px-2.5 py-1.5 rounded-lg text-xs font-bold text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 transition-all flex items-center gap-1 border border-blue-200 dark:border-blue-800 cursor-pointer ml-1"
                                title="Manage Brands, Sticker Names & Delete Options"
                            >
                                <Sliders className="w-3 h-3" /> Manage Brands
                            </button>
                            <button
                                onClick={syncProfilesToStock}
                                className="px-2.5 py-1.5 rounded-lg text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 transition-all flex items-center gap-1 border border-emerald-200 dark:border-emerald-800 cursor-pointer ml-1"
                                title="Sync all profiles to stock inventory"
                            >
                                <RefreshCw className="w-3 h-3" /> Sync Stock
                            </button>
                        </div>
                    </div>

                    {/* Calculation Mode Selector */}
                    <div className="flex items-center gap-1.5 p-1 bg-gray-100 dark:bg-gray-900/60 rounded-xl">
                        <span className="text-[10px] font-black uppercase text-gray-400 px-2">Deduction Basis:</span>
                        <button
                            onClick={() => setCalcMode('LIVE_PRODUCTION')}
                            className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-tight transition-all ${
                                calcMode === 'LIVE_PRODUCTION'
                                    ? 'bg-white dark:bg-gray-800 text-emerald-600 shadow-sm'
                                    : 'text-gray-500 hover:text-gray-800 dark:hover:text-gray-200'
                            }`}
                            title="Auto-deducts sticker length based on cumulative extrusion production"
                        >
                            ⚡ Live Extrusion Production
                        </button>
                        <button
                            onClick={() => setCalcMode('CURRENT_STOCK')}
                            className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-tight transition-all ${
                                calcMode === 'CURRENT_STOCK'
                                    ? 'bg-white dark:bg-gray-800 text-blue-600 shadow-sm'
                                    : 'text-gray-500 hover:text-gray-800 dark:hover:text-gray-200'
                            }`}
                            title="Calculates sticker applied to current stock inventory"
                        >
                            📦 Current Stock Basis
                        </button>
                        <button
                            onClick={() => setCalcMode('SIMULATION')}
                            className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-tight transition-all ${
                                calcMode === 'SIMULATION'
                                    ? 'bg-white dark:bg-gray-800 text-indigo-600 shadow-sm'
                                    : 'text-gray-500 hover:text-gray-800 dark:hover:text-gray-200'
                            }`}
                            title="Allows entering custom trial lengths to test roll requirements"
                        >
                            🎯 Simulation / Plan
                        </button>
                    </div>
                </div>

                {/* Sub-tab navigation */}
                <div className="flex items-center justify-between border-t border-gray-100 dark:border-gray-700 pt-3 flex-wrap gap-3">
                    <div className="flex items-center gap-1.5 p-1 bg-gray-100 dark:bg-gray-900/50 rounded-xl flex-wrap">
                        <button
                            onClick={() => setSubTab('SPECIFICATIONS')}
                            className={`px-3.5 py-1.5 rounded-lg text-xs font-black uppercase tracking-tight transition-all flex items-center gap-1.5 ${
                                subTab === 'SPECIFICATIONS'
                                    ? 'bg-white dark:bg-gray-800 text-blue-600 shadow-sm'
                                    : 'text-gray-500 hover:text-gray-800 dark:hover:text-gray-200'
                            }`}
                        >
                            <FileSpreadsheet className="w-3.5 h-3.5" /> Series & Profile Specifications Matrix ({protectiveFilmItems.length})
                        </button>
                        <button
                            onClick={() => setSubTab('ROLL_INVENTORY')}
                            className={`px-3.5 py-1.5 rounded-lg text-xs font-black uppercase tracking-tight transition-all flex items-center gap-1.5 ${
                                subTab === 'ROLL_INVENTORY'
                                    ? 'bg-white dark:bg-gray-800 text-blue-600 shadow-sm'
                                    : 'text-gray-500 hover:text-gray-800 dark:hover:text-gray-200'
                            }`}
                        >
                            <Layers className="w-3.5 h-3.5" /> Roll Widths & Balances ({rollInventorySummary.length})
                        </button>
                        <button
                            onClick={() => setSubTab('INWARD_LOG')}
                            className={`px-3.5 py-1.5 rounded-lg text-xs font-black uppercase tracking-tight transition-all flex items-center gap-1.5 ${
                                subTab === 'INWARD_LOG'
                                    ? 'bg-white dark:bg-gray-800 text-emerald-600 shadow-sm'
                                    : 'text-gray-500 hover:text-gray-800 dark:hover:text-gray-200'
                            }`}
                        >
                            <ArrowDownRight className="w-3.5 h-3.5" /> Inward Roll Receipts ({protectiveFilmInwardTransactions.filter(t => !t.deletedAt).length})
                        </button>
                        <button
                            onClick={() => setSubTab('OUTWARD_LOG')}
                            className={`px-3.5 py-1.5 rounded-lg text-xs font-black uppercase tracking-tight transition-all flex items-center gap-1.5 ${
                                subTab === 'OUTWARD_LOG'
                                    ? 'bg-white dark:bg-gray-800 text-amber-600 shadow-sm'
                                    : 'text-gray-500 hover:text-gray-800 dark:hover:text-gray-200'
                            }`}
                        >
                            <ArrowUpRight className="w-3.5 h-3.5" /> Outward & Wastage ({protectiveFilmOutwardAdjustments.filter(a => !a.deletedAt).length})
                        </button>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => {
                                setItemForm({
                                    sNo: protectiveFilmItems.length + 1,
                                    series: '80.5 SERIES',
                                    description: '',
                                    profileCode: '',
                                    packets: '',
                                    lengthsPerPacket: 6,
                                    eachLengthMtrs: 5.9,
                                    meterWeight: 0,
                                    lengthWeightWithGasket: 0,
                                    topFilmWidth: '38',
                                    topInwardMeters: 5000,
                                    topMtrPerLength: 5.9,
                                    bottomFilmWidth: '38',
                                    bottomInwardMeters: 5000,
                                    bottomMtrPerLength: 5.9,
                                    brand: 'All'
                                });
                                setEditingItem(null);
                                setIsAddProfileModalOpen(true);
                            }}
                            className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer shadow-sm shadow-blue-500/20"
                        >
                            <Plus className="w-3.5 h-3.5" /> Add Profile Specification
                        </button>
                        <button
                            onClick={() => {
                                if (confirm('Reset protective film specifications to standard 42-item catalog defaults?')) {
                                    resetProtectiveFilmItems();
                                }
                            }}
                            className="px-2.5 py-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-xs font-bold transition-all"
                            title="Reset specifications to default 42 profiles catalog"
                        >
                            <RotateCcw className="w-3.5 h-3.5" />
                        </button>
                    </div>
                </div>
            </div>

            {/* Filter Search Row (for Matrix & Roll tabs) */}
            {(subTab === 'SPECIFICATIONS' || subTab === 'ROLL_INVENTORY') && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white dark:bg-gray-800 p-3.5 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm">
                    <div className="relative flex-1 w-full max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Search by profile code, description, or series..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-9 pr-4 py-2 bg-gray-50 dark:bg-gray-900 border-none rounded-xl text-xs outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                        />
                    </div>

                    <div className="flex items-center gap-2 w-full sm:w-auto flex-wrap">
                        <select
                            value={selectedBrand}
                            onChange={(e) => setSelectedBrand(e.target.value)}
                            className="bg-gray-50 dark:bg-gray-900 border-none rounded-xl text-xs font-bold py-2 px-3 outline-none focus:ring-2 focus:ring-blue-500"
                        >
                            <option value="All">All Brands</option>
                            {brands.map(b => <option key={b} value={b}>{b}</option>)}
                        </select>
                        <select
                            value={selectedSeries}
                            onChange={(e) => setSelectedSeries(e.target.value)}
                            className="bg-gray-50 dark:bg-gray-900 border-none rounded-xl text-xs font-bold py-2 px-3 outline-none focus:ring-2 focus:ring-blue-500"
                        >
                            <option value="All">All Series ({seriesList.length})</option>
                            {seriesList.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>

                        <select
                            value={selectedWidthFilter}
                            onChange={(e) => setSelectedWidthFilter(e.target.value)}
                            className="bg-gray-50 dark:bg-gray-900 border-none rounded-xl text-xs font-bold py-2 px-3 outline-none focus:ring-2 focus:ring-blue-500"
                        >
                            <option value="All">All Film Widths ({filmWidthsList.length})</option>
                            {filmWidthsList.map(w => <option key={w} value={w}>{w} mm</option>)}
                        </select>

                        {calcMode === 'SIMULATION' && (
                            <button
                                onClick={() => setSimulationLengths({})}
                                className="px-3 py-2 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-xl text-xs font-black uppercase tracking-wider hover:bg-indigo-100 transition-all"
                            >
                                Reset Test Lengths
                            </button>
                        )}
                    </div>
                </div>
            )}

            {/* TAB 1: SPECIFICATIONS & LIVE MATRIX */}
            {subTab === 'SPECIFICATIONS' && (
                <div className="space-y-6">
                    {/* Low Stock Active Banner */}
                    {showLowStockOnly && (
                        <div className="p-3 bg-rose-50 dark:bg-rose-900/30 border border-rose-200 dark:border-rose-800 rounded-xl flex items-center justify-between flex-wrap gap-2 text-xs">
                            <div className="flex items-center gap-2 text-rose-700 dark:text-rose-300 font-bold">
                                <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" />
                                <span>Showing only profile items with low stock (&lt; 1,000m remaining on Top or Bottom film). {filteredRows.length} matching profile(s) found.</span>
                            </div>
                            <button
                                onClick={() => setShowLowStockOnly(false)}
                                className="px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-bold text-xs cursor-pointer transition-all"
                            >
                                Clear Low Stock Filter ✕
                            </button>
                        </div>
                    )}

                    {Object.keys(seriesGroups).length === 0 ? (
                        <div className="bg-white dark:bg-gray-800 p-12 text-center rounded-2xl border border-gray-100 dark:border-gray-700">
                            <Shield className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                            <h3 className="text-base font-bold text-gray-700 dark:text-gray-300">No profile film specifications match filter</h3>
                            <p className="text-xs text-gray-400 mt-1">
                                {showLowStockOnly 
                                    ? "No profile items currently have low film stock (< 1,000m balance)." 
                                    : "Try clearing your search term or series filter."}
                            </p>
                            {showLowStockOnly && (
                                <button
                                    onClick={() => setShowLowStockOnly(false)}
                                    className="mt-4 px-4 py-2 bg-blue-600 text-white font-bold text-xs rounded-xl hover:bg-blue-700 transition-all cursor-pointer"
                                >
                                    View All Profile Specs
                                </button>
                            )}
                        </div>
                    ) : (
                        Object.keys(seriesGroups).map(seriesName => {
                            const groupRows = seriesGroups[seriesName];
                            return (
                                <div key={seriesName} className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden">
                                    {/* Series Banner */}
                                    <div className="bg-gradient-to-r from-gray-900 via-slate-800 to-gray-900 text-white px-5 py-3 flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <span className="px-2.5 py-0.5 rounded-lg bg-blue-500/20 text-blue-300 text-[10px] font-black uppercase tracking-widest border border-blue-400/30">
                                                Series
                                            </span>
                                            <h3 className="text-sm font-black uppercase tracking-wider text-white">
                                                {seriesName}
                                            </h3>
                                            <span className="text-xs text-gray-400 font-mono">
                                                ({groupRows.length} Profiles)
                                            </span>
                                        </div>
                                        <div className="text-[10px] font-black uppercase tracking-widest text-gray-300">
                                            Standard 5.9m / Length
                                        </div>
                                    </div>

                                    {/* Table */}
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-left text-xs border-collapse">
                                            <thead>
                                                <tr className="bg-gray-50/80 dark:bg-gray-900/50 border-b border-gray-100 dark:border-gray-700 text-[10px] font-black uppercase tracking-wider text-gray-500 dark:text-gray-400">
                                                    <th className="p-3 text-center w-12">S.No</th>
                                                    <th className="p-3 min-w-[180px]">Profile Description</th>
                                                    <th className="p-3 text-center min-w-[80px]">Code</th>
                                                    <th className="p-3 text-center">Pkts</th>
                                                    <th className="p-3 text-center">Qty/Pkt</th>
                                                    <th className="p-3 text-center">Lengths</th>
                                                    
                                                    {/* TOP FILM HEADER GROUP */}
                                                    <th className="p-3 text-center bg-blue-50/50 dark:bg-blue-950/20 border-l border-blue-100 dark:border-blue-900/40 text-blue-700 dark:text-blue-300">
                                                        Top Film Width
                                                    </th>
                                                    <th className="p-3 text-right bg-blue-50/50 dark:bg-blue-950/20 text-blue-700 dark:text-blue-300">
                                                        Inward (m)
                                                    </th>
                                                    <th className="p-3 text-right bg-blue-50/50 dark:bg-blue-950/20 text-amber-700 dark:text-amber-400">
                                                        Top Outward (m)
                                                    </th>
                                                    <th className="p-3 text-right bg-blue-50/50 dark:bg-blue-950/20 text-emerald-700 dark:text-emerald-400 font-black">
                                                        Top Balance (m)
                                                    </th>

                                                    {/* BOTTOM FILM HEADER GROUP */}
                                                    <th className="p-3 text-center bg-indigo-50/50 dark:bg-indigo-950/20 border-l border-indigo-100 dark:border-indigo-900/40 text-indigo-700 dark:text-indigo-300">
                                                        Bottom Film Width
                                                    </th>
                                                    <th className="p-3 text-right bg-indigo-50/50 dark:bg-indigo-950/20 text-indigo-700 dark:text-indigo-300">
                                                        Inward (m)
                                                    </th>
                                                    <th className="p-3 text-right bg-indigo-50/50 dark:bg-indigo-950/20 text-amber-700 dark:text-amber-400">
                                                        Bottom Outward (m)
                                                    </th>
                                                    <th className="p-3 text-right bg-indigo-50/50 dark:bg-indigo-950/20 text-emerald-700 dark:text-emerald-400 font-black">
                                                        Bottom Balance (m)
                                                    </th>

                                                    <th className="p-3 text-center min-w-[130px] font-black">Actions</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-100 dark:divide-gray-700/60 font-medium">
                                                {groupRows.map((r) => {
                                                    const isTopNil = !r.topFilmWidth || r.topFilmWidth === 'NILL';
                                                    const isBottomNil = !r.bottomFilmWidth || r.bottomFilmWidth === 'NILL';

                                                    return (
                                                        <tr 
                                                            key={r.id}
                                                            className="hover:bg-gray-50/60 dark:hover:bg-gray-750 transition-colors"
                                                        >
                                                            <td className="p-3 text-center text-gray-400 font-mono text-[11px]">
                                                                {r.sNo}
                                                            </td>
                                                            <td className="p-3">
                                                                <div className="flex items-center gap-2 flex-wrap">
                                                                    <span className="font-bold text-gray-900 dark:text-white">
                                                                        {r.description}
                                                                    </span>
                                                                    {r.brand && r.brand !== 'All' && (
                                                                        <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-200/50">
                                                                            {r.brand}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                                {r.lengthWeightWithGasket ? (
                                                                    <div className="text-[10px] text-gray-400 font-mono">
                                                                        Wt: {r.lengthWeightWithGasket} kg/len
                                                                    </div>
                                                                ) : null}
                                                            </td>
                                                            <td className="p-3 text-center">
                                                                <span className="px-2 py-0.5 rounded-md bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 font-mono font-bold text-[11px]">
                                                                    {r.profileCode}
                                                                </span>
                                                            </td>
                                                            <td className="p-3 text-center text-gray-500 font-mono">
                                                                {r.packets || '-'}
                                                            </td>
                                                            <td className="p-3 text-center text-gray-500 font-mono">
                                                                {r.lengthsPerPacket || '-'}
                                                            </td>
                                                            
                                                            {/* Lengths active in system / Simulation */}
                                                            <td className="p-3 text-center">
                                                                {calcMode === 'SIMULATION' ? (
                                                                    <input
                                                                        type="number"
                                                                        value={simulationLengths[r.id] !== undefined ? simulationLengths[r.id] : r.activeLengths}
                                                                        onChange={(e) => {
                                                                            const val = Math.max(0, parseInt(e.target.value) || 0);
                                                                            setSimulationLengths(prev => ({ ...prev, [r.id]: val }));
                                                                        }}
                                                                        className="w-16 py-1 px-1.5 text-center font-mono font-bold text-xs bg-indigo-50 dark:bg-indigo-900/40 border border-indigo-200 dark:border-indigo-700 rounded-lg outline-none"
                                                                    />
                                                                ) : (
                                                                    <span className="font-mono font-bold text-gray-900 dark:text-white bg-gray-50 dark:bg-gray-900 px-2 py-0.5 rounded-md">
                                                                        {r.activeLengths.toLocaleString()}
                                                                    </span>
                                                                )}
                                                            </td>

                                                            {/* TOP FILM CELLS */}
                                                            <td className="p-3 text-center bg-blue-50/20 dark:bg-blue-950/10 border-l border-blue-100 dark:border-blue-900/40">
                                                                {isTopNil ? (
                                                                    <span className="text-gray-400 font-mono text-[11px]">NILL</span>
                                                                ) : (
                                                                    <div>
                                                                        <span className="px-2 py-0.5 rounded-md bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 font-black font-mono text-[11px]">
                                                                            {r.topFilmWidth} mm
                                                                        </span>
                                                                        {r.topStickerName && (
                                                                            <span className="block text-[9px] text-blue-600/80 dark:text-blue-400 font-medium truncate max-w-[120px] mx-auto mt-0.5" title={r.topStickerName}>
                                                                                {r.topStickerName}
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                )}
                                                            </td>
                                                            <td className="p-3 text-right font-mono text-gray-600 dark:text-gray-300 bg-blue-50/20 dark:bg-blue-950/10">
                                                                {isTopNil ? '-' : (r.topInwardMeters || 0).toLocaleString()}
                                                            </td>
                                                            <td className="p-3 text-right font-mono font-bold text-amber-600 dark:text-amber-400 bg-blue-50/20 dark:bg-blue-950/10">
                                                                {isTopNil ? '-' : r.topOutwardMtrs > 0 ? `-${r.topOutwardMtrs.toFixed(1)}` : '0'}
                                                            </td>
                                                            <td className="p-3 text-right font-mono font-black bg-blue-50/20 dark:bg-blue-950/10">
                                                                {isTopNil ? (
                                                                    <span className="text-gray-400">-</span>
                                                                ) : (
                                                                    <span className={r.topBalanceMtrs < 500 ? 'text-rose-600 font-black' : 'text-emerald-600 dark:text-emerald-400'}>
                                                                        {r.topBalanceMtrs.toLocaleString(undefined, { maximumFractionDigits: 1 })}
                                                                    </span>
                                                                )}
                                                            </td>

                                                            {/* BOTTOM FILM CELLS */}
                                                            <td className="p-3 text-center bg-indigo-50/20 dark:bg-indigo-950/10 border-l border-indigo-100 dark:border-indigo-900/40">
                                                                {isBottomNil ? (
                                                                    <span className="text-gray-400 font-mono text-[11px]">NILL</span>
                                                                ) : (
                                                                    <div>
                                                                        <span className="px-2 py-0.5 rounded-md bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 font-black font-mono text-[11px]">
                                                                            {r.bottomFilmWidth} mm
                                                                        </span>
                                                                        {r.bottomStickerName && (
                                                                            <span className="block text-[9px] text-indigo-600/80 dark:text-indigo-400 font-medium truncate max-w-[120px] mx-auto mt-0.5" title={r.bottomStickerName}>
                                                                                {r.bottomStickerName}
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                )}
                                                            </td>
                                                            <td className="p-3 text-right font-mono text-gray-600 dark:text-gray-300 bg-indigo-50/20 dark:bg-indigo-950/10">
                                                                {isBottomNil ? '-' : (r.bottomInwardMeters || 0).toLocaleString()}
                                                            </td>
                                                            <td className="p-3 text-right font-mono font-bold text-amber-600 dark:text-amber-400 bg-indigo-50/20 dark:bg-indigo-950/10">
                                                                {isBottomNil ? '-' : r.bottomOutwardMtrs > 0 ? `-${r.bottomOutwardMtrs.toFixed(1)}` : '0'}
                                                            </td>
                                                            <td className="p-3 text-right font-mono font-black bg-indigo-50/20 dark:bg-indigo-950/10">
                                                                {isBottomNil ? (
                                                                    <span className="text-gray-400">-</span>
                                                                ) : (
                                                                    <span className={r.bottomBalanceMtrs < 500 ? 'text-rose-600 font-black' : 'text-emerald-600 dark:text-emerald-400'}>
                                                                        {r.bottomBalanceMtrs.toLocaleString(undefined, { maximumFractionDigits: 1 })}
                                                                    </span>
                                                                )}
                                                            </td>

                                                            {/* CLEAR, PROMINENT EDIT AND DELETE ACTIONS */}
                                                            <td className="p-3 text-center">
                                                                <div className="flex items-center justify-center gap-1.5">
                                                                    <button
                                                                        onClick={() => handleOpenEditItem(r)}
                                                                        className="p-1.5 text-blue-600 hover:bg-blue-100 rounded-lg transition-all"
                                                                        title="Edit"
                                                                    >
                                                                        <Edit3 className="w-4 h-4" />
                                                                    </button>
                                                                    <button
                                                                        onClick={() => {
                                                                            if (confirm(`Delete specification for ${r.description} (${r.profileCode})?`)) {
                                                                                deleteProtectiveFilmItem(r.id);
                                                                            }
                                                                        }}
                                                                        className="p-1.5 text-rose-600 hover:bg-rose-100 rounded-lg transition-all"
                                                                        title="Delete"
                                                                    >
                                                                        <Trash2 className="w-4 h-4" />
                                                                    </button>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            )}

            {/* TAB 2: ROLL INVENTORY SUMMARY */}
            {subTab === 'ROLL_INVENTORY' && (
                <div className="space-y-6">
                    {/* Low Stock Active Banner */}
                    {showLowStockOnly && (
                        <div className="p-3 bg-rose-50 dark:bg-rose-900/30 border border-rose-200 dark:border-rose-800 rounded-xl flex items-center justify-between flex-wrap gap-2 text-xs">
                            <div className="flex items-center gap-2 text-rose-700 dark:text-rose-300 font-bold">
                                <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" />
                                <span>Showing only rolls with low balance (&lt; 1,000m remaining). {filteredRollInventory.length} matching roll size(s) found.</span>
                            </div>
                            <button
                                onClick={() => setShowLowStockOnly(false)}
                                className="px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-bold text-xs cursor-pointer transition-all"
                            >
                                Clear Low Stock Filter ✕
                            </button>
                        </div>
                    )}

                    {filteredRollInventory.length === 0 ? (
                        <div className="bg-white dark:bg-gray-800 p-12 text-center rounded-2xl border border-gray-100 dark:border-gray-700">
                            <Layers className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                            <h4 className="text-base font-bold text-gray-800 dark:text-gray-200">No Roll Sizes Found</h4>
                            <p className="text-xs text-gray-400 mt-1 max-w-md mx-auto">
                                {showLowStockOnly 
                                    ? "Great news! No protective film rolls are currently running low on stock (< 1,000m balance)." 
                                    : "No roll widths match your current search or filter criteria."}
                            </p>
                            {showLowStockOnly && (
                                <button
                                    onClick={() => setShowLowStockOnly(false)}
                                    className="mt-4 px-4 py-2 bg-blue-600 text-white font-bold text-xs rounded-xl hover:bg-blue-700 transition-all cursor-pointer"
                                >
                                    View All Roll Sizes
                                </button>
                            )}
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {filteredRollInventory.map(roll => {
                                const isLow = roll.balanceMtrs < 1000;
                                const pctConsumed = roll.totalInwardMtrs > 0 ? (roll.totalOutwardMtrs / roll.totalInwardMtrs) * 100 : 0;
                                const rawWidth = roll.width.replace(' mm', '');

                                return (
                                    <div 
                                        key={roll.width}
                                        className={`bg-white dark:bg-gray-800 p-5 rounded-2xl border transition-all ${
                                            isLow 
                                                ? 'border-rose-300 dark:border-rose-800 shadow-sm shadow-rose-500/10 ring-1 ring-rose-400/30' 
                                                : 'border-gray-100 dark:border-gray-700 shadow-sm'
                                        }`}
                                    >
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center font-black font-mono text-sm">
                                                    {rawWidth}
                                                </div>
                                                <div>
                                                    <h4 className="text-sm font-black text-gray-900 dark:text-white">
                                                        {roll.width} Protective Film Roll
                                                    </h4>
                                                    <span className="text-[10px] text-gray-400">
                                                        Applied on {roll.profilesUsing.length} profile types
                                                    </span>
                                                </div>
                                            </div>

                                            {isLow ? (
                                                <span className="px-2 py-0.5 rounded-full bg-rose-100 dark:bg-rose-900/30 text-rose-600 text-[10px] font-black uppercase tracking-wider flex items-center gap-1">
                                                    <AlertTriangle className="w-3 h-3" /> Low Stock
                                                </span>
                                            ) : (
                                                <span className="px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 text-[10px] font-black uppercase tracking-wider flex items-center gap-1">
                                                    <CheckCircle2 className="w-3 h-3" /> In Stock
                                                </span>
                                            )}
                                        </div>

                                        {/* Progress Bar */}
                                        <div className="mt-4 space-y-1">
                                            <div className="flex justify-between text-[11px] font-mono">
                                                <span className="text-gray-500">Consumed: {pctConsumed.toFixed(1)}%</span>
                                                <span className={`font-bold ${isLow ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                                                    {roll.balanceMtrs.toLocaleString(undefined, { maximumFractionDigits: 1 })} m remaining
                                                </span>
                                            </div>
                                            <div className="w-full h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                                                <div 
                                                    className={`h-full rounded-full transition-all ${
                                                        isLow ? 'bg-rose-500' : pctConsumed > 75 ? 'bg-amber-500' : 'bg-blue-600'
                                                    }`}
                                                    style={{ width: `${Math.min(100, pctConsumed)}%` }}
                                                />
                                            </div>
                                        </div>

                                        {/* Details Grid */}
                                        <div className="grid grid-cols-2 gap-2 mt-4 pt-3 border-t border-gray-100 dark:border-gray-700/80 text-xs">
                                            <div>
                                                <span className="text-[10px] uppercase font-bold text-gray-400">Total Inward</span>
                                                <div className="font-mono font-bold text-gray-800 dark:text-gray-200">
                                                    {roll.totalInwardMtrs.toLocaleString()} m
                                                </div>
                                            </div>
                                            <div>
                                                <span className="text-[10px] uppercase font-bold text-gray-400">Total Consumed</span>
                                                <div className="font-mono font-bold text-amber-600">
                                                    {roll.totalOutwardMtrs.toLocaleString(undefined, { maximumFractionDigits: 1 })} m
                                                </div>
                                            </div>
                                            <div>
                                                <span className="text-[10px] uppercase font-bold text-gray-400">Remaining Capacity</span>
                                                <div className="font-mono font-black text-blue-600 dark:text-blue-400">
                                                    ~{roll.equivalentLengths.toLocaleString()} lengths
                                                </div>
                                            </div>
                                            <div>
                                                <span className="text-[10px] uppercase font-bold text-gray-400">Applied Profiles</span>
                                                <div className="text-[11px] font-mono text-gray-500 truncate" title={roll.profilesUsing.join(', ')}>
                                                    {roll.profilesUsing.slice(0, 3).join(', ')}{roll.profilesUsing.length > 3 ? '...' : ''}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Quick Actions Row */}
                                        <div className="mt-4 pt-2.5 border-t border-gray-100 dark:border-gray-700 flex items-center justify-between">
                                            <button
                                                onClick={() => {
                                                    setSelectedWidthFilter(rawWidth);
                                                    setSubTab('SPECIFICATIONS');
                                                }}
                                                className="text-[11px] font-bold text-gray-500 hover:text-blue-600 flex items-center gap-1"
                                            >
                                                <Eye className="w-3 h-3" /> View Specs
                                            </button>
                                            <div className="flex items-center gap-2">
                                                <button
                                                    onClick={() => {
                                                        setEditingInwardTx(null);
                                                        setInwardForm({
                                                            selectedProfileId: '',
                                                            brand: selectedBrand === 'All' ? 'Scraft' : selectedBrand,
                                                            filmWidth: rawWidth,
                                                            customWidthInput: '',
                                                            side: 'GENERAL',
                                                            meters: 5000,
                                                            rollCount: 1,
                                                            refNo: `ROLL-IN-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`,
                                                            supplier: '',
                                                            costPerMeter: 0,
                                                            notes: `Inward receipt for ${roll.width} roll`,
                                                            date: new Date().toISOString().split('T')[0],
                                                            updateItemBaseStock: false
                                                        });
                                                        setIsInwardModalOpen(true);
                                                    }}
                                                    className="px-2.5 py-1 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer"
                                                >
                                                    <Plus className="w-3 h-3" /> Inward
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        setEditingAdjTx(null);
                                                        setAdjForm({
                                                            selectedProfileId: '',
                                                            brand: selectedBrand === 'All' ? 'Scraft' : selectedBrand,
                                                            filmWidth: rawWidth,
                                                            customWidthInput: '',
                                                            meters: 50,
                                                            reason: 'SCRAP',
                                                            refNo: `ADJ-${Math.floor(1000 + Math.random() * 9000)}`,
                                                            notes: `Scrap deduction for ${roll.width}`,
                                                            date: new Date().toISOString().split('T')[0],
                                                            type: 'TOP'
                                                        });
                                                        setIsAdjustmentModalOpen(true);
                                                    }}
                                                    className="px-2.5 py-1 bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 hover:bg-amber-100 rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer"
                                                >
                                                    <ArrowUpRight className="w-3 h-3" /> Scrap
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {/* TAB 3: INWARD RECEIPTS LOG */}
            {subTab === 'INWARD_LOG' && (
                <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden">
                    <div className="p-4 flex items-center justify-between border-b border-gray-100 dark:border-gray-700 flex-wrap gap-3">
                        <div>
                            <h3 className="text-sm font-black uppercase tracking-wider text-gray-900 dark:text-white">
                                Protective Film Inward Roll Receipts
                            </h3>
                            <p className="text-xs text-gray-500">Log of incoming protective sticker rolls and stock replenishment</p>
                        </div>
                        <button
                            onClick={() => {
                                setEditingInwardTx(null);
                                setInwardForm({
                                    selectedProfileId: '',
                                    brand: selectedBrand === 'All' ? 'Scraft' : selectedBrand,
                                    filmWidth: '38',
                                    customWidthInput: '',
                                    side: 'GENERAL',
                                    meters: 5000,
                                    rollCount: 1,
                                    refNo: `ROLL-IN-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`,
                                    supplier: '',
                                    costPerMeter: 0,
                                    notes: '',
                                    date: new Date().toISOString().split('T')[0],
                                    updateItemBaseStock: false
                                });
                                setIsInwardModalOpen(true);
                            }}
                            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer shadow-sm"
                        >
                            <Plus className="w-3.5 h-3.5" /> Record Inward Roll
                        </button>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs border-collapse">
                            <thead>
                                <tr className="bg-gray-50/80 dark:bg-gray-900/50 text-[10px] font-black uppercase tracking-wider text-gray-500 border-b border-gray-100 dark:border-gray-700">
                                    <th className="p-3">Date</th>
                                    <th className="p-3">Ref / Roll No</th>
                                    <th className="p-3">Brand</th>
                                    <th className="p-3">Film Width</th>
                                    <th className="p-3 text-center">Rolls</th>
                                    <th className="p-3 text-right">Meters Received</th>
                                    <th className="p-3">Supplier</th>
                                    <th className="p-3 text-right">Total Cost</th>
                                    <th className="p-3">Notes</th>
                                    <th className="p-3 text-center min-w-[120px]">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-gray-700 font-medium">
                                {protectiveFilmInwardTransactions.filter(t => !t.deletedAt).length === 0 ? (
                                    <tr>
                                        <td colSpan={10} className="p-8 text-center text-gray-400">
                                            No additional inward roll receipts logged yet. Default 5,000m base rolls are active.
                                        </td>
                                    </tr>
                                ) : (
                                    protectiveFilmInwardTransactions.filter(t => !t.deletedAt).map(tx => (
                                        <tr key={tx.id} className="hover:bg-gray-50 dark:hover:bg-gray-750">
                                            <td className="p-3 font-mono">{tx.date}</td>
                                            <td className="p-3 font-bold font-mono text-gray-900 dark:text-white">{tx.refNo}</td>
                                            <td className="p-3">
                                                <span className="px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-[10px] font-black uppercase">
                                                    {tx.brand}
                                                </span>
                                            </td>
                                            <td className="p-3">
                                                <span className="px-2 py-0.5 rounded-md bg-gray-100 dark:bg-gray-700 font-mono font-bold text-[11px]">
                                                    {tx.filmWidth} mm
                                                </span>
                                            </td>
                                            <td className="p-3 text-center font-mono">{tx.rollCount || 1}</td>
                                            <td className="p-3 text-right font-mono font-black text-emerald-600 dark:text-emerald-400">
                                                +{Number(tx.meters).toLocaleString()} m
                                            </td>
                                            <td className="p-3 text-gray-600 dark:text-gray-400">{tx.supplier || '-'}</td>
                                            <td className="p-3 text-right font-mono">
                                                {tx.totalCost ? `₹${Number(tx.totalCost).toLocaleString()}` : '-'}
                                            </td>
                                            <td className="p-3 text-gray-500 text-[11px]">{tx.notes || '-'}</td>
                                            <td className="p-3 text-center">
                                                <div className="flex items-center justify-center gap-1.5">
                                                    <button
                                                        onClick={() => handleOpenEditInward(tx)}
                                                        className="px-2 py-1 text-xs font-bold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 rounded-md flex items-center gap-1"
                                                        title="Edit Inward Receipt"
                                                    >
                                                        <Edit3 className="w-3 h-3" /> Edit
                                                    </button>
                                                    <button
                                                        onClick={() => {
                                                            if (confirm(`Delete inward receipt ${tx.refNo}?`)) {
                                                                deleteProtectiveFilmInward(tx.id);
                                                            }
                                                        }}
                                                        className="px-2 py-1 text-xs font-bold text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-900/30 hover:bg-rose-100 rounded-md flex items-center gap-1"
                                                        title="Delete Inward Receipt"
                                                    >
                                                        <Trash2 className="w-3 h-3" /> Delete
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* TAB 4: OUTWARD & WASTAGE LOG */}
            {subTab === 'OUTWARD_LOG' && (
                <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden">
                    <div className="p-4 flex items-center justify-between border-b border-gray-100 dark:border-gray-700 flex-wrap gap-3">
                        <div>
                            <h3 className="text-sm font-black uppercase tracking-wider text-gray-900 dark:text-white">
                                Manual Film Outward & Wastage Deductions
                            </h3>
                            <p className="text-xs text-gray-500">Record roll scrap, test pieces, damage, or manual dispatches</p>
                        </div>
                        <button
                            onClick={() => {
                                setEditingAdjTx(null);
                                setAdjForm({
                                    selectedProfileId: '',
                                    brand: selectedBrand === 'All' ? 'Scraft' : selectedBrand,
                                    filmWidth: '38',
                                    customWidthInput: '',
                                    meters: 50,
                                    reason: 'SCRAP',
                                    refNo: `ADJ-${Math.floor(1000 + Math.random() * 9000)}`,
                                    notes: '',
                                    date: new Date().toISOString().split('T')[0],
                                    type: 'TOP'
                                });
                                setIsAdjustmentModalOpen(true);
                            }}
                            className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer shadow-sm"
                        >
                            <Plus className="w-3.5 h-3.5" /> Record Outward / Wastage
                        </button>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs border-collapse">
                            <thead>
                                <tr className="bg-gray-50/80 dark:bg-gray-900/50 text-[10px] font-black uppercase tracking-wider text-gray-500 border-b border-gray-100 dark:border-gray-700">
                                    <th className="p-3">Date</th>
                                    <th className="p-3">Ref No</th>
                                    <th className="p-3">Brand</th>
                                    <th className="p-3">Film Width</th>
                                    <th className="p-3">Reason</th>
                                    <th className="p-3 text-right">Meters Deducted</th>
                                    <th className="p-3">Notes</th>
                                    <th className="p-3 text-center min-w-[120px]">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-gray-700 font-medium">
                                {protectiveFilmOutwardAdjustments.filter(a => !a.deletedAt).length === 0 ? (
                                    <tr>
                                        <td colSpan={8} className="p-8 text-center text-gray-400">
                                            No manual scrap / wastage logged yet. Production auto-deductions are operating in real-time.
                                        </td>
                                    </tr>
                                ) : (
                                    protectiveFilmOutwardAdjustments.filter(a => !a.deletedAt).map(adj => (
                                        <tr key={adj.id} className="hover:bg-gray-50 dark:hover:bg-gray-750">
                                            <td className="p-3 font-mono">{adj.date}</td>
                                            <td className="p-3 font-bold font-mono text-gray-900 dark:text-white">{adj.refNo}</td>
                                            <td className="p-3">
                                                <span className="px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-[10px] font-black uppercase">
                                                    {adj.brand}
                                                </span>
                                            </td>
                                            <td className="p-3">
                                                <span className="px-2 py-0.5 rounded-md bg-gray-100 dark:bg-gray-700 font-mono font-bold text-[11px]">
                                                    {adj.filmWidth} mm
                                                </span>
                                            </td>
                                            <td className="p-3">
                                                <span className="px-2 py-0.5 rounded-md bg-amber-50 dark:bg-amber-900/30 text-amber-600 text-[10px] font-bold uppercase">
                                                    {adj.reason}
                                                </span>
                                            </td>
                                            <td className="p-3 text-right font-mono font-black text-rose-600">
                                                -{Number(adj.meters).toLocaleString()} m
                                            </td>
                                            <td className="p-3 text-gray-500 text-[11px]">{adj.notes || '-'}</td>
                                            <td className="p-3 text-center">
                                                <div className="flex items-center justify-center gap-1.5">
                                                    <button
                                                        onClick={() => handleOpenEditAdjustment(adj)}
                                                        className="px-2 py-1 text-xs font-bold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 rounded-md flex items-center gap-1"
                                                        title="Edit Outward Transaction"
                                                    >
                                                        <Edit3 className="w-3 h-3" /> Edit
                                                    </button>
                                                    <button
                                                        onClick={() => {
                                                            if (confirm(`Delete adjustment ${adj.refNo}?`)) {
                                                                deleteProtectiveFilmOutwardAdjustment(adj.id);
                                                            }
                                                        }}
                                                        className="px-2 py-1 text-xs font-bold text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-900/30 hover:bg-rose-100 rounded-md flex items-center gap-1"
                                                        title="Delete Outward Transaction"
                                                    >
                                                        <Trash2 className="w-3 h-3" /> Delete
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* MODAL 1: RECORD/EDIT INWARD ROLL (WITH ITEM SELECTOR & FILM WIDTH CONFIG) */}
            {isInwardModalOpen && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-gray-800 rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-gray-100 dark:border-gray-700 space-y-4 max-h-[92vh] overflow-y-auto">
                        <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-gray-700">
                            <div className="flex items-center gap-2">
                                <ArrowDownRight className="w-5 h-5 text-emerald-600" />
                                <div>
                                    <h3 className="text-lg font-black text-gray-900 dark:text-white uppercase tracking-tight">
                                        {editingInwardTx ? 'Edit Film Inward Receipt' : 'Record Film Inward Receipt'}
                                    </h3>
                                    <p className="text-xs text-gray-400">Add roll receipts to stock or link to a profile item</p>
                                </div>
                            </div>
                            <button onClick={() => { setIsInwardModalOpen(false); setEditingInwardTx(null); }} className="p-1 text-gray-400 hover:text-gray-600">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <form onSubmit={handleSaveInward} className="space-y-4">
                            {/* Associated Item / Profile Selector */}
                            <div className="p-3 bg-blue-50/50 dark:bg-blue-950/20 rounded-2xl border border-blue-100 dark:border-blue-900/40 space-y-2">
                                <label className="text-[10px] font-black uppercase text-blue-700 dark:text-blue-300 flex items-center justify-between">
                                    <span>Select Associated Profile / Item (Optional)</span>
                                    <span className="text-[9px] font-normal text-gray-400">Auto-fills Width & Brand</span>
                                </label>
                                <select
                                    value={inwardForm.selectedProfileId}
                                    onChange={(e) => handleSelectProfileInInward(e.target.value)}
                                    className="w-full p-2.5 bg-white dark:bg-gray-900 rounded-xl text-xs font-bold border border-blue-200 dark:border-blue-800 outline-none focus:ring-2 focus:ring-blue-500"
                                >
                                    <option value="">-- None (General Roll Stock) --</option>
                                    <optgroup label="Protective Film Catalogue Profiles">
                                        {protectiveFilmItems.map(p => (
                                            <option key={p.id} value={p.id}>
                                                {p.profileCode} - {p.description} (Top: {p.topFilmWidth}mm | Bot: {p.bottomFilmWidth}mm)
                                            </option>
                                        ))}
                                    </optgroup>
                                    <optgroup label="Master Window Profiles">
                                        {profiles.map(p => (
                                            <option key={p.id} value={p.id}>
                                                {p.sku} - {p.name} ({p.brand})
                                            </option>
                                        ))}
                                    </optgroup>
                                </select>

                                {inwardForm.selectedProfileId && (() => {
                                    const matched = protectiveFilmItems.find(p => p.id === inwardForm.selectedProfileId);
                                    if (!matched) return null;
                                    return (
                                        <div className="pt-1 flex items-center gap-2 flex-wrap text-xs">
                                            <span className="text-[10px] font-bold text-gray-500">Quick set width:</span>
                                            {matched.topFilmWidth && matched.topFilmWidth !== 'NILL' && (
                                                <button
                                                    type="button"
                                                    onClick={() => setInwardForm(prev => ({ ...prev, filmWidth: matched.topFilmWidth, side: 'TOP', customWidthInput: '' }))}
                                                    className="px-2 py-0.5 rounded-md bg-blue-100 text-blue-700 font-mono text-[11px] font-bold hover:bg-blue-200"
                                                >
                                                    Top: {matched.topFilmWidth} mm
                                                </button>
                                            )}
                                            {matched.bottomFilmWidth && matched.bottomFilmWidth !== 'NILL' && (
                                                <button
                                                    type="button"
                                                    onClick={() => setInwardForm(prev => ({ ...prev, filmWidth: matched.bottomFilmWidth, side: 'BOTTOM', customWidthInput: '' }))}
                                                    className="px-2 py-0.5 rounded-md bg-indigo-100 text-indigo-700 font-mono text-[11px] font-bold hover:bg-indigo-200"
                                                >
                                                    Bottom: {matched.bottomFilmWidth} mm
                                                </button>
                                            )}
                                        </div>
                                    );
                                })()}
                            </div>

                            {/* Brand & Film Width Selector */}
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-[10px] font-black uppercase text-gray-400">Brand</label>
                                    <select
                                        value={inwardForm.brand}
                                        onChange={(e) => setInwardForm({ ...inwardForm, brand: e.target.value })}
                                        className="w-full mt-1 p-2.5 bg-gray-50 dark:bg-gray-900 rounded-xl text-xs font-bold border-none outline-none focus:ring-2 focus:ring-blue-500"
                                    >
                                        {brands.map(b => <option key={b} value={b}>{b}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="text-[10px] font-black uppercase text-gray-400">Film Width (mm)</label>
                                    <select
                                        value={inwardForm.filmWidth}
                                        onChange={(e) => setInwardForm({ ...inwardForm, filmWidth: e.target.value, customWidthInput: '' })}
                                        className="w-full mt-1 p-2.5 bg-gray-50 dark:bg-gray-900 rounded-xl text-xs font-bold border-none outline-none focus:ring-2 focus:ring-blue-500"
                                    >
                                        {filmWidthsList.map(w => <option key={w} value={w}>{w} mm</option>)}
                                    </select>
                                </div>
                            </div>

                            {/* Custom Width Input or Quick Presets */}
                            <div>
                                <div className="flex items-center justify-between">
                                    <label className="text-[10px] font-black uppercase text-gray-400">
                                        Custom Width Entry (mm)
                                    </label>
                                    <span className="text-[9px] text-gray-400">Overrides dropdown if entered</span>
                                </div>
                                <div className="flex items-center gap-2 mt-1">
                                    <input
                                        type="text"
                                        placeholder="e.g. 38, 42.5, 65, 80"
                                        value={inwardForm.customWidthInput}
                                        onChange={(e) => setInwardForm({ ...inwardForm, customWidthInput: e.target.value })}
                                        className="flex-1 p-2 bg-gray-50 dark:bg-gray-900 rounded-xl text-xs font-mono font-bold border-none outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                    {inwardForm.customWidthInput && (
                                        <button
                                            type="button"
                                            onClick={() => setInwardForm(prev => ({ ...prev, customWidthInput: '' }))}
                                            className="p-1 text-gray-400 hover:text-gray-600"
                                        >
                                            <X className="w-4 h-4" />
                                        </button>
                                    )}
                                </div>
                                <div className="flex items-center gap-1 mt-1.5 flex-wrap">
                                    {['24', '30', '35', '38', '42', '50', '52', '60', '70'].map(pw => (
                                        <button
                                            type="button"
                                            key={pw}
                                            onClick={() => setInwardForm(prev => ({ ...prev, filmWidth: pw, customWidthInput: '' }))}
                                            className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold transition-all ${
                                                inwardForm.filmWidth === pw && !inwardForm.customWidthInput
                                                    ? 'bg-blue-600 text-white'
                                                    : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200'
                                            }`}
                                        >
                                            {pw}mm
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Meters Received & Roll Count */}
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-[10px] font-black uppercase text-gray-400">Total Meters Received</label>
                                    <input
                                        type="number"
                                        required
                                        min="1"
                                        value={inwardForm.meters}
                                        onChange={(e) => setInwardForm({ ...inwardForm, meters: parseFloat(e.target.value) || 0 })}
                                        className="w-full mt-1 p-2.5 bg-gray-50 dark:bg-gray-900 rounded-xl text-xs font-mono font-bold border-none outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] font-black uppercase text-gray-400">No. of Rolls</label>
                                    <input
                                        type="number"
                                        min="1"
                                        value={inwardForm.rollCount}
                                        onChange={(e) => setInwardForm({ ...inwardForm, rollCount: parseInt(e.target.value) || 1 })}
                                        className="w-full mt-1 p-2.5 bg-gray-50 dark:bg-gray-900 rounded-xl text-xs font-mono font-bold border-none outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>
                            </div>

                            {/* Ref No & Date */}
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-[10px] font-black uppercase text-gray-400">Ref / Roll / Invoice #</label>
                                    <input
                                        type="text"
                                        value={inwardForm.refNo}
                                        onChange={(e) => setInwardForm({ ...inwardForm, refNo: e.target.value })}
                                        className="w-full mt-1 p-2.5 bg-gray-50 dark:bg-gray-900 rounded-xl text-xs font-mono border-none outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] font-black uppercase text-gray-400">Receipt Date</label>
                                    <input
                                        type="date"
                                        value={inwardForm.date}
                                        onChange={(e) => setInwardForm({ ...inwardForm, date: e.target.value })}
                                        className="w-full mt-1 p-2.5 bg-gray-50 dark:bg-gray-900 rounded-xl text-xs border-none outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>
                            </div>

                            {/* Supplier & Cost */}
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-[10px] font-black uppercase text-gray-400">Supplier Name</label>
                                    <input
                                        type="text"
                                        placeholder="e.g. Sticker Tech Ltd"
                                        value={inwardForm.supplier}
                                        onChange={(e) => setInwardForm({ ...inwardForm, supplier: e.target.value })}
                                        className="w-full mt-1 p-2.5 bg-gray-50 dark:bg-gray-900 rounded-xl text-xs border-none outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] font-black uppercase text-gray-400">Cost / Meter (₹)</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={inwardForm.costPerMeter}
                                        onChange={(e) => setInwardForm({ ...inwardForm, costPerMeter: parseFloat(e.target.value) || 0 })}
                                        className="w-full mt-1 p-2.5 bg-gray-50 dark:bg-gray-900 rounded-xl text-xs font-mono border-none outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>
                            </div>

                            {/* Notes */}
                            <div>
                                <label className="text-[10px] font-black uppercase text-gray-400">Notes / Batch Remarks</label>
                                <input
                                    type="text"
                                    placeholder="e.g. High tack printed protective film"
                                    value={inwardForm.notes}
                                    onChange={(e) => setInwardForm({ ...inwardForm, notes: e.target.value })}
                                    className="w-full mt-1 p-2.5 bg-gray-50 dark:bg-gray-900 rounded-xl text-xs border-none outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>

                            {/* Checkbox to update item base specification */}
                            {inwardForm.selectedProfileId && !editingInwardTx && (
                                <label className="flex items-center gap-2 p-2 bg-emerald-50 dark:bg-emerald-950/20 rounded-xl cursor-pointer text-xs font-bold text-emerald-800 dark:text-emerald-300">
                                    <input
                                        type="checkbox"
                                        checked={inwardForm.updateItemBaseStock}
                                        onChange={(e) => setInwardForm({ ...inwardForm, updateItemBaseStock: e.target.checked })}
                                        className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500"
                                    />
                                    <span>Also add {inwardForm.meters.toLocaleString()}m to base specification inward stock for this profile</span>
                                </label>
                            )}

                            <div className="pt-2 flex justify-end gap-2">
                                <button
                                    type="button"
                                    onClick={() => { setIsInwardModalOpen(false); setEditingInwardTx(null); }}
                                    className="px-4 py-2 text-xs font-bold text-gray-500 hover:bg-gray-100 rounded-xl"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-md shadow-emerald-700/20"
                                >
                                    {editingInwardTx ? 'Update Inward Stock' : 'Save Inward Stock'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* MODAL 2: RECORD/EDIT OUTWARD / WASTAGE */}
            {isAdjustmentModalOpen && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-gray-800 rounded-3xl max-w-md w-full p-6 shadow-2xl border border-gray-100 dark:border-gray-700 space-y-4">
                        <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-gray-700">
                            <div className="flex items-center gap-2">
                                <ArrowUpRight className="w-5 h-5 text-amber-600" />
                                <h3 className="text-lg font-black text-gray-900 dark:text-white uppercase tracking-tight">
                                    {editingAdjTx ? 'Edit Outward / Wastage' : 'Record Outward / Wastage'}
                                </h3>
                            </div>
                            <button onClick={() => { setIsAdjustmentModalOpen(false); setEditingAdjTx(null); }} className="p-1 text-gray-400 hover:text-gray-600">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <form onSubmit={handleSaveAdjustment} className="space-y-4">
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-[10px] font-black uppercase text-gray-400">Brand</label>
                                    <select
                                        value={adjForm.brand}
                                        onChange={(e) => setAdjForm({ ...adjForm, brand: e.target.value })}
                                        className="w-full mt-1 p-2.5 bg-gray-50 dark:bg-gray-900 rounded-xl text-xs font-bold border-none outline-none focus:ring-2 focus:ring-blue-500"
                                    >
                                        {brands.map(b => <option key={b} value={b}>{b}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="text-[10px] font-black uppercase text-gray-400">Film Width (mm)</label>
                                    <select
                                        value={adjForm.filmWidth}
                                        onChange={(e) => setAdjForm({ ...adjForm, filmWidth: e.target.value, customWidthInput: '' })}
                                        className="w-full mt-1 p-2.5 bg-gray-50 dark:bg-gray-900 rounded-xl text-xs font-bold border-none outline-none focus:ring-2 focus:ring-blue-500"
                                    >
                                        {filmWidthsList.map(w => <option key={w} value={w}>{w} mm</option>)}
                                    </select>
                                </div>
                            </div>

                            {/* Custom Width Input */}
                            <div>
                                <label className="text-[10px] font-black uppercase text-gray-400">Custom Width (mm)</label>
                                <input
                                    type="text"
                                    placeholder="e.g. 38, 42"
                                    value={adjForm.customWidthInput}
                                    onChange={(e) => setAdjForm({ ...adjForm, customWidthInput: e.target.value })}
                                    className="w-full mt-1 p-2 bg-gray-50 dark:bg-gray-900 rounded-xl text-xs font-mono font-bold border-none outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-[10px] font-black uppercase text-gray-400">Wastage Location</label>
                                    <select
                                        value={adjForm.type}
                                        onChange={(e) => setAdjForm({ ...adjForm, type: e.target.value as 'TOP' | 'BOTTOM' | 'BOTH' })}
                                        className="w-full mt-1 p-2.5 bg-gray-50 dark:bg-gray-900 rounded-xl text-xs font-bold border-none outline-none focus:ring-2 focus:ring-blue-500"
                                    >
                                        <option value="TOP">Top Sticker</option>
                                        <option value="BOTTOM">Bottom Sticker</option>
                                        <option value="BOTH">Both</option>
                                    </select>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-[10px] font-black uppercase text-gray-400">Meters to Deduct</label>
                                    <input
                                        type="number"
                                        required
                                        min="0.1"
                                        step="0.1"
                                        value={adjForm.meters}
                                        onChange={(e) => setAdjForm({ ...adjForm, meters: parseFloat(e.target.value) || 0 })}
                                        className="w-full mt-1 p-2.5 bg-gray-50 dark:bg-gray-900 rounded-xl text-xs font-mono font-bold border-none outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] font-black uppercase text-gray-400">Reason</label>
                                    <select
                                        value={adjForm.reason}
                                        onChange={(e) => setAdjForm({ ...adjForm, reason: e.target.value as any })}
                                        className="w-full mt-1 p-2.5 bg-gray-50 dark:bg-gray-900 rounded-xl text-xs font-bold border-none outline-none focus:ring-2 focus:ring-blue-500"
                                    >
                                        <option value="SCRAP">Production Scrap / Tear</option>
                                        <option value="DAMAGE">Transit Damage</option>
                                        <option value="SAMPLING">Sampling / Lab Testing</option>
                                        <option value="MANUAL_DISPATCH">Direct Roll Dispatch</option>
                                        <option value="ADJUSTMENT">Physical Audit Correction</option>
                                    </select>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-[10px] font-black uppercase text-gray-400">Ref No</label>
                                    <input
                                        type="text"
                                        value={adjForm.refNo}
                                        onChange={(e) => setAdjForm({ ...adjForm, refNo: e.target.value })}
                                        className="w-full mt-1 p-2.5 bg-gray-50 dark:bg-gray-900 rounded-xl text-xs font-mono border-none outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] font-black uppercase text-gray-400">Date</label>
                                    <input
                                        type="date"
                                        value={adjForm.date}
                                        onChange={(e) => setAdjForm({ ...adjForm, date: e.target.value })}
                                        className="w-full mt-1 p-2.5 bg-gray-50 dark:bg-gray-900 rounded-xl text-xs border-none outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="text-[10px] font-black uppercase text-gray-400">Notes / Remarks</label>
                                <input
                                    type="text"
                                    placeholder="e.g. Wrinkling during extrusion start-up"
                                    value={adjForm.notes}
                                    onChange={(e) => setAdjForm({ ...adjForm, notes: e.target.value })}
                                    className="w-full mt-1 p-2.5 bg-gray-50 dark:bg-gray-900 rounded-xl text-xs border-none outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>

                            <div className="pt-2 flex justify-end gap-2">
                                <button
                                    type="button"
                                    onClick={() => { setIsAdjustmentModalOpen(false); setEditingAdjTx(null); }}
                                    className="px-4 py-2 text-xs font-bold text-gray-500 hover:bg-gray-100 rounded-xl"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-md shadow-amber-700/20"
                                >
                                    {editingAdjTx ? 'Update Deduction' : 'Record Deduction'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* MODAL 3: ADD/EDIT FILM PROFILE SPECIFICATION (WITH CLEAR EDIT & DELETE OPTIONS) */}
            {(isEditProfileModalOpen || isAddProfileModalOpen) && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-gray-800 rounded-3xl max-w-xl w-full p-6 shadow-2xl border border-gray-100 dark:border-gray-700 space-y-4 max-h-[92vh] overflow-y-auto">
                        <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-gray-700">
                            <div className="flex items-center gap-2">
                                <Edit3 className="w-5 h-5 text-blue-600" />
                                <div>
                                    <h3 className="text-lg font-black text-gray-900 dark:text-white uppercase tracking-tight">
                                        {editingItem ? `Edit Specifications: ${editingItem.profileCode}` : 'Add New Film Profile Specification'}
                                    </h3>
                                    <p className="text-xs text-gray-400">Configure top & bottom protective film widths and inward parameters</p>
                                </div>
                            </div>
                            <button 
                                onClick={() => {
                                    setIsEditProfileModalOpen(false);
                                    setIsAddProfileModalOpen(false);
                                    setEditingItem(null);
                                }} 
                                className="p-1 text-gray-400 hover:text-gray-600"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Autofill from master profile (for new items) */}
                        {!editingItem && (
                            <div className="p-3 bg-gray-50 dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 space-y-1">
                                <label className="text-[10px] font-black uppercase text-gray-500">
                                    Quick Import from Master Profiles Catalogue
                                </label>
                                <select
                                    onChange={(e) => {
                                        const p = profiles.find(pr => pr.id === e.target.value);
                                        if (p) {
                                            setItemForm(prev => ({
                                                ...prev,
                                                description: p.name,
                                                profileCode: p.sku,
                                                series: prev.series || '80.5 SERIES',
                                                lengthsPerPacket: p.piecesPerPacket || 6,
                                                eachLengthMtrs: p.length || 5.9,
                                                meterWeight: p.meterWeight || (p.weight && p.length ? p.weight / p.length : 0),
                                                lengthWeightWithGasket: p.weight || 0,
                                                brand: p.brand || 'All'
                                            }));
                                        }
                                    }}
                                    className="w-full p-2 bg-white dark:bg-gray-800 rounded-xl text-xs border border-gray-200 dark:border-gray-700"
                                >
                                    <option value="">-- Choose Profile to Auto-fill --</option>
                                    {profiles.map(p => (
                                        <option key={p.id} value={p.id}>{p.sku} - {p.name} ({p.brand})</option>
                                    ))}
                                </select>
                            </div>
                        )}

                        <form onSubmit={handleSaveItem} className="space-y-4">
                            <div className="grid grid-cols-4 gap-3">
                                <div>
                                    <label className="text-[10px] font-black uppercase text-gray-400">S.No</label>
                                    <input
                                        type="number"
                                        value={itemForm.sNo}
                                        onChange={(e) => setItemForm({ ...itemForm, sNo: parseInt(e.target.value) || 1 })}
                                        className="w-full mt-1 p-2 bg-gray-50 dark:bg-gray-900 rounded-xl text-xs font-bold border-none"
                                    />
                                </div>
                                <div className="col-span-2">
                                    <label className="text-[10px] font-black uppercase text-gray-400">Series Name</label>
                                    <input
                                        type="text"
                                        required
                                        list="seriesListOptions"
                                        value={itemForm.series}
                                        onChange={(e) => setItemForm({ ...itemForm, series: e.target.value })}
                                        placeholder="e.g. 80.5 SERIES, 92 SERIES"
                                        className="w-full mt-1 p-2 bg-gray-50 dark:bg-gray-900 rounded-xl text-xs font-bold border-none"
                                    />
                                    <datalist id="seriesListOptions">
                                        {seriesList.map(s => <option key={s} value={s} />)}
                                    </datalist>
                                </div>
                                <div>
                                    <label className="text-[10px] font-black uppercase text-gray-400">Brand</label>
                                    <select
                                        value={itemForm.brand || 'All'}
                                        onChange={(e) => setItemForm({ ...itemForm, brand: e.target.value })}
                                        className="w-full mt-1 p-2 bg-gray-50 dark:bg-gray-900 rounded-xl text-xs font-bold border-none"
                                    >
                                        <option value="All">All Brands</option>
                                        {brands.map(b => <option key={b} value={b}>{b}</option>)}
                                    </select>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-[10px] font-black uppercase text-gray-400">Profile Description</label>
                                    <input
                                        type="text"
                                        required
                                        value={itemForm.description}
                                        onChange={(e) => setItemForm({ ...itemForm, description: e.target.value })}
                                        placeholder="e.g. 2 TRACK, SLIDING SASH"
                                        className="w-full mt-1 p-2 bg-gray-50 dark:bg-gray-900 rounded-xl text-xs font-bold border-none"
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] font-black uppercase text-gray-400">Profile Code / SKU</label>
                                    <input
                                        type="text"
                                        required
                                        value={itemForm.profileCode}
                                        onChange={(e) => setItemForm({ ...itemForm, profileCode: e.target.value })}
                                        placeholder="e.g. 53ET, 60SH"
                                        className="w-full mt-1 p-2 bg-gray-50 dark:bg-gray-900 rounded-xl text-xs font-mono font-bold border-none"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-3 gap-3">
                                <div>
                                    <label className="text-[10px] font-black uppercase text-gray-400">Lengths in Each Pkt</label>
                                    <input
                                        type="number"
                                        value={itemForm.lengthsPerPacket || ''}
                                        onChange={(e) => setItemForm({ ...itemForm, lengthsPerPacket: parseInt(e.target.value) || 0 })}
                                        placeholder="e.g. 6, 8"
                                        className="w-full mt-1 p-2 bg-gray-50 dark:bg-gray-900 rounded-xl text-xs font-mono border-none"
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] font-black uppercase text-gray-400">Each Length (Mtrs)</label>
                                    <input
                                        type="number"
                                        step="0.1"
                                        value={itemForm.eachLengthMtrs || 5.9}
                                        onChange={(e) => setItemForm({ ...itemForm, eachLengthMtrs: parseFloat(e.target.value) || 5.9 })}
                                        className="w-full mt-1 p-2 bg-gray-50 dark:bg-gray-900 rounded-xl text-xs font-mono font-bold border-none"
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] font-black uppercase text-gray-400">Weight with Gasket (kg)</label>
                                    <input
                                        type="number"
                                        step="0.001"
                                        value={itemForm.lengthWeightWithGasket || ''}
                                        onChange={(e) => setItemForm({ ...itemForm, lengthWeightWithGasket: parseFloat(e.target.value) || 0 })}
                                        placeholder="e.g. 5.14"
                                        className="w-full mt-1 p-2 bg-gray-50 dark:bg-gray-900 rounded-xl text-xs font-mono border-none"
                                    />
                                </div>
                            </div>

                            {/* TOP FILM SETTINGS */}
                            <div className="p-3 bg-blue-50/60 dark:bg-blue-950/20 rounded-2xl border border-blue-100 dark:border-blue-900/40 space-y-2">
                                <div className="text-xs font-black uppercase text-blue-700 dark:text-blue-300">
                                    Top (Right) Protective Film
                                </div>
                                <div className="grid grid-cols-3 gap-2">
                                    <div>
                                        <label className="text-[10px] font-bold text-gray-500">Film Width (mm / NILL)</label>
                                        <input
                                            type="text"
                                            value={itemForm.topFilmWidth}
                                            onChange={(e) => setItemForm({ ...itemForm, topFilmWidth: e.target.value })}
                                            placeholder="38 or NILL"
                                            className="w-full mt-0.5 p-1.5 bg-white dark:bg-gray-900 rounded-lg text-xs font-mono font-bold border border-blue-200 dark:border-blue-800"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-bold text-gray-500">Inward Meters</label>
                                        <input
                                            type="number"
                                            value={itemForm.topInwardMeters}
                                            onChange={(e) => setItemForm({ ...itemForm, topInwardMeters: parseFloat(e.target.value) || 0 })}
                                            className="w-full mt-0.5 p-1.5 bg-white dark:bg-gray-900 rounded-lg text-xs font-mono font-bold border border-blue-200 dark:border-blue-800"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-bold text-gray-500">Mtr / Length</label>
                                        <input
                                            type="number"
                                            step="0.1"
                                            value={itemForm.topMtrPerLength || 5.9}
                                            onChange={(e) => setItemForm({ ...itemForm, topMtrPerLength: parseFloat(e.target.value) || 5.9 })}
                                            className="w-full mt-0.5 p-1.5 bg-white dark:bg-gray-900 rounded-lg text-xs font-mono border border-blue-200 dark:border-blue-800"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold text-gray-500">Top Sticker Name / Print (Optional)</label>
                                    <input
                                        type="text"
                                        value={itemForm.topStickerName || ''}
                                        onChange={(e) => setItemForm({ ...itemForm, topStickerName: e.target.value })}
                                        placeholder="e.g. Scraft Red Protective Tape 38mm"
                                        className="w-full mt-0.5 p-1.5 bg-white dark:bg-gray-900 rounded-lg text-xs border border-blue-200 dark:border-blue-800"
                                    />
                                </div>
                            </div>

                            {/* BOTTOM FILM SETTINGS */}
                            <div className="p-3 bg-indigo-50/60 dark:bg-indigo-950/20 rounded-2xl border border-indigo-100 dark:border-indigo-900/40 space-y-2">
                                <div className="text-xs font-black uppercase text-indigo-700 dark:text-indigo-300">
                                    Bottom (Left) Protective Film
                                </div>
                                <div className="grid grid-cols-3 gap-2">
                                    <div>
                                        <label className="text-[10px] font-bold text-gray-500">Film Width (mm / NILL)</label>
                                        <input
                                            type="text"
                                            value={itemForm.bottomFilmWidth}
                                            onChange={(e) => setItemForm({ ...itemForm, bottomFilmWidth: e.target.value })}
                                            placeholder="38 or NILL"
                                            className="w-full mt-0.5 p-1.5 bg-white dark:bg-gray-900 rounded-lg text-xs font-mono font-bold border border-indigo-200 dark:border-indigo-800"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-bold text-gray-500">Inward Meters</label>
                                        <input
                                            type="number"
                                            value={itemForm.bottomInwardMeters}
                                            onChange={(e) => setItemForm({ ...itemForm, bottomInwardMeters: parseFloat(e.target.value) || 0 })}
                                            className="w-full mt-0.5 p-1.5 bg-white dark:bg-gray-900 rounded-lg text-xs font-mono font-bold border border-indigo-200 dark:border-indigo-800"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-bold text-gray-500">Mtr / Length</label>
                                        <input
                                            type="number"
                                            step="0.1"
                                            value={itemForm.bottomMtrPerLength || 5.9}
                                            onChange={(e) => setItemForm({ ...itemForm, bottomMtrPerLength: parseFloat(e.target.value) || 5.9 })}
                                            className="w-full mt-0.5 p-1.5 bg-white dark:bg-gray-900 rounded-lg text-xs font-mono border border-indigo-200 dark:border-indigo-800"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold text-gray-500">Bottom Sticker Name / Print (Optional)</label>
                                    <input
                                        type="text"
                                        value={itemForm.bottomStickerName || ''}
                                        onChange={(e) => setItemForm({ ...itemForm, bottomStickerName: e.target.value })}
                                        placeholder="e.g. Scraft White Surface Tape 38mm"
                                        className="w-full mt-0.5 p-1.5 bg-white dark:bg-gray-900 rounded-lg text-xs border border-indigo-200 dark:border-indigo-800"
                                    />
                                </div>
                            </div>

                            {/* Modal Footer with Edit / Delete / Save Actions */}
                            <div className="pt-3 border-t border-gray-100 dark:border-gray-700 flex items-center justify-between">
                                {editingItem ? (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            if (confirm(`Are you sure you want to delete specification for ${editingItem.description} (${editingItem.profileCode})?`)) {
                                                deleteProtectiveFilmItem(editingItem.id);
                                                setIsEditProfileModalOpen(false);
                                                setEditingItem(null);
                                            }
                                        }}
                                        className="px-3.5 py-2 text-xs font-bold text-rose-600 bg-rose-50 hover:bg-rose-100 dark:bg-rose-900/20 dark:hover:bg-rose-900/40 rounded-xl flex items-center gap-1.5 transition-colors"
                                    >
                                        <Trash2 className="w-3.5 h-3.5" /> Delete Specification
                                    </button>
                                ) : (
                                    <div />
                                )}

                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setIsEditProfileModalOpen(false);
                                            setIsAddProfileModalOpen(false);
                                            setEditingItem(null);
                                        }}
                                        className="px-4 py-2 text-xs font-bold text-gray-500 hover:bg-gray-100 rounded-xl"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-md shadow-blue-600/20"
                                    >
                                        {editingItem ? 'Save Specifications' : 'Create Specification'}
                                    </button>
                                </div>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ========================================================================= */}
            {/* KPI DRILLDOWN & BRAND-WISE DETAILED INSPECTOR MODAL                       */}
            {/* ========================================================================= */}
            {activeKpiModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/70 backdrop-blur-md animate-fadeIn">
                    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl w-full max-w-6xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
                        {/* Modal Top Header */}
                        <div className="p-5 bg-gradient-to-r from-gray-900 via-blue-950 to-indigo-950 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10">
                            <div className="flex items-center gap-3">
                                <div className="p-3 bg-white/10 rounded-2xl border border-white/20 backdrop-blur-sm">
                                    {activeKpiModal === 'TOTAL_INWARD' && <ArrowDownLeft className="w-6 h-6 text-emerald-400" />}
                                    {activeKpiModal === 'CONSUMED_OUTWARD' && <ArrowUpRight className="w-6 h-6 text-amber-400" />}
                                    {activeKpiModal === 'LIVE_NET_BALANCE' && <Box className="w-6 h-6 text-emerald-400" />}
                                    {activeKpiModal === 'FILM_WIDTH_TYPES' && <Layers className="w-6 h-6 text-indigo-400" />}
                                    {activeKpiModal === 'PROFILE_ITEMS' && <Database className="w-6 h-6 text-purple-400" />}
                                    {activeKpiModal === 'LOW_STOCK_ALERTS' && <AlertTriangle className="w-6 h-6 text-rose-400" />}
                                </div>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <h2 className="text-lg sm:text-xl font-black tracking-tight">
                                            {activeKpiModal === 'TOTAL_INWARD' && 'Total Inward Receipts & Allocations'}
                                            {activeKpiModal === 'CONSUMED_OUTWARD' && 'Consumed Outward & Wastage Breakdown'}
                                            {activeKpiModal === 'LIVE_NET_BALANCE' && 'Live Net Balance & Roll Stock Matrix'}
                                            {activeKpiModal === 'FILM_WIDTH_TYPES' && 'Film Width Types & Size Distribution'}
                                            {activeKpiModal === 'PROFILE_ITEMS' && 'Profile Items & Film Specifications Matrix'}
                                            {activeKpiModal === 'LOW_STOCK_ALERTS' && 'Low Stock Roll Alerts (< 1,000m)'}
                                        </h2>
                                        <span className="text-xs px-2.5 py-0.5 rounded-full bg-white/15 border border-white/20 font-mono font-bold text-blue-200">
                                            {modalBrandFilter === 'All' ? 'All Brands' : modalBrandFilter}
                                        </span>
                                    </div>
                                    <p className="text-xs text-blue-200/80 mt-0.5">
                                        {activeKpiModal === 'TOTAL_INWARD' && 'Itemized record of all protective film inward receipts, roll GRNs, and base allocations'}
                                        {activeKpiModal === 'CONSUMED_OUTWARD' && 'Automated production deductions based on extrusion runs & manual wastage entries'}
                                        {activeKpiModal === 'LIVE_NET_BALANCE' && 'Real-time computed balance per profile item with top/bottom breakdown'}
                                        {activeKpiModal === 'FILM_WIDTH_TYPES' && 'Roll inventory aggregate grouped by tape width (19mm to 100mm)'}
                                        {activeKpiModal === 'PROFILE_ITEMS' && 'Complete master catalogue of all profiles mapped with protective film specifications'}
                                        {activeKpiModal === 'LOW_STOCK_ALERTS' && 'Items requiring immediate reordering to avoid extrusion line stoppage'}
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-center gap-2 self-end sm:self-center">
                                <button
                                    onClick={handleExportDrilldownExcel}
                                    className="px-3.5 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 border border-white/20 transition-all cursor-pointer"
                                    title="Export this drilldown view to Excel"
                                >
                                    <Download className="w-4 h-4 text-emerald-400" /> Export Excel
                                </button>
                                <button
                                    onClick={() => setActiveKpiModal(null)}
                                    className="p-2 bg-white/10 hover:bg-rose-600 text-white rounded-xl transition-all border border-white/20 cursor-pointer"
                                    title="Close modal (Esc)"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                        </div>

                        {/* Modal Toolbar: Brand Filter Pills & Search Box */}
                        <div className="p-4 bg-gray-50 dark:bg-gray-800/80 border-b border-gray-200 dark:border-gray-700 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
                            {/* Brand Pills */}
                            <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-xs font-black uppercase tracking-wider text-gray-500 flex items-center gap-1">
                                    <Building2 className="w-3.5 h-3.5 text-blue-500" /> Filter Brand:
                                </span>
                                <button
                                    onClick={() => setModalBrandFilter('All')}
                                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                                        modalBrandFilter === 'All'
                                            ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                                            : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 border border-gray-200 dark:border-gray-600'
                                    }`}
                                >
                                    All Brands
                                </button>
                                {allAvailableBrands.map(brand => {
                                    const m = brandWiseMetrics[brand];
                                    return (
                                        <button
                                            key={brand}
                                            onClick={() => setModalBrandFilter(brand)}
                                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                                                modalBrandFilter.toLowerCase() === brand.toLowerCase()
                                                    ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                                                    : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 border border-gray-200 dark:border-gray-600'
                                            }`}
                                        >
                                            {brand}
                                            {m && (
                                                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                                                    modalBrandFilter.toLowerCase() === brand.toLowerCase()
                                                        ? 'bg-white/20 text-white'
                                                        : 'bg-gray-100 dark:bg-gray-600 text-gray-600 dark:text-gray-300'
                                                }`}>
                                                    {m.balanceMtrs.toLocaleString(undefined, { maximumFractionDigits: 0 })}m
                                                </span>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>

                            {/* Search Box */}
                            <div className="relative min-w-[240px]">
                                <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                                <input
                                    type="text"
                                    value={modalSearchTerm}
                                    onChange={(e) => setModalSearchTerm(e.target.value)}
                                    placeholder="Search by profile, width, ref, supplier..."
                                    className="w-full pl-9 pr-8 py-1.5 text-xs bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                                {modalSearchTerm && (
                                    <button
                                        onClick={() => setModalSearchTerm('')}
                                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                    >
                                        <X className="w-3.5 h-3.5" />
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Modal Body: Content Display based on active KPI */}
                        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-gray-50/50 dark:bg-gray-900/50">
                            {/* CASE 1: TOTAL INWARD */}
                            {activeKpiModal === 'TOTAL_INWARD' && (
                                <div className="space-y-4">
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                        <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 rounded-2xl border border-emerald-100 dark:border-emerald-900/40">
                                            <span className="text-[10px] font-black uppercase text-emerald-600 dark:text-emerald-400">Total Filtered Inward</span>
                                            <div className="text-xl font-black text-emerald-700 dark:text-emerald-300 font-mono mt-0.5">
                                                {inwardDrilldownList.reduce((sum, r) => sum + r.meters, 0).toLocaleString()} <span className="text-xs font-normal">m</span>
                                            </div>
                                        </div>
                                        <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-2xl border border-blue-100 dark:border-blue-900/40">
                                            <span className="text-[10px] font-black uppercase text-blue-600 dark:text-blue-400">Receipt Transactions</span>
                                            <div className="text-xl font-black text-blue-700 dark:text-blue-300 font-mono mt-0.5">
                                                {inwardDrilldownList.filter(r => r.type === 'ROLL_RECEIPT').length} <span className="text-xs font-normal">GRNs</span>
                                            </div>
                                        </div>
                                        <div className="p-3 bg-indigo-50 dark:bg-indigo-950/30 rounded-2xl border border-indigo-100 dark:border-indigo-900/40">
                                            <span className="text-[10px] font-black uppercase text-indigo-600 dark:text-indigo-400">Standard Rolls Inward</span>
                                            <div className="text-xl font-black text-indigo-700 dark:text-indigo-300 font-mono mt-0.5">
                                                {inwardDrilldownList.reduce((sum, r) => sum + r.rollCount, 0)} <span className="text-xs font-normal">rolls</span>
                                            </div>
                                        </div>
                                        <div className="p-3 bg-purple-50 dark:bg-purple-950/30 rounded-2xl border border-purple-100 dark:border-purple-900/40">
                                            <span className="text-[10px] font-black uppercase text-purple-600 dark:text-purple-400">Active Brand Filter</span>
                                            <div className="text-lg font-black text-purple-700 dark:text-purple-300 uppercase mt-0.5">
                                                {modalBrandFilter}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Inward Table */}
                                    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm">
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-left text-xs border-collapse">
                                                <thead className="bg-gray-100 dark:bg-gray-900 text-gray-600 dark:text-gray-300 uppercase text-[10px] font-black tracking-wider">
                                                    <tr>
                                                        <th className="p-3">Source Type</th>
                                                        <th className="p-3">Date</th>
                                                        <th className="p-3">Brand</th>
                                                        <th className="p-3">Profile Code & Description</th>
                                                        <th className="p-3 text-center">Film Width</th>
                                                        <th className="p-3 text-center">Side</th>
                                                        <th className="p-3 text-right">Inward Meters</th>
                                                        <th className="p-3 text-center">Rolls</th>
                                                        <th className="p-3">Supplier / Ref</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                                    {inwardDrilldownList.length === 0 ? (
                                                        <tr>
                                                            <td colSpan={9} className="p-8 text-center text-gray-400 font-medium">
                                                                No inward records found matching the criteria.
                                                            </td>
                                                        </tr>
                                                    ) : (
                                                        inwardDrilldownList.map((row) => (
                                                            <tr key={row.id} className="hover:bg-blue-50/40 dark:hover:bg-blue-900/20 transition-colors">
                                                                <td className="p-3">
                                                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                                                        row.type === 'ROLL_RECEIPT'
                                                                            ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800'
                                                                            : 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 border border-blue-300 dark:border-blue-800'
                                                                    }`}>
                                                                        {row.type === 'ROLL_RECEIPT' ? 'Roll Receipt' : 'Base Specification'}
                                                                    </span>
                                                                </td>
                                                                <td className="p-3 font-mono text-gray-500">{row.date}</td>
                                                                <td className="p-3">
                                                                    <span className="px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-700 font-bold text-gray-700 dark:text-gray-300">
                                                                        {row.brand}
                                                                    </span>
                                                                </td>
                                                                <td className="p-3 font-medium">
                                                                    <div className="font-bold text-gray-900 dark:text-white font-mono">{row.profileCode}</div>
                                                                    <div className="text-[11px] text-gray-500">{row.description}</div>
                                                                </td>
                                                                <td className="p-3 text-center">
                                                                    <span className="px-2 py-0.5 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 font-mono font-bold">
                                                                        {row.filmWidth} mm
                                                                    </span>
                                                                </td>
                                                                <td className="p-3 text-center">
                                                                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400">
                                                                        {row.side}
                                                                    </span>
                                                                </td>
                                                                <td className="p-3 text-right font-mono font-black text-emerald-600 dark:text-emerald-400 text-sm">
                                                                    +{row.meters.toLocaleString()} m
                                                                </td>
                                                                <td className="p-3 text-center font-mono font-bold text-gray-700 dark:text-gray-300">
                                                                    {row.rollCount > 0 ? row.rollCount : '-'}
                                                                </td>
                                                                <td className="p-3 text-gray-600 dark:text-gray-400">
                                                                    <div className="font-semibold text-gray-900 dark:text-gray-200">{row.supplier || 'Standard Allocation'}</div>
                                                                    {row.refNo && <div className="text-[10px] text-gray-400 font-mono">Ref: {row.refNo}</div>}
                                                                </td>
                                                            </tr>
                                                        ))
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* CASE 2: CONSUMED OUTWARD */}
                            {activeKpiModal === 'CONSUMED_OUTWARD' && (
                                <div className="space-y-4">
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                        <div className="p-3 bg-amber-50 dark:bg-amber-950/30 rounded-2xl border border-amber-100 dark:border-amber-900/40">
                                            <span className="text-[10px] font-black uppercase text-amber-600 dark:text-amber-400">Total Filtered Consumed</span>
                                            <div className="text-xl font-black text-amber-700 dark:text-amber-300 font-mono mt-0.5">
                                                {outwardDrilldownList.reduce((sum, r) => sum + r.meters, 0).toLocaleString(undefined, { maximumFractionDigits: 1 })} <span className="text-xs font-normal">m</span>
                                            </div>
                                        </div>
                                        <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 rounded-2xl border border-emerald-100 dark:border-emerald-900/40">
                                            <span className="text-[10px] font-black uppercase text-emerald-600 dark:text-emerald-400">Extrusion Production Auto-Deductions</span>
                                            <div className="text-xl font-black text-emerald-700 dark:text-emerald-300 font-mono mt-0.5">
                                                {outwardDrilldownList.filter(r => r.type === 'EXTRUSION_AUTO').length} <span className="text-xs font-normal">profiles</span>
                                            </div>
                                        </div>
                                        <div className="p-3 bg-rose-50 dark:bg-rose-950/30 rounded-2xl border border-rose-100 dark:border-rose-900/40">
                                            <span className="text-[10px] font-black uppercase text-rose-600 dark:text-rose-400">Manual Scrap / Adjustments</span>
                                            <div className="text-xl font-black text-rose-700 dark:text-rose-300 font-mono mt-0.5">
                                                {outwardDrilldownList.filter(r => r.type === 'MANUAL_ADJ').length} <span className="text-xs font-normal">records</span>
                                            </div>
                                        </div>
                                        <div className="p-3 bg-purple-50 dark:bg-purple-950/30 rounded-2xl border border-purple-100 dark:border-purple-900/40">
                                            <span className="text-[10px] font-black uppercase text-purple-600 dark:text-purple-400">Active Brand Filter</span>
                                            <div className="text-lg font-black text-purple-700 dark:text-purple-300 uppercase mt-0.5">
                                                {modalBrandFilter}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Outward Table */}
                                    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm">
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-left text-xs border-collapse">
                                                <thead className="bg-gray-100 dark:bg-gray-900 text-gray-600 dark:text-gray-300 uppercase text-[10px] font-black tracking-wider">
                                                    <tr>
                                                        <th className="p-3">Source Type</th>
                                                        <th className="p-3">Date</th>
                                                        <th className="p-3">Brand</th>
                                                        <th className="p-3">Profile Code & Description</th>
                                                        <th className="p-3 text-center">Film Width</th>
                                                        <th className="p-3 text-right">Consumed Meters</th>
                                                        <th className="p-3 text-center">Equivalent Lengths</th>
                                                        <th className="p-3">Reason / Details</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                                    {outwardDrilldownList.length === 0 ? (
                                                        <tr>
                                                            <td colSpan={8} className="p-8 text-center text-gray-400 font-medium">
                                                                No outward consumption records found.
                                                            </td>
                                                        </tr>
                                                    ) : (
                                                        outwardDrilldownList.map((row) => (
                                                            <tr key={row.id} className="hover:bg-amber-50/40 dark:hover:bg-amber-900/20 transition-colors">
                                                                <td className="p-3">
                                                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                                                        row.type === 'EXTRUSION_AUTO'
                                                                            ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-800'
                                                                            : 'bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-800'
                                                                    }`}>
                                                                        {row.type === 'EXTRUSION_AUTO' ? 'Extrusion Production' : 'Manual Scrap / Wastage'}
                                                                    </span>
                                                                </td>
                                                                <td className="p-3 font-mono text-gray-500">{row.date}</td>
                                                                <td className="p-3">
                                                                    <span className="px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-700 font-bold text-gray-700 dark:text-gray-300">
                                                                        {row.brand}
                                                                    </span>
                                                                </td>
                                                                <td className="p-3 font-medium">
                                                                    <div className="font-bold text-gray-900 dark:text-white font-mono">{row.profileCode}</div>
                                                                    <div className="text-[11px] text-gray-500">{row.description}</div>
                                                                </td>
                                                                <td className="p-3 text-center">
                                                                    <span className="px-2 py-0.5 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 font-mono font-bold">
                                                                        {row.filmWidth} mm
                                                                    </span>
                                                                </td>
                                                                <td className="p-3 text-right font-mono font-black text-amber-600 dark:text-amber-400 text-sm">
                                                                    -{row.meters.toLocaleString(undefined, { maximumFractionDigits: 1 })} m
                                                                </td>
                                                                <td className="p-3 text-center font-mono font-bold text-gray-700 dark:text-gray-300">
                                                                    {row.lengths > 0 ? `${row.lengths.toLocaleString()} pcs` : '-'}
                                                                </td>
                                                                <td className="p-3 text-gray-600 dark:text-gray-400">
                                                                    <div className="font-semibold text-gray-900 dark:text-gray-200">{row.reason}</div>
                                                                    {row.refNo && <div className="text-[10px] text-gray-400 font-mono">Ref: {row.refNo}</div>}
                                                                    {row.notes && <div className="text-[11px] text-gray-500 italic">{row.notes}</div>}
                                                                </td>
                                                            </tr>
                                                        ))
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* CASE 3: LIVE NET BALANCE */}
                            {activeKpiModal === 'LIVE_NET_BALANCE' && (
                                <div className="space-y-4">
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                        <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 rounded-2xl border border-emerald-100 dark:border-emerald-900/40">
                                            <span className="text-[10px] font-black uppercase text-emerald-600 dark:text-emerald-400">Total Net Balance</span>
                                            <div className="text-xl font-black text-emerald-700 dark:text-emerald-300 font-mono mt-0.5">
                                                {balanceDrilldownList.reduce((sum, r) => sum + r.totalBalanceMtrs, 0).toLocaleString(undefined, { maximumFractionDigits: 1 })} <span className="text-xs font-normal">m</span>
                                            </div>
                                        </div>
                                        <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-2xl border border-blue-100 dark:border-blue-900/40">
                                            <span className="text-[10px] font-black uppercase text-blue-600 dark:text-blue-400">Total Inward Meters</span>
                                            <div className="text-xl font-black text-blue-700 dark:text-blue-300 font-mono mt-0.5">
                                                {balanceDrilldownList.reduce((sum, r) => sum + (r.topInwardMeters || 0) + (r.bottomInwardMeters || 0), 0).toLocaleString()} <span className="text-xs font-normal">m</span>
                                            </div>
                                        </div>
                                        <div className="p-3 bg-amber-50 dark:bg-amber-950/30 rounded-2xl border border-amber-100 dark:border-amber-900/40">
                                            <span className="text-[10px] font-black uppercase text-amber-600 dark:text-amber-400">Total Outward Consumed</span>
                                            <div className="text-xl font-black text-amber-700 dark:text-amber-300 font-mono mt-0.5">
                                                {balanceDrilldownList.reduce((sum, r) => sum + (r.topOutwardMtrs || 0) + (r.bottomOutwardMtrs || 0), 0).toLocaleString(undefined, { maximumFractionDigits: 1 })} <span className="text-xs font-normal">m</span>
                                            </div>
                                        </div>
                                        <div className="p-3 bg-indigo-50 dark:bg-indigo-950/30 rounded-2xl border border-indigo-100 dark:border-indigo-900/40">
                                            <span className="text-[10px] font-black uppercase text-indigo-600 dark:text-indigo-400">Profiles Matched</span>
                                            <div className="text-xl font-black text-indigo-700 dark:text-indigo-300 font-mono mt-0.5">
                                                {balanceDrilldownList.length} <span className="text-xs font-normal">items</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Balance Matrix Table */}
                                    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm">
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-left text-xs border-collapse">
                                                <thead className="bg-gray-100 dark:bg-gray-900 text-gray-600 dark:text-gray-300 uppercase text-[10px] font-black tracking-wider">
                                                    <tr>
                                                        <th className="p-3">Series</th>
                                                        <th className="p-3">Brand</th>
                                                        <th className="p-3">Profile Code & Description</th>
                                                        <th className="p-3 text-center bg-blue-50/50 dark:bg-blue-950/20">Top Width</th>
                                                        <th className="p-3 text-right bg-blue-50/50 dark:bg-blue-950/20">Top Balance</th>
                                                        <th className="p-3 text-center bg-indigo-50/50 dark:bg-indigo-950/20">Bottom Width</th>
                                                        <th className="p-3 text-right bg-indigo-50/50 dark:bg-indigo-950/20">Bottom Balance</th>
                                                        <th className="p-3 text-right font-black">Net Balance (m)</th>
                                                        <th className="p-3 text-center">Remaining Lengths</th>
                                                        <th className="p-3 text-center">Status</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                                    {balanceDrilldownList.length === 0 ? (
                                                        <tr>
                                                            <td colSpan={10} className="p-8 text-center text-gray-400 font-medium">
                                                                No profile items found matching the selected brand or filter.
                                                            </td>
                                                        </tr>
                                                    ) : (
                                                        balanceDrilldownList.map((row) => {
                                                            const isLow = row.totalBalanceMtrs < 1000;
                                                            return (
                                                                <tr key={row.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                                                                    <td className="p-3 font-bold text-gray-500">{row.series}</td>
                                                                    <td className="p-3">
                                                                        <span className="px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-700 font-bold text-gray-700 dark:text-gray-300">
                                                                            {row.brand || 'Scraft'}
                                                                        </span>
                                                                    </td>
                                                                    <td className="p-3 font-medium">
                                                                        <div className="font-bold text-gray-900 dark:text-white font-mono">{row.profileCode}</div>
                                                                        <div className="text-[11px] text-gray-500">{row.description}</div>
                                                                    </td>
                                                                    <td className="p-3 text-center bg-blue-50/30 dark:bg-blue-950/10 font-mono font-bold text-blue-700 dark:text-blue-300">
                                                                        {row.topFilmWidth} mm
                                                                    </td>
                                                                    <td className="p-3 text-right bg-blue-50/30 dark:bg-blue-950/10 font-mono font-semibold text-blue-800 dark:text-blue-200">
                                                                        {row.topBalanceMtrs.toLocaleString(undefined, { maximumFractionDigits: 1 })} m
                                                                    </td>
                                                                    <td className="p-3 text-center bg-indigo-50/30 dark:bg-indigo-950/10 font-mono font-bold text-indigo-700 dark:text-indigo-300">
                                                                        {row.bottomFilmWidth} mm
                                                                    </td>
                                                                    <td className="p-3 text-right bg-indigo-50/30 dark:bg-indigo-950/10 font-mono font-semibold text-indigo-800 dark:text-indigo-200">
                                                                        {row.bottomBalanceMtrs.toLocaleString(undefined, { maximumFractionDigits: 1 })} m
                                                                    </td>
                                                                    <td className="p-3 text-right font-mono font-black text-sm text-gray-900 dark:text-white">
                                                                        {row.totalBalanceMtrs.toLocaleString(undefined, { maximumFractionDigits: 1 })} m
                                                                    </td>
                                                                    <td className="p-3 text-center font-mono font-bold text-emerald-600 dark:text-emerald-400">
                                                                        ~{row.totalLengthsRemaining.toLocaleString()} pcs
                                                                    </td>
                                                                    <td className="p-3 text-center">
                                                                        {isLow ? (
                                                                            <span className="px-2 py-0.5 rounded-full bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300 font-black text-[10px] uppercase">
                                                                                Low Stock
                                                                            </span>
                                                                        ) : (
                                                                            <span className="px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 font-bold text-[10px] uppercase">
                                                                                Adequate
                                                                            </span>
                                                                        )}
                                                                    </td>
                                                                </tr>
                                                            );
                                                        })
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* CASE 4: FILM WIDTH TYPES */}
                            {activeKpiModal === 'FILM_WIDTH_TYPES' && (
                                <div className="space-y-4">
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                        <div className="p-3 bg-indigo-50 dark:bg-indigo-950/30 rounded-2xl border border-indigo-100 dark:border-indigo-900/40">
                                            <span className="text-[10px] font-black uppercase text-indigo-600 dark:text-indigo-400">Distinct Width Sizes</span>
                                            <div className="text-xl font-black text-indigo-700 dark:text-indigo-300 font-mono mt-0.5">
                                                {widthDrilldownList.length} <span className="text-xs font-normal">sizes</span>
                                            </div>
                                        </div>
                                        <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 rounded-2xl border border-emerald-100 dark:border-emerald-900/40">
                                            <span className="text-[10px] font-black uppercase text-emerald-600 dark:text-emerald-400">Total Aggregate Balance</span>
                                            <div className="text-xl font-black text-emerald-700 dark:text-emerald-300 font-mono mt-0.5">
                                                {widthDrilldownList.reduce((sum, r) => sum + r.balanceMtrs, 0).toLocaleString(undefined, { maximumFractionDigits: 0 })} <span className="text-xs font-normal">m</span>
                                            </div>
                                        </div>
                                        <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-2xl border border-blue-100 dark:border-blue-900/40">
                                            <span className="text-[10px] font-black uppercase text-blue-600 dark:text-blue-400">Total Rolls Equivalent</span>
                                            <div className="text-xl font-black text-blue-700 dark:text-blue-300 font-mono mt-0.5">
                                                {widthDrilldownList.reduce((sum, r) => sum + r.approxRolls, 0)} <span className="text-xs font-normal">rolls</span>
                                            </div>
                                        </div>
                                        <div className="p-3 bg-purple-50 dark:bg-purple-950/30 rounded-2xl border border-purple-100 dark:border-purple-900/40">
                                            <span className="text-[10px] font-black uppercase text-purple-600 dark:text-purple-400">Brand Scope</span>
                                            <div className="text-lg font-black text-purple-700 dark:text-purple-300 uppercase mt-0.5">
                                                {modalBrandFilter}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Grid of Width Cards */}
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                        {widthDrilldownList.map((card) => (
                                            <div
                                                key={card.width}
                                                className="p-4 bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm space-y-3 hover:border-indigo-400 transition-all"
                                            >
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-base font-black px-2.5 py-1 bg-indigo-600 text-white rounded-xl font-mono">
                                                            {card.width} mm
                                                        </span>
                                                        <span className="text-xs text-gray-500 font-bold">Film Roll</span>
                                                    </div>
                                                    <span className="text-xs font-mono font-bold text-gray-500">
                                                        ~{card.approxRolls} Rolls
                                                    </span>
                                                </div>

                                                <div className="grid grid-cols-3 gap-2 p-2 bg-gray-50 dark:bg-gray-900/50 rounded-xl text-center">
                                                    <div>
                                                        <div className="text-[9px] uppercase font-black text-gray-400">Inward</div>
                                                        <div className="text-xs font-black font-mono text-blue-600 dark:text-blue-400">
                                                            {card.totalInwardMtrs.toLocaleString(undefined, { maximumFractionDigits: 0 })}m
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <div className="text-[9px] uppercase font-black text-gray-400">Outward</div>
                                                        <div className="text-xs font-black font-mono text-amber-600 dark:text-amber-400">
                                                            {card.totalOutwardMtrs.toLocaleString(undefined, { maximumFractionDigits: 0 })}m
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <div className="text-[9px] uppercase font-black text-gray-400">Balance</div>
                                                        <div className="text-xs font-black font-mono text-emerald-600 dark:text-emerald-400">
                                                            {card.balanceMtrs.toLocaleString(undefined, { maximumFractionDigits: 0 })}m
                                                        </div>
                                                    </div>
                                                </div>

                                                <div>
                                                    <div className="text-[10px] font-black uppercase text-gray-400 mb-1">Profiles Using this Width ({card.profilesUsing.length}):</div>
                                                    <div className="flex items-center gap-1 flex-wrap max-h-16 overflow-y-auto">
                                                        {card.profilesUsing.map((prof, idx) => (
                                                            <span key={idx} className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded text-[10px] font-mono">
                                                                {prof}
                                                            </span>
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* CASE 5: PROFILE ITEMS */}
                            {activeKpiModal === 'PROFILE_ITEMS' && (
                                <div className="space-y-4">
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                        <div className="p-3 bg-purple-50 dark:bg-purple-950/30 rounded-2xl border border-purple-100 dark:border-purple-900/40">
                                            <span className="text-[10px] font-black uppercase text-purple-600 dark:text-purple-400">Total Profile Specs</span>
                                            <div className="text-xl font-black text-purple-700 dark:text-purple-300 font-mono mt-0.5">
                                                {balanceDrilldownList.length} <span className="text-xs font-normal">profiles</span>
                                            </div>
                                        </div>
                                        <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-2xl border border-blue-100 dark:border-blue-900/40">
                                            <span className="text-[10px] font-black uppercase text-blue-600 dark:text-blue-400">Series Groups</span>
                                            <div className="text-xl font-black text-blue-700 dark:text-blue-300 font-mono mt-0.5">
                                                {seriesList.length} <span className="text-xs font-normal">series</span>
                                            </div>
                                        </div>
                                        <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 rounded-2xl border border-emerald-100 dark:border-emerald-900/40">
                                            <span className="text-[10px] font-black uppercase text-emerald-600 dark:text-emerald-400">Dual-Tape Items</span>
                                            <div className="text-xl font-black text-emerald-700 dark:text-emerald-300 font-mono mt-0.5">
                                                {balanceDrilldownList.filter(r => r.topFilmWidth !== 'NILL' && r.bottomFilmWidth !== 'NILL').length} <span className="text-xs font-normal">dual</span>
                                            </div>
                                        </div>
                                        <div className="p-3 bg-indigo-50 dark:bg-indigo-950/30 rounded-2xl border border-indigo-100 dark:border-indigo-900/40">
                                            <span className="text-[10px] font-black uppercase text-indigo-600 dark:text-indigo-400">Current Brand Scope</span>
                                            <div className="text-lg font-black text-indigo-700 dark:text-indigo-300 uppercase mt-0.5">
                                                {modalBrandFilter}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Profile Items Matrix */}
                                    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm">
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-left text-xs border-collapse">
                                                <thead className="bg-gray-100 dark:bg-gray-900 text-gray-600 dark:text-gray-300 uppercase text-[10px] font-black tracking-wider">
                                                    <tr>
                                                        <th className="p-3">Series</th>
                                                        <th className="p-3">Brand</th>
                                                        <th className="p-3">Profile Code</th>
                                                        <th className="p-3">Description</th>
                                                        <th className="p-3 text-center">Top Tape Width</th>
                                                        <th className="p-3 text-center">Bottom Tape Width</th>
                                                        <th className="p-3 text-right">Net Film Stock</th>
                                                        <th className="p-3 text-center">Action</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                                    {balanceDrilldownList.map((row) => (
                                                        <tr key={row.id} className="hover:bg-purple-50/40 dark:hover:bg-purple-900/20 transition-colors">
                                                            <td className="p-3 font-bold text-gray-500">{row.series}</td>
                                                            <td className="p-3">
                                                                <span className="px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-700 font-bold text-gray-700 dark:text-gray-300">
                                                                    {row.brand || 'Scraft'}
                                                                </span>
                                                            </td>
                                                            <td className="p-3 font-bold font-mono text-gray-900 dark:text-white">{row.profileCode}</td>
                                                            <td className="p-3 text-gray-600 dark:text-gray-300">{row.description}</td>
                                                            <td className="p-3 text-center font-mono font-bold text-blue-600 dark:text-blue-400">
                                                                {row.topFilmWidth} mm
                                                            </td>
                                                            <td className="p-3 text-center font-mono font-bold text-indigo-600 dark:text-indigo-400">
                                                                {row.bottomFilmWidth} mm
                                                            </td>
                                                            <td className="p-3 text-right font-mono font-black text-emerald-600 dark:text-emerald-400">
                                                                {row.totalBalanceMtrs.toLocaleString(undefined, { maximumFractionDigits: 1 })} m
                                                            </td>
                                                            <td className="p-3 text-center">
                                                                <button
                                                                    onClick={() => {
                                                                        setActiveKpiModal(null);
                                                                        setEditingItem(row);
                                                                        setItemForm({ ...row });
                                                                        setIsEditProfileModalOpen(true);
                                                                    }}
                                                                    className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/30 dark:hover:bg-blue-900/50 text-blue-600 dark:text-blue-300 rounded-lg font-bold text-[11px] transition-colors"
                                                                >
                                                                    Edit Spec
                                                                </button>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* CASE 6: LOW STOCK ALERTS */}
                            {activeKpiModal === 'LOW_STOCK_ALERTS' && (
                                <div className="space-y-4">
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                        <div className="p-3 bg-rose-50 dark:bg-rose-950/30 rounded-2xl border border-rose-100 dark:border-rose-900/40">
                                            <span className="text-[10px] font-black uppercase text-rose-600 dark:text-rose-400">Low Stock Rolls Count</span>
                                            <div className="text-xl font-black text-rose-700 dark:text-rose-300 font-mono mt-0.5">
                                                {lowStockDrilldownList.length} <span className="text-xs font-normal">items</span>
                                            </div>
                                        </div>
                                        <div className="p-3 bg-rose-50 dark:bg-rose-950/30 rounded-2xl border border-rose-100 dark:border-rose-900/40">
                                            <span className="text-[10px] font-black uppercase text-rose-600 dark:text-rose-400">Critical (&lt; 300m)</span>
                                            <div className="text-xl font-black text-rose-700 dark:text-rose-300 font-mono mt-0.5">
                                                {lowStockDrilldownList.filter(r => r.urgency === 'CRITICAL').length} <span className="text-xs font-normal">critical</span>
                                            </div>
                                        </div>
                                        <div className="p-3 bg-amber-50 dark:bg-amber-950/30 rounded-2xl border border-amber-100 dark:border-amber-900/40">
                                            <span className="text-[10px] font-black uppercase text-amber-600 dark:text-amber-400">Total Deficit to 1,000m</span>
                                            <div className="text-xl font-black text-amber-700 dark:text-amber-300 font-mono mt-0.5">
                                                {lowStockDrilldownList.reduce((sum, r) => sum + r.deficitMtrs, 0).toLocaleString()} <span className="text-xs font-normal">m</span>
                                            </div>
                                        </div>
                                        <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-2xl border border-blue-100 dark:border-blue-900/40">
                                            <span className="text-[10px] font-black uppercase text-blue-600 dark:text-blue-400">Active Brand Filter</span>
                                            <div className="text-lg font-black text-blue-700 dark:text-blue-300 uppercase mt-0.5">
                                                {modalBrandFilter}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Low Stock Table */}
                                    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm">
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-left text-xs border-collapse">
                                                <thead className="bg-gray-100 dark:bg-gray-900 text-gray-600 dark:text-gray-300 uppercase text-[10px] font-black tracking-wider">
                                                    <tr>
                                                        <th className="p-3">Urgency</th>
                                                        <th className="p-3">Item / Roll Description</th>
                                                        <th className="p-3">Brand</th>
                                                        <th className="p-3 text-center">Tape Width</th>
                                                        <th className="p-3 text-right">Current Balance</th>
                                                        <th className="p-3 text-right">Safety Target</th>
                                                        <th className="p-3 text-right">Deficit Needed</th>
                                                        <th className="p-3 text-center">Quick Action</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                                    {lowStockDrilldownList.length === 0 ? (
                                                        <tr>
                                                            <td colSpan={8} className="p-8 text-center text-emerald-600 font-bold">
                                                                ✓ All protective film rolls and items have healthy stock levels above 1,000m!
                                                            </td>
                                                        </tr>
                                                    ) : (
                                                        lowStockDrilldownList.map((row) => (
                                                            <tr key={row.id} className="hover:bg-rose-50/30 dark:hover:bg-rose-900/10 transition-colors">
                                                                <td className="p-3">
                                                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                                                                        row.urgency === 'CRITICAL'
                                                                            ? 'bg-rose-500 text-white animate-pulse'
                                                                            : 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300'
                                                                    }`}>
                                                                        {row.urgency}
                                                                    </span>
                                                                </td>
                                                                <td className="p-3 font-bold text-gray-900 dark:text-white">
                                                                    {row.name}
                                                                </td>
                                                                <td className="p-3">
                                                                    <span className="px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-700 font-bold text-gray-700 dark:text-gray-300">
                                                                        {row.brand}
                                                                    </span>
                                                                </td>
                                                                <td className="p-3 text-center font-mono font-bold text-indigo-600 dark:text-indigo-400">
                                                                    {row.width} mm
                                                                </td>
                                                                <td className="p-3 text-right font-mono font-black text-rose-600 dark:text-rose-400">
                                                                    {row.balanceMtrs.toLocaleString(undefined, { maximumFractionDigits: 1 })} m
                                                                </td>
                                                                <td className="p-3 text-right font-mono text-gray-500">
                                                                    1,000 m
                                                                </td>
                                                                <td className="p-3 text-right font-mono font-bold text-amber-600 dark:text-amber-400">
                                                                    +{row.deficitMtrs.toLocaleString(undefined, { maximumFractionDigits: 0 })} m
                                                                </td>
                                                                <td className="p-3 text-center">
                                                                    <button
                                                                        onClick={() => {
                                                                            setActiveKpiModal(null);
                                                                            setInwardForm({
                                                                                selectedProfileId: '',
                                                                                brand: row.brand === 'All' ? 'Scraft' : row.brand,
                                                                                filmWidth: row.width.toString(),
                                                                                customWidthInput: '',
                                                                                side: 'GENERAL',
                                                                                meters: 5000,
                                                                                rollCount: 1,
                                                                                refNo: `ROLL-IN-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`,
                                                                                supplier: 'Standard Supplier',
                                                                                costPerMeter: 0,
                                                                                notes: `Reorder replenishment for ${row.name}`,
                                                                                date: new Date().toISOString().split('T')[0],
                                                                                updateItemBaseStock: false
                                                                            });
                                                                            setIsInwardModalOpen(true);
                                                                        }}
                                                                        className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-all shadow-sm"
                                                                    >
                                                                        + Inward Receipt
                                                                    </button>
                                                                </td>
                                                            </tr>
                                                        ))
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Modal Footer */}
                        <div className="p-4 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 flex items-center justify-between flex-wrap gap-3">
                            <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                                <span>Interactive Filter Active • Press <strong>ESC</strong> or Close to exit</span>
                            </div>

                            <button
                                onClick={() => setActiveKpiModal(null)}
                                className="px-6 py-2 bg-gray-900 hover:bg-gray-800 dark:bg-gray-100 dark:hover:bg-white text-white dark:text-gray-900 rounded-xl text-xs font-black uppercase tracking-wider transition-all"
                            >
                                Close Drilldown
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* MANAGE BRANDS MODAL */}
            <ManageBrandsModal
                isOpen={isManageBrandsModalOpen}
                onClose={() => setIsManageBrandsModalOpen(false)}
                currentBrand={selectedBrand}
                onSelectBrand={(b) => setSelectedBrand(b)}
                initialTab={manageBrandsInitialTab}
            />
        </div>
    );
};

export default ProtectiveFilms;
