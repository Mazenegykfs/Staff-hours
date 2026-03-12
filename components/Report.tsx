
import React, { useMemo, useCallback } from 'react';
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


export const Report: React.FC<ReportProps> = ({ recordData }) => {

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
        let attendanceMonthHeader = "استمارات شهر أبريل - مايو 2024-2025م"; // Default

        rawAttendanceDates.forEach((dateStr, index) => {
            const dateObj = new Date(dateStr);
            if (dateObj && !isNaN(dateObj.getTime())) {
                const formattedDate = dateObj.toLocaleDateString('ar-EG-u-nu-latn', { year: 'numeric', month: '2-digit', day: '2-digit' });
                const dayOfWeekFromDate = normalizeArabicDayNameForComparison(dateObj.toLocaleDateString('ar-EG', { weekday: 'long' }));
                
                if (index === 0) {
                   const monthNumber = dateObj.getMonth() + 1;
                   const arabicMonth = getArabicMonthName(monthNumber);
                   const year = dateObj.getFullYear();
                   attendanceMonthHeader = `استمارة شهر ${arabicMonth} ${year}-${year + 1}م`;
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
            attendanceDates, totalTheoreticalHoursAttendance, totalPracticalHoursAttendance, attendanceMonthHeader
        };
    }, [recordData]);


    return (
        <div className="bg-white p-6 sm:p-10 rounded-xl shadow-lg my-8 max-w-4xl mx-auto report-container-for-print">
            <header>
                <div className="text-center mb-4 flex justify-between items-center relative">
                    <img src="https://i.ibb.co/6yYJ1Bq/01.png" alt="Logo 01" className="w-24 h-24 sm:w-32 sm:h-32 object-contain" />
                    <h1 className="text-xl sm:text-2xl font-bold text-gray-800">وزارة التعليم العالي</h1>
                    <img src="https://i.ibb.co/JqjT7G1/02.png" alt="Logo 02" className="w-24 h-24 sm:w-32 sm:h-32 object-contain" />
                </div>
                <div className="text-center mb-6">
                    <h2 className="text-lg sm:text-xl font-semibold text-gray-700">المعهد العالي للهندسة والتكنولوجيا</h2>
                    <h3 className="text-base sm:text-lg text-gray-600">بكفر الشيخ</h3>
                </div>
                <div className="mb-6">
                    <h4 className="text-xl font-bold text-gray-800 text-center">{reportData.attendanceMonthHeader}</h4>
                </div>
            </header>

            <section className="mb-6">
                <h4 className="text-xl font-bold text-gray-800 mb-4 text-center">بيانات عضو هيئة التدريس / الهيئة المعاونة</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3 text-gray-700 text-base">
                    {[
                        { label: 'الاسم:', value: reportData.name },
                        { label: 'الدرجة:', value: reportData.degree },
                        { label: 'القسم:', value: reportData.department },
                        { label: 'جهة الانتداب:', value: reportData.employer },
                    ].map(item => (
                        <div key={item.label} className="flex justify-between border-b pb-2">
                            <span className="font-semibold">{item.label}</span>
                            <span className="text-right">{displayValueOrDash(item.value)}</span>
                        </div>
                    ))}
                </div>
            </section>

            <section className="mb-6">
                <h4 className="text-xl font-bold text-gray-800 mb-4 text-center">توزيع الساعات اسبوعيا</h4>
                <table className="w-full border-collapse text-center">
                    <thead className="bg-gray-100">
                        <tr>
                            <th rowSpan={2} className="border p-2 font-semibold w-1/3">ايام الحضور</th>
                            <th colSpan={2} className="border p-2 font-semibold w-2/3">ساعات التدريس</th>
                        </tr>
                        <tr>
                            <th className="border p-2 font-semibold">نظري</th>
                            <th className="border p-2 font-semibold">درس / اشراف</th>
                        </tr>
                    </thead>
                    <tbody>
                        {reportData.weeklyScheduledDaysForDisplay.map((schedule) => (
                            <tr key={schedule.day}>
                                <td className="border p-2 text-right">{displayValueOrDash(schedule.day)}</td>
                                <td className="border p-2">{displayValueOrDash(schedule.theoretical)}</td>
                                <td className="border p-2">{displayValueOrDash(schedule.practical)}</td>
                            </tr>
                        ))}
                        <tr className="bg-gray-50 font-bold">
                            <td className="border p-2 text-right">إجمالي الساعات الأسبوعية</td>
                            <td className="border p-2">{displayValueOrDash(reportData.totalScheduledTheoreticalHours)}</td>
                            <td className="border p-2">{displayValueOrDash(reportData.totalScheduledPracticalHours)}</td>
                        </tr>
                         <tr className="bg-gray-100 font-bold">
                            <td colSpan={3} className="border p-2 text-right">إجمالي ساعات الجدول: {displayValueOrDash(reportData.totalScheduledWeeklyHours)} ساعة</td>
                        </tr>
                    </tbody>
                </table>
            </section>
            
            <section className="mb-6">
                <h4 className="text-xl font-bold text-gray-800 mb-4 text-center">عدد أيام الغياب والحضور الفعلي شهريا</h4>
                <table className="w-full border-collapse text-center">
                    <thead className="bg-gray-100">
                        <tr>
                            <th className="border p-2 font-semibold">م</th>
                            <th className="border p-2 font-semibold">تاريخ الحضور</th>
                            <th className="border p-2 font-semibold">اليوم</th>
                            <th className="border p-2 font-semibold">نظري</th>
                            <th className="border p-2 font-semibold">عملي</th>
                            <th className="border p-2 font-semibold">توقيع</th>
                        </tr>
                    </thead>
                    <tbody>
                        {reportData.attendanceDates.map((att) => (
                            <tr key={att.serial}>
                                <td className="border p-2">{displayValueOrDash(att.serial)}</td>
                                <td className="border p-2">{displayValueOrDash(att.date)}</td>
                                <td className="border p-2">{displayValueOrDash(att.day)}</td>
                                <td className="border p-2">{displayValueOrDash(att.theoretical)}</td>
                                <td className="border p-2">{displayValueOrDash(att.practical)}</td>
                                <td className="border p-2"></td>
                            </tr>
                        ))}
                        <tr className="bg-gray-50 font-bold">
                            <td colSpan={3} className="border p-2 text-right">إجمالي الساعات الفعلية</td>
                            <td className="border p-2">{displayValueOrDash(reportData.totalTheoreticalHoursAttendance)}</td>
                            <td className="border p-2">{displayValueOrDash(reportData.totalPracticalHoursAttendance)}</td>
                            <td className="border p-2"></td>
                        </tr>
                    </tbody>
                </table>
            </section>

            <section className="text-right mb-10 text-base">
                 <p><strong>إجمالي ساعات الدرس/الاشراف الفعلية:</strong> {displayValueOrDash(reportData.totalPracticalHoursAttendance)} ({numberToArabicText(reportData.totalPracticalHoursAttendance)}) ساعة</p>
                 <p><strong>إجمالي ساعات المحاضرات الفعلية:</strong> {displayValueOrDash(reportData.totalTheoreticalHoursAttendance)} ({numberToArabicText(reportData.totalTheoreticalHoursAttendance)}) ساعة</p>
            </section>

            <footer className="mt-20">
                <div className="flex justify-around items-end mb-16 text-center text-sm sm:text-base">
                    {[ "التوقيع", "شئون هيئة التدريس", "أمين المعهد" ].map(title => (
                        <div key={title} className="flex-1">
                            <p className="font-bold mb-2">{title}</p>
                            <div className="border-b-2 border-dotted border-gray-400 h-10"></div>
                        </div>
                    ))}
                </div>
                <div className="text-left mt-10">
                    <p className="font-bold text-base sm:text-lg">عميد المعهد</p>
                    <div className="border-b-2 border-dotted border-gray-400 h-10 w-2/3"></div>
                    <p className="font-bold text-base sm:text-lg mt-2">( أ.د. / مصطفى كامل )</p>
                </div>
            </footer>
        </div>
    );
};