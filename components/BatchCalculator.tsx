import React from 'react';
import type { Formula, BatchForecastResult } from '../types';
import { Card } from './Card';
import { SparklesIcon } from './Icon';


interface BatchCalculatorProps {
    formulas: Formula[];
    selectedFormulaId: string;
    onFormulaChange: (id: string) => void;
    calculationResult: BatchForecastResult | null;
    onForecastClick: (result: BatchForecastResult) => void;
}

const BatchCalculator = ({ formulas, selectedFormulaId, onFormulaChange, calculationResult, onForecastClick }) => {
    return (
        <Card>
            <div className="flex items-center mb-4">
                <SparklesIcon className="w-6 h-6 mr-3 text-indigo-500" />
                <h2 className="text-xl font-semibold">Production Forecaster</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                 <div>
                    <label htmlFor="formula-select" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Select a Formula to Forecast
                    </label>
                    <select
                        id="formula-select"
                        value={selectedFormulaId}
                        onChange={(e) => onFormulaChange(e.target.value)}
                        className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 dark:bg-gray-700 dark:border-gray-600 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
                    >
                        <option value="">-- Select Formula --</option>
                        {formulas.map(f => (
                            <option key={f.id} value={f.id}>{f.name}</option>
                        ))}
                    </select>
                </div>
                 {calculationResult && (
                    <button 
                        onClick={() => onForecastClick(calculationResult)}
                        className="text-center bg-indigo-50 dark:bg-indigo-900/40 p-4 rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 transition-colors"
                        aria-label="View forecast details"
                    >
                        <p className="text-sm font-medium text-indigo-600 dark:text-indigo-300">Maximum Possible Batches</p>
                        <p className="text-4xl font-bold text-indigo-700 dark:text-indigo-200 mt-1">{calculationResult.maxBatches}</p>
                    </button>
                 )}
            </div>

            {calculationResult && (
                <div className="mt-6">
                    <p className="text-sm mb-2">Based on your current stock levels for <span className="font-semibold">{calculationResult.formula.name}</span>:</p>
                    <div className="overflow-x-auto border dark:border-gray-700 rounded-md">
                        <table className="w-full text-sm">
                            <thead className="bg-gray-50 dark:bg-gray-700/50">
                                <tr>
                                    <th className="px-4 py-2 text-left font-semibold">Ingredient</th>
                                    <th className="px-4 py-2 text-right font-semibold">Required/Batch</th>
                                    <th className="px-4 py-2 text-right font-semibold">Available Stock</th>
                                    <th className="px-4 py-2 text-right font-semibold">Possible Batches</th>
                                </tr>
                            </thead>
                            <tbody>
                                {calculationResult.ingredientDetails.slice(0, 3).map(ing => (
                                    <tr key={ing.itemId} className={`border-t dark:border-gray-700 ${ing.itemId === calculationResult.limitingIngredientId ? 'bg-orange-50 dark:bg-orange-900/30' : ''}`}>
                                        <td className="px-4 py-2 font-medium">
                                            {ing.name}
                                            {ing.itemId === calculationResult.limitingIngredientId && <span className="ml-2 text-xs font-bold text-orange-600 dark:text-orange-400">(LIMITING)</span>}
                                        </td>
                                        <td className="px-4 py-2 text-right">{ing.requiredQty.toLocaleString()} <span className="text-gray-500">{ing.uom}</span></td>
                                        <td className="px-4 py-2 text-right">{ing.availableStock.toLocaleString()} <span className="text-gray-500">{ing.uom}</span></td>
                                        <td className="px-4 py-2 text-right font-bold">{ing.possibleBatches === Infinity ? '∞' : ing.possibleBatches.toLocaleString()}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                     {calculationResult.ingredientDetails.length > 3 && (
                        <p className="text-xs text-center mt-2 text-gray-500">
                            And {calculationResult.ingredientDetails.length - 3} more ingredients. <button onClick={() => onForecastClick(calculationResult)} className="text-blue-500 hover:underline font-semibold">View all</button>.
                        </p>
                     )}
                </div>
            )}
             {!calculationResult && selectedFormulaId && (
                <p className="mt-4 text-center text-gray-500">Could not find details for the selected formula.</p>
             )}
        </Card>
    );
};

export default BatchCalculator;