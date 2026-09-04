import React, { useState } from 'react';
import type { Item, Formula, User } from '../types';
import CreateFormulaModal from './CreateFormulaModal';
import EditFormulaModal from './EditFormulaModal';

interface FormulasViewProps {
    items: Item[];
    formulas: Formula[];
    addFormula: (formula: Omit<Formula, 'id' | 'createdAt'>) => void;
    updateFormula: (formula: Formula) => void;
    deleteFormula: (formulaId: string) => void;
    onUseFormula: (formulaId: string) => void;
}

const FormulasView: React.FC<FormulasViewProps> = ({ items, formulas, addFormula, updateFormula, deleteFormula, onUseFormula }) => {
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [editingFormula, setEditingFormula] = useState<Formula | null>(null);

    const itemMap = new Map<string, Item>(items.map(item => [item.id, item]));
    const canManage = true; // All permissions enabled

    return (
        <>
            <div className="flex justify-end mb-6">
                {canManage && (
                    <button 
                        onClick={() => setIsCreateModalOpen(true)}
                        className="bg-green-600 text-white px-5 py-2 rounded-md text-sm font-semibold hover:bg-green-700 shadow focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                    >
                        Create Formula
                    </button>
                )}
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-md shadow">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left text-gray-600 dark:text-gray-400">
                        <thead className="text-xs text-gray-700 dark:text-gray-300 uppercase bg-gray-50 dark:bg-gray-700">
                            <tr>
                                <th scope="col" className="px-6 py-3">Formula Name</th>
                                <th scope="col" className="px-6 py-3">Output</th>
                                <th scope="col" className="px-6 py-3">Ingredients</th>
                                <th scope="col" className="px-6 py-3"><span className="sr-only">Actions</span></th>
                            </tr>
                        </thead>
                        <tbody>
                            {formulas.length === 0 ? (
                                <tr>
                                    <td colSpan={4} className="text-center py-8 text-gray-500 dark:text-gray-400">No formulas created yet.</td>
                                </tr>
                            ) : (
                                formulas.map(formula => (
                                    <tr key={formula.id} className="bg-white dark:bg-gray-800 border-b dark:border-gray-700">
                                        <th scope="row" className="px-6 py-4 font-medium text-gray-900 dark:text-white">{formula.name}</th>
                                        <td className="px-6 py-4">{formula.outputQuantity} {formula.outputUom} of {formula.outputProduct}</td>
                                        <td className="px-6 py-4">
                                            <ul className="list-disc list-inside">
                                                {formula.ingredients.map(ing => {
                                                    const item = itemMap.get(ing.itemId);
                                                    return (
                                                        <li key={ing.itemId}>{item?.name || 'Unknown Item'}: {ing.quantity} {item?.uom || ''}</li>
                                                    );
                                                })}
                                            </ul>
                                        </td>
                                        <td className="px-6 py-4 text-right space-x-4">
                                            <button onClick={() => onUseFormula(formula.id)} className="font-medium text-green-500 hover:underline">Use</button>
                                            {canManage && (
                                                <>
                                                    <button onClick={() => setEditingFormula(formula)} className="font-medium text-blue-500 hover:underline">Edit</button>
                                                    <button onClick={() => deleteFormula(formula.id)} className="font-medium text-red-500 hover:underline">Delete</button>
                                                </>
                                            )}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <CreateFormulaModal
                isOpen={isCreateModalOpen}
                onClose={() => setIsCreateModalOpen(false)}
                items={items}
                onAdd={addFormula}
            />

            {editingFormula && (
                <EditFormulaModal
                    isOpen={!!editingFormula}
                    onClose={() => setEditingFormula(null)}
                    formula={editingFormula}
                    items={items}
                    onUpdate={updateFormula}
                />
            )}
        </>
    );
};

export default FormulasView;