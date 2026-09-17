import React, { useState } from 'react';
import { motion } from 'motion/react';
import { useStore } from '../store/useStore';
import { Card } from '../components/Card';
import { SpinnerIcon } from '../components/Icon';
import ReactMarkdown from 'react-markdown';

const Mails = () => {
    const suppliers = useStore(state => state.suppliers);
    const items = useStore(state => state.items);
    const profiles = useStore(state => state.profiles);
    const inflowTransactions = useStore(state => state.inflowTransactions);
    const consumptionTransactions = useStore(state => state.consumptionTransactions);

    const [selectedTemplate, setSelectedTemplate] = useState<'Supplier RFQ Email' | 'Shortage Analysis' | 'Daily Status Memo' | 'Custom Intelligence'>('Supplier RFQ Email');
    const [selectedSupplier, setSelectedSupplier] = useState(suppliers[0]?.name || '');
    const [selectedMaterial, setSelectedMaterial] = useState(items[0]?.name || profiles[0]?.name || '');
    const [requiredQuantity, setRequiredQuantity] = useState('10,000 KG');
    const [customQuery, setCustomQuery] = useState('');
    const [answer, setAnswer] = useState('');
    const [loading, setLoading] = useState(false);
    const [copied, setCopied] = useState(false);

    const handleGenerate = async () => {
        setLoading(true);
        setAnswer('');
        try {
            const inventoryData = {
                suppliers,
                items,
                profiles: profiles.slice(0, 10),
                totalInflowTxns: inflowTransactions.length,
                totalConsumptionTxns: consumptionTransactions.length,
            };

            const response = await fetch('/api/ai/procurement', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    templateType: selectedTemplate,
                    supplierName: selectedSupplier,
                    materialName: selectedMaterial,
                    requiredQuantity,
                    customQuery,
                    inventoryData
                })
            });
            const data = await response.json();
            if (data.answer) {
                setAnswer(data.answer);
            } else {
                setAnswer('Error generating AI response.');
            }
        } catch (e) {
            console.error(e);
            setAnswer('Failed to connect to AI assistant.');
        } finally {
            setLoading(false);
        }
    };

    const handleCopy = () => {
        navigator.clipboard.writeText(answer);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
            {/* Header Banner */}
            <div className="p-6 sm:p-8 rounded-3xl bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-700 text-white shadow-xl relative overflow-hidden">
                <div className="absolute right-0 top-0 translate-x-8 -translate-y-8 w-64 h-64 bg-white/10 rounded-full blur-2xl pointer-events-none" />
                <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center font-black text-xl shadow-inner">
                        🤖
                    </div>
                    <h1 className="text-2xl sm:text-3xl font-display font-black tracking-tight">Workspace AI & Procurement Assistant</h1>
                </div>
                <p className="text-white/80 text-sm max-w-3xl font-medium leading-relaxed">
                    Generate procurement RFQ emails, analyze inventory shortages, and compose shift briefings powered by real-time inventory and production data.
                </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Left Controls */}
                <div className="lg:col-span-5 space-y-6">
                    <Card className="p-6 space-y-6">
                        <div>
                            <label className="block text-xs font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-3">
                                Select Template Prompt
                            </label>
                            <div className="space-y-2">
                                {[
                                    { id: 'Supplier RFQ Email', title: 'Supplier RFQ Email', desc: 'Draft RFQ for raw materials' },
                                    { id: 'Shortage Analysis', title: 'Shortage Analysis', desc: 'Scan low stock & reorder needs' },
                                    { id: 'Daily Status Memo', title: 'Daily Status Memo', desc: 'Executive factory summary' },
                                    { id: 'Custom Intelligence', title: 'Custom Intelligence', desc: 'Ask custom query' },
                                ].map(t => (
                                    <button
                                        key={t.id}
                                        onClick={() => setSelectedTemplate(t.id as any)}
                                        className={`w-full text-left p-3.5 rounded-2xl transition-all border ${
                                            selectedTemplate === t.id
                                                ? 'bg-primary-600 text-white border-primary-600 shadow-lg shadow-primary-500/20'
                                                : 'bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 border-slate-200 dark:border-slate-700'
                                        }`}
                                    >
                                        <p className="text-sm font-black tracking-tight">{t.title}</p>
                                        <p className={`text-[11px] font-medium mt-0.5 ${selectedTemplate === t.id ? 'text-primary-100' : 'text-slate-500 dark:text-slate-400'}`}>{t.desc}</p>
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="space-y-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                            <div>
                                <label className="block text-xs font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-2">
                                    Target Supplier
                                </label>
                                <select
                                    value={selectedSupplier}
                                    onChange={(e) => setSelectedSupplier(e.target.value)}
                                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm font-bold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-primary-500"
                                >
                                    {suppliers.map(s => (
                                        <option key={s.id} value={s.name}>{s.name} ({s.contactPerson})</option>
                                    ))}
                                    <option value="All Suppliers">All Suppliers</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-xs font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-2">
                                    Material / Profile
                                </label>
                                <select
                                    value={selectedMaterial}
                                    onChange={(e) => setSelectedMaterial(e.target.value)}
                                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm font-bold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-primary-500"
                                >
                                    {items.map(i => (
                                        <option key={i.id} value={i.name}>{i.name} ({i.sku})</option>
                                    ))}
                                    {profiles.map(p => (
                                        <option key={p.id} value={p.name}>{p.name} ({p.sku})</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-xs font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-2">
                                    Required Quantity
                                </label>
                                <input
                                    type="text"
                                    value={requiredQuantity}
                                    onChange={(e) => setRequiredQuantity(e.target.value)}
                                    placeholder="e.g. 10,000 KG"
                                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm font-bold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-primary-500"
                                />
                            </div>

                            {selectedTemplate === 'Custom Intelligence' && (
                                <div>
                                    <label className="block text-xs font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-2">
                                        Custom Query / Instructions
                                    </label>
                                    <textarea
                                        rows={3}
                                        value={customQuery}
                                        onChange={(e) => setCustomQuery(e.target.value)}
                                        placeholder="Ask any question about inventory, cost optimization, or production planning..."
                                        className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-sm font-bold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-primary-500"
                                    />
                                </div>
                            )}
                        </div>

                        <button
                            onClick={handleGenerate}
                            disabled={loading}
                            className="w-full py-4 bg-gradient-to-r from-primary-600 to-indigo-600 hover:from-primary-700 hover:to-indigo-700 text-white rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-lg shadow-primary-500/25 flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                            {loading ? <SpinnerIcon className="w-5 h-5 animate-spin" /> : <span>✨ GENERATE DRAFT</span>}
                        </button>
                    </Card>
                </div>

                {/* Right Output */}
                <div className="lg:col-span-7">
                    <Card className="p-6 h-full flex flex-col min-h-[550px] bg-slate-900 text-white border-slate-800">
                        <div className="flex items-center justify-between pb-4 border-b border-white/10 mb-6">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-xl bg-primary-500/20 text-primary-400 flex items-center justify-center font-black">
                                    📄
                                </div>
                                <div>
                                    <h3 className="font-display font-black text-sm uppercase tracking-wider text-white">Generated Communication & Intelligence</h3>
                                    <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">Powered by Gemini AI & Real-time ERP Data</p>
                                </div>
                            </div>
                            {answer && (
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={handleCopy}
                                        className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5"
                                    >
                                        {copied ? '✓ Copied!' : '📋 Copy'}
                                    </button>
                                </div>
                            )}
                        </div>

                        <div className="flex-1 overflow-y-auto">
                            {loading ? (
                                <div className="h-full flex flex-col items-center justify-center py-20 text-center">
                                    <SpinnerIcon className="w-10 h-10 animate-spin text-primary-500 mb-4" />
                                    <p className="text-slate-400 font-bold text-sm tracking-tight">AI is analyzing inventory & drafting communication...</p>
                                </div>
                            ) : answer ? (
                                <motion.div
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="prose prose-invert max-w-none text-slate-200 text-sm leading-relaxed"
                                >
                                    <ReactMarkdown>{answer}</ReactMarkdown>
                                </motion.div>
                            ) : (
                                <div className="h-full flex flex-col items-center justify-center py-24 text-center">
                                    <div className="w-16 h-16 rounded-3xl bg-white/5 border border-white/10 flex items-center justify-center text-3xl mb-4 shadow-inner">
                                        🤖
                                    </div>
                                    <h4 className="font-display font-black text-white text-base mb-1">Ready to assist</h4>
                                    <p className="text-xs text-slate-400 max-w-xs leading-relaxed">
                                        Select a template on the left and click "Generate Draft" to produce instant correspondence and analysis.
                                    </p>
                                </div>
                            )}
                        </div>
                    </Card>
                </div>
            </div>
        </div>
    );
};

export default Mails;
