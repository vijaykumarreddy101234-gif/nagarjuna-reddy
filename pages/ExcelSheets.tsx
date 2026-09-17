import React, { useState, useRef, useEffect, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { 
    FileSpreadsheet, 
    Upload, 
    Download, 
    Plus, 
    Trash2, 
    Bold, 
    Italic, 
    AlignLeft, 
    AlignCenter, 
    AlignRight, 
    RefreshCw, 
    Check, 
    Grid,
    Calculator,
    FileText,
    Database,
    Sparkles
} from 'lucide-react';
import { useStore } from '../store/useStore';
import type { ToastMessage } from '../types';

interface ExcelSheetsProps {
    addToast?: (message: string, type?: ToastMessage['type']) => void;
}

interface CellData {
    value: string;
    bold?: boolean;
    italic?: boolean;
    color?: string;
    bgColor?: string;
    align?: 'left' | 'center' | 'right';
}

const COLS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z'];
const ROWS = Array.from({ length: 50 }, (_, i) => i + 1);

const ExcelSheets = ({ addToast }) => {
    const store = useStore();
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Sheets state: sheetName -> { "A1": { value, bold, ... } }
    const [sheets, setSheets] = useState<Record<string, Record<string, CellData>>>({
        'Sheet1': {
            'A1': { value: 'Item Code', bold: true, bgColor: '#1e293b', color: '#ffffff' },
            'B1': { value: 'Description', bold: true, bgColor: '#1e293b', color: '#ffffff' },
            'C1': { value: 'Quantity', bold: true, bgColor: '#1e293b', color: '#ffffff' },
            'D1': { value: 'Unit Price', bold: true, bgColor: '#1e293b', color: '#ffffff' },
            'E1': { value: 'Total Value', bold: true, bgColor: '#1e293b', color: '#ffffff' },
            'A2': { value: 'SKU-001' },
            'B2': { value: 'uPVC Window Profile 60mm' },
            'C2': { value: '150' },
            'D2': { value: '450' },
            'E2': { value: '=C2*D2' },
            'A3': { value: 'SKU-002' },
            'B3': { value: 'Galvanized Reinforcement' },
            'C3': { value: '300' },
            'D3': { value: '180' },
            'E3': { value: '=C3*D3' },
            'A4': { value: 'Total Inventory' },
            'E4': { value: '=SUM(E2:E3)', bold: true }
        },
        'Inventory Stock': {},
        'Inflow Log': {}
    });

    const [activeSheet, setActiveSheet] = useState('Sheet1');
    const [selectedCell, setSelectedCell] = useState<string>('A1');
    const [cellInput, setCellInput] = useState<string>('');
    const [isEditingInline, setIsEditingInline] = useState(false);
    const [newSheetName, setNewSheetName] = useState('');
    const [showNewSheetModal, setShowNewSheetModal] = useState(false);

    // Right-click context menu state
    const [contextMenu, setContextMenu] = useState<{ x: number; y: number; cellKey: string } | null>(null);
    const [copiedCellData, setCopiedCellData] = useState<CellData | null>(null);

    // Close context menu on click outside
    useEffect(() => {
        const handleClickOutside = () => setContextMenu(null);
        window.addEventListener('click', handleClickOutside);
        return () => window.removeEventListener('click', handleClickOutside);
    }, []);

    // Keyboard navigation & shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            const activeEl = document.activeElement;
            const isInputActive = activeEl?.tagName === 'INPUT' || activeEl?.tagName === 'TEXTAREA';

            const col = selectedCell.replace(/[0-9]/g, '');
            const row = parseInt(selectedCell.replace(/[A-Z]/g, ''), 10);
            const colIdx = COLS.indexOf(col);

            if (e.key === 'Delete' || e.key === 'Backspace') {
                if (!isInputActive) {
                    e.preventDefault();
                    handleClearCell();
                }
            } else if (!isInputActive) {
                if (e.key === 'ArrowUp' && row > 1) {
                    e.preventDefault();
                    setSelectedCell(`${col}${row - 1}`);
                    setIsEditingInline(false);
                } else if (e.key === 'ArrowDown' && row < 50) {
                    e.preventDefault();
                    setSelectedCell(`${col}${row + 1}`);
                    setIsEditingInline(false);
                } else if (e.key === 'ArrowLeft' && colIdx > 0) {
                    e.preventDefault();
                    setSelectedCell(`${COLS[colIdx - 1]}${row}`);
                    setIsEditingInline(false);
                } else if (e.key === 'ArrowRight' && colIdx < COLS.length - 1) {
                    e.preventDefault();
                    setSelectedCell(`${COLS[colIdx + 1]}${row}`);
                    setIsEditingInline(false);
                } else if (e.key === 'Enter') {
                    e.preventDefault();
                    if (isEditingInline) {
                        setIsEditingInline(false);
                        if (row < 50) setSelectedCell(`${col}${row + 1}`);
                    } else {
                        setIsEditingInline(true);
                    }
                } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
                    e.preventDefault();
                    handleCellInputChange(e.key);
                    setIsEditingInline(true);
                }
            } else if (isInputActive && e.key === 'Enter') {
                setIsEditingInline(false);
                (activeEl as HTMLElement)?.blur();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [selectedCell, activeSheet, sheets, isEditingInline]);

    // Sync input when selected cell changes
    useEffect(() => {
        const currentSheetData = sheets[activeSheet] || {};
        const cell = currentSheetData[selectedCell];
        setCellInput(cell ? cell.value : '');
        setIsEditingInline(false);
    }, [selectedCell, activeSheet]);

    // Update active cell value
    const handleCellInputChange = (val: string) => {
        setCellInput(val);
        setSheets(prev => ({
            ...prev,
            [activeSheet]: {
                ...(prev[activeSheet] || {}),
                [selectedCell]: {
                    ...(prev[activeSheet]?.[selectedCell] || { value: '' }),
                    value: val
                }
            }
        }));
    };

    // Format helpers
    const toggleStyle = (styleKey: 'bold' | 'italic') => {
        setSheets(prev => {
            const currentCell = prev[activeSheet]?.[selectedCell] || { value: '' };
            return {
                ...prev,
                [activeSheet]: {
                    ...(prev[activeSheet] || {}),
                    [selectedCell]: {
                        ...currentCell,
                        [styleKey]: !currentCell[styleKey]
                    }
                }
            };
        });
    };

    const setAlignment = (align: 'left' | 'center' | 'right') => {
        setSheets(prev => {
            const currentCell = prev[activeSheet]?.[selectedCell] || { value: '' };
            return {
                ...prev,
                [activeSheet]: {
                    ...(prev[activeSheet] || {}),
                    [selectedCell]: {
                        ...currentCell,
                        align
                    }
                }
            };
        });
    };

    const setBgColor = (bgColor: string) => {
        setSheets(prev => {
            const currentCell = prev[activeSheet]?.[selectedCell] || { value: '' };
            return {
                ...prev,
                [activeSheet]: {
                    ...(prev[activeSheet] || {}),
                    [selectedCell]: {
                        ...currentCell,
                        bgColor
                    }
                }
            };
        });
    };

    // Insert Row
    const handleAddRow = () => {
        const selectedRow = parseInt(selectedCell.replace(/[A-Z]/g, ''), 10);
        if (isNaN(selectedRow)) return;

        setSheets(prev => {
            const sheetData = prev[activeSheet] || {};
            const updatedSheet: Record<string, CellData> = {};

            Object.entries(sheetData).forEach(([key, cell]) => {
                const col = key.replace(/[0-9]/g, '');
                const row = parseInt(key.replace(/[A-Z]/g, ''), 10);
                if (row > selectedRow) {
                    updatedSheet[`${col}${row + 1}`] = cell;
                } else {
                    updatedSheet[key] = cell;
                }
            });

            return {
                ...prev,
                [activeSheet]: updatedSheet
            };
        });
        if (addToast) addToast(`Inserted row below row ${selectedRow}`, 'success');
    };

    // Delete Row
    const handleDeleteRow = () => {
        const selectedRow = parseInt(selectedCell.replace(/[A-Z]/g, ''), 10);
        if (isNaN(selectedRow)) return;

        setSheets(prev => {
            const sheetData = prev[activeSheet] || {};
            const updatedSheet: Record<string, CellData> = {};

            Object.entries(sheetData).forEach(([key, cell]) => {
                const col = key.replace(/[0-9]/g, '');
                const row = parseInt(key.replace(/[A-Z]/g, ''), 10);
                if (row === selectedRow) {
                    // skip (delete)
                } else if (row > selectedRow) {
                    updatedSheet[`${col}${row - 1}`] = cell;
                } else {
                    updatedSheet[key] = cell;
                }
            });

            return {
                ...prev,
                [activeSheet]: updatedSheet
            };
        });
        if (addToast) addToast(`Deleted row ${selectedRow}`, 'info');
    };

    // Insert Column
    const handleAddColumn = () => {
        const selectedCol = selectedCell.replace(/[0-9]/g, '');
        const colIdx = COLS.indexOf(selectedCol);
        if (colIdx === -1) return;

        setSheets(prev => {
            const sheetData = prev[activeSheet] || {};
            const updatedSheet: Record<string, CellData> = {};

            Object.entries(sheetData).forEach(([key, cell]) => {
                const col = key.replace(/[0-9]/g, '');
                const row = key.replace(/[A-Z]/g, '');
                const cIdx = COLS.indexOf(col);

                if (cIdx > colIdx) {
                    const newCol = COLS[cIdx + 1];
                    if (newCol) {
                        updatedSheet[`${newCol}${row}`] = cell;
                    }
                } else {
                    updatedSheet[key] = cell;
                }
            });

            return {
                ...prev,
                [activeSheet]: updatedSheet
            };
        });
        if (addToast) addToast(`Inserted column right of ${selectedCol}`, 'success');
    };

    // Delete Column
    const handleDeleteColumn = () => {
        const selectedCol = selectedCell.replace(/[0-9]/g, '');
        const colIdx = COLS.indexOf(selectedCol);
        if (colIdx === -1) return;

        setSheets(prev => {
            const sheetData = prev[activeSheet] || {};
            const updatedSheet: Record<string, CellData> = {};

            Object.entries(sheetData).forEach(([key, cell]) => {
                const col = key.replace(/[0-9]/g, '');
                const row = key.replace(/[A-Z]/g, '');
                const cIdx = COLS.indexOf(col);

                if (cIdx === colIdx) {
                    // skip (delete)
                } else if (cIdx > colIdx) {
                    const newCol = COLS[cIdx - 1];
                    if (newCol) {
                        updatedSheet[`${newCol}${row}`] = cell;
                    }
                } else {
                    updatedSheet[key] = cell;
                }
            });

            return {
                ...prev,
                [activeSheet]: updatedSheet
            };
        });
        if (addToast) addToast(`Deleted column ${selectedCol}`, 'info');
    };

    // Clear Cell
    const handleClearCell = () => {
        setSheets(prev => {
            const sheetData = { ...(prev[activeSheet] || {}) };
            delete sheetData[selectedCell];
            return {
                ...prev,
                [activeSheet]: sheetData
            };
        });
        setCellInput('');
        if (addToast) addToast(`Cleared cell ${selectedCell}`, 'info');
    };

    // Copy Cell
    const handleCopyCell = () => {
        const cellData = sheets[activeSheet]?.[selectedCell];
        setCopiedCellData(cellData ? { ...cellData } : { value: '' });
        if (addToast) addToast(`Copied cell ${selectedCell}`, 'info');
        setContextMenu(null);
    };

    // Cut Cell
    const handleCutCell = () => {
        const cellData = sheets[activeSheet]?.[selectedCell];
        setCopiedCellData(cellData ? { ...cellData } : { value: '' });
        handleClearCell();
        if (addToast) addToast(`Cut cell ${selectedCell}`, 'info');
        setContextMenu(null);
    };

    // Paste Cell
    const handlePasteCell = () => {
        if (!copiedCellData) return;
        setSheets(prev => ({
            ...prev,
            [activeSheet]: {
                ...(prev[activeSheet] || {}),
                [selectedCell]: { ...copiedCellData }
            }
        }));
        setCellInput(copiedCellData.value);
        if (addToast) addToast(`Pasted into cell ${selectedCell}`, 'success');
        setContextMenu(null);
    };

    // Formula Evaluator
    const evaluateCell = (cellKey: string, sheetData: Record<string, CellData>, visited = new Set<string>()): string | number => {
        const cell = sheetData[cellKey];
        if (!cell || cell.value === undefined) return '';
        const val = String(cell.value);

        if (!val.startsWith('=')) return val;

        if (visited.has(cellKey)) return '#CIRCULAR!';
        visited.add(cellKey);

        try {
            const upper = val.toUpperCase();
            // SUM formula: =SUM(A1:A5)
            if (upper.startsWith('=SUM(')) {
                const range = upper.replace('=SUM(', '').replace(')', '').trim();
                const [start, end] = range.split(':');
                if (start && end) {
                    const sum = getRangeValues(start, end, sheetData, visited).reduce((acc, v) => acc + (Number(v) || 0), 0);
                    return sum;
                }
            }
            // AVERAGE formula: =AVERAGE(A1:A5)
            if (upper.startsWith('=AVERAGE(')) {
                const range = upper.replace('=AVERAGE(', '').replace(')', '').trim();
                const [start, end] = range.split(':');
                if (start && end) {
                    const vals = getRangeValues(start, end, sheetData, visited).map(v => Number(v) || 0);
                    if (vals.length === 0) return 0;
                    const sum = vals.reduce((a, b) => a + b, 0);
                    return Number((sum / vals.length).toFixed(2));
                }
            }
            // COUNT formula: =COUNT(A1:A5)
            if (upper.startsWith('=COUNT(')) {
                const range = upper.replace('=COUNT(', '').replace(')', '').trim();
                const [start, end] = range.split(':');
                if (start && end) {
                    return getRangeValues(start, end, sheetData, visited).filter(v => v !== '' && !isNaN(Number(v))).length;
                }
            }
            // COUNTA formula: =COUNTA(A1:A5)
            if (upper.startsWith('=COUNTA(')) {
                const range = upper.replace('=COUNTA(', '').replace(')', '').trim();
                const [start, end] = range.split(':');
                if (start && end) {
                    return getRangeValues(start, end, sheetData, visited).filter(v => v !== undefined && v !== '').length;
                }
            }
            // MAX formula: =MAX(A1:A5)
            if (upper.startsWith('=MAX(')) {
                const range = upper.replace('=MAX(', '').replace(')', '').trim();
                const [start, end] = range.split(':');
                if (start && end) {
                    const vals = getRangeValues(start, end, sheetData, visited).map(v => Number(v) || 0);
                    return vals.length ? Math.max(...vals) : 0;
                }
            }
            // MIN formula: =MIN(A1:A5)
            if (upper.startsWith('=MIN(')) {
                const range = upper.replace('=MIN(', '').replace(')', '').trim();
                const [start, end] = range.split(':');
                if (start && end) {
                    const vals = getRangeValues(start, end, sheetData, visited).map(v => Number(v) || 0);
                    return vals.length ? Math.min(...vals) : 0;
                }
            }
            // PRODUCT formula: =PRODUCT(A1:A5)
            if (upper.startsWith('=PRODUCT(')) {
                const range = upper.replace('=PRODUCT(', '').replace(')', '').trim();
                const [start, end] = range.split(':');
                if (start && end) {
                    const vals = getRangeValues(start, end, sheetData, visited).map(v => Number(v) || 0);
                    return vals.reduce((acc, v) => acc * v, 1);
                }
            }
            // ABS formula: =ABS(A1)
            if (upper.startsWith('=ABS(')) {
                const ref = upper.replace('=ABS(', '').replace(')', '').trim();
                const evalVal = Number(evaluateCell(ref, sheetData, visited)) || 0;
                return Math.abs(evalVal);
            }
            // SQRT formula: =SQRT(A1)
            if (upper.startsWith('=SQRT(')) {
                const ref = upper.replace('=SQRT(', '').replace(')', '').trim();
                const evalVal = Number(evaluateCell(ref, sheetData, visited)) || 0;
                return Math.sqrt(evalVal);
            }
            // TODAY formula: =TODAY()
            if (upper === '=TODAY()') {
                return new Date().toISOString().split('T')[0];
            }
            // NOW formula: =NOW()
            if (upper === '=NOW()') {
                return new Date().toLocaleString();
            }

            // Basic arithmetic formula like =C2*D2 or =A1+B1
            let formulaExpr = val.substring(1);
            // Replace cell references like A1, B2 with their evaluated values
            const cellRefRegex = /[A-Z]+[0-9]+/g;
            formulaExpr = formulaExpr.replace(cellRefRegex, (match) => {
                const evaluated = evaluateCell(match, sheetData, visited);
                const num = Number(evaluated);
                return isNaN(num) ? `"${evaluated}"` : String(num);
            });

            // Safe eval using Function
            const result = Function(`"use strict"; return (${formulaExpr})`)();
            return isNaN(Number(result)) ? (result !== undefined ? String(result) : '#VALUE!') : result;
        } catch {
            return '#ERROR!';
        }
    };

    const getRangeValues = (start: string, end: string, sheetData: Record<string, CellData>, visited: Set<string>): any[] => {
        const startCol = start.replace(/[0-9]/g, '');
        const startRow = parseInt(start.replace(/[A-Z]/g, ''), 10);
        const endCol = end.replace(/[0-9]/g, '');
        const endRow = parseInt(end.replace(/[A-Z]/g, ''), 10);

        const colIdx1 = COLS.indexOf(startCol);
        const colIdx2 = COLS.indexOf(endCol);
        if (colIdx1 === -1 || colIdx2 === -1 || isNaN(startRow) || isNaN(endRow)) return [];

        const minCol = Math.min(colIdx1, colIdx2);
        const maxCol = Math.max(colIdx1, colIdx2);
        const minRow = Math.min(startRow, endRow);
        const maxRow = Math.max(startRow, endRow);

        const values = [];
        for (let r = minRow; r <= maxRow; r++) {
            for (let c = minCol; c <= maxCol; c++) {
                const key = `${COLS[c]}${r}`;
                values.push(evaluateCell(key, sheetData, visited));
            }
        }
        return values;
    };

    // Load ERP Data into Sheets
    const loadErpToSheet = (type: 'inventory' | 'inflow' | 'consumption') => {
        const newSheetData: Record<string, CellData> = {};
        const sheetTitle = type === 'inventory' ? 'ERP Inventory' : type === 'inflow' ? 'ERP Inflow' : 'ERP Consumption';

        if (type === 'inventory') {
            newSheetData['A1'] = { value: 'SKU', bold: true, bgColor: '#0f172a', color: '#fff' };
            newSheetData['B1'] = { value: 'Item Name', bold: true, bgColor: '#0f172a', color: '#fff' };
            newSheetData['C1'] = { value: 'Category', bold: true, bgColor: '#0f172a', color: '#fff' };
            newSheetData['D1'] = { value: 'Opening Stock', bold: true, bgColor: '#0f172a', color: '#fff' };
            newSheetData['E1'] = { value: 'Cost Price', bold: true, bgColor: '#0f172a', color: '#fff' };

            store.items.forEach((item, idx) => {
                const r = idx + 2;
                newSheetData[`A${r}`] = { value: item.sku };
                newSheetData[`B${r}`] = { value: item.name };
                newSheetData[`C${r}`] = { value: item.category };
                newSheetData[`D${r}`] = { value: String(item.openingStock || 0) };
                newSheetData[`E${r}`] = { value: String(item.costPrice || 0) };
            });
        } else if (type === 'inflow') {
            newSheetData['A1'] = { value: 'Tx ID', bold: true, bgColor: '#0f172a', color: '#fff' };
            newSheetData['B1'] = { value: 'Date', bold: true, bgColor: '#0f172a', color: '#fff' };
            newSheetData['C1'] = { value: 'Item ID', bold: true, bgColor: '#0f172a', color: '#fff' };
            newSheetData['D1'] = { value: 'Quantity', bold: true, bgColor: '#0f172a', color: '#fff' };
            newSheetData['E1'] = { value: 'Total Cost', bold: true, bgColor: '#0f172a', color: '#fff' };
            newSheetData['F1'] = { value: 'Supplier', bold: true, bgColor: '#0f172a', color: '#fff' };

            store.inflowTransactions.forEach((tx, idx) => {
                const r = idx + 2;
                newSheetData[`A${r}`] = { value: tx.id };
                newSheetData[`B${r}`] = { value: tx.txnDate || tx.createdAt };
                newSheetData[`C${r}`] = { value: tx.itemId };
                newSheetData[`D${r}`] = { value: String(tx.quantity) };
                newSheetData[`E${r}`] = { value: String(tx.totalCost) };
                newSheetData[`F${r}`] = { value: tx.supplier || '' };
            });
        } else {
            newSheetData['A1'] = { value: 'Tx ID', bold: true, bgColor: '#0f172a', color: '#fff' };
            newSheetData['B1'] = { value: 'Date', bold: true, bgColor: '#0f172a', color: '#fff' };
            newSheetData['C1'] = { value: 'Item ID', bold: true, bgColor: '#0f172a', color: '#fff' };
            newSheetData['D1'] = { value: 'Quantity', bold: true, bgColor: '#0f172a', color: '#fff' };
            newSheetData['E1'] = { value: 'Shift / Type', bold: true, bgColor: '#0f172a', color: '#fff' };

            store.consumptionTransactions.forEach((tx, idx) => {
                const r = idx + 2;
                newSheetData[`A${r}`] = { value: tx.id };
                newSheetData[`B${r}`] = { value: tx.txnDate || tx.createdAt };
                newSheetData[`C${r}`] = { value: tx.itemId };
                newSheetData[`D${r}`] = { value: String(tx.quantity) };
                newSheetData[`E${r}`] = { value: tx.type || 'PROD' };
            });
        }

        setSheets(prev => ({
            ...prev,
            [sheetTitle]: newSheetData
        }));
        setActiveSheet(sheetTitle);
        if (addToast) addToast(`Loaded ERP data into spreadsheet sheet "${sheetTitle}"`, 'success');
    };

    // Export to Excel (.xlsx)
    const handleExportExcel = () => {
        try {
            const wb = XLSX.utils.book_new();
            Object.entries(sheets).forEach(([sheetName, sheetData]) => {
                // Convert sheetData to array of arrays for xlsx
                const aoa: any[][] = [];
                ROWS.slice(0, 30).forEach(r => {
                    const rowVals: any[] = [];
                    COLS.slice(0, 15).forEach(c => {
                        const key = `${c}${r}`;
                        const cell = sheetData[key];
                        rowVals.push(cell ? evaluateCell(key, sheetData) : '');
                    });
                    aoa.push(rowVals);
                });
                const ws = XLSX.utils.aoa_to_sheet(aoa);
                XLSX.utils.book_append_sheet(wb, ws, sheetName);
            });

            const fileName = `ERP_Sheets_Workbook_${new Date().toISOString().split('T')[0]}.xlsx`;
            XLSX.writeFile(wb, fileName);
            if (addToast) addToast(`Workbook exported successfully as ${fileName}`, 'success');
        } catch (err) {
            console.error('Export error:', err);
            if (addToast) addToast('Failed to export workbook.', 'error');
        }
    };

    // Import Excel file
    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const data = new Uint8Array(event.target?.result as ArrayBuffer);
                const workbook = XLSX.read(data, { type: 'array' });

                const newSheets: Record<string, Record<string, CellData>> = {};
                workbook.SheetNames.forEach(sheetName => {
                    const worksheet = workbook.Sheets[sheetName];
                    const json: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
                    const sheetData: Record<string, CellData> = {};

                    json.forEach((row, rIdx) => {
                        if (rIdx >= 40) return;
                        row.forEach((cellVal: any, cIdx: number) => {
                            if (cIdx >= 20) return;
                            if (cellVal !== undefined && cellVal !== null && cellVal !== '') {
                                const key = `${COLS[cIdx]}${rIdx + 1}`;
                                sheetData[key] = { value: String(cellVal) };
                            }
                        });
                    });
                    newSheets[sheetName] = sheetData;
                });

                setSheets(newSheets);
                const firstSheet = workbook.SheetNames[0] || 'Sheet1';
                setActiveSheet(firstSheet);
                if (addToast) addToast(`Successfully imported Excel workbook: ${file.name}`, 'success');
            } catch (err) {
                console.error('Import error:', err);
                if (addToast) addToast('Failed to parse uploaded Excel file.', 'error');
            }
        };
        reader.readAsArrayBuffer(file);
        e.target.value = '';
    };

    // Add Sheet
    const handleAddSheet = () => {
        if (!newSheetName.trim()) return;
        const name = newSheetName.trim();
        if (sheets[name]) {
            if (addToast) addToast('Sheet name already exists!', 'error');
            return;
        }
        setSheets(prev => ({ ...prev, [name]: {} }));
        setActiveSheet(name);
        setNewSheetName('');
        setShowNewSheetModal(false);
        if (addToast) addToast(`Created new sheet "${name}"`, 'success');
    };

    // Delete Sheet
    const handleDeleteSheet = (sheetName: string) => {
        if (Object.keys(sheets).length <= 1) {
            if (addToast) addToast('Cannot delete the last remaining sheet.', 'error');
            return;
        }
        if (window.confirm(`Are you sure you want to delete sheet "${sheetName}"?`)) {
            const updated = { ...sheets };
            delete updated[sheetName];
            setSheets(updated);
            setActiveSheet(Object.keys(updated)[0]);
            if (addToast) addToast(`Deleted sheet "${sheetName}"`, 'info');
        }
    };

    const currentSheetData = sheets[activeSheet] || {};

    return (
        <div className="min-h-full bg-[#070b14] text-slate-100 p-4 sm:p-6 font-sans flex flex-col h-[calc(100vh-2rem)]">
            
            {/* Top Toolbar Header */}
            <div className="bg-[#0e1626] border border-slate-800 rounded-2xl p-4 shadow-xl mb-4 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
                
                {/* Title & Stats */}
                <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-xl bg-emerald-600/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-lg">
                        <FileSpreadsheet className="w-6 h-6" />
                    </div>
                    <div>
                        <h1 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
                            <span>Excel & Sheets Workspace</span>
                            <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                                Live Interactive
                            </span>
                        </h1>
                        <p className="text-xs text-slate-400">Full spreadsheet editor with formulas, multiple sheets, and ERP data integration</p>
                    </div>
                </div>

                {/* Toolbar Buttons */}
                <div className="flex flex-wrap items-center gap-2">
                    {/* Load ERP Data Dropdown / Buttons */}
                    <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-700/80 p-1 rounded-xl">
                        <button
                            type="button"
                            onClick={() => loadErpToSheet('inventory')}
                            className="px-2.5 py-1.5 rounded-lg text-xs font-bold text-blue-400 hover:bg-blue-600/20 transition-all flex items-center gap-1.5"
                        >
                            <Database className="w-3.5 h-3.5" />
                            <span>Load Inventory</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => loadErpToSheet('inflow')}
                            className="px-2.5 py-1.5 rounded-lg text-xs font-bold text-emerald-400 hover:bg-emerald-600/20 transition-all flex items-center gap-1.5"
                        >
                            <FileText className="w-3.5 h-3.5" />
                            <span>Load Inflow</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => loadErpToSheet('consumption')}
                            className="px-2.5 py-1.5 rounded-lg text-xs font-bold text-amber-400 hover:bg-amber-600/20 transition-all flex items-center gap-1.5"
                        >
                            <Calculator className="w-3.5 h-3.5" />
                            <span>Load Consumption</span>
                        </button>
                    </div>

                    {/* Import / Export */}
                    <input ref={fileInputRef} type="file" accept=".xlsx, .xls, .csv" onChange={handleFileUpload} className="hidden" />
                    <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="bg-slate-800 hover:bg-slate-700 text-slate-200 px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border border-slate-700"
                    >
                        <Upload className="w-3.5 h-3.5" />
                        <span>Import Excel</span>
                    </button>

                    <button
                        type="button"
                        onClick={handleExportExcel}
                        className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-1.5 shadow-lg shadow-emerald-600/20"
                    >
                        <Download className="w-3.5 h-3.5" />
                        <span>Export .XLSX</span>
                    </button>
                </div>

            </div>

            {/* Sub-toolbar for formatting & formula bar */}
            <div className="bg-[#0e1626] border border-slate-800 rounded-xl p-2.5 mb-3 flex flex-wrap items-center justify-between gap-3 shadow-md">
                
                {/* Formatting Controls */}
                <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-400 font-mono bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-800">
                        {selectedCell}
                    </span>

                    <div className="h-5 w-px bg-slate-800 mx-1"></div>

                    <button
                        type="button"
                        onClick={() => toggleStyle('bold')}
                        className={`p-1.5 rounded-lg border transition-all ${currentSheetData[selectedCell]?.bold ? 'bg-blue-600 border-blue-500 text-white' : 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800'}`}
                        title="Bold"
                    >
                        <Bold className="w-4 h-4" />
                    </button>

                    <button
                        type="button"
                        onClick={() => toggleStyle('italic')}
                        className={`p-1.5 rounded-lg border transition-all ${currentSheetData[selectedCell]?.italic ? 'bg-blue-600 border-blue-500 text-white' : 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800'}`}
                        title="Italic"
                    >
                        <Italic className="w-4 h-4" />
                    </button>

                    <div className="h-5 w-px bg-slate-800 mx-1"></div>

                    <button
                        type="button"
                        onClick={() => setAlignment('left')}
                        className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:bg-slate-800"
                        title="Align Left"
                    >
                        <AlignLeft className="w-4 h-4" />
                    </button>
                    <button
                        type="button"
                        onClick={() => setAlignment('center')}
                        className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:bg-slate-800"
                        title="Align Center"
                    >
                        <AlignCenter className="w-4 h-4" />
                    </button>
                    <button
                        type="button"
                        onClick={() => setAlignment('right')}
                        className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:bg-slate-800"
                        title="Align Right"
                    >
                        <AlignRight className="w-4 h-4" />
                    </button>

                    <div className="h-5 w-px bg-slate-800 mx-1"></div>

                    {/* Quick color preset */}
                    <div className="flex items-center gap-1">
                        <button onClick={() => setBgColor('#1e293b')} className="w-5 h-5 rounded bg-slate-800 border border-slate-700" title="Dark Header Fill"></button>
                        <button onClick={() => setBgColor('#1d4ed8')} className="w-5 h-5 rounded bg-blue-600 border border-blue-500" title="Blue Fill"></button>
                        <button onClick={() => setBgColor('#047857')} className="w-5 h-5 rounded bg-emerald-700 border border-emerald-600" title="Green Fill"></button>
                        <button onClick={() => setBgColor('#b91c1c')} className="w-5 h-5 rounded bg-rose-700 border border-rose-600" title="Red Fill"></button>
                        <button onClick={() => setBgColor('')} className="px-2 py-0.5 text-[10px] bg-slate-900 border border-slate-700 rounded text-slate-400 hover:text-white" title="Clear Fill">Reset Fill</button>
                    </div>
                </div>

                {/* Formula Bar Input */}
                <div className="flex-1 max-w-xl flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5">
                    <span className="text-xs font-bold text-emerald-400 font-mono shrink-0">fx</span>
                    <input
                        type="text"
                        value={cellInput}
                        onChange={(e) => handleCellInputChange(e.target.value)}
                        placeholder="Enter value or formula (e.g. =SUM(A1:A10), =C2*D2)"
                        className="w-full bg-transparent text-xs text-slate-100 focus:outline-none font-mono"
                    />
                </div>

                {/* Row & Column Actions */}
                <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 p-1 rounded-xl">
                    <button
                        type="button"
                        onClick={handleAddRow}
                        className="px-2.5 py-1 text-[11px] font-bold bg-slate-800 hover:bg-slate-700 text-emerald-400 rounded-lg transition-all flex items-center gap-1"
                        title="Insert Row Below"
                    >
                        <Plus className="w-3 h-3" />
                        <span>Row</span>
                    </button>
                    <button
                        type="button"
                        onClick={handleDeleteRow}
                        className="px-2.5 py-1 text-[11px] font-bold bg-slate-800 hover:bg-slate-700 text-rose-400 rounded-lg transition-all flex items-center gap-1"
                        title="Delete Selected Row"
                    >
                        <Trash2 className="w-3 h-3" />
                        <span>Row</span>
                    </button>
                    <div className="h-4 w-px bg-slate-700"></div>
                    <button
                        type="button"
                        onClick={handleAddColumn}
                        className="px-2.5 py-1 text-[11px] font-bold bg-slate-800 hover:bg-slate-700 text-emerald-400 rounded-lg transition-all flex items-center gap-1"
                        title="Insert Column Right"
                    >
                        <Plus className="w-3 h-3" />
                        <span>Col</span>
                    </button>
                    <button
                        type="button"
                        onClick={handleDeleteColumn}
                        className="px-2.5 py-1 text-[11px] font-bold bg-slate-800 hover:bg-slate-700 text-rose-400 rounded-lg transition-all flex items-center gap-1"
                        title="Delete Selected Column"
                    >
                        <Trash2 className="w-3 h-3" />
                        <span>Col</span>
                    </button>
                    <div className="h-4 w-px bg-slate-700"></div>
                    <button
                        type="button"
                        onClick={handleClearCell}
                        className="px-2 py-1 text-[11px] font-bold bg-slate-800 hover:bg-slate-700 text-amber-400 rounded-lg transition-all"
                        title="Clear Cell Value"
                    >
                        Clear
                    </button>
                </div>

            </div>

            {/* Main Spreadsheet Grid Container */}
            <div className="flex-1 bg-[#0e1626] border border-slate-800 rounded-2xl overflow-hidden shadow-2xl flex flex-col relative">
                
                <div className="flex-1 overflow-auto">
                    <table className="w-full border-collapse select-none font-mono text-xs">
                        <thead>
                            <tr className="bg-[#121c2e] text-slate-400 sticky top-0 z-10 border-b border-slate-800">
                                <th className="w-12 p-2 border-r border-slate-800 text-center font-bold bg-[#0e1626] text-slate-500">#</th>
                                {COLS.slice(0, 16).map(col => (
                                    <th key={col} className="min-w-[120px] max-w-[200px] p-2 border-r border-slate-800 text-center font-bold text-slate-300">
                                        {col}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {ROWS.map(row => (
                                <tr key={row} className="border-b border-slate-800/60 hover:bg-slate-900/40">
                                    <td className="p-2 border-r border-slate-800 text-center font-bold text-slate-500 bg-[#0e1626]/80 sticky left-0 z-10">
                                        {row}
                                    </td>
                                    {COLS.slice(0, 16).map(col => {
                                        const cellKey = `${col}${row}`;
                                        const cell = currentSheetData[cellKey];
                                        const isSelected = selectedCell === cellKey;
                                        const evaluatedValue = evaluateCell(cellKey, currentSheetData);

                                        return (
                                            <td
                                                key={cellKey}
                                                onClick={() => setSelectedCell(cellKey)}
                                                onDoubleClick={() => {
                                                    setSelectedCell(cellKey);
                                                    setIsEditingInline(true);
                                                }}
                                                style={{
                                                    backgroundColor: cell?.bgColor || (isSelected ? 'rgba(37, 99, 235, 0.15)' : undefined),
                                                    color: cell?.color || undefined,
                                                    fontWeight: cell?.bold ? 'bold' : 'normal',
                                                    fontStyle: cell?.italic ? 'italic' : 'normal',
                                                    textAlign: cell?.align || 'left'
                                                }}
                                                className={`p-2 border-r border-slate-800/60 truncate cursor-pointer transition-colors relative ${isSelected ? 'ring-2 ring-blue-500 z-0' : ''}`}
                                            >
                                                {isSelected && isEditingInline ? (
                                                    <input
                                                        type="text"
                                                        value={cellInput}
                                                        onChange={(e) => handleCellInputChange(e.target.value)}
                                                        onBlur={() => setIsEditingInline(false)}
                                                        onKeyDown={(e) => {
                                                            if (e.key === 'Enter' || e.key === 'Tab') {
                                                                e.preventDefault();
                                                                setIsEditingInline(false);
                                                            }
                                                        }}
                                                        autoFocus
                                                        className="w-full bg-[#070b14] text-white text-xs px-1 py-0.5 border border-blue-500 focus:outline-none font-mono"
                                                    />
                                                ) : (
                                                    evaluatedValue
                                                )}
                                            </td>
                                        );
                                    })}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Bottom Sheet Tabs Footer */}
                <div className="bg-[#0b111d] border-t border-slate-800 px-4 py-2.5 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-1.5 overflow-x-auto py-1">
                        {Object.keys(sheets).map(sheetName => {
                            const isActive = activeSheet === sheetName;
                            return (
                                <div key={sheetName} className="flex items-center">
                                    <button
                                        type="button"
                                        onClick={() => setActiveSheet(sheetName)}
                                        className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${isActive ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30' : 'bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800'}`}
                                    >
                                        <FileSpreadsheet className="w-3.5 h-3.5" />
                                        <span>{sheetName}</span>
                                    </button>
                                    {Object.keys(sheets).length > 1 && (
                                        <button
                                            type="button"
                                            onClick={() => handleDeleteSheet(sheetName)}
                                            className="ml-1 text-slate-500 hover:text-rose-400 p-1 rounded transition-all"
                                            title="Delete Sheet"
                                        >
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                    )}
                                </div>
                            );
                        })}

                        {/* Add Sheet Button */}
                        {showNewSheetModal ? (
                            <div className="flex items-center gap-1 bg-slate-900 border border-slate-700 p-1 rounded-xl">
                                <input
                                    type="text"
                                    value={newSheetName}
                                    onChange={(e) => setNewSheetName(e.target.value)}
                                    placeholder="Sheet name..."
                                    className="bg-transparent text-xs text-white px-2 py-1 focus:outline-none w-28"
                                    autoFocus
                                    onKeyDown={(e) => { if (e.key === 'Enter') handleAddSheet(); }}
                                />
                                <button type="button" onClick={handleAddSheet} className="bg-emerald-600 text-white p-1 rounded-lg">
                                    <Check className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        ) : (
                            <button
                                type="button"
                                onClick={() => setShowNewSheetModal(true)}
                                className="bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white px-3 py-1.5 rounded-xl text-xs font-bold border border-slate-800 flex items-center gap-1 transition-all"
                            >
                                <Plus className="w-3.5 h-3.5" />
                                <span>Add Sheet</span>
                            </button>
                        )}
                    </div>

                    <div className="text-[11px] text-slate-500 font-mono hidden sm:block">
                        Ready • Formulas supported: =SUM(), =AVERAGE(), =COUNT(), +, -, *, /
                    </div>
                </div>

            </div>

            {/* Excel-style Right-Click Context Menu */}
            {contextMenu && (
                <div
                    style={{ top: contextMenu.y, left: contextMenu.x }}
                    className="fixed z-50 bg-[#0e1626] border border-slate-700 rounded-xl shadow-2xl py-2 w-48 text-xs font-sans text-slate-200"
                    onClick={(e) => e.stopPropagation()}
                >
                    <div className="px-3 py-1 text-[10px] font-mono font-bold text-slate-500 border-b border-slate-800 mb-1">
                        Cell {contextMenu.cellKey}
                    </div>
                    <button
                        type="button"
                        onClick={handleCutCell}
                        className="w-full text-left px-4 py-1.5 hover:bg-blue-600 hover:text-white flex items-center justify-between transition-colors"
                    >
                        <span>Cut</span>
                        <span className="text-[10px] text-slate-500">Ctrl+X</span>
                    </button>
                    <button
                        type="button"
                        onClick={handleCopyCell}
                        className="w-full text-left px-4 py-1.5 hover:bg-blue-600 hover:text-white flex items-center justify-between transition-colors"
                    >
                        <span>Copy</span>
                        <span className="text-[10px] text-slate-500">Ctrl+C</span>
                    </button>
                    <button
                        type="button"
                        onClick={handlePasteCell}
                        disabled={!copiedCellData}
                        className={`w-full text-left px-4 py-1.5 flex items-center justify-between transition-colors ${copiedCellData ? 'hover:bg-blue-600 hover:text-white' : 'opacity-40 cursor-not-allowed'}`}
                    >
                        <span>Paste</span>
                        <span className="text-[10px] text-slate-500">Ctrl+V</span>
                    </button>
                    <div className="h-px bg-slate-800 my-1"></div>
                    <button
                        type="button"
                        onClick={() => { handleAddRow(); setContextMenu(null); }}
                        className="w-full text-left px-4 py-1.5 hover:bg-blue-600 hover:text-white flex items-center justify-between transition-colors"
                    >
                        <span>Insert Row</span>
                        <span className="text-[10px] text-emerald-400">+Row</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => { handleDeleteRow(); setContextMenu(null); }}
                        className="w-full text-left px-4 py-1.5 hover:bg-blue-600 hover:text-white flex items-center justify-between transition-colors"
                    >
                        <span>Delete Row</span>
                        <span className="text-[10px] text-rose-400">-Row</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => { handleAddColumn(); setContextMenu(null); }}
                        className="w-full text-left px-4 py-1.5 hover:bg-blue-600 hover:text-white flex items-center justify-between transition-colors"
                    >
                        <span>Insert Column</span>
                        <span className="text-[10px] text-emerald-400">+Col</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => { handleDeleteColumn(); setContextMenu(null); }}
                        className="w-full text-left px-4 py-1.5 hover:bg-blue-600 hover:text-white flex items-center justify-between transition-colors"
                    >
                        <span>Delete Column</span>
                        <span className="text-[10px] text-rose-400">-Col</span>
                    </button>
                    <div className="h-px bg-slate-800 my-1"></div>
                    <button
                        type="button"
                        onClick={() => { handleClearCell(); setContextMenu(null); }}
                        className="w-full text-left px-4 py-1.5 hover:bg-rose-600 hover:text-white flex items-center justify-between transition-colors text-rose-400 hover:text-white"
                    >
                        <span>Clear Contents</span>
                        <span className="text-[10px]">Del</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => { toggleStyle('bold'); setContextMenu(null); }}
                        className="w-full text-left px-4 py-1.5 hover:bg-blue-600 hover:text-white flex items-center justify-between transition-colors"
                    >
                        <span>Toggle Bold</span>
                        <span className="text-[10px] font-bold">B</span>
                    </button>
                </div>
            )}

        </div>
    );
};

export default ExcelSheets;
