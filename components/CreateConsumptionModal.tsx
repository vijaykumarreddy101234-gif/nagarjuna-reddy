
import React, { useState, useEffect, useMemo, useRef } from 'react';
import type { Item, ConsumptionTransaction, Formula } from '../types';

interface CreateConsumptionModalProps {
  isOpen: boolean;
  onClose: () => void;
  items: Item[];
  formulas: Formula[];
  onAdd: (transactions: Omit<ConsumptionTransaction, 'id' | 'createdAt'>[]) => void;
  initialFormulaId?: string | null;
}

type ConsumptionMode = 'single' | 'formula';

const CreateConsumptionModal = ({ isOpen, onClose, items, formulas, onAdd, initialFormulaId }) => {
  const [mode, setMode] = useState<ConsumptionMode>('single');
  const [type, setType] = useState<'PROD' | 'SCRAP'>('PROD');

  // State for both modes
  const [refNo, setRefNo] = useState('');
  const [txnDate, setTxnDate] = useState(new Date().toISOString().split('T')[0]);

  // State for single item mode
  const [itemId, setItemId] = useState('');
  const [quantity, setQuantity] = useState('');

  // State for formula mode
  const [selectedFormulaId, setSelectedFormulaId] = useState('');
  const [batchCount, setBatchCount] = useState('1');
  
  const modalRef = useRef<HTMLDivElement>(null);

  const selectedFormula = useMemo(() => {
    if (mode !== 'formula' || !selectedFormulaId) return null;
    return formulas.find(f => f.id === selectedFormulaId);
  }, [mode, selectedFormulaId, formulas]);

  useEffect(() => {
    if (isOpen) {
        // Reset shared fields
        setRefNo('');
        setTxnDate(new Date().toISOString().split('T')[0]);
        setType('PROD');

        if (initialFormulaId) {
            // Start in formula mode if an initial formula is provided
            setMode('formula');
            setSelectedFormulaId(initialFormulaId);
            setBatchCount('1');
            // Reset single mode state
            setItemId('');
            setQuantity('');
        } else {
            // Default behavior: start in single mode
            setMode('single');
            setItemId(items[0]?.id || '');
            setQuantity('');
            // Still set a default for the formula dropdown for easy switching
            setSelectedFormulaId(formulas[0]?.id || '');
            setBatchCount('1');
        }
    }
  }, [isOpen, initialFormulaId, items, formulas]);

  useEffect(() => {
    const handleEsc = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    if (isOpen) window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const transactionDate = new Date(txnDate + 'T12:00:00.000Z').toISOString();

    if (mode === 'single') {
        const numQuantity = parseFloat(quantity);
        if (!itemId || !numQuantity || numQuantity <= 0) {
          alert('Please select an item and enter a valid quantity.');
          return;
        }
        onAdd([{
          refNo,
          itemId,
          quantity: numQuantity,
          txnDate: transactionDate,
          warehouseId: 'wh1',
          type: type
        }]);

    } else { // Formula mode
        const numBatchCount = parseFloat(batchCount);
        if (!selectedFormula || !refNo || isNaN(numBatchCount) || numBatchCount <= 0) {
            alert('Please provide a batch reference, select a formula, and enter a valid batch count.');
            return;
        }
        const transactions: Omit<ConsumptionTransaction, 'id' | 'createdAt'>[] = selectedFormula.ingredients.map(ing => ({
            refNo,
            itemId: ing.itemId,
            quantity: ing.quantity * numBatchCount,
            txnDate: transactionDate,
            warehouseId: 'wh1',
            batchNo: refNo,
            type: type
        }));
        
        if (transactions.length > 0) {
            onAdd(transactions);
        } else {
            alert('Selected formula has no ingredients to consume.');
            return;
        }
    }
    onClose();
  };
  
  const inputStyles = "mt-1 block w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm";

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex justify-center items-center p-4" onClick={onClose}>
      <div ref={modalRef} className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-lg" onClick={e => e.stopPropagation()}>
        <div className="p-6 pb-4">
            <h2 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">Record Consumption</h2>
            <div className="inline-flex rounded-md shadow-sm w-full mb-4">
                <button
                    type="button"
                    onClick={() => setMode('single')}
                    className={`flex-1 px-4 py-2 text-sm font-medium border rounded-l-lg focus:z-10 focus:ring-2 focus:ring-blue-500 ${mode === 'single' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white border-gray-200 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-600'}`}
                >
                    Single Material
                </button>
                <button
                    type="button"
                    onClick={() => setMode('formula')}
                    className={`flex-1 px-4 py-2 text-sm font-medium border rounded-r-lg focus:z-10 focus:ring-2 focus:ring-blue-500 ${mode === 'formula' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white border-gray-200 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-600'}`}
                >
                    By Formula
                </button>
            </div>
        </div>

        <form onSubmit={handleSubmit} noValidate>
            <div className="p-6 pt-0 space-y-4">
                 <div className="flex gap-4">
                    <div className="flex-1">
                        <label htmlFor="con-refNo" className="block text-sm font-medium">Ref No. / Batch</label>
                        <input type="text" id="con-refNo" value={refNo} onChange={e => setRefNo(e.target.value)} className={inputStyles} placeholder="e.g., BATCH-001" required/>
                    </div>
                    <div className="w-1/3">
                         <label htmlFor="con-type" className="block text-sm font-medium">Type</label>
                         <select id="con-type" value={type} onChange={e => setType(e.target.value as 'PROD' | 'SCRAP')} className={`${inputStyles} ${type === 'SCRAP' ? 'border-red-500 text-red-600' : ''}`}>
                            <option value="PROD">Production</option>
                            <option value="SCRAP">Scrap / Waste</option>
                         </select>
                    </div>
                 </div>
                
                {mode === 'single' ? (
                    <>
                         <div>
                            <label htmlFor="con-item" className="block text-sm font-medium">Material Consumed</label>
                            <select id="con-item" value={itemId} onChange={e => setItemId(e.target.value)} className={inputStyles} required>
                                <option value="" disabled>-- Select a Material --</option>
                                {items.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label htmlFor="con-quantity" className="block text-sm font-medium">Quantity</label>
                            <input type="number" id="con-quantity" value={quantity} onChange={e => setQuantity(e.target.value)} className={inputStyles} required min="0.01" step="0.01" />
                        </div>
                    </>
                ) : (
                    <>
                        <div className="grid grid-cols-2 gap-4">
                             <div>
                                <label htmlFor="con-formula" className="block text-sm font-medium">Formula</label>
                                <select id="con-formula" value={selectedFormulaId} onChange={e => setSelectedFormulaId(e.target.value)} className={inputStyles} required>
                                    <option value="" disabled>-- Select a Formula --</option>
                                    {formulas.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                                </select>
                            </div>
                            <div>
                                <label htmlFor="con-batchCount" className="block text-sm font-medium">No. of Batches</label>
                                <input type="number" id="con-batchCount" value={batchCount} onChange={e => setBatchCount(e.target.value)} className={inputStyles} required min="0.01" step="0.01" />
                            </div>
                        </div>
                        {selectedFormula && (
                            <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-md border dark:border-gray-600 text-sm">
                                <h4 className="font-semibold mb-2">Ingredients Required for {batchCount} Batch(es):</h4>
                                <ul className="list-disc list-inside space-y-1">
                                    {selectedFormula.ingredients.map(ing => {
                                        const item = items.find(i => i.id === ing.itemId);
                                        const totalQty = (ing.quantity * (parseFloat(batchCount) || 0)).toLocaleString();
                                        return (
                                            <li key={ing.itemId} className="text-gray-700 dark:text-gray-300">
                                                <span className="font-medium text-gray-800 dark:text-gray-200">{item?.name || 'Unknown'}:</span> {totalQty} {item?.uom}
                                            </li>
                                        )
                                    })}
                                </ul>
                            </div>
                        )}
                    </>
                )}

                <div>
                    <label htmlFor="con-txnDate" className="block text-sm font-medium">Consumption Date</label>
                    <input type="date" id="con-txnDate" value={txnDate} onChange={e => setTxnDate(e.target.value)} className={inputStyles} required/>
                </div>
            </div>
            <div className="p-6 pt-2 flex justify-end space-x-3">
                <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-500 rounded-md shadow-sm hover:bg-gray-50 dark:hover:bg-gray-600">Cancel</button>
                <button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-orange-600 border border-transparent rounded-md shadow-sm hover:bg-orange-700">Record Consumption</button>
            </div>
        </form>
      </div>
    </div>
  );
};
export default CreateConsumptionModal;
