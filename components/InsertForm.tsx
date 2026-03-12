
import React, { useState } from 'react';
import { StaffRecord, WeeklySchedule } from '../types';
import { ORDERED_ARABIC_DAYS } from '../constants';
import { Plus, Trash2, Save, X } from 'lucide-react';

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
    const [newDate, setNewDate] = useState('');
    const [error, setError] = useState('');

    const handleScheduleChange = (index: number, field: keyof WeeklySchedule, value: string | number) => {
        const updated = [...weeklySchedule];
        updated[index] = { ...updated[index], [field]: value };
        setWeeklySchedule(updated);
    };

    const addAttendanceDate = () => {
        setError('');
        if (!newDate) return;

        const dateObj = new Date(newDate);
        const dayName = dateObj.toLocaleDateString('ar-EG', { weekday: 'long' });
        
        // Normalize day name for comparison
        const normalizedDay = ORDERED_ARABIC_DAYS.find(d => 
            dayName.includes(d) || d.includes(dayName)
        ) || dayName;

        const scheduledDay = weeklySchedule.find(s => s.day === normalizedDay);
        
        if (!scheduledDay || (scheduledDay.theoretical === 0 && scheduledDay.practical === 0)) {
            setError(`عذراً، يوم ${normalizedDay} غير مدرج في جدول الساعات الأسبوعية لهذا العضو.`);
            return;
        }

        if (!attendanceDates.includes(newDate)) {
            setAttendanceDates([...attendanceDates, newDate].sort());
            setNewDate('');
        }
    };

    const removeAttendanceDate = (date: string) => {
        setAttendanceDates(attendanceDates.filter(d => d !== date));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!name) {
            alert('الرجاء إدخال الاسم');
            return;
        }
        const record: StaffRecord = {
            id: initialData?.id || crypto.randomUUID(),
            name,
            degree,
            department,
            employer,
            weeklySchedule,
            attendanceDates
        };
        onSave(record);
    };

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
                    <input
                        type="text"
                        value={degree}
                        onChange={(e) => setDegree(e.target.value)}
                        className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                </div>
                <div className="space-y-2">
                    <label className="block font-semibold text-gray-700">القسم</label>
                    <input
                        type="text"
                        value={department}
                        onChange={(e) => setDepartment(e.target.value)}
                        className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                </div>
                <div className="space-y-2">
                    <label className="block font-semibold text-gray-700">جهة العمل / الانتداب</label>
                    <input
                        type="text"
                        value={employer}
                        onChange={(e) => setEmployer(e.target.value)}
                        className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    />
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
                                            className="w-full p-1 text-center border rounded"
                                            min="0"
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
                    <div className="flex gap-2">
                        <input
                            type="date"
                            value={newDate}
                            onChange={(e) => setNewDate(e.target.value)}
                            className="flex-1 p-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <button
                            type="button"
                            onClick={addAttendanceDate}
                            className="bg-blue-600 text-white p-2 rounded-lg hover:bg-blue-700 flex items-center gap-1"
                        >
                            <Plus size={20} /> إضافة تاريخ
                        </button>
                    </div>
                    {error && (
                        <p className="text-red-600 text-sm font-bold bg-red-50 p-2 rounded border border-red-100 animate-pulse">
                            {error}
                        </p>
                    )}
                </div>
                <div className="flex flex-wrap gap-2">
                    {attendanceDates.map(date => (
                        <div key={date} className="bg-blue-50 text-blue-700 px-3 py-1 rounded-full flex items-center gap-2 border border-blue-200">
                            <span>{new Date(date).toLocaleDateString('ar-EG')}</span>
                            <button
                                type="button"
                                onClick={() => removeAttendanceDate(date)}
                                className="text-red-500 hover:text-red-700"
                            >
                                <X size={16} />
                            </button>
                        </div>
                    ))}
                    {attendanceDates.length === 0 && (
                        <p className="text-gray-500 italic">لم يتم إضافة تواريخ بعد</p>
                    )}
                </div>
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
