import React, { useState, useEffect, useRef } from 'react';
import { 
    X, 
    Upload, 
    FileSpreadsheet, 
    Package, 
    Layers, 
    Shuffle, 
    CheckCircle2, 
    AlertTriangle, 
    Download, 
    Building2, 
    Plus, 
    ArrowRight,
    Sparkles,
    ChevronDown
} from 'lucide-react';
import * as XLSX from 'xlsx';

export interface ParsedImportRow {
    sku: string;
    name: string;
    category: string;
    profileType: 'WINDOW' | 'REINFORCEMENT' | 'DOOR' | 'OTHER';
    uom: string;
    length: number;
    weight: number;
    meterWeight?: number;
    piecesPerPacket: number;
    price: number;
    brand: string;
    hsnCode?: string;
    topFilmWidth?: string;
    topStickerName?: string;
    bottomFilmWidth?: string;
    bottomStickerName?: string;
    openingStock?: number;
    isMerged?: boolean;
    mergedText?: string;
    mergedAlign?: 'left' | 'center' | 'right';
    mergedBg?: string;
    rawRow?: any;
}

interface ExcelImportBrandModalProps {
    isOpen: boolean;
    onClose: () => void;
    brands: string[];
    initialBrand?: string;
    initialProfileType?: 'WINDOW' | 'REINFORCEMENT' | 'AUTO';
    onConfirmImport: (data: {
        rows: ParsedImportRow[];
        targetBrand: string;
        isNewBrand: boolean;
        conflictStrategy: 'ASK' | 'REPLACE' | 'SKIP';
        syncToAllBrands?: boolean;
    }) => void;
    addToast: (message: string, type: 'success' | 'error' | 'info') => void;
}

export const ExcelImportBrandModal: React.FC<ExcelImportBrandModalProps> = ({
    isOpen,
    onClose,
    brands,
    initialBrand = 'All',
    initialProfileType = 'WINDOW',
    onConfirmImport,
    addToast
}) => {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const workbookRef = useRef<XLSX.WorkBook | null>(null);

    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [isParsing, setIsParsing] = useState(false);
    
    // Brand selection state
    const availableBrandOptions = Array.from(new Set([
        'All',
        ...(initialProfileType === 'REINFORCEMENT' || brands.includes('Reinforcement') ? ['Reinforcement'] : []),
        ...brands
    ]));

    const defaultBrand = initialBrand !== 'All' && availableBrandOptions.includes(initialBrand) 
        ? initialBrand 
        : (initialProfileType === 'REINFORCEMENT' ? 'Reinforcement' : (brands[0] || 'General'));
    
    const [selectedBrand, setSelectedBrand] = useState<string>(defaultBrand);
    const [isAddingNewBrand, setIsAddingNewBrand] = useState(false);
    const [newBrandName, setNewBrandName] = useState('');
    const [useFileBrandIfPresent, setUseFileBrandIfPresent] = useState(false);
    const [syncToAllBrands, setSyncToAllBrands] = useState<boolean>(true);

    // Profile type state
    const [profileTypeMode, setProfileTypeMode] = useState<'WINDOW' | 'REINFORCEMENT' | 'AUTO'>(initialProfileType);

    // Conflict strategy
    const [conflictStrategy, setConflictStrategy] = useState<'ASK' | 'REPLACE' | 'SKIP'>('ASK');

    // Parsed raw rows and processed rows
    const [availableSheets, setAvailableSheets] = useState<string[]>([]);
    const [activeSheetName, setActiveSheetName] = useState('');
    const [rawJsonRows, setRawJsonRows] = useState<any[]>([]);
    const [processedRows, setProcessedRows] = useState<ParsedImportRow[]>([]);
    const [fileDetectedBrands, setFileDetectedBrands] = useState<string[]>([]);

    // Reset when modal opens with new initial props
    useEffect(() => {
        if (isOpen) {
            const initialTarget = initialBrand !== 'All' && availableBrandOptions.includes(initialBrand) 
                ? initialBrand 
                : (initialProfileType === 'REINFORCEMENT' ? 'Reinforcement' : (brands[0] || 'General'));
            setSelectedBrand(initialTarget);
            setProfileTypeMode(initialProfileType);
            setIsAddingNewBrand(false);
            setNewBrandName('');
            setConflictStrategy('ASK');
        } else {
            setSelectedFile(null);
            workbookRef.current = null;
            setAvailableSheets([]);
            setActiveSheetName('');
            setRawJsonRows([]);
            setProcessedRows([]);
            setFileDetectedBrands([]);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    }, [isOpen, initialBrand, initialProfileType, brands]);

    // Intelligent sheet parser that identifies header rows even if title banner exists
    const extractJsonFromSheet = (worksheet: XLSX.WorkSheet): any[] => {
        const aoa: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
        if (!aoa || aoa.length === 0) return [];

        const headerKeywords = [
            'sku', 'code', 'profile', 'name', 'desc', 'description', 'particular',
            'spec', 'weight', 'len', 'length', 'brand', 'type', 'category', 'series',
            'hsn', 'uom', 'price', 'rate', 'pkt', 'bundle', 'sl', 'item', 'film',
            'section', 'size', 'dimension', 'dim', 'steel', 'gi', 'reinforce', 'mtr', 'meter', 'kgmtr', 'thick', 'thickness', 'standard'
        ];

        let bestHeaderIdx = 0;
        let maxKeywordMatches = 0;

        for (let r = 0; r < Math.min(aoa.length, 12); r++) {
            const row = aoa[r];
            if (!Array.isArray(row)) continue;
            let matches = 0;
            row.forEach(cell => {
                const str = String(cell || '').toLowerCase().replace(/[^a-z0-9]/g, '');
                if (headerKeywords.some(kw => str.includes(kw))) {
                    matches++;
                }
            });
            if (matches > maxKeywordMatches) {
                maxKeywordMatches = matches;
                bestHeaderIdx = r;
            }
        }

        const headerRow = aoa[bestHeaderIdx].map((c, i) => {
            const val = String(c || '').trim();
            return val || `Col_${i + 1}`;
        });

        const dataRows = aoa.slice(bestHeaderIdx + 1);
        const jsonRows: Record<string, any>[] = [];

        dataRows.forEach(row => {
            if (!Array.isArray(row)) return;
            const obj: Record<string, any> = {};
            let hasAnyData = false;
            headerRow.forEach((colName, colIdx) => {
                const cellVal = row[colIdx] !== undefined ? row[colIdx] : '';
                obj[colName] = cellVal;
                if (String(cellVal).trim() !== '') {
                    hasAnyData = true;
                }
            });
            if (hasAnyData) {
                jsonRows.push(obj);
            }
        });

        return jsonRows.length > 0 ? jsonRows : XLSX.utils.sheet_to_json(worksheet, { defval: '' });
    };

    // Parse specific sheet
    const parseSheetData = (sheetName: string, workbook: XLSX.WorkBook) => {
        const worksheet = workbook.Sheets[sheetName];
        if (!worksheet) return;

        const json = extractJsonFromSheet(worksheet);

        if (!json || json.length === 0) {
            addToast(`The selected sheet "${sheetName}" contains no data rows.`, 'error');
            setRawJsonRows([]);
            return;
        }

        // Detect unique brands present in file
        const foundBrands = new Set<string>();
        json.forEach(row => {
            for (const k of Object.keys(row)) {
                const norm = k.toLowerCase().replace(/[^a-z0-9]/g, '');
                if (norm === 'brand' || norm === 'make' || norm === 'manufacturer') {
                    const b = row[k];
                    if (b && String(b).trim() && String(b).trim().toLowerCase() !== 'all') {
                        foundBrands.add(String(b).trim());
                    }
                }
            }
        });
        const detectedBrandList = Array.from(foundBrands);
        setFileDetectedBrands(detectedBrandList);
        if (detectedBrandList.length > 0) {
            setUseFileBrandIfPresent(true);
        }

        setRawJsonRows(json);
    };

    // Parse Excel File
    const processExcelFile = (file: File) => {
        setIsParsing(true);
        setSelectedFile(file);

        const reader = new FileReader();
        reader.onload = (evt) => {
            try {
                const buffer = evt.target?.result as ArrayBuffer;
                const workbook = XLSX.read(new Uint8Array(buffer), { type: 'array' });
                workbookRef.current = workbook;

                const sheets = workbook.SheetNames || [];
                setAvailableSheets(sheets);

                if (sheets.length === 0) {
                    addToast('Excel workbook has no sheets.', 'error');
                    setIsParsing(false);
                    return;
                }

                // Choose best initial sheet
                let targetSheet = sheets[0];
                if (profileTypeMode === 'REINFORCEMENT') {
                    const reinfSheet = sheets.find(s => /reinforce|steel|gi/i.test(s));
                    if (reinfSheet) targetSheet = reinfSheet;
                } else if (profileTypeMode === 'WINDOW') {
                    const winSheet = sheets.find(s => /profile|window|catalogue|standard/i.test(s) && !/reinforce/i.test(s));
                    if (winSheet) targetSheet = winSheet;
                } else {
                    const matchedSheet = sheets.find(s => /profile|catalogue|standard|reinforce|master/i.test(s));
                    if (matchedSheet) targetSheet = matchedSheet;
                }

                setActiveSheetName(targetSheet);
                parseSheetData(targetSheet, workbook);
                setIsParsing(false);
            } catch (error) {
                console.error('Error parsing Excel:', error);
                addToast('Failed to parse Excel file. Please ensure it is a valid .xlsx, .xls, or .csv file.', 'error');
                setIsParsing(false);
            }
        };

        reader.onerror = () => {
            addToast('Error reading file from disk.', 'error');
            setIsParsing(false);
        };

        reader.readAsArrayBuffer(file);
    };

    // When user changes active sheet from dropdown
    const handleSheetChange = (sheetName: string) => {
        setActiveSheetName(sheetName);
        if (workbookRef.current) {
            parseSheetData(sheetName, workbookRef.current);
        }
    };

    // Transform raw rows whenever brand, mode, or raw data changes
    useEffect(() => {
        if (!rawJsonRows || rawJsonRows.length === 0) {
            setProcessedRows([]);
            return;
        }

        const effectiveTargetBrand = isAddingNewBrand 
            ? newBrandName.trim() 
            : selectedBrand;

        const results: ParsedImportRow[] = [];

        rawJsonRows.forEach((row, rowIdx) => {
            // Robust fuzzy getter
            const getVal = (...keyVariants: string[]) => {
                const normalizedVariants = keyVariants.map(v => v.toLowerCase().replace(/[^a-z0-9]/g, ''));
                
                // 1. Direct normalized match
                for (const k of Object.keys(row)) {
                    const normK = k.toLowerCase().replace(/[^a-z0-9]/g, '');
                    if (normalizedVariants.includes(normK)) {
                        const val = row[k];
                        if (val !== undefined && val !== null && String(val).trim() !== '') return val;
                    }
                }
                // 2. Partial match for longer identifiers
                for (const k of Object.keys(row)) {
                    const normK = k.toLowerCase().replace(/[^a-z0-9]/g, '');
                    for (const variant of normalizedVariants) {
                        if (variant.length >= 3 && normK.includes(variant)) {
                            const val = row[k];
                            if (val !== undefined && val !== null && String(val).trim() !== '') return val;
                        }
                    }
                }
                return undefined;
            };

            const isExplicitMerged = !!getVal('isMerged', 'is_merged', 'merged');
            
            // Brand resolution
            let rowBrand = effectiveTargetBrand || (profileTypeMode === 'REINFORCEMENT' ? 'Reinforcement' : 'General');
            if (useFileBrandIfPresent) {
                const fileBrand = String(getVal('brand', 'make', 'manufacturer', 'company') || '').trim();
                if (fileBrand && fileBrand.toLowerCase() !== 'all') {
                    rowBrand = fileBrand;
                }
            }

            // SKU matching across all possible reinforcement & profile variations
            let rawSku = String(getVal(
                'sku', 'codesku', 'code', 'section', 'sectioncode', 'sectionno', 'sections', 
                'size', 'dimensions', 'dimension', 'dim', 'profilesku', 'profilecode', 
                'itemcode', 'itemno', 'partno', 'partnumber', 'reinfsku', 'reinfcode', 
                'reinforcementsku', 'reinforcementcode', 'profileno', 'gisku', 'gicode', 
                'steelsku', 'steelcode', 'steelsection', 'gisection', 'reinforcement', 
                'reinf', 'profile'
            ) || '').trim();

            // Name / Description matching
            let name = String(getVal(
                'description', 'profilename', 'name', 'itemdescription', 'reinforcementprofile', 
                'profiledescription', 'reinforcementdescription', 'descriptionprofilename', 
                'sectionname', 'particulars', 'particular', 'detail', 'details', 'specification', 
                'specifications', 'material', 'steeltype', 'reinfname'
            ) || '').trim();

            // Check if row is purely an explicit section banner (e.g. starts with "---" or only 1 column filled)
            const rowValues = Object.values(row).map(v => String(v || '').trim()).filter(Boolean);
            const isBannerRow = isExplicitMerged || (rowValues.length === 1 && /^[-=*#]{2,}/.test(rowValues[0]));

            if (isBannerRow) {
                const sectionText = String(getVal('description', 'name', 'section', 'heading', 'mergedsection') || rowValues[0] || '').trim();
                if (sectionText) {
                    results.push({
                        sku: '',
                        name: sectionText,
                        category: 'Section Heading',
                        profileType: profileTypeMode === 'REINFORCEMENT' ? 'REINFORCEMENT' : 'WINDOW',
                        uom: 'Pcs',
                        length: 5.8,
                        weight: 0,
                        piecesPerPacket: 0,
                        price: 0,
                        brand: rowBrand,
                        isMerged: true,
                        mergedText: sectionText,
                        mergedAlign: 'center',
                        mergedBg: 'blue',
                        rawRow: row
                    });
                }
                return;
            }

            // Fallback for SKU if SKU column was omitted or blank
            if (!rawSku) {
                // If the name looks like a dimension code (e.g. "13X28X13", "14X30X14", "GI-25x25")
                const dimMatch = name.match(/\b\d+X\d+(?:X\d+)?(?:-\d+(?:\.\d+)?)?\b/i);
                if (dimMatch) {
                    rawSku = dimMatch[0].toUpperCase();
                } else if (profileTypeMode === 'REINFORCEMENT') {
                    rawSku = `REINF-${String(rowIdx + 1).padStart(2, '0')}`;
                } else {
                    rawSku = `PRF-${String(rowIdx + 1).padStart(2, '0')}`;
                }
            }

            if (!name) {
                name = rawSku;
            }

            // Type resolution
            let determinedType: 'WINDOW' | 'REINFORCEMENT' | 'DOOR' | 'OTHER' = 'WINDOW';
            if (profileTypeMode === 'REINFORCEMENT') {
                determinedType = 'REINFORCEMENT';
            } else if (profileTypeMode === 'WINDOW') {
                determinedType = 'WINDOW';
            } else {
                // Auto-detect
                const skuUpper = rawSku.toUpperCase();
                const nameUpper = name.toUpperCase();
                const catUpper = String(getVal('category', 'series', 'type') || '').toUpperCase();
                const brandUpper = rowBrand.toUpperCase();

                if (
                    brandUpper.includes('REINFORCE') ||
                    brandUpper.includes('STEEL') ||
                    brandUpper.includes('GI') ||
                    skuUpper.startsWith('GI') ||
                    skuUpper.startsWith('STEEL') ||
                    skuUpper.startsWith('REINF') ||
                    nameUpper.includes('REINFORCE') ||
                    nameUpper.includes('STEEL') ||
                    nameUpper.includes('GI ') ||
                    nameUpper.includes(' GI ') ||
                    nameUpper.includes('GALVANISED') ||
                    nameUpper.includes('GALVANIZED') ||
                    catUpper.includes('REINFORCE') ||
                    catUpper.includes('STEEL') ||
                    catUpper.includes('GI') ||
                    /\b\d+X\d+X\d+\b/i.test(skuUpper)
                ) {
                    determinedType = 'REINFORCEMENT';
                } else {
                    determinedType = 'WINDOW';
                }
            }

            // Dimension & weight fields
            const defaultCategory = determinedType === 'REINFORCEMENT' ? 'GI Reinforcement' : '80.5 SERIES';
            const category = String(getVal('series', 'category', 'reinforcementtype', 'steeltype', 'material') || defaultCategory).trim();
            
            // Length parsing: in reinforcement, each length could be 0 or 5.9 / 6.0
            const rawLengthVal = getVal('eachlm', 'lengthm', 'stdlengthm', 'standardlengthm', 'length', 'stdlength', 'standardlength', 'barlength', 'cutlength');
            const length = rawLengthVal !== undefined ? Number(rawLengthVal) : (determinedType === 'REINFORCEMENT' ? 0 : 5.9);

            // Meter Weight vs Length Weight extraction
            const rawMeterWeight = getVal('mtrwtkgm', 'meterweightkgm', 'meterweight', 'meterwt', 'mtrwt', 'weightkgm', 'kgm', 'kgmtr', 'weightmtr', 'density', 'unitweight', 'wtmtr', 'weightpermt', 'weightpermeter', 'kgpermeter');
            const rawLengthWeight = getVal('lenwtkg', 'lengthweightkg', 'lenwt', 'lengthweight', 'totalweight', 'barweight', 'weightkg', 'weight', 'wt', 'weightperlength');

            let finalMeterWeight: number | undefined = rawMeterWeight !== undefined ? Number(rawMeterWeight) : undefined;
            let finalWeight: number = rawLengthWeight !== undefined ? Number(rawLengthWeight) : 0;

            if (finalMeterWeight === undefined || isNaN(finalMeterWeight)) {
                if (length > 0 && finalWeight > 0) {
                    finalMeterWeight = Number((finalWeight / length).toFixed(3));
                } else if (determinedType === 'REINFORCEMENT' && finalWeight > 0 && length === 0) {
                    // For reinforcement where length is 0, weight in table is often the meter weight itself
                    finalMeterWeight = finalWeight;
                } else {
                    finalMeterWeight = undefined;
                }
            }

            if (finalWeight === 0 && finalMeterWeight) {
                if (length > 0) {
                    finalWeight = Number((finalMeterWeight * length).toFixed(3));
                } else {
                    finalWeight = finalMeterWeight;
                }
            }

            // Pieces per packet / bundle
            const piecesPerPacket = Number(getVal('lpkt', 'piecespacket', 'piecesperpacket', 'lengthsperpacket', 'lengthspkt', 'pcsbundle', 'pcspkt', 'bundleqty', 'pktqty', 'pieces') || (determinedType === 'REINFORCEMENT' ? 1 : 6));
            
            // UOM
            const uom = String(getVal('uom', 'unit', 'unitofmeasure') || (determinedType === 'REINFORCEMENT' ? 'Pcs' : 'Pcs')).trim();

            // Protective films (only relevant for window/door profiles)
            const topFilmWidth = String(getVal('topfilmwidth', 'toprightfilm', 'topfilm', 'topwidth') || (determinedType === 'REINFORCEMENT' ? '' : '38'));
            const topStickerName = String(getVal('topstickername', 'topsticker', 'topfilmname') || '');
            const bottomFilmWidth = String(getVal('bottomfilmwidth', 'bottomleftfilm', 'bottomfilm', 'bottomwidth') || (determinedType === 'REINFORCEMENT' ? '' : '38'));
            const bottomStickerName = String(getVal('bottomstickername', 'bottomsticker', 'bottomfilmname') || '');
            
            // Commercial fields
            const price = Number(getVal('price', 'pricepkt', 'rate', 'ratekg', 'priceinr', 'unitprice', 'cost') || (determinedType === 'REINFORCEMENT' ? 95 : 150));
            const hsnCode = String(getVal('hsn', 'hsncode', 'hsnno') || (determinedType === 'REINFORCEMENT' ? '72169910' : '39162099'));
            const openingStock = Number(getVal('minstock', 'reorderpoint', 'openingstock', 'stock', 'quantity', 'currentstock', 'balance', 'qty') || 0);

            results.push({
                sku: rawSku,
                name,
                category,
                profileType: determinedType,
                uom,
                length,
                weight: finalWeight,
                meterWeight: finalMeterWeight,
                piecesPerPacket,
                price,
                brand: rowBrand,
                hsnCode,
                topFilmWidth,
                topStickerName,
                bottomFilmWidth,
                bottomStickerName,
                openingStock,
                isMerged: false,
                rawRow: row
            });
        });

        setProcessedRows(results);
    }, [rawJsonRows, selectedBrand, isAddingNewBrand, newBrandName, useFileBrandIfPresent, profileTypeMode]);

    // Handle Drag & Drop
    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = () => {
        setIsDragging(false);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        const file = e.dataTransfer.files?.[0];
        if (file) {
            processExcelFile(file);
        }
    };

    // Download sample templates
    const handleDownloadTemplate = (type: 'WINDOW' | 'REINFORCEMENT') => {
        try {
            const wb = XLSX.utils.book_new();
            if (type === 'WINDOW') {
                const wsData = [
                    ['Code (SKU)', 'Description / Profile Name', 'Brand', 'Category', 'Each L. (m)', 'Len Wt (kg)', 'Mtr Wt (kg/m)', 'L/Pkt', 'Top Film Width', 'Bottom Film Width', 'Min Stock', 'HSN'],
                    ['W-FRAME-60', 'Outer Sliding Frame 60mm', selectedBrand || 'Prominance', '60 Series', 5.9, 6.785, 1.15, 6, '38', '38', 120, '39162099'],
                    ['W-SASH-60', 'Sliding Window Sash 60mm', selectedBrand || 'Prominance', '60 Series', 5.9, 5.782, 0.98, 8, '38', '38', 90, '39162099'],
                    ['W-BEAD-60', 'Glazing Bead Single Glass', selectedBrand || 'Prominance', '60 Series', 5.9, 1.888, 0.32, 20, '', '', 300, '39162099']
                ];
                const ws = XLSX.utils.aoa_to_sheet(wsData);
                XLSX.utils.book_append_sheet(wb, ws, 'Profiles');
                XLSX.writeFile(wb, `Template_Window_Profiles_${selectedBrand || 'Standard'}.xlsx`);
                addToast('Downloaded Window Profiles template!', 'success');
            } else {
                const wsData = [
                    ['Code (SKU)', 'Description / Profile Name', 'HSN', 'Brand', 'UOM', 'Each L. (m)', 'L/Pkt', 'Len Wt (kg)', 'Mtr Wt (kg/m)', 'Min Stock', 'Price (₹)'],
                    ['13X28X13', 'GALVANISED PLAIN/STEEL (80.SERIES)', '72169910', selectedBrand || 'Reinforcement', 'Pcs', 0, 0, 2.139, 0.897, 100, 95],
                    ['14X30X14', 'GALVANISED PLAIN/STEEL (2 TRACK)', '72169910', selectedBrand || 'Reinforcement', 'Pcs', 0, 0, 2.319, 0.897, 100, 95],
                    ['16X20X16', 'GALVANISED PLAIN/STEEL (MESH)', '72169910', selectedBrand || 'Reinforcement', 'Pcs', 0, 0, 2.135, 0.897, 80, 95],
                    ['14X30X14-2.5', 'GALVANISED PLAIN/STEEL (2.5 TRACK)', '72169910', selectedBrand || 'Reinforcement', 'Pcs', 0, 0, 2.319, 0.897, 100, 95],
                    ['17X30X17', 'GALVANISED PLAIN/STEEL (SMALL SASH)', '72169910', selectedBrand || 'Reinforcement', 'Pcs', 0, 0, 2.579, 0.897, 120, 95],
                    ['28X28X28', 'GALVANISED PLAIN/STEEL (BIG SASH 84)', '72169910', selectedBrand || 'Reinforcement', 'Pcs', 0, 0, 3.158, 0.897, 150, 95]
                ];
                const ws = XLSX.utils.aoa_to_sheet(wsData);
                XLSX.utils.book_append_sheet(wb, ws, 'Reinforcements');
                XLSX.writeFile(wb, 'Template_Reinforcement_Profiles.xlsx');
                addToast('Downloaded Reinforcement Profiles template matching system columns!', 'success');
            }
        } catch (err) {
            console.error(err);
            addToast('Failed to download template', 'error');
        }
    };

    // Execute Import
    const handleConfirm = () => {
        const effectiveBrand = isAddingNewBrand ? newBrandName.trim() : selectedBrand;
        if (!effectiveBrand) {
            addToast('Please select or enter a valid Brand before importing.', 'error');
            return;
        }

        if (processedRows.length === 0) {
            addToast('No profile rows found to import. Please upload a valid file first.', 'error');
            return;
        }

        onConfirmImport({
            rows: processedRows,
            targetBrand: effectiveBrand,
            isNewBrand: isAddingNewBrand && !brands.includes(effectiveBrand),
            conflictStrategy,
            syncToAllBrands: syncToAllBrands || effectiveBrand === 'All'
        });

        onClose();
    };

    if (!isOpen) return null;

    const effectiveBrandDisplay = isAddingNewBrand ? (newBrandName.trim() || 'New Brand') : selectedBrand;

    return (
        <div 
            className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 overflow-y-auto"
            onClick={onClose}
        >
            <div 
                className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-200"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className={`p-6 text-white flex items-center justify-between ${
                    profileTypeMode === 'REINFORCEMENT' 
                        ? 'bg-gradient-to-r from-orange-600 to-amber-700' 
                        : 'bg-gradient-to-r from-emerald-600 to-teal-700'
                }`}>
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-white/10 rounded-2xl backdrop-blur-md">
                            <FileSpreadsheet className="w-6 h-6 text-white" />
                        </div>
                        <div>
                            <h3 className="text-xl font-black uppercase tracking-tight flex items-center gap-2">
                                Import Excel Catalogue
                                {profileTypeMode === 'REINFORCEMENT' && (
                                    <span className="px-2 py-0.5 bg-white/20 text-white rounded-md text-[10px] font-black uppercase tracking-widest border border-white/30">
                                        Reinforcement
                                    </span>
                                )}
                            </h3>
                            <p className="text-white/80 text-xs font-medium">
                                Select target brand and profile category to import spreadsheet records
                            </p>
                        </div>
                    </div>
                    <button 
                        onClick={onClose}
                        className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-xl transition-all cursor-pointer"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
                    {/* STEP 1: BRAND SELECTION */}
                    <div className="bg-gray-50 dark:bg-gray-800/60 p-4 rounded-2xl border border-gray-200 dark:border-gray-700 space-y-3">
                        <div className="flex items-center justify-between">
                            <label className="text-xs font-black uppercase tracking-wider text-gray-700 dark:text-gray-200 flex items-center gap-2">
                                <Building2 className={`w-4 h-4 ${profileTypeMode === 'REINFORCEMENT' ? 'text-orange-600 dark:text-orange-400' : 'text-emerald-600 dark:text-emerald-400'}`} />
                                1. Which brand should this catalogue be imported into?
                            </label>
                            <button
                                type="button"
                                onClick={() => setIsAddingNewBrand(!isAddingNewBrand)}
                                className={`text-[11px] font-bold hover:underline flex items-center gap-1 cursor-pointer ${
                                    profileTypeMode === 'REINFORCEMENT' ? 'text-orange-600 dark:text-orange-400' : 'text-emerald-600 dark:text-emerald-400'
                                }`}
                            >
                                {isAddingNewBrand ? 'Choose Existing Brand' : '+ Add New Brand'}
                            </button>
                        </div>

                        {isAddingNewBrand ? (
                            <div className="flex items-center gap-2">
                                <input
                                    type="text"
                                    placeholder="Enter new brand name (e.g. Prominance, SC, Reinforcement)..."
                                    value={newBrandName}
                                    onChange={(e) => setNewBrandName(e.target.value)}
                                    className="flex-1 px-3.5 py-2.5 bg-white dark:bg-gray-900 border border-emerald-500 rounded-xl text-sm font-bold text-gray-900 dark:text-white outline-none ring-2 ring-emerald-500/20"
                                    autoFocus
                                />
                                <button
                                    type="button"
                                    onClick={() => {
                                        if (newBrandName.trim()) {
                                            setSelectedBrand(newBrandName.trim());
                                        }
                                        setIsAddingNewBrand(false);
                                    }}
                                    className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black uppercase cursor-pointer"
                                >
                                    Set
                                </button>
                            </div>
                        ) : (
                            <select
                                value={selectedBrand}
                                onChange={(e) => {
                                    if (e.target.value === '__NEW__') {
                                        setIsAddingNewBrand(true);
                                    } else {
                                        setSelectedBrand(e.target.value);
                                    }
                                }}
                                className="w-full px-3.5 py-2.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-bold text-gray-900 dark:text-white outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                            >
                                {availableBrandOptions.map(b => (
                                    <option key={b} value={b}>
                                        {b === 'All' ? '🌐 All Brands (Universal Sync Across All Tabs)' : `Brand: ${b}`}
                                    </option>
                                ))}
                                <option value="__NEW__">+ Create New Brand...</option>
                            </select>
                        )}

                        {fileDetectedBrands.length > 0 && (
                            <div className="pt-1 flex items-center justify-between text-[11px] bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 p-2.5 rounded-xl">
                                <span className="text-emerald-800 dark:text-emerald-300 font-medium">
                                    💡 File contains brand column with: <strong className="font-bold">{fileDetectedBrands.join(', ')}</strong>
                                </span>
                                <label className="flex items-center gap-1.5 cursor-pointer font-bold text-emerald-900 dark:text-emerald-200">
                                    <input 
                                        type="checkbox" 
                                        checked={useFileBrandIfPresent}
                                        onChange={(e) => setUseFileBrandIfPresent(e.target.checked)}
                                        className="w-3.5 h-3.5 rounded text-emerald-600 focus:ring-emerald-500"
                                    />
                                    Keep file brands
                                </label>
                            </div>
                        )}
                    </div>

                    {/* STEP 2: PROFILE CATEGORY / TYPE */}
                    <div className="space-y-2">
                        <label className="text-xs font-black uppercase tracking-wider text-gray-700 dark:text-gray-200 flex items-center gap-2">
                            <Layers className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                            2. Catalogue Profile Type
                        </label>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                            <button
                                type="button"
                                onClick={() => setProfileTypeMode('WINDOW')}
                                className={`p-3 rounded-2xl border text-left transition-all flex flex-col gap-1 cursor-pointer ${
                                    profileTypeMode === 'WINDOW'
                                        ? 'bg-blue-50 dark:bg-blue-950/40 border-blue-500 text-blue-700 dark:text-blue-300 ring-2 ring-blue-500/20'
                                        : 'bg-white dark:bg-gray-800/40 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-300'
                                }`}
                            >
                                <div className="flex items-center gap-2 font-bold text-xs">
                                    <Package className="w-4 h-4" />
                                    <span>Window & Door</span>
                                </div>
                                <span className="text-[10px] text-gray-500 dark:text-gray-400">
                                    Standard profiles with protective films
                                </span>
                            </button>

                            <button
                                type="button"
                                onClick={() => {
                                    setProfileTypeMode('REINFORCEMENT');
                                    if (availableBrandOptions.includes('Reinforcement') && !isAddingNewBrand) {
                                        setSelectedBrand('Reinforcement');
                                    }
                                    setSyncToAllBrands(true);
                                }}
                                className={`p-3 rounded-2xl border text-left transition-all flex flex-col gap-1 cursor-pointer ${
                                    profileTypeMode === 'REINFORCEMENT'
                                        ? 'bg-orange-50 dark:bg-orange-950/40 border-orange-500 text-orange-700 dark:text-orange-300 ring-2 ring-orange-500/20'
                                        : 'bg-white dark:bg-gray-800/40 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-300'
                                }`}
                            >
                                <div className="flex items-center gap-2 font-bold text-xs">
                                    <Layers className="w-4 h-4" />
                                    <span>Reinforcement</span>
                                </div>
                                <span className="text-[10px] text-gray-500 dark:text-gray-400">
                                    GI & steel reinforcement bars
                                </span>
                            </button>

                            <button
                                type="button"
                                onClick={() => setProfileTypeMode('AUTO')}
                                className={`p-3 rounded-2xl border text-left transition-all flex flex-col gap-1 cursor-pointer ${
                                    profileTypeMode === 'AUTO'
                                        ? 'bg-purple-50 dark:bg-purple-950/40 border-purple-500 text-purple-700 dark:text-purple-300 ring-2 ring-purple-500/20'
                                        : 'bg-white dark:bg-gray-800/40 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-300'
                                }`}
                            >
                                <div className="flex items-center gap-2 font-bold text-xs">
                                    <Shuffle className="w-4 h-4" />
                                    <span>Auto-Detect</span>
                                </div>
                                <span className="text-[10px] text-gray-500 dark:text-gray-400">
                                    Detect based on SKU & sheet contents
                                </span>
                            </button>
                        </div>
                    </div>

                    {/* FULL SYNC & AUTO-SAVE TOGGLE */}
                    <div className="p-3.5 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 border border-blue-200 dark:border-blue-800 rounded-2xl flex items-start gap-3">
                        <input
                            type="checkbox"
                            id="syncAllTabsToggle"
                            checked={syncToAllBrands}
                            onChange={e => setSyncToAllBrands(e.target.checked)}
                            className="w-4 h-4 mt-0.5 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                        />
                        <label htmlFor="syncAllTabsToggle" className="cursor-pointer text-xs space-y-0.5">
                            <div className="font-black text-indigo-950 dark:text-indigo-200 flex items-center gap-1.5">
                                <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                                <span>Place in All Tabs & All Brands (Auto-Save & Full Sync)</span>
                            </div>
                            <p className="text-slate-600 dark:text-slate-400 text-[11px] leading-relaxed">
                                Automatically place rows into standard catalogue across all brands and tabs, synchronize reinforcement stock inventory, and save changes immediately.
                            </p>
                        </label>
                    </div>

                    {/* STEP 3: FILE UPLOAD ZONE */}
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <label className="text-xs font-black uppercase tracking-wider text-gray-700 dark:text-gray-200 flex items-center gap-2">
                                <FileSpreadsheet className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                                3. Select Spreadsheet File
                            </label>
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => handleDownloadTemplate(profileTypeMode === 'REINFORCEMENT' ? 'REINFORCEMENT' : 'WINDOW')}
                                    className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1 cursor-pointer"
                                    title="Download pre-formatted Excel template"
                                >
                                    <Download className="w-3.5 h-3.5" />
                                    <span>Download {profileTypeMode === 'REINFORCEMENT' ? 'Reinforcement' : 'Window'} Template</span>
                                </button>
                            </div>
                        </div>

                        <input 
                            ref={fileInputRef}
                            type="file" 
                            accept=".xlsx, .xls, .csv" 
                            className="hidden" 
                            onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) processExcelFile(file);
                            }}
                        />

                        {!selectedFile ? (
                            <div 
                                onDragOver={handleDragOver}
                                onDragLeave={handleDragLeave}
                                onDrop={handleDrop}
                                onClick={() => fileInputRef.current?.click()}
                                className={`border-2 border-dashed rounded-3xl p-8 text-center cursor-pointer transition-all ${
                                    isDragging 
                                        ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20 scale-[0.99]' 
                                        : 'border-gray-200 dark:border-gray-700 hover:border-emerald-400 dark:hover:border-emerald-500 hover:bg-gray-50 dark:hover:bg-gray-800/40'
                                }`}
                            >
                                <div className={`w-12 h-12 mx-auto mb-3 rounded-2xl flex items-center justify-center ${
                                    profileTypeMode === 'REINFORCEMENT' 
                                        ? 'bg-orange-100 dark:bg-orange-900/40 text-orange-600 dark:text-orange-400' 
                                        : 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400'
                                }`}>
                                    <Upload className="w-6 h-6" />
                                </div>
                                <h4 className="text-sm font-bold text-gray-900 dark:text-white">
                                    Click or Drag & Drop Excel File Here
                                </h4>
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                    Supports .xlsx, .xls, and .csv master profile & reinforcement spreadsheets
                                </p>
                            </div>
                        ) : (
                            <div className="bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-2xl p-4 space-y-3">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className={`p-2 rounded-xl text-white ${
                                            profileTypeMode === 'REINFORCEMENT' ? 'bg-orange-600' : 'bg-emerald-600'
                                        }`}>
                                            <FileSpreadsheet className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <div className="text-xs font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                                <span>{selectedFile.name}</span>
                                            </div>
                                            <div className="text-[11px] text-emerald-700 dark:text-emerald-400 mt-0.5">
                                                {isParsing ? 'Parsing contents...' : `✓ ${processedRows.length} total rows parsed (${processedRows.filter(r => !r.isMerged).length} active items, ${processedRows.filter(r => r.isMerged).length} section headings)`}
                                            </div>
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => fileInputRef.current?.click()}
                                        className="px-3 py-1.5 text-xs font-bold bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded-xl hover:bg-gray-100 transition-all cursor-pointer"
                                    >
                                        Change File
                                    </button>
                                </div>

                                {/* Multi-sheet dropdown switcher */}
                                {availableSheets.length > 1 && (
                                    <div className="pt-2 border-t border-emerald-200 dark:border-emerald-800/60 flex items-center justify-between gap-3">
                                        <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-900 dark:text-emerald-200">
                                            <Layers className="w-3.5 h-3.5" />
                                            <span>Sheet to Import:</span>
                                        </div>
                                        <select
                                            value={activeSheetName}
                                            onChange={(e) => handleSheetChange(e.target.value)}
                                            className="px-3 py-1.5 text-xs font-bold bg-white dark:bg-gray-800 border border-emerald-300 dark:border-emerald-700 rounded-xl text-emerald-900 dark:text-emerald-100 outline-none focus:ring-2 focus:ring-emerald-500/30 cursor-pointer"
                                        >
                                            {availableSheets.map(s => (
                                                <option key={s} value={s}>
                                                    {s} {/reinforce/i.test(s) ? '★ (Reinforcements)' : ''}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* PREVIEW OF PARSED ITEMS */}
                    {processedRows.length > 0 && (
                        <div className="space-y-2">
                            <div className="flex items-center justify-between text-xs font-bold text-gray-600 dark:text-gray-400">
                                <span>Preview of Parsed Items ({Math.min(processedRows.length, 5)} of {processedRows.length}):</span>
                                <span className="text-[11px] text-emerald-600 dark:text-emerald-400">
                                    Target Brand: <strong className="font-black">{effectiveBrandDisplay}</strong>
                                </span>
                            </div>
                            <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
                                <table className="w-full text-left text-[11px]">
                                    <thead className="bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 font-bold uppercase text-[9px]">
                                        <tr>
                                            <th className="p-2">Code (SKU)</th>
                                            <th className="p-2">Name / Description</th>
                                            <th className="p-2">Brand</th>
                                            <th className="p-2">Type</th>
                                            <th className="p-2 text-right">Length</th>
                                            <th className="p-2 text-right">Len Wt</th>
                                            <th className="p-2 text-right">Mtr Wt</th>
                                            <th className="p-2 text-center">Pcs/Pkt</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                                        {processedRows.slice(0, 5).map((r, i) => (
                                            <tr key={i} className={r.isMerged ? 'bg-blue-50/50 dark:bg-blue-900/20' : ''}>
                                                <td className="p-2 font-mono font-bold text-gray-900 dark:text-gray-100">
                                                    {r.isMerged ? '[Section Heading]' : r.sku}
                                                </td>
                                                <td className="p-2 text-gray-700 dark:text-gray-300 truncate max-w-[180px]">
                                                    {r.name}
                                                </td>
                                                <td className="p-2 text-emerald-600 dark:text-emerald-400 font-bold">
                                                    {r.brand}
                                                </td>
                                                <td className="p-2">
                                                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                                                        r.profileType === 'REINFORCEMENT' 
                                                            ? 'bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300' 
                                                            : 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300'
                                                    }`}>
                                                        {r.profileType}
                                                    </span>
                                                </td>
                                                <td className="p-2 text-right font-mono">{r.length > 0 ? `${r.length}m` : '-'}</td>
                                                <td className="p-2 text-right font-mono">{r.weight > 0 ? `${r.weight} kg` : '-'}</td>
                                                <td className="p-2 text-right font-mono">{r.meterWeight ? `${r.meterWeight} kg/m` : '-'}</td>
                                                <td className="p-2 text-center font-mono">{r.piecesPerPacket}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* CONFLICT HANDLING STRATEGY */}
                    <div className="bg-gray-50 dark:bg-gray-800/40 p-3.5 rounded-2xl border border-gray-200 dark:border-gray-700 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                        <div className="text-gray-700 dark:text-gray-300 font-medium">
                            If duplicate SKU matches an existing profile for brand:
                        </div>
                        <div className="flex items-center gap-2">
                            <label className="flex items-center gap-1.5 cursor-pointer text-xs font-bold text-gray-700 dark:text-gray-300">
                                <input 
                                    type="radio" 
                                    name="conflict" 
                                    checked={conflictStrategy === 'ASK'}
                                    onChange={() => setConflictStrategy('ASK')}
                                    className="text-emerald-600 focus:ring-emerald-500"
                                />
                                Ask / Review
                            </label>
                            <label className="flex items-center gap-1.5 cursor-pointer text-xs font-bold text-gray-700 dark:text-gray-300">
                                <input 
                                    type="radio" 
                                    name="conflict" 
                                    checked={conflictStrategy === 'REPLACE'}
                                    onChange={() => setConflictStrategy('REPLACE')}
                                    className="text-emerald-600 focus:ring-emerald-500"
                                />
                                Auto-Replace
                            </label>
                            <label className="flex items-center gap-1.5 cursor-pointer text-xs font-bold text-gray-700 dark:text-gray-300">
                                <input 
                                    type="radio" 
                                    name="conflict" 
                                    checked={conflictStrategy === 'SKIP'}
                                    onChange={() => setConflictStrategy('SKIP')}
                                    className="text-emerald-600 focus:ring-emerald-500"
                                />
                                Skip Existing
                            </label>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-6 bg-gray-50 dark:bg-gray-800/80 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between gap-3">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-5 py-3 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 font-bold text-xs uppercase tracking-wider hover:bg-gray-100 transition-all cursor-pointer"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        disabled={!selectedFile || processedRows.length === 0 || isParsing || !effectiveBrandDisplay}
                        onClick={handleConfirm}
                        className={`px-6 py-3 disabled:opacity-40 disabled:cursor-not-allowed text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-lg active:scale-95 transition-all flex items-center gap-2 cursor-pointer ${
                            profileTypeMode === 'REINFORCEMENT'
                                ? 'bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 shadow-orange-600/20'
                                : 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 shadow-emerald-600/20'
                        }`}
                    >
                        <Sparkles className="w-4 h-4" />
                        <span>
                            Import {processedRows.length > 0 ? `${processedRows.length} Items` : 'Catalogue'} into {effectiveBrandDisplay}
                        </span>
                    </button>
                </div>
            </div>
        </div>
    );
};
