
import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Download } from 'lucide-react';
import type { Die, ProductionPlan, Profile, ToastMessage, ProcessLogSheetData, TempParam, ProfileTransaction } from '../types';
import { SearchIcon, PencilIcon, TrashIcon } from '../components/Icon';
import AddProfileModal from '../components/AddProfileModal'; // Import the reusable AddProfileModal

declare const XLSX: any;
declare const jspdf: any;

interface DiesAndPlanningProps {
    dies: Die[];
    productionPlans: ProductionPlan[];
    profiles: Profile[];
    profileTransactions: ProfileTransaction[]; // Passed for profile stock calculations
    addToast: (message: string, type: ToastMessage['type']) => void;
    addDie: (die: Omit<Die, 'id' | 'createdAt' | 'brand'>) => void;
    updateDie: (die: Die) => void;
    deleteDie: (id: string) => void;
    addProductionPlan: (plan: Omit<ProductionPlan, 'id' | 'createdAt'>) => void;
    updateProductionPlan: (plan: ProductionPlan) => void;
    deleteProductionPlan: (id: string) => void;
    brands: string[];
    addBrand: (brand: string) => void;
    updateBrand: (oldB: string, newB: string) => void;
    deleteBrand: (brand: string) => void;
    addProfile: (profile: Omit<Profile, 'id' | 'createdAt'>) => Profile; // Pass addProfile for sub-modal
}

type Tab = 'dies' | 'planning';

const Portal: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    return createPortal(children, document.body);
};

// --- Helper Components defined OUTSIDE the main component to prevent re-creation and focus loss ---
// Optimized with React.memo and explicit props to prevent re-renders of the whole form on single field change.

interface TempInputProps {
    group: keyof ProcessLogSheetData;
    param: string;
    label: string;
    actValue: string;
    setValue: string;
    onChange: (group: keyof ProcessLogSheetData, param: string, type: 'act' | 'set', value: string) => void;
    focusInput: (id: string) => void;
    inputRefs: React.MutableRefObject<Record<string, HTMLInputElement | HTMLTextAreaElement>>;
}

const TempInput: React.FC<TempInputProps> = React.memo(({ group, param, label, actValue, setValue, onChange, focusInput, inputRefs }) => (
    <tr className="border-b dark:border-gray-700">
        <td className="px-2 py-1 font-semibold cursor-pointer hover:text-blue-500" onClick={() => focusInput(`log-${group}-${param}-act`)}>{label}</td>
        <td className="p-1">
            <input 
                id={`log-${group}-${param}-act`} 
                key={`log-${group}-${param}-act`} // Add key for stable input instance
                ref={el => { if (el) inputRefs.current[`log-${group}-${param}-act`] = el; }}
                type="text" 
                value={actValue} 
                onChange={(e) => onChange(group, param, 'act', e.target.value)} 
                className="w-full bg-gray-50 dark:bg-gray-700 text-center text-sm p-1 rounded border dark:border-gray-600" 
            />
        </td>
        <td className="p-1">
            <input 
                id={`log-${group}-${param}-set`} 
                key={`log-${group}-${param}-set`} // Add key for stable input instance
                ref={el => { if (el) inputRefs.current[`log-${group}-${param}-set`] = el; }}
                type="text" 
                value={setValue} 
                onChange={(e) => onChange(group, param, 'set', e.target.value)} 
                className="w-full bg-gray-50 dark:bg-gray-700 text-center text-sm p-1 rounded border dark:border-gray-600" 
            />
        </td>
    </tr>
));

interface ParamInputProps {
    group?: keyof ProcessLogSheetData;
    param: string;
    label: string;
    sNo: string;
    value: string;
    onChange: (group: keyof ProcessLogSheetData, param: string, value: string) => void;
    onHeaderChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    focusInput: (id: string) => void;
    inputRefs: React.MutableRefObject<Record<string, HTMLInputElement | HTMLTextAreaElement>>;
}

const ParamInput: React.FC<ParamInputProps> = React.memo(({ group, param, label, sNo, value, onChange, onHeaderChange, focusInput, inputRefs }) => (
    <tr className="border-b dark:border-gray-700">
        <td className="px-2 py-1 text-center font-semibold">{sNo}</td>
        <td className="px-2 py-1 font-semibold cursor-pointer hover:text-blue-500" onClick={() => focusInput(`log-${group || ''}-${param}`)}>{label}</td>
        <td className="p-1" colSpan={2}>
            <input 
                id={`log-${group || ''}-${param}`} 
                key={`log-${group || ''}-${param}`} // Add key for stable input instance
                ref={el => { if (el) inputRefs.current[`log-${group || ''}-${param}`] = el; }}
                type="text" 
                value={value} 
                onChange={(e) => group ? onChange(group, param, e.target.value) : onHeaderChange(e)} 
                name={!group ? param : undefined}
                className="w-full bg-gray-50 dark:bg-gray-700 text-sm p-1 rounded border dark:border-gray-600" 
            />
        </td>
    </tr>
));

interface ProcessLogSheetModalProps {
    isOpen: boolean;
    onClose: () => void;
    die: Die | null;
    onSave: (die: Die) => void;
    addToast: (message: string, type: ToastMessage['type']) => void;
}

const ProcessLogSheetModal: React.FC<ProcessLogSheetModalProps> = ({ isOpen, onClose, die, onSave, addToast }) => {
    // IMPORTANT: Use deep copy to initialize state to prevent mutation of original die object before saving
    const [formData, setFormData] = useState<ProcessLogSheetData>({});
    const inputRefs = useRef<Record<string, HTMLInputElement | HTMLTextAreaElement>>({});

    const modalRef = useRef<HTMLDivElement>(null);
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const dragStart = useRef({ x: 0, y: 0 });
    const startPos = useRef({ x: 0, y: 0 });

    useEffect(() => {
        if (isOpen && die) {
            setFormData(die.processLog || {});
            setPosition({ x: 0, y: 0 }); // Reset position on open
        }
    }, [isOpen, die]);

    useEffect(() => {
        const handleEsc = (event: KeyboardEvent) => {
            if (event.key === 'Escape') onClose();
        };
        if (isOpen) window.addEventListener('keydown', handleEsc);
        return () => window.removeEventListener('keydown', handleEsc);
    }, [isOpen, onClose]);

    const handleMouseDownHeader = (e: React.MouseEvent) => {
        if (e.button !== 0) return;
        setIsDragging(true);
        dragStart.current = { x: e.clientX, y: e.clientY };
        startPos.current = { ...position };
    };

    useEffect(() => {
        const onMouseMove = (e: MouseEvent) => {
            if (isDragging) {
                e.preventDefault();
                setPosition({ x: startPos.current.x + (e.clientX - dragStart.current.x), y: startPos.current.y + (e.clientY - dragStart.current.y) });
            }
        };
        const onMouseUp = () => setIsDragging(false);
        if (isDragging) {
            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
        }
        return () => {
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
        };
    }, [isDragging]);

    // Stable callbacks for input handlers
    const handleTempParamChange = useCallback((group: keyof ProcessLogSheetData, param: string, type: 'act' | 'set', value: string) => {
        setFormData(prev => ({
            ...prev,
            [group]: {
                ...(typeof prev[group] === 'object' ? (prev[group] as any) : {}),
                [param]: {
                    ...((prev[group] as any)?.[param] || {}), // Cast to any to access dynamic property
                    [type]: value
                }
            }
        }));
    }, []);

    const handleParamChange = useCallback((group: keyof ProcessLogSheetData, param: string, value: string) => {
        setFormData(prev => ({
            ...prev,
            [group]: {
                ...(typeof prev[group] === 'object' ? (prev[group] as any) : {}),
                [param]: value
            }
        }));
    }, []);
    
    // For direct header fields (not grouped)
    const handleHeaderChange = useCallback((e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    }, []);

    const focusInput = useCallback((id: string) => {
        inputRefs.current[id]?.focus();
    }, []);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if(die) {
            onSave({ ...die, processLog: formData });
            addToast('Process Log Saved!', 'success');
            onClose();
        }
    };

    const handleDownloadSinglePdf = () => {
        try {
            const { jsPDF } = jspdf;
            const doc = new jsPDF();

            // Header Section
            doc.setFillColor(30, 41, 59); // Slate-800
            doc.rect(0, 0, 210, 40, 'F');
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(20);
            doc.setFont('helvetica', 'bold');
            doc.text(`PROCESS LOG SHEET`, 14, 25);
            doc.setFontSize(12);
            doc.text(`DIE NUMBER: ${die?.dieNo || 'N/A'}`, 14, 33);

            doc.setTextColor(0, 0, 0);
            doc.setFontSize(12);
            doc.setFont('helvetica', 'bold');
            doc.text(`1. General Information`, 14, 48);

            // General Info Table
            const generalHeaders = [['Field', 'Value', 'Field', 'Value']];
            const generalRows = [
                ['Date', formData.date || 'N/A', 'Machine No.', formData.machineNo || 'N/A'],
                ['Tool ID', formData.toolId || 'N/A', 'Tool Man', formData.toolMan || 'N/A'],
                ['Profile Speed', formData.profileSpeed || 'N/A', 'Output Per Hour', formData.outputPerHour || 'N/A'],
                ['Profile Colour', formData.profileColour || 'N/A', '', '']
            ];

            doc.autoTable({
                head: generalHeaders,
                body: generalRows,
                startY: 52,
                theme: 'grid',
                styles: { fontSize: 9 },
                headStyles: { fillColor: [51, 65, 85], textColor: [255, 255, 255] },
                columnStyles: {
                    0: { fontStyle: 'bold', width: 40 },
                    1: { width: 55 },
                    2: { fontStyle: 'bold', width: 40 },
                    3: { width: 55 }
                }
            });

            // Temperature Zones Table
            doc.setFont('helvetica', 'bold');
            doc.text(`2. Barrel & Tooling Temperature Zones`, 14, ((doc as any).lastAutoTable.finalY || 52) + 10);

            const tempHeaders = [['Zone', 'Actual Temp (ACT)', 'Target Temp (SET)']];
            const tempRows = [
                ['BZ-1 (Barrel Zone 1)', formData.barrelTemp?.bz1?.act || '-', formData.barrelTemp?.bz1?.set || '-'],
                ['BZ-2 (Barrel Zone 2)', formData.barrelTemp?.bz2?.act || '-', formData.barrelTemp?.bz2?.set || '-'],
                ['BZ-3 (Barrel Zone 3)', formData.barrelTemp?.bz3?.act || '-', formData.barrelTemp?.bz3?.set || '-'],
                ['BZ-4 (Barrel Zone 4)', formData.barrelTemp?.bz4?.act || '-', formData.barrelTemp?.bz4?.set || '-'],
                ['BZ-5 (Barrel Zone 5)', formData.barrelTemp?.bz5?.act || '-', formData.barrelTemp?.bz5?.set || '-'],
                ['BZ-6 (Barrel Zone 6)', formData.barrelTemp?.bz6?.act || '-', formData.barrelTemp?.bz6?.set || '-'],
                ['CH-1', formData.barrelTemp?.ch1?.act || '-', formData.barrelTemp?.ch1?.set || '-'],
                ['CH-2', formData.barrelTemp?.ch2?.act || '-', formData.barrelTemp?.ch2?.set || '-'],
                ['DZ-1 (Tooling Zone 1)', formData.toolingTemp?.dz1?.act || '-', formData.toolingTemp?.dz1?.set || '-'],
                ['DZ-2 (Tooling Zone 2)', formData.toolingTemp?.dz2?.act || '-', formData.toolingTemp?.dz2?.set || '-'],
                ['DZ-3 (Tooling Zone 3)', formData.toolingTemp?.dz3?.act || '-', formData.toolingTemp?.dz3?.set || '-'],
                ['DZ-4 (Tooling Zone 4)', formData.toolingTemp?.dz4?.act || '-', formData.toolingTemp?.dz4?.set || '-']
            ];

            doc.autoTable({
                head: tempHeaders,
                body: tempRows,
                startY: ((doc as any).lastAutoTable.finalY || 90) + 14,
                theme: 'grid',
                styles: { fontSize: 9 },
                headStyles: { fillColor: [51, 65, 85], textColor: [255, 255, 255] },
                columnStyles: {
                    0: { fontStyle: 'bold', width: 70 },
                    1: { halign: 'center', width: 60 },
                    2: { halign: 'center', width: 60 }
                }
            });

            // Parameters Table (Force to next page if too long)
            let nextStartY = ((doc as any).lastAutoTable.finalY || 180) + 10;
            if (nextStartY > 220) {
                doc.addPage();
                nextStartY = 20;
            }

            doc.setFont('helvetica', 'bold');
            doc.text(`3. Process Parameters & Auxiliary Systems`, 14, nextStartY);

            const paramHeaders = [['S.No.', 'Parameter Name', 'Value']];
            const paramRows = [
                ['1', 'Extruder RPM', formData.extruderRpm || '-'],
                ['2', 'Screw Torque', formData.screwTorque || '-'],
                ['3', 'Feeder Blend', formData.feederBlend || '-'],
                ['4', 'Haul Off RPM', formData.haulOffRpm || '-'],
                ['5', 'Melt Temp', formData.meltTemp || '-'],
                ['6', 'Melt Pressure', formData.meltPressure || '-'],
                ['7', 'Degasing', formData.degasing || '-'],
                ['8', 'Calibrator Vacuum 1', formData.calibrator?.vacuum1 || '-'],
                ['9', 'Calibrator Vacuum 2', formData.calibrator?.vacuum2 || '-'],
                ['10', 'Calibrator Vacuum 3', formData.calibrator?.vacuum3 || '-'],
                ['11', 'Calibrator Vacuum 4', formData.calibrator?.vacuum4 || '-'],
                ['12', 'Calibrator Vacuum 5', formData.calibrator?.vacuum5 || '-'],
                ['13', 'Calibrator Water Temp', formData.calibrator?.waterTemp || '-'],
                ['14', 'Calibrator Water Pressure', formData.calibrator?.waterPressure || '-'],
                ['15', 'Cooling Tank Vacuum LR 1', formData.coolingTank?.vacuumLR1 || '-'],
                ['16', 'Cooling Tank Vacuum LR 2', formData.coolingTank?.vacuumLR2 || '-'],
                ['17', 'Cooling Tank Vacuum LR 3', formData.coolingTank?.vacuumLR3 || '-'],
                ['18', 'Haul Off Pressure', formData.haulOffPressure || '-'],
                ['19', 'Counter', formData.counter || '-'],
                ['20', 'Cutter Clamping', formData.cutterClamping || '-'],
                ['21', 'Time of Tripping', formData.timeOfTripping || '-']
            ];

            doc.autoTable({
                head: paramHeaders,
                body: paramRows,
                startY: nextStartY + 4,
                theme: 'grid',
                styles: { fontSize: 9 },
                headStyles: { fillColor: [51, 65, 85], textColor: [255, 255, 255] },
                columnStyles: {
                    0: { halign: 'center', width: 15 },
                    1: { fontStyle: 'bold', width: 110 },
                    2: { width: 65 }
                }
            });

            // Signatures & Remarks
            let sigStartY = ((doc as any).lastAutoTable.finalY || 100) + 12;
            if (sigStartY > 240) {
                doc.addPage();
                sigStartY = 20;
            }

            doc.setFont('helvetica', 'bold');
            doc.text(`Remarks & Signatures`, 14, sigStartY);
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(10);
            doc.text(`Remarks: ${formData.remarks || 'None'}`, 14, sigStartY + 8);

            doc.setFont('helvetica', 'bold');
            doc.text(`Signature Operator: ______________________`, 14, sigStartY + 24);
            doc.text(`Signature Engineer: ______________________`, 110, sigStartY + 24);

            doc.setFont('helvetica', 'normal');
            doc.setFontSize(8);
            doc.text(`Signature: ${formData.signatureOperator || 'N/A'}`, 14, sigStartY + 29);
            doc.text(`Signature: ${formData.signatureEngineer || 'N/A'}`, 110, sigStartY + 29);

            const dateStr = new Date().toISOString().split('T')[0];
            doc.save(`Process_Log_${die?.dieNo || 'DIE'}_${dateStr}.pdf`);
            addToast(`Successfully downloaded Log Sheet for ${die?.dieNo}!`, 'success');
        } catch (error) {
            console.error('Single Process Log PDF Export Error:', error);
            addToast('Failed to download Process Log Sheet.', 'error');
        }
    };

    if (!isOpen || !die) return null;

    const inputStyle = "w-full bg-gray-50 dark:bg-gray-700 text-sm p-1 rounded border dark:border-gray-600 focus:outline-none focus:ring-1 focus:ring-blue-500";
    const modalStyle = { transform: `translate(${position.x}px, ${position.y}px)` };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 z-[90] flex justify-center items-center p-4" onMouseDown={onClose}>
            <div ref={modalRef} style={modalStyle} className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-4xl flex flex-col max-h-[90vh] border border-gray-200 dark:border-gray-600 my-auto" onMouseDown={e => e.stopPropagation()}>
                <div onMouseDown={handleMouseDownHeader} className="bg-gray-900 text-white px-6 py-4 rounded-t-xl cursor-move flex justify-between items-center shrink-0 select-none z-10 relative min-h-[64px]">
                    <h2 className="text-xl font-bold flex items-center gap-2">Process Log Sheet: {die.dieNo}</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-white text-2xl font-bold">&times;</button>
                </div>
                <div className="p-6 overflow-y-auto flex-1 min-h-0 bg-white dark:bg-gray-800">
                    <form onSubmit={handleSubmit} className="space-y-6">
                        {/* Header Info */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div><label className="block text-xs font-medium mb-1">Date</label><input type="date" name="date" value={formData.date || ''} onChange={handleHeaderChange} className={inputStyle} /></div>
                            <div><label className="block text-xs font-medium mb-1">Machine No.</label><input type="text" name="machineNo" value={formData.machineNo || ''} onChange={handleHeaderChange} className={inputStyle} /></div>
                            <div><label className="block text-xs font-medium mb-1">Tool ID</label><input type="text" name="toolId" value={formData.toolId || ''} onChange={handleHeaderChange} className={inputStyle} /></div>
                            <div><label className="block text-xs font-medium mb-1">Tool Man</label><input type="text" name="toolMan" value={formData.toolMan || ''} onChange={handleHeaderChange} className={inputStyle} /></div>
                            <div><label className="block text-xs font-medium mb-1">Profile Speed</label><input type="text" name="profileSpeed" value={formData.profileSpeed || ''} onChange={handleHeaderChange} className={inputStyle} /></div>
                            <div><label className="block text-xs font-medium mb-1">Output Per Hour</label><input type="text" name="outputPerHour" value={formData.outputPerHour || ''} onChange={handleHeaderChange} className={inputStyle} /></div>
                            <div><label className="block text-xs font-medium mb-1">Profile Colour</label><input type="text" name="profileColour" value={formData.profileColour || ''} onChange={handleHeaderChange} className={inputStyle} /></div>
                        </div>

                        {/* Temperatures */}
                        <div className="border rounded-md dark:border-gray-700">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="bg-gray-100 dark:bg-gray-700"><th className="px-2 py-1 text-left font-semibold" colSpan={1}>Barrel/Tooling Temp</th><th className="px-2 py-1 text-center font-semibold">ACT</th><th className="px-2 py-1 text-center font-semibold">SET</th></tr>
                                </thead>
                                <tbody>
                                    <tr className="bg-gray-50 dark:bg-gray-700/50"><td colSpan={3} className="px-2 py-1 font-semibold">Barrel Zones</td></tr>
                                    <TempInput group="barrelTemp" param="bz1" label="BZ-1" actValue={formData.barrelTemp?.bz1?.act || ''} setValue={formData.barrelTemp?.bz1?.set || ''} onChange={handleTempParamChange} focusInput={focusInput} inputRefs={inputRefs} />
                                    <TempInput group="barrelTemp" param="bz2" label="BZ-2" actValue={formData.barrelTemp?.bz2?.act || ''} setValue={formData.barrelTemp?.bz2?.set || ''} onChange={handleTempParamChange} focusInput={focusInput} inputRefs={inputRefs} />
                                    <TempInput group="barrelTemp" param="bz3" label="BZ-3" actValue={formData.barrelTemp?.bz3?.act || ''} setValue={formData.barrelTemp?.bz3?.set || ''} onChange={handleTempParamChange} focusInput={focusInput} inputRefs={inputRefs} />
                                    <TempInput group="barrelTemp" param="bz4" label="BZ-4" actValue={formData.barrelTemp?.bz4?.act || ''} setValue={formData.barrelTemp?.bz4?.set || ''} onChange={handleTempParamChange} focusInput={focusInput} inputRefs={inputRefs} />
                                    <TempInput group="barrelTemp" param="bz5" label="BZ-5" actValue={formData.barrelTemp?.bz5?.act || ''} setValue={formData.barrelTemp?.bz5?.set || ''} onChange={handleTempParamChange} focusInput={focusInput} inputRefs={inputRefs} />
                                    <TempInput group="barrelTemp" param="bz6" label="BZ-6" actValue={formData.barrelTemp?.bz6?.act || ''} setValue={formData.barrelTemp?.bz6?.set || ''} onChange={handleTempParamChange} focusInput={focusInput} inputRefs={inputRefs} />
                                    <TempInput group="barrelTemp" param="ch1" label="CH-1" actValue={formData.barrelTemp?.ch1?.act || ''} setValue={formData.barrelTemp?.ch1?.set || ''} onChange={handleTempParamChange} focusInput={focusInput} inputRefs={inputRefs} />
                                    <TempInput group="barrelTemp" param="ch2" label="CH-2" actValue={formData.barrelTemp?.ch2?.act || ''} setValue={formData.barrelTemp?.ch2?.set || ''} onChange={handleTempParamChange} focusInput={focusInput} inputRefs={inputRefs} />
                                    <tr className="bg-gray-50 dark:bg-gray-700/50"><td colSpan={3} className="px-2 py-1 font-semibold">Tooling Zones</td></tr>
                                    <TempInput group="toolingTemp" param="dz1" label="DZ-1" actValue={formData.toolingTemp?.dz1?.act || ''} setValue={formData.toolingTemp?.dz1?.set || ''} onChange={handleTempParamChange} focusInput={focusInput} inputRefs={inputRefs} />
                                    <TempInput group="toolingTemp" param="dz2" label="DZ-2" actValue={formData.toolingTemp?.dz2?.act || ''} setValue={formData.toolingTemp?.dz2?.set || ''} onChange={handleTempParamChange} focusInput={focusInput} inputRefs={inputRefs} />
                                    <TempInput group="toolingTemp" param="dz3" label="DZ-3" actValue={formData.toolingTemp?.dz3?.act || ''} setValue={formData.toolingTemp?.dz3?.set || ''} onChange={handleTempParamChange} focusInput={focusInput} inputRefs={inputRefs} />
                                    <TempInput group="toolingTemp" param="dz4" label="DZ-4" actValue={formData.toolingTemp?.dz4?.act || ''} setValue={formData.toolingTemp?.dz4?.set || ''} onChange={handleTempParamChange} focusInput={focusInput} inputRefs={inputRefs} />
                                </tbody>
                            </table>
                        </div>

                        {/* Other Parameters */}
                        <div className="border rounded-md dark:border-gray-700">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="bg-gray-100 dark:bg-gray-700"><th className="px-2 py-1 text-center font-semibold" colSpan={2}>S.No.</th><th className="px-2 py-1 text-left font-semibold" colSpan={2}>Parameters</th></tr>
                                </thead>
                                <tbody>
                                    <ParamInput sNo="1" param="extruderRpm" label="Extruder RPM" value={formData.extruderRpm || ''} onChange={handleParamChange} onHeaderChange={handleHeaderChange} focusInput={focusInput} inputRefs={inputRefs} />
                                    <ParamInput sNo="2" param="screwTorque" label="Screw Torque" value={formData.screwTorque || ''} onChange={handleParamChange} onHeaderChange={handleHeaderChange} focusInput={focusInput} inputRefs={inputRefs} />
                                    <ParamInput sNo="3" param="feederBlend" label="Feeder Blend" value={formData.feederBlend || ''} onChange={handleParamChange} onHeaderChange={handleHeaderChange} focusInput={focusInput} inputRefs={inputRefs} />
                                    <ParamInput sNo="4" param="haulOffRpm" label="Haul Off RPM" value={formData.haulOffRpm || ''} onChange={handleParamChange} onHeaderChange={handleHeaderChange} focusInput={focusInput} inputRefs={inputRefs} />
                                    <ParamInput sNo="5" param="meltTemp" label="Melt Temp" value={formData.meltTemp || ''} onChange={handleParamChange} onHeaderChange={handleHeaderChange} focusInput={focusInput} inputRefs={inputRefs} />
                                    <ParamInput sNo="6" param="meltPressure" label="Melt Pressure" value={formData.meltPressure || ''} onChange={handleParamChange} onHeaderChange={handleHeaderChange} focusInput={focusInput} inputRefs={inputRefs} />
                                    <ParamInput sNo="7" param="degasing" label="Degasing" value={formData.degasing || ''} onChange={handleParamChange} onHeaderChange={handleHeaderChange} focusInput={focusInput} inputRefs={inputRefs} />
                                    
                                    <tr className="bg-gray-5 dark:bg-gray-700/50"><td colSpan={4} className="px-2 py-1 font-semibold">Calibrator</td></tr>
                                    <ParamInput sNo="8" group="calibrator" param="vacuum1" label="Vacuum 1" value={formData.calibrator?.vacuum1 || ''} onChange={handleParamChange} onHeaderChange={handleHeaderChange} focusInput={focusInput} inputRefs={inputRefs} />
                                    <ParamInput sNo="9" group="calibrator" param="vacuum2" label="Vacuum 2" value={formData.calibrator?.vacuum2 || ''} onChange={handleParamChange} onHeaderChange={handleHeaderChange} focusInput={focusInput} inputRefs={inputRefs} />
                                    <ParamInput sNo="10" group="calibrator" param="vacuum3" label="Vacuum 3" value={formData.calibrator?.vacuum3 || ''} onChange={handleParamChange} onHeaderChange={handleHeaderChange} focusInput={focusInput} inputRefs={inputRefs} />
                                    <ParamInput sNo="11" group="calibrator" param="vacuum4" label="Vacuum 4" value={formData.calibrator?.vacuum4 || ''} onChange={handleParamChange} onHeaderChange={handleHeaderChange} focusInput={focusInput} inputRefs={inputRefs} />
                                    <ParamInput sNo="12" group="calibrator" param="vacuum5" label="Vacuum 5" value={formData.calibrator?.vacuum5 || ''} onChange={handleParamChange} onHeaderChange={handleHeaderChange} focusInput={focusInput} inputRefs={inputRefs} />
                                    <ParamInput sNo="13" group="calibrator" param="waterTemp" label="Water Temp" value={formData.calibrator?.waterTemp || ''} onChange={handleParamChange} onHeaderChange={handleHeaderChange} focusInput={focusInput} inputRefs={inputRefs} />
                                    <ParamInput sNo="14" group="calibrator" param="waterPressure" label="Water Pressure" value={formData.calibrator?.waterPressure || ''} onChange={handleParamChange} onHeaderChange={handleHeaderChange} focusInput={focusInput} inputRefs={inputRefs} />

                                    <tr className="bg-gray-5 dark:bg-gray-700/50"><td colSpan={4} className="px-2 py-1 font-semibold">Cooling Tank</td></tr>
                                    <ParamInput sNo="15" group="coolingTank" param="vacuumLR1" label="Vacuum LR 1" value={formData.coolingTank?.vacuumLR1 || ''} onChange={handleParamChange} onHeaderChange={handleHeaderChange} focusInput={focusInput} inputRefs={inputRefs} />
                                    <ParamInput sNo="16" group="coolingTank" param="vacuumLR2" label="Vacuum LR 2" value={formData.coolingTank?.vacuumLR2 || ''} onChange={handleParamChange} onHeaderChange={handleHeaderChange} focusInput={focusInput} inputRefs={inputRefs} />
                                    <ParamInput sNo="17" group="coolingTank" param="vacuumLR3" label="Vacuum LR 3" value={formData.coolingTank?.vacuumLR3 || ''} onChange={handleParamChange} onHeaderChange={handleHeaderChange} focusInput={focusInput} inputRefs={inputRefs} />
                                    
                                    <ParamInput sNo="18" param="haulOffPressure" label="Haul Off Pressure" value={formData.haulOffPressure || ''} onChange={handleParamChange} onHeaderChange={handleHeaderChange} focusInput={focusInput} inputRefs={inputRefs} />
                                    <ParamInput sNo="19" param="counter" label="Counter" value={formData.counter || ''} onChange={handleParamChange} onHeaderChange={handleHeaderChange} focusInput={focusInput} inputRefs={inputRefs} />
                                    <ParamInput sNo="20" param="cutterClamping" label="Cutter Clamping" value={formData.cutterClamping || ''} onChange={handleParamChange} onHeaderChange={handleHeaderChange} focusInput={focusInput} inputRefs={inputRefs} />
                                    <ParamInput sNo="21" param="timeOfTripping" label="Time of Tripping" value={formData.timeOfTripping || ''} onChange={handleParamChange} onHeaderChange={handleHeaderChange} focusInput={focusInput} inputRefs={inputRefs} />
                                </tbody>
                            </table>
                        </div>

                        {/* Signatures & Remarks */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div><label className="block text-xs font-medium mb-1">Signature Operator</label><input type="text" name="signatureOperator" value={formData.signatureOperator || ''} onChange={handleHeaderChange} className={inputStyle} /></div>
                            <div><label className="block text-xs font-medium mb-1">Signature Engineer</label><input type="text" name="signatureEngineer" value={formData.signatureEngineer || ''} onChange={handleHeaderChange} className={inputStyle} /></div>
                        </div>
                        <div><label className="block text-xs font-medium mb-1">Remarks</label><textarea name="remarks" rows={3} value={formData.remarks || ''} onChange={handleHeaderChange} className={inputStyle}></textarea></div>
                    </form>
                </div>
                <div className="p-4 bg-gray-100 dark:bg-gray-700 rounded-b-xl flex justify-between items-center shrink-0 border-t border-gray-200 dark:border-gray-600">
                    <button type="button" onClick={handleDownloadSinglePdf} className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md shadow transition-colors flex items-center gap-2 text-sm font-semibold">
                        <Download className="w-4 h-4" /> Export PDF
                    </button>
                    <div className="flex gap-3">
                        <button type="button" onClick={onClose} className="px-5 py-2 bg-white dark:bg-gray-600 border rounded-md hover:bg-gray-50 dark:hover:bg-gray-500 text-gray-700 dark:text-white transition-colors text-sm">Cancel</button>
                        <button type="submit" onClick={handleSubmit} className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 shadow transition-colors text-sm font-semibold">Save Log</button>
                    </div>
                </div>
            </div>
        </div>
    );
};


const DiesAndPlanning: React.FC<DiesAndPlanningProps> = (props) => {
    const { dies, productionPlans, profiles, profileTransactions, addToast, addDie, updateDie, deleteDie, addProductionPlan, updateProductionPlan, deleteProductionPlan, brands, addBrand, updateBrand, deleteBrand, addProfile } = props;
    const [activeTab, setActiveTab] = useState<Tab>('dies');
    const [searchTerm, setSearchTerm] = useState('');
    const [brandFilter, setBrandFilter] = useState('All');

    const [isDieModalOpen, setIsDieModalOpen] = useState(false);
    const [editingDie, setEditingDie] = useState<Die | null>(null);

    const [isPlanModalOpen, setIsPlanModalOpen] = useState(false);
    const [editingPlan, setEditingPlan] = useState<ProductionPlan | null>(null);

    const [logSheetDie, setLogSheetDie] = useState<Die | null>(null);
    const [isManageBrandsModalOpen, setIsManageBrandsModalOpen] = useState(false);
    const [isDownloadMenuOpen, setIsDownloadMenuOpen] = useState(false);
    const downloadMenuRef = useRef<HTMLDivElement>(null);

    const dieMap = useMemo(() => new Map(dies.map(d => [d.id, d.dieNo])), [dies]);
    const profileMap = useMemo(() => new Map(profiles.map(p => [p.id, p])), [profiles]);

    const filteredDies = useMemo(() => {
        let filtered = dies;
        if (brandFilter !== 'All') {
            filtered = filtered.filter(d => d.brand === brandFilter);
        }
        if (!searchTerm) return filtered;
        const lowerSearch = searchTerm.toLowerCase();
        return filtered.filter(d => d.dieNo.toLowerCase().includes(lowerSearch));
    }, [dies, searchTerm, brandFilter]);

    const filteredPlans = useMemo(() => {
        let plans = productionPlans || [];
        if (searchTerm) {
            const lowerSearch = searchTerm.toLowerCase();
            plans = plans.filter(p => (p.machineNo || '').toLowerCase().includes(lowerSearch));
        }
        // Sort by machine number for grouping
        return plans.sort((a,b) => ((a.machineNo || '').localeCompare(b.machineNo || '')) || ((a.date ? new Date(a.date).getTime() : 0) - (b.date ? new Date(b.date).getTime() : 0)));
    }, [productionPlans, searchTerm]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (downloadMenuRef.current && !downloadMenuRef.current.contains(event.target as Node)) {
                setIsDownloadMenuOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, []);

    const handleExportExcel = () => {
        try {
            let headers: string[] = [];
            let rows: any[][] = [];
            let fileName = '';
            let sheetName = '';

            if (activeTab === 'dies') {
                headers = ['Brand', 'Die Number', 'Profile Name', 'Cavities', 'Expected Output (kg/hr)', 'Lifespan (meters)', 'Status'];
                rows = filteredDies.map(die => {
                    const profile = profileMap.get(die.profileId);
                    return [
                        die.brand || 'N/A',
                        die.dieNo || 'N/A',
                        profile?.name || 'N/A',
                        die.cavities || 0,
                        die.expectedOutputKgHr || 0,
                        die.lifespanMeters || 0,
                        die.status || 'ACTIVE'
                    ];
                });
                fileName = 'Dies_Parameters';
                sheetName = 'Dies Parameters';
            } else {
                headers = ['Start Date', 'Machine No', 'Loaded Dies', 'Target (Lengths/Meters)'];
                rows = filteredPlans.map(plan => {
                    const targetLengths = plan.targetLengths !== undefined ? plan.targetLengths : (plan.targetLength !== undefined ? plan.targetLength : (plan.targetMeters || 0));
                    const planDate = plan.date ? (isNaN(new Date(plan.date).getTime()) ? plan.date : new Date(plan.date + (plan.date.includes('T') ? '' : 'T00:00:00')).toLocaleDateString()) : 'N/A';
                    const loadedDiesStr = (plan.dieIds || []).map(id => dieMap.get(id) || id).join(', ');
                    return [
                        planDate,
                        plan.machineNo || plan.machine || 'EXT-01',
                        loadedDiesStr || 'None',
                        targetLengths || 0
                    ];
                });
                fileName = 'Production_Planning';
                sheetName = 'Production Plans';
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
            setIsDownloadMenuOpen(false);
        } catch (error) {
            console.error('Excel Export Error:', error);
            addToast('Failed to generate Excel sheet.', 'error');
        }
    };

    const handleExportPdf = () => {
        try {
            let headers: string[] = [];
            let rows: any[][] = [];
            let title = '';
            let fileName = '';

            if (activeTab === 'dies') {
                headers = ['Brand', 'Die No.', 'Profile Name', 'Cavities', 'Output (kg/hr)', 'Lifespan (m)', 'Status'];
                rows = filteredDies.map(die => {
                    const profile = profileMap.get(die.profileId);
                    return [
                        die.brand || 'N/A',
                        die.dieNo || 'N/A',
                        profile?.name || 'N/A',
                        die.cavities || 0,
                        die.expectedOutputKgHr || 0,
                        die.lifespanMeters || 0,
                        die.status || 'ACTIVE'
                    ];
                });
                title = 'Dies Parameters - Tooling Reports';
                fileName = 'Dies_Parameters';
            } else {
                headers = ['Date', 'Machine No', 'Loaded Dies', 'Target (Lengths)'];
                rows = filteredPlans.map(plan => {
                    const targetLengths = plan.targetLengths !== undefined ? plan.targetLengths : (plan.targetLength !== undefined ? plan.targetLength : (plan.targetMeters || 0));
                    const planDate = plan.date ? (isNaN(new Date(plan.date).getTime()) ? plan.date : new Date(plan.date + (plan.date.includes('T') ? '' : 'T00:00:00')).toLocaleDateString()) : 'N/A';
                    const loadedDiesStr = (plan.dieIds || []).map(id => dieMap.get(id) || id).join(', ');
                    return [
                        planDate,
                        plan.machineNo || plan.machine || 'EXT-01',
                        loadedDiesStr || 'None',
                        targetLengths || 0
                    ];
                });
                title = 'Production Planning - ERP Scheduling';
                fileName = 'Production_Planning';
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
                headStyles: { fillColor: [16, 185, 129], fontStyle: 'bold' }, // Emerald green matching planning
                alternateRowStyles: { fillColor: [240, 253, 244] },
            });

            const dateStr = new Date().toISOString().split('T')[0];
            doc.save(`${fileName}_${dateStr}.pdf`);
            addToast(`Successfully downloaded ${activeTab === 'dies' ? 'Dies' : 'Plans'} PDF report!`, 'success');
            setIsDownloadMenuOpen(false);
        } catch (error) {
            console.error('PDF Export Error:', error);
            addToast('Failed to generate PDF document.', 'error');
        }
    };

    const handleExportAllLogsExcel = () => {
        try {
            const headers = [
                'Die Number', 'Brand', 'Date', 'Machine No', 'Tool ID', 'Tool Man', 'Profile Speed', 'Output/Hr', 'Profile Colour',
                'BZ-1 Set', 'BZ-1 Act', 'BZ-2 Set', 'BZ-2 Act', 'BZ-3 Set', 'BZ-3 Act', 'BZ-4 Set', 'BZ-4 Act', 'BZ-5 Set', 'BZ-5 Act', 'BZ-6 Set', 'BZ-6 Act',
                'CH-1 Set', 'CH-1 Act', 'CH-2 Set', 'CH-2 Act', 'DZ-1 Set', 'DZ-1 Act', 'DZ-2 Set', 'DZ-2 Act', 'DZ-3 Set', 'DZ-3 Act', 'DZ-4 Set', 'DZ-4 Act',
                'Extruder RPM', 'Screw Torque', 'Feeder Blend', 'Haul Off RPM', 'Melt Temp', 'Melt Pressure', 'Degasing',
                'Vac-1', 'Vac-2', 'Vac-3', 'Vac-4', 'Vac-5', 'Water Temp', 'Water Press',
                'Vac-LR1', 'Vac-LR2', 'Vac-LR3', 'Haul Off Press', 'Counter', 'Cutter Clamp', 'Time Tripping',
                'Signature Operator', 'Signature Engineer', 'Remarks'
            ];

            const rows = dies.map(die => {
                const log = die.processLog || {};
                return [
                    die.dieNo || 'N/A',
                    die.brand || 'N/A',
                    log.date || 'N/A',
                    log.machineNo || 'N/A',
                    log.toolId || 'N/A',
                    log.toolMan || 'N/A',
                    log.profileSpeed || 'N/A',
                    log.outputPerHour || 'N/A',
                    log.profileColour || 'N/A',
                    log.barrelTemp?.bz1?.set || '-', log.barrelTemp?.bz1?.act || '-',
                    log.barrelTemp?.bz2?.set || '-', log.barrelTemp?.bz2?.act || '-',
                    log.barrelTemp?.bz3?.set || '-', log.barrelTemp?.bz3?.act || '-',
                    log.barrelTemp?.bz4?.set || '-', log.barrelTemp?.bz4?.act || '-',
                    log.barrelTemp?.bz5?.set || '-', log.barrelTemp?.bz5?.act || '-',
                    log.barrelTemp?.bz6?.set || '-', log.barrelTemp?.bz6?.act || '-',
                    log.barrelTemp?.ch1?.set || '-', log.barrelTemp?.ch1?.act || '-',
                    log.barrelTemp?.ch2?.set || '-', log.barrelTemp?.ch2?.act || '-',
                    log.toolingTemp?.dz1?.set || '-', log.toolingTemp?.dz1?.act || '-',
                    log.toolingTemp?.dz2?.set || '-', log.toolingTemp?.dz2?.act || '-',
                    log.toolingTemp?.dz3?.set || '-', log.toolingTemp?.dz3?.act || '-',
                    log.toolingTemp?.dz4?.set || '-', log.toolingTemp?.dz4?.act || '-',
                    log.extruderRpm || '-',
                    log.screwTorque || '-',
                    log.feederBlend || '-',
                    log.haulOffRpm || '-',
                    log.meltTemp || '-',
                    log.meltPressure || '-',
                    log.degasing || '-',
                    log.calibrator?.vacuum1 || '-', log.calibrator?.vacuum2 || '-', log.calibrator?.vacuum3 || '-', log.calibrator?.vacuum4 || '-', log.calibrator?.vacuum5 || '-',
                    log.calibrator?.waterTemp || '-', log.calibrator?.waterPressure || '-',
                    log.coolingTank?.vacuumLR1 || '-', log.coolingTank?.vacuumLR2 || '-', log.coolingTank?.vacuumLR3 || '-',
                    log.haulOffPressure || '-',
                    log.counter || '-',
                    log.cutterClamping || '-',
                    log.timeOfTripping || '-',
                    log.signatureOperator || '-',
                    log.signatureEngineer || '-',
                    log.remarks || '-'
                ];
            });

            const wb = XLSX.utils.book_new();
            const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
            XLSX.utils.book_append_sheet(wb, ws, 'All Process Logs');
            
            const dateStr = new Date().toISOString().split('T')[0];
            XLSX.writeFile(wb, `All_Dies_Process_Logs_${dateStr}.xlsx`);
            addToast(`Successfully downloaded All Process Logs Excel sheet!`, 'success');
            setIsDownloadMenuOpen(false);
        } catch (error) {
            console.error('All Logs Excel Export Error:', error);
            addToast('Failed to generate Excel sheet for all logs.', 'error');
        }
    };

    const handleExportAllLogsPdf = () => {
        try {
            const { jsPDF } = jspdf;
            const doc = new jsPDF({ orientation: 'landscape' });

            const logsCount = dies.filter(d => d.processLog && Object.keys(d.processLog).length > 0).length;
            if (logsCount === 0) {
                addToast('No process logs data found on any dies to export.', 'error');
                return;
            }

            let firstPage = true;
            dies.forEach((die) => {
                const log = die.processLog;
                if (!log || Object.keys(log).length === 0) return;

                if (!firstPage) {
                    doc.addPage({ orientation: 'landscape' });
                }
                firstPage = false;

                // Title Header
                doc.setFillColor(30, 41, 59); // Slate-800
                doc.rect(0, 0, 297, 25, 'F');
                doc.setTextColor(255, 255, 255);
                doc.setFontSize(16);
                doc.setFont('helvetica', 'bold');
                doc.text(`PROCESS LOG SHEET: ${die.dieNo}`, 14, 16);
                doc.setFontSize(9);
                doc.text(`Brand: ${die.brand || 'N/A'} | Expected Output: ${die.expectedOutputKgHr || 0} kg/hr`, 210, 16);

                doc.setTextColor(0, 0, 0);
                doc.setFontSize(10);
                doc.setFont('helvetica', 'bold');
                doc.text(`General & Extruder Settings`, 14, 32);

                const generalHeaders = [['Date', 'Machine', 'Tool ID', 'Tool Man', 'Speed', 'Output/Hr', 'Colour', 'Extruder RPM', 'Torque']];
                const generalRows = [[
                    log.date || '-',
                    log.machineNo || '-',
                    log.toolId || '-',
                    log.toolMan || '-',
                    log.profileSpeed || '-',
                    log.outputPerHour || '-',
                    log.profileColour || '-',
                    log.extruderRpm || '-',
                    log.screwTorque || '-'
                ]];

                doc.autoTable({
                    head: generalHeaders,
                    body: generalRows,
                    startY: 35,
                    theme: 'grid',
                    styles: { fontSize: 8 },
                    headStyles: { fillColor: [51, 65, 85], textColor: [255, 255, 255] }
                });

                // Temperatures
                doc.setFont('helvetica', 'bold');
                doc.text(`Barrel & Tooling Temperature Zones`, 14, ((doc as any).lastAutoTable.finalY || 35) + 8);

                const tempHeaders = [['Zone', 'BZ-1', 'BZ-2', 'BZ-3', 'BZ-4', 'BZ-5', 'BZ-6', 'CH-1', 'CH-2', 'DZ-1', 'DZ-2', 'DZ-3', 'DZ-4']];
                const actRow = ['ACT', 
                    log.barrelTemp?.bz1?.act || '-', log.barrelTemp?.bz2?.act || '-', log.barrelTemp?.bz3?.act || '-', log.barrelTemp?.bz4?.act || '-', log.barrelTemp?.bz5?.act || '-', log.barrelTemp?.bz6?.act || '-', 
                    log.barrelTemp?.ch1?.act || '-', log.barrelTemp?.ch2?.act || '-', 
                    log.toolingTemp?.dz1?.act || '-', log.toolingTemp?.dz2?.act || '-', log.toolingTemp?.dz3?.act || '-', log.toolingTemp?.dz4?.act || '-'
                ];
                const setRow = ['SET', 
                    log.barrelTemp?.bz1?.set || '-', log.barrelTemp?.bz2?.set || '-', log.barrelTemp?.bz3?.set || '-', log.barrelTemp?.bz4?.set || '-', log.barrelTemp?.bz5?.set || '-', log.barrelTemp?.bz6?.set || '-', 
                    log.barrelTemp?.ch1?.set || '-', log.barrelTemp?.ch2?.set || '-', 
                    log.toolingTemp?.dz1?.set || '-', log.toolingTemp?.dz2?.set || '-', log.toolingTemp?.dz3?.set || '-', log.toolingTemp?.dz4?.set || '-'
                ];

                doc.autoTable({
                    head: tempHeaders,
                    body: [actRow, setRow],
                    startY: ((doc as any).lastAutoTable.finalY || 45) + 11,
                    theme: 'grid',
                    styles: { fontSize: 8 },
                    headStyles: { fillColor: [51, 65, 85], textColor: [255, 255, 255] }
                });

                // Calibrator, Cooling & Other parameters
                doc.setFont('helvetica', 'bold');
                doc.text(`Auxiliary Systems & Process Parameters`, 14, ((doc as any).lastAutoTable.finalY || 70) + 8);

                const auxHeaders = [['Vac 1', 'Vac 2', 'Vac 3', 'Vac 4', 'Vac 5', 'Water T', 'Water P', 'Vac LR1', 'Vac LR2', 'Vac LR3', 'Haul Off P', 'Counter', 'Cutter']];
                const auxRows = [[
                    log.calibrator?.vacuum1 || '-', log.calibrator?.vacuum2 || '-', log.calibrator?.vacuum3 || '-', log.calibrator?.vacuum4 || '-', log.calibrator?.vacuum5 || '-',
                    log.calibrator?.waterTemp || '-', log.calibrator?.waterPressure || '-',
                    log.coolingTank?.vacuumLR1 || '-', log.coolingTank?.vacuumLR2 || '-', log.coolingTank?.vacuumLR3 || '-',
                    log.haulOffPressure || '-', log.counter || '-', log.cutterClamping || '-'
                ]];

                doc.autoTable({
                    head: auxHeaders,
                    body: auxRows,
                    startY: ((doc as any).lastAutoTable.finalY || 80) + 11,
                    theme: 'grid',
                    styles: { fontSize: 8 },
                    headStyles: { fillColor: [51, 65, 85], textColor: [255, 255, 255] }
                });

                // Signatures & Remarks
                const finalY = (doc as any).lastAutoTable.finalY || 110;
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(9);
                doc.text(`Remarks: ${log.remarks || 'None'}`, 14, finalY + 8);
                doc.text(`Operator: ${log.signatureOperator || 'N/A'}`, 14, finalY + 14);
                doc.text(`Engineer: ${log.signatureEngineer || 'N/A'}`, 150, finalY + 14);
            });

            const dateStr = new Date().toISOString().split('T')[0];
            doc.save(`All_Process_Logs_${dateStr}.pdf`);
            addToast(`Successfully downloaded All Saved Process Logs PDF!`, 'success');
            setIsDownloadMenuOpen(false);
        } catch (error) {
            console.error('All Logs PDF Export Error:', error);
            addToast('Failed to generate PDF document for all logs.', 'error');
        }
    };

    // Profile Stock Calculation Logic (Lifted from ProfileSection for accurate alerts)
    const profileStockMap = useMemo(() => {
        const stockMap = new Map<string, number>();
        profiles.forEach(p => {
            const production = profileTransactions.filter(t => t.profileId === p.id && (t.type === 'PRODUCTION' || t.type === 'RETURN')).reduce((sum, t) => sum + t.quantity, 0);
            const dispatch = profileTransactions.filter(t => t.profileId === p.id && t.type === 'DISPATCH').reduce((sum, t) => sum + t.quantity, 0);
            const scrap = profileTransactions.filter(t => t.profileId === p.id && t.type === 'SCRAP').reduce((sum, t) => {
                if (t.uom === 'Kgs' && p.weight && p.weight > 0) {
                    return sum + (t.quantity / p.weight);
                }
                return sum + t.quantity;
            }, 0);
            stockMap.set(p.id, production - dispatch - scrap);
        });
        return stockMap;
    }, [profiles, profileTransactions]);

    const tabs: { id: Tab; label: string }[] = [
        { id: 'dies', label: 'Dies Parameter' },
        { id: 'planning', label: 'Production Plan' },
    ];

    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Dies & Planning</h1>
                <div className="flex items-center gap-2">
                    {activeTab === 'dies' && <button onClick={() => setIsDieModalOpen(true)} className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-semibold hover:bg-blue-700 shadow">+ Add Die</button>}
                    {activeTab === 'planning' && <button onClick={() => setIsPlanModalOpen(true)} className="bg-green-600 text-white px-4 py-2 rounded-md text-sm font-semibold hover:bg-green-700 shadow">+ Add Plan</button>}
                    <div className="relative" ref={downloadMenuRef}>
                        <button
                            onClick={() => setIsDownloadMenuOpen(prev => !prev)}
                            className="w-full sm:w-auto bg-slate-800 dark:bg-gray-700 text-white px-4 py-2 rounded-md text-sm font-semibold hover:bg-slate-700 dark:hover:bg-gray-600 transition-colors flex items-center justify-center gap-2"
                        >
                            <Download className="w-4 h-4" />
                            <span>Export Report</span>
                            <ChevronDown className={`w-4 h-4 transition-transform ${isDownloadMenuOpen ? 'rotate-180' : ''}`} />
                        </button>
                        {isDownloadMenuOpen && (
                            <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-slate-800 rounded-md shadow-lg py-1.5 z-30 border border-gray-200 dark:border-gray-700">
                                <div className="px-4 py-1 text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Active Tab</div>
                                <button onClick={handleExportExcel} className="block w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700">
                                    Download Excel
                                </button>
                                <button onClick={handleExportPdf} className="block w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 border-b dark:border-gray-700 pb-2 mb-1.5">
                                    Download PDF
                                </button>
                                <div className="px-4 py-1 text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">All Process Logs</div>
                                <button onClick={handleExportAllLogsExcel} className="block w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700">
                                    Export All to Excel
                                </button>
                                <button onClick={handleExportAllLogsPdf} className="block w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700">
                                    Export All to PDF
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <div className="mb-6 border-b border-gray-200 dark:border-gray-700 flex justify-between items-end">
                <nav className="-mb-px flex space-x-6 overflow-x-auto">
                    {tabs.map(tab => <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`${activeTab === tab.id ? 'border-blue-500 text-blue-600 dark:text-blue-400' : 'border-transparent text-gray-500 dark:text-gray-400'} whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm focus:outline-none`}>{tab.label}</button>)}
                </nav>
                <div className="flex items-center gap-4">
                     {activeTab === 'dies' && (
                        <div className="flex bg-gray-200 dark:bg-gray-700 rounded-lg p-1 items-center">
                            <button onClick={() => setBrandFilter('All')} className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${brandFilter === 'All' ? 'bg-white dark:bg-gray-600 shadow' : 'text-gray-500 dark:text-gray-400'}`}>All</button>
                            {brands.map(brand => <button key={brand} onClick={() => setBrandFilter(brand)} className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${brandFilter === brand ? 'bg-white dark:bg-gray-600 shadow' : 'text-gray-500 dark:text-gray-400'}`}>{brand}</button>)}
                            <button onClick={() => setIsManageBrandsModalOpen(true)} className="ml-1 px-2 py-1 text-gray-500" title="Manage Brands"><PencilIcon className="w-3 h-3" /></button>
                        </div>
                    )}
                    <div className="mb-2 relative hidden sm:block"><input type="text" placeholder="Search..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-8 pr-4 py-1 text-sm border border-gray-300 dark:border-gray-600 dark:bg-gray-700 rounded-md w-64" /><SearchIcon className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" /></div>
                </div>
            </div>

            {activeTab === 'dies' && (
                <div className="bg-white dark:bg-gray-800 rounded-md shadow overflow-hidden">
                    <table className="w-full text-sm text-left text-gray-600 dark:text-gray-400">
                        <thead className="text-xs text-gray-700 dark:text-gray-300 uppercase bg-gray-50 dark:bg-gray-700">
                            <tr>
                                <th className="px-6 py-3">Brand</th><th className="px-6 py-3">Die No.</th><th className="px-6 py-3">Profile</th><th className="px-6 py-3">Cavities</th><th className="px-6 py-3">Output (Kg/Hr)</th><th className="px-6 py-3">Lifespan (m)</th><th className="px-6 py-3">Status</th><th className="px-6 py-3 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredDies.map((die, index) => (
                                <tr key={die.id} className="border-b dark:border-gray-700">
                                    <td className="px-6 py-4"><span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300">{die.brand || '-'}</span></td>
                                    <td className="px-6 py-4 font-medium">{die.dieNo}</td>
                                    <td className="px-6 py-4">{profileMap.get(die.profileId)?.name || 'N/A'}</td>
                                    <td className="px-6 py-4">{die.cavities}</td>
                                    <td className="px-6 py-4">{die.expectedOutputKgHr}</td>
                                    <td className="px-6 py-4">{(die.lifespanMeters || 0).toLocaleString()}</td>
                                    <td className="px-6 py-4">{die.status}</td>
                                    <td className="px-6 py-4 text-right space-x-3">
                                        <button onClick={() => setLogSheetDie(die)} className="text-green-500 hover:underline font-medium">Log Sheet</button>
                                        <button onClick={() => setEditingDie(die)} className="text-blue-500 hover:underline"><PencilIcon className="w-4 h-4 inline"/></button>
                                        <button onClick={() => deleteDie(die.id)} className="text-red-500 hover:underline"><TrashIcon className="w-4 h-4 inline"/></button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {activeTab === 'planning' && (
                <div className="bg-white dark:bg-gray-800 rounded-md shadow overflow-hidden">
                     <table className="w-full text-sm text-left text-gray-600 dark:text-gray-400">
                        <thead className="text-xs text-gray-700 dark:text-gray-300 uppercase bg-gray-50 dark:bg-gray-700">
                            <tr>
                                <th className="px-6 py-3">Date</th><th className="px-6 py-3">Machine</th><th className="px-6 py-3">Loaded Dies</th><th className="px-6 py-3">Target (Lengths)</th><th className="px-6 py-3 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredPlans.map(plan => {
                                const targetLengths = plan.targetLengths !== undefined ? plan.targetLengths : (plan.targetLength !== undefined ? plan.targetLength : (plan.targetMeters || 0));
                                const planDate = plan.date ? (isNaN(new Date(plan.date).getTime()) ? plan.date : new Date(plan.date + (plan.date.includes('T') ? '' : 'T00:00:00')).toLocaleDateString()) : 'N/A';
                                return (
                                <tr key={plan.id} className="border-b dark:border-gray-700">
                                    <td className="px-6 py-4">{planDate} <span className="text-xs text-gray-500">({plan.shift || 'A'})</span></td>
                                    <td className="px-6 py-4 font-bold text-gray-800 dark:text-white">{plan.machineNo || plan.machine || 'EXT-01'}</td>
                                    <td className="px-6 py-4">
                                        {plan.dieIds && plan.dieIds.length > 0 ? (
                                            <div className="flex flex-wrap gap-1">
                                                {plan.dieIds.map(dieId => {
                                                    const die = dieMap.get(dieId);
                                                    return (
                                                        <span key={dieId} className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                                                            {die || 'Unknown Die'}
                                                        </span>
                                                    );
                                                })}
                                            </div>
                                        ) : <span className="text-gray-400 italic">No Dies Loaded</span>}
                                    </td>
                                    <td className="px-6 py-4">{Number(targetLengths || 0).toLocaleString()}</td>
                                    <td className="px-6 py-4 text-right space-x-3"><button onClick={() => setEditingPlan(plan)} className="text-blue-500 hover:underline"><PencilIcon className="w-4 h-4 inline"/></button><button onClick={() => deleteProductionPlan(plan.id)} className="text-red-500 hover:underline"><TrashIcon className="w-4 h-4 inline"/></button></td>
                                </tr>
                            )})}
                        </tbody>
                    </table>
                </div>
            )}
            
            <Portal>
                <DieModal 
                    isOpen={isDieModalOpen || !!editingDie}
                    onClose={() => { setIsDieModalOpen(false); setEditingDie(null); }}
                    die={editingDie}
                    profiles={profiles}
                    brands={brands}
                    onSave={(data) => {
                        if (editingDie) {
                            updateDie({ ...editingDie, ...data });
                        } else {
                            addDie(data);
                        }
                    }}
                    addToast={addToast}
                    addProfile={addProfile} // Pass addProfile to DieModal
                />
            </Portal>

             <Portal>
                <ProductionPlanModal 
                    isOpen={isPlanModalOpen || !!editingPlan}
                    onClose={() => { setIsPlanModalOpen(false); setEditingPlan(null); }}
                    plan={editingPlan}
                    dies={dies}
                    profiles={profiles}
                    profileStockMap={profileStockMap} // Pass stock map for alerts
                    addDie={addDie}
                    addProfile={addProfile}
                    onSave={(data: any) => {
                        if (editingPlan) {
                            updateProductionPlan({ ...editingPlan, ...data });
                        } else {
                            addProductionPlan(data);
                        }
                    }}
                    addToast={addToast}
                    brands={brands}
                />
            </Portal>

            <Portal>
                <ProcessLogSheetModal 
                    isOpen={!!logSheetDie}
                    onClose={() => setLogSheetDie(null)}
                    die={logSheetDie}
                    onSave={updateDie}
                    addToast={addToast}
                />
            </Portal>
            <Portal><ManageBrandsModal isOpen={isManageBrandsModalOpen} onClose={() => setIsManageBrandsModalOpen(false)} brands={brands} addBrand={addBrand} deleteBrand={deleteBrand} addToast={addToast} /></Portal>
        </div>
    );
};

const DieModal: React.FC<any> = ({ isOpen, onClose, die, profiles, brands, onSave, addToast, addProfile }) => {
    const [form, setForm] = useState({ dieNo: '', profileId: '', cavities: 1, expectedOutputKgHr: 100, lifespanMeters: 500000, status: 'ACTIVE' });
    const [modalBrandFilter, setModalBrandFilter] = useState('All');
    const [isAddProfileSubModalOpen, setIsAddProfileSubModalOpen] = useState(false); // State for sub-modal

    useEffect(() => {
        if (isOpen) {
            if (die) {
                setForm(die);
            } else {
                setForm({ dieNo: '', profileId: '', cavities: 1, expectedOutputKgHr: 100, lifespanMeters: 500000, status: 'ACTIVE' });
            }
            setModalBrandFilter('All');
        }
    }, [isOpen, die]); 
    
    const filteredProfiles = useMemo(() => {
        if (modalBrandFilter === 'All') return profiles;
        return profiles.filter((p: any) => p.brand === modalBrandFilter);
    }, [profiles, modalBrandFilter]);

    if (!isOpen) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if(!form.profileId) {
            addToast('Please select a profile.', 'error');
            return;
        }
        onSave(form);
        onClose();
    };
    const inputClass = "w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 p-2 rounded-md text-sm dark:text-white outline-none";

    return (
         <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex justify-center items-center p-4" onClick={onClose}>
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg w-full max-w-lg" onClick={e => e.stopPropagation()}>
                <h3 className="font-bold mb-4 dark:text-white">{die ? 'Edit Die' : 'Add New Die'}</h3>
                <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-4">
                    <input placeholder="Die No." value={form.dieNo} onChange={e => setForm({...form, dieNo: e.target.value})} className={inputClass} required />
                    
                    <div className="col-span-1">
                        <select 
                            value={modalBrandFilter} 
                            onChange={e => setModalBrandFilter(e.target.value)} 
                            className={`${inputClass} mb-1 bg-gray-50 dark:bg-gray-800 border-b-2 border-blue-200 dark:border-blue-700`}
                        >
                            <option value="All">All Brands (Show All)</option>
                            {brands.map((b:string) => <option key={b} value={b}>{b}</option>)}
                        </select>
                         <select 
                            value={form.profileId} 
                            onChange={e => {
                                if (e.target.value === '__ADD_NEW_PROFILE__') {
                                    setIsAddProfileSubModalOpen(true);
                                } else {
                                    setForm({...form, profileId: e.target.value});
                                }
                            }} 
                            className={inputClass} 
                            required
                        >
                            <option value="" disabled>Select Profile</option>
                            {filteredProfiles.map((p:any) => <option key={p.id} value={p.id}>{p.name} ({p.sku}) {p.brand ? `[${p.brand}]` : ''}</option>)}
                            {modalBrandFilter !== 'All' && profiles.filter((p: any) => p.brand !== modalBrandFilter).length > 0 && (
                                <optgroup label="Other Brands">
                                    {profiles.filter((p: any) => p.brand !== modalBrandFilter).map((p: any) => (
                                        <option key={p.id} value={p.id}>{p.name} ({p.sku}) [{p.brand}]</option>
                                    ))}
                                </optgroup>
                            )}
                            <option value="__ADD_NEW_PROFILE__" className="font-bold text-blue-600 dark:text-blue-400">+ Add New Profile / Item...</option>
                        </select>
                    </div>

                    <input type="number" placeholder="Cavities" value={form.cavities} onChange={e => setForm({...form, cavities: +e.target.value})} className={inputClass} />
                    <input type="number" placeholder="Output (Kg/Hr)" value={form.expectedOutputKgHr} onChange={e => setForm({...form, expectedOutputKgHr: +e.target.value})} className={inputClass} />
                    <input type="number" placeholder="Lifespan (m)" value={form.lifespanMeters} onChange={e => setForm({...form, lifespanMeters: +e.target.value})} className={inputClass} />
                    <select value={form.status} onChange={e => setForm({...form, status: e.target.value as any})} className={inputClass}>
                        <option value="ACTIVE">Active</option><option value="INACTIVE">Inactive</option><option value="MAINTENANCE">Maintenance</option>
                    </select>
                    <div className="col-span-2 flex justify-end gap-2 mt-2"><button type="button" onClick={onClose} className="px-4 py-2 border rounded">Cancel</button><button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded">Save</button></div>
                </form>
            </div>
            <Portal>
                <AddProfileModal 
                    isOpen={isAddProfileSubModalOpen}
                    onClose={() => setIsAddProfileSubModalOpen(false)}
                    onAdd={(newProfileData) => {
                        const newProfile = addProfile(newProfileData); // Add and get the new profile
                        setForm(prev => ({ ...prev, profileId: newProfile.id })); // Select it in the DieModal
                        setIsAddProfileSubModalOpen(false); // Close sub-modal
                        addToast(`Profile "${newProfile.name}" added!`, 'success');
                        return newProfile;
                    }}
                    brands={brands}
                    addToast={addToast}
                />
            </Portal>
        </div>
    );
};

const ProductionPlanModal: React.FC<any> = ({ isOpen, onClose, plan, dies, profiles, profileStockMap, onSave, addToast, brands, addDie, addProfile }) => {
     const [form, setForm] = useState({ date: new Date().toISOString().split('T')[0], shift: 'A', machineNo: 'EXT-01', dieIds: [] as string[], targetLengths: 500 });
     const [modalBrandFilter, setModalBrandFilter] = useState('All');
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
         uom: 'Pcs',
         length: 5.9,
         weight: 4.89,
         piecesPerPacket: 6,
         price: 150,
         hsnCode: '391620'
     });

    useEffect(() => {
        if (isOpen) {
            if (plan) {
                // Handle legacy plans with single dieId
                const dieIds = plan.dieIds && Array.isArray(plan.dieIds) ? plan.dieIds : (plan.dieId ? [plan.dieId] : []);
                setForm({ 
                    date: plan.date,
                    shift: plan.shift,
                    machineNo: plan.machineNo,
                    dieIds: dieIds,
                    targetLengths: plan.targetLengths !== undefined ? plan.targetLengths : (plan.targetMeters || 500)
                });
            } else {
                setForm({ date: new Date().toISOString().split('T')[0], shift: 'A', machineNo: 'EXT-01', dieIds: [], targetLengths: 500 });
            }
            setModalBrandFilter('All');
            setIsAddingDie(false);
            setIsAddingProfileInDie(false);
        }
    }, [isOpen, plan]);
    
    const filteredDies = useMemo(() => {
        if (modalBrandFilter === 'All') return dies;
        return dies.filter((d: any) => d.brand === modalBrandFilter);
    }, [dies, modalBrandFilter]);

    if (!isOpen) return null;

    const handleToggleDie = (dieId: string) => {
        setForm(prev => {
            if (prev.dieIds.includes(dieId)) {
                return { ...prev, dieIds: prev.dieIds.filter(id => id !== dieId) };
            } else {
                return { ...prev, dieIds: [...prev.dieIds, dieId] };
            }
        });
    };

    const handleCreateProfileInDie = (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if (!newProfileForm.name.trim()) return addToast('Please enter a Profile Name', 'error');
        const generatedSku = newProfileForm.sku.trim() || `PRF-${Date.now().toString().slice(-4)}`;
        const targetBrand = newProfileForm.brand || newDieForm.brand || (modalBrandFilter !== 'All' ? modalBrandFilter : brands?.[0] || 'RAVIRAJA');

        const newProfileData = {
            sku: generatedSku,
            name: newProfileForm.name.trim(),
            brand: targetBrand,
            profileType: newProfileForm.profileType as 'WINDOW' | 'REINFORCEMENT',
            uom: newProfileForm.uom || 'Pcs',
            length: Number(newProfileForm.length) || 5.9,
            weight: Number(newProfileForm.weight) || 0,
            piecesPerPacket: Number(newProfileForm.piecesPerPacket) || 1,
            price: Number(newProfileForm.price) || 0,
            hsnCode: newProfileForm.hsnCode || '391620',
            reorderPoint: 50
        };

        if (addProfile) {
            const created = addProfile(newProfileData);
            setNewDieForm(prev => ({ 
                ...prev, 
                profileId: created.id, 
                brand: created.brand 
            }));
            setIsAddingProfileInDie(false);
            addToast(`Profile "${created.name}" created and linked!`, 'success');
        }
    };

    const handleCreateDie = (e: React.FormEvent) => {
        e.preventDefault();
        if (!newDieForm.dieNo.trim()) return addToast('Please enter a Die Number', 'error');
        if (!newDieForm.profileId) return addToast('Please select an Associated Profile', 'error');

        const newId = `die-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
        const createdDie = {
            id: newId,
            dieNo: newDieForm.dieNo.trim(),
            brand: newDieForm.brand || (modalBrandFilter !== 'All' ? modalBrandFilter : brands?.[0] || 'RAVIRAJA'),
            profileId: newDieForm.profileId,
            cavities: Number(newDieForm.cavities) || 1,
            expectedOutputKgHr: Number(newDieForm.expectedOutputKgHr) || 0,
            lifespanMeters: Number(newDieForm.lifespanMeters) || 0,
            status: newDieForm.status || 'ACTIVE',
            createdAt: new Date().toISOString()
        };

        if (addDie) {
            addDie(createdDie);
        }

        // Auto-select in current form
        setForm(prev => ({
            ...prev,
            dieIds: Array.from(new Set([...prev.dieIds, newId]))
        }));

        setIsAddingDie(false);
        addToast(`Die "${createdDie.dieNo}" created and selected!`, 'success');
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (form.dieIds.length === 0) {
            addToast('Please select at least one die.', 'error');
            return;
        }
        onSave(form);
        onClose();
    };
    const inputClass = "w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 p-2 rounded-md text-sm dark:text-white outline-none";

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex justify-center items-center p-4 backdrop-blur-sm" onClick={onClose}>
            <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl border dark:border-gray-700" onClick={e => e.stopPropagation()}>
                <h3 className="font-black text-lg mb-4 dark:text-white uppercase tracking-tight shrink-0">{plan ? 'Edit Production Plan' : 'Add Production Plan'}</h3>
                <form onSubmit={handleSubmit} className="space-y-4 overflow-y-auto flex-1 pr-1">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-[10px] font-black uppercase text-gray-500 mb-1 block">Plan Date</label>
                            <input type="date" value={form.date} onChange={e => setForm({...form, date: e.target.value})} className={inputClass} required />
                        </div>
                        <div>
                            <label className="text-[10px] font-black uppercase text-gray-500 mb-1 block">Shift</label>
                            <select value={form.shift} onChange={e => setForm({...form, shift: e.target.value as any})} className={inputClass}>
                                <option value="A">Shift A</option><option value="B">Shift B</option><option value="C">Shift C</option>
                            </select>
                        </div>
                        <div>
                            <label className="text-[10px] font-black uppercase text-gray-500 mb-1 block">Machine Number</label>
                            <input placeholder="Machine No." value={form.machineNo} onChange={e => setForm({...form, machineNo: e.target.value})} className={inputClass} />
                        </div>
                        <div>
                            <label className="text-[10px] font-black uppercase text-gray-500 mb-1 block">Target Lengths</label>
                            <input type="number" placeholder="Target (Lengths)" value={form.targetLengths} onChange={e => setForm({...form, targetLengths: +e.target.value})} className={inputClass} />
                        </div>
                    </div>
                    
                    <div className="border-t dark:border-gray-700 pt-4 mt-2">
                        <div className="flex justify-between items-center mb-2">
                            <h4 className="text-xs font-black uppercase tracking-wider text-gray-700 dark:text-gray-300">Select Dies to Load</h4>
                            <div className="flex items-center gap-2">
                                <button 
                                    type="button"
                                    onClick={() => {
                                        setNewDieForm({
                                            dieNo: '',
                                            brand: modalBrandFilter !== 'All' ? modalBrandFilter : (brands?.[0] || 'RAVIRAJA'),
                                            profileId: profiles[0]?.id || '',
                                            cavities: 1,
                                            expectedOutputKgHr: 120,
                                            lifespanMeters: 50000,
                                            status: 'ACTIVE'
                                        });
                                        setIsAddingDie(!isAddingDie);
                                        setIsAddingProfileInDie(false);
                                    }}
                                    className="text-[10px] font-black text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 bg-blue-50 dark:bg-blue-900/40 px-2.5 py-1 rounded-lg border border-blue-200 dark:border-blue-800 active:scale-95 transition-all"
                                >
                                    {isAddingDie ? "Hide Die Form" : "+ Add Die Option"}
                                </button>
                                <select 
                                    value={modalBrandFilter} 
                                    onChange={e => setModalBrandFilter(e.target.value)} 
                                    className="text-xs border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 p-1 rounded-lg outline-none font-bold"
                                >
                                    <option value="All">All Brands</option>
                                    {brands && brands.map((b: string) => <option key={b} value={b}>{b}</option>)}
                                </select>
                            </div>
                        </div>

                        {/* Inline Create Die Sub-form */}
                        {isAddingDie && (
                            <div className="p-3.5 bg-blue-50/70 dark:bg-blue-950/40 border-2 border-blue-200 dark:border-blue-800 rounded-xl space-y-2.5 mb-3 animate-fadeIn">
                                <div className="flex justify-between items-center">
                                    <span className="text-[10px] font-black uppercase text-blue-800 dark:text-blue-300">Create & Add New Die</span>
                                    <button type="button" onClick={() => setIsAddingDie(false)} className="text-xs font-bold text-gray-400 hover:text-gray-600">✕</button>
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                    <div>
                                        <label className="text-[9px] font-black uppercase text-gray-500 mb-1 block">Die No / Name</label>
                                        <input 
                                            value={newDieForm.dieNo}
                                            onChange={e => setNewDieForm({...newDieForm, dieNo: e.target.value})}
                                            placeholder="e.g. DIE-SF-03"
                                            className="w-full text-xs p-1.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white outline-none"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[9px] font-black uppercase text-gray-500 mb-1 block">Brand</label>
                                        <select 
                                            value={newDieForm.brand}
                                            onChange={e => setNewDieForm({...newDieForm, brand: e.target.value})}
                                            className="w-full text-xs p-1.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white outline-none"
                                        >
                                            {brands && brands.map((b: string) => <option key={b} value={b}>{b}</option>)}
                                        </select>
                                    </div>
                                </div>

                                {/* Associated Profile Selection & Inline Creation */}
                                <div>
                                    <div className="flex justify-between items-center mb-1">
                                        <label className="text-[9px] font-black uppercase text-gray-500 block">Associated Profile</label>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setNewProfileForm({
                                                    sku: '',
                                                    name: '',
                                                    brand: newDieForm.brand || (modalBrandFilter !== 'All' ? modalBrandFilter : brands?.[0] || 'RAVIRAJA'),
                                                    profileType: 'WINDOW',
                                                    uom: 'Pcs',
                                                    length: 5.9,
                                                    weight: 4.89,
                                                    piecesPerPacket: 6,
                                                    price: 150,
                                                    hsnCode: '391620'
                                                });
                                                setIsAddingProfileInDie(!isAddingProfileInDie);
                                            }}
                                            className="text-[9px] font-black text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 flex items-center gap-0.5"
                                        >
                                            {isAddingProfileInDie ? "✕ Close Form" : "+ New Profile"}
                                        </button>
                                    </div>

                                    {/* Inline Add Profile Form */}
                                    {isAddingProfileInDie && (
                                        <div className="p-2.5 bg-indigo-50/90 dark:bg-indigo-950/50 border border-indigo-200 dark:border-indigo-800 rounded-xl space-y-2 mb-2">
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
                                            <div className="grid grid-cols-2 gap-2">
                                                <div>
                                                    <label className="text-[8px] font-black uppercase text-gray-500 block">Brand</label>
                                                    <select
                                                        value={newProfileForm.brand}
                                                        onChange={e => setNewProfileForm({...newProfileForm, brand: e.target.value})}
                                                        className="w-full text-xs p-1.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                                                    >
                                                        {brands && brands.map((b: string) => <option key={b} value={b}>{b}</option>)}
                                                    </select>
                                                </div>
                                                <div className="flex items-end justify-end">
                                                    <button
                                                        type="button"
                                                        onClick={() => handleCreateProfileInDie()}
                                                        className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[10px] font-black uppercase tracking-wider active:scale-95 shadow-sm"
                                                    >
                                                        + Save & Link Profile
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    <select 
                                        value={newDieForm.profileId}
                                        onChange={e => {
                                            if (e.target.value === '__ADD_NEW_PROFILE__') {
                                                setIsAddingProfileInDie(true);
                                            } else {
                                                setNewDieForm({...newDieForm, profileId: e.target.value});
                                            }
                                        }}
                                        className="w-full text-xs p-1.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white outline-none"
                                    >
                                        <option value="">-- Choose Profile --</option>
                                        {/* Profiles matching current brand */}
                                        {profiles.filter((p: any) => !newDieForm.brand || p.brand === newDieForm.brand).map((p: any) => (
                                            <option key={p.id} value={p.id}>{p.name} ({p.sku}) {p.brand ? `[${p.brand}]` : ''}</option>
                                        ))}
                                        {/* Other profiles if brand doesn't match */}
                                        {newDieForm.brand && profiles.filter((p: any) => p.brand !== newDieForm.brand).length > 0 && (
                                            <optgroup label="Other Brands">
                                                {profiles.filter((p: any) => p.brand !== newDieForm.brand).map((p: any) => (
                                                    <option key={p.id} value={p.id}>{p.name} ({p.sku}) [{p.brand}]</option>
                                                ))}
                                            </optgroup>
                                        )}
                                        <option value="__ADD_NEW_PROFILE__" className="font-bold text-blue-600 dark:text-blue-400">+ Create New Profile / Item...</option>
                                    </select>
                                </div>
                                <div className="flex justify-end gap-2 pt-1 border-t border-blue-200 dark:border-blue-800">
                                    <button type="button" onClick={() => setIsAddingDie(false)} className="px-2.5 py-1 text-xs text-gray-500 hover:text-gray-700">Cancel</button>
                                    <button type="button" onClick={handleCreateDie} className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-black uppercase shadow-sm">+ Save & Select Die</button>
                                </div>
                            </div>
                        )}

                        <div className="max-h-52 overflow-y-auto border rounded-xl dark:border-gray-700 p-2 bg-gray-50 dark:bg-gray-900/50 space-y-1">
                            {filteredDies.length === 0 ? (
                                <p className="text-xs text-center text-gray-500 py-4 italic">No dies found for selected brand. Click "+ Add Die Option" to create one.</p>
                            ) : (
                                filteredDies.map((d: any) => {
                                    const profile = profiles.find((p:any) => p.id === d.profileId);
                                    const currentStock = profile ? profileStockMap.get(profile.id) || 0 : 0;
                                    const isLowStock = profile && currentStock < (profile.reorderPoint || 0);
                                    
                                    return (
                                        <div key={d.id} className={`flex items-center justify-between p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg cursor-pointer transition-all ${form.dieIds.includes(d.id) ? 'bg-blue-50 dark:bg-blue-900/20' : ''}`} onClick={() => handleToggleDie(d.id)}>
                                            <div className="flex items-center gap-3">
                                                <input 
                                                    type="checkbox" 
                                                    checked={form.dieIds.includes(d.id)} 
                                                    onChange={() => {}} 
                                                    className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                                                />
                                                <div>
                                                    <div className="font-bold text-xs text-gray-900 dark:text-white">{d.dieNo}</div>
                                                    <div className="text-[10px] text-gray-500">{profile?.name || 'No Profile Linked'} ({profile?.sku || '-'}) {d.brand ? `[${d.brand}]` : ''}</div>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                {isLowStock ? (
                                                    <div className="text-[10px] font-bold text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/30 px-2 py-0.5 rounded">
                                                        Low Stock: {currentStock}
                                                    </div>
                                                ) : (
                                                    <div className="text-[10px] text-green-600 dark:text-green-400 font-medium">
                                                        Stock: {currentStock}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                        <p className="text-[10px] text-gray-500 mt-2 text-center">Check the dies you want to run on {form.machineNo || 'this machine'}.</p>
                    </div>

                    <div className="flex justify-end gap-2 pt-2 border-t dark:border-gray-700 shrink-0">
                        <button type="button" onClick={onClose} className="px-4 py-2 border rounded-xl text-xs font-bold text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700">Cancel</button>
                        <button type="submit" className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-md">Save Plan</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

const ManageBrandsModal: React.FC<any> = ({ isOpen, onClose, brands, addBrand, deleteBrand, addToast }) => {
    const [newB, setNewB] = useState('');
    if (!isOpen) return null;
    const handleAdd = () => { if (newB.trim() && !brands.includes(newB.trim())) { addBrand(newB.trim()); setNewB(''); } else { addToast('Brand already exists or is empty.', 'error'); } };
    const handleDelete = (e: React.MouseEvent, brand: string) => { e.stopPropagation(); deleteBrand(brand); };
    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex justify-center items-center p-4" onClick={onClose}>
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg w-full max-w-sm" onClick={e => e.stopPropagation()}>
                <h3 className="font-bold mb-4 dark:text-white">Manage Brands</h3>
                <div className="flex gap-2 mb-4"><input value={newB} onChange={e => setNewB(e.target.value)} className="border p-2 flex-1 rounded dark:bg-gray-700 dark:text-white dark:border-gray-600"/><button onClick={handleAdd} className="bg-blue-600 text-white px-4 rounded">Add</button></div>
                <div className="max-h-48 overflow-y-auto border rounded dark:border-gray-600">
                    {brands.map((b:string) => <div key={b} className="flex justify-between p-2 border-b dark:border-gray-700 dark:text-gray-200"><span>{b}</span><button onClick={(e) => handleDelete(e, b)} className="text-red-500">Del</button></div>)}
                </div>
                <button onClick={onClose} className="mt-4 w-full border p-2 rounded dark:text-white">Close</button>
            </div>
        </div>
    );
};

export default DiesAndPlanning;
