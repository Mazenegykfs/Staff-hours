
import React, { useState, useRef, useEffect } from 'react';
import { Report } from './components/Report';
import { InsertForm } from './components/InsertForm';
import { StaffRecord } from './types';
import { Plus, Printer, FileText, Trash2, Edit, List, LogIn, LogOut, User as UserIcon, PenTool, Download, Calendar } from 'lucide-react';
import ReactDOM from 'react-dom/client';
import { auth, db, loginWithGoogle, logout, onAuthStateChanged, User } from './firebase';
import { collection, query, where, onSnapshot, doc, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { exportToDocx, exportAllToDocx } from './utils/wordExport';
import { exportRecordsToExcel, importRecordsFromExcel } from './utils/excelUtils';
import { Upload } from 'lucide-react';

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
                        // A4 height at 96dpi is ~1123px. With margins, safe height is ~1020px to avoid bottom clipping.
                        const targetHeight = 1020; 
                        
                        if (height > targetHeight) {
                            const newScale = targetHeight / height;
                            setScale(newScale);
                            setWrapperHeight(targetHeight);
                        } else {
                            setWrapperHeight(height);
                        }
                    }
                }, 100);
            }
        };

        scaleContent();
    }, [record]);

    return (
        <div dir="ltr" style={{ height: wrapperHeight, overflow: 'hidden', pageBreakInside: 'avoid', display: 'flex', justifyContent: 'flex-start' }} className="w-full">
            <div 
                ref={innerRef} 
                dir="rtl"
                style={{ 
                    transform: `scale(${scale})`, 
                    transformOrigin: 'top left',
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
    const [isEditingTitle, setIsEditingTitle] = useState<boolean>(false);
    const [customTitle, setCustomTitle] = useState<string>(localStorage.getItem('customReportTitle') || '');
    const [tempTitle, setTempTitle] = useState<string>('');
    const [signatureData, setSignatureData] = useState({
        deanName: localStorage.getItem('deanName') || 'أ.د. مصطفى كامل',
        clerkName: localStorage.getItem('clerkName') || 'الاسم',
        secretaryName: localStorage.getItem('secretaryName') || 'الاسم'
    });
    const fileInputRef = useRef<HTMLInputElement>(null);
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
            letterRendering: true,
            scrollY: 0,
            windowWidth: 756 // 200mm at 96dpi (A4 width minus margins)
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
    
    const handleExportExcel = () => {
        if (allRecords.length === 0) {
            setMessage('لا توجد سجلات لتصديرها');
            setTimeout(() => setMessage(''), 3000);
            return;
        }
        exportRecordsToExcel(allRecords);
        setMessage('تم تصدير البيانات بنجاح');
        setTimeout(() => setMessage(''), 3000);
    };

    const handleImportExcel = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        if (!user) {
            setMessage('يرجى تسجيل الدخول أولاً لتتمكن من استيراد البيانات وحفظها.');
            setTimeout(() => setMessage(''), 5000);
            if (event.target) event.target.value = '';
            return;
        }

        setIsLoading(true);
        setMessage('جاري استبدال البيانات...');
        try {
            const importedRecords = await importRecordsFromExcel(file);
            
            if (importedRecords.length === 0) {
                setMessage('الملف فارغ أو غير صالح');
                setIsLoading(false);
                setTimeout(() => setMessage(''), 3000);
                return;
            }

            // 1. Delete existing records for this user first to perform a "replace"
            for (const record of allRecords) {
                try {
                    await deleteDoc(doc(db, 'staff_records', record.id));
                } catch (err) {
                    console.error('Error deleting old record:', err);
                }
            }

            // 2. Save each record from the file to Firestore
            let successCount = 0;
            for (const record of importedRecords) {
                try {
                    // We generate a new ID to ensure clean state, but we could also keep the old one if it exists in the file
                    // However, generating a new one is safer for a "fresh" replace
                    const newId = doc(collection(db, 'staff_records')).id;
                    
                    const { id: _oldId, uid: _oldUid, ...recordData } = record;
                    
                    const recordToSave = {
                        ...recordData,
                        id: newId,
                        uid: user.uid,
                        createdAt: serverTimestamp()
                    };
                    
                    const docRef = doc(db, 'staff_records', newId);
                    await setDoc(docRef, recordToSave);
                    successCount++;
                } catch (err) {
                    console.error('Error saving record:', err);
                }
            }

            setMessage(`تم استبدال البيانات بنجاح. تم استيراد ${successCount} سجل.`);
        } catch (error) {
            console.error('Import error:', error);
            setMessage('حدث خطأ أثناء استيراد البيانات. يرجى التأكد من صحة الملف وتنسيقه.');
        } finally {
            setIsLoading(false);
            setTimeout(() => setMessage(''), 5000);
            if (event.target) event.target.value = '';
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
            const reportTitle = localStorage.getItem('customReportTitle') || '';
            
            await exportToDocx(selectedRecord, deanName, clerkName, secretaryName, reportTitle);
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
            const reportTitle = localStorage.getItem('customReportTitle') || '';
            
            await exportAllToDocx(allRecords, deanName, clerkName, secretaryName, reportTitle);
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

    const handleEditTitle = () => {
        setTempTitle(customTitle);
        setIsEditingTitle(true);
    };

    const handleSaveTitle = () => {
        setCustomTitle(tempTitle);
        localStorage.setItem('customReportTitle', tempTitle);
        window.dispatchEvent(new CustomEvent('sharedStateChange', { detail: { key: 'customReportTitle', value: tempTitle } }));
        
        setIsEditingTitle(false);
        setMessage('تم حفظ عنوان التقرير بنجاح');
        setTimeout(() => setMessage(''), 3000);
    };

    return (
        <div className="bg-gray-50 min-h-screen text-gray-800 p-4 sm:p-8" style={{ fontFamily: "'Cairo', sans-serif" }} dir="rtl">
            {/* Hidden container for single printing */}
            <div 
                dir="ltr"
                style={{ 
                    position: 'absolute', 
                    top: 0, 
                    left: 0, 
                    width: '756px', // A4 width minus margins (200mm at 96dpi)
                    zIndex: 40,
                    display: printingSingleId ? 'block' : 'none'
                }}
            >
                <div ref={singleReportRef} className="bg-white w-full" dir="rtl">
                    {printingSingleId && (
                        <PrintableReport record={allRecords.find(r => r.id === printingSingleId)!} />
                    )}
                </div>
            </div>

            {/* Hidden container for bulk printing */}
            <div 
                dir="ltr"
                style={{ 
                    position: 'absolute', 
                    top: 0, 
                    left: 0, 
                    width: '756px', // A4 width minus margins (200mm at 96dpi)
                    zIndex: 40,
                    display: isPrintingAll ? 'block' : 'none'
                }}
            >
                <div ref={allReportsRef} className="bg-white w-full" dir="rtl">
                    {isPrintingAll && allRecords.map((record, index) => (
                        <div key={record.id} className={index < allRecords.length - 1 ? "pdf-page-break w-full" : "w-full"}>
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

            {isEditingTitle && (
                <div className="fixed inset-0 bg-black/50 flex flex-col justify-center items-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-md" dir="rtl">
                        <h2 className="text-xl font-bold text-gray-800 mb-4">تحديد الشهر (عنوان التقرير)</h2>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">عنوان التقرير</label>
                                <input 
                                    type="text" 
                                    value={tempTitle}
                                    onChange={(e) => setTempTitle(e.target.value)}
                                    placeholder="مثال: استمارة شهر مارس 2026-2025م"
                                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:blue-500 focus:border-blue-500"
                                />
                                <p className="text-xs text-gray-500 mt-2">اترك الحقل فارغاً للعودة للعنوان الافتراضي التلقائي.</p>
                            </div>
                        </div>
                        <div className="flex justify-end gap-3 mt-6">
                            <button 
                                onClick={() => setIsEditingTitle(false)}
                                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                            >
                                إلغاء
                            </button>
                            <button 
                                onClick={handleSaveTitle}
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
                    <button
                        onClick={handleEditTitle}
                        className="flex items-center gap-2 px-6 py-2 bg-white text-gray-600 rounded-lg hover:bg-gray-100 transition-all shadow-sm border border-gray-200"
                    >
                        <Calendar size={20} /> تحديد الشهر
                    </button>
                    
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        className="flex items-center gap-2 px-6 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-all shadow-md"
                    >
                        <Upload size={20} /> استيراد Excel
                    </button>
                    <input 
                        type="file" 
                        ref={fileInputRef} 
                        onChange={handleImportExcel} 
                        accept=".xlsx, .xls" 
                        className="hidden" 
                    />

                    {allRecords.length > 0 && (
                        <div className="flex flex-wrap gap-2 justify-center">
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
                            <button
                                onClick={handleExportExcel}
                                className="flex items-center gap-2 px-6 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-all shadow-md"
                            >
                                <Download size={20} /> تصدير Excel
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
                        <div ref={reportContainerRef} className="rounded-xl shadow-lg my-2 max-w-4xl mx-auto overflow-hidden">
                            <Report recordData={selectedRecord} />
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
};

export default App;
