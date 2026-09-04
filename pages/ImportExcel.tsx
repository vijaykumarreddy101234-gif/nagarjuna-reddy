
import React, { useState, useCallback, useMemo } from 'react';
import type { InflowTransaction, ToastMessage } from '../types';
import { Card } from '../components/Card';

declare const XLSX: any;

interface ImportExcelProps {
    addMultipleInflowTransactions: (transactions: (Omit<InflowTransaction, 'id' | 'createdAt' | 'totalCost' | 'itemId'> & { sku: string, name?: string })[]) => void;
    addToast: (message: string, type: ToastMessage['type']) => void;
}

type ImportType = 'inflow'; // Hardcoded to inflow

const ERP_FIELDS = {
    inflow: {
        sku: { label: 'SKU / Item Code', required: true },
        quantity: { label: 'Quantity', required: true },
        unitCost: { label: 'Unit Cost', required: true },
        name: { label: 'Item Name', required: false },
        supplier: { label: 'Supplier', required: false },
        refNo: { label: 'Reference No.', required: false },
        txnDate: { label: 'Transaction Date', required: false },
    }
};

const ALL_HEADER_ALIASES: { [key: string]: string[] } = {
    sku: ['sku', 'item code', 'product code', 'material no', 'part no', 'item number', 'item', 'code', 'id'],
    name: ['name', 'item name', 'product name', 'description', 'particulars'],
    quantity: ['quantity', 'qty', 'units', 'pcs', 'unit in kg', 'unit', 'weight', 'volume'],
    unitCost: ['unit cost', 'cost price', 'price per unit', 'cost', 'rate', 'price'],
    supplier: ['supplier', 'vendor', 'party'],
    refNo: ['ref no', 'reference no', 'po no', 'order no', 'invoice no', 'bill no', 'document no'],
    txnDate: ['date', 'transaction date', 'txn date', 'order date', 'bill date'],
};

const NORMALIZED_ALIASES = new Set(
    Object.values(ALL_HEADER_ALIASES).flat().map(alias => alias.replace(/[^a-z0-9]/g, ''))
);

const ImportExcel: React.FC<ImportExcelProps> = ({ addMultipleInflowTransactions, addToast }) => {
    const [files, setFiles] = useState<File[]>([]);
    const [parsedData, setParsedData] = useState<any[]>([]);
    const [detectedHeaders, setDetectedHeaders] = useState<string[]>([]);
    const [columnMapping, setColumnMapping] = useState<Record<string, string | null>>({});
    
    const [isLoading, setIsLoading] = useState(false);
    const [statusMessage, setStatusMessage] = useState('');
    
    const [currentStep, setCurrentStep] = useState<'upload' | 'map'>('upload');
    const importType: ImportType = 'inflow';

    const resetState = useCallback(() => {
        setFiles([]);
        setParsedData([]);
        setDetectedHeaders([]);
        setColumnMapping({});
        setCurrentStep('upload');
        setStatusMessage('');
        const fileInput = document.getElementById('file-upload') as HTMLInputElement;
        if(fileInput) fileInput.value = '';
    }, []);

    const handleAutoMapColumns = useCallback(async (headers: string[]) => {
        setIsLoading(true);
        setStatusMessage('Mapping columns...');
    
        const normalize = (s: string) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

        const fieldsToMap = ERP_FIELDS.inflow;
        const erpFields = Object.keys(fieldsToMap);
        const initialMapping: Record<string, string | null> = {};
        const unmappedHeaders = [...headers];

        // 1. Deterministic Pass
        erpFields.forEach(erpField => {
            initialMapping[erpField] = null;
            const aliases = ALL_HEADER_ALIASES[erpField] || [];
            for (const alias of aliases) {
                const normalizedAlias = normalize(alias);
                const foundHeader = unmappedHeaders.find(h => normalize(h) === normalizedAlias);
                if (foundHeader) {
                    initialMapping[erpField] = foundHeader;
                    unmappedHeaders.splice(unmappedHeaders.indexOf(foundHeader), 1);
                    break; 
                }
            }
        });

        // Fallback for any remaining unmapped required fields to first available headers
        erpFields.forEach((erpField, idx) => {
            if (!initialMapping[erpField] && headers.length > 0) {
                // Pick a header that isn't already strictly mapped if possible, or headers[idx % headers.length]
                const fallbackHeader = headers[idx] || headers[0];
                initialMapping[erpField] = fallbackHeader;
            }
        });

        const unmappedErpFields = erpFields.filter(field => !initialMapping[field]);
        
        // 2. AI Pass (only if needed for remaining fields)
        if (unmappedErpFields.length > 0 && unmappedHeaders.filter(h => !h.startsWith('__EMPTY')).length > 0) {
            setStatusMessage('Using AI to map remaining columns...');
            try {
                const res = await fetch('/api/ai/map-columns', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ unmappedErpFields, unmappedHeaders })
                });
                const data = await res.json();
                const aiMappingResult = data.mapping || {};

                unmappedErpFields.forEach(field => {
                    const mappedHeader = aiMappingResult[field];
                    if (mappedHeader && unmappedHeaders.includes(mappedHeader)) {
                        initialMapping[field] = mappedHeader;
                    }
                });
                
                setStatusMessage('AI mapping complete. Please review the results.');

            } catch (error) {
                console.warn('AI mapping assist notice:', error);
                setStatusMessage('AI assist unavailable. Please map remaining columns manually.');
            }
        } else {
             setStatusMessage('Mapping complete. Please review the results.');
        }

        setColumnMapping(initialMapping);
        setIsLoading(false);
        setCurrentStep('map');

    }, []);

    const handleFileParse = useCallback(async () => {
        if (files.length === 0) return;
        setIsLoading(true);
        setStatusMessage('Parsing file...');
        const file = files[0];
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = e.target?.result;
                const workbook = XLSX.read(data, { type: 'array' });
                const sheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];
                const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: null });

                if (rows.length === 0) throw new Error("The selected file is empty.");
                
                let headerRowIndex = -1;
                let maxMatchCount = 0;

                // Search up to 20 rows
                for (let i = 0; i < Math.min(rows.length, 20); i++) {
                    const row = (rows[i] as any[]) || [];
                    if (row.filter(cell => cell !== null && String(cell).trim() !== '').length < 1) continue;

                    let currentMatchCount = 0;
                    for (const cell of row) {
                       const normalizedCell = String(cell || '').toLowerCase().replace(/[^a-z0-9]/g, '');
                       if (NORMALIZED_ALIASES.has(normalizedCell)) {
                           currentMatchCount++;
                       }
                    }
                    
                    if (currentMatchCount > maxMatchCount) {
                        maxMatchCount = currentMatchCount;
                        headerRowIndex = i;
                    }
                }

                // Fallback: If no matches, pick first row with at least 1 column of data
                if (headerRowIndex === -1 && rows.length > 0) {
                    for (let i = 0; i < Math.min(rows.length, 10); i++) {
                        const row = (rows[i] as any[]) || [];
                        if (row.filter(cell => cell !== null && String(cell).trim() !== '').length >= 1) {
                            headerRowIndex = i;
                            break;
                        }
                    }
                }

                if (headerRowIndex === -1) {
                    throw new Error("Could not automatically detect the header row. Please ensure your file has a row with column titles like 'SKU' and 'Quantity'.");
                }

                const headerRow: string[] = (rows[headerRowIndex] as any[]).map(h => String(h || '').trim());
                const uniqueHeaders = headerRow.map((h, i) => h || `__EMPTY_${i}`);
                const dataRows = rows.slice(headerRowIndex + 1);
                
                const jsonData = dataRows.map(rowArray => {
                    const obj: { [key: string]: any } = {};
                    uniqueHeaders.forEach((header, index) => { obj[header] = (rowArray as any[])[index]; });
                    return obj;
                }).filter(obj => Object.values(obj).some(val => val !== null && String(val).trim() !== ''));

                if (jsonData.length === 0) throw new Error("No data rows were found after the header row.");
                
                setParsedData(jsonData);
                setDetectedHeaders(uniqueHeaders);
                handleAutoMapColumns(uniqueHeaders);

            } catch (error: any) {
                console.error("Error parsing file:", error);
                addToast(`Error: ${error.message}`, 'error');
                resetState();
            }
        };
        reader.onerror = () => {
             addToast("Error reading the file.", 'error');
             resetState();
        };
        reader.readAsArrayBuffer(file);
    }, [files, handleAutoMapColumns, resetState, addToast]);
    
    const handleMappingChange = (erpField: string, fileHeader: string | null) => {
        setColumnMapping(prev => ({ ...prev, [erpField]: fileHeader === '__ignore__' ? null : fileHeader }));
    };

    const handleImport = () => {
        const currentFields = ERP_FIELDS.inflow;
        const requiredFields = Object.keys(currentFields).filter(f => currentFields[f as keyof typeof currentFields].required);
        const missingMappings = requiredFields.filter(field => !columnMapping[field]);

        if (missingMappings.length > 0) {
            addToast(`Import failed. Please map: ${missingMappings.map(f => currentFields[f as keyof typeof currentFields].label).join(', ')}.`, 'error');
            return;
        }
        
        const mappedData = parsedData.map(row => {
            const newRow: Record<string, any> = {};
            for (const erpField in columnMapping) {
                const fileHeader = columnMapping[erpField];
                if (fileHeader) {
                    newRow[erpField] = row[fileHeader];
                }
            }
            return newRow;
        });

        const txnsToImport = mappedData.map(row => {
            const quantity = parseFloat(row.quantity);
            const unitCost = parseFloat(row.unitCost);
            if (!row.sku || isNaN(quantity) || quantity <= 0 || isNaN(unitCost) || unitCost < 0) return null;
            return {
                sku: String(row.sku),
                name: row.name ? String(row.name) : undefined,
                quantity, unitCost,
                supplier: String(row.supplier || ''),
                refNo: String(row.refNo || ''),
                txnDate: row.txnDate ? new Date(row.txnDate).toISOString() : new Date().toISOString(),
            };
        }).filter(Boolean) as any[];
        addMultipleInflowTransactions(txnsToImport);
       
        resetState();
    };

    return (
        <div className="space-y-8">
            <div className="flex justify-between items-start">
                <div>
                    <h1 className="text-4xl font-display font-black text-slate-900 dark:text-white uppercase tracking-tighter italic">Document Intelligence</h1>
                    <p className="text-slate-500 font-medium mt-1">Automatic ingestion and layout parsing helper for business spreadsheets.</p>
                </div>
                <button 
                    onClick={() => window.dispatchEvent(new CustomEvent('navigate', { detail: 'Settings' }))}
                    className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl text-slate-500 hover:text-primary-500 transition-all shadow-sm"
                    title="System Settings"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>
                </button>
            </div>

            <Card className="p-8">
                {isLoading ? (
                    <div className="flex flex-col items-center justify-center p-16 space-y-6">
                        <div className="relative">
                            <div className="w-16 h-16 border-4 border-primary-500/10 rounded-full animate-ping" />
                            <div className="absolute inset-0 flex items-center justify-center">
                                <span className="animate-spin text-2xl text-primary-600">🌀</span>
                            </div>
                        </div>
                        <div className="text-center">
                            <p className="text-sm font-black uppercase tracking-widest text-slate-500 animate-pulse">{statusMessage}</p>
                            <p className="text-xs text-slate-400 mt-1">Refining workbook matrices via AI models...</p>
                        </div>
                    </div>
                ) : currentStep === 'upload' ? (
                    <UploadStep setFiles={setFiles} files={files} onProceed={handleFileParse} />
                ) : (
                    <MappingStep 
                        detectedHeaders={detectedHeaders}
                        columnMapping={columnMapping}
                        onMappingChange={handleMappingChange}
                        onConfirm={handleImport}
                        onCancel={resetState}
                        previewData={parsedData}
                    />
                )}
            </Card>
        </div>
    );
};

const UploadStep = ({ setFiles, files, onProceed }: any) => {
    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        if (event.target.files) {
            setFiles(Array.from(event.target.files));
        }
    };
    return (
        <div className="space-y-8">
            <div className="text-center max-w-lg mx-auto">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary-500 mb-2">Ingestion hub</p>
                <h3 className="text-2xl font-display font-black uppercase tracking-tight italic mb-3">Load Spreadsheet File</h3>
                <p className="text-xs text-slate-500 font-medium leading-relaxed">Select or drop a raw material transactions template to map and synchronize it with the central system.</p>
            </div>

            <label htmlFor="file-upload" className="border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-primary-500 rounded-[2rem] p-16 text-center cursor-pointer transition-all block focus-within:ring-2 focus-within:ring-slate-500 bg-slate-50/50 dark:bg-slate-900/10">
                <input id="file-upload" type="file" className="hidden" accept=".xlsx, .xls, .csv" onChange={handleFileChange} />
                <div className="w-16 h-16 bg-slate-200/50 dark:bg-slate-800 rounded-2xl flex items-center justify-center text-4xl mx-auto mb-6 shadow-sm">
                    📁
                </div>
                <p className="font-bold text-slate-800 dark:text-slate-200 text-sm">{files[0]?.name || "Drag & drop spreadsheet here, or click to browse"}</p>
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-2">Compatible formats: .xlsx, .xls, .csv</p>
            </label>

            {files.length > 0 && (
                <div className="flex justify-end pt-4 border-t border-slate-100 dark:border-slate-800">
                    <button 
                        onClick={onProceed} 
                        className="bg-slate-950 dark:bg-white hover:scale-105 active:scale-95 text-white dark:text-slate-900 px-8 py-4 rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-xl"
                    >
                        Ingest Matrix
                    </button>
                </div>
            )}
        </div>
    );
};

const MappingStep = ({ detectedHeaders, columnMapping, onMappingChange, onConfirm, onCancel, previewData }: any) => {
    const fields = ERP_FIELDS.inflow;

    return (
        <div className="space-y-10">
            <div>
                <span className="px-3 py-1 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 rounded-lg text-[9px] font-black uppercase tracking-widest">
                    Extraction ready
                </span>
                <h2 className="text-2xl font-display font-black text-slate-900 dark:text-white uppercase tracking-tight italic mt-3">Link Schema Columns</h2>
                <p className="text-xs font-medium text-slate-500 leading-relaxed mt-1">Review AI mapped database links. Columns labeled with <span className="text-red-500 font-bold">*</span> must be identified to ensure successful transaction records registration.</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 p-6 bg-slate-50 dark:bg-slate-900/40 rounded-3xl border border-slate-100 dark:border-slate-800">
                {Object.entries(fields).map(([fieldKey, fieldInfo]: [string, any]) => (
                    <div key={fieldKey} className="space-y-2">
                        <label htmlFor={`map-${fieldKey}`} className="block text-[10px] font-black text-slate-500 uppercase tracking-widest">
                            {fieldInfo.label} {fieldInfo.required && <span className="text-red-500">*</span>}
                        </label>
                        <select 
                            id={`map-${fieldKey}`} 
                            value={columnMapping[fieldKey] || '__ignore__'}
                            onChange={e => onMappingChange(fieldKey, e.target.value)}
                            className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-xs w-full font-bold text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-primary-500"
                        >
                            <option value="__ignore__">Ignore Source Column</option>
                            {detectedHeaders.map((header: string) => (
                                <option key={header} value={header}>{header.startsWith('__EMPTY') ? `Unnamed Attribute ${header.split('_')[2]}` : header}</option>
                            ))}
                        </select>
                    </div>
                ))}
            </div>

            <div>
                <h3 className="text-lg font-display font-black text-slate-900 dark:text-white uppercase tracking-tight italic mb-4">Ingested Spreadsheet Frame</h3>
                <div className="table-container shadow-xl">
                     <table className="w-full text-left text-slate-600 dark:text-slate-300">
                        <thead className="text-[10px] font-black uppercase tracking-wider bg-slate-100 dark:bg-slate-900 text-slate-700 dark:text-slate-400">
                            <tr>
                                {detectedHeaders.map((h: string) => (
                                    <th key={h} className="px-6 py-4">
                                        {h.startsWith('__EMPTY') ? `UNNAMED ${h.split('_')[2]}`: h.toUpperCase()}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 dark:divide-slate-800 bg-white dark:bg-slate-900">
                            {previewData.slice(0, 10).map((row: any, index: number) => (
                                <tr key={index} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                                    {detectedHeaders.map((header: string) => (
                                        <td key={header} className="px-6 py-4 font-semibold text-slate-800 dark:text-slate-200 font-mono text-xs whitespace-nowrap">
                                            {String(row[header] ?? '')}
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                {previewData.length > 10 && (
                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mt-4">
                        Showing first 10 rows. {previewData.length - 10} additional record frames are loaded and ready.
                    </p>
                )}
            </div>

            <div className="flex justify-between items-center pt-6 border-t border-slate-100 dark:border-slate-800">
                 <button 
                    onClick={onCancel} 
                    className="px-6 py-3 border border-slate-200 dark:border-slate-800 text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all"
                 >
                    Discard Layout
                 </button>
                 <button 
                    onClick={onConfirm} 
                    className="bg-emerald-600 hover:scale-105 active:scale-95 text-white px-8 py-4 rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-xl"
                 >
                    Sync {previewData.length} Records to Ledger
                </button>
            </div>
        </div>
    );
};

export default ImportExcel;
