import { StaffRecord, WeeklySchedule } from '../types';

export const displayValueOrDash = (value: any): string => {
    if (value === null || value === undefined || value === '' || value === 0) {
        return '-';
    }
    return String(value);
};

export const numberToArabicText = (num: number): string => {
    const arabicNumbers = ['صفر', 'واحد', 'اثنان', 'ثلاثة', 'أربعة', 'خمسة', 'ستة', 'سبعة', 'ثمانية', 'تسعة', 'عشرة'];
    if (num >= 0 && num <= 10) {
        return arabicNumbers[num];
    }
    return String(num); // Fallback for larger numbers
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
