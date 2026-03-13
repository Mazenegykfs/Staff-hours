
import React, { useState, useRef, useEffect } from 'react';
import { Report } from './components/Report';
import { InsertForm } from './components/InsertForm';
import { StaffRecord } from './types';
import { Plus, Printer, FileText, Trash2, Edit, List, LogIn, LogOut, User as UserIcon, PenTool, Download } from 'lucide-react';
import ReactDOM from 'react-dom/client';
import { auth, db, loginWithGoogle, logout, onAuthStateChanged, User } from './firebase';
import { collection, query, where, onSnapshot, doc, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { exportToDocx, exportAllToDocx } from './utils/wordExport';

declare var html2pdf: any;

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

const PrintableReport = ({ record }: { record: StaffRecord }) => {
    const [scale, setScale] = useState(1);
    const [wrapperHeight, setWrapperHeight] = useState<number | 'auto'>('auto');
    const innerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const scaleContent = () => {
            if (innerRef.current) {
                // Reset to measure true height
                setScale(1);
                setWrapperHeight('auto');
                
                setTimeout(() => {
                    if (innerRef.current) {
                        const height = innerRef.current.offsetHeight;
                        // A4 height at 96dpi is ~1123px. With margins, safe height is ~980px to avoid bottom clipping.
                        const targetHeight = 980; 
                        
                        if (height > targetHeight) {
                            const newScale = targetHeight / height;
                            setScale(newScale);
                            setWrapperHeight(height * newScale + 20); // Add 20px buffer to prevent clipping
                        }
                    }
                }, 50);
            }
        };

        scaleContent();
    }, [record]);

    return (
        <div style={{ height: wrapperHeight, overflow: 'hidden' }} className="w-full">
            <div 
                ref={innerRef} 
                style={{ 
                    transform: `scale(${scale})`, 
                    transformOrigin: 'top center',
                    width: '100%'
                }}
            >
                <Report recordData={record} />
            </div>
        </div>
    );
};

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
    const [printingSingleId, setPrintingSingleId] = useState<string>('');
    const [isEditingSignatures, setIsEditingSignatures] = useState<boolean>(false);
    const [signatureData, setSignatureData] = useState({
        deanName: localStorage.getItem('deanName') || 'أ.د. مصطفى كامل',
        clerkName: localStorage.getItem('clerkName') || 'الاسم',
        secretaryName: localStorage.getItem('secretaryName') || 'الاسم'
    });
    const reportContainerRef = useRef<HTMLDivElement>(null);
    const allReportsRef = useRef<HTMLDivElement>(null);
    const singleReportRef = useRef<HTMLDivElement>(null);

    // Auth listener
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
            setUser((prevUser) => {
                if (prevUser && !currentUser) {
                    setMessage('تم تسجيل الخروج تلقائياً (قد يكون بسبب انتهاء الجلسة أو حظر ملفات تعريف الارتباط للجهات الخارجية). يرجى تسجيل الدخول مرة أخرى.');
                }
                return currentUser;
            });
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
            try {
                handleFirestoreError(error, OperationType.LIST, 'staff_records');
            } catch (e) {
                setMessage('خطأ في تحميل البيانات من قاعدة البيانات');
            }
        });

        return () => unsubscribe();
    }, [user]);

    const handleSaveRecord = async (record: StaffRecord) => {
        if (!user) {
            setMessage('يجب تسجيل الدخول لحفظ البيانات');
            return;
        }

        setIsLoading(true);
        const docId = record.id || doc(collection(db, 'staff_records')).id;
        try {
            const recordWithUid: StaffRecord = { 
                ...record, 
                id: docId,
                uid: user.uid,
            };
            if (editingRecord && editingRecord.createdAt) {
                recordWithUid.createdAt = editingRecord.createdAt;
            } else {
                recordWithUid.createdAt = serverTimestamp();
            }
            await setDoc(doc(db, 'staff_records', docId), recordWithUid);
            setMessage(editingRecord ? 'تم تحديث البيانات بنجاح' : 'تم حفظ البيانات بنجاح');
            setEditingRecord(undefined);
            setView('list');
        } catch (error) {
            try {
                handleFirestoreError(error, editingRecord ? OperationType.UPDATE : OperationType.CREATE, `staff_records/${docId}`);
            } catch (e) {
                setMessage('فشل في حفظ البيانات في قاعدة البيانات');
            }
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
            try {
                handleFirestoreError(error, OperationType.DELETE, `staff_records/${id}`);
            } catch (e) {
                setMessage('فشل في حذف السجل');
            }
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
        margin: [5, 5, 5, 5],
        filename,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { 
            scale: 2, 
            useCORS: true, 
            letterRendering: true
        },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
        pagebreak: { mode: ['css', 'avoid-all'] }
    });

    const handlePrintCurrentReport = async () => {
        if (!selectedRecord) {
            setMessage('الرجاء اختيار عضو هيئة تدريس لعرض وطباعة تقريره.');
            return;
        }
        await handlePrintSingleFromList(selectedRecord);
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

    const handlePrintSingleFromList = async (record: StaffRecord) => {
        setPrintingSingleId(record.id);
        setIsLoading(true);
        setMessage('جاري تحضير التقرير للطباعة...');

        setTimeout(async () => {
            try {
                if (!singleReportRef.current) throw new Error('فشل في الوصول إلى حاوية التقرير');
                
                const element = singleReportRef.current;
                const options = getPdfOptions(`تقرير_${record.name.replace(/\s/g, '_')}.pdf`);

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
                console.error('Error generating PDF:', error);
                setMessage(`حدث خطأ أثناء إنشاء ملف PDF: ${error.message}`);
            } finally {
                setIsLoading(false);
                setPrintingSingleId('');
                setTimeout(() => setMessage(''), 3000);
            }
        }, 1500);
    };

    const handleExportWord = async () => {
        if (!selectedRecord) return;
        
        try {
            const deanName = localStorage.getItem('deanName') || 'أ.د. مصطفى كامل';
            const clerkName = localStorage.getItem('clerkName') || 'الاسم';
            const secretaryName = localStorage.getItem('secretaryName') || 'الاسم';
            
            await exportToDocx(selectedRecord, deanName, clerkName, secretaryName);
            setMessage('تم تصدير ملف Word بنجاح.');
            setTimeout(() => setMessage(''), 3000);
        } catch (error: any) {
            console.error('Error generating Word doc:', error);
            setMessage(`حدث خطأ أثناء إنشاء ملف Word: ${error.message}`);
            setTimeout(() => setMessage(''), 3000);
        }
    };

    const handleExportAllWord = async () => {
        try {
            const deanName = localStorage.getItem('deanName') || 'أ.د. مصطفى كامل';
            const clerkName = localStorage.getItem('clerkName') || 'الاسم';
            const secretaryName = localStorage.getItem('secretaryName') || 'الاسم';
            
            await exportAllToDocx(allRecords, deanName, clerkName, secretaryName);
            setMessage('تم تصدير جميع التقارير في ملف Word بنجاح.');
            setTimeout(() => setMessage(''), 3000);
        } catch (error: any) {
            console.error('Error generating Word doc:', error);
            setMessage(`حدث خطأ أثناء إنشاء ملف Word: ${error.message}`);
            setTimeout(() => setMessage(''), 3000);
        }
    };

    const handleEditSignatures = () => {
        setSignatureData({
            deanName: localStorage.getItem('deanName') || 'أ.د. مصطفى كامل',
            clerkName: localStorage.getItem('clerkName') || 'الاسم',
            secretaryName: localStorage.getItem('secretaryName') || 'الاسم'
        });
        setIsEditingSignatures(true);
    };

    const handleSaveSignatures = () => {
        localStorage.setItem('deanName', signatureData.deanName);
        window.dispatchEvent(new CustomEvent('sharedStateChange', { detail: { key: 'deanName', value: signatureData.deanName } }));
        
        localStorage.setItem('clerkName', signatureData.clerkName);
        window.dispatchEvent(new CustomEvent('sharedStateChange', { detail: { key: 'clerkName', value: signatureData.clerkName } }));
        
        localStorage.setItem('secretaryName', signatureData.secretaryName);
        window.dispatchEvent(new CustomEvent('sharedStateChange', { detail: { key: 'secretaryName', value: signatureData.secretaryName } }));
        
        setIsEditingSignatures(false);
        setMessage('تم حفظ التوقيعات بنجاح');
        setTimeout(() => setMessage(''), 3000);
    };

    return (
        <div className="bg-gray-50 min-h-screen text-gray-800 p-4 sm:p-8" style={{ fontFamily: "'Cairo', sans-serif" }} dir="rtl">
            {/* Hidden container for single printing */}
            <div 
                style={{ 
                    position: 'absolute', 
                    top: 0, 
                    left: 0, 
                    width: '210mm',
                    zIndex: 40,
                    display: printingSingleId ? 'block' : 'none'
                }}
            >
                <div ref={singleReportRef} className="bg-white">
                    {printingSingleId && (
                        <PrintableReport record={allRecords.find(r => r.id === printingSingleId)!} />
                    )}
                </div>
            </div>

            {/* Hidden container for bulk printing */}
            <div 
                style={{ 
                    position: 'absolute', 
                    top: 0, 
                    left: 0, 
                    width: '210mm', // A4 width
                    zIndex: 40,
                    display: isPrintingAll ? 'block' : 'none'
                }}
            >
                <div ref={allReportsRef} className="bg-white">
                    {isPrintingAll && allRecords.map((record, index) => (
                        <div key={record.id} className={index < allRecords.length - 1 ? "pdf-page-break" : ""}>
                            <PrintableReport record={record} />
                        </div>
                    ))}
                </div>
            </div>

            {isLoading && (
                <div className="fixed inset-0 bg-white flex flex-col justify-center items-center z-50">
                    <div className="spinner border-4 border-gray-200 border-t-blue-500 rounded-full w-12 h-12 animate-spin"></div>
                    <p className="mt-4 text-lg font-semibold text-blue-600">{message}</p>
                </div>
            )}
            
            {message && !isLoading && (
                <div className="fixed top-4 left-1/2 transform -translate-x-1/2 bg-blue-600 text-white px-6 py-3 rounded-full shadow-lg z-50 animate-bounce">
                    {message}
                </div>
            )}

            {isEditingSignatures && (
                <div className="fixed inset-0 bg-black/50 flex flex-col justify-center items-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-md" dir="rtl">
                        <h2 className="text-xl font-bold text-gray-800 mb-4">تعديل التوقيعات</h2>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">اسم عميد المعهد</label>
                                <input 
                                    type="text" 
                                    value={signatureData.deanName}
                                    onChange={(e) => setSignatureData({...signatureData, deanName: e.target.value})}
                                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">اسم شئون هيئة التدريس</label>
                                <input 
                                    type="text" 
                                    value={signatureData.clerkName}
                                    onChange={(e) => setSignatureData({...signatureData, clerkName: e.target.value})}
                                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">اسم أمين المعهد</label>
                                <input 
                                    type="text" 
                                    value={signatureData.secretaryName}
                                    onChange={(e) => setSignatureData({...signatureData, secretaryName: e.target.value})}
                                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                />
                            </div>
                        </div>
                        <div className="flex justify-end gap-3 mt-6">
                            <button 
                                onClick={() => setIsEditingSignatures(false)}
                                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                            >
                                إلغاء
                            </button>
                            <button 
                                onClick={handleSaveSignatures}
                                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
                            >
                                حفظ التغييرات
                            </button>
                        </div>
                    </div>
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
                    <p className="text-amber-700 mb-2">عند تسجيل الدخول، سيتم حفظ جميع سجلاتك في قاعدة بيانات سحابية آمنة لتتمكن من الوصول إليها من أي مكان.</p>
                    <p className="text-sm text-amber-600 bg-amber-100 p-2 rounded">ملاحظة: إذا واجهت مشكلة تسجيل الخروج المفاجئ، يرجى فتح التطبيق في علامة تبويب جديدة (New Tab) لتجنب حظر ملفات تعريف الارتباط للجهات الخارجية.</p>
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
                        onClick={handleEditSignatures}
                        className="flex items-center gap-2 px-6 py-2 bg-white text-gray-600 rounded-lg hover:bg-gray-100 transition-all shadow-sm border border-gray-200"
                    >
                        <PenTool size={20} /> تعديل التوقيعات
                    </button>
                    <button
                        onClick={() => { setView('insert'); setEditingRecord(undefined); }}
                        className={`flex items-center gap-2 px-6 py-2 rounded-lg transition-all ${view === 'insert' ? 'bg-blue-600 text-white shadow-md' : 'bg-white text-gray-600 hover:bg-gray-100'}`}
                    >
                        <Plus size={20} /> إضافة جديد
                    </button>
                    {allRecords.length > 0 && (
                        <div className="flex gap-2">
                            <button
                                onClick={handlePrintAllReports}
                                className="flex items-center gap-2 px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-all shadow-md"
                            >
                                <Printer size={20} /> طباعة الكل (PDF)
                            </button>
                            <button
                                onClick={handleExportAllWord}
                                className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all shadow-md"
                            >
                                <Download size={20} /> تصدير الكل (Word)
                            </button>
                        </div>
                    )}
                </div>

                {view === 'insert' && (
                    <InsertForm
                        key={editingRecord ? editingRecord.id : 'new'}
                        onSave={handleSaveRecord}
                        onCancel={() => {
                            setView('list');
                            setEditingRecord(undefined);
                        }}
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
                                                            onClick={() => handlePrintSingleFromList(record)}
                                                            className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                                                            title="طباعة التقرير"
                                                        >
                                                            <Printer size={20} />
                                                        </button>
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
                            <div className="flex gap-2">
                                <button
                                    onClick={handleExportWord}
                                    className="flex items-center gap-2 px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-all shadow-md"
                                >
                                    <Download size={20} /> تصدير Word
                                </button>
                                <button
                                    onClick={handlePrintCurrentReport}
                                    className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all shadow-md"
                                >
                                    <Printer size={20} /> طباعة التقرير (PDF)
                                </button>
                            </div>
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
