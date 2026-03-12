
import React, { useState, useRef, useEffect } from 'react';
import { Report } from './components/Report';
import { InsertForm } from './components/InsertForm';
import { StaffRecord } from './types';
import { Plus, Printer, FileText, Trash2, Edit, List, LogIn, LogOut, User as UserIcon } from 'lucide-react';
import ReactDOM from 'react-dom/client';
import { auth, db, loginWithGoogle, logout, onAuthStateChanged, User } from './firebase';
import { collection, query, where, onSnapshot, doc, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';

declare var html2pdf: any;

const App: React.FC = () => {
    const [user, setUser] = useState<User | null>(null);
    const [isAuthReady, setIsAuthReady] = useState(false);
    const [allRecords, setAllRecords] = useState<StaffRecord[]>([]);
    const [selectedStaffId, setSelectedStaffId] = useState<string>('');
    const [view, setView] = useState<'list' | 'insert' | 'report'>('list');
    const [editingRecord, setEditingRecord] = useState<StaffRecord | undefined>(undefined);
    const [message, setMessage] = useState<string>('');
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [isPrintingAll, setIsPrintingAll] = useState<boolean>(false);
    const reportContainerRef = useRef<HTMLDivElement>(null);
    const allReportsRef = useRef<HTMLDivElement>(null);

    // Auth listener
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
            setUser(currentUser);
            setIsAuthReady(true);
        });
        return () => unsubscribe();
    }, []);

    // Firestore listener
    useEffect(() => {
        if (!user) {
            setAllRecords([]);
            return;
        }

        const q = query(collection(db, 'staff_records'), where('uid', '==', user.uid));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const records: StaffRecord[] = [];
            snapshot.forEach((doc) => {
                records.push(doc.data() as StaffRecord);
            });
            setAllRecords(records);
        }, (error) => {
            console.error("Firestore Error:", error);
            setMessage('خطأ في تحميل البيانات من قاعدة البيانات');
        });

        return () => unsubscribe();
    }, [user]);

    const handleSaveRecord = async (record: StaffRecord) => {
        if (!user) {
            setMessage('يجب تسجيل الدخول لحفظ البيانات');
            return;
        }

        setIsLoading(true);
        try {
            const recordWithUid = { 
                ...record, 
                uid: user.uid,
                createdAt: editingRecord ? (editingRecord as any).createdAt : serverTimestamp()
            };
            await setDoc(doc(db, 'staff_records', record.id), recordWithUid);
            setMessage(editingRecord ? 'تم تحديث البيانات بنجاح' : 'تم حفظ البيانات بنجاح');
            setEditingRecord(undefined);
            setView('list');
        } catch (error) {
            console.error("Save Error:", error);
            setMessage('فشل في حفظ البيانات في قاعدة البيانات');
        } finally {
            setIsLoading(false);
            setTimeout(() => setMessage(''), 3000);
        }
    };

    const handleDeleteRecord = async (id: string) => {
        if (!user) return;
        
        setIsLoading(true);
        try {
            await deleteDoc(doc(db, 'staff_records', id));
            if (selectedStaffId === id) setSelectedStaffId('');
            setMessage('تم حذف السجل بنجاح');
        } catch (error) {
            console.error("Delete Error:", error);
            setMessage('فشل في حذف السجل');
        } finally {
            setIsLoading(false);
            setTimeout(() => setMessage(''), 3000);
        }
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

            <header className="bg-blue-600 text-white p-4 rounded-xl shadow-lg mb-8">
                <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
                    <h1 className="text-xl sm:text-2xl font-bold text-center sm:text-right">
                        Developed by Dr. Mazen Badawy – Doctorate of English Teaching & Testing
                    </h1>
                    <div className="flex items-center gap-3">
                        {user ? (
                            <div className="flex items-center gap-3 bg-blue-700 px-4 py-2 rounded-lg">
                                <div className="text-right hidden sm:block">
                                    <p className="text-xs opacity-75">مرحباً بك</p>
                                    <p className="text-sm font-bold">{user.displayName || user.email}</p>
                                </div>
                                {user.photoURL ? (
                                    <img src={user.photoURL} alt="Profile" className="w-8 h-8 rounded-full border border-white/20" referrerPolicy="no-referrer" />
                                ) : (
                                    <UserIcon size={20} />
                                )}
                                <button 
                                    onClick={logout}
                                    className="p-2 hover:bg-red-500 rounded-full transition-colors"
                                    title="تسجيل الخروج"
                                >
                                    <LogOut size={18} />
                                </button>
                            </div>
                        ) : (
                            <button 
                                onClick={loginWithGoogle}
                                className="flex items-center gap-2 bg-white text-blue-600 px-4 py-2 rounded-lg font-bold hover:bg-blue-50 transition-all shadow-md"
                            >
                                <LogIn size={20} /> تسجيل الدخول (Google)
                            </button>
                        )}
                    </div>
                </div>
            </header>

            {!user && isAuthReady && (
                <div className="bg-amber-50 border-r-4 border-amber-500 p-6 rounded-xl shadow-md mb-8 text-center">
                    <h2 className="text-xl font-bold text-amber-800 mb-2">يرجى تسجيل الدخول لحفظ بياناتك</h2>
                    <p className="text-amber-700">عند تسجيل الدخول، سيتم حفظ جميع سجلاتك في قاعدة بيانات سحابية آمنة لتتمكن من الوصول إليها من أي مكان.</p>
                </div>
            )}

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
