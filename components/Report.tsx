
import React, { useMemo, useState, useEffect } from 'react';
import { StaffRecord, ReportProps } from '../types';
import { numberToArabicText, displayValueOrDash, computeReportData } from '../utils/reportLogic';

// Declare XLSX on the window object to satisfy TypeScript since it's loaded from a CDN
declare global {
    interface Window {
        XLSX: any;
    }
}

const useSharedState = (key: string, initialValue: string) => {
    const [value, setValue] = useState(() => {
        const item = localStorage.getItem(key);
        return item !== null ? item : initialValue;
    });

    useEffect(() => {
        const handleStorageChange = (e: StorageEvent) => {
            if (e.key === key && e.newValue !== null) {
                setValue(e.newValue);
            }
        };
        const handleCustomChange = (e: Event) => {
            const customEvent = e as CustomEvent;
            if (customEvent.detail.key === key) {
                setValue(customEvent.detail.value);
            }
        };
        window.addEventListener('storage', handleStorageChange);
        window.addEventListener('sharedStateChange', handleCustomChange);
        return () => {
            window.removeEventListener('storage', handleStorageChange);
            window.removeEventListener('sharedStateChange', handleCustomChange);
        };
    }, [key]);

    const setSharedValue = (newValue: string) => {
        setValue(newValue);
        localStorage.setItem(key, newValue);
        window.dispatchEvent(new CustomEvent('sharedStateChange', { detail: { key, value: newValue } }));
    };

    return [value, setSharedValue] as const;
};

export const Report: React.FC<ReportProps> = ({ recordData }) => {
    const [deanName, setDeanName] = useSharedState("deanName", "أ.د. مصطفى كامل");
    const [clerkName, setClerkName] = useSharedState("clerkName", "الاسم");
    const [secretaryName, setSecretaryName] = useSharedState("secretaryName", "الاسم");
    const [customTitle, setCustomTitle] = useSharedState("customReportTitle", "");

    const reportData = useMemo(() => computeReportData(recordData), [recordData]);
    const { isFacultyMember } = reportData;


    return (
        <div className="bg-white p-3 sm:p-5 pb-12 sm:pb-16 rounded-xl shadow-lg my-2 max-w-4xl mx-auto report-container-for-print text-[11px] sm:text-[12px] leading-[1.3]">
            <header className="mb-2">
                <table className="w-full border-none mb-2 word-table-layout">
                    <tbody>
                        <tr>
                            <td className="border-none text-center align-middle w-1/3">
                                <div className="flex flex-col items-center justify-center">
                                    <img src="https://api.allorigins.win/raw?url=https%3A%2F%2Fyt3.googleusercontent.com%2Fp-gOwvpL7qWfqZ0XAC-zsuWXg4ATxIxGCYtGtbsSSh2HGogCeFX17SaueyejOtnJywe32_93FQ%3Ds160-c-k-c0x00ffffff-no-rj" alt="وزارة التعليم العالي والبحث العلمي" crossOrigin="anonymous" referrerPolicy="no-referrer" className="w-10 h-10 sm:w-12 sm:h-12 object-contain mb-1" />
                                    <span className="font-bold text-sm sm:text-base text-gray-800 text-center">وزارة التعليم العالي والبحث العلمي</span>
                                </div>
                            </td>
                            <td className="border-none text-center align-middle w-1/3">
                                <h4 className="text-sm sm:text-base font-bold text-gray-800 m-0" dir="rtl">
                                    {customTitle ? customTitle : (
                                        <>استمارة شهر {reportData.attendanceMonth} <span dir="ltr" className="inline-block">{reportData.attendanceYearEnd}-{reportData.attendanceYearStart}</span>م</>
                                    )}
                                </h4>
                            </td>
                            <td className="border-none text-center align-middle w-1/3">
                                <div className="flex flex-col items-center justify-center">
                                    <img src="https://api.allorigins.win/raw?url=https%3A%2F%2Fencrypted-tbn0.gstatic.com%2Fimages%3Fq%3Dtbn%3AANd9GcTkwEB_T_tTBcOVvP7OZtXjcLH0txqZK902Qg%26s" alt="المعهد العالي للهندسة والتكنولوجيا" crossOrigin="anonymous" referrerPolicy="no-referrer" className="w-10 h-10 sm:w-12 sm:h-12 object-contain mb-1" />
                                    <h2 className="text-xs sm:text-sm font-bold text-gray-800 m-0 text-center">المعهد العالي للهندسة والتكنولوجيا</h2>
                                    <h3 className="text-[10px] sm:text-xs font-semibold text-gray-600 m-0 text-center">بكفر الشيخ</h3>
                                </div>
                            </td>
                        </tr>
                    </tbody>
                </table>
                <div className="border-b border-gray-200 mb-2"></div>
            </header>

            <section className="mb-2">
                <h4 className="text-sm font-bold text-gray-800 mb-0.5 text-center">
                    {isFacultyMember ? "بيانات عضو هيئة التدريس" : "بيانات عضو الهيئة المعاونة"}
                </h4>
                <table className="w-full border-none mb-2 info-table text-gray-700">
                    <tbody>
                        <tr>
                            <td className="border-none text-right font-semibold w-[10%] pb-1">الاسم:</td>
                            <td className="border-none text-right font-medium w-[40%] pb-1 border-b border-gray-200">{displayValueOrDash(reportData.name)}</td>
                            <td className="border-none text-right font-semibold w-[10%] pb-1">الدرجة:</td>
                            <td className="border-none text-right font-medium w-[40%] pb-1 border-b border-gray-200">{displayValueOrDash(reportData.degree)}</td>
                        </tr>
                        <tr>
                            <td className="border-none text-right font-semibold pb-1 pt-1">القسم:</td>
                            <td className="border-none text-right font-medium pb-1 pt-1 border-b border-gray-200">{displayValueOrDash(reportData.department)}</td>
                            <td className="border-none text-right font-semibold pb-1 pt-1">جهة الانتداب:</td>
                            <td className="border-none text-right font-medium pb-1 pt-1 border-b border-gray-200">{displayValueOrDash(reportData.employer)}</td>
                        </tr>
                    </tbody>
                </table>
            </section>

            <section className="mb-2">
                <h4 className="text-sm font-bold text-gray-800 mb-1 text-center">توزيع الساعات اسبوعيا</h4>
                <table className="w-full border-collapse text-center text-[11px] sm:text-[12px]">
                    <thead className="bg-gray-100">
                        <tr>
                            <th rowSpan={2} className="border px-1.5 py-1 font-semibold w-1/3">ايام الحضور</th>
                            <th colSpan={2} className="border px-1.5 py-1 font-semibold w-2/3">ساعات التدريس</th>
                        </tr>
                        <tr>
                            <th className="border px-1.5 py-1 font-semibold">نظري</th>
                            <th className="border px-1.5 py-1 font-semibold">درس / اشراف</th>
                        </tr>
                    </thead>
                    <tbody>
                        {reportData.weeklyScheduledDaysForDisplay.map((schedule) => (
                            <tr key={schedule.day}>
                                <td className="border px-1.5 py-1 text-right">{displayValueOrDash(schedule.day)}</td>
                                <td className="border px-1.5 py-1">{displayValueOrDash(schedule.theoretical)}</td>
                                <td className="border px-1.5 py-1">{displayValueOrDash(schedule.practical)}</td>
                            </tr>
                        ))}
                        <tr className="bg-gray-50 font-bold">
                            <td className="border px-1.5 py-1 text-right">إجمالي الساعات الأسبوعية</td>
                            <td className="border px-1.5 py-1">{displayValueOrDash(reportData.totalScheduledTheoreticalHours)}</td>
                            <td className="border px-1.5 py-1">{displayValueOrDash(reportData.totalScheduledPracticalHours)}</td>
                        </tr>
                    </tbody>
                </table>
            </section>
            
            <section className="mb-2">
                <h4 className="text-sm font-bold text-gray-800 mb-1 text-center">عدد أيام الحضور الفعلي شهريا</h4>
                <table className="w-full border-collapse text-center text-[11px] sm:text-[12px]">
                    <thead className="bg-gray-100">
                        <tr>
                            <th className="border px-1.5 py-1 font-semibold">م</th>
                            <th className="border px-1.5 py-1 font-semibold">تاريخ الحضور</th>
                            <th className="border px-1.5 py-1 font-semibold">اليوم</th>
                            <th className="border px-1.5 py-1 font-semibold">نظري</th>
                            <th className="border px-1.5 py-1 font-semibold">عملي</th>
                        </tr>
                    </thead>
                    <tbody>
                        {reportData.attendanceDates.map((att) => (
                            <tr key={att.serial}>
                                <td className="border px-1.5 py-1">{displayValueOrDash(att.serial)}</td>
                                <td className="border px-1.5 py-1">{displayValueOrDash(att.date)}</td>
                                <td className="border px-1.5 py-1">{displayValueOrDash(att.day)}</td>
                                <td className="border px-1.5 py-1">{displayValueOrDash(att.theoretical)}</td>
                                <td className="border px-1.5 py-1">{displayValueOrDash(att.practical)}</td>
                            </tr>
                        ))}
                        <tr className="bg-gray-50 font-bold">
                            <td colSpan={3} className="border px-1.5 py-1 text-right">إجمالي الساعات الفعلية</td>
                            <td className="border px-1.5 py-1">{displayValueOrDash(reportData.totalTheoreticalHoursAttendance)}</td>
                            <td className="border px-1.5 py-1">{displayValueOrDash(reportData.totalPracticalHoursAttendance)}</td>
                        </tr>
                    </tbody>
                </table>
            </section>

            <section className="text-right mb-4 text-[11px] sm:text-[12px]" dir="rtl">
                 <div className="flex flex-wrap items-center justify-start gap-1 mb-2">
                     <strong>إجمالي ساعات الدرس/الاشراف الفعلية:</strong>
                     <span className="inline-block" dir="ltr">{displayValueOrDash(reportData.totalPracticalHoursAttendance)}</span>
                     <span>&#41;{numberToArabicText(reportData.totalPracticalHoursAttendance)}&#40;</span>
                     <span>ساعة</span>
                 </div>
                 <div className="flex flex-wrap items-center justify-start gap-1">
                     <strong>إجمالي ساعات المحاضرات الفعلية:</strong>
                     <span className="inline-block" dir="ltr">{displayValueOrDash(reportData.totalTheoreticalHoursAttendance)}</span>
                     <span>&#41;{numberToArabicText(reportData.totalTheoreticalHoursAttendance)}&#40;</span>
                     <span>ساعة</span>
                 </div>
            </section>

            <footer className="mt-4 break-inside-avoid">
                <table className="w-full border-none text-center text-[10px] sm:text-[11px] signature-table">
                    <tbody>
                        <tr>
                            <td className="border-none w-1/3 px-2 align-bottom">
                                <p className="font-bold mb-1">التوقيع</p>
                                <div className="border-b border-dotted border-gray-400 h-2 w-4/5 mx-auto"></div>
                            </td>
                            <td className="border-none w-1/3 px-2 align-bottom">
                                <p className="font-bold mb-1">شئون هيئة التدريس</p>
                                <div className="border-b border-dotted border-gray-400 h-2 w-4/5 mx-auto"></div>
                                <div className="font-bold mt-1 inline-block">{clerkName}</div>
                            </td>
                            <td className="border-none w-1/3 px-2 align-bottom">
                                <p className="font-bold mb-1">أمين المعهد</p>
                                <div className="border-b border-dotted border-gray-400 h-2 w-4/5 mx-auto"></div>
                                <div className="font-bold mt-1 inline-block">{secretaryName}</div>
                            </td>
                        </tr>
                    </tbody>
                </table>
                <div className="mt-12 flex justify-end w-full break-before-auto break-inside-avoid">
                    <div className="flex flex-col items-center text-center w-1/3">
                        <p className="font-bold text-[11px] sm:text-[12px] mb-0">عميد المعهد</p>
                        <div className="h-10"></div>
                        <div className="font-bold text-[11px] sm:text-[12px] mt-1">{deanName}</div>
                    </div>
                </div>
            </footer>
        </div>
    );
};