
import React, { useState, useEffect } from 'react';
import type { PurchaseOrder, Supplier, Item } from '../types';

interface CreatePurchaseOrderModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (po: Omit<PurchaseOrder, 'id' | 'createdAt' | 'updatedAt'>) => void;
    suppliers: Supplier[];
    items: Item[];
}

const CreatePurchaseOrderModal = ({ isOpen, onClose, onSave, suppliers, items }) => {
    const getInitialState = () => ({
        supplierId: '',
        poNumber: `PO-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
        expectedDate: '',
        selectedItems: [] as { itemId: string; quantity: number; unitCost: number }[]
    });

    const [supplierId, setSupplierId] = useState('');
    const [poNumber, setPoNumber] = useState('');
    const [expectedDate, setExpectedDate] = useState('');
    const [selectedItems, setSelectedItems] = useState<{ itemId: string; quantity: number; unitCost: number }[]>([]);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (isOpen) {
            const initial = getInitialState();
            setSupplierId(initial.supplierId);
            setPoNumber(initial.poNumber);
            setExpectedDate(initial.expectedDate);
            setSelectedItems(initial.selectedItems);
            setIsSaving(false);
        }
    }, [isOpen, items]);

    if (!isOpen) return null;

    const addItem = () => {
        setSelectedItems([...selectedItems, { itemId: '', quantity: 1, unitCost: 0 }]);
    };

    const removeItem = (index: number) => {
        setSelectedItems(selectedItems.filter((_, i) => i !== index));
    };

    const updateItem = (index: number, field: string, value: any) => {
        const newItems = [...selectedItems];
        newItems[index] = { ...newItems[index], [field]: value };
        
        // Auto-fill cost if item is selected
        if (field === 'itemId') {
            const item = items.find(i => i.id === value);
            if (item) {
                newItems[index].unitCost = item.costPrice || 0;
            }
        }
        
        setSelectedItems(newItems);
    };

    const totalAmount = selectedItems.reduce((sum, item) => sum + (item.quantity * item.unitCost), 0);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!supplierId || selectedItems.length === 0 || isSaving) return;

        setIsSaving(true);
        try {
            onSave({
                poNumber,
                supplierId,
                items: selectedItems.map(item => ({
                    ...item,
                    totalCost: item.quantity * item.unitCost
                })),
                status: 'DRAFT',
                totalAmount,
                expectedDate: expectedDate || undefined
            });
            onClose();
        } catch (error) {
            console.error('Error saving PO:', error);
            setIsSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
                <div className="px-6 py-4 border-b dark:border-gray-700 flex justify-between items-center">
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">Create Purchase Order</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                        ✕
                    </button>
                </div>
                <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">PO Number</label>
                            <input
                                required
                                type="text"
                                value={poNumber}
                                onChange={e => setPoNumber(e.target.value)}
                                className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Supplier *</label>
                            <select
                                required
                                value={supplierId}
                                onChange={e => setSupplierId(e.target.value)}
                                className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                            >
                                <option value="">Select Supplier</option>
                                {suppliers.map(s => (
                                    <option key={s.id} value={s.id}>{s.name}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Expected Delivery Date</label>
                        <input
                            type="date"
                            value={expectedDate}
                            onChange={e => setExpectedDate(e.target.value)}
                            className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                    </div>

                    <div className="space-y-3">
                        <div className="flex justify-between items-center">
                            <h3 className="font-bold text-gray-900 dark:text-white">Items</h3>
                            <button
                                type="button"
                                onClick={addItem}
                                className="text-blue-600 hover:text-blue-700 text-sm font-bold"
                            >
                                + Add Item
                            </button>
                        </div>
                        
                        {selectedItems.map((item, index) => (
                            <div key={index} className="flex gap-3 items-end p-3 bg-gray-50 dark:bg-gray-700/30 rounded-lg border dark:border-gray-700">
                                <div className="flex-1">
                                    <label className="block text-[10px] uppercase text-gray-400 mb-1">Item</label>
                                    <select
                                        required
                                        value={item.itemId}
                                        onChange={e => updateItem(index, 'itemId', e.target.value)}
                                        className="w-full px-2 py-1.5 border dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white"
                                    >
                                        <option value="">Select Item</option>
                                        {items.map(i => (
                                            <option key={i.id} value={i.id}>{i.name} ({i.sku})</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="w-24">
                                    <label className="block text-[10px] uppercase text-gray-400 mb-1">Qty</label>
                                    <input
                                        required
                                        type="number"
                                        min="1"
                                        value={item.quantity}
                                        onChange={e => updateItem(index, 'quantity', parseFloat(e.target.value))}
                                        className="w-full px-2 py-1.5 border dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white"
                                    />
                                </div>
                                <div className="w-32">
                                    <label className="block text-[10px] uppercase text-gray-400 mb-1">Unit Cost</label>
                                    <input
                                        required
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        value={item.unitCost}
                                        onChange={e => updateItem(index, 'unitCost', parseFloat(e.target.value))}
                                        className="w-full px-2 py-1.5 border dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white"
                                    />
                                </div>
                                <button
                                    type="button"
                                    onClick={() => removeItem(index)}
                                    className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                                >
                                    ✕
                                </button>
                            </div>
                        ))}
                    </div>

                    <div className="pt-4 border-t dark:border-gray-700 flex justify-between items-center">
                        <div>
                            <p className="text-sm text-gray-500">Total Amount</p>
                            <p className="text-2xl font-bold text-gray-900 dark:text-white">₹{totalAmount.toLocaleString()}</p>
                        </div>
                        <div className="flex gap-3">
                            <button
                                type="button"
                                onClick={onClose}
                                className="px-4 py-2 border dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 font-medium transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={selectedItems.length === 0 || !supplierId || isSaving}
                                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg font-medium shadow-lg shadow-blue-500/30 transition-all flex items-center gap-2"
                            >
                                {isSaving ? 'Creating...' : 'Create PO'}
                            </button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default CreatePurchaseOrderModal;
