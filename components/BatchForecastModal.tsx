import React, { useEffect } from 'react';
import type { BatchForecastResult } from '../types';

interface BatchForecastModalProps {
  isOpen: boolean;
  onClose: () => void;
  calculationResult: BatchForecastResult | null;
}

const BatchForecastModal: React.FC<BatchForecastModalProps> = ({ isOpen, onClose, calculationResult }) => {
    useEffect(() => {
        const handleEsc = (event: KeyboardEvent) => {
          if (event.key === 'Escape') {
            onClose();
          }
        };
        if (isOpen) {
          window.addEventListener('keydown', handleEsc);
        }
        return () => {
          window.removeEventListener('keydown', handleEsc);
        };
      }, [isOpen, onClose]);

    if (!isOpen || !calculationResult) return null;

    const { formula, maxBatches, limitingIngredientId, ingredientDetails } = calculationResult;

    return (
        <div 
          className="fixed inset-0 bg-black bg-opacity-60 z-50 flex justify-center items-center p-4" 
          onClick={onClose} 
          role="dialog" 
          aria-modal="true"
          aria-labelledby="forecast-modal-title"
        >
            <div 
                className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-2xl flex flex-col" 
                onClick={e => e.stopPropagation()}
                style={{ maxHeight: '80vh' }}
            >
                <div className="mb-4">
                    <h2 id="forecast-modal-title" className="text-xl font-bold text-gray-900 dark:text-white">Production Forecast Details</h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                        Based on formula: <span className="font-semibold">{formula.name}</span>
                    </p>
                </div>
                
                <div className="text-center bg-indigo-50 dark:bg-indigo-900/40 p-4 rounded-lg mb-4">
                    <p className="text-sm font-medium text-indigo-600 dark:text-indigo-300">Maximum Possible Batches</p>
                    <p className="text-5xl font-bold text-indigo-700 dark:text-indigo-200 mt-1">{maxBatches}</p>
                </div>

                <div className="overflow-y-auto flex-grow border dark:border-gray-700 rounded-md">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-gray-50 dark:bg-gray-700/50 sticky top-0">
                            <tr>
                                <th className="px-4 py-2 text-left font-semibold text-gray-700 dark:text-gray-300">Ingredient</th>
                                <th className="px-4 py-2 text-right font-semibold text-gray-700 dark:text-gray-300">Required/Batch</th>
                                <th className="px-4 py-2 text-right font-semibold text-gray-700 dark:text-gray-300">Available Stock</th>
                                <th className="px-4 py-2 text-right font-semibold text-gray-700 dark:text-gray-300">Possible Batches</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y dark:divide-gray-700">
                            {ingredientDetails.map(ing => (
                                <tr key={ing.itemId} className={`${ing.itemId === limitingIngredientId ? 'bg-orange-50 dark:bg-orange-900/30' : 'bg-white dark:bg-gray-800'}`}>
                                    <td className="px-4 py-2 font-medium text-gray-800 dark:text-gray-200">
                                        {ing.name}
                                        {ing.itemId === limitingIngredientId && <span className="ml-2 text-xs font-bold text-orange-600 dark:text-orange-400">(LIMITING FACTOR)</span>}
                                    </td>
                                    <td className="px-4 py-2 text-right text-gray-600 dark:text-gray-400">{ing.requiredQty.toLocaleString()} <span className="text-gray-500">{ing.uom}</span></td>
                                    <td className="px-4 py-2 text-right text-gray-600 dark:text-gray-400">{ing.availableStock.toLocaleString()} <span className="text-gray-500">{ing.uom}</span></td>
                                    <td className="px-4 py-2 text-right font-semibold text-gray-800 dark:text-gray-200">{ing.possibleBatches === Infinity ? '∞' : ing.possibleBatches.toLocaleString()}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <div className="mt-6 flex justify-end">
                    <button 
                        type="button" 
                        onClick={onClose} 
                        className="px-5 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-500 rounded-md shadow-sm hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
};

export default BatchForecastModal;
