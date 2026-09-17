import React, { useState, useMemo, useCallback, useRef } from 'react';
import { 
    Plus, Trash2, Download, Upload, RotateCcw, Search, 
    Edit3, Sparkles, X, 
    ArrowLeft, ArrowRight, Copy,
    FileSpreadsheet, Printer, Calculator, Tag,
    Maximize2, Minimize2, MoreVertical, AlertTriangle, Check,
    Zap, RefreshCw, ArrowUpRight, ArrowDownRight, Database, CheckCircle2,
    Calendar, TrendingUp, BarChart3, Clock, Cpu, Layers, Settings2, Sliders
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { useStore } from '../store/useStore';
import { DataPlanColumn, DataPlanRow, Profile, Die, ProductionPlan } from '../types';
import { INITIAL_DATA_PLAN_COLUMNS, INITIAL_DATA_PLAN_ROWS } from '../data/defaultDataPlan';

interface DataPlanSheetProps {
    onOpenManageBrands?: () => void;
    onNavigateToPlanning?: () => void;
}

export const DataPlanSheet = ({ onOpenManageBrands, onNavigateToPlanning }) => {
    const { 
        dataPlanSheet, 
        updateDataPlanSheet, 
        resetDataPlanSheet, 
        brands = [],
        profiles = [],
        profileTransactions = [],
        dies = [],
        productionPlans = [],
        addProductionPlan,
        addProfile,
        addProfileTransaction
    } = useStore();

    const columns: DataPlanColumn[] = useMemo(() => {
        return dataPlanSheet?.columns && dataPlanSheet.columns.length > 0 
            ? dataPlanSheet.columns 
            : INITIAL_DATA_PLAN_COLUMNS;
    }, [dataPlanSheet]);

    const rows: DataPlanRow[] = useMemo(() => {
        return dataPlanSheet?.rows && dataPlanSheet.rows.length > 0 
            ? dataPlanSheet.rows 
            : INITIAL_DATA_PLAN_ROWS;
    }, [dataPlanSheet]);

    // Local UI states
    const [searchTerm, setSearchTerm] = useState('');
    const [isAddColumnModalOpen, setIsAddColumnModalOpen] = useState(false);
    const [isAutoSetupModalOpen, setIsAutoSetupModalOpen] = useState(false);
    const [isDiePlanModalOpen, setIsDiePlanModalOpen] = useState(false);
    const [demandBufferFactor, setDemandBufferFactor] = useState<number>(1.0);
    const [selectedMachinePrefix, setSelectedMachinePrefix] = useState<string>('EXT-01');
    const [planTargetMonth, setPlanTargetMonth] = useState<string>(() => {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    });
    const [diePlanSearch, setDiePlanSearch] = useState('');
    const [isGeneratingPlans, setIsGeneratingPlans] = useState(false);

    const [newColLabel, setNewColLabel] = useState('');
    const [newColType, setNewColType] = useState<'text' | 'number' | 'brand'>('text');
    const [newColBrand, setNewColBrand] = useState('');
    const [insertPositionType, setInsertPositionType] = useState<'end' | 'start' | 'before' | 'after'>('end');
    const [insertTargetColId, setInsertTargetColId] = useState<string>('');
    
    // Column header popup & actions
    const [activeColMenuId, setActiveColMenuId] = useState<string | null>(null);
    const [editingColId, setEditingColId] = useState<string | null>(null);
    const [editColLabel, setEditColLabel] = useState('');
    const [columnToDelete, setColumnToDelete] = useState<DataPlanColumn | null>(null);

    const [selectedRowIds, setSelectedRowIds] = useState<Set<string>>(new Set());
    const [isFullScreen, setIsFullScreen] = useState(false);
    const [toastMessage, setToastMessage] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const showToast = (msg: string) => {
        setToastMessage(msg);
        setTimeout(() => setToastMessage(null), 3500);
    };

    // Helper to calculate live stock of a profile
    const getProfileStock = useCallback((pId: string) => {
        const txns = profileTransactions.filter(t => t.profileId === pId && !t.deletedAt);
        const prod = txns.filter(t => t.type === 'PRODUCTION' || t.type === 'RETURN').reduce((sum, t) => sum + Number(t.quantity || 0), 0);
        const disp = txns.filter(t => t.type === 'DISPATCH').reduce((sum, t) => sum + Number(t.quantity || 0), 0);
        const scrap = txns.filter(t => t.type === 'SCRAP').reduce((sum, t) => sum + Number(t.quantity || 0), 0);
        return Math.max(0, prod - disp - scrap);
    }, [profileTransactions]);

    // Normalize product name for matching between profiles and data plan
    const normalizeProductName = (name: string): string => {
        return name
            .toUpperCase()
            .replace(/[.\-_/\\]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    };

    // Calculate smart formulas for a row
    const calculateRowFormulas = useCallback((row: DataPlanRow, cols: DataPlanColumn[]): DataPlanRow => {
        const updated = { ...row };
        const scraft = parseFloat(String(updated.scraftTotal || '0').replace(/[^0-9.-]/g, '')) || 0;
        const smart = parseFloat(String(updated.smartTotal || '0').replace(/[^0-9.-]/g, '')) || 0;
        
        let totalBrandLength = 0;
        let brandColCount = 0;
        cols.forEach(c => {
            if (c.type === 'brand' || c.id === 'scraftTotal' || c.id === 'smartTotal') {
                const val = parseFloat(String(updated[c.id] || '0').replace(/[^0-9.-]/g, '')) || 0;
                totalBrandLength += val;
                brandColCount++;
            }
        });

        if (brandColCount === 0) totalBrandLength = scraft + smart;

        const twoBrands = totalBrandLength;
        updated.twoBrandsTotal = twoBrands > 0 ? twoBrands : (updated.twoBrandsTotal || 0);

        const eachPacket = parseFloat(String(updated.eachPacket || '0').replace(/[^0-9.-]/g, '')) || 0;
        if (eachPacket > 0 && twoBrands > 0) {
            const totalPkts = twoBrands / eachPacket;
            updated.totalPackets = totalPkts % 1 === 0 ? totalPkts : Number(totalPkts.toFixed(3));
            const avr = (brandColCount > 0 ? (totalPkts / brandColCount) : (totalPkts / 2));
            updated.avrPacket = Math.round(avr);
        }

        const qtyFactor = parseFloat(String(updated.qtyFactor || '0').replace(/[^0-9.-]/g, '')) || 0;
        const pktWeight = parseFloat(String(updated.packetWeight || '0').replace(/[^0-9.-]/g, '')) || 0;
        if (qtyFactor > 0 && pktWeight > 0) {
            const totalWt = qtyFactor * pktWeight;
            updated.totalWeight = Number(totalWt.toFixed(3));
        }

        return updated;
    }, []);

    // Automatic Setup in Brand Wise Stock
    const handleAutoSetupBrandStock = (mode: 'full_setup' | 'pull_stock' | 'push_stock') => {
        if (mode === 'push_stock') {
            // Push Data Plan quantities to Profile Section Stock
            let updatedCount = 0;
            let createdCount = 0;

            const allActiveBrands = ['S CRAFT', 'SMART', ...(brands || [])].filter((v, i, a) => a.indexOf(v) === i);

            rows.forEach(r => {
                const prodName = String(r.product || '').trim();
                if (!prodName) return;

                // Inspect every brand column
                columns.forEach(col => {
                    if (col.type === 'brand' || col.id === 'scraftTotal' || col.id === 'smartTotal') {
                        const brandName = col.brandName || (col.id === 'scraftTotal' ? 'S CRAFT' : 'SMART');
                        const qty = parseFloat(String(r[col.id] || '0').replace(/[^0-9.-]/g, '')) || 0;
                        if (qty <= 0) return;

                        // Find matching profile
                        const normalizedP = normalizeProductName(prodName);
                        let matchedProfile = profiles.find(p => 
                            (p.brand?.toUpperCase() === brandName.toUpperCase() || 
                             (brandName.toUpperCase().includes('CRAFT') && p.brand?.toUpperCase().includes('CRAFT'))) &&
                            (normalizeProductName(p.name) === normalizedP || 
                             normalizeProductName(p.sku) === normalizedP ||
                             normalizedP.includes(normalizeProductName(p.name)) ||
                             normalizeProductName(p.name).includes(normalizedP))
                        );

                        if (!matchedProfile) {
                            // Auto-create missing profile
                            const eachPkt = parseFloat(String(r.eachPacket || '6')) || 6;
                            const pktWt = parseFloat(String(r.packetWeight || '30')) || 30;
                            const pieceWt = pktWt > 0 && eachPkt > 0 ? Number((pktWt / eachPkt).toFixed(3)) : 5;

                            matchedProfile = addProfile({
                                sku: `${prodName.replace(/[^A-Za-z0-9]/g, '').substring(0, 8)}-${brandName.substring(0, 3)}`,
                                name: prodName,
                                category: 'Profile',
                                profileType: 'WINDOW',
                                uom: 'Pcs',
                                length: 5.9,
                                piecesPerPacket: eachPkt,
                                weight: pieceWt,
                                price: 150,
                                brand: brandName,
                                hsnCode: '39162099'
                            });
                            createdCount++;
                        }

                        // Create production transaction for this stock
                        if (matchedProfile) {
                            const curStock = getProfileStock(matchedProfile.id);
                            const diff = qty - curStock;
                            if (diff !== 0) {
                                addProfileTransaction({
                                    profileId: matchedProfile.id,
                                    type: diff > 0 ? 'PRODUCTION' : 'DISPATCH',
                                    quantity: Math.abs(diff),
                                    date: new Date().toISOString(),
                                    refNo: `DP-SYNC-${Date.now().toString().slice(-4)}`,
                                    brand: brandName
                                });
                                updatedCount++;
                            }
                        }
                    }
                });
            });

            showToast(`Data Plan pushed to Stock! Synced ${updatedCount} profiles (${createdCount} new created)`);
            setIsAutoSetupModalOpen(false);
            return;
        }

        // Full Setup & Pull Stock from Profile Section into Data Plan
        updateDataPlanSheet(prev => {
            const curCols = [...(prev.columns && prev.columns.length > 0 ? prev.columns : INITIAL_DATA_PLAN_COLUMNS)];
            const activeBrandsList = ['S CRAFT', 'SMART', ...(brands || [])].filter((v, i, a) => a.indexOf(v) === i);

            // 1. Ensure columns exist for all registered brands
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

            // 2. Map Profile Stock data brand-wise
            const currentRows = [...(prev.rows && prev.rows.length > 0 ? prev.rows : INITIAL_DATA_PLAN_ROWS)];
            const brandCols = curCols.filter(c => c.type === 'brand' || c.id === 'scraftTotal' || c.id === 'smartTotal');

            const updatedRows = currentRows.map(row => {
                const nextRow = { ...row };
                const normProd = normalizeProductName(String(row.product || ''));

                brandCols.forEach(bCol => {
                    const bName = bCol.brandName || (bCol.id === 'scraftTotal' ? 'S CRAFT' : 'SMART');
                    
                    // Find all matching profiles for this row and brand
                    const matchingProfiles = profiles.filter(p => {
                        const pBrand = (p.brand || '').toUpperCase();
                        const targetBrand = bName.toUpperCase();
                        const brandMatch = pBrand === targetBrand || 
                                           (targetBrand.includes('CRAFT') && pBrand.includes('CRAFT'));
                        if (!brandMatch) return false;

                        const normName = normalizeProductName(p.name || '');
                        const normSku = normalizeProductName(p.sku || '');
                        return normName === normProd || 
                               normSku === normProd || 
                               normProd.includes(normName) || 
                               normName.includes(normProd);
                    });

                    if (matchingProfiles.length > 0) {
                        // Sum up current live stock for matching profiles
                        const totalStockPieces = matchingProfiles.reduce((sum, p) => sum + getProfileStock(p.id), 0);
                        if (totalStockPieces > 0 || mode === 'full_setup') {
                            nextRow[bCol.id] = totalStockPieces > 0 ? totalStockPieces : (nextRow[bCol.id] || 0);
                        }

                        // Auto-fill packet specs if available
                        const firstP = matchingProfiles[0];
                        if (firstP.piecesPerPacket && (!nextRow.eachPacket || nextRow.eachPacket === '0' || nextRow.eachPacket === 0)) {
                            nextRow.eachPacket = firstP.piecesPerPacket;
                        }
                        if (firstP.weight && firstP.piecesPerPacket && (!nextRow.packetWeight || nextRow.packetWeight === '0' || nextRow.packetWeight === 0)) {
                            nextRow.packetWeight = Number((firstP.weight * firstP.piecesPerPacket).toFixed(3));
                        }
                    }
                });

                return calculateRowFormulas(nextRow, curCols);
            });

            // 3. For any catalog profiles that don't match any row, auto-add them as new rows if full_setup
            if (mode === 'full_setup') {
                const existingNames = new Set(updatedRows.map(r => normalizeProductName(String(r.product || ''))));
                
                profiles.forEach(p => {
                    const normP = normalizeProductName(p.name || '');
                    if (normP && !existingNames.has(normP)) {
                        existingNames.add(normP);
                        const pStock = getProfileStock(p.id);
                        const pBrand = p.brand || 'S CRAFT';
                        const eachPkt = p.piecesPerPacket || 6;
                        const pktWt = p.weight ? Number((p.weight * eachPkt).toFixed(3)) : 30;

                        const newRow: DataPlanRow = {
                            id: `r_auto_${p.id}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
                            slNo: String(updatedRows.length + 1),
                            product: p.name,
                            scraftTotal: pBrand.toUpperCase().includes('CRAFT') ? pStock : 0,
                            smartTotal: pBrand.toUpperCase() === 'SMART' ? pStock : 0,
                            twoBrandsTotal: pStock,
                            eachPacket: eachPkt,
                            totalPackets: Math.ceil(pStock / eachPkt),
                            avrPacket: Math.round(pStock / (eachPkt * 2)),
                            qtyFactor: 50,
                            packetWeight: pktWt,
                            totalWeight: Number((50 * pktWt).toFixed(3)),
                            m1: '',
                            m2: '',
                            m3: ''
                        };

                        // Assign to custom brand column if applicable
                        brandCols.forEach(bCol => {
                            if (bCol.brandName?.toUpperCase() === pBrand.toUpperCase()) {
                                newRow[bCol.id] = pStock;
                            }
                        });

                        updatedRows.push(calculateRowFormulas(newRow, curCols));
                    }
                });
            }

            return {
                ...prev,
                columns: curCols,
                rows: updatedRows
            };
        });

        showToast(
            mode === 'full_setup'
                ? '⚡ Brand-wise stock auto-setup complete! All brand columns & profile stock synced.'
                : '📥 Live Profile stock pulled into Data Plan successfully.'
        );
        setIsAutoSetupModalOpen(false);
    };

    // Helper to get month strings for the past 3 months relative to target planning month
    const past3MonthKeys = useMemo(() => {
        const [yrStr, moStr] = planTargetMonth.split('-');
        const targetYr = parseInt(yrStr, 10) || new Date().getFullYear();
        const targetMo = parseInt(moStr, 10) || (new Date().getMonth() + 1);

        const getMonthKey = (offset: number) => {
            let m = targetMo - offset;
            let y = targetYr;
            while (m <= 0) {
                m += 12;
                y -= 1;
            }
            return {
                key: `${y}-${String(m).padStart(2, '0')}`,
                label: new Date(y, m - 1, 1).toLocaleString('default', { month: 'short', year: '2-digit' })
            };
        };

        return {
            m1: getMonthKey(3), // 3 months ago
            m2: getMonthKey(2), // 2 months ago
            m3: getMonthKey(1), // 1 month ago
            target: {
                key: planTargetMonth,
                label: new Date(targetYr, targetMo - 1, 1).toLocaleString('default', { month: 'short', year: 'numeric' })
            }
        };
    }, [planTargetMonth]);

    // Calculate historical sales (dispatches) for a profile or product across the 3 months
    const getHistorical3MonthDispatches = useCallback((productName: string) => {
        const norm = normalizeProductName(productName);
        const matchingProfileIds = profiles
            .filter(p => {
                const pNorm = normalizeProductName(p.name);
                const sNorm = normalizeProductName(p.sku);
                return pNorm === norm || sNorm === norm || norm.includes(pNorm) || pNorm.includes(norm);
            })
            .map(p => p.id);

        const dispatches = profileTransactions.filter(t => 
            !t.deletedAt && 
            t.type === 'DISPATCH' && 
            (matchingProfileIds.includes(t.profileId) || (t.profileNameOverride && normalizeProductName(t.profileNameOverride) === norm))
        );

        const sumForMonth = (monthKey: string) => {
            return dispatches
                .filter(t => {
                    const dateStr = (t.date || '').substring(0, 7);
                    return dateStr === monthKey;
                })
                .reduce((sum, t) => sum + Number(t.quantity || 0), 0);
        };

        return {
            m1Qty: sumForMonth(past3MonthKeys.m1.key),
            m2Qty: sumForMonth(past3MonthKeys.m2.key),
            m3Qty: sumForMonth(past3MonthKeys.m3.key)
        };
    }, [profiles, profileTransactions, past3MonthKeys]);

    // Sync live 3-Month Dispatches into DataPlanSheet rows (M1, M2, M3)
    const handleSync3MonthSalesToSheet = () => {
        updateDataPlanSheet(prev => {
            const currentCols = prev.columns && prev.columns.length > 0 ? prev.columns : INITIAL_DATA_PLAN_COLUMNS;
            const updatedRows = (prev.rows && prev.rows.length > 0 ? prev.rows : INITIAL_DATA_PLAN_ROWS).map(r => {
                const prodName = String(r.product || '').trim();
                if (!prodName) return r;

                const sales = getHistorical3MonthDispatches(prodName);
                
                const m1Val = sales.m1Qty > 0 ? String(sales.m1Qty) : (r.m1 || '0');
                const m2Val = sales.m2Qty > 0 ? String(sales.m2Qty) : (r.m2 || '0');
                const m3Val = sales.m3Qty > 0 ? String(sales.m3Qty) : (r.m3 || '0');

                return {
                    ...r,
                    m1: m1Val,
                    m2: m2Val,
                    m3: m3Val
                };
            });

            return {
                ...prev,
                columns: currentCols,
                rows: updatedRows
            };
        });

        showToast(`⚡ Synced 3-Month sales dispatches (${past3MonthKeys.m1.label}, ${past3MonthKeys.m2.label}, ${past3MonthKeys.m3.label}) into M1, M2, M3 columns!`);
    };

    // Die Production Planning Analysis derived from 3-Month sales & current stock
    const diePlanningList = useMemo(() => {
        return rows.map((r, idx) => {
            const prodName = String(r.product || '').trim();
            const norm = normalizeProductName(prodName);

            // Match with profile
            const matchedProfile = profiles.find(p => {
                const pNorm = normalizeProductName(p.name);
                const sNorm = normalizeProductName(p.sku);
                return pNorm === norm || sNorm === norm || norm.includes(pNorm) || pNorm.includes(norm);
            });

            // Parse M1, M2, M3 sales
            const parseVal = (v: any) => parseFloat(String(v || '0').replace(/[^0-9.-]/g, '')) || 0;
            let m1Sales = parseVal(r.m1);
            let m2Sales = parseVal(r.m2);
            let m3Sales = parseVal(r.m3);

            // If M1, M2, M3 are empty in row, fallback to transaction history
            if (m1Sales === 0 && m2Sales === 0 && m3Sales === 0) {
                const history = getHistorical3MonthDispatches(prodName);
                m1Sales = history.m1Qty;
                m2Sales = history.m2Qty;
                m3Sales = history.m3Qty;
            }

            const total3mSales = m1Sales + m2Sales + m3Sales;
            const avg3mSales = total3mSales > 0 ? (total3mSales / 3) : 0;
            const targetDemandLengths = Math.ceil(avg3mSales * demandBufferFactor);

            // Current Stock (Lengths)
            const currentStockLengths = parseVal(r.twoBrandsTotal) || (matchedProfile ? getProfileStock(matchedProfile.id) : 0);

            // Required Production (Lengths)
            const neededLengths = Math.max(0, targetDemandLengths - currentStockLengths);

            // Piece Weight calculation (Kg per length)
            const eachPkt = parseVal(r.eachPacket) || matchedProfile?.piecesPerPacket || 6;
            const pktWt = parseVal(r.packetWeight) || (matchedProfile ? (matchedProfile.weight || 0.8) * eachPkt : 5);
            const pieceWeightKg = eachPkt > 0 ? (pktWt / eachPkt) : (matchedProfile?.weight || 0.85);

            // Required Weight (Kg)
            const neededWeightKg = Number((neededLengths * pieceWeightKg).toFixed(2));

            // Matching Die
            const matchedDie = dies.find(d => 
                !d.deletedAt && 
                (
                    (matchedProfile && d.profileId === matchedProfile.id) ||
                    d.dieNo.toUpperCase() === norm ||
                    norm.includes(d.dieNo.toUpperCase()) ||
                    d.dieNo.toUpperCase().includes(norm)
                )
            );

            const dieOutputKgHr = matchedDie?.expectedOutputKgHr || 65;
            const cavities = matchedDie?.cavities || 1;
            const extrusionHours = neededWeightKg > 0 ? Number((neededWeightKg / dieOutputKgHr).toFixed(2)) : 0;
            const shiftsRequired = extrusionHours > 0 ? Number((extrusionHours / 8).toFixed(1)) : 0;

            return {
                id: r.id,
                slNo: r.slNo || String(idx + 1),
                productName: prodName || `Product #${idx + 1}`,
                profile: matchedProfile,
                die: matchedDie,
                m1Sales,
                m2Sales,
                m3Sales,
                total3mSales,
                avg3mSales: Number(avg3mSales.toFixed(1)),
                targetDemandLengths,
                currentStockLengths,
                neededLengths,
                pieceWeightKg: Number(pieceWeightKg.toFixed(3)),
                neededWeightKg,
                dieOutputKgHr,
                cavities,
                extrusionHours,
                shiftsRequired,
                hasDeficit: neededLengths > 0
            };
        });
    }, [rows, profiles, dies, demandBufferFactor, getHistorical3MonthDispatches, getProfileStock]);

    // Summary Statistics for the Die Plan
    const diePlanSummary = useMemo(() => {
        const itemsWithDeficit = diePlanningList.filter(i => i.neededLengths > 0);
        const totalNeededLengths = itemsWithDeficit.reduce((s, i) => s + i.neededLengths, 0);
        const totalNeededWeightKg = itemsWithDeficit.reduce((s, i) => s + i.neededWeightKg, 0);
        const totalExtrusionHours = itemsWithDeficit.reduce((s, i) => s + i.extrusionHours, 0);
        const totalShifts = Number((totalExtrusionHours / 8).toFixed(1));
        const diesRequiredCount = new Set(itemsWithDeficit.map(i => i.die?.id || i.productName)).size;
        const totalCurrentStock = diePlanningList.reduce((s, i) => s + i.currentStockLengths, 0);
        const total3mSales = diePlanningList.reduce((s, i) => s + i.total3mSales, 0);

        return {
            itemsWithDeficitCount: itemsWithDeficit.length,
            totalNeededLengths,
            totalNeededWeightKg: Number(totalNeededWeightKg.toFixed(1)),
            totalExtrusionHours: Number(totalExtrusionHours.toFixed(1)),
            totalShifts,
            diesRequiredCount,
            totalCurrentStock,
            total3mSales
        };
    }, [diePlanningList]);

    // Auto-Generate Machine Production Plans
    const handleGenerateProductionPlans = () => {
        setIsGeneratingPlans(true);
        let createdCount = 0;

        try {
            const itemsToSchedule = diePlanningList.filter(i => i.neededLengths > 0);
            if (itemsToSchedule.length === 0) {
                showToast('No production deficit found! Current stock is sufficient for 3-month sales demand.');
                setIsGeneratingPlans(false);
                return;
            }

            const targetDateStr = `${planTargetMonth}-01`;

            itemsToSchedule.forEach((item, idx) => {
                let dieIdToUse = item.die?.id;

                if (!dieIdToUse && item.profile) {
                    dieIdToUse = dies[0]?.id || `DIE-${item.profile.id.substring(0, 6)}`;
                }

                if (dieIdToUse) {
                    addProductionPlan({
                        date: targetDateStr,
                        shift: (idx % 2 === 0 ? 'A' : 'B'),
                        machineNo: selectedMachinePrefix,
                        dieIds: [dieIdToUse],
                        targetLengths: item.neededLengths,
                        status: 'PENDING'
                    });
                    createdCount++;
                }
            });

            showToast(`🚀 Successfully generated ${createdCount} Machine Production Plans for ${past3MonthKeys.target.label}!`);
            setIsDiePlanModalOpen(false);
        } catch (err) {
            showToast('Error generating production plans. Please verify die configurations.');
        } finally {
            setIsGeneratingPlans(false);
        }
    };

    // Cell edit handler
    const handleCellChange = (rowId: string, colId: string, value: string) => {
        updateDataPlanSheet(prev => {
            const currentCols = prev.columns && prev.columns.length > 0 ? prev.columns : INITIAL_DATA_PLAN_COLUMNS;
            const updatedRows = (prev.rows && prev.rows.length > 0 ? prev.rows : INITIAL_DATA_PLAN_ROWS).map(r => {
                if (r.id !== rowId) return r;
                const nextRow = { ...r, [colId]: value };
                if (['scraftTotal', 'smartTotal', 'eachPacket', 'qtyFactor', 'packetWeight'].includes(colId) || 
                    currentCols.find(c => c.id === colId)?.type === 'brand') {
                    return calculateRowFormulas(nextRow, currentCols);
                }
                return nextRow;
            });
            return { ...prev, columns: currentCols, rows: updatedRows };
        });
    };

    // Open add column dialog preset to a specific location
    const openAddColumnAt = (position: 'start' | 'end' | 'before' | 'after', targetColId?: string) => {
        setInsertPositionType(position);
        setInsertTargetColId(targetColId || (columns[0]?.id ?? ''));
        setNewColLabel('');
        setNewColBrand('');
        setNewColType('text');
        setIsAddColumnModalOpen(true);
        setActiveColMenuId(null);
    };

    // Add Column with customizable location
    const handleAddColumn = () => {
        if (!newColLabel.trim()) {
            showToast('Please enter a column title');
            return;
        }
        const colId = `col_${Date.now()}_${newColLabel.toLowerCase().replace(/[^a-z0-9]/g, '_').substring(0, 16)}`;
        const newCol: DataPlanColumn = {
            id: colId,
            label: newColLabel.trim(),
            type: newColType,
            brandName: newColType === 'brand' ? (newColBrand || newColLabel.trim()) : undefined,
            align: newColType === 'number' || newColType === 'brand' ? 'right' : 'left',
            width: newColType === 'brand' ? '140px' : '130px'
        };

        updateDataPlanSheet(prev => {
            const curCols = [...(prev.columns && prev.columns.length > 0 ? prev.columns : INITIAL_DATA_PLAN_COLUMNS)];
            const curRows = (prev.rows && prev.rows.length > 0 ? prev.rows : INITIAL_DATA_PLAN_ROWS).map(r => ({
                ...r,
                [colId]: newColType === 'number' || newColType === 'brand' ? 0 : ''
            }));

            let nextCols = [...curCols];
            if (insertPositionType === 'start') {
                // Place after product/slNo if present or right at index 1
                nextCols.splice(1, 0, newCol);
            } else if (insertPositionType === 'before' && insertTargetColId) {
                const targetIdx = nextCols.findIndex(c => c.id === insertTargetColId);
                if (targetIdx !== -1) {
                    nextCols.splice(targetIdx, 0, newCol);
                } else {
                    nextCols.push(newCol);
                }
            } else if (insertPositionType === 'after' && insertTargetColId) {
                const targetIdx = nextCols.findIndex(c => c.id === insertTargetColId);
                if (targetIdx !== -1) {
                    nextCols.splice(targetIdx + 1, 0, newCol);
                } else {
                    nextCols.push(newCol);
                }
            } else {
                nextCols.push(newCol);
            }

            return {
                ...prev,
                columns: nextCols,
                rows: curRows
            };
        });

        setIsAddColumnModalOpen(false);
        setNewColLabel('');
        setNewColBrand('');
        showToast(`Column "${newCol.label}" placed successfully`);
    };

    // Quick Add Brand Column with target placement (defaults to after the last brand column)
    const handleQuickAddBrandColumn = (brandName: string) => {
        const colId = `brand_${brandName.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${Date.now()}`;
        const newCol: DataPlanColumn = {
            id: colId,
            label: `${brandName} (L)`,
            type: 'brand',
            brandName: brandName,
            align: 'right',
            width: '140px'
        };
        updateDataPlanSheet(prev => {
            const curCols = [...(prev.columns && prev.columns.length > 0 ? prev.columns : INITIAL_DATA_PLAN_COLUMNS)];
            const curRows = (prev.rows && prev.rows.length > 0 ? prev.rows : INITIAL_DATA_PLAN_ROWS).map(r => ({
                ...r,
                [colId]: 0
            }));

            // Find where to place: after SMART or after scraft or before 2brands
            let insertIdx = curCols.findIndex(c => c.id === 'smartTotal');
            if (insertIdx === -1) {
                insertIdx = curCols.findIndex(c => c.id === 'twoBrandsTotal');
            }
            if (insertIdx !== -1) {
                curCols.splice(insertIdx + 1, 0, newCol);
            } else {
                curCols.push(newCol);
            }

            return {
                ...prev,
                columns: curCols,
                rows: curRows
            };
        });
        showToast(`Brand Column for "${brandName}" added`);
    };

    // Move Column Left
    const handleMoveColumnLeft = (colId: string) => {
        const curCols = [...columns];
        const idx = curCols.findIndex(c => c.id === colId);
        if (idx <= 0) return;
        const temp = curCols[idx];
        curCols[idx] = curCols[idx - 1];
        curCols[idx - 1] = temp;
        updateDataPlanSheet(prev => ({ ...prev, columns: curCols }));
        showToast(`Moved "${temp.label}" left`);
    };

    // Move Column Right
    const handleMoveColumnRight = (colId: string) => {
        const curCols = [...columns];
        const idx = curCols.findIndex(c => c.id === colId);
        if (idx === -1 || idx >= curCols.length - 1) return;
        const temp = curCols[idx];
        curCols[idx] = curCols[idx + 1];
        curCols[idx + 1] = temp;
        updateDataPlanSheet(prev => ({ ...prev, columns: curCols }));
        showToast(`Moved "${temp.label}" right`);
    };

    // Confirm and Delete Column (Works in all browsers without iframe confirm blocking)
    const executeDeleteColumn = (col: DataPlanColumn) => {
        const colId = col.id;
        updateDataPlanSheet(prev => {
            const currentCols = prev.columns && prev.columns.length > 0 ? prev.columns : INITIAL_DATA_PLAN_COLUMNS;
            const currentRows = prev.rows && prev.rows.length > 0 ? prev.rows : INITIAL_DATA_PLAN_ROWS;
            
            const newCols = currentCols.filter(c => c.id !== colId);
            const newRows = currentRows.map(r => {
                const nextRow = { ...r };
                delete nextRow[colId];
                return nextRow;
            });
            return { ...prev, columns: newCols, rows: newRows };
        });
        setColumnToDelete(null);
        setActiveColMenuId(null);
        showToast(`Column "${col.label}" deleted`);
    };

    // Rename Column
    const handleSaveRenameColumn = () => {
        if (!editingColId || !editColLabel.trim()) return;
        updateDataPlanSheet(prev => {
            const curCols = prev.columns && prev.columns.length > 0 ? prev.columns : INITIAL_DATA_PLAN_COLUMNS;
            const newCols = curCols.map(c => {
                if (c.id === editingColId) {
                    return { ...c, label: editColLabel.trim() };
                }
                return c;
            });
            return { ...prev, columns: newCols };
        });
        setEditingColId(null);
        setEditColLabel('');
        showToast('Column renamed');
    };

    // Row Operations
    const handleAddRow = (position: 'top' | 'bottom' | 'after' = 'bottom', targetRowId?: string) => {
        const newRowId = `r_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
        const emptyRow: DataPlanRow = {
            id: newRowId,
            slNo: String(rows.length + 1),
            product: 'New Profile / Product',
            scraftTotal: 0,
            smartTotal: 0,
            twoBrandsTotal: 0,
            eachPacket: 6,
            totalPackets: 0,
            avrPacket: 0,
            qtyFactor: 0,
            packetWeight: 0,
            totalWeight: 0,
            m1: '',
            m2: '',
            m3: ''
        };

        updateDataPlanSheet(prev => {
            const currentRows = [...(prev.rows && prev.rows.length > 0 ? prev.rows : INITIAL_DATA_PLAN_ROWS)];
            if (position === 'top') {
                return { ...prev, rows: [emptyRow, ...currentRows] };
            } else if (position === 'after' && targetRowId) {
                const idx = currentRows.findIndex(r => r.id === targetRowId);
                if (idx !== -1) {
                    currentRows.splice(idx + 1, 0, emptyRow);
                    return { ...prev, rows: currentRows };
                }
            }
            return { ...prev, rows: [...currentRows, emptyRow] };
        });
        showToast('New row added');
    };

    const handleDeleteRow = (rowId: string) => {
        updateDataPlanSheet(prev => ({
            ...prev,
            rows: (prev.rows && prev.rows.length > 0 ? prev.rows : INITIAL_DATA_PLAN_ROWS).filter(r => r.id !== rowId)
        }));
        setSelectedRowIds(prev => {
            const next = new Set(prev);
            next.delete(rowId);
            return next;
        });
        showToast('Row deleted');
    };

    const handleDeleteSelectedRows = () => {
        if (selectedRowIds.size === 0) return;
        updateDataPlanSheet(prev => ({
            ...prev,
            rows: (prev.rows && prev.rows.length > 0 ? prev.rows : INITIAL_DATA_PLAN_ROWS).filter(r => !selectedRowIds.has(r.id))
        }));
        const count = selectedRowIds.size;
        setSelectedRowIds(new Set());
        showToast(`${count} rows removed`);
    };

    const handleDuplicateRow = (rowId: string) => {
        const sourceRow = rows.find(r => r.id === rowId);
        if (!sourceRow) return;
        const newRow: DataPlanRow = {
            ...sourceRow,
            id: `r_${Date.now()}_${Math.random().toString(36).substring(2, 6)}_dup`,
            product: `${sourceRow.product} (Copy)`
        };
        updateDataPlanSheet(prev => {
            const currentRows = [...(prev.rows && prev.rows.length > 0 ? prev.rows : INITIAL_DATA_PLAN_ROWS)];
            const idx = currentRows.findIndex(r => r.id === rowId);
            if (idx !== -1) {
                currentRows.splice(idx + 1, 0, newRow);
                return { ...prev, rows: currentRows };
            }
            return { ...prev, rows: [...currentRows, newRow] };
        });
        showToast('Row duplicated');
    };

    const handleRecomputeAll = () => {
        updateDataPlanSheet(prev => {
            const curCols = prev.columns && prev.columns.length > 0 ? prev.columns : INITIAL_DATA_PLAN_COLUMNS;
            const updatedRows = (prev.rows && prev.rows.length > 0 ? prev.rows : INITIAL_DATA_PLAN_ROWS).map(r => calculateRowFormulas(r, curCols));
            return { ...prev, rows: updatedRows };
        });
        showToast('All formulas and weights recalculated');
    };

    const handleReset = () => {
        resetDataPlanSheet();
        showToast('Reset to default template');
    };

    const handleExportExcel = () => {
        const exportData = rows.map(r => {
            const rowObj: Record<string, any> = {};
            columns.forEach(col => {
                rowObj[col.label] = r[col.id] ?? '';
            });
            return rowObj;
        });

        const worksheet = XLSX.utils.json_to_sheet(exportData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Data Plan');
        XLSX.writeFile(workbook, `Data_Plan_Production_${new Date().toISOString().split('T')[0]}.xlsx`);
        showToast('Exported to Excel');
    };

    const handleExportCSV = () => {
        const headers = columns.map(c => `"${c.label.replace(/"/g, '""')}"`).join(',');
        const bodyRows = rows.map(r => 
            columns.map(c => `"${String(r[c.id] ?? '').replace(/"/g, '""')}"`).join(',')
        ).join('\n');

        const csvContent = `${headers}\n${bodyRows}`;
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `Data_Plan_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        showToast('Exported to CSV');
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (evt) => {
            try {
                const bstr = evt.target?.result;
                const wb = XLSX.read(bstr, { type: 'binary' });
                const wsname = wb.SheetNames[0];
                const ws = wb.Sheets[wsname];
                const data: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });
                
                if (!data || data.length < 2) {
                    showToast('Invalid spreadsheet format.');
                    return;
                }

                const headerRow = data[0] as string[];
                const importedCols: DataPlanColumn[] = headerRow.map((h, i) => ({
                    id: `col_imp_${i}_${Date.now()}`,
                    label: String(h || `Column ${i + 1}`),
                    type: typeof data[1]?.[i] === 'number' ? 'number' : 'text',
                    align: typeof data[1]?.[i] === 'number' ? 'right' : 'left'
                }));

                const importedRows: DataPlanRow[] = data.slice(1).map((r, rIdx) => {
                    const rowData: any = {
                        id: `r_imp_${rIdx}_${Date.now()}`,
                        slNo: String(rIdx + 1),
                        product: String(r[2] || r[1] || r[0] || `Item ${rIdx + 1}`)
                    };
                    importedCols.forEach((col, cIdx) => {
                        rowData[col.id] = r[cIdx] !== undefined ? r[cIdx] : '';
                    });
                    return rowData;
                });

                updateDataPlanSheet(prev => ({
                    ...prev,
                    columns: importedCols,
                    rows: importedRows
                }));
                showToast(`Imported ${importedRows.length} rows successfully`);
            } catch (err) {
                console.error(err);
                showToast('Error parsing file.');
            }
        };
        reader.readAsBinaryString(file);
    };

    const filteredRows = useMemo(() => {
        return rows.filter(r => {
            if (!searchTerm.trim()) return true;
            const query = searchTerm.toLowerCase();
            const productMatch = String(r.product || '').toLowerCase().includes(query);
            const slMatch = String(r.slNo || '').toLowerCase().includes(query);
            const anyCellMatch = Object.values(r).some(val => String(val).toLowerCase().includes(query));
            return productMatch || slMatch || anyCellMatch;
        });
    }, [rows, searchTerm]);

    const totals = useMemo(() => {
        let totalSCraft = 0;
        let totalSmart = 0;
        let totalTwoBrands = 0;
        let totalPkts = 0;
        let totalAvr = 0;
        let totalPlanWeight = 0;
        const brandTotals: Record<string, number> = {};

        rows.forEach(r => {
            const scraft = parseFloat(String(r.scraftTotal || '0').replace(/[^0-9.-]/g, '')) || 0;
            const smart = parseFloat(String(r.smartTotal || '0').replace(/[^0-9.-]/g, '')) || 0;
            const twoB = parseFloat(String(r.twoBrandsTotal || '0').replace(/[^0-9.-]/g, '')) || 0;
            const pkts = parseFloat(String(r.totalPackets || '0').replace(/[^0-9.-]/g, '')) || 0;
            const avr = parseFloat(String(r.avrPacket || '0').replace(/[^0-9.-]/g, '')) || 0;
            const wt = parseFloat(String(r.totalWeight || '0').replace(/[^0-9.-]/g, '')) || 0;

            totalSCraft += scraft;
            totalSmart += smart;
            totalTwoBrands += twoB;
            totalPkts += pkts;
            totalAvr += avr;
            totalPlanWeight += wt;

            columns.forEach(col => {
                if (col.type === 'brand') {
                    const val = parseFloat(String(r[col.id] || '0').replace(/[^0-9.-]/g, '')) || 0;
                    brandTotals[col.id] = (brandTotals[col.id] || 0) + val;
                }
            });
        });

        return {
            totalSCraft,
            totalSmart,
            totalTwoBrands,
            totalPkts,
            totalAvr,
            totalPlanWeight,
            brandTotals
        };
    }, [rows, columns]);

    const toggleSelectAll = () => {
        if (selectedRowIds.size === filteredRows.length) {
            setSelectedRowIds(new Set());
        } else {
            setSelectedRowIds(new Set(filteredRows.map(r => r.id)));
        }
    };

    const toggleSelectRow = (id: string) => {
        setSelectedRowIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    return (
        <div className={`space-y-4 ${isFullScreen ? 'fixed inset-0 z-50 bg-white dark:bg-gray-900 p-6 overflow-auto' : ''}`}>
            {/* Top Bar / Summary Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-xl">
                    <p className="text-[10px] font-black uppercase tracking-wider text-blue-600 dark:text-blue-400">Total Products</p>
                    <p className="text-xl font-black text-gray-900 dark:text-white mt-1">{rows.length}</p>
                </div>
                <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800 rounded-xl">
                    <p className="text-[10px] font-black uppercase tracking-wider text-amber-600 dark:text-amber-400">S CRAFT Total (L)</p>
                    <p className="text-xl font-black text-gray-900 dark:text-white mt-1 font-mono">{(totals?.totalSCraft || 0).toLocaleString()}</p>
                </div>
                <div className="p-3 bg-purple-50 dark:bg-purple-900/20 border border-purple-100 dark:border-purple-800 rounded-xl">
                    <p className="text-[10px] font-black uppercase tracking-wider text-purple-600 dark:text-purple-400">SMART Total (L)</p>
                    <p className="text-xl font-black text-gray-900 dark:text-white mt-1 font-mono">{totals.totalSmart.toLocaleString()}</p>
                </div>
                <div className="p-3 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800 rounded-xl">
                    <p className="text-[10px] font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400">2 Brands Sum (L)</p>
                    <p className="text-xl font-black text-gray-900 dark:text-white mt-1 font-mono">{totals.totalTwoBrands.toLocaleString()}</p>
                </div>
                <div className="p-3 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800 rounded-xl">
                    <p className="text-[10px] font-black uppercase tracking-wider text-indigo-600 dark:text-indigo-400">Total Packets</p>
                    <p className="text-xl font-black text-gray-900 dark:text-white mt-1 font-mono">{Math.round(totals.totalPkts).toLocaleString()}</p>
                </div>
                <div className="p-3 bg-rose-50 dark:bg-rose-900/20 border border-rose-100 dark:border-rose-800 rounded-xl">
                    <p className="text-[10px] font-black uppercase tracking-wider text-rose-600 dark:text-rose-400">Total Plan Wt (Kg)</p>
                    <p className="text-xl font-black text-gray-900 dark:text-white mt-1 font-mono">{totals.totalPlanWeight.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 2 })}</p>
                </div>
            </div>

            {/* Brands Placement Bar & Auto-Setup */}
            <div className="bg-gradient-to-r from-blue-50 via-indigo-50 to-purple-50 dark:from-gray-800 dark:via-gray-800/80 dark:to-gray-800/60 p-3.5 rounded-2xl border border-blue-200/60 dark:border-gray-700 flex flex-wrap items-center justify-between gap-3 shadow-sm">
                <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-black uppercase tracking-wider text-blue-900 dark:text-blue-300 flex items-center gap-1.5 mr-1">
                        <Tag className="w-3.5 h-3.5 text-blue-600" /> Active Brands:
                    </span>
                    {['S CRAFT', 'SMART', ...(brands || [])].filter((v, i, a) => a.indexOf(v) === i).map(b => (
                        <div key={b} className="group relative inline-flex items-center gap-1.5 px-3 py-1 bg-white dark:bg-gray-700 rounded-lg border border-blue-100 dark:border-gray-600 shadow-2xs">
                            <span className="text-xs font-bold text-gray-800 dark:text-gray-200">{b}</span>
                            <button
                                onClick={() => handleQuickAddBrandColumn(b)}
                                title={`Add Column for ${b}`}
                                className="text-blue-600 hover:text-blue-700 text-[10px] font-black uppercase px-1.5 py-0.5 bg-blue-50 dark:bg-blue-900/40 hover:bg-blue-100 rounded transition-all flex items-center gap-0.5"
                            >
                                <Plus className="w-2.5 h-2.5" /> Col
                            </button>
                        </div>
                    ))}
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setIsDiePlanModalOpen(true)}
                        className="px-3.5 py-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-lg text-xs font-black uppercase tracking-tight flex items-center gap-1.5 shadow-md shadow-emerald-500/20 transition-all cursor-pointer"
                        title="Automatically plan monthly Die production lengths from 3-month sales & stock"
                    >
                        <Cpu className="w-3.5 h-3.5 text-emerald-200" /> ⚡ 3-Month Die Plan
                    </button>
                    <button
                        onClick={() => setIsAutoSetupModalOpen(true)}
                        className="px-3.5 py-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-lg text-xs font-black uppercase tracking-tight flex items-center gap-1.5 shadow-md shadow-blue-500/20 transition-all cursor-pointer"
                        title="Auto-setup brand columns and import profile stock"
                    >
                        <Zap className="w-3.5 h-3.5 text-yellow-300 fill-yellow-300" /> Auto-Setup Brand Stock
                    </button>
                    {onOpenManageBrands && (
                        <button
                            onClick={onOpenManageBrands}
                            className="px-3 py-1.5 bg-white dark:bg-gray-700 hover:bg-gray-50 text-gray-700 dark:text-gray-300 rounded-lg text-xs font-bold border border-gray-200 dark:border-gray-600 flex items-center gap-1.5 shadow-2xs transition-all"
                        >
                            <Sparkles className="w-3.5 h-3.5 text-yellow-500" /> Manage Brands
                        </button>
                    )}
                    <button
                        onClick={() => handleRecomputeAll()}
                        className="px-3 py-1.5 bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 text-blue-600 dark:text-blue-400 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all"
                        title="Recalculate all formulas & totals"
                    >
                        <Calculator className="w-3.5 h-3.5" /> Recalculate
                    </button>
                </div>
            </div>

            {/* Action Toolbar */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 bg-white dark:bg-gray-800 p-3.5 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm">
                <div className="flex flex-wrap items-center gap-2 flex-1">
                    {/* Search */}
                    <div className="relative min-w-[220px] max-w-sm flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Filter by product name, code or number..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-9 pr-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-xs outline-none focus:ring-2 focus:ring-blue-500 transition-all text-gray-900 dark:text-white"
                        />
                        {searchTerm && (
                            <button onClick={() => setSearchTerm('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                                <X className="w-3.5 h-3.5" />
                            </button>
                        )}
                    </div>

                    {/* 3M Sales Sync Button */}
                    <button
                        onClick={handleSync3MonthSalesToSheet}
                        className="px-3 py-2 bg-purple-50 dark:bg-purple-900/30 hover:bg-purple-100 text-purple-700 dark:text-purple-300 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all border border-purple-200/60 dark:border-purple-800 cursor-pointer"
                        title={`Sync 3-Month Sales Dispatches (${past3MonthKeys.m1.label}, ${past3MonthKeys.m2.label}, ${past3MonthKeys.m3.label}) into M1, M2, M3 columns`}
                    >
                        <TrendingUp className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" /> Sync 3M Sales
                    </button>

                    {/* Auto Sync Quick Action */}
                    <button
                        onClick={() => handleAutoSetupBrandStock('pull_stock')}
                        className="px-3 py-2 bg-amber-50 dark:bg-amber-900/30 hover:bg-amber-100 text-amber-700 dark:text-amber-300 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all border border-amber-200/60 dark:border-amber-800 cursor-pointer"
                        title="Pull latest live stock from Profile inventory into Sheet"
                    >
                        <RefreshCw className="w-3.5 h-3.5" /> Sync Live Stock
                    </button>

                    {/* Add Row Button */}
                    <button
                        onClick={() => handleAddRow('bottom')}
                        className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
                    >
                        <Plus className="w-4 h-4" /> Add Row
                    </button>

                    {/* Add Column Button with placement options */}
                    <button
                        onClick={() => openAddColumnAt('end')}
                        className="px-3.5 py-2 bg-indigo-50 dark:bg-indigo-900/30 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all border border-indigo-100 dark:border-indigo-800 cursor-pointer"
                    >
                        <Plus className="w-4 h-4" /> Add Column
                    </button>

                    {/* Delete Selected Rows Button */}
                    {selectedRowIds.size > 0 && (
                        <button
                            onClick={handleDeleteSelectedRows}
                            className="px-3.5 py-2 bg-rose-50 dark:bg-rose-900/30 hover:bg-rose-100 text-rose-600 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all animate-pulse cursor-pointer"
                        >
                            <Trash2 className="w-4 h-4" /> Delete ({selectedRowIds.size})
                        </button>
                    )}
                </div>

                {/* Right side utility buttons */}
                <div className="flex items-center gap-2 flex-wrap">
                    <button
                        onClick={handleExportExcel}
                        className="px-3 py-2 bg-emerald-50 dark:bg-emerald-900/30 hover:bg-emerald-100 text-emerald-700 dark:text-emerald-300 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all border border-emerald-100 dark:border-emerald-800 cursor-pointer"
                        title="Export as Excel"
                    >
                        <Download className="w-3.5 h-3.5" /> Excel
                    </button>
                    <button
                        onClick={handleExportCSV}
                        className="px-3 py-2 bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 text-gray-700 dark:text-gray-300 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all border border-gray-200 dark:border-gray-600 cursor-pointer"
                        title="Export CSV"
                    >
                        <FileSpreadsheet className="w-3.5 h-3.5" /> CSV
                    </button>
                    
                    <label className="px-3 py-2 bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 text-gray-700 dark:text-gray-300 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all border border-gray-200 dark:border-gray-600 cursor-pointer">
                        <Upload className="w-3.5 h-3.5" /> Import
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept=".xlsx,.xls,.csv"
                            onChange={handleFileUpload}
                            className="hidden"
                        />
                    </label>

                    <button
                        onClick={() => window.print()}
                        className="p-2 bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 text-gray-600 dark:text-gray-400 rounded-xl transition-all border border-gray-200 dark:border-gray-600 cursor-pointer"
                        title="Print Sheet"
                    >
                        <Printer className="w-4 h-4" />
                    </button>

                    <button
                        onClick={() => setIsFullScreen(!isFullScreen)}
                        className="p-2 bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 text-gray-600 dark:text-gray-400 rounded-xl transition-all border border-gray-200 dark:border-gray-600 cursor-pointer"
                        title={isFullScreen ? "Exit Fullscreen" : "Fullscreen"}
                    >
                        {isFullScreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                    </button>

                    <button
                        onClick={handleReset}
                        className="p-2 bg-rose-50 dark:bg-rose-900/20 hover:bg-rose-100 text-rose-600 rounded-xl transition-all border border-rose-100 dark:border-rose-900 cursor-pointer"
                        title="Reset to Template"
                    >
                        <RotateCcw className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* Toast feedback */}
            {toastMessage && (
                <div className="bg-blue-600 text-white text-xs font-bold px-4 py-2 rounded-xl shadow-lg w-fit mx-auto transition-all animate-bounce">
                    {toastMessage}
                </div>
            )}

            {/* Main Interactive Spreadsheet Grid */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden flex flex-col">
                <div className="overflow-x-auto max-h-[680px] overflow-y-auto relative">
                    <table className="w-full text-left border-collapse min-w-[1200px]">
                        {/* Table Header */}
                        <thead className="bg-gray-50 dark:bg-gray-900 text-gray-600 dark:text-gray-300 uppercase text-[10px] font-black tracking-wider sticky top-0 z-20 border-b border-gray-200 dark:border-gray-700">
                            <tr>
                                {/* Row selection checkbox */}
                                <th className="p-2.5 w-10 text-center sticky left-0 bg-gray-50 dark:bg-gray-900 z-30 border-r border-gray-200 dark:border-gray-700">
                                    <input
                                        type="checkbox"
                                        checked={selectedRowIds.size > 0 && selectedRowIds.size === filteredRows.length}
                                        onChange={toggleSelectAll}
                                        className="rounded text-blue-600 focus:ring-blue-500 w-3.5 h-3.5 cursor-pointer"
                                    />
                                </th>
                                
                                {/* Dynamic Columns with complete placement and deletion controls */}
                                {columns.map((col, colIdx) => (
                                    <th
                                        key={col.id}
                                        style={{ minWidth: col.width || '120px' }}
                                        className={`p-2 border-r border-gray-200 dark:border-gray-700 group relative select-none ${
                                            col.type === 'brand' 
                                                ? 'bg-blue-50/70 dark:bg-blue-900/20 text-blue-900 dark:text-blue-300' 
                                                : col.id === 'twoBrandsTotal' 
                                                ? 'bg-emerald-50/70 dark:bg-emerald-900/20 text-emerald-900 dark:text-emerald-300'
                                                : col.id === 'totalWeight'
                                                ? 'bg-rose-50/70 dark:bg-rose-900/20 text-rose-900 dark:text-rose-300'
                                                : ''
                                        }`}
                                    >
                                        <div className="flex items-center justify-between gap-1">
                                            {/* Column Title */}
                                            <span 
                                                onDoubleClick={() => {
                                                    setEditingColId(col.id);
                                                    setEditColLabel(col.label);
                                                }}
                                                className="cursor-pointer hover:underline truncate font-extrabold flex-1 text-gray-800 dark:text-gray-200"
                                                title="Double-click to rename column"
                                            >
                                                {col.label}
                                            </span>

                                            {/* Header Control Icons (Move Left, Move Right, Insert, Delete) */}
                                            <div className="flex items-center gap-0.5 opacity-80 group-hover:opacity-100 transition-opacity">
                                                {/* Move Left */}
                                                {colIdx > 0 && (
                                                    <button
                                                        onClick={() => handleMoveColumnLeft(col.id)}
                                                        className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/40 rounded transition-colors"
                                                        title="Move Column Left"
                                                    >
                                                        <ArrowLeft className="w-3 h-3" />
                                                    </button>
                                                )}

                                                {/* Move Right */}
                                                {colIdx < columns.length - 1 && (
                                                    <button
                                                        onClick={() => handleMoveColumnRight(col.id)}
                                                        className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/40 rounded transition-colors"
                                                        title="Move Column Right"
                                                    >
                                                        <ArrowRight className="w-3 h-3" />
                                                    </button>
                                                )}

                                                {/* Column Options Menu Trigger */}
                                                <button
                                                    onClick={() => setActiveColMenuId(activeColMenuId === col.id ? null : col.id)}
                                                    className="p-1 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-colors"
                                                    title="Column Options & Placement"
                                                >
                                                    <MoreVertical className="w-3 h-3" />
                                                </button>

                                                {/* Direct Delete Button on Header */}
                                                <button
                                                    onClick={() => setColumnToDelete(col)}
                                                    className="p-1 text-gray-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/40 rounded transition-colors"
                                                    title="Delete this column"
                                                >
                                                    <Trash2 className="w-3 h-3" />
                                                </button>
                                            </div>
                                        </div>

                                        {/* Dropdown Menu for Column Placement & Actions */}
                                        {activeColMenuId === col.id && (
                                            <div className="absolute top-full left-0 mt-1 z-50 w-48 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 py-1.5 text-xs normal-case font-medium">
                                                <button
                                                    onClick={() => openAddColumnAt('before', col.id)}
                                                    className="w-full text-left px-3 py-1.5 hover:bg-blue-50 dark:hover:bg-blue-900/30 text-gray-700 dark:text-gray-200 flex items-center gap-2"
                                                >
                                                    <Plus className="w-3.5 h-3.5 text-blue-600" />
                                                    Insert Column Left
                                                </button>
                                                <button
                                                    onClick={() => openAddColumnAt('after', col.id)}
                                                    className="w-full text-left px-3 py-1.5 hover:bg-blue-50 dark:hover:bg-blue-900/30 text-gray-700 dark:text-gray-200 flex items-center gap-2"
                                                >
                                                    <Plus className="w-3.5 h-3.5 text-indigo-600" />
                                                    Insert Column Right
                                                </button>
                                                <div className="my-1 border-t border-gray-100 dark:border-gray-700" />
                                                <button
                                                    onClick={() => {
                                                        setEditingColId(col.id);
                                                        setEditColLabel(col.label);
                                                        setActiveColMenuId(null);
                                                    }}
                                                    className="w-full text-left px-3 py-1.5 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 flex items-center gap-2"
                                                >
                                                    <Edit3 className="w-3.5 h-3.5 text-gray-500" />
                                                    Rename Header
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        setColumnToDelete(col);
                                                        setActiveColMenuId(null);
                                                    }}
                                                    className="w-full text-left px-3 py-1.5 hover:bg-rose-50 dark:hover:bg-rose-900/30 text-rose-600 flex items-center gap-2"
                                                >
                                                    <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                                                    Delete Column
                                                </button>
                                            </div>
                                        )}
                                    </th>
                                ))}

                                {/* Actions Column Header */}
                                <th className="p-2.5 w-16 text-center text-gray-400 sticky right-0 bg-gray-50 dark:bg-gray-900 z-30">
                                    Actions
                                </th>
                            </tr>
                        </thead>

                        {/* Table Body */}
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-700/60 text-xs">
                            {filteredRows.length === 0 ? (
                                <tr>
                                    <td colSpan={columns.length + 2} className="py-12 text-center text-gray-400 font-medium">
                                        No items matching &ldquo;{searchTerm}&rdquo;
                                    </td>
                                </tr>
                            ) : (
                                filteredRows.map((row, rIdx) => {
                                    const isSelected = selectedRowIds.has(row.id);
                                    return (
                                        <tr
                                            key={row.id ? `${row.id}_${rIdx}` : `row_${rIdx}`}
                                            className={`group transition-colors ${
                                                isSelected 
                                                    ? 'bg-blue-50/80 dark:bg-blue-900/30' 
                                                    : rIdx % 2 === 0 
                                                    ? 'bg-white dark:bg-gray-800' 
                                                    : 'bg-gray-50/40 dark:bg-gray-800/50'
                                            } hover:bg-blue-50/40 dark:hover:bg-blue-900/10`}
                                        >
                                            {/* Row selector checkbox */}
                                            <td className="p-2 text-center sticky left-0 bg-inherit z-10 border-r border-gray-100 dark:border-gray-700/60">
                                                <input
                                                    type="checkbox"
                                                    checked={isSelected}
                                                    onChange={() => toggleSelectRow(row.id)}
                                                    className="rounded text-blue-600 focus:ring-blue-500 w-3.5 h-3.5 cursor-pointer"
                                                />
                                            </td>

                                            {/* Dynamic Data Cells */}
                                            {columns.map((col) => {
                                                const cellValue = row[col.id] !== undefined ? row[col.id] : '';
                                                
                                                return (
                                                    <td
                                                        key={col.id}
                                                        className={`p-1.5 border-r border-gray-100 dark:border-gray-700/60 ${
                                                            col.id === 'product' ? 'font-bold text-gray-900 dark:text-white' : ''
                                                        } ${
                                                            col.type === 'brand' ? 'font-mono text-blue-700 dark:text-blue-300 font-semibold' : ''
                                                        } ${
                                                            col.id === 'twoBrandsTotal' ? 'font-mono font-bold text-emerald-700 dark:text-emerald-300' : ''
                                                        } ${
                                                            col.id === 'totalWeight' ? 'font-mono font-bold text-rose-700 dark:text-rose-300' : ''
                                                        }`}
                                                    >
                                                        <input
                                                            type="text"
                                                            value={cellValue ?? ''}
                                                            onChange={(e) => handleCellChange(row.id, col.id, e.target.value)}
                                                            className={`w-full bg-transparent px-2 py-1 rounded-md outline-none focus:bg-white dark:focus:bg-gray-900 focus:ring-1 focus:ring-blue-500 transition-all font-inherit text-gray-900 dark:text-gray-100 ${
                                                                col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'
                                                            }`}
                                                        />
                                                    </td>
                                                );
                                            })}

                                            {/* Row Actions */}
                                            <td className="p-1.5 text-center sticky right-0 bg-inherit z-10">
                                                <div className="flex items-center justify-center gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                                                    <button
                                                        onClick={() => handleAddRow('after', row.id)}
                                                        className="p-1 text-gray-400 hover:text-blue-600 rounded"
                                                        title="Insert Row Below"
                                                    >
                                                        <Plus className="w-3.5 h-3.5" />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDuplicateRow(row.id)}
                                                        className="p-1 text-gray-400 hover:text-indigo-600 rounded"
                                                        title="Duplicate Row"
                                                    >
                                                        <Copy className="w-3.5 h-3.5" />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDeleteRow(row.id)}
                                                        className="p-1 text-gray-400 hover:text-rose-600 rounded"
                                                        title="Delete Row"
                                                    >
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>

                        {/* Sticky Footer Total Row */}
                        <tfoot className="bg-gray-100 dark:bg-gray-900 text-xs font-black text-gray-900 dark:text-white sticky bottom-0 z-20 border-t-2 border-gray-300 dark:border-gray-700 shadow-inner">
                            <tr>
                                <td className="p-2.5 text-center sticky left-0 bg-gray-100 dark:bg-gray-900 z-30">Σ</td>
                                {columns.map((col) => {
                                    if (col.id === 'product') {
                                        return (
                                            <td key={col.id} className="p-2.5 uppercase tracking-wider text-gray-600 dark:text-gray-300 border-r border-gray-300 dark:border-gray-700">
                                                GRAND TOTALS ({rows.length} Items)
                                            </td>
                                        );
                                    }
                                    if (col.id === 'scraftTotal') {
                                        return (
                                            <td key={col.id} className="p-2.5 text-right font-mono text-blue-600 dark:text-blue-400 border-r border-gray-300 dark:border-gray-700">
                                                {totals.totalSCraft.toLocaleString()}
                                            </td>
                                        );
                                    }
                                    if (col.id === 'smartTotal') {
                                        return (
                                            <td key={col.id} className="p-2.5 text-right font-mono text-purple-600 dark:text-purple-400 border-r border-gray-300 dark:border-gray-700">
                                                {totals.totalSmart.toLocaleString()}
                                            </td>
                                        );
                                    }
                                    if (col.id === 'twoBrandsTotal') {
                                        return (
                                            <td key={col.id} className="p-2.5 text-right font-mono text-emerald-600 dark:text-emerald-400 border-r border-gray-300 dark:border-gray-700">
                                                {totals.totalTwoBrands.toLocaleString()}
                                            </td>
                                        );
                                    }
                                    if (col.id === 'totalPackets') {
                                        return (
                                            <td key={col.id} className="p-2.5 text-right font-mono text-indigo-600 dark:text-indigo-400 border-r border-gray-300 dark:border-gray-700">
                                                {Math.round(totals.totalPkts).toLocaleString()}
                                            </td>
                                        );
                                    }
                                    if (col.id === 'avrPacket') {
                                        return (
                                            <td key={col.id} className="p-2.5 text-right font-mono text-indigo-600 dark:text-indigo-400 border-r border-gray-300 dark:border-gray-700">
                                                {Math.round(totals.totalAvr).toLocaleString()}
                                            </td>
                                        );
                                    }
                                    if (col.id === 'totalWeight') {
                                        return (
                                            <td key={col.id} className="p-2.5 text-right font-mono text-rose-600 dark:text-rose-400 border-r border-gray-300 dark:border-gray-700">
                                                {totals.totalPlanWeight.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 3 })}
                                            </td>
                                        );
                                    }
                                    if (col.type === 'brand' && totals.brandTotals[col.id] !== undefined) {
                                        return (
                                            <td key={col.id} className="p-2.5 text-right font-mono text-blue-600 border-r border-gray-300 dark:border-gray-700">
                                                {totals.brandTotals[col.id].toLocaleString()}
                                            </td>
                                        );
                                    }
                                    return <td key={col.id} className="p-2.5 border-r border-gray-300 dark:border-gray-700"></td>;
                                })}
                                <td className="p-2.5 text-center sticky right-0 bg-gray-100 dark:bg-gray-900 z-30"></td>
                            </tr>
                        </tfoot>
                    </table>
                </div>

                {/* Bottom Status Bar */}
                <div className="p-3 bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 flex flex-wrap items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                    <div className="flex items-center gap-4">
                        <span>Showing <strong>{filteredRows.length}</strong> of <strong>{rows.length}</strong> rows</span>
                        <span>•</span>
                        <span><strong>{columns.length}</strong> columns</span>
                        {dataPlanSheet?.lastSaved && (
                            <>
                                <span>•</span>
                                <span>Last saved: {new Date(dataPlanSheet.lastSaved).toLocaleTimeString()}</span>
                            </>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => handleAddRow('bottom')}
                            className="text-blue-600 hover:text-blue-700 font-bold flex items-center gap-1 cursor-pointer"
                        >
                            <Plus className="w-3.5 h-3.5" /> Append Row
                        </button>
                    </div>
                </div>
            </div>

            {/* Add Column Modal with Position Placement */}
            {isAddColumnModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
                    <div className="bg-white dark:bg-gray-800 w-full max-w-md rounded-2xl p-6 shadow-2xl border border-gray-100 dark:border-gray-700 space-y-4">
                        <div className="flex items-center justify-between">
                            <h3 className="text-base font-black uppercase tracking-tight text-gray-900 dark:text-white flex items-center gap-2">
                                <Plus className="w-5 h-5 text-blue-600" /> Place New Column
                            </h3>
                            <button onClick={() => setIsAddColumnModalOpen(false)} className="text-gray-400 hover:text-gray-600 cursor-pointer">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="space-y-3">
                            <div>
                                <label className="block text-xs font-bold uppercase text-gray-500 mb-1">Column Header Title</label>
                                <input
                                    type="text"
                                    placeholder="e.g. Machine 4, Target Pcs, Notes, Brand (L)..."
                                    value={newColLabel}
                                    onChange={(e) => setNewColLabel(e.target.value)}
                                    className="w-full px-3.5 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white font-medium"
                                    autoFocus
                                />
                            </div>

                            {/* Placement Selector */}
                            <div>
                                <label className="block text-xs font-bold uppercase text-gray-500 mb-1">Where to place this column?</label>
                                <div className="grid grid-cols-2 gap-2 mb-2">
                                    <button
                                        type="button"
                                        onClick={() => setInsertPositionType('after')}
                                        className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                                            insertPositionType === 'after'
                                                ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                                                : 'bg-gray-50 dark:bg-gray-900 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700'
                                        }`}
                                    >
                                        👉 Insert After
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setInsertPositionType('before')}
                                        className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                                            insertPositionType === 'before'
                                                ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                                                : 'bg-gray-50 dark:bg-gray-900 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700'
                                        }`}
                                    >
                                        👈 Insert Before
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setInsertPositionType('start')}
                                        className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                                            insertPositionType === 'start'
                                                ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                                                : 'bg-gray-50 dark:bg-gray-900 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700'
                                        }`}
                                    >
                                        ⏮️ At the Beginning
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setInsertPositionType('end')}
                                        className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                                            insertPositionType === 'end'
                                                ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                                                : 'bg-gray-50 dark:bg-gray-900 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700'
                                        }`}
                                    >
                                        ⏭️ At the End
                                    </button>
                                </div>

                                {(insertPositionType === 'after' || insertPositionType === 'before') && (
                                    <div className="mt-2">
                                        <label className="block text-[11px] font-bold text-gray-500 dark:text-gray-400 mb-1">
                                            Select Reference Column:
                                        </label>
                                        <select
                                            value={insertTargetColId || (columns[0]?.id ?? '')}
                                            onChange={(e) => setInsertTargetColId(e.target.value)}
                                            className="w-full px-3.5 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white"
                                        >
                                            {columns.map((c, i) => (
                                                <option key={c.id} value={c.id}>
                                                    Column {i + 1}: {c.label}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                )}
                            </div>

                            <div>
                                <label className="block text-xs font-bold uppercase text-gray-500 mb-1">Column Type</label>
                                <div className="grid grid-cols-3 gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setNewColType('text')}
                                        className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                                            newColType === 'text' 
                                                ? 'bg-blue-600 text-white border-blue-600' 
                                                : 'bg-gray-50 dark:bg-gray-900 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700'
                                        }`}
                                    >
                                        Text / Remarks
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setNewColType('number')}
                                        className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                                            newColType === 'number' 
                                                ? 'bg-blue-600 text-white border-blue-600' 
                                                : 'bg-gray-50 dark:bg-gray-900 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700'
                                        }`}
                                    >
                                        Numeric (Qty/Wt)
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setNewColType('brand')}
                                        className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                                            newColType === 'brand' 
                                                ? 'bg-blue-600 text-white border-blue-600' 
                                                : 'bg-gray-50 dark:bg-gray-900 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700'
                                        }`}
                                    >
                                        Brand (L)
                                    </button>
                                </div>
                            </div>

                            {newColType === 'brand' && (
                                <div>
                                    <label className="block text-xs font-bold uppercase text-gray-500 mb-1">Select Associated Brand</label>
                                    <select
                                        value={newColBrand}
                                        onChange={(e) => {
                                            setNewColBrand(e.target.value);
                                            if (!newColLabel || newColLabel.includes('(L)')) {
                                                setNewColLabel(`${e.target.value} (L)`);
                                            }
                                        }}
                                        className="w-full px-3.5 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white"
                                    >
                                        <option value="">-- Choose Brand --</option>
                                        {['S CRAFT', 'SMART', ...(brands || [])].filter((v, i, a) => a.indexOf(v) === i).map(b => (
                                            <option key={b} value={b}>{b}</option>
                                        ))}
                                    </select>
                                </div>
                            )}
                        </div>

                        <div className="flex items-center justify-end gap-2 pt-2 border-t dark:border-gray-700">
                            <button
                                type="button"
                                onClick={() => setIsAddColumnModalOpen(false)}
                                className="px-4 py-2 text-xs font-bold text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition-all cursor-pointer"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleAddColumn}
                                className="px-5 py-2 text-xs font-black uppercase text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-md transition-all cursor-pointer"
                            >
                                Place Column
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* In-App Delete Column Confirmation Dialog (Bypasses browser iframe dialog blocking) */}
            {columnToDelete && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
                    <div className="bg-white dark:bg-gray-800 w-full max-w-sm rounded-2xl p-6 shadow-2xl border border-gray-100 dark:border-gray-700 space-y-4">
                        <div className="w-12 h-12 rounded-2xl bg-rose-100 dark:bg-rose-900/40 text-rose-600 flex items-center justify-center mx-auto">
                            <AlertTriangle className="w-6 h-6" />
                        </div>
                        <div className="text-center space-y-1">
                            <h3 className="text-base font-black text-gray-900 dark:text-white">Delete Column?</h3>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                                Are you sure you want to remove <span className="font-bold text-gray-900 dark:text-white">&ldquo;{columnToDelete.label}&rdquo;</span>? All values in this column will be removed.
                            </p>
                        </div>
                        <div className="flex items-center justify-center gap-2 pt-2">
                            <button
                                type="button"
                                onClick={() => setColumnToDelete(null)}
                                className="flex-1 px-4 py-2.5 text-xs font-bold text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 rounded-xl transition-all cursor-pointer"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={() => executeDeleteColumn(columnToDelete)}
                                className="flex-1 px-4 py-2.5 text-xs font-black uppercase text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-md transition-all cursor-pointer flex items-center justify-center gap-1.5"
                            >
                                <Trash2 className="w-3.5 h-3.5" /> Confirm Delete
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Rename Column Modal */}
            {editingColId && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
                    <div className="bg-white dark:bg-gray-800 w-full max-w-sm rounded-2xl p-6 shadow-2xl border border-gray-100 dark:border-gray-700 space-y-4">
                        <h3 className="text-sm font-black uppercase text-gray-900 dark:text-white">Rename Column</h3>
                        <input
                            type="text"
                            value={editColLabel}
                            onChange={(e) => setEditColLabel(e.target.value)}
                            className="w-full px-3.5 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white font-semibold"
                            autoFocus
                        />
                        <div className="flex justify-end gap-2">
                            <button
                                onClick={() => setEditingColId(null)}
                                className="px-3 py-1.5 text-xs font-bold text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg cursor-pointer"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSaveRenameColumn}
                                className="px-4 py-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg cursor-pointer flex items-center gap-1"
                            >
                                <Check className="w-3.5 h-3.5" /> Save
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {/* Auto-Setup in Brand-Wise Stock Modal */}
            {isAutoSetupModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
                    <div className="bg-white dark:bg-gray-800 w-full max-w-xl rounded-3xl p-6 shadow-2xl border border-gray-100 dark:border-gray-700 space-y-5">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="p-3 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl text-white shadow-md shadow-blue-500/20">
                                    <Zap className="w-6 h-6 fill-white" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-black uppercase tracking-tight text-gray-900 dark:text-white">
                                        Brand-Wise Stock Auto-Setup
                                    </h3>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">
                                        Auto-configure brand columns and sync profile inventory with Data Plan
                                    </p>
                                </div>
                            </div>
                            <button 
                                onClick={() => setIsAutoSetupModalOpen(false)} 
                                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl cursor-pointer transition-all"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* System Stats Overview */}
                        <div className="grid grid-cols-3 gap-3 p-3.5 bg-gray-50 dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700">
                            <div>
                                <p className="text-[10px] font-black uppercase text-gray-400">Catalog Profiles</p>
                                <p className="text-base font-black text-gray-800 dark:text-gray-200 mt-0.5">{profiles.length} items</p>
                            </div>
                            <div>
                                <p className="text-[10px] font-black uppercase text-gray-400">Active Brands</p>
                                <p className="text-base font-black text-blue-600 dark:text-blue-400 mt-0.5">
                                    {['S CRAFT', 'SMART', ...(brands || [])].filter((v, i, a) => a.indexOf(v) === i).length} Brands
                                </p>
                            </div>
                            <div>
                                <p className="text-[10px] font-black uppercase text-gray-400">Data Plan Rows</p>
                                <p className="text-base font-black text-emerald-600 dark:text-emerald-400 mt-0.5">{rows.length} rows</p>
                            </div>
                        </div>

                        {/* Action Options */}
                        <div className="space-y-3">
                            {/* Option 1: Full Auto Setup */}
                            <div 
                                onClick={() => handleAutoSetupBrandStock('full_setup')}
                                className="p-4 rounded-2xl border-2 border-blue-500/40 hover:border-blue-600 bg-blue-50/50 dark:bg-blue-900/10 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all cursor-pointer group flex items-start gap-3"
                            >
                                <div className="p-2.5 bg-blue-600 text-white rounded-xl group-hover:scale-105 transition-transform mt-0.5">
                                    <Zap className="w-5 h-5 fill-white" />
                                </div>
                                <div className="flex-1">
                                    <div className="flex items-center justify-between">
                                        <h4 className="text-sm font-black text-blue-900 dark:text-blue-300 uppercase tracking-tight">
                                            ⚡ 1-Click Auto-Setup Complete Brand Stock
                                        </h4>
                                        <span className="text-[10px] font-black uppercase px-2 py-0.5 bg-blue-600 text-white rounded-full">Recommended</span>
                                    </div>
                                    <p className="text-xs text-gray-600 dark:text-gray-300 mt-1">
                                        Automatically configures columns for all registered brands, calculates live stock per brand, populates the sheet, and auto-computes weights and packets.
                                    </p>
                                </div>
                            </div>

                            {/* Option 2: Pull Live Stock from Profiles */}
                            <div 
                                onClick={() => handleAutoSetupBrandStock('pull_stock')}
                                className="p-4 rounded-2xl border border-gray-200 dark:border-gray-700 hover:border-amber-400 bg-gray-50/70 dark:bg-gray-900/50 hover:bg-amber-50/50 dark:hover:bg-amber-900/10 transition-all cursor-pointer group flex items-start gap-3"
                            >
                                <div className="p-2.5 bg-amber-500 text-white rounded-xl group-hover:scale-105 transition-transform mt-0.5">
                                    <RefreshCw className="w-5 h-5" />
                                </div>
                                <div className="flex-1">
                                    <h4 className="text-sm font-black text-gray-800 dark:text-gray-200 uppercase tracking-tight">
                                        📥 Pull Live Stock from Profiles
                                    </h4>
                                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                        Keeps your existing spreadsheet rows and columns, but updates the brand numbers to match current live profile inventory.
                                    </p>
                                </div>
                            </div>

                            {/* Option 3: 3-Month Die Production Plan */}
                            <div 
                                onClick={() => {
                                    setIsAutoSetupModalOpen(false);
                                    setIsDiePlanModalOpen(true);
                                }}
                                className="p-4 rounded-2xl border-2 border-emerald-500/40 hover:border-emerald-600 bg-emerald-50/50 dark:bg-emerald-900/10 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-all cursor-pointer group flex items-start gap-3"
                            >
                                <div className="p-2.5 bg-emerald-600 text-white rounded-xl group-hover:scale-105 transition-transform mt-0.5">
                                    <Cpu className="w-5 h-5" />
                                </div>
                                <div className="flex-1">
                                    <div className="flex items-center justify-between">
                                        <h4 className="text-sm font-black text-emerald-900 dark:text-emerald-300 uppercase tracking-tight">
                                            ⚡ Auto-Plan Die Production (3-Month Sales Demand)
                                        </h4>
                                        <span className="text-[10px] font-black uppercase px-2 py-0.5 bg-emerald-600 text-white rounded-full">Automated Planning</span>
                                    </div>
                                    <p className="text-xs text-gray-600 dark:text-gray-300 mt-1">
                                        Reads 3-month sales history (M1, M2, M3), analyzes current warehouse stock, calculates exact production lengths needed for this month, and schedules Die extrusion hours.
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center justify-end gap-2 pt-2 border-t dark:border-gray-700">
                            <button
                                type="button"
                                onClick={() => setIsAutoSetupModalOpen(false)}
                                className="px-5 py-2.5 text-xs font-bold text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition-all cursor-pointer"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* 3-Month Sales & Die Production Planning Modal */}
            {isDiePlanModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
                    <div className="bg-white dark:bg-gray-800 w-full max-w-5xl rounded-3xl p-6 shadow-2xl border border-gray-100 dark:border-gray-700 space-y-5 my-8 max-h-[92vh] flex flex-col">
                        {/* Header */}
                        <div className="flex items-center justify-between shrink-0">
                            <div className="flex items-center gap-3">
                                <div className="p-3 bg-gradient-to-br from-emerald-600 to-teal-600 rounded-2xl text-white shadow-lg shadow-emerald-500/20">
                                    <Cpu className="w-6 h-6" />
                                </div>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <h3 className="text-lg font-black uppercase tracking-tight text-gray-900 dark:text-white">
                                            3-Month Sales Demand & Die Production Planner
                                        </h3>
                                        <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 uppercase">
                                            Target: {past3MonthKeys.target.label}
                                        </span>
                                    </div>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">
                                        Historical sales ({past3MonthKeys.m1.label}, {past3MonthKeys.m2.label}, {past3MonthKeys.m3.label}) vs live warehouse stock to plan monthly production lengths & die hours
                                    </p>
                                </div>
                            </div>
                            <button 
                                onClick={() => setIsDiePlanModalOpen(false)} 
                                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl cursor-pointer transition-all"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Top Control Bar (Target Month, Demand Multiplier, Machine) */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 bg-gray-50 dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 shrink-0">
                            <div>
                                <label className="block text-[10px] font-black uppercase text-gray-400 mb-1">Planning Target Month</label>
                                <input
                                    type="month"
                                    value={planTargetMonth}
                                    onChange={(e) => setPlanTargetMonth(e.target.value)}
                                    className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-bold text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500"
                                />
                            </div>

                            <div>
                                <label className="block text-[10px] font-black uppercase text-gray-400 mb-1">Demand Safety Factor</label>
                                <select
                                    value={demandBufferFactor}
                                    onChange={(e) => setDemandBufferFactor(parseFloat(e.target.value))}
                                    className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-bold text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500"
                                >
                                    <option value={0.8}>0.8x (Conservative / Slow Season)</option>
                                    <option value={1.0}>1.0x (100% of 3-Month Average)</option>
                                    <option value={1.2}>1.2x (+20% Safety Buffer)</option>
                                    <option value={1.5}>1.5x (+50% Peak Season Demand)</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-[10px] font-black uppercase text-gray-400 mb-1">Assign Default Extruder</label>
                                <select
                                    value={selectedMachinePrefix}
                                    onChange={(e) => setSelectedMachinePrefix(e.target.value)}
                                    className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-bold text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500"
                                >
                                    <option value="EXT-01">Extruder 01 (EXT-01)</option>
                                    <option value="EXT-02">Extruder 02 (EXT-02)</option>
                                    <option value="EXT-03">Extruder 03 (EXT-03)</option>
                                    <option value="EXT-04">Extruder 04 (EXT-04)</option>
                                    <option value="EXT-05">Extruder 05 (EXT-05)</option>
                                    <option value="EXT-06">Extruder 06 (EXT-06)</option>
                                </select>
                            </div>
                        </div>

                        {/* Summary Metrics Cards */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 shrink-0">
                            <div className="p-3.5 bg-emerald-50/70 dark:bg-emerald-950/20 border border-emerald-200/60 dark:border-emerald-800/40 rounded-2xl">
                                <p className="text-[10px] font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-400">Total Production Lengths</p>
                                <p className="text-xl font-black text-emerald-900 dark:text-emerald-200 font-mono mt-0.5">
                                    {diePlanSummary.totalNeededLengths.toLocaleString()} <span className="text-xs font-semibold">Pcs</span>
                                </p>
                                <p className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-1">
                                    Across {diePlanSummary.itemsWithDeficitCount} deficit profiles
                                </p>
                            </div>

                            <div className="p-3.5 bg-teal-50/70 dark:bg-teal-950/20 border border-teal-200/60 dark:border-teal-800/40 rounded-2xl">
                                <p className="text-[10px] font-black uppercase tracking-wider text-teal-700 dark:text-teal-400">Total Planned Output (Kg)</p>
                                <p className="text-xl font-black text-teal-900 dark:text-teal-200 font-mono mt-0.5">
                                    {diePlanSummary.totalNeededWeightKg.toLocaleString()} <span className="text-xs font-semibold">Kg</span>
                                </p>
                                <p className="text-[10px] text-teal-600 dark:text-teal-400 mt-1">
                                    Raw material needed
                                </p>
                            </div>

                            <div className="p-3.5 bg-indigo-50/70 dark:bg-indigo-950/20 border border-indigo-200/60 dark:border-indigo-800/40 rounded-2xl">
                                <p className="text-[10px] font-black uppercase tracking-wider text-indigo-700 dark:text-indigo-400">Total Extruder Hours</p>
                                <p className="text-xl font-black text-indigo-900 dark:text-indigo-200 font-mono mt-0.5">
                                    {diePlanSummary.totalExtrusionHours.toLocaleString()} <span className="text-xs font-semibold">Hrs</span>
                                </p>
                                <p className="text-[10px] text-indigo-600 dark:text-indigo-400 mt-1">
                                    ≈ {diePlanSummary.totalShifts} standard 8h shifts
                                </p>
                            </div>

                            <div className="p-3.5 bg-blue-50/70 dark:bg-blue-950/20 border border-blue-200/60 dark:border-blue-800/40 rounded-2xl">
                                <p className="text-[10px] font-black uppercase tracking-wider text-blue-700 dark:text-blue-400">Current Warehouse Stock</p>
                                <p className="text-xl font-black text-blue-900 dark:text-blue-200 font-mono mt-0.5">
                                    {diePlanSummary.totalCurrentStock.toLocaleString()} <span className="text-xs font-semibold">Pcs</span>
                                </p>
                                <p className="text-[10px] text-blue-600 dark:text-blue-400 mt-1">
                                    3M sales: {diePlanSummary.total3mSales.toLocaleString()} pcs
                                </p>
                            </div>
                        </div>

                        {/* Search and Table filter bar */}
                        <div className="flex items-center justify-between gap-3 shrink-0">
                            <div className="relative flex-1 max-w-sm">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                <input
                                    type="text"
                                    placeholder="Filter die planning items..."
                                    value={diePlanSearch}
                                    onChange={(e) => setDiePlanSearch(e.target.value)}
                                    className="w-full pl-9 pr-3 py-1.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-xs outline-none focus:ring-2 focus:ring-emerald-500"
                                />
                            </div>

                            <div className="flex items-center gap-2">
                                <button
                                    onClick={handleSync3MonthSalesToSheet}
                                    className="px-3 py-1.5 bg-purple-50 dark:bg-purple-900/30 hover:bg-purple-100 text-purple-700 dark:text-purple-300 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all border border-purple-200/60 cursor-pointer"
                                    title="Write 3-month sales into Data Plan sheet M1, M2, M3 columns"
                                >
                                    <TrendingUp className="w-3.5 h-3.5" /> Sync M1, M2, M3 in Sheet
                                </button>
                            </div>
                        </div>

                        {/* Planning Items Table */}
                        <div className="border border-gray-200 dark:border-gray-700 rounded-2xl overflow-hidden flex-1 overflow-y-auto max-h-[380px]">
                            <table className="w-full text-left border-collapse text-xs">
                                <thead className="bg-gray-50 dark:bg-gray-900 text-gray-600 dark:text-gray-300 uppercase text-[10px] font-black tracking-wider sticky top-0 z-10 border-b border-gray-200 dark:border-gray-700">
                                    <tr>
                                        <th className="p-2.5">#</th>
                                        <th className="p-2.5">Product / Profile</th>
                                        <th className="p-2.5 text-right">{past3MonthKeys.m1.label}</th>
                                        <th className="p-2.5 text-right">{past3MonthKeys.m2.label}</th>
                                        <th className="p-2.5 text-right">{past3MonthKeys.m3.label}</th>
                                        <th className="p-2.5 text-right">Avg / Mo</th>
                                        <th className="p-2.5 text-right bg-blue-50/50 dark:bg-blue-950/20 text-blue-800 dark:text-blue-300">Live Stock</th>
                                        <th className="p-2.5 text-right bg-emerald-50 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-300 font-extrabold">Plan Lengths</th>
                                        <th className="p-2.5 text-right">Plan Wt (Kg)</th>
                                        <th className="p-2.5 text-center">Die / Speed</th>
                                        <th className="p-2.5 text-right">Extruder Hrs</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                                    {diePlanningList
                                        .filter(i => !diePlanSearch || i.productName.toLowerCase().includes(diePlanSearch.toLowerCase()))
                                        .map((item, idx) => (
                                            <tr 
                                                key={item.id || idx}
                                                className={`hover:bg-gray-50/70 dark:hover:bg-gray-700/50 transition-colors ${
                                                    item.hasDeficit ? 'bg-emerald-50/20 dark:bg-emerald-950/10' : ''
                                                }`}
                                            >
                                                <td className="p-2.5 text-gray-400 font-mono text-[11px]">{idx + 1}</td>
                                                <td className="p-2.5 font-bold text-gray-900 dark:text-white">
                                                    <div>{item.productName}</div>
                                                    {item.profile && (
                                                        <div className="text-[10px] text-gray-400 font-normal">
                                                            SKU: {item.profile.sku} • {item.pieceWeightKg} Kg/pc
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="p-2.5 text-right font-mono text-gray-600 dark:text-gray-300">{item.m1Sales || '-'}</td>
                                                <td className="p-2.5 text-right font-mono text-gray-600 dark:text-gray-300">{item.m2Sales || '-'}</td>
                                                <td className="p-2.5 text-right font-mono text-gray-600 dark:text-gray-300">{item.m3Sales || '-'}</td>
                                                <td className="p-2.5 text-right font-mono font-bold text-gray-700 dark:text-gray-200">{item.avg3mSales}</td>
                                                <td className="p-2.5 text-right font-mono font-bold text-blue-700 dark:text-blue-400 bg-blue-50/30 dark:bg-blue-950/10">
                                                    {item.currentStockLengths.toLocaleString()}
                                                </td>
                                                <td className="p-2.5 text-right font-mono font-black text-emerald-700 dark:text-emerald-400 bg-emerald-50/40 dark:bg-emerald-950/20 text-sm">
                                                    {item.neededLengths > 0 ? (
                                                        <span className="px-2 py-0.5 rounded-lg bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300">
                                                            +{item.neededLengths.toLocaleString()}
                                                        </span>
                                                    ) : (
                                                        <span className="text-gray-400 text-xs font-normal">Sufficient</span>
                                                    )}
                                                </td>
                                                <td className="p-2.5 text-right font-mono text-gray-700 dark:text-gray-300 font-semibold">
                                                    {item.neededWeightKg > 0 ? `${item.neededWeightKg.toLocaleString()} Kg` : '-'}
                                                </td>
                                                <td className="p-2.5 text-center">
                                                    {item.die ? (
                                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 font-bold text-[10px]">
                                                            <Cpu className="w-2.5 h-2.5 text-emerald-500" /> {item.die.dieNo} ({item.dieOutputKgHr} Kg/h)
                                                        </span>
                                                    ) : (
                                                        <span className="text-[10px] text-gray-400 font-medium">Std Die ({item.dieOutputKgHr} Kg/h)</span>
                                                    )}
                                                </td>
                                                <td className="p-2.5 text-right font-mono font-bold text-gray-800 dark:text-gray-200">
                                                    {item.extrusionHours > 0 ? (
                                                        <div>
                                                            <span>{item.extrusionHours} h</span>
                                                            <div className="text-[10px] text-gray-400 font-normal">({item.shiftsRequired} shifts)</div>
                                                        </div>
                                                    ) : '-'}
                                                </td>
                                            </tr>
                                        ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Footer Controls & Schedule Push */}
                        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t dark:border-gray-700 shrink-0">
                            <div className="flex items-center gap-2">
                                {onNavigateToPlanning && (
                                    <button
                                        onClick={() => {
                                            setIsDiePlanModalOpen(false);
                                            onNavigateToPlanning();
                                        }}
                                        className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 cursor-pointer"
                                    >
                                        Go to Dies & Machine Planning <ArrowRight className="w-3 h-3" />
                                    </button>
                                )}
                            </div>

                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => setIsDiePlanModalOpen(false)}
                                    className="px-4 py-2.5 text-xs font-bold text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition-all cursor-pointer"
                                >
                                    Close
                                </button>
                                <button
                                    type="button"
                                    onClick={handleGenerateProductionPlans}
                                    disabled={isGeneratingPlans || diePlanSummary.totalNeededLengths === 0}
                                    className="px-6 py-2.5 text-xs font-black uppercase text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 rounded-xl shadow-lg shadow-emerald-500/20 transition-all cursor-pointer flex items-center gap-2 disabled:opacity-50 active:scale-95"
                                >
                                    {isGeneratingPlans ? (
                                        <>
                                            <RefreshCw className="w-4 h-4 animate-spin" /> Scheduling Plans...
                                        </>
                                    ) : (
                                        <>
                                            <Cpu className="w-4 h-4 text-emerald-200" /> Auto-Generate Machine Production Plans
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
