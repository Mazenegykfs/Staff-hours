
import React, { useMemo, useCallback, useState, useEffect } from 'react';
import { StaffRecord, ReportProps } from '../types';
import { ORDERED_ARABIC_DAYS, DAY_MAP } from '../constants';

// Declare XLSX on the window object to satisfy TypeScript since it's loaded from a CDN
declare global {
    interface Window {
        XLSX: any;
    }
}

// --- Helper Functions ---
const numberToArabicText = (num: number): string => {
    if (typeof num !== 'number' || !Number.isInteger(num)) return String(num);
    if (num === 0) return "صفر";

    const units = ["", "واحد", "اثنين", "ثلاثة", "أربعة", "خمسة", "ستة", "سبعة", "ثمانية", "تسعة"];
    const teens = ["عشرة", "أحد عشر", "اثنا عشر", "ثلاثة عشر", "أربعة عشر", "خمسة عشر", "ستة عشر", "سبعة عشر", "ثمانية عشر", "تسعة عشر"];
    const tens = ["", "", "عشرون", "ثلاثون", "أربعون", "خمسون", "ستون", "سبعون", "ثمانون", "تسعون"];
    const hundreds = ["", "مائة", "مئتان", "ثلاثمائة", "أربعمائة", "خمسمائة", "ستمائة", "سبعمائة", "ثمانمائة", "تسعمائة"];
    
    let result = [];
    let n = num;

    if (n >= 1000) {
        let thousands = Math.floor(n / 1000);
        if (thousands === 1) result.push("ألف");
        else if (thousands === 2) result.push("ألفان");
        else if (thousands >= 3 && thousands <= 10) result.push(`${numberToArabicText(thousands)} آلاف`);
        else result.push(`${numberToArabicText(thousands)} ألف`);
        n %= 1000;
    }

    if (n >= 100) {
        result.push(hundreds[Math.floor(n / 100)]);
        n %= 100;
    }
    
    if (n >= 10 && n <= 19) {
        result.push(teens[n - 10]);
    } else {
        if (n >= 20) {
            result.push(tens[Math.floor(n / 10)]);
            n %= 10;
        }
        if (n > 0) {
            result.push(units[n]);
        }
    }
    
    return result.join(" و ");
};

const getArabicMonthName = (monthNumber: number): string => {
    const arabicMonths = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];
    return arabicMonths[monthNumber - 1] || "";
};

const normalizeArabicDayNameForComparison = (dayName: string): string => {
    if (!dayName) return '';
    const normalized = String(dayName).trim();
    return DAY_MAP[normalized] || normalized;
};

const displayValueOrDash = (value: any): string | number => {
    return (value === 0 || value === '' || value === undefined || value === null) ? '-' : value;
};

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

    const isFacultyMember = useMemo(() => {
        const degree = recordData.degree?.trim() || "";
        return ["مدرس", "استاذ مساعد", "أستاذ مساعد", "استاذ", "أستاذ"].includes(degree);
    }, [recordData.degree]);

    const reportData = useMemo(() => {
        const { name, degree, department, employer, weeklySchedule, attendanceDates: rawAttendanceDates } = recordData;

        const weeklyScheduledHoursMap = new Map<string, { theoretical: number; practical: number }>();
        
        weeklySchedule.forEach(item => {
            const normalizedDayName = normalizeArabicDayNameForComparison(item.day);
            if (item.theoretical > 0 || item.practical > 0) {
                const existing = weeklyScheduledHoursMap.get(normalizedDayName) || { theoretical: 0, practical: 0 };
                existing.theoretical += item.theoretical;
                existing.practical += item.practical;
                weeklyScheduledHoursMap.set(normalizedDayName, existing);
            }
        });
        
        const weeklyScheduledDaysForDisplay = ORDERED_ARABIC_DAYS
            .filter(day => weeklyScheduledHoursMap.has(day))
            .map(day => ({
                day,
                theoretical: weeklyScheduledHoursMap.get(day)!.theoretical,
                practical: weeklyScheduledHoursMap.get(day)!.practical
            }));

        const totalScheduledTheoreticalHours = weeklyScheduledDaysForDisplay.reduce((sum, item) => sum + item.theoretical, 0);
        const totalScheduledPracticalHours = weeklyScheduledDaysForDisplay.reduce((sum, item) => sum + item.practical, 0);
        const totalScheduledWeeklyHours = totalScheduledTheoreticalHours + totalScheduledPracticalHours;

        const attendanceDates = [];
        let totalTheoreticalHoursAttendance = 0;
        let totalPracticalHoursAttendance = 0;
        let attendanceMonth = "أبريل - مايو";
        let attendanceYearStart = 2024;
        let attendanceYearEnd = 2025;

        rawAttendanceDates.forEach((dateStr, index) => {
            const dateObj = new Date(dateStr);
            if (dateObj && !isNaN(dateObj.getTime())) {
                const y = dateObj.getFullYear();
                const m = String(dateObj.getMonth() + 1).padStart(2, '0');
                const d = String(dateObj.getDate()).padStart(2, '0');
                const formattedDate = `${y}-${m}-${d}`;
                const dayOfWeekFromDate = normalizeArabicDayNameForComparison(dateObj.toLocaleDateString('ar-EG', { weekday: 'long' }));
                
                if (index === 0) {
                   const monthNumber = dateObj.getMonth() + 1;
                   attendanceMonth = getArabicMonthName(monthNumber);
                   const currentYear = dateObj.getFullYear();
                   
                   // Fall semester (August to December)
                   if ([8, 9, 10, 11, 12].includes(monthNumber)) {
                       attendanceYearStart = currentYear;
                       attendanceYearEnd = currentYear + 1;
                   } 
                   // Spring/Summer semester (January to July)
                   else {
                       attendanceYearStart = currentYear - 1;
                       attendanceYearEnd = currentYear;
                   }
                }
                
                const scheduled = weeklyScheduledHoursMap.get(dayOfWeekFromDate);
                const theoreticalHoursToday = scheduled?.theoretical || 0;
                const practicalHoursToday = scheduled?.practical || 0;
                
                attendanceDates.push({
                    serial: attendanceDates.length + 1,
                    date: formattedDate,
                    day: dayOfWeekFromDate,
                    theoretical: theoreticalHoursToday,
                    practical: practicalHoursToday
                });

                totalTheoreticalHoursAttendance += theoreticalHoursToday;
                totalPracticalHoursAttendance += practicalHoursToday;
            }
        });
        
        return {
            name, degree, department, employer,
            weeklyScheduledDaysForDisplay, totalScheduledTheoreticalHours, totalScheduledPracticalHours, totalScheduledWeeklyHours,
            attendanceDates, totalTheoreticalHoursAttendance, totalPracticalHoursAttendance, attendanceMonth, attendanceYearStart, attendanceYearEnd
        };
    }, [recordData]);


    return (
        <div className="bg-white p-2 sm:p-4 pb-12 sm:pb-16 rounded-xl shadow-lg my-2 max-w-4xl mx-auto report-container-for-print text-[10px] sm:text-[11px] leading-[1.1]">
            <header className="mb-1">
                <div className="flex justify-between items-center border-b border-gray-200 pb-1 mb-1">
                    <div className="flex items-center gap-2 text-right">
                        <img src="/ministry-logo.png" alt="وزارة التعليم العالي" crossOrigin="anonymous" referrerPolicy="no-referrer" className="w-10 h-10 sm:w-12 sm:h-12 object-contain" />
                        <h1 className="text-sm sm:text-base font-bold text-gray-800">وزارة التعليم العالي</h1>
                    </div>
                    <div className="flex items-center gap-2 text-left flex-row-reverse">
                        <img src="/kfs-logo.png" alt="المعهد العالي للهندسة والتكنولوجيا" crossOrigin="anonymous" referrerPolicy="no-referrer" className="w-10 h-10 sm:w-12 sm:h-12 object-contain" />
                        <div>
                            <h2 className="text-xs sm:text-sm font-bold text-gray-800">المعهد العالي للهندسة والتكنولوجيا</h2>
                            <h3 className="text-[10px] sm:text-xs font-semibold text-gray-600">بكفر الشيخ</h3>
                        </div>
                    </div>
                </div>
                <div className="text-center">
                    <h4 className="text-sm sm:text-base font-bold text-gray-800" dir="rtl">
                        استمارة شهر {reportData.attendanceMonth} <span dir="ltr" className="inline-block">{reportData.attendanceYearEnd}-{reportData.attendanceYearStart}</span>م
                    </h4>
                </div>
            </header>

            <section className="mb-1">
                <h4 className="text-sm font-bold text-gray-800 mb-0.5 text-center">
                    {isFacultyMember ? "بيانات عضو هيئة التدريس" : "بيانات عضو الهيئة المعاونة"}
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-0.5 text-gray-700">
                    {[
                        { label: 'الاسم:', value: reportData.name },
                        { label: 'الدرجة:', value: reportData.degree },
                        { label: 'القسم:', value: reportData.department },
                        { label: 'جهة الانتداب:', value: reportData.employer },
                    ].map(item => (
                        <div key={item.label} className="flex justify-start gap-2 border-b pb-0.5">
                            <span className="font-semibold w-20 shrink-0 text-right">{item.label}</span>
                            <span className="text-right flex-1 font-medium">{displayValueOrDash(item.value)}</span>
                        </div>
                    ))}
                </div>
            </section>

            <section className="mb-1">
                <h4 className="text-sm font-bold text-gray-800 mb-0.5 text-center">توزيع الساعات اسبوعيا</h4>
                <table className="w-full border-collapse text-center text-[10px] sm:text-[11px]">
                    <thead className="bg-gray-100">
                        <tr>
                            <th rowSpan={2} className="border px-1 py-0.5 font-semibold w-1/3">ايام الحضور</th>
                            <th colSpan={2} className="border px-1 py-0.5 font-semibold w-2/3">ساعات التدريس</th>
                        </tr>
                        <tr>
                            <th className="border px-1 py-0.5 font-semibold">نظري</th>
                            <th className="border px-1 py-0.5 font-semibold">درس / اشراف</th>
                        </tr>
                    </thead>
                    <tbody>
                        {reportData.weeklyScheduledDaysForDisplay.map((schedule) => (
                            <tr key={schedule.day}>
                                <td className="border px-1 py-0.5 text-right">{displayValueOrDash(schedule.day)}</td>
                                <td className="border px-1 py-0.5">{displayValueOrDash(schedule.theoretical)}</td>
                                <td className="border px-1 py-0.5">{displayValueOrDash(schedule.practical)}</td>
                            </tr>
                        ))}
                        <tr className="bg-gray-50 font-bold">
                            <td className="border px-1 py-0.5 text-right">إجمالي الساعات الأسبوعية</td>
                            <td className="border px-1 py-0.5">{displayValueOrDash(reportData.totalScheduledTheoreticalHours)}</td>
                            <td className="border px-1 py-0.5">{displayValueOrDash(reportData.totalScheduledPracticalHours)}</td>
                        </tr>
                    </tbody>
                </table>
            </section>
            
            <section className="mb-1">
                <h4 className="text-sm font-bold text-gray-800 mb-0.5 text-center">عدد أيام الغياب والحضور الفعلي شهريا</h4>
                <table className="w-full border-collapse text-center text-[10px] sm:text-[11px]">
                    <thead className="bg-gray-100">
                        <tr>
                            <th className="border px-1 py-0.5 font-semibold">م</th>
                            <th className="border px-1 py-0.5 font-semibold">تاريخ الحضور</th>
                            <th className="border px-1 py-0.5 font-semibold">اليوم</th>
                            <th className="border px-1 py-0.5 font-semibold">نظري</th>
                            <th className="border px-1 py-0.5 font-semibold">عملي</th>
                        </tr>
                    </thead>
                    <tbody>
                        {reportData.attendanceDates.map((att) => (
                            <tr key={att.serial}>
                                <td className="border px-1 py-0.5">{displayValueOrDash(att.serial)}</td>
                                <td className="border px-1 py-0.5">{displayValueOrDash(att.date)}</td>
                                <td className="border px-1 py-0.5">{displayValueOrDash(att.day)}</td>
                                <td className="border px-1 py-0.5">{displayValueOrDash(att.theoretical)}</td>
                                <td className="border px-1 py-0.5">{displayValueOrDash(att.practical)}</td>
                            </tr>
                        ))}
                        <tr className="bg-gray-50 font-bold">
                            <td colSpan={3} className="border px-1 py-0.5 text-right">إجمالي الساعات الفعلية</td>
                            <td className="border px-1 py-0.5">{displayValueOrDash(reportData.totalTheoreticalHoursAttendance)}</td>
                            <td className="border px-1 py-0.5">{displayValueOrDash(reportData.totalPracticalHoursAttendance)}</td>
                        </tr>
                    </tbody>
                </table>
            </section>

            <section className="text-right mb-2 text-[10px] sm:text-[11px]" dir="rtl">
                 <div className="flex flex-wrap items-center justify-start gap-1 mb-1">
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

            <footer className="mt-1 break-inside-avoid">
                <div className="flex justify-around items-end mb-1 text-center text-[9px] sm:text-[10px]">
                    <div className="flex-1 px-2">
                        <p className="font-bold mb-0.5">التوقيع</p>
                        <div className="border-b border-dotted border-gray-400 h-2"></div>
                    </div>
                    <div className="flex-1 px-2 relative group">
                        <p className="font-bold mb-0.5">شئون هيئة التدريس</p>
                        <div className="border-b border-dotted border-gray-400 h-2"></div>
                        <div className="font-bold mt-0.5 inline-block">
                            {clerkName}
                        </div>
                    </div>
                    <div className="flex-1 px-2 relative group">
                        <p className="font-bold mb-0.5">أمين المعهد</p>
                        <div className="border-b border-dotted border-gray-400 h-2"></div>
                        <div className="font-bold mt-0.5 inline-block">
                            {secretaryName}
                        </div>
                    </div>
                </div>
                <div className="text-left mt-10 relative group">
                    <p className="font-bold text-[10px] sm:text-[11px]">عميد المعهد</p>
                    <div className="h-8 w-1/2 ml-auto"></div>
                    <div className="font-bold text-[10px] sm:text-[11px] mt-0.5 inline-block">
                        {deanName}
                    </div>
                </div>
            </footer>
        </div>
    );
};