
import React, { useState, useRef, useEffect } from 'react';
import { Report } from './components/Report';
import { InsertForm } from './components/InsertForm';
import { StaffRecord } from './types';
import { Plus, Printer, FileText, Trash2, Edit, List } from 'lucide-react';
import ReactDOM from 'react-dom/client';

declare var html2pdf: any;

const App: React.FC = () => {
    const [allRecords, setAllRecords] = useState<StaffRecord[]>([]);
    const [selectedStaffId, setSelectedStaffId] = useState<string>('');
    const [view, setView] = useState<'list' | 'insert' | 'report'>('list');
    const [editingRecord, setEditingRecord] = useState<StaffRecord | undefined>(undefined);
    const [message, setMessage] = useState<string>('');
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [isPrintingAll, setIsPrintingAll] = useState<boolean>(false);
    const reportContainerRef = useRef<HTMLDivElement>(null);
    const allReportsRef = useRef<HTMLDivElement>(null);

    // Load data from localStorage on mount
    useEffect(() => {
        const saved = localStorage.getItem('staff_records');
        if (saved) {
            try {
                setAllRecords(JSON.parse(saved));
            } catch (e) {
                console.error('Failed to load records from localStorage', e);
            }
        }
    }, []);

    // Save data to localStorage whenever allRecords changes
    useEffect(() => {
        localStorage.setItem('staff_records', JSON.stringify(allRecords));
    }, [allRecords]);

    const handleSaveRecord = (record: StaffRecord) => {
        if (editingRecord) {
            setAllRecords(allRecords.map(r => r.id === record.id ? record : r));
            setMessage('تم تحديث البيانات بنجاح');
        } else {
            setAllRecords([...allRecords, record]);
            setMessage('تم حفظ البيانات بنجاح');
        }
        setEditingRecord(undefined);
        setView('list');
        setTimeout(() => setMessage(''), 3000);
    };

    const handleDeleteRecord = (id: string) => {
        setAllRecords(allRecords.filter(r => r.id !== id));
        if (selectedStaffId === id) setSelectedStaffId('');
        setMessage('تم حذف السجل بنجاح');
        setTimeout(() => setMessage(''), 3000);
    };

    const handleEditRecord = (record: StaffRecord) => {
        setEditingRecord(record);
        setView('insert');
    };

    const handleViewReport = (id: string) => {
        setSelectedStaffId(id);
        setView('report');
    };

    const selectedRecord = allRecords.find(r => r.id === selectedStaffId);

    const getPdfOptions = (filename: string) => ({
        margin: [10, 10, 10, 10],
        filename,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { 
            scale: 2, 
            useCORS: true, 
            letterRendering: true,
            scrollX: 0,
            scrollY: 0
        },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
        pagebreak: { mode: ['css', 'avoid-all'] }
    });

    const handlePrintCurrentReport = async () => {
        if (!selectedRecord || !reportContainerRef.current) {
            setMessage('الرجاء اختيار عضو هيئة تدريس لعرض وطباعة تقريره.');
            return;
        }

        setIsLoading(true);
        setMessage('جاري إنشاء ملف PDF للتقرير الحالي...');

        try {
            const element = reportContainerRef.current;
            const options = getPdfOptions(`تقرير_${selectedRecord.name.replace(/\s/g, '_')}.pdf`);
            
            // Ensure images are loaded
            const images = element.getElementsByTagName('img');
            await Promise.all(Array.from(images).map(img => {
                if (img.complete) return Promise.resolve();
                return new Promise(resolve => {
                    img.onload = resolve;
                    img.onerror = resolve;
                });
            }));

            await html2pdf().from(element).set(options).save();
            setMessage('تم إنشاء ملف PDF بنجاح.');
        } catch (error: any) {
            console.error('PDF Error:', error);
            setMessage(`حدث خطأ: ${error.message}`);
        } finally {
            setIsLoading(false);
            setTimeout(() => setMessage(''), 3000);
        }
    };
    
    const handlePrintAllReports = async () => {
        if (allRecords.length === 0) {
            setMessage('لا توجد سجلات لطباعتها.');
            return;
        }

        setIsLoading(true);
        setIsPrintingAll(true);
        setMessage('جاري تحضير جميع التقارير للطباعة...');

        // Wait for the hidden container to render
        setTimeout(async () => {
            try {
                if (!allReportsRef.current) throw new Error('فشل في الوصول إلى حاوية التقارير');
                
                const element = allReportsRef.current;
                const options = getPdfOptions('جميع_التقارير.pdf');

                // Ensure all images in the hidden container are loaded
                const images = element.getElementsByTagName('img');
                await Promise.all(Array.from(images).map(img => {
                    if (img.complete) return Promise.resolve();
                    return new Promise(resolve => {
                        img.onload = resolve;
                        img.onerror = resolve;
                    });
                }));

                await html2pdf().from(element).set(options).save();
                setMessage('تم إنشاء ملف PDF مجمع بنجاح.');
            } catch (error: any) {
                console.error('Error generating all PDFs:', error);
                setMessage(`حدث خطأ أثناء إنشاء ملف PDF: ${error.message}`);
            } finally {
                setIsLoading(false);
                setIsPrintingAll(false);
                setTimeout(() => setMessage(''), 3000);
            }
        }, 1500); // Give React time to render the hidden list
    };

    return (
        <div className="bg-gray-50 min-h-screen text-gray-800 p-4 sm:p-8" style={{ fontFamily: "'Cairo', sans-serif" }} dir="rtl">
            {/* Hidden container for bulk printing */}
            <div 
                ref={allReportsRef} 
                style={{ 
                    position: 'absolute', 
                    top: '-10000px', 
                    left: '-10000px', 
                    width: '210mm', // A4 width
                    visibility: isPrintingAll ? 'visible' : 'hidden'
                }}
            >
                {isPrintingAll && allRecords.map((record, index) => (
                    <div key={record.id} className={index < allRecords.length - 1 ? "pdf-page-break" : ""}>
                        <Report recordData={record} />
                    </div>
                ))}
            </div>

            {isLoading && (
                <div className="fixed inset-0 bg-white bg-opacity-75 flex flex-col justify-center items-center z-50">
                    <div className="spinner border-4 border-gray-200 border-t-blue-500 rounded-full w-12 h-12 animate-spin"></div>
                    <p className="mt-4 text-lg font-semibold text-blue-600">{message}</p>
                </div>
            )}
            
            {message && !isLoading && (
                <div className="fixed top-4 left-1/2 transform -translate-x-1/2 bg-blue-600 text-white px-6 py-3 rounded-full shadow-lg z-50 animate-bounce">
                    {message}
                </div>
            )}

            <header className="bg-blue-600 text-white p-4 rounded-xl shadow-lg mb-8 text-center">
                <h1 className="text-xl sm:text-2xl font-bold">
                    Developed by Dr. Mazen Badawy – Doctorate of English Teaching & Testing
                </h1>
            </header>

            <main className="max-w-5xl mx-auto">
                <div className="flex flex-wrap gap-4 mb-8 justify-center">
                    <button
                        onClick={() => { setView('list'); setEditingRecord(undefined); }}
                        className={`flex items-center gap-2 px-6 py-2 rounded-lg transition-all ${view === 'list' ? 'bg-blue-600 text-white shadow-md' : 'bg-white text-gray-600 hover:bg-gray-100'}`}
                    >
                        <List size={20} /> قائمة السجلات
                    </button>
                    <button
                        onClick={() => { setView('insert'); setEditingRecord(undefined); }}
                        className={`flex items-center gap-2 px-6 py-2 rounded-lg transition-all ${view === 'insert' ? 'bg-blue-600 text-white shadow-md' : 'bg-white text-gray-600 hover:bg-gray-100'}`}
                    >
                        <Plus size={20} /> إضافة جديد
                    </button>
                    {allRecords.length > 0 && (
                        <button
                            onClick={handlePrintAllReports}
                            className="flex items-center gap-2 px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-all shadow-md"
                        >
                            <Printer size={20} /> طباعة الكل (PDF)
                        </button>
                    )}
                </div>

                {view === 'insert' && (
                    <InsertForm
                        onSave={handleSaveRecord}
                        onCancel={() => setView('list')}
                        initialData={editingRecord}
                    />
                )}

                {view === 'list' && (
                    <div className="bg-white rounded-xl shadow-lg overflow-hidden">
                        <div className="p-6 border-b">
                            <h2 className="text-2xl font-bold text-gray-800">سجلات أعضاء هيئة التدريس</h2>
                        </div>
                        {allRecords.length === 0 ? (
                            <div className="p-12 text-center text-gray-500">
                                <FileText size={64} className="mx-auto mb-4 opacity-20" />
                                <p className="text-xl">لا توجد سجلات حالياً. قم بإضافة سجل جديد للبدء.</p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-right">
                                    <thead className="bg-gray-50 text-gray-600 border-b">
                                        <tr>
                                            <th className="px-6 py-4">الاسم</th>
                                            <th className="px-6 py-4">القسم</th>
                                            <th className="px-6 py-4">الدرجة</th>
                                            <th className="px-6 py-4 text-center">الإجراءات</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y">
                                        {allRecords.map(record => (
                                            <tr key={record.id} className="hover:bg-gray-50 transition-colors">
                                                <td className="px-6 py-4 font-semibold">{record.name}</td>
                                                <td className="px-6 py-4">{record.department || '-'}</td>
                                                <td className="px-6 py-4">{record.degree || '-'}</td>
                                                <td className="px-6 py-4">
                                                    <div className="flex justify-center gap-2">
                                                        <button
                                                            onClick={() => handleViewReport(record.id)}
                                                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                                            title="عرض التقرير"
                                                        >
                                                            <FileText size={20} />
                                                        </button>
                                                        <button
                                                            onClick={() => handleEditRecord(record)}
                                                            className="p-2 text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                                                            title="تعديل"
                                                        >
                                                            <Edit size={20} />
                                                        </button>
                                                        <button
                                                            onClick={() => handleDeleteRecord(record.id)}
                                                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                            title="حذف"
                                                        >
                                                            <Trash2 size={20} />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )}

                {view === 'report' && selectedRecord && (
                    <div className="space-y-6">
                        <div className="flex justify-between items-center bg-white p-4 rounded-xl shadow-md">
                            <button
                                onClick={() => setView('list')}
                                className="flex items-center gap-2 text-gray-600 hover:text-blue-600"
                            >
                                <List size={20} /> العودة للقائمة
                            </button>
                            <button
                                onClick={handlePrintCurrentReport}
                                className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all shadow-md"
                            >
                                <Printer size={20} /> طباعة التقرير (PDF)
                            </button>
                        </div>
                        <div ref={reportContainerRef}>
                            <Report recordData={selectedRecord} />
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
};

export default App;
