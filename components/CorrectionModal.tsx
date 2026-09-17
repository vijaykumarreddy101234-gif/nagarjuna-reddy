import React, { useState, useEffect } from 'react';
import type { Item, ReportCorrection } from '../types';

interface CorrectionModalProps {
    isOpen: boolean;
    onClose: () => void;
    item: Item;
    reportDate: string; // YYYY-MM-DD
    calculatedData: { totalIn: number; totalConsumption: number };
    existingCorrection?: ReportCorrection;
    onSave: (correction: Omit<ReportCorrection, 'updatedAt'>) => void;
}

const CorrectionModal = ({ isOpen, onClose, item, reportDate, calculatedData, existingCorrection, onSave }) => {
    const [actualInflow, setActualInflow] = useState('');
    const [actualConsumption, setActualConsumption] = useState('');
    const [reason, setReason] = useState('');
    const [error, setError] = useState('');

    useEffect(() => {
        if (isOpen) {
            setActualInflow(String(existingCorrection?.correctedInflow ?? calculatedData.totalIn));
            setActualConsumption(String(existingCorrection?.correctedConsumption ?? calculatedData.totalConsumption));
            setReason(existingCorrection?.reason ?? '');
            setError('');
        }
    }, [isOpen, existingCorrection, calculatedData]);
    
    useEffect(() => {
        const handleEsc = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
        if (isOpen) window.addEventListener('keydown', handleEsc);
        return () => window.removeEventListener('keydown', handleEsc);
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    const handleSubmit = () => {
        const inflow = parseFloat(actualInflow);
        const consumption = parseFloat(actualConsumption);
        if (isNaN(inflow) || inflow < 0 || isNaN(consumption) || consumption < 0) {
            setError('Please enter valid, non-negative numbers for inflow and consumption.');
            return;
        }
        if (!reason.trim()) {
            setError('A reason for the correction is required.');
            return;
        }

        onSave({
            itemId: item.id,
            date: reportDate,
            correctedInflow: inflow,
            correctedConsumption: consumption,
            reason: reason.trim(),
        });
        onClose();
    };

    const inputStyles = "mt-1 block w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm";
    const formattedDate = new Date(reportDate + 'T00:00:00').toLocaleDateString(undefined, { timeZone: 'UTC', year: 'numeric', month: 'long', day: 'numeric' });

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex justify-center items-center p-4" onClick={onClose}>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-lg" onClick={e => e.stopPropagation()}>
                <div className="p-6">
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">Correct Daily Report</h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">For: <span className="font-semibold">{item.name}</span> on <span className="font-semibold">{formattedDate}</span></p>
                </div>

                <div className="px-6 space-y-4">
                    <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-md border dark:border-gray-600">
                        <div>
                            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400">System Calculated Inflow</label>
                            <p className="font-mono text-lg">{calculatedData.totalIn.toLocaleString()}</p>
                        </div>
                         <div>
                            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400">System Calculated Consumption</label>
                            <p className="font-mono text-lg">{calculatedData.totalConsumption.toLocaleString()}</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label htmlFor="actualInflow" className="block text-sm font-medium">Actual Inflow</label>
                            <input type="number" id="actualInflow" value={actualInflow} onChange={e => setActualInflow(e.target.value)} className={inputStyles} min="0" step="any" />
                        </div>
                         <div>
                            <label htmlFor="actualConsumption" className="block text-sm font-medium">Actual Consumption</label>
                            <input type="number" id="actualConsumption" value={actualConsumption} onChange={e => setActualConsumption(e.target.value)} className={inputStyles} min="0" step="any"/>
                        </div>
                    </div>
                    <div>
                        <label htmlFor="reason" className="block text-sm font-medium">Reason for Correction <span className="text-red-500">*</span></label>
                        <textarea id="reason" rows={3} value={reason} onChange={e => setReason(e.target.value)} className={inputStyles} placeholder="e.g., Physical stock count adjustment, data entry error correction..."></textarea>
                    </div>
                    {error && <p className="text-sm text-red-500">{error}</p>}
                </div>

                <div className="p-6 flex justify-end space-x-3">
                    <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-500 rounded-md shadow-sm hover:bg-gray-50 dark:hover:bg-gray-600">Cancel</button>
                    <button type="button" onClick={handleSubmit} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md shadow-sm hover:bg-blue-700">Save Correction</button>
                </div>
            </div>
        </div>
    );
};

export default CorrectionModal;
