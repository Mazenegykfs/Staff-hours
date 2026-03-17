
import * as XLSX from 'xlsx';
import { StaffRecord } from '../types';
import { ORDERED_ARABIC_DAYS } from '../constants';

export const exportRecordsToExcel = (records: StaffRecord[]) => {
    // Find the maximum number of attendance dates to create enough columns
    const maxAttendanceDates = Math.max(...records.map(r => r.attendanceDates?.length || 0), 0);

    // Flatten records for Excel
    const data = records.map(record => {
        const row: any = {
            'الاسم': record.name,
            'الدرجة العلمية': record.degree,
            'القسم': record.department,
            'جهة العمل': record.employer,
        };

        // Add weekly schedule columns
        ORDERED_ARABIC_DAYS.forEach(day => {
            const schedule = record.weeklySchedule?.find(s => s.day === day);
            row[`${day} - نظري`] = schedule?.theoretical || 0;
            row[`${day} - عملي`] = schedule?.practical || 0;
        });

        // Add attendance dates columns
        for (let i = 0; i < maxAttendanceDates; i++) {
            row[`تاريخ الحضور ${i + 1}`] = record.attendanceDates?.[i] || '';
        }

        row['ID'] = record.id;
        row['UID'] = record.uid || '';

        return row;
    });

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Staff Records");

    // Generate Excel file and trigger download
    XLSX.writeFile(workbook, `staff_records_${new Date().toISOString().split('T')[0]}.xlsx`);
};

export const importRecordsFromExcel = (file: File): Promise<Partial<StaffRecord>[]> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target?.result as ArrayBuffer);
                const workbook = XLSX.read(data, { type: 'array' });
                const firstSheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[firstSheetName];
                const jsonData = XLSX.utils.sheet_to_json(worksheet) as any[];

                const records: Partial<StaffRecord>[] = jsonData.map(item => {
                    // Extract weekly schedule
                    const weeklySchedule = ORDERED_ARABIC_DAYS.map(day => {
                        const theoretical = Number(item[`${day} - نظري`]) || 0;
                        const practical = Number(item[`${day} - عملي`]) || 0;
                        return { day, theoretical, practical };
                    }).filter(s => s.theoretical > 0 || s.practical > 0);

                    // Extract attendance dates
                    const attendanceDates: string[] = [];
                    let i = 1;
                    while (item[`تاريخ الحضور ${i}`] !== undefined) {
                        const dateVal = item[`تاريخ الحضور ${i}`];
                        if (dateVal) {
                            let dateStr = String(dateVal).trim();
                            if (typeof dateVal === 'number') {
                                const jsDate = new Date(Math.round((dateVal - 25569) * 86400 * 1000));
                                dateStr = jsDate.toISOString().split('T')[0];
                            }
                            if (dateStr) {
                                attendanceDates.push(dateStr);
                            }
                        }
                        i++;
                    }

                    // Fallback for old format (JSON string) if present
                    let parsedWeeklySchedule = weeklySchedule;
                    if (item['الجدول الأسبوعي'] && typeof item['الجدول الأسبوعي'] === 'string' && item['الجدول الأسبوعي'].startsWith('[')) {
                        try {
                            parsedWeeklySchedule = JSON.parse(item['الجدول الأسبوعي']);
                        } catch (e) {}
                    }

                    let parsedAttendanceDates = attendanceDates;
                    if (item['تواريخ الحضور'] && typeof item['تواريخ الحضور'] === 'string' && item['تواريخ الحضور'].startsWith('[')) {
                        try {
                            parsedAttendanceDates = JSON.parse(item['تواريخ الحضور']);
                        } catch (e) {}
                    }

                    // Filter attendance dates to ensure they match the weekly schedule
                    const validAttendanceDates = parsedAttendanceDates.filter(dateStr => {
                        try {
                            const [year, month, day] = dateStr.split('-').map(Number);
                            const jsDate = new Date(year, month - 1, day);
                            const daysOfWeekArabic = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
                            const normalizedDay = daysOfWeekArabic[jsDate.getDay()];
                            
                            const scheduledDay = parsedWeeklySchedule.find((s: any) => s.day === normalizedDay);
                            return scheduledDay && (scheduledDay.theoretical > 0 || scheduledDay.practical > 0);
                        } catch (e) {
                            return false;
                        }
                    });

                    return {
                        id: item['ID'] || undefined,
                        uid: item['UID'] || undefined,
                        name: item['الاسم'] || '',
                        degree: item['الدرجة العلمية'] || '',
                        department: item['القسم'] || '',
                        employer: item['جهة العمل'] || '',
                        weeklySchedule: parsedWeeklySchedule,
                        attendanceDates: validAttendanceDates
                    };
                });

                resolve(records);
            } catch (error) {
                reject(error);
            }
        };
        reader.onerror = (error) => reject(error);
        reader.readAsArrayBuffer(file);
    });
};
