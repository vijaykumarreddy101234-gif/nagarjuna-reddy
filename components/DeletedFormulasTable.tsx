import React from 'react';
import type { Formula } from '../types';

interface DeletedFormulasTableProps {
  formulas: Formula[];
  restoreFormula: (formulaId: string) => void;
  permanentlyDeleteFormula: (formulaId: string) => void;
}

const DeletedFormulasTable: React.FC<DeletedFormulasTableProps> = ({ formulas, restoreFormula, permanentlyDeleteFormula }) => {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-md shadow">
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left text-gray-600 dark:text-gray-400">
          <thead className="text-xs text-gray-700 dark:text-gray-300 uppercase bg-gray-50 dark:bg-gray-700">
            <tr>
              <th scope="col" className="px-6 py-3">Formula Name</th>
              <th scope="col" className="px-6 py-3">Output Product</th>
              <th scope="col" className="px-6 py-3">Deleted On</th>
              <th scope="col" className="px-6 py-3"><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody>
            {formulas.length === 0 ? (
                <tr>
                    <td colSpan={4} className="text-center py-8 text-gray-500 dark:text-gray-400">No deleted formulas.</td>
                </tr>
            ) : (
                formulas.map(formula => (
                      <tr key={formula.id} className="bg-white dark:bg-gray-800 border-b dark:border-gray-700">
                        <th scope="row" className="px-6 py-4 font-medium text-gray-900 dark:text-white whitespace-nowrap">{formula.name}</th>
                        <td className="px-6 py-4">{formula.outputProduct}</td>
                        <td className="px-6 py-4">{formula.deletedAt ? new Date(formula.deletedAt).toLocaleString() : ''}</td>
                        <td className="px-6 py-4 text-right space-x-4">
                            <button onClick={() => restoreFormula(formula.id)} className="font-medium text-green-500 hover:underline">Restore</button>
                            <button onClick={() => permanentlyDeleteFormula(formula.id)} className="font-medium text-red-500 hover:underline">Delete Permanently</button>
                        </td>
                      </tr>
                ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default DeletedFormulasTable;
