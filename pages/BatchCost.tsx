
import React, { useMemo } from 'react';
import { Card } from '../components/Card';
import type { Item, Formula } from '../types';

interface BatchCostProps {
    formulas: Formula[];
    items: Item[];
    updateItem: (item: Item) => void;
    updateFormula: (formula: Formula) => void;
}

const BatchCost: React.FC<BatchCostProps> = ({ formulas, items, updateItem, updateFormula }) => {
    const itemMap = useMemo(() => new Map(items.map(i => [i.id, i])), [items]);

    const handleRateChange = (formulaId: string, itemId: string, val: string) => {
        const newRate = parseFloat(val);
        const formula = formulas.find(f => f.id === formulaId);
        if (formula) {
            const newIngredients = formula.ingredients.map(ing => 
                ing.itemId === itemId ? { ...ing, costPrice: isNaN(newRate) ? 0 : newRate } : ing
            );
            updateFormula({ ...formula, ingredients: newIngredients });
        }
    };

    const handleGstChange = (formulaId: string, itemId: string, val: string) => {
        const newGst = parseFloat(val);
        const formula = formulas.find(f => f.id === formulaId);
        if (formula) {
            const newIngredients = formula.ingredients.map(ing => 
                ing.itemId === itemId ? { ...ing, gstPercent: isNaN(newGst) ? 0 : newGst } : ing
            );
            updateFormula({ ...formula, ingredients: newIngredients });
        }
    };

    const handleQtyChange = (formulaId: string, itemId: string, val: string) => {
        const newQty = parseFloat(val);
        const formula = formulas.find(f => f.id === formulaId);
        if (formula) {
            const newIngredients = formula.ingredients.map(ing => 
                ing.itemId === itemId ? { ...ing, quantity: isNaN(newQty) ? 0 : newQty } : ing
            );
            updateFormula({ ...formula, ingredients: newIngredients });
        }
    };

    const handleBatchSizeChange = (formulaId: string, val: string) => {
        const newSize = parseFloat(val);
        const formula = formulas.find(f => f.id === formulaId);
        if (formula) {
            updateFormula({ ...formula, outputQuantity: isNaN(newSize) ? 0 : newSize });
        }
    };

    const formulaCosts = useMemo(() => {
        return formulas.map(formula => {
            let totalCost = 0;
            let totalQty = 0;
            const ingredientCosts = formula.ingredients.map(ing => {
                const item = itemMap.get(ing.itemId);
                const qty = isNaN(ing.quantity) ? 0 : ing.quantity;
                
                // Use override if available, otherwise use global item rate
                const unitCost = ing.costPrice !== undefined ? ing.costPrice : (isNaN(item?.costPrice || 0) ? 0 : (item?.costPrice || 0));
                const gstPercent = ing.gstPercent !== undefined ? ing.gstPercent : (isNaN(item?.gstPercent || 0) ? 0 : (item?.gstPercent || 0));
                
                const baseCost = unitCost * qty;
                const gstAmount = baseCost * (gstPercent / 100);
                const totalWithGst = baseCost + gstAmount;
                totalCost += totalWithGst;
                totalQty += qty;
                return {
                    itemId: ing.itemId,
                    name: item?.name || 'Unknown',
                    qty: qty,
                    uom: item?.uom || '',
                    unitCost: unitCost,
                    gstPercent: gstPercent,
                    gstAmount: gstAmount,
                    total: totalWithGst
                };
            });

            const costPerUnit = formula.outputQuantity > 0 ? totalCost / formula.outputQuantity : 0;

            return {
                ...formula,
                totalCost,
                totalQty,
                costPerUnit,
                ingredientCosts
            };
        });
    }, [formulas, itemMap]);

    return (
        <div className="space-y-6">
            <Card>
                <h2 className="text-xl font-display font-black uppercase italic text-slate-900 dark:text-white mb-4">Batch Cost Analysis</h2>
                <p className="text-sm text-gray-500 mb-6">
                    Calculated cost per batch based on current item purchase rates. You can edit <b>Batch Size</b>, <b>Ingredient Qty</b>, <b>Item Rate</b>, and <b>GST %</b> directly.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {formulaCosts.map(formula => (
                        <div key={formula.id} className="border dark:border-gray-700 rounded-xl overflow-hidden bg-white dark:bg-gray-800 shadow-sm">
                            <div className="bg-gray-50 dark:bg-gray-700/50 p-4 border-b dark:border-gray-700">
                                <div className="flex justify-between items-start mb-2">
                                    <h3 className="font-bold text-lg text-gray-900 dark:text-white">{formula.name}</h3>
                                    <div className="text-right">
                                        <p className="text-xs text-gray-500 uppercase tracking-wider">Total Batch Cost (Inc. GST)</p>
                                        <p className="text-xl font-bold text-green-600">₹{formula.totalCost.toLocaleString()}</p>
                                    </div>
                                </div>
                                <div className="flex justify-between items-center bg-white/50 dark:bg-black/20 p-2 rounded-lg border dark:border-gray-600">
                                    <div className="flex flex-col gap-1">
                                        <div className="flex items-center gap-2">
                                            <span className="text-[10px] text-gray-500 uppercase w-16">Batch Size:</span>
                                            <div className="flex items-center gap-1">
                                                <input
                                                    type="number"
                                                    value={isNaN(formula.outputQuantity) ? '' : formula.outputQuantity}
                                                    onChange={(e) => handleBatchSizeChange(formula.id, e.target.value)}
                                                    className="w-20 px-2 py-1 border dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-sm font-bold text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                                                />
                                                <span className="text-sm font-medium text-gray-600 dark:text-gray-400">{formula.outputUom}</span>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-[10px] text-gray-500 uppercase w-16">Input Qty:</span>
                                            <span className="text-sm font-bold text-gray-700 dark:text-gray-300">{formula.totalQty.toLocaleString()} kg</span>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className="flex flex-col">
                                            <span className="text-[10px] text-gray-500 uppercase block">Cost per {formula.outputUom}</span>
                                            <span className="text-sm font-bold text-blue-600">₹{formula.costPerUnit.toFixed(2)}</span>
                                            <span className="text-[10px] text-gray-400 uppercase mt-1">Cost per KG (Input)</span>
                                            <span className="text-xs font-bold text-gray-600 dark:text-gray-400">₹{(formula.totalCost / (formula.totalQty || 1)).toFixed(2)}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div className="p-4">
                                <table className="w-full text-xs">
                                    <thead>
                                        <tr className="text-gray-400 border-b dark:border-gray-700">
                                            <th className="text-left py-2">Ingredient</th>
                                            <th className="text-right py-2">Qty</th>
                                            <th className="text-right py-2">Rate</th>
                                            <th className="text-right py-2">GST %</th>
                                            <th className="text-right py-2">Total</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y dark:divide-gray-700">
                                        {formula.ingredientCosts.map((ing, idx) => (
                                            <tr key={idx}>
                                                <td className="py-2 text-gray-700 dark:text-gray-300">{ing.name}</td>
                                                <td className="py-2 text-right">
                                                    <div className="flex items-center justify-end gap-1">
                                                        <input
                                                            type="number"
                                                            value={isNaN(ing.qty) ? '' : ing.qty}
                                                            onChange={(e) => handleQtyChange(formula.id, ing.itemId, e.target.value)}
                                                            className="w-16 px-1 py-0.5 border dark:border-gray-600 rounded bg-transparent text-right text-gray-900 dark:text-white focus:ring-1 focus:ring-blue-500 outline-none"
                                                        />
                                                        <span className="text-gray-400">{ing.uom}</span>
                                                    </div>
                                                </td>
                                                <td className="py-2 text-right">
                                                    <div className="flex items-center justify-end gap-1">
                                                        <span className="text-gray-400">₹</span>
                                                        <input
                                                            type="number"
                                                            value={isNaN(ing.unitCost) ? '' : ing.unitCost}
                                                            onChange={(e) => handleRateChange(formula.id, ing.itemId, e.target.value)}
                                                            className="w-16 px-1 py-0.5 border dark:border-gray-600 rounded bg-transparent text-right text-gray-900 dark:text-white focus:ring-1 focus:ring-blue-500 outline-none"
                                                        />
                                                    </div>
                                                </td>
                                                <td className="py-2 text-right">
                                                    <div className="flex items-center justify-end gap-1">
                                                        <input
                                                            type="number"
                                                            value={isNaN(ing.gstPercent) ? '' : ing.gstPercent}
                                                            onChange={(e) => handleGstChange(formula.id, ing.itemId, e.target.value)}
                                                            className="w-12 px-1 py-0.5 border dark:border-gray-600 rounded bg-transparent text-right text-gray-900 dark:text-white focus:ring-1 focus:ring-blue-500 outline-none"
                                                        />
                                                        <span className="text-gray-400">%</span>
                                                    </div>
                                                </td>
                                                <td className="py-2 text-right font-medium text-gray-900 dark:text-white">₹{ing.total.toLocaleString()}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                    <tfoot>
                                        <tr className="border-t-2 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/30 font-bold">
                                            <td className="py-2 text-gray-900 dark:text-white">Total Input</td>
                                            <td className="py-2 text-right text-blue-600">{formula.totalQty.toLocaleString()}</td>
                                            <td colSpan={2}></td>
                                            <td className="py-2 text-right text-green-600">₹{formula.totalCost.toLocaleString()}</td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>
                        </div>
                    ))}
                    {formulaCosts.length === 0 && (
                        <div className="col-span-2 text-center py-12 text-gray-500">
                            No formulas found. Create a formula in the Consumption tab to see batch costs.
                        </div>
                    )}
                </div>
            </Card>
        </div>
    );
};

export default BatchCost;
