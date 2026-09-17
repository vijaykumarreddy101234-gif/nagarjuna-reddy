
import React, { useState, useRef, useEffect } from 'react';
import type { Item, InflowTransaction, ConsumptionTransaction, ReportCorrection, User, Profile, ProfileTransaction } from '../types';
import ConsumptionReport from '../components/ConsumptionReport';
import MonthlyReport from '../components/MonthlyReport';
import ProfileDailyReport from '../components/ProfileDailyReport';
import ProfileMonthlyReport from '../components/ProfileMonthlyReport';
import { ChevronDownIcon } from '../components/Icon';

// FIX: Declare XLSX to resolve compilation error for Excel export.
declare const XLSX: any;
declare const jspdf: any;

interface HistoryProps {
    items: Item[];
    inflowTransactions: InflowTransaction[];
    consumptionTransactions: ConsumptionTransaction[];
    reportCorrections: ReportCorrection[];
    profiles: Profile[];
    profileTransactions: ProfileTransaction[];
    addOrUpdateReportCorrection: (correction: Omit<ReportCorrection, 'updatedAt'>) => void;
    brands: string[];
}

type HistoryTab = 'daily' | 'period';
type ReportSection = 'materials' | 'profiles';
type TimeFilter = '1M' | '3M' | '6M' | '12M' | 'ALL';


const History = (props) => {
    const [activeTab, setActiveTab] = useState<HistoryTab>('daily');
    const [activeSection, setActiveSection] = useState<ReportSection>('materials');
    const [brandFilter, setBrandFilter] = useState<string>('All');
    const [timeFilter, setTimeFilter] = useState<TimeFilter>('3M');
    const [isDownloadMenuOpen, setIsDownloadMenuOpen] = useState(false);
    const downloadMenuRef = useRef<HTMLDivElement>(null);
    
    const tabs: { id: HistoryTab; label: string }[] = [
        { id: 'daily', label: 'Daily Report' },
        { id: 'period', label: 'Period Summary' },
    ];
    
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (downloadMenuRef.current && !downloadMenuRef.current.contains(event.target as Node)) {
                setIsDownloadMenuOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [downloadMenuRef]);

    const handleExportPdf = () => {
        const { jsPDF } = jspdf;
        const doc = new jsPDF({ orientation: 'landscape' });
    
        let elementId = '';
        if (activeSection === 'materials') {
            elementId = activeTab === 'daily' ? 'consumption-report-printable' : 'monthly-report-printable';
        } else {
            elementId = activeTab === 'daily' ? 'profile-daily-report-printable' : 'profile-monthly-report-printable';
        }

        const tableContainer = document.getElementById(elementId);
        if (!tableContainer) return;
    
        const tableElement = tableContainer.querySelector('table');
        if (!tableElement) return;
    
        const reportTitle = `${activeSection === 'materials' ? 'Raw Material' : 'Profile'} ${tabs.find(t => t.id === activeTab)?.label}`;
        const date = new Date().toLocaleDateString();
        doc.text(`${reportTitle} - Generated on: ${date}`, 14, 15);
    
        const clonedTable = tableElement.cloneNode(true) as HTMLTableElement;
        const noPrintColumn = clonedTable.querySelector('th:last-child[class*="no-print"]');
        if (noPrintColumn) {
            const noPrintColumnIndex = Array.from(noPrintColumn.parentElement!.children).indexOf(noPrintColumn);
             Array.from(clonedTable.rows).forEach(row => {
                if (row.cells[noPrintColumnIndex]) {
                    row.deleteCell(noPrintColumnIndex);
                }
            });
        }
    
        doc.autoTable({
            html: clonedTable,
            startY: 20,
            theme: 'grid',
            styles: { fontSize: 8 },
            headStyles: { fillColor: activeSection === 'materials' ? [55, 74, 103] : [45, 62, 80] },
        });
    
        doc.save(`${reportTitle.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`);
        setIsDownloadMenuOpen(false);
    };

    const handleExportExcel = () => {
        let elementId = '';
        if (activeSection === 'materials') {
            elementId = activeTab === 'daily' ? 'consumption-report-printable' : 'monthly-report-printable';
        } else {
            elementId = activeTab === 'daily' ? 'profile-daily-report-printable' : 'profile-monthly-report-printable';
        }

        const tableContainer = document.getElementById(elementId);
        if (!tableContainer) {
            console.error('Printable element not found:', elementId);
            return;
        }
        const tableElement = tableContainer.querySelector('table');
        if (!tableElement) {
            console.error('Table element not found in:', elementId);
            return;
        }
    
        const clonedTable = tableElement.cloneNode(true) as HTMLTableElement;
    
        const headers = Array.from(clonedTable.querySelectorAll('thead th'));
        const noPrintColumnIndices = headers
            .map((th, index) => th.classList.contains('no-print') ? index : -1)
            .filter(index => index !== -1);
        
        if (noPrintColumnIndices.length > 0) {
            Array.from(clonedTable.rows).forEach(row => {
                for (let i = noPrintColumnIndices.length - 1; i >= 0; i--) {
                     if (row.cells[noPrintColumnIndices[i]]) {
                        row.deleteCell(noPrintColumnIndices[i]);
                    }
                }
            });
        }
    
        const wb = XLSX.utils.table_to_book(clonedTable, { sheet: "Sheet1" });
        const date = new Date().toISOString().split('T')[0];
        const reportTitle = `${activeSection === 'materials' ? 'RM' : 'Profile'}_${tabs.find(t => t.id === activeTab)?.label?.replace(/\s+/g, '_') || 'Report'}`;
        XLSX.writeFile(wb, `${reportTitle}_${date}.xlsx`);
        setIsDownloadMenuOpen(false);
    };

    return (
        <>
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4 no-print">
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">History & Reports</h1>
                 <div className="flex items-center gap-3 flex-wrap w-full md:w-auto">
                    <div className="inline-flex rounded-md shadow-sm w-full md:w-auto" role="group">
                        <button
                            type="button"
                            onClick={() => setActiveSection('materials')}
                            className={`flex-1 md:flex-none px-4 py-2 text-sm font-medium border border-gray-200 rounded-l-lg focus:z-10 focus:ring-2 focus:ring-blue-700 focus:text-blue-700 ${activeSection === 'materials' ? 'bg-blue-600 text-white dark:bg-blue-600 dark:text-white' : 'bg-white text-gray-900 hover:bg-gray-100 dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:hover:text-white dark:hover:bg-gray-600'}`}
                        >
                            Raw Materials
                        </button>
                        <button
                            type="button"
                            onClick={() => setActiveSection('profiles')}
                            className={`flex-1 md:flex-none px-4 py-2 text-sm font-medium border border-gray-200 rounded-r-lg focus:z-10 focus:ring-2 focus:ring-blue-700 focus:text-blue-700 ${activeSection === 'profiles' ? 'bg-blue-600 text-white dark:bg-blue-600 dark:text-white' : 'bg-white text-gray-900 hover:bg-gray-100 dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:hover:text-white dark:hover:bg-gray-600'}`}
                        >
                            Profile Stock
                        </button>
                    </div>

                    {activeTab === 'period' && (
                         <div className="flex items-center gap-2">
                            <label htmlFor="time-filter" className="text-sm font-medium text-gray-700 dark:text-gray-300">Period:</label>
                            <select
                                id="time-filter"
                                value={timeFilter}
                                onChange={e => setTimeFilter(e.target.value as TimeFilter)}
                                className="px-3 py-1.5 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                            >
                                <option value="1M">Last 1 Month</option>
                                <option value="3M">Last 3 Months</option>
                                <option value="6M">Last 6 Months</option>
                                <option value="12M">Last 12 Months</option>
                                <option value="ALL">All Time</option>
                            </select>
                        </div>
                    )}

                    {activeSection === 'profiles' && (
                        <div className="flex items-center gap-2">
                            <label htmlFor="brand-filter" className="text-sm font-medium text-gray-700 dark:text-gray-300">Brand:</label>
                            <select
                                id="brand-filter"
                                value={brandFilter}
                                onChange={e => setBrandFilter(e.target.value)}
                                className="px-3 py-1.5 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                            >
                                <option value="All">All Brands</option>
                                {props.brands.map(brand => <option key={brand} value={brand}>{brand}</option>)}
                            </select>
                        </div>
                    )}

                     <div className="relative" ref={downloadMenuRef}>
                        <button
                            onClick={() => setIsDownloadMenuOpen(prev => !prev)}
                            className="bg-blue-600 text-white px-5 py-2 rounded-md text-sm font-semibold hover:bg-blue-700 shadow focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 flex items-center gap-2"
                        >
                            Download Report
                            <ChevronDownIcon className={`w-4 h-4 transition-transform ${isDownloadMenuOpen ? 'rotate-180' : ''}`} />
                        </button>
                        {isDownloadMenuOpen && (
                            <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-md shadow-lg py-1 z-20 ring-1 ring-black ring-opacity-5">
                                <button onClick={handleExportPdf} className="block w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700">
                                    Download as PDF
                                </button>
                                <button onClick={handleExportExcel} className="block w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700">
                                    Download as Excel
                                </button>
                            </div>
                        )}
                    </div>
                 </div>
            </div>
            
            <div className="mb-6 border-b border-gray-200 dark:border-gray-700 no-print">
                <nav className="-mb-px flex space-x-6 overflow-x-auto" aria-label="Tabs">
                    {tabs.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`${
                                activeTab === tab.id
                                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:border-gray-500'
                            } whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm focus:outline-none`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </nav>
            </div>

            <div>
                {/* RAW MATERIAL REPORTS */}
                {activeSection === 'materials' && (
                    <>
                        <div id="consumption-report-printable" style={{ display: activeTab === 'daily' ? 'block' : 'none' }}>
                            <ConsumptionReport
                                items={props.items}
                                inflow={props.inflowTransactions}
                                consumption={props.consumptionTransactions}
                                reportCorrections={props.reportCorrections}
                                addOrUpdateReportCorrection={props.addOrUpdateReportCorrection}
                            />
                        </div>
                        <div id="monthly-report-printable" style={{ display: activeTab === 'period' ? 'block' : 'none' }}>
                            <MonthlyReport
                                items={props.items}
                                inflow={props.inflowTransactions}
                                consumption={props.consumptionTransactions}
                                reportCorrections={props.reportCorrections}
                                timeFilter={timeFilter}
                            />
                        </div>
                    </>
                )}

                {/* PROFILE REPORTS */}
                {activeSection === 'profiles' && (
                    <>
                        <div id="profile-daily-report-printable" style={{ display: activeTab === 'daily' ? 'block' : 'none' }}>
                            <ProfileDailyReport 
                                profiles={props.profiles}
                                transactions={props.profileTransactions}
                                brandFilter={brandFilter}
                            />
                        </div>
                        <div id="profile-monthly-report-printable" style={{ display: activeTab === 'period' ? 'block' : 'none' }}>
                            <ProfileMonthlyReport 
                                profiles={props.profiles}
                                transactions={props.profileTransactions}
                                brandFilter={brandFilter}
                                timeFilter={timeFilter}
                            />
                        </div>
                    </>
                )}
            </div>
        </>
    );
};

export default History;
