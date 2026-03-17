
import React, { useState, useEffect } from 'react';
import { StaffRecord, WeeklySchedule } from '../types';
import { ORDERED_ARABIC_DAYS, EMPLOYER_OPTIONS } from '../constants';
import { Plus, Trash2, Save, X, Calendar } from 'lucide-react';
import DatePicker, { DateObject } from "react-multi-date-picker";
import gregorian_ar from "react-date-object/locales/gregorian_ar";
import { computeReportData, displayValueOrDash } from '../utils/reportLogic';

const CustomDatePickerInput = React.forwardRef<HTMLButtonElement, any>((props, ref) => {
    return (
        <button
            type="button"
            onClick={props.openCalendar}
            ref={ref}
            className="px-4 py-2 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-100 flex items-center gap-2 transition-colors w-full sm:w-auto justify-center"
        >
            <Calendar size={20} />
            <span className="font-medium">اختر تواريخ الحضور</span>
        </button>
    );
});
CustomDatePickerInput.displayName = "CustomDatePickerInput";

interface InsertFormProps {
    onSave: (record: StaffRecord) => void;
    onCancel: () => void;
    initialData?: StaffRecord;
}

export const InsertForm: React.FC<InsertFormProps> = ({ onSave, onCancel, initialData }) => {
    const [name, setName] = useState(initialData?.name || '');
    const [degree, setDegree] = useState(initialData?.degree || '');
    const [department, setDepartment] = useState(initialData?.department || '');
    const [employer, setEmployer] = useState(initialData?.employer || '');
    
    const [weeklySchedule, setWeeklySchedule] = useState<WeeklySchedule[]>(
        initialData?.weeklySchedule || [
            { day: 'السبت', theoretical: 0, practical: 0 },
            { day: 'الأحد', theoretical: 0, practical: 0 },
            { day: 'الاثنين', theoretical: 0, practical: 0 },
            { day: 'الثلاثاء', theoretical: 0, practical: 0 },
            { day: 'الأربعاء', theoretical: 0, practical: 0 },
            { day: 'الخميس', theoretical: 0, practical: 0 },
        ]
    );

    const [attendanceDates, setAttendanceDates] = useState<string[]>(initialData?.attendanceDates || []);
    const [error, setError] = useState('');

    const isTheoreticalDisabled = ['معيد', 'مدرس مساعد', 'مهندس حر'].includes(degree);

    const handleDegreeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const newDegree = e.target.value;
        setDegree(newDegree);
        if (['معيد', 'مدرس مساعد', 'مهندس حر'].includes(newDegree)) {
            setWeeklySchedule(prev => prev.map(item => ({ ...item, theoretical: 0 })));
        }
    };

    const handleScheduleChange = (index: number, field: keyof WeeklySchedule, value: string | number) => {
        const updated = [...weeklySchedule];
        updated[index] = { ...updated[index], [field]: value };
        setWeeklySchedule(updated);
    };

    const removeAttendanceDate = (date: string) => {
        setAttendanceDates(attendanceDates.filter(d => d !== date));
    };

    useEffect(() => {
        setAttendanceDates(prevDates => {
            const validDates = prevDates.filter(dateStr => {
                const arabicNumbers = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
                const englishDateStr = dateStr.replace(/[٠-٩]/g, w => arabicNumbers.indexOf(w).toString());
                const [year, month, day] = englishDateStr.split('-').map(Number);
                const jsDate = new Date(year, month - 1, day);
                const daysOfWeekArabic = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
                const normalizedDay = daysOfWeekArabic[jsDate.getDay()];

                const scheduledDay = weeklySchedule.find(s => s.day === normalizedDay);
                
                if (scheduledDay && (scheduledDay.theoretical > 0 || scheduledDay.practical > 0)) {
                    return true;
                }
                return false;
            });

            if (validDates.length !== prevDates.length) {
                return validDates;
            }
            return prevDates;
        });
    }, [weeklySchedule]);

    const today = new Date();
    const minDate = new Date(today.getFullYear(), today.getMonth() - 2, 1);
    const maxDate = new Date(today.getFullYear(), today.getMonth() + 3, 0);

    const mapDays = ({ date }: { date: DateObject }) => {
        const jsDate = date.toDate();
        const daysOfWeekArabic = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
        const normalizedDay = daysOfWeekArabic[jsDate.getDay()];

        const scheduledDay = weeklySchedule.find(s => s.day === normalizedDay);
        
        if (!scheduledDay || (scheduledDay.theoretical === 0 && scheduledDay.practical === 0)) {
            return {
                disabled: true,
                style: { color: "#ccc" },
                onClick: () => setError(`عذراً، يوم ${normalizedDay} غير مدرج في جدول الساعات الأسبوعية لهذا العضو.`)
            }
        }
        return {};
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!name) {
            alert('الرجاء إدخال الاسم');
            return;
        }
        const record: StaffRecord = {
            id: initialData?.id || '',
            name,
            degree,
            department,
            employer,
            weeklySchedule,
            attendanceDates
        };
        onSave(record);
    };

    const currentRecord: StaffRecord = {
        id: initialData?.id || '',
        name,
        degree,
        department,
        employer,
        weeklySchedule,
        attendanceDates
    };
    const reportData = computeReportData(currentRecord);

    return (
        <form onSubmit={handleSubmit} className="bg-white p-6 rounded-xl shadow-lg space-y-6 max-w-4xl mx-auto" dir="rtl">
            <div className="flex justify-between items-center border-b pb-4">
                <h2 className="text-2xl font-bold text-gray-800">{initialData ? 'تعديل بيانات' : 'إضافة عضو هيئة تدريس جديد'}</h2>
                <button type="button" onClick={onCancel} className="text-gray-500 hover:text-red-500">
                    <X size={24} />
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                    <label className="block font-semibold text-gray-700">الاسم</label>
                    <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                        required
                    />
                </div>
                <div className="space-y-2">
                    <label className="block font-semibold text-gray-700">الدرجة العلمية</label>
                    <select
                        value={degree}
                        onChange={handleDegreeChange}
                        className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                    >
                        <option value="">اختر الدرجة العلمية</option>
                        <option value="أستاذ متفرغ">أستاذ متفرغ</option>
                        <option value="أستاذ">أستاذ</option>
                        <option value="أستاذ مساعد">أستاذ مساعد</option>
                        <option value="مدرس">مدرس</option>
                        <option value="مدرس مساعد">مدرس مساعد</option>
                        <option value="معيد">معيد</option>
                        <option value="مهندس حر">مهندس حر</option>
                    </select>
                </div>
                <div className="space-y-2">
                    <label className="block font-semibold text-gray-700">القسم</label>
                    <select
                        value={department}
                        onChange={(e) => setDepartment(e.target.value)}
                        className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                    >
                        <option value="">اختر القسم</option>
                        <option value="العلوم الاساسية">العلوم الاساسية</option>
                        <option value="الهندسة المدنية">الهندسة المدنية</option>
                        <option value="الهندسة المعمارية">الهندسة المعمارية</option>
                        <option value="الهندسة الكهربية (شعبة هندسة الاتصالات والإلكترونيات الكهربية)">الهندسة الكهربية (شعبة هندسة الاتصالات والإلكترونيات الكهربية)</option>
                        <option value="الهندسة الكهربية (شعبة هندسة الحاسبات والتحكم الالي)">الهندسة الكهربية (شعبة هندسة الحاسبات والتحكم الالي)</option>
                    </select>
                </div>
                <div className="space-y-2">
                    <label className="block font-semibold text-gray-700">جهة العمل / الانتداب</label>
                    <input
                        type="text"
                        value={employer}
                        onChange={(e) => setEmployer(e.target.value)}
                        list="employer-options"
                        className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                    <datalist id="employer-options">
                        {EMPLOYER_OPTIONS.map((option, index) => (
                            <option key={index} value={option} />
                        ))}
                    </datalist>
                </div>
            </div>

            <div className="space-y-4">
                <h3 className="text-xl font-bold text-gray-800 border-b pb-2">توزيع الساعات الأسبوعية</h3>
                <div className="overflow-x-auto">
                    <table className="w-full border-collapse">
                        <thead>
                            <tr className="bg-gray-50">
                                <th className="border p-2 text-right">اليوم</th>
                                <th className="border p-2">نظري</th>
                                <th className="border p-2">عملي / إشراف</th>
                            </tr>
                        </thead>
                        <tbody>
                            {weeklySchedule.map((item, index) => (
                                <tr key={item.day}>
                                    <td className="border p-2 font-semibold">{item.day}</td>
                                    <td className="border p-2">
                                        <input
                                            type="number"
                                            value={item.theoretical}
                                            onChange={(e) => handleScheduleChange(index, 'theoretical', parseFloat(e.target.value) || 0)}
                                            className={`w-full p-1 text-center border rounded ${isTheoreticalDisabled ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                                            min="0"
                                            disabled={isTheoreticalDisabled}
                                        />
                                    </td>
                                    <td className="border p-2">
                                        <input
                                            type="number"
                                            value={item.practical}
                                            onChange={(e) => handleScheduleChange(index, 'practical', parseFloat(e.target.value) || 0)}
                                            className="w-full p-1 text-center border rounded"
                                            min="0"
                                        />
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            <div className="space-y-4">
                <h3 className="text-xl font-bold text-gray-800 border-b pb-2">تواريخ الحضور الفعلي</h3>
                <div className="flex flex-col gap-2">
                    <div className="flex gap-2 items-center">
                        <DatePicker
                            multiple
                            value={attendanceDates}
                            onChange={(dateObjects: DateObject[] | null) => {
                                setError('');
                                setAttendanceDates(dateObjects ? dateObjects.map(d => {
                                    const formatted = d.format("YYYY-MM-DD");
                                    const arabicNumbers = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
                                    return formatted.replace(/[٠-٩]/g, (w: string) => arabicNumbers.indexOf(w).toString());
                                }) : []);
                            }}
                            format="YYYY-MM-DD"
                            locale={gregorian_ar}
                            weekDays={["السبت", "الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة"]}
                            weekStartDayIndex={0}
                            minDate={minDate}
                            maxDate={maxDate}
                            mapDays={mapDays}
                            className="custom-calendar"
                            render={<CustomDatePickerInput />}
                        />
                    </div>
                    {error && (
                        <p className="text-red-600 text-sm font-bold bg-red-50 p-2 rounded border border-red-100 animate-pulse">
                            {error}
                        </p>
                    )}
                </div>
                {attendanceDates.length === 0 && (
                    <div className="mt-2">
                        <p className="text-gray-500 italic">لم يتم إضافة تواريخ بعد</p>
                    </div>
                )}

                {attendanceDates.length > 0 && (
                    <div className="mt-6">
                        <h4 className="text-lg font-bold text-gray-800 mb-3">عدد أيام الحضور الفعلي شهريا</h4>
                        <div className="overflow-x-auto">
                            <table className="w-full border-collapse text-center text-sm">
                                <thead className="bg-gray-100">
                                    <tr>
                                        <th className="border p-2">م</th>
                                        <th className="border p-2">تاريخ الحضور</th>
                                        <th className="border p-2">اليوم</th>
                                        <th className="border p-2">نظري</th>
                                        <th className="border p-2">عملي</th>
                                        <th className="border p-2">إجراء</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {reportData.attendanceDates.map((att, idx) => {
                                        const [y, m, d] = att.date.split('-').map(Number);
                                        const localDate = new Date(y, m - 1, d);
                                        return (
                                            <tr key={idx} className="hover:bg-gray-50">
                                                <td className="border p-2">{displayValueOrDash(att.serial)}</td>
                                                <td className="border p-2">{localDate.toLocaleDateString('ar-EG')}</td>
                                                <td className="border p-2">{displayValueOrDash(att.day)}</td>
                                                <td className="border p-2">{displayValueOrDash(att.theoretical)}</td>
                                                <td className="border p-2">{displayValueOrDash(att.practical)}</td>
                                                <td className="border p-2">
                                                    <button
                                                        type="button"
                                                        onClick={() => removeAttendanceDate(att.date)}
                                                        className="text-red-500 hover:text-red-700 flex justify-center w-full"
                                                        title="حذف"
                                                    >
                                                        <Trash2 size={18} />
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                    <tr className="bg-gray-50 font-bold">
                                        <td colSpan={3} className="border p-2 text-left">إجمالي الساعات الفعلية</td>
                                        <td className="border p-2">{displayValueOrDash(reportData.totalTheoreticalHoursAttendance)}</td>
                                        <td className="border p-2">{displayValueOrDash(reportData.totalPracticalHoursAttendance)}</td>
                                        <td className="border p-2"></td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>

            <div className="flex justify-end gap-3 pt-6 border-t">
                <button
                    type="button"
                    onClick={onCancel}
                    className="px-6 py-2 border rounded-lg hover:bg-gray-50 transition-colors"
                >
                    إلغاء
                </button>
                <button
                    type="submit"
                    className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
                >
                    <Save size={20} /> {initialData ? 'تحديث البيانات' : 'حفظ البيانات'}
                </button>
            </div>
        </form>
    );
};
