import React, { useState, useEffect, useRef } from 'react';
import type { Item, Formula } from '../types';

interface CreateFormulaModalProps {
  isOpen: boolean;
  onClose: () => void;
  items: Item[];
  onAdd: (formula: Omit<Formula, 'id' | 'createdAt'>) => void;
}

const CreateFormulaModal = ({ isOpen, onClose, items, onAdd }) => {
    const getInitialState = () => ({
        name: '',
        outputProduct: '',
        outputQuantity: '',
        outputUom: 'kg',
    });

    const [formData, setFormData] = useState(getInitialState());
    const [ingredients, setIngredients] = useState<{itemId: string; quantity: string}[]>([{ itemId: '', quantity: '' }]);

    const modalRef = useRef<HTMLDivElement>(null);
    const firstInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (isOpen) {
            setFormData(getInitialState());
            setIngredients([{ itemId: items[0]?.id || '', quantity: '' }]);
            setTimeout(() => firstInputRef.current?.focus(), 100);
        }
    }, [isOpen, items]);

    useEffect(() => {
        const handleEsc = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
        if (isOpen) window.addEventListener('keydown', handleEsc);
        return () => window.removeEventListener('keydown', handleEsc);
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    const handleFormChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
    };
    
    const handleIngredientChange = (index: number, field: 'itemId' | 'quantity', value: string) => {
        const newIngredients = [...ingredients];
        newIngredients[index][field] = value;
        setIngredients(newIngredients);
    };

    const addIngredient = () => {
        setIngredients([...ingredients, { itemId: items[0]?.id || '', quantity: '' }]);
    };
    
    const removeIngredient = (index: number) => {
        if(ingredients.length > 1) {
            setIngredients(ingredients.filter((_, i) => i !== index));
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const outputQuantity = parseFloat(formData.outputQuantity);

        if(!formData.name || !formData.outputProduct || isNaN(outputQuantity) || outputQuantity <= 0) {
            alert('Please fill all formula details with valid values.');
            return;
        }

        const parsedIngredients = ingredients.map(ing => ({
            itemId: ing.itemId,
            quantity: parseFloat(ing.quantity)
        })).filter(ing => ing.itemId && !isNaN(ing.quantity) && ing.quantity > 0);

        if(parsedIngredients.length === 0) {
            alert('Please add at least one valid ingredient.');
            return;
        }

        onAdd({
            name: formData.name,
            outputProduct: formData.outputProduct,
            outputQuantity,
            outputUom: formData.outputUom,
            ingredients: parsedIngredients,
        });

        onClose();
    };

    const inputStyles = "block w-full px-3 py-1.5 text-sm bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500";

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex justify-center items-center p-4" onClick={onClose}>
            <div ref={modalRef} className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl flex flex-col" onClick={e => e.stopPropagation()}>
                <div className="p-6 pb-0">
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">Create New Formula</h2>
                </div>
                <form onSubmit={handleSubmit} className="flex flex-col overflow-hidden">
                    <div className="p-6 overflow-y-auto" style={{ maxHeight: '70vh' }}>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium">Formula Name</label>
                                <input ref={firstInputRef} type="text" name="name" value={formData.name} onChange={handleFormChange} className={inputStyles} required />
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div>
                                    <label className="block text-sm font-medium">Output Product Name</label>
                                    <input type="text" name="outputProduct" value={formData.outputProduct} onChange={handleFormChange} className={inputStyles} required />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium">Output Quantity</label>
                                    <input type="number" name="outputQuantity" value={formData.outputQuantity} onChange={handleFormChange} className={inputStyles} required min="0.01" step="0.01" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium">Output UOM</label>
                                    <input type="text" name="outputUom" value={formData.outputUom} onChange={handleFormChange} className={inputStyles} required />
                                </div>
                            </div>

                            <hr className="dark:border-gray-600"/>

                            <div>
                                <h3 className="text-lg font-semibold mb-2">Ingredients</h3>
                                <div className="space-y-3">
                                    {ingredients.map((ing, index) => (
                                        <div key={index} className="grid grid-cols-[1fr_auto_auto] md:grid-cols-[2fr_1fr_auto] gap-2 items-center">
                                            <select 
                                                value={ing.itemId} 
                                                onChange={e => handleIngredientChange(index, 'itemId', e.target.value)}
                                                className={inputStyles}
                                            >
                                                <option disabled value="">-- Select Item --</option>
                                                {items.map(item => <option key={item.id} value={item.id}>{item.name} ({item.sku})</option>)}
                                            </select>
                                            <input 
                                                type="number"
                                                placeholder="Quantity"
                                                value={ing.quantity}
                                                onChange={e => handleIngredientChange(index, 'quantity', e.target.value)}
                                                className={`${inputStyles} text-right`}
                                                min="0.01" step="0.01"
                                            />
                                            <button type="button" onClick={() => removeIngredient(index)} disabled={ingredients.length <= 1} className="p-2 text-red-500 disabled:text-gray-400 hover:bg-red-100 dark:hover:bg-red-900/50 rounded-full">
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM7 9a1 1 0 000 2h6a1 1 0 100-2H7z" clipRule="evenodd" /></svg>
                                            </button>
                                        </div>
                                    ))}
                                </div>
                                <button type="button" onClick={addIngredient} className="mt-3 text-sm font-semibold text-blue-600 hover:text-blue-800">+ Add Ingredient</button>
                            </div>
                        </div>
                    </div>
                    <div className="p-6 pt-0 flex justify-end space-x-3">
                        <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-500 rounded-md shadow-sm hover:bg-gray-50 dark:hover:bg-gray-600">Cancel</button>
                        <button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md shadow-sm hover:bg-blue-700">Create Formula</button>
                    </div>
                </form>
            </div>
        </div>
    );
};
export default CreateFormulaModal;
