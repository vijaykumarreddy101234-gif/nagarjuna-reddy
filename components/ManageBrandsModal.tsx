import React, { useState, useMemo, useEffect } from 'react';
import { 
    Tag, Plus, Edit3, Trash2, X, Check, ArrowRight, 
    AlertTriangle, Shield, Layers, RefreshCw, Sliders, 
    CheckCircle2, Box, ArrowDownRight, ArrowUpRight, Search,
    Sparkles, Copy, FileText, Info, Upload, FileSpreadsheet, Download, Database
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { useStore } from '../store/useStore';
import { ProtectiveFilmItem } from '../types';
import { DEFAULT_PROTECTIVE_FILM_ITEMS } from '../data/defaultProtectiveFilms';

interface ManageBrandsModalProps {
    isOpen: boolean;
    onClose: () => void;
    currentBrand: string;
    onSelectBrand: (brand: string) => void;
    initialTab?: ManageBrandTab;
}

type ManageBrandTab = 'OVERVIEW' | 'STICKER_CATALOG' | 'BATCH_UPDATE' | 'IMPORT_EXCEL';

const STANDARD_WIDTH_PRESETS = [
    '19', '24', '25', '30', '32', '34', '35', '38', 
    '40', '42', '45', '48', '50', '52', '55', '60', 
    '65', '70', '75', '80', '90', '100'
];

export const ManageBrandsModal: React.FC<ManageBrandsModalProps> = ({
    isOpen,
    onClose,
    currentBrand,
    onSelectBrand,
    initialTab = 'OVERVIEW'
}) => {
    const {
        brands = [],
        addBrand,
        updateBrand,
        deleteBrand,
        protectiveFilmItems = [],
        addProtectiveFilmItem,
        updateProtectiveFilmItem,
        deleteProtectiveFilmItem,
        importProtectiveFilmBatch,
        protectiveFilmInwardTransactions = [],
        protectiveFilmOutwardAdjustments = [],
        profiles = []
    } = useStore();

    // Modal navigation
    const [activeTab, setActiveTab] = useState<ManageBrandTab>(initialTab);
    const [selectedBrand, setSelectedBrand] = useState<string>(
        currentBrand !== 'All' ? currentBrand : (brands[0] || 'Scraft')
    );
    const [searchTerm, setSearchTerm] = useState<string>('');

    // Update active tab if initialTab prop changes on open
    useEffect(() => {
        if (isOpen && initialTab) {
            setActiveTab(initialTab);
        }
    }, [isOpen, initialTab]);

    // Add New Brand Form
    const [isAddingBrand, setIsAddingBrand] = useState(false);
    const [newBrandName, setNewBrandName] = useState('');
    const [newBrandTopWidth, setNewBrandTopWidth] = useState('38');
    const [newBrandTopStickerName, setNewBrandTopStickerName] = useState('');
    const [newBrandBottomWidth, setNewBrandBottomWidth] = useState('38');
    const [newBrandBottomStickerName, setNewBrandBottomStickerName] = useState('');
    const [cloneDefaultCatalog, setCloneDefaultCatalog] = useState(true);

    // Edit Brand Name inline
    const [editingBrand, setEditingBrand] = useState<{ oldName: string; newName: string } | null>(null);

    // Safe Delete Brand Confirmation State
    const [brandToDelete, setBrandToDelete] = useState<{
        brandName: string;
        profileCount: number;
        inwardCount: number;
        outwardCount: number;
        reassignTarget: string;
        deleteAction: 'REASSIGN' | 'DELETE_ALL';
    } | null>(null);

    // Batch Update Sticker Form
    const [batchForm, setBatchForm] = useState({
        brand: currentBrand !== 'All' ? currentBrand : (brands[0] || 'Scraft'),
        targetSide: 'BOTH' as 'TOP' | 'BOTTOM' | 'BOTH',
        matchWidth: 'All', // 'All' or specific width
        newWidth: '',
        newStickerName: '',
        customWidthEntry: ''
    });
    const [batchSuccessMsg, setBatchSuccessMsg] = useState<string | null>(null);

    // Editing individual row in Brand Sticker Catalog Tab
    const [editingRowId, setEditingRowId] = useState<string | null>(null);
    const [rowEditState, setRowEditState] = useState<{
        topFilmWidth: string;
        topStickerName: string;
        bottomFilmWidth: string;
        bottomStickerName: string;
        description: string;
        profileCode: string;
    }>({
        topFilmWidth: '',
        topStickerName: '',
        bottomFilmWidth: '',
        bottomStickerName: '',
        description: '',
        profileCode: ''
    });

    // Excel Import State
    const [excelFile, setExcelFile] = useState<File | null>(null);
    const [importParsedRows, setImportParsedRows] = useState<any[]>([]);
    const [isParsingExcel, setIsParsingExcel] = useState(false);
    const [importSuccessMsg, setImportSuccessMsg] = useState<string | null>(null);
    const [importErrorMsg, setImportErrorMsg] = useState<string | null>(null);
    const [recordInwardStock, setRecordInwardStock] = useState(true);
    const [importTargetBrand, setImportTargetBrand] = useState<string>(selectedBrand && selectedBrand !== 'All' ? selectedBrand : 'Scraft');
    const [overrideExcelBrand, setOverrideExcelBrand] = useState<boolean>(true);

    const parseSizeAndName = (rawVal: string | number | undefined | null) => {
        if (rawVal === undefined || rawVal === null || rawVal === '') {
            return { width: '', name: '' };
        }
        const str = String(rawVal).trim();
        if (!str || str.toUpperCase() === 'NILL' || str.toUpperCase() === 'NIL' || str.toUpperCase() === 'NONE' || str === '-') {
            return { width: 'NILL', name: '' };
        }
        const numMatch = str.match(/^(\d+(\.\d+)?)\s*(mm|MM)?\s*(.*)$/i) || str.match(/(\d+(\.\d+)?)/);
        if (numMatch) {
            const width = numMatch[1];
            let name = '';
            if (numMatch[4]) {
                name = numMatch[4].replace(/^[-:\s]+/, '').trim();
            }
            return { width, name };
        }
        return { width: str, name: '' };
    };

    const handleExcelFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setExcelFile(file);
        setIsParsingExcel(true);
        setImportErrorMsg(null);
        setImportSuccessMsg(null);

        const reader = new FileReader();
        reader.onload = (evt) => {
            try {
                const data = evt.target?.result;
                const workbook = XLSX.read(data, { type: 'binary' });
                const sheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];
                const rawJson = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

                if (!rawJson || rawJson.length === 0) {
                    setImportErrorMsg('The selected Excel file is empty.');
                    setIsParsingExcel(false);
                    return;
                }

                const parsed = rawJson.map((row: any, index: number) => {
                    const getVal = (aliases: string[]) => {
                        const keys = Object.keys(row);
                        // 1. Exact clean match (alphanumeric only)
                        for (const alias of aliases) {
                            const aliasClean = alias.toLowerCase().replace(/[^a-z0-9]/g, '');
                            for (const k of keys) {
                                const kClean = k.toLowerCase().replace(/[^a-z0-9]/g, '');
                                if (kClean === aliasClean) {
                                    const val = row[k];
                                    if (val !== undefined && val !== null && String(val).trim() !== '') {
                                        return String(val).trim();
                                    }
                                }
                            }
                        }
                        // 2. Contains match (fuzzy)
                        for (const alias of aliases) {
                            const aliasClean = alias.toLowerCase().replace(/[^a-z0-9]/g, '');
                            if (aliasClean.length < 3) continue;
                            for (const k of keys) {
                                const kClean = k.toLowerCase().replace(/[^a-z0-9]/g, '');
                                if (kClean.includes(aliasClean) || aliasClean.includes(kClean)) {
                                    const val = row[k];
                                    if (val !== undefined && val !== null && String(val).trim() !== '') {
                                        return String(val).trim();
                                    }
                                }
                            }
                        }
                        return '';
                    };

                    const excelBrand = getVal(['brand', 'brand name', 'company', 'make', 'sticker brand', 'brand/company']);
                    const rowBrand = overrideExcelBrand ? importTargetBrand : (excelBrand || importTargetBrand || 'Scraft');

                    const profileCode = getVal(['profile code', 'code', 'sku', 'section code', 'profile sku', 'part no', 'item code', 'section', 'sno', 'profile', 'sec code', 'section no']);
                    const description = getVal(['description', 'profile description', 'name', 'profile name', 'section name', 'particulars']);
                    const series = getVal(['series', 'category', 'section series', 'profile series']) || '80.5 SERIES';

                    let rawTopVal = getVal(['top sticker width', 'top sticker size', 'top film width', 'top film size', 'top size', 'top width', 'top mm', 'top sticker', 'top film', 'top size mm', 'top', 'top film (mm)', 'top sticker (mm)']);
                    let topStickerNameRaw = getVal(['top sticker name', 'top sticker print', 'top print name', 'top print', 'top label', 'top name', 'top print label', 'top brand']);

                    let rawBottomVal = getVal(['bottom sticker width', 'bottom sticker size', 'bottom film width', 'bottom film size', 'bottom size', 'bottom width', 'bottom mm', 'bottom sticker', 'bottom film', 'bottom size mm', 'bottom', 'bottom film (mm)', 'bottom sticker (mm)']);
                    let bottomStickerNameRaw = getVal(['bottom sticker name', 'bottom sticker print', 'bottom print name', 'bottom print', 'bottom label', 'bottom name', 'bottom print label', 'bottom brand']);

                    if (!rawTopVal && !rawBottomVal) {
                        const generalSize = getVal(['film size', 'sticker size', 'film width', 'sticker width', 'size', 'width', 'film']);
                        if (generalSize) {
                            rawTopVal = generalSize;
                            rawBottomVal = generalSize;
                        }
                    }

                    if (!topStickerNameRaw && !bottomStickerNameRaw) {
                        const generalName = getVal(['sticker name', 'print name', 'sticker print', 'label', 'print']);
                        if (generalName) {
                            topStickerNameRaw = generalName;
                            bottomStickerNameRaw = generalName;
                        }
                    }

                    const parsedTop = parseSizeAndName(rawTopVal);
                    const topFilmWidth = parsedTop.width || '38';
                    const topStickerName = topStickerNameRaw || parsedTop.name;

                    const parsedBottom = parseSizeAndName(rawBottomVal);
                    const bottomFilmWidth = parsedBottom.width || '38';
                    const bottomStickerName = bottomStickerNameRaw || parsedBottom.name;

                    const inwardMetersRaw = getVal(['inward meters', 'inward stock', 'inward mtrs', 'top inward meters', 'bottom inward meters', 'stock meters', 'roll meters', 'meters', 'stock']);
                    const inwardMeters = parseFloat(inwardMetersRaw) || 0;

                    const rollCountRaw = getVal(['roll count', 'rolls', 'no of rolls', 'roll qty']);
                    const rollCount = parseInt(rollCountRaw, 10) || (inwardMeters > 0 ? 1 : 0);

                    const supplier = getVal(['supplier', 'vendor', 'party']);
                    const refNo = getVal(['ref no', 'reference no', 'invoice no', 'bill no', 'po no']) || `IMP-${Date.now().toString().slice(-4)}`;
                    const date = getVal(['date', 'inward date', 'transaction date']) || new Date().toISOString().split('T')[0];

                    return {
                        rowIndex: index + 1,
                        brand: rowBrand,
                        profileCode,
                        description: description || profileCode,
                        series,
                        topFilmWidth,
                        topStickerName,
                        bottomFilmWidth,
                        bottomStickerName,
                        inwardMeters,
                        rollCount,
                        supplier,
                        refNo,
                        date,
                        isValid: !!profileCode
                    };
                });

                setImportParsedRows(parsed);
                setIsParsingExcel(false);
            } catch (err: any) {
                console.error(err);
                setImportErrorMsg('Failed to parse Excel file: ' + (err?.message || 'Invalid format'));
                setIsParsingExcel(false);
            }
        };
        reader.readAsBinaryString(file);
    };

    const handleDownloadSampleTemplate = () => {
        const sampleData = [
            {
                "Brand": "Scraft",
                "Profile Code": "53ET",
                "Profile Description": "2 TRACK",
                "Series": "80.5 SERIES",
                "Top Sticker Width (mm)": "38",
                "Top Sticker Name": "Scraft Blue Logo 38mm",
                "Bottom Sticker Width (mm)": "38",
                "Bottom Sticker Name": "Scraft Standard Bottom 38mm",
                "Inward Meters": 5000,
                "Roll Count": 1,
                "Supplier": "Polyfilm Ltd",
                "Ref No": "INV-1001",
                "Date": "2026-08-28"
            },
            {
                "Brand": "Smart",
                "Profile Code": "80.5F",
                "Profile Description": "2.5 TRACK",
                "Series": "80.5 SERIES",
                "Top Sticker Width (mm)": "40",
                "Top Sticker Name": "Smart Silver Eco 40mm",
                "Bottom Sticker Width (mm)": "40",
                "Bottom Sticker Name": "Smart Base Protection 40mm",
                "Inward Meters": 10000,
                "Roll Count": 2,
                "Supplier": "Smart Packaging",
                "Ref No": "INV-1002",
                "Date": "2026-08-28"
            },
            {
                "Brand": "prevon",
                "Profile Code": "95ET",
                "Profile Description": "3 TRACK",
                "Series": "80.5 SERIES",
                "Top Sticker Width (mm)": "38",
                "Top Sticker Name": "prevon Gold 38mm",
                "Bottom Sticker Width (mm)": "38",
                "Bottom Sticker Name": "prevon Bottom Protection 38mm",
                "Inward Meters": 5000,
                "Roll Count": 1,
                "Supplier": "Prevon India",
                "Ref No": "INV-1003",
                "Date": "2026-08-28"
            }
        ];

        const ws = XLSX.utils.json_to_sheet(sampleData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Protective Films Import");
        XLSX.writeFile(wb, "Protective_Films_Sizes_and_Stock_Import_Template.xlsx");
    };

    const handleCommitExcelImport = () => {
        const validRows = importParsedRows.filter(r => r.isValid && r.profileCode);
        if (validRows.length === 0) {
            alert('No valid rows with a Profile Code found to import.');
            return;
        }

        const itemsToImport = validRows.map(r => ({
            brand: r.brand,
            profileCode: r.profileCode,
            description: r.description || r.profileCode,
            series: r.series || '80.5 SERIES',
            topFilmWidth: r.topFilmWidth,
            topStickerName: r.topStickerName,
            bottomFilmWidth: r.bottomFilmWidth,
            bottomStickerName: r.bottomStickerName,
            topInwardMeters: r.inwardMeters > 0 ? r.inwardMeters : undefined,
            bottomInwardMeters: r.inwardMeters > 0 ? r.inwardMeters : undefined
        }));

        const inwardTxsToImport = recordInwardStock 
            ? validRows.filter(r => r.inwardMeters > 0).map(r => ({
                brand: r.brand,
                filmWidth: r.topFilmWidth || '38',
                meters: r.inwardMeters,
                rollCount: r.rollCount || 1,
                supplier: r.supplier || 'Excel Import',
                refNo: r.refNo,
                date: r.date,
                side: 'BOTH',
                notes: `Auto Stock imported via Excel for SKU ${r.profileCode}`
            }))
            : [];

        importProtectiveFilmBatch(itemsToImport, inwardTxsToImport);

        setImportSuccessMsg(`Successfully imported ${validRows.length} profile protective film size specification(s) brand-wise${inwardTxsToImport.length > 0 ? ` and recorded ${inwardTxsToImport.length} roll stock inward entry(ies)` : ''}!`);
        setExcelFile(null);
        setImportParsedRows([]);
        setTimeout(() => {
            setImportSuccessMsg(null);
        }, 5000);
    };

    // All available brands list directly from store brands
    const allAvailableBrands = useMemo(() => {
        const set = new Set<string>();
        if (brands && Array.isArray(brands)) {
            brands.forEach(b => { 
                const trimmed = b?.trim();
                if (trimmed) set.add(trimmed); 
            });
        }
        if (set.size === 0) {
            ['Scraft', 'Smart'].forEach(b => set.add(b));
        }
        return Array.from(set).sort();
    }, [brands]);

    // Brand-Wise Metrics and Sticker Size / Sticker Name analytics
    const brandDataMap = useMemo(() => {
        const map: Record<string, {
            brand: string;
            profileCount: number;
            totalInwardMtrs: number;
            totalOutwardMtrs: number;
            netBalanceMtrs: number;
            lowStockCount: number;
            topSizes: Record<string, number>;
            bottomSizes: Record<string, number>;
            allSizesUsed: string[];
            stickerNamesUsed: string[];
            profiles: ProtectiveFilmItem[];
        }> = {};

        allAvailableBrands.forEach(b => {
            map[b] = {
                brand: b,
                profileCount: 0,
                totalInwardMtrs: 0,
                totalOutwardMtrs: 0,
                netBalanceMtrs: 0,
                lowStockCount: 0,
                topSizes: {},
                bottomSizes: {},
                allSizesUsed: [],
                stickerNamesUsed: [],
                profiles: []
            };
        });

        // 1. Profile Items
        protectiveFilmItems.forEach(item => {
            const prof = profiles.find(p => p.sku?.toUpperCase() === item.profileCode?.toUpperCase());
            const b = item.brand && item.brand !== 'All' ? item.brand : (prof?.brand || 'Scraft');
            if (!map[b]) {
                map[b] = {
                    brand: b,
                    profileCount: 0,
                    totalInwardMtrs: 0,
                    totalOutwardMtrs: 0,
                    netBalanceMtrs: 0,
                    lowStockCount: 0,
                    topSizes: {},
                    bottomSizes: {},
                    allSizesUsed: [],
                    stickerNamesUsed: [],
                    profiles: []
                };
            }

            const data = map[b];
            data.profileCount += 1;
            data.profiles.push(item);

            const topIn = item.topInwardMeters || 0;
            const botIn = item.bottomInwardMeters || 0;
            data.totalInwardMtrs += (topIn + botIn);
            data.netBalanceMtrs += (topIn + botIn); // baseline

            if (item.topFilmWidth && String(item.topFilmWidth) !== 'NILL') {
                const tw = String(item.topFilmWidth);
                data.topSizes[tw] = (data.topSizes[tw] || 0) + 1;
            }
            if (item.bottomFilmWidth && String(item.bottomFilmWidth) !== 'NILL') {
                const bw = String(item.bottomFilmWidth);
                data.bottomSizes[bw] = (data.bottomSizes[bw] || 0) + 1;
            }
            if (item.topStickerName && String(item.topStickerName).trim()) {
                const tName = String(item.topStickerName).trim();
                if (!data.stickerNamesUsed.includes(tName)) {
                    data.stickerNamesUsed.push(tName);
                }
            }
            if (item.bottomStickerName && String(item.bottomStickerName).trim()) {
                const bName = String(item.bottomStickerName).trim();
                if (!data.stickerNamesUsed.includes(bName)) {
                    data.stickerNamesUsed.push(bName);
                }
            }
        });

        // 2. Extra Inward Transactions
        protectiveFilmInwardTransactions.forEach(tx => {
            if (tx.deletedAt) return;
            const b = tx.brand || 'Scraft';
            if (map[b]) {
                const m = Number(tx.meters || 0);
                map[b].totalInwardMtrs += m;
                map[b].netBalanceMtrs += m;
            }
        });

        // 3. Extra Outward Adjustments
        protectiveFilmOutwardAdjustments.forEach(adj => {
            if (adj.deletedAt) return;
            const b = adj.brand || 'Scraft';
            if (map[b]) {
                const m = Number(adj.meters || 0);
                map[b].totalOutwardMtrs += m;
                map[b].netBalanceMtrs -= m;
            }
        });

        // Consolidate sizes
        allAvailableBrands.forEach(b => {
            const data = map[b];
            if (data) {
                const allSizes = new Set<string>([
                    ...Object.keys(data.topSizes),
                    ...Object.keys(data.bottomSizes)
                ]);
                data.allSizesUsed = Array.from(allSizes).sort((a, b) => (parseFloat(a) || 0) - (parseFloat(b) || 0));
            }
        });

        return map;
    }, [allAvailableBrands, protectiveFilmItems, profiles, protectiveFilmInwardTransactions, protectiveFilmOutwardAdjustments]);

    // Profiles for the currently selected brand in Catalog View
    const selectedBrandProfiles = useMemo(() => {
        return protectiveFilmItems.filter(item => {
            const prof = profiles.find(p => p.sku?.toUpperCase() === item.profileCode?.toUpperCase());
            const b = item.brand && item.brand !== 'All' ? item.brand : (prof?.brand || 'Scraft');
            const matchesBrand = b.toLowerCase() === selectedBrand.toLowerCase() || (selectedBrand === 'Scraft' && (!item.brand || item.brand === 'All'));
            
            if (!searchTerm) return matchesBrand;
            const s = searchTerm.toLowerCase();
            return matchesBrand && (
                item.description.toLowerCase().includes(s) ||
                item.profileCode.toLowerCase().includes(s) ||
                item.series.toLowerCase().includes(s) ||
                (item.topStickerName || '').toLowerCase().includes(s) ||
                (item.bottomStickerName || '').toLowerCase().includes(s) ||
                item.topFilmWidth.includes(s) ||
                item.bottomFilmWidth.includes(s)
            );
        });
    }, [protectiveFilmItems, profiles, selectedBrand, searchTerm]);

    // Handle Add New Brand
    const handleCreateBrand = (e: React.FormEvent) => {
        e.preventDefault();
        const trimmed = newBrandName.trim();
        if (!trimmed) return;

        // Add to store brands
        addBrand(trimmed);

        // If user opted to clone default catalog with customized sticker sizes & names
        if (cloneDefaultCatalog) {
            const topW = newBrandTopWidth.trim() || '38';
            const botW = newBrandBottomWidth.trim() || '38';
            const topName = newBrandTopStickerName.trim() || `${trimmed} Film ${topW}mm`;
            const botName = newBrandBottomStickerName.trim() || `${trimmed} Base ${botW}mm`;

            DEFAULT_PROTECTIVE_FILM_ITEMS.forEach(defaultItem => {
                addProtectiveFilmItem({
                    ...defaultItem,
                    brand: trimmed,
                    topFilmWidth: defaultItem.topFilmWidth === 'NILL' ? 'NILL' : topW,
                    topStickerName: defaultItem.topFilmWidth === 'NILL' ? '' : topName,
                    bottomFilmWidth: defaultItem.bottomFilmWidth === 'NILL' ? 'NILL' : botW,
                    bottomStickerName: defaultItem.bottomFilmWidth === 'NILL' ? '' : botName,
                    topInwardMeters: 5000,
                    bottomInwardMeters: 5000
                });
            });
        }

        setSelectedBrand(trimmed);
        setNewBrandName('');
        setNewBrandTopStickerName('');
        setNewBrandBottomStickerName('');
        setIsAddingBrand(false);
        setBatchSuccessMsg(`Brand "${trimmed}" created successfully${cloneDefaultCatalog ? ' with 42 configured profile specifications!' : '.'}`);
        setTimeout(() => setBatchSuccessMsg(null), 4000);
    };

    // Handle Rename Brand
    const handleSaveBrandRename = () => {
        if (!editingBrand || !editingBrand.newName.trim()) return;
        const oldB = editingBrand.oldName.trim();
        const newB = editingBrand.newName.trim();
        if (oldB === newB) {
            setEditingBrand(null);
            return;
        }

        updateBrand(oldB, newB);
        if (selectedBrand.toLowerCase() === oldB.toLowerCase()) {
            setSelectedBrand(newB);
        }
        setEditingBrand(null);
        setBatchSuccessMsg(`Brand "${oldB}" renamed to "${newB}" across all stickers & profiles.`);
        setTimeout(() => setBatchSuccessMsg(null), 4000);
    };

    // Prompt safe brand deletion
    const handleInitiateDeleteBrand = (brandName: string) => {
        const bData = brandDataMap[brandName] || { profileCount: 0 };
        const inwards = protectiveFilmInwardTransactions.filter(t => !t.deletedAt && t.brand?.toLowerCase() === brandName.toLowerCase()).length;
        const outwards = protectiveFilmOutwardAdjustments.filter(a => !a.deletedAt && a.brand?.toLowerCase() === brandName.toLowerCase()).length;
        
        // Find a fallback target
        const otherBrands = allAvailableBrands.filter(b => b.toLowerCase() !== brandName.toLowerCase());
        const fallback = otherBrands[0] || 'Scraft';

        setBrandToDelete({
            brandName,
            profileCount: bData.profileCount,
            inwardCount: inwards,
            outwardCount: outwards,
            reassignTarget: fallback,
            deleteAction: 'REASSIGN'
        });
    };

    // Confirm Brand Deletion
    const handleConfirmBrandDelete = () => {
        if (!brandToDelete) return;
        const { brandName } = brandToDelete;

        deleteBrand(brandName);
        setBatchSuccessMsg(`Brand "${brandName}" and all associated protective film data have been deleted.`);

        const remaining = allAvailableBrands.filter(b => b.toLowerCase() !== brandName.toLowerCase());
        const nextBrand = remaining[0] || 'Scraft';
        setSelectedBrand(nextBrand);
        onSelectBrand(nextBrand);

        setBrandToDelete(null);
        setTimeout(() => setBatchSuccessMsg(null), 4000);
    };

    // Batch update sticker size and name brand-wise
    const handleApplyBatchStickerUpdate = (e: React.FormEvent) => {
        e.preventDefault();
        const targetBrand = batchForm.brand;
        const effectiveWidth = batchForm.customWidthEntry.trim() || batchForm.newWidth.trim();
        const effectiveName = batchForm.newStickerName.trim();

        if (!effectiveWidth && !effectiveName) {
            alert('Please specify either a new sticker width (mm) or a new sticker print name to apply.');
            return;
        }

        let updatedCount = 0;

        protectiveFilmItems.forEach(item => {
            const prof = profiles.find(p => p.sku?.toUpperCase() === item.profileCode?.toUpperCase());
            const b = item.brand && item.brand !== 'All' ? item.brand : (prof?.brand || 'Scraft');
            
            if (b.toLowerCase() !== targetBrand.toLowerCase() && targetBrand !== 'ALL_BRANDS') {
                return;
            }

            let changed = false;
            const updatedItem = { ...item };

            // TOP FILM
            if (batchForm.targetSide === 'TOP' || batchForm.targetSide === 'BOTH') {
                const matchesWidth = batchForm.matchWidth === 'All' || item.topFilmWidth === batchForm.matchWidth;
                if (matchesWidth && item.topFilmWidth !== 'NILL') {
                    if (effectiveWidth) {
                        updatedItem.topFilmWidth = effectiveWidth;
                    }
                    if (effectiveName) {
                        updatedItem.topStickerName = effectiveName;
                    }
                    changed = true;
                }
            }

            // BOTTOM FILM
            if (batchForm.targetSide === 'BOTTOM' || batchForm.targetSide === 'BOTH') {
                const matchesWidth = batchForm.matchWidth === 'All' || item.bottomFilmWidth === batchForm.matchWidth;
                if (matchesWidth && item.bottomFilmWidth !== 'NILL') {
                    if (effectiveWidth) {
                        updatedItem.bottomFilmWidth = effectiveWidth;
                    }
                    if (effectiveName) {
                        updatedItem.bottomStickerName = effectiveName;
                    }
                    changed = true;
                }
            }

            if (changed) {
                updateProtectiveFilmItem(updatedItem);
                updatedCount++;
            }
        });

        setBatchSuccessMsg(`Successfully updated sticker configuration on ${updatedCount} profile specification(s) for brand "${targetBrand}"!`);
        setTimeout(() => setBatchSuccessMsg(null), 4500);
    };

    // Save individual row edit in catalog view
    const handleSaveRowEdit = (item: ProtectiveFilmItem) => {
        updateProtectiveFilmItem({
            ...item,
            topFilmWidth: rowEditState.topFilmWidth || item.topFilmWidth,
            topStickerName: rowEditState.topStickerName,
            bottomFilmWidth: rowEditState.bottomFilmWidth || item.bottomFilmWidth,
            bottomStickerName: rowEditState.bottomStickerName,
            description: rowEditState.description || item.description,
            profileCode: rowEditState.profileCode || item.profileCode
        });
        setEditingRowId(null);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
            <div className="bg-white dark:bg-gray-800 rounded-3xl max-w-5xl w-full shadow-2xl border border-gray-100 dark:border-gray-700 overflow-hidden flex flex-col max-h-[94vh] animate-in fade-in zoom-in-95 duration-150">
                
                {/* Header */}
                <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white p-5 sm:p-6 flex items-center justify-between border-b border-blue-800/40 relative">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-blue-500/20 border border-blue-400/30 flex items-center justify-center text-blue-300">
                            <Sliders className="w-5 h-5" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h3 className="text-lg font-black uppercase tracking-tight">
                                    Manage Brands & Sticker Specifications
                                </h3>
                                <span className="px-2 py-0.5 rounded-full bg-blue-500/30 text-blue-200 text-[10px] font-black uppercase">
                                    {allAvailableBrands.length} Brands
                                </span>
                            </div>
                            <p className="text-xs text-blue-200/80 mt-0.5">
                                Add or delete extrusion brands, customize sticker sizes (widths) and sticker print names brand-wise.
                            </p>
                        </div>
                    </div>

                    <button 
                        onClick={onClose} 
                        className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-all cursor-pointer"
                        title="Close Manage Brands"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Success Alert Banner */}
                {batchSuccessMsg && (
                    <div className="bg-emerald-50 dark:bg-emerald-950/40 border-b border-emerald-200 dark:border-emerald-800 px-5 py-2.5 flex items-center justify-between text-xs font-bold text-emerald-800 dark:text-emerald-300">
                        <div className="flex items-center gap-2">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                            <span>{batchSuccessMsg}</span>
                        </div>
                        <button onClick={() => setBatchSuccessMsg(null)} className="text-emerald-600 hover:text-emerald-800">
                            ✕
                        </button>
                    </div>
                )}

                {/* Sub-Navigation Tabs */}
                <div className="bg-gray-50 dark:bg-gray-900/60 border-b border-gray-200 dark:border-gray-700 px-5 py-2.5 flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-1.5 bg-white dark:bg-gray-800 p-1 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
                        <button
                            onClick={() => setActiveTab('OVERVIEW')}
                            className={`px-3.5 py-1.5 rounded-lg text-xs font-black uppercase tracking-tight flex items-center gap-1.5 transition-all cursor-pointer ${
                                activeTab === 'OVERVIEW'
                                    ? 'bg-blue-600 text-white shadow-sm'
                                    : 'text-gray-600 dark:text-gray-300 hover:text-blue-600'
                            }`}
                        >
                            <Tag className="w-3.5 h-3.5" /> Brands Overview & Delete
                        </button>
                        <button
                            onClick={() => setActiveTab('STICKER_CATALOG')}
                            className={`px-3.5 py-1.5 rounded-lg text-xs font-black uppercase tracking-tight flex items-center gap-1.5 transition-all cursor-pointer ${
                                activeTab === 'STICKER_CATALOG'
                                    ? 'bg-blue-600 text-white shadow-sm'
                                    : 'text-gray-600 dark:text-gray-300 hover:text-blue-600'
                            }`}
                        >
                            <FileText className="w-3.5 h-3.5" /> Brand Sticker Catalog & Sizes
                        </button>
                        <button
                            onClick={() => setActiveTab('BATCH_UPDATE')}
                            className={`px-3.5 py-1.5 rounded-lg text-xs font-black uppercase tracking-tight flex items-center gap-1.5 transition-all cursor-pointer ${
                                activeTab === 'BATCH_UPDATE'
                                    ? 'bg-blue-600 text-white shadow-sm'
                                    : 'text-gray-600 dark:text-gray-300 hover:text-blue-600'
                            }`}
                        >
                            <Sparkles className="w-3.5 h-3.5" /> Batch Change Sticker Size & Name
                        </button>
                        <button
                            onClick={() => setActiveTab('IMPORT_EXCEL')}
                            className={`px-3.5 py-1.5 rounded-lg text-xs font-black uppercase tracking-tight flex items-center gap-1.5 transition-all cursor-pointer ${
                                activeTab === 'IMPORT_EXCEL'
                                    ? 'bg-blue-600 text-white shadow-sm'
                                    : 'text-gray-600 dark:text-gray-300 hover:text-blue-600'
                            }`}
                        >
                            <FileSpreadsheet className="w-3.5 h-3.5" /> Import Excel Sheet (Sizes & Stock)
                        </button>
                    </div>

                    {/* Quick Add Brand Button */}
                    <button
                        onClick={() => setIsAddingBrand(!isAddingBrand)}
                        className={`px-3.5 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer ${
                            isAddingBrand
                                ? 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200'
                                : 'bg-blue-600 hover:bg-blue-700 text-white shadow-sm'
                        }`}
                    >
                        {isAddingBrand ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                        {isAddingBrand ? 'Close Add Form' : 'Add New Brand'}
                    </button>
                </div>

                {/* Modal Body */}
                <div className="p-5 overflow-y-auto flex-1 space-y-5">
                    
                    {/* Collapsible Add New Brand Form */}
                    {isAddingBrand && (
                        <div className="p-5 bg-gradient-to-br from-blue-50/70 to-indigo-50/70 dark:from-blue-950/30 dark:to-indigo-950/30 rounded-2xl border border-blue-200 dark:border-blue-800 space-y-4 shadow-sm animate-in fade-in duration-200">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2 text-blue-900 dark:text-blue-200">
                                    <Tag className="w-4 h-4 text-blue-600" />
                                    <h4 className="text-sm font-black uppercase tracking-wider">Create New Extrusion Brand</h4>
                                </div>
                                <span className="text-[10px] text-gray-500">Configure brand-wise default sticker parameters</span>
                            </div>

                            <form onSubmit={handleCreateBrand} className="space-y-4">
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                    <div>
                                        <label className="text-[10px] font-black uppercase text-gray-500 dark:text-gray-400">
                                            Brand Name *
                                        </label>
                                        <input
                                            type="text"
                                            required
                                            placeholder="e.g. Aluk, Euro, Primus, Veka"
                                            value={newBrandName}
                                            onChange={(e) => setNewBrandName(e.target.value)}
                                            className="w-full mt-1 p-2.5 bg-white dark:bg-gray-900 rounded-xl text-xs font-bold border border-gray-200 dark:border-gray-700 outline-none focus:ring-2 focus:ring-blue-500"
                                        />
                                    </div>

                                    <div>
                                        <label className="text-[10px] font-black uppercase text-gray-500 dark:text-gray-400">
                                            Default Top Sticker Width (mm)
                                        </label>
                                        <select
                                            value={newBrandTopWidth}
                                            onChange={(e) => setNewBrandTopWidth(e.target.value)}
                                            className="w-full mt-1 p-2.5 bg-white dark:bg-gray-900 rounded-xl text-xs font-bold border border-gray-200 dark:border-gray-700 outline-none focus:ring-2 focus:ring-blue-500"
                                        >
                                            {STANDARD_WIDTH_PRESETS.map(w => (
                                                <option key={w} value={w}>{w} mm</option>
                                            ))}
                                        </select>
                                    </div>

                                    <div>
                                        <label className="text-[10px] font-black uppercase text-gray-500 dark:text-gray-400">
                                            Default Top Sticker Print Name
                                        </label>
                                        <input
                                            type="text"
                                            placeholder="e.g. High Tack Film 38mm"
                                            value={newBrandTopStickerName}
                                            onChange={(e) => setNewBrandTopStickerName(e.target.value)}
                                            className="w-full mt-1 p-2.5 bg-white dark:bg-gray-900 rounded-xl text-xs border border-gray-200 dark:border-gray-700 outline-none focus:ring-2 focus:ring-blue-500"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div>
                                        <label className="text-[10px] font-black uppercase text-gray-500 dark:text-gray-400">
                                            Default Bottom Sticker Width (mm)
                                        </label>
                                        <select
                                            value={newBrandBottomWidth}
                                            onChange={(e) => setNewBrandBottomWidth(e.target.value)}
                                            className="w-full mt-1 p-2.5 bg-white dark:bg-gray-900 rounded-xl text-xs font-bold border border-gray-200 dark:border-gray-700 outline-none focus:ring-2 focus:ring-blue-500"
                                        >
                                            {STANDARD_WIDTH_PRESETS.map(w => (
                                                <option key={w} value={w}>{w} mm</option>
                                            ))}
                                        </select>
                                    </div>

                                    <div>
                                        <label className="text-[10px] font-black uppercase text-gray-500 dark:text-gray-400">
                                            Default Bottom Sticker Print Name
                                        </label>
                                        <input
                                            type="text"
                                            placeholder="e.g. Standard Base Film 34mm"
                                            value={newBrandBottomStickerName}
                                            onChange={(e) => setNewBrandBottomStickerName(e.target.value)}
                                            className="w-full mt-1 p-2.5 bg-white dark:bg-gray-900 rounded-xl text-xs border border-gray-200 dark:border-gray-700 outline-none focus:ring-2 focus:ring-blue-500"
                                        />
                                    </div>
                                </div>

                                <label className="flex items-center gap-2 p-3 bg-white dark:bg-gray-900 rounded-xl border border-blue-100 dark:border-blue-900/50 cursor-pointer text-xs font-bold text-gray-700 dark:text-gray-300">
                                    <input
                                        type="checkbox"
                                        checked={cloneDefaultCatalog}
                                        onChange={(e) => setCloneDefaultCatalog(e.target.checked)}
                                        className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                                    />
                                    <span>
                                        Clone standard 42-profile specifications catalogue for this new brand (allows instant brand-wise sticker size & name customization)
                                    </span>
                                </label>

                                <div className="flex justify-end gap-2 pt-1">
                                    <button
                                        type="button"
                                        onClick={() => setIsAddingBrand(false)}
                                        className="px-4 py-2 text-xs font-bold text-gray-500 hover:bg-gray-100 rounded-xl"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-sm flex items-center gap-1.5 cursor-pointer"
                                    >
                                        <Plus className="w-3.5 h-3.5" /> Create Brand & Initialize
                                    </button>
                                </div>
                            </form>
                        </div>
                    )}

                    {/* TAB 1: BRANDS OVERVIEW & DELETE CARDS */}
                    {activeTab === 'OVERVIEW' && (
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <h4 className="text-xs font-black uppercase tracking-wider text-gray-500 dark:text-gray-400">
                                    Registered Brands ({allAvailableBrands.length})
                                </h4>
                                <span className="text-[11px] text-gray-400">
                                    Showing live sticker sizes, print labels, profiles, and delete options
                                </span>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {allAvailableBrands.map(b => {
                                    const data = brandDataMap[b] || {
                                        brand: b,
                                        profileCount: 0,
                                        totalInwardMtrs: 0,
                                        totalOutwardMtrs: 0,
                                        netBalanceMtrs: 0,
                                        lowStockCount: 0,
                                        topSizes: {},
                                        bottomSizes: {},
                                        allSizesUsed: [],
                                        stickerNamesUsed: []
                                    };

                                    const isEditing = editingBrand?.oldName === b;
                                    const isCurrentActive = selectedBrand.toLowerCase() === b.toLowerCase();

                                    return (
                                        <div
                                            key={b}
                                            className={`p-5 rounded-2xl border transition-all ${
                                                isCurrentActive
                                                    ? 'bg-blue-50/40 dark:bg-blue-950/20 border-blue-300 dark:border-blue-800 ring-1 ring-blue-400/40 shadow-sm'
                                                    : 'bg-white dark:bg-gray-800/80 border-gray-100 dark:border-gray-700 shadow-sm'
                                            }`}
                                        >
                                            {/* Brand Card Header */}
                                            <div className="flex items-center justify-between gap-2 pb-3 border-b border-gray-100 dark:border-gray-700">
                                                {isEditing ? (
                                                    <div className="flex items-center gap-1.5 flex-1 mr-2">
                                                        <input
                                                            type="text"
                                                            value={editingBrand.newName}
                                                            onChange={(e) => setEditingBrand({ ...editingBrand, newName: e.target.value })}
                                                            className="p-1.5 bg-white dark:bg-gray-900 rounded-lg text-xs font-bold border border-blue-500 outline-none flex-1"
                                                            autoFocus
                                                        />
                                                        <button
                                                            onClick={handleSaveBrandRename}
                                                            className="p-1.5 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700"
                                                            title="Save Name"
                                                        >
                                                            <Check className="w-3.5 h-3.5" />
                                                        </button>
                                                        <button
                                                            onClick={() => setEditingBrand(null)}
                                                            className="p-1.5 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg text-xs"
                                                            title="Cancel"
                                                        >
                                                            <X className="w-3.5 h-3.5" />
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-8 h-8 rounded-xl bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 flex items-center justify-center font-black font-mono text-xs">
                                                            {b.substring(0, 2).toUpperCase()}
                                                        </div>
                                                        <div>
                                                            <h4 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-tight">
                                                                {b}
                                                            </h4>
                                                            <span className="text-[10px] text-gray-400 font-medium">
                                                                {data.profileCount} Profile Specifications
                                                            </span>
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Card Actions: Edit, Switch, Delete */}
                                                {!isEditing && (
                                                    <div className="flex items-center gap-1">
                                                        <button
                                                            onClick={() => {
                                                                setSelectedBrand(b);
                                                                onSelectBrand(b);
                                                                setActiveTab('STICKER_CATALOG');
                                                            }}
                                                            className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/30 dark:hover:bg-blue-900/50 text-blue-700 dark:text-blue-300 rounded-lg text-xs font-bold flex items-center gap-1 transition-all"
                                                        >
                                                            Inspect <ArrowRight className="w-3 h-3" />
                                                        </button>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Metrics Row */}
                                            <div className="grid grid-cols-3 gap-2 mt-3 p-2.5 bg-gray-50 dark:bg-gray-900/50 rounded-xl text-center text-xs">
                                                <div>
                                                    <span className="text-[9px] uppercase font-bold text-gray-400">Inward Stock</span>
                                                    <div className="font-mono font-black text-gray-800 dark:text-gray-200 mt-0.5">
                                                        {data.totalInwardMtrs.toLocaleString()} m
                                                    </div>
                                                </div>
                                                <div>
                                                    <span className="text-[9px] uppercase font-bold text-gray-400">Consumed</span>
                                                    <div className="font-mono font-bold text-amber-600 dark:text-amber-400 mt-0.5">
                                                        {data.totalOutwardMtrs.toLocaleString(undefined, { maximumFractionDigits: 1 })} m
                                                    </div>
                                                </div>
                                                <div>
                                                    <span className="text-[9px] uppercase font-bold text-gray-400">Live Balance</span>
                                                    <div className="font-mono font-black text-emerald-600 dark:text-emerald-400 mt-0.5">
                                                        {data.netBalanceMtrs.toLocaleString(undefined, { maximumFractionDigits: 1 })} m
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Sticker Sizes Used Chips */}
                                            <div className="mt-3 space-y-1.5">
                                                <div className="text-[10px] font-black uppercase tracking-wider text-gray-400 flex items-center justify-between">
                                                    <span>Sticker Sizes (Widths) Used:</span>
                                                    <span className="text-[9px] font-normal text-blue-500">
                                                        {data.allSizesUsed.length} sizes
                                                    </span>
                                                </div>

                                                <div className="flex items-center gap-1.5 flex-wrap">
                                                    {data.allSizesUsed.length === 0 ? (
                                                        <span className="text-xs text-gray-400 italic">No specific sticker widths assigned</span>
                                                    ) : (
                                                        data.allSizesUsed.map(sz => {
                                                            const topCount = data.topSizes[sz] || 0;
                                                            const botCount = data.bottomSizes[sz] || 0;
                                                            return (
                                                                <span
                                                                    key={sz}
                                                                    className="px-2 py-0.5 rounded-md bg-blue-100/70 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-mono font-bold text-[11px] border border-blue-200 dark:border-blue-800/40"
                                                                >
                                                                    {sz} mm <span className="text-[9px] opacity-75">({topCount + botCount}x)</span>
                                                                </span>
                                                            );
                                                        })
                                                    )}
                                                </div>
                                            </div>

                                            {/* Sticker Print Names / Labels */}
                                            {data.stickerNamesUsed.length > 0 && (
                                                <div className="mt-2.5 pt-2 border-t border-gray-100 dark:border-gray-700 space-y-1">
                                                    <div className="text-[10px] font-black uppercase tracking-wider text-gray-400">
                                                        Custom Sticker Print Names:
                                                    </div>
                                                    <div className="flex items-center gap-1 flex-wrap">
                                                        {data.stickerNamesUsed.slice(0, 3).map(name => (
                                                            <span
                                                                key={name}
                                                                className="px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-[10px] font-medium truncate max-w-[160px]"
                                                                title={name}
                                                            >
                                                                🏷️ {name}
                                                            </span>
                                                        ))}
                                                        {data.stickerNamesUsed.length > 3 && (
                                                            <span className="text-[9px] text-gray-400 font-bold">
                                                                +{data.stickerNamesUsed.length - 3} more
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* TAB 2: BRAND STICKER CATALOG & SIZE MATRIX (INLINE EDITING) */}
                    {activeTab === 'STICKER_CATALOG' && (
                        <div className="space-y-4">
                            {/* Brand Selector & Search Bar */}
                            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3 bg-gray-50 dark:bg-gray-900/60 rounded-2xl border border-gray-200 dark:border-gray-700">
                                <div className="flex items-center gap-2 w-full sm:w-auto flex-wrap">
                                    <span className="text-xs font-black uppercase text-gray-500">Selected Brand:</span>
                                    <div className="flex items-center gap-1 bg-white dark:bg-gray-800 p-1 rounded-xl border border-gray-200 dark:border-gray-700">
                                        {allAvailableBrands.map(b => (
                                            <button
                                                key={b}
                                                onClick={() => {
                                                    setSelectedBrand(b);
                                                    setEditingRowId(null);
                                                }}
                                                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                                                    selectedBrand.toLowerCase() === b.toLowerCase()
                                                        ? 'bg-blue-600 text-white shadow-sm'
                                                        : 'text-gray-600 dark:text-gray-400 hover:text-gray-900'
                                                }`}
                                            >
                                                {b}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="relative flex-1 w-full max-w-xs">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                                    <input
                                        type="text"
                                        placeholder="Search profile code, sticker name..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="w-full pl-8 pr-3 py-1.5 bg-white dark:bg-gray-800 rounded-xl text-xs border border-gray-200 dark:border-gray-700 outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>
                            </div>

                            {/* Table of Profiles and Stickers for this Brand */}
                            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 overflow-hidden shadow-sm">
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left text-xs border-collapse">
                                        <thead>
                                            <tr className="bg-gray-50 dark:bg-gray-900/80 border-b border-gray-200 dark:border-gray-700 text-[10px] font-black uppercase tracking-wider text-gray-500">
                                                <th className="p-3 text-center w-12">S.No</th>
                                                <th className="p-3 min-w-[150px]">Profile Description</th>
                                                <th className="p-3 text-center min-w-[80px]">Code</th>
                                                
                                                {/* TOP STICKER CONFIG */}
                                                <th className="p-3 bg-blue-50/60 dark:bg-blue-950/20 text-blue-700 dark:text-blue-300 border-l border-blue-100 dark:border-blue-900/40 min-w-[160px]">
                                                    Top Sticker Size & Name
                                                </th>

                                                {/* BOTTOM STICKER CONFIG */}
                                                <th className="p-3 bg-indigo-50/60 dark:bg-indigo-950/20 text-indigo-700 dark:text-indigo-300 border-l border-indigo-100 dark:border-indigo-900/40 min-w-[160px]">
                                                    Bottom Sticker Size & Name
                                                </th>

                                                <th className="p-3 text-center min-w-[120px]">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100 dark:divide-gray-700/60 font-medium">
                                            {selectedBrandProfiles.length === 0 ? (
                                                <tr>
                                                    <td colSpan={6} className="p-8 text-center text-gray-400">
                                                        No profile specifications configured specifically for brand "{selectedBrand}". 
                                                        Use the "Batch Change" tab or "Add New Brand" to initialize specifications for this brand.
                                                    </td>
                                                </tr>
                                            ) : (
                                                selectedBrandProfiles.map((item, idx) => {
                                                    const isEditing = editingRowId === item.id;

                                                    return (
                                                        <tr key={item.id} className="hover:bg-gray-50/60 dark:hover:bg-gray-750 transition-colors">
                                                            <td className="p-3 text-center text-gray-400 font-mono text-[11px]">
                                                                {item.sNo || idx + 1}
                                                            </td>
                                                            <td className="p-3">
                                                                {isEditing ? (
                                                                    <input
                                                                        type="text"
                                                                        value={rowEditState.description}
                                                                        onChange={(e) => setRowEditState({ ...rowEditState, description: e.target.value })}
                                                                        className="w-full p-1 bg-gray-50 dark:bg-gray-900 rounded border border-blue-400 text-xs font-bold"
                                                                    />
                                                                ) : (
                                                                    <div>
                                                                        <div className="font-bold text-gray-900 dark:text-white">
                                                                            {item.description}
                                                                        </div>
                                                                        <div className="text-[10px] text-gray-400">
                                                                            {item.series}
                                                                        </div>
                                                                    </div>
                                                                )}
                                                            </td>
                                                            <td className="p-3 text-center">
                                                                {isEditing ? (
                                                                    <input
                                                                        type="text"
                                                                        value={rowEditState.profileCode}
                                                                        onChange={(e) => setRowEditState({ ...rowEditState, profileCode: e.target.value })}
                                                                        className="w-20 p-1 bg-gray-50 dark:bg-gray-900 rounded border border-blue-400 text-xs font-mono font-bold text-center"
                                                                    />
                                                                ) : (
                                                                    <span className="px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 font-mono font-bold text-[11px]">
                                                                        {item.profileCode}
                                                                    </span>
                                                                )}
                                                            </td>

                                                            {/* TOP STICKER COLUMN */}
                                                            <td className="p-3 bg-blue-50/20 dark:bg-blue-950/10 border-l border-blue-100 dark:border-blue-900/40">
                                                                {isEditing ? (
                                                                    <div className="space-y-1">
                                                                        <div className="flex items-center gap-1">
                                                                            <span className="text-[10px] text-gray-400">Width:</span>
                                                                            <input
                                                                                type="text"
                                                                                value={rowEditState.topFilmWidth}
                                                                                onChange={(e) => setRowEditState({ ...rowEditState, topFilmWidth: e.target.value })}
                                                                                placeholder="38 or NILL"
                                                                                className="w-16 p-1 bg-white dark:bg-gray-900 rounded border border-blue-400 font-mono font-bold text-xs"
                                                                            />
                                                                        </div>
                                                                        <input
                                                                            type="text"
                                                                            value={rowEditState.topStickerName}
                                                                            onChange={(e) => setRowEditState({ ...rowEditState, topStickerName: e.target.value })}
                                                                            placeholder="Sticker Print Name"
                                                                            className="w-full p-1 bg-white dark:bg-gray-900 rounded border border-blue-400 text-xs"
                                                                        />
                                                                    </div>
                                                                ) : (
                                                                    <div>
                                                                        <div className="flex items-center gap-1.5">
                                                                            <span className={`px-2 py-0.5 rounded font-mono font-bold text-[11px] ${
                                                                                !item.topFilmWidth || item.topFilmWidth === 'NILL'
                                                                                    ? 'bg-gray-100 dark:bg-gray-700 text-gray-400'
                                                                                    : 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 font-black'
                                                                            }`}>
                                                                                {item.topFilmWidth ? `${item.topFilmWidth} mm` : 'NILL'}
                                                                            </span>
                                                                        </div>
                                                                        {item.topStickerName && (
                                                                            <div className="text-[10px] text-blue-600 dark:text-blue-400 font-medium mt-0.5 flex items-center gap-1 truncate">
                                                                                🏷️ {item.topStickerName}
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                )}
                                                            </td>

                                                            {/* BOTTOM STICKER COLUMN */}
                                                            <td className="p-3 bg-indigo-50/20 dark:bg-indigo-950/10 border-l border-indigo-100 dark:border-indigo-900/40">
                                                                {isEditing ? (
                                                                    <div className="space-y-1">
                                                                        <div className="flex items-center gap-1">
                                                                            <span className="text-[10px] text-gray-400">Width:</span>
                                                                            <input
                                                                                type="text"
                                                                                value={rowEditState.bottomFilmWidth}
                                                                                onChange={(e) => setRowEditState({ ...rowEditState, bottomFilmWidth: e.target.value })}
                                                                                placeholder="38 or NILL"
                                                                                className="w-16 p-1 bg-white dark:bg-gray-900 rounded border border-indigo-400 font-mono font-bold text-xs"
                                                                            />
                                                                        </div>
                                                                        <input
                                                                            type="text"
                                                                            value={rowEditState.bottomStickerName}
                                                                            onChange={(e) => setRowEditState({ ...rowEditState, bottomStickerName: e.target.value })}
                                                                            placeholder="Sticker Print Name"
                                                                            className="w-full p-1 bg-white dark:bg-gray-900 rounded border border-indigo-400 text-xs"
                                                                        />
                                                                    </div>
                                                                ) : (
                                                                    <div>
                                                                        <div className="flex items-center gap-1.5">
                                                                            <span className={`px-2 py-0.5 rounded font-mono font-bold text-[11px] ${
                                                                                !item.bottomFilmWidth || item.bottomFilmWidth === 'NILL'
                                                                                    ? 'bg-gray-100 dark:bg-gray-700 text-gray-400'
                                                                                    : 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 font-black'
                                                                            }`}>
                                                                                {item.bottomFilmWidth ? `${item.bottomFilmWidth} mm` : 'NILL'}
                                                                            </span>
                                                                        </div>
                                                                        {item.bottomStickerName && (
                                                                            <div className="text-[10px] text-indigo-600 dark:text-indigo-400 font-medium mt-0.5 flex items-center gap-1 truncate">
                                                                                🏷️ {item.bottomStickerName}
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                )}
                                                            </td>

                                                            {/* ACTIONS */}
                                                            <td className="p-3 text-center">
                                                                {isEditing ? (
                                                                    <div className="flex items-center justify-center gap-1">
                                                                        <button
                                                                            onClick={() => handleSaveRowEdit(item)}
                                                                            className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center gap-1 shadow-sm"
                                                                        >
                                                                            <Check className="w-3 h-3" /> Save
                                                                        </button>
                                                                        <button
                                                                            onClick={() => setEditingRowId(null)}
                                                                            className="px-2 py-1 bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-lg text-xs"
                                                                        >
                                                                            ✕
                                                                        </button>
                                                                    </div>
                                                                ) : (
                                                                    <div className="flex items-center justify-center gap-1">
                                                                        <button
                                                                            onClick={() => {
                                                                                setEditingRowId(item.id);
                                                                                setRowEditState({
                                                                                    topFilmWidth: item.topFilmWidth,
                                                                                    topStickerName: item.topStickerName || '',
                                                                                    bottomFilmWidth: item.bottomFilmWidth,
                                                                                    bottomStickerName: item.bottomStickerName || '',
                                                                                    description: item.description,
                                                                                    profileCode: item.profileCode
                                                                                });
                                                                            }}
                                                                            className="px-2 py-1 bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 text-blue-700 dark:text-blue-300 rounded-lg text-xs font-bold flex items-center gap-1"
                                                                            title="Edit sticker size and print name"
                                                                        >
                                                                            <Edit3 className="w-3 h-3" /> Edit
                                                                        </button>
                                                                        <button
                                                                            onClick={() => {
                                                                                if (confirm(`Remove profile specification for ${item.description} (${item.profileCode})?`)) {
                                                                                    deleteProtectiveFilmItem(item.id);
                                                                                }
                                                                            }}
                                                                            className="px-1.5 py-1 text-rose-600 hover:bg-rose-50 rounded-lg text-xs"
                                                                            title="Delete item"
                                                                        >
                                                                            <Trash2 className="w-3 h-3" />
                                                                        </button>
                                                                    </div>
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

                    {/* TAB 3: BATCH CHANGE STICKER SIZE & NAME BRAND-WISE */}
                    {activeTab === 'BATCH_UPDATE' && (
                        <div className="p-6 bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 space-y-6 shadow-sm">
                            <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 flex items-center justify-center">
                                    <Sparkles className="w-4 h-4" />
                                </div>
                                <div>
                                    <h4 className="text-sm font-black uppercase tracking-tight text-gray-900 dark:text-white">
                                        Batch Update Sticker Widths & Sticker Names Brand-Wise
                                    </h4>
                                    <p className="text-xs text-gray-400">
                                        Quickly replace or reconfigure all sticker widths (e.g. from 38mm to 40mm) and print design names for any brand.
                                    </p>
                                </div>
                            </div>

                            <form onSubmit={handleApplyBatchStickerUpdate} className="space-y-4">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-[10px] font-black uppercase text-gray-400">
                                            Target Brand *
                                        </label>
                                        <select
                                            value={batchForm.brand}
                                            onChange={(e) => setBatchForm({ ...batchForm, brand: e.target.value })}
                                            className="w-full mt-1 p-2.5 bg-gray-50 dark:bg-gray-900 rounded-xl text-xs font-bold border-none outline-none focus:ring-2 focus:ring-blue-500"
                                        >
                                            <option value="ALL_BRANDS">-- All Brands --</option>
                                            {allAvailableBrands.map(b => (
                                                <option key={b} value={b}>{b}</option>
                                            ))}
                                        </select>
                                    </div>

                                    <div>
                                        <label className="text-[10px] font-black uppercase text-gray-400">
                                            Film Position to Update
                                        </label>
                                        <select
                                            value={batchForm.targetSide}
                                            onChange={(e) => setBatchForm({ ...batchForm, targetSide: e.target.value as any })}
                                            className="w-full mt-1 p-2.5 bg-gray-50 dark:bg-gray-900 rounded-xl text-xs font-bold border-none outline-none focus:ring-2 focus:ring-blue-500"
                                        >
                                            <option value="BOTH">Both Top & Bottom Films</option>
                                            <option value="TOP">Top (Right) Film Only</option>
                                            <option value="BOTTOM">Bottom (Left) Film Only</option>
                                        </select>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                    <div>
                                        <label className="text-[10px] font-black uppercase text-gray-400">
                                            Match Current Size
                                        </label>
                                        <select
                                            value={batchForm.matchWidth}
                                            onChange={(e) => setBatchForm({ ...batchForm, matchWidth: e.target.value })}
                                            className="w-full mt-1 p-2.5 bg-gray-50 dark:bg-gray-900 rounded-xl text-xs font-bold border-none outline-none focus:ring-2 focus:ring-blue-500"
                                        >
                                            <option value="All">All Active Sizes</option>
                                            {STANDARD_WIDTH_PRESETS.map(w => (
                                                <option key={w} value={w}>Only {w} mm</option>
                                            ))}
                                        </select>
                                    </div>

                                    <div>
                                        <label className="text-[10px] font-black uppercase text-gray-400">
                                            New Sticker Width (mm)
                                        </label>
                                        <select
                                            value={batchForm.newWidth}
                                            onChange={(e) => setBatchForm({ ...batchForm, newWidth: e.target.value, customWidthEntry: '' })}
                                            className="w-full mt-1 p-2.5 bg-gray-50 dark:bg-gray-900 rounded-xl text-xs font-bold border-none outline-none focus:ring-2 focus:ring-blue-500"
                                        >
                                            <option value="">-- Leave Width Unchanged --</option>
                                            {STANDARD_WIDTH_PRESETS.map(w => (
                                                <option key={w} value={w}>{w} mm</option>
                                            ))}
                                        </select>
                                    </div>

                                    <div>
                                        <label className="text-[10px] font-black uppercase text-gray-400">
                                            Or Custom Width (mm)
                                        </label>
                                        <input
                                            type="text"
                                            placeholder="e.g. 42.5, 65"
                                            value={batchForm.customWidthEntry}
                                            onChange={(e) => setBatchForm({ ...batchForm, customWidthEntry: e.target.value })}
                                            className="w-full mt-1 p-2.5 bg-gray-50 dark:bg-gray-900 rounded-xl text-xs font-mono font-bold border-none outline-none focus:ring-2 focus:ring-blue-500"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="text-[10px] font-black uppercase text-gray-400">
                                        New Sticker Print Name / Brand Label
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="e.g. Smart Eco High Tack, Scraft Gold Glossy 38mm"
                                        value={batchForm.newStickerName}
                                        onChange={(e) => setBatchForm({ ...batchForm, newStickerName: e.target.value })}
                                        className="w-full mt-1 p-2.5 bg-gray-50 dark:bg-gray-900 rounded-xl text-xs border-none outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>

                                <div className="pt-2 flex items-center justify-between">
                                    <div className="text-xs text-gray-400 flex items-center gap-1.5">
                                        <Info className="w-4 h-4 text-blue-500" />
                                        <span>Updates will apply to profile specifications matching brand "{batchForm.brand}".</span>
                                    </div>

                                    <button
                                        type="submit"
                                        className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-lg shadow-indigo-900/30 flex items-center gap-2 cursor-pointer active:scale-95"
                                    >
                                        <Sparkles className="w-4 h-4" /> Apply Brand-Wise Sticker Changes
                                    </button>
                                </div>
                            </form>
                        </div>
                    )}

                    {/* TAB 4: IMPORT EXCEL SHEET (SIZES BRAND-WISE & STOCK) */}
                    {activeTab === 'IMPORT_EXCEL' && (
                        <div className="space-y-5">
                            <div className="p-5 bg-gradient-to-br from-indigo-900 via-blue-900 to-slate-900 rounded-2xl text-white shadow-lg border border-blue-800/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                <div className="space-y-1">
                                    <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-blue-500/20 text-blue-200 text-[10px] font-black uppercase tracking-wider border border-blue-400/20">
                                        <FileSpreadsheet className="w-3 h-3 text-blue-300" /> Excel Sheet Auto-Updater
                                    </div>
                                    <h3 className="text-lg font-black uppercase tracking-tight flex items-center gap-2">
                                        Import Protective Film Sizes &amp; Stock
                                    </h3>
                                    <p className="text-xs text-blue-200/80">
                                        Select the target brand, upload your Excel file to update top/bottom sticker sizes brand-wise, and log stock roll inward entries.
                                    </p>
                                </div>

                                <button
                                    onClick={handleDownloadSampleTemplate}
                                    className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 shadow-lg shadow-emerald-900/30 shrink-0 cursor-pointer active:scale-95"
                                >
                                    <Download className="w-4 h-4" /> Download Sample Template (.xlsx)
                                </button>
                            </div>

                            {/* TARGET BRAND SELECTION BOX */}
                            <div className="p-4 bg-blue-50/70 dark:bg-gray-800/90 rounded-2xl border border-blue-200 dark:border-gray-700 space-y-3 shadow-sm">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                    <div className="space-y-0.5">
                                        <label className="text-xs font-black uppercase tracking-wider text-gray-900 dark:text-white flex items-center gap-1.5">
                                            <Tag className="w-4 h-4 text-blue-600" /> Select Target Brand for Import *
                                        </label>
                                        <p className="text-[11px] text-gray-500 dark:text-gray-400">
                                            Specify which brand (e.g. Scraft, Smart, prevon) these imported sizes and stock items belong to.
                                        </p>
                                    </div>

                                    <div className="flex items-center gap-3 flex-wrap">
                                        <select
                                            value={importTargetBrand}
                                            onChange={(e) => {
                                                const newBrand = e.target.value;
                                                setImportTargetBrand(newBrand);
                                                if (overrideExcelBrand && importParsedRows.length > 0) {
                                                    setImportParsedRows(importParsedRows.map(r => ({ ...r, brand: newBrand })));
                                                }
                                            }}
                                            className="px-3.5 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-xl text-xs font-black text-blue-700 dark:text-blue-300 focus:ring-2 focus:ring-blue-500 outline-none shadow-sm cursor-pointer"
                                        >
                                            {allAvailableBrands.map(b => (
                                                <option key={b} value={b}>{b}</option>
                                            ))}
                                        </select>

                                        <label className="flex items-center gap-2 text-xs font-bold text-gray-800 dark:text-gray-200 cursor-pointer bg-white dark:bg-gray-900 px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
                                            <input
                                                type="checkbox"
                                                checked={overrideExcelBrand}
                                                onChange={(e) => {
                                                    const checked = e.target.checked;
                                                    setOverrideExcelBrand(checked);
                                                    if (checked && importParsedRows.length > 0) {
                                                        setImportParsedRows(importParsedRows.map(r => ({ ...r, brand: importTargetBrand })));
                                                    }
                                                }}
                                                className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                                            />
                                            <span>Apply selected brand ({importTargetBrand}) to all rows</span>
                                        </label>
                                    </div>
                                </div>
                            </div>

                            {/* Success & Error Banners */}
                            {importSuccessMsg && (
                                <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-2xl text-xs font-bold text-emerald-800 dark:text-emerald-300 flex items-center gap-3">
                                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                                    <span>{importSuccessMsg}</span>
                                </div>
                            )}

                            {importErrorMsg && (
                                <div className="p-4 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-2xl text-xs font-bold text-rose-800 dark:text-rose-300 flex items-center gap-3">
                                    <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
                                    <span>{importErrorMsg}</span>
                                </div>
                            )}

                            {/* Upload Area */}
                            <div className="border-2 border-dashed border-gray-300 dark:border-gray-700 hover:border-blue-500 dark:hover:border-blue-400 rounded-3xl p-8 text-center transition-all bg-gray-50/50 dark:bg-gray-900/30 relative">
                                <input
                                    type="file"
                                    accept=".xlsx, .xls, .csv"
                                    onChange={handleExcelFileUpload}
                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                                />
                                <div className="space-y-3 pointer-events-none flex flex-col items-center justify-center">
                                    <div className="w-14 h-14 rounded-2xl bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center shadow-inner">
                                        <Upload className="w-7 h-7 animate-bounce" />
                                    </div>
                                    <div>
                                        <h4 className="text-sm font-black uppercase text-gray-800 dark:text-white">
                                            {excelFile ? excelFile.name : `Click or Drag & Drop Protective Film Excel Sheet Here (Target: ${importTargetBrand})`}
                                        </h4>
                                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                            Supports .xlsx, .xls, .csv files. Columns: Brand, Profile Code, Top Sticker Width (mm), Top Sticker Name, Bottom Sticker Width (mm), Bottom Sticker Name, Inward Meters, Supplier, Ref No.
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Parsed Preview Table */}
                            {importParsedRows.length > 0 && (
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between flex-wrap gap-2">
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs font-black uppercase tracking-wider text-gray-700 dark:text-gray-200">
                                                Parsed Rows Preview ({importParsedRows.length})
                                            </span>
                                            <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300 text-[10px] font-bold">
                                                {importParsedRows.filter(r => r.isValid).length} Valid SKUs
                                            </span>
                                        </div>

                                        <label className="flex items-center gap-2 text-xs font-bold text-gray-700 dark:text-gray-300 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={recordInwardStock}
                                                onChange={(e) => setRecordInwardStock(e.target.checked)}
                                                className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                                            />
                                            <span>Record roll inward stock entries when inward meters &gt; 0</span>
                                        </label>
                                    </div>

                                    <div className="overflow-x-auto rounded-2xl border border-gray-200 dark:border-gray-800 max-h-80">
                                        <table className="w-full text-left text-xs border-collapse">
                                            <thead className="bg-gray-100 dark:bg-gray-800 sticky top-0 font-black uppercase text-[10px] text-gray-500 dark:text-gray-400 z-10">
                                                <tr>
                                                    <th className="p-2.5">Row</th>
                                                    <th className="p-2.5">Target Brand</th>
                                                    <th className="p-2.5">Profile Code</th>
                                                    <th className="p-2.5">Top Sticker (Size &amp; Name)</th>
                                                    <th className="p-2.5">Bottom Sticker (Size &amp; Name)</th>
                                                    <th className="p-2.5">Inward Stock Mtrs</th>
                                                    <th className="p-2.5">Status</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                                                {importParsedRows.map((r, i) => (
                                                    <tr key={i} className={r.isValid ? 'hover:bg-blue-50/30 dark:hover:bg-blue-950/20' : 'bg-rose-50/40 dark:bg-rose-950/20'}>
                                                        <td className="p-2.5 font-mono text-gray-400">{r.rowIndex}</td>
                                                        <td className="p-2.5">
                                                            <select
                                                                value={r.brand}
                                                                onChange={(e) => {
                                                                    const val = e.target.value;
                                                                    const updated = [...importParsedRows];
                                                                    updated[i].brand = val;
                                                                    setImportParsedRows(updated);
                                                                }}
                                                                className="px-2 py-1 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded text-xs font-bold text-blue-600 dark:text-blue-400"
                                                            >
                                                                {allAvailableBrands.map(b => (
                                                                    <option key={b} value={b}>{b}</option>
                                                                ))}
                                                            </select>
                                                        </td>
                                                        <td className="p-2.5 font-mono font-black">
                                                            <input
                                                                type="text"
                                                                value={r.profileCode}
                                                                onChange={(e) => {
                                                                    const val = e.target.value.trim();
                                                                    const updated = [...importParsedRows];
                                                                    updated[i].profileCode = val;
                                                                    updated[i].isValid = !!val;
                                                                    setImportParsedRows(updated);
                                                                }}
                                                                placeholder="SKU Code"
                                                                className="w-20 p-1 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded text-xs font-mono font-bold"
                                                            />
                                                        </td>
                                                        <td className="p-2.5">
                                                            <div className="flex items-center gap-1">
                                                                <input
                                                                    type="text"
                                                                    value={r.topFilmWidth}
                                                                    onChange={(e) => {
                                                                        const val = e.target.value;
                                                                        const updated = [...importParsedRows];
                                                                        updated[i].topFilmWidth = val;
                                                                        setImportParsedRows(updated);
                                                                    }}
                                                                    className="w-14 p-1 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded text-xs font-mono font-bold text-blue-700 dark:text-blue-300"
                                                                    placeholder="38"
                                                                />
                                                                <span className="text-[10px] text-gray-400 font-bold">mm</span>
                                                            </div>
                                                            <input
                                                                type="text"
                                                                value={r.topStickerName || ''}
                                                                onChange={(e) => {
                                                                    const val = e.target.value;
                                                                    const updated = [...importParsedRows];
                                                                    updated[i].topStickerName = val;
                                                                    setImportParsedRows(updated);
                                                                }}
                                                                placeholder="Print Name"
                                                                className="w-full mt-1 p-1 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded text-[10px]"
                                                            />
                                                        </td>
                                                        <td className="p-2.5">
                                                            <div className="flex items-center gap-1">
                                                                <input
                                                                    type="text"
                                                                    value={r.bottomFilmWidth}
                                                                    onChange={(e) => {
                                                                        const val = e.target.value;
                                                                        const updated = [...importParsedRows];
                                                                        updated[i].bottomFilmWidth = val;
                                                                        setImportParsedRows(updated);
                                                                    }}
                                                                    className="w-14 p-1 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded text-xs font-mono font-bold text-indigo-700 dark:text-indigo-300"
                                                                    placeholder="38"
                                                                />
                                                                <span className="text-[10px] text-gray-400 font-bold">mm</span>
                                                            </div>
                                                            <input
                                                                type="text"
                                                                value={r.bottomStickerName || ''}
                                                                onChange={(e) => {
                                                                    const val = e.target.value;
                                                                    const updated = [...importParsedRows];
                                                                    updated[i].bottomStickerName = val;
                                                                    setImportParsedRows(updated);
                                                                }}
                                                                placeholder="Print Name"
                                                                className="w-full mt-1 p-1 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded text-[10px]"
                                                            />
                                                        </td>
                                                        <td className="p-2.5 font-mono font-bold text-emerald-600">
                                                            <input
                                                                type="number"
                                                                value={r.inwardMeters || 0}
                                                                onChange={(e) => {
                                                                    const val = parseFloat(e.target.value) || 0;
                                                                    const updated = [...importParsedRows];
                                                                    updated[i].inwardMeters = val;
                                                                    updated[i].rollCount = val > 0 ? (updated[i].rollCount || 1) : 0;
                                                                    setImportParsedRows(updated);
                                                                }}
                                                                className="w-20 p-1 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded text-xs font-mono font-bold text-emerald-600"
                                                            />
                                                        </td>
                                                        <td className="p-2.5">
                                                            {r.isValid ? (
                                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold">
                                                                    <Check className="w-3 h-3" /> Ready
                                                                </span>
                                                            ) : (
                                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 text-[10px] font-bold">
                                                                    Missing SKU
                                                                </span>
                                                            )}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>

                                    <div className="flex items-center justify-end gap-3 pt-2">
                                        <button
                                            onClick={() => {
                                                setExcelFile(null);
                                                setImportParsedRows([]);
                                            }}
                                            className="px-4 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 text-gray-700 dark:text-gray-200 rounded-xl text-xs font-bold cursor-pointer"
                                        >
                                            Clear Sheet
                                        </button>
                                        <button
                                            onClick={handleCommitExcelImport}
                                            className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-lg shadow-blue-900/30 flex items-center gap-2 cursor-pointer active:scale-95"
                                        >
                                            <Database className="w-4 h-4" /> Import &amp; Apply Protective Film Sizes &amp; Stock ({importParsedRows.filter(r => r.isValid).length} Items for {importTargetBrand})
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Modal Footer */}
                <div className="p-4 bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 flex items-center justify-between flex-wrap gap-3">
                    <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                        <span>Active Selected Brand: <strong>{selectedBrand}</strong></span>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => {
                                onSelectBrand(selectedBrand);
                                onClose();
                            }}
                            className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer shadow-sm"
                        >
                            Apply & Filter by {selectedBrand}
                        </button>
                        <button
                            onClick={onClose}
                            className="px-4 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-xl text-xs font-bold transition-all cursor-pointer"
                        >
                            Close
                        </button>
                    </div>
                </div>
            </div>

            {/* SAFE BRAND DELETION MODAL DIALOG */}
            {brandToDelete && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-60 flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-gray-800 rounded-3xl max-w-md w-full p-6 shadow-2xl border border-rose-200 dark:border-rose-900 space-y-4 animate-in fade-in zoom-in-95 duration-150">
                        <div className="flex items-center gap-3 text-rose-600">
                            <div className="w-10 h-10 rounded-2xl bg-rose-100 dark:bg-rose-900/40 flex items-center justify-center">
                                <AlertTriangle className="w-5 h-5 text-rose-600" />
                            </div>
                            <div>
                                <h3 className="text-base font-black uppercase tracking-tight text-gray-900 dark:text-white">
                                    Delete Brand: {brandToDelete.brandName}
                                </h3>
                                <p className="text-xs text-rose-600 dark:text-rose-400 font-bold">
                                    Confirm brand deletion and handle associated data
                                </p>
                            </div>
                        </div>

                        <div className="p-3.5 bg-rose-50/50 dark:bg-rose-950/20 rounded-2xl border border-rose-100 dark:border-rose-900/40 text-xs space-y-1.5">
                            <div className="font-bold text-gray-800 dark:text-gray-200">
                                Records currently associated with "{brandToDelete.brandName}":
                            </div>
                            <ul className="list-disc list-inside text-gray-600 dark:text-gray-300 space-y-0.5">
                                <li><strong>{brandToDelete.profileCount}</strong> Profile Specification(s) / Sticker configurations</li>
                                <li><strong>{brandToDelete.inwardCount}</strong> Inward Roll Receipt(s)</li>
                                <li><strong>{brandToDelete.outwardCount}</strong> Outward / Scrap Record(s)</li>
                            </ul>
                        </div>

                        {/* Deletion Option Choice */}
                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase text-gray-400">
                                How would you like to handle associated records?
                            </label>

                            <div className="space-y-2">
                                <label className="flex items-start gap-2.5 p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 cursor-pointer text-xs">
                                    <input
                                        type="radio"
                                        name="deleteAction"
                                        checked={brandToDelete.deleteAction === 'REASSIGN'}
                                        onChange={() => setBrandToDelete({ ...brandToDelete, deleteAction: 'REASSIGN' })}
                                        className="mt-0.5 text-blue-600 focus:ring-blue-500"
                                    />
                                    <div className="flex-1">
                                        <span className="font-bold text-gray-900 dark:text-white">
                                            Reassign to another brand (Recommended)
                                        </span>
                                        <p className="text-[11px] text-gray-500 mt-0.5">
                                            Preserves your profile items and transactions under a selected brand.
                                        </p>
                                        
                                        {brandToDelete.deleteAction === 'REASSIGN' && (
                                            <div className="mt-2">
                                                <select
                                                    value={brandToDelete.reassignTarget}
                                                    onChange={(e) => setBrandToDelete({ ...brandToDelete, reassignTarget: e.target.value })}
                                                    className="w-full p-2 bg-white dark:bg-gray-800 rounded-lg text-xs font-bold border border-blue-300 dark:border-blue-700 outline-none"
                                                >
                                                    {allAvailableBrands
                                                        .filter(b => b.toLowerCase() !== brandToDelete.brandName.toLowerCase())
                                                        .map(b => (
                                                            <option key={b} value={b}>Reassign to: {b}</option>
                                                        ))
                                                    }
                                                </select>
                                            </div>
                                        )}
                                    </div>
                                </label>

                                <label className="flex items-start gap-2.5 p-3 rounded-xl border border-rose-200 dark:border-rose-900 bg-rose-50/30 dark:bg-rose-950/10 cursor-pointer text-xs">
                                    <input
                                        type="radio"
                                        name="deleteAction"
                                        checked={brandToDelete.deleteAction === 'DELETE_ALL'}
                                        onChange={() => setBrandToDelete({ ...brandToDelete, deleteAction: 'DELETE_ALL' })}
                                        className="mt-0.5 text-rose-600 focus:ring-rose-500"
                                    />
                                    <div>
                                        <span className="font-bold text-rose-700 dark:text-rose-400">
                                            Permanently delete brand and its {brandToDelete.profileCount} profile items
                                        </span>
                                        <p className="text-[11px] text-gray-500 mt-0.5">
                                            Removes the brand and deletes all protective film specifications under this brand.
                                        </p>
                                    </div>
                                </label>
                            </div>
                        </div>

                        <div className="pt-2 flex justify-end gap-2 border-t border-gray-100 dark:border-gray-700">
                            <button
                                type="button"
                                onClick={() => setBrandToDelete(null)}
                                className="px-4 py-2 text-xs font-bold text-gray-500 hover:bg-gray-100 rounded-xl"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleConfirmBrandDelete}
                                className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-md shadow-rose-900/30 flex items-center gap-1.5 cursor-pointer"
                            >
                                <Trash2 className="w-3.5 h-3.5" /> Confirm Delete Brand
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ManageBrandsModal;
