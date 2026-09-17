
import React, { useState, useMemo } from 'react';
import type { Item, InflowTransaction, ConsumptionTransaction, Formula, Profile, ProfileTransaction, Die, ProductionPlan } from '../types';
import DeletedItemsTable from '../components/DeletedItemsTable';
import DeletedTransactionsTable from '../components/DeletedTransactionsTable';
import DeletedFormulasTable from '../components/DeletedFormulasTable';

interface TrashProps {
    items: Item[];
    inflowTransactions: InflowTransaction[];
    consumptionTransactions: ConsumptionTransaction[];
    formulas: Formula[];
    profiles: Profile[];
    profileTransactions: ProfileTransaction[];
    dies: Die[];
    productionPlans: ProductionPlan[];

    restoreItem: (itemId: string) => void;
    permanentlyDeleteItem: (itemId: string) => void;
    restoreTransaction: (id: string, type: 'inflow' | 'consumption') => void;
    permanentlyDeleteTransaction: (id: string, type: 'inflow' | 'consumption') => void;
    restoreFormula: (formulaId: string) => void;
    permanentlyDeleteFormula: (formulaId: string) => void;
    
    restoreProfile: (id: string) => void;
    permanentlyDeleteProfile: (id: string) => void;
    restoreProfileTransaction: (id: string) => void;
    permanentlyDeleteProfileTransaction: (id: string) => void;

    restoreDie: (id: string) => void;
    permanentlyDeleteDie: (id: string) => void;
    restoreProductionPlan: (id: string) => void;
    permanentlyDeleteProductionPlan: (id: string) => void;
}

type TrashTab = 'items' | 'transactions' | 'formulas' | 'profiles' | 'profile_logs' | 'dies' | 'plans';

const Trash = (props) => {
    const [activeTab, setActiveTab] = useState<TrashTab>('items');

    const deletedItems = useMemo(() => props.items.filter(i => i.deletedAt), [props.items]);
    const deletedFormulas = useMemo(() => props.formulas.filter(f => f.deletedAt), [props.formulas]);
    const deletedProfiles = useMemo(() => props.profiles.filter(p => p.deletedAt), [props.profiles]);
    const deletedProfileTransactions = useMemo(() => props.profileTransactions.filter(t => t.deletedAt), [props.profileTransactions]);
    const deletedDies = useMemo(() => props.dies.filter(d => d.deletedAt), [props.dies]);
    const deletedProductionPlans = useMemo(() => props.productionPlans.filter(p => p.deletedAt), [props.productionPlans]);
    
    const deletedTransactions = useMemo(() => {
        const deletedInflow = props.inflowTransactions.filter(t => t.deletedAt).map(tx => ({
            id: tx.id,
            refNo: tx.refNo,
            deletedAt: tx.deletedAt,
            type: 'Inflow' as const
        }));
        
        const deletedConsumption = props.consumptionTransactions.filter(t => t.deletedAt).map(tx => ({
            id: tx.id,
            refNo: tx.refNo,
            deletedAt: tx.deletedAt,
            type: 'Consumption' as const
        }));
        
        return [...deletedInflow, ...deletedConsumption].sort((a,b) => new Date(b.deletedAt!).getTime() - new Date(a.deletedAt!).getTime());

    }, [props.inflowTransactions, props.consumptionTransactions]);


    const tabs: { id: TrashTab; label: string, count: number }[] = [
        { id: 'items', label: 'RM Items', count: deletedItems.length },
        { id: 'transactions', label: 'RM Logs', count: deletedTransactions.length },
        { id: 'formulas', label: 'Formulas', count: deletedFormulas.length },
        { id: 'profiles', label: 'Profiles', count: deletedProfiles.length },
        { id: 'profile_logs', label: 'Profile Logs', count: deletedProfileTransactions.length },
        { id: 'dies', label: 'Dies', count: deletedDies.length },
        { id: 'plans', label: 'Plans', count: deletedProductionPlans.length },
    ];

    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Trash & Recovery</h1>
            </div>
            
            <div className="mb-6 border-b border-gray-200 dark:border-gray-700 overflow-x-auto">
                <nav className="-mb-px flex space-x-6" aria-label="Tabs">
                    {tabs.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`${
                                activeTab === tab.id
                                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:border-gray-500'
                            } whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm focus:outline-none flex items-center gap-2 transition-colors`}
                        >
                            {tab.label}
                            {tab.count > 0 && <span className="bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-xs font-semibold px-2 py-0.5 rounded-full">{tab.count}</span>}
                        </button>
                    ))}
                </nav>
            </div>

            <div>
                {activeTab === 'items' && <DeletedItemsTable items={deletedItems} restoreItem={props.restoreItem} permanentlyDeleteItem={props.permanentlyDeleteItem} />}
                {activeTab === 'transactions' && <DeletedTransactionsTable transactions={deletedTransactions} restoreTransaction={props.restoreTransaction} permanentlyDeleteTransaction={props.permanentlyDeleteTransaction} />}
                {activeTab === 'formulas' && <DeletedFormulasTable formulas={deletedFormulas} restoreFormula={props.restoreFormula} permanentlyDeleteFormula={props.permanentlyDeleteFormula} />}
                {activeTab === 'profiles' && (
                    <div className="bg-white dark:bg-gray-800 rounded-md shadow">
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left text-gray-600 dark:text-gray-400">
                                <thead className="text-xs text-gray-700 dark:text-gray-300 uppercase bg-gray-50 dark:bg-gray-700">
                                    <tr>
                                        <th className="px-6 py-3">Brand</th>
                                        <th className="px-6 py-3">SKU</th>
                                        <th className="px-6 py-3">Name</th>
                                        <th className="px-6 py-3">Deleted On</th>
                                        <th className="px-6 py-3 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {deletedProfiles.length === 0 ? (
                                        <tr><td colSpan={5} className="text-center py-8">No deleted profiles.</td></tr>
                                    ) : (
                                        deletedProfiles.map(p => (
                                            <tr key={p.id} className="bg-white dark:bg-gray-800 border-b dark:border-gray-700">
                                                <td className="px-6 py-4">{p.brand}</td>
                                                <td className="px-6 py-4 font-medium">{p.sku}</td>
                                                <td className="px-6 py-4">{p.name}</td>
                                                <td className="px-6 py-4">{p.deletedAt ? new Date(p.deletedAt).toLocaleString() : ''}</td>
                                                <td className="px-6 py-4 text-right space-x-4">
                                                    <button onClick={() => props.restoreProfile(p.id)} className="text-green-500 hover:underline font-medium">Restore</button>
                                                    <button onClick={() => props.permanentlyDeleteProfile(p.id)} className="text-red-500 hover:underline font-medium">Delete Forever</button>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
                {activeTab === 'profile_logs' && (
                    <div className="bg-white dark:bg-gray-800 rounded-md shadow">
                         <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left text-gray-600 dark:text-gray-400">
                                <thead className="text-xs text-gray-700 dark:text-gray-300 uppercase bg-gray-50 dark:bg-gray-700">
                                    <tr>
                                        <th className="px-6 py-3">Type</th>
                                        <th className="px-6 py-3">Ref No.</th>
                                        <th className="px-6 py-3">Date</th>
                                        <th className="px-6 py-3">Deleted On</th>
                                        <th className="px-6 py-3 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {deletedProfileTransactions.length === 0 ? (
                                        <tr><td colSpan={5} className="text-center py-8">No deleted logs.</td></tr>
                                    ) : (
                                        deletedProfileTransactions.map(t => (
                                            <tr key={t.id} className="bg-white dark:bg-gray-800 border-b dark:border-gray-700">
                                                <td className="px-6 py-4">{t.type}</td>
                                                <td className="px-6 py-4 font-medium">{t.refNo}</td>
                                                <td className="px-6 py-4">{new Date(t.date).toLocaleDateString()}</td>
                                                <td className="px-6 py-4">{t.deletedAt ? new Date(t.deletedAt).toLocaleString() : ''}</td>
                                                <td className="px-6 py-4 text-right space-x-4">
                                                    <button onClick={() => props.restoreProfileTransaction(t.id)} className="text-green-500 hover:underline font-medium">Restore</button>
                                                    <button onClick={() => props.permanentlyDeleteProfileTransaction(t.id)} className="text-red-500 hover:underline font-medium">Delete Forever</button>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
                 {activeTab === 'dies' && (
                    <div className="bg-white dark:bg-gray-800 rounded-md shadow">
                         <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left text-gray-600 dark:text-gray-400">
                                <thead className="text-xs text-gray-700 dark:text-gray-300 uppercase bg-gray-50 dark:bg-gray-700">
                                    <tr>
                                        <th className="px-6 py-3">Die No.</th>
                                        <th className="px-6 py-3">Deleted On</th>
                                        <th className="px-6 py-3 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {deletedDies.length === 0 ? (
                                        <tr><td colSpan={3} className="text-center py-8">No deleted dies.</td></tr>
                                    ) : (
                                        deletedDies.map(d => (
                                            <tr key={d.id} className="bg-white dark:bg-gray-800 border-b dark:border-gray-700">
                                                <td className="px-6 py-4 font-medium">{d.dieNo}</td>
                                                <td className="px-6 py-4">{d.deletedAt ? new Date(d.deletedAt).toLocaleString() : ''}</td>
                                                <td className="px-6 py-4 text-right space-x-4">
                                                    <button onClick={() => props.restoreDie(d.id)} className="text-green-500 hover:underline font-medium">Restore</button>
                                                    <button onClick={() => props.permanentlyDeleteDie(d.id)} className="text-red-500 hover:underline font-medium">Delete Forever</button>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
                 {activeTab === 'plans' && (
                    <div className="bg-white dark:bg-gray-800 rounded-md shadow">
                         <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left text-gray-600 dark:text-gray-400">
                                <thead className="text-xs text-gray-700 dark:text-gray-300 uppercase bg-gray-50 dark:bg-gray-700">
                                    <tr>
                                        <th className="px-6 py-3">Date</th>
                                        <th className="px-6 py-3">Shift</th>
                                        <th className="px-6 py-3">Machine No.</th>
                                        <th className="px-6 py-3">Deleted On</th>
                                        <th className="px-6 py-3 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {deletedProductionPlans.length === 0 ? (
                                        <tr><td colSpan={5} className="text-center py-8">No deleted plans.</td></tr>
                                    ) : (
                                        deletedProductionPlans.map(p => (
                                            <tr key={p.id} className="bg-white dark:bg-gray-800 border-b dark:border-gray-700">
                                                <td className="px-6 py-4">{new Date(p.date).toLocaleDateString()}</td>
                                                <td className="px-6 py-4">{p.shift}</td>
                                                <td className="px-6 py-4">{p.machineNo}</td>
                                                <td className="px-6 py-4">{p.deletedAt ? new Date(p.deletedAt).toLocaleString() : ''}</td>
                                                <td className="px-6 py-4 text-right space-x-4">
                                                    <button onClick={() => props.restoreProductionPlan(p.id)} className="text-green-500 hover:underline font-medium">Restore</button>
                                                    <button onClick={() => props.permanentlyDeleteProductionPlan(p.id)} className="text-red-500 hover:underline font-medium">Delete Forever</button>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Trash;
