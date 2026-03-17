import { StaffRecord, WeeklySchedule } from '../types';

export const displayValueOrDash = (value: any): string => {
    if (value === null || value === undefined || value === '' || value === 0) {
        return '-';
    }
    return String(value);
};

export const getHourWord = (num: number): string => {
    if (num === 1) return 'ساعة';
    if (num === 2) return 'ساعتان';
    if (num >= 3 && num <= 10) return 'ساعات';
    return 'ساعة';
};

export const numberToArabicText = (num: number): string => {
    if (num === 0) return 'صفر';
    
    const ones = ['', 'واحد', 'اثنان', 'ثلاثة', 'أربعة', 'خمسة', 'ستة', 'سبعة', 'ثمانية', 'تسعة'];
    const tens = ['', 'عشرة', 'عشرون', 'ثلاثون', 'أربعون', 'خمسون', 'ستون', 'سبعون', 'ثمانون', 'تسعون'];
    const teens = ['عشرة', 'أحد عشر', 'اثنا عشر', 'ثلاثة عشر', 'أربعة عشر', 'خمسة عشر', 'ستة عشر', 'سبعة عشر', 'ثمانية عشر', 'تسعة عشر'];

    if (num < 10) {
        return ones[num];
    } else if (num >= 10 && num < 20) {
        return teens[num - 10];
    } else if (num >= 20 && num < 100) {
        const one = num % 10;
        const ten = Math.floor(num / 10);
        if (one === 0) {
            return tens[ten];
        } else {
            return `${ones[one]} و${tens[ten]}`;
        }
    }
    
    return String(num); // Fallback for numbers >= 100
};

export const computeReportData = (record: StaffRecord) => {
    const isFacultyMember = record.degree.includes('أستاذ') || record.degree.includes('مدرس');
    
    const totalScheduledTheoreticalHours = record.weeklySchedule.reduce((sum, s) => sum + (Number(s.theoretical) || 0), 0);
    const totalScheduledPracticalHours = record.weeklySchedule.reduce((sum, s) => sum + (Number(s.practical) || 0), 0);

    const daysOfWeekArabic = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
    
    let totalTheoreticalHoursAttendance = 0;
    let totalPracticalHoursAttendance = 0;

    const attendanceDatesProcessed = record.attendanceDates.map((dateStr, index) => {
        const dateObj = new Date(dateStr);
        const dayOfWeekIndex = dateObj.getDay();
        const dayName = daysOfWeekArabic[dayOfWeekIndex];
        
        const schedule = record.weeklySchedule.find(s => s.day === dayName);
        const theoretical = schedule ? (Number(schedule.theoretical) || 0) : 0;
        const practical = schedule ? (Number(schedule.practical) || 0) : 0;

        totalTheoreticalHoursAttendance += theoretical;
        totalPracticalHoursAttendance += practical;

        return {
            serial: index + 1,
            date: dateStr,
            day: dayName,
            theoretical,
            practical
        };
    });

    let attendanceMonth = '';
    let attendanceYearStart = '';
    let attendanceYearEnd = '';
    
    if (record.attendanceDates.length > 0) {
        const firstDate = new Date(record.attendanceDates[0]);
        const monthsArabic = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
        attendanceMonth = monthsArabic[firstDate.getMonth()];
        const year = firstDate.getFullYear();
        if (firstDate.getMonth() >= 8) {
            attendanceYearStart = String(year);
            attendanceYearEnd = String(year + 1);
        } else {
            attendanceYearStart = String(year - 1);
            attendanceYearEnd = String(year);
        }
    }

    return {
        isFacultyMember,
        name: record.name,
        degree: record.degree,
        department: record.department,
        employer: record.employer,
        weeklyScheduledDaysForDisplay: record.weeklySchedule,
        totalScheduledTheoreticalHours,
        totalScheduledPracticalHours,
        attendanceDates: attendanceDatesProcessed,
        totalTheoreticalHoursAttendance,
        totalPracticalHoursAttendance,
        attendanceMonth,
        attendanceYearStart,
        attendanceYearEnd
    };
};
