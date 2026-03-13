
export interface WeeklySchedule {
    day: string;
    theoretical: number;
    practical: number;
}

export interface AttendanceRecord {
    date: string; // ISO string or YYYY-MM-DD
}

export interface StaffRecord {
    id: string;
    uid?: string;
    name: string;
    degree: string;
    department: string;
    employer: string;
    weeklySchedule: WeeklySchedule[];
    attendanceDates: string[]; // List of dates as strings
    createdAt?: any;
}

export interface ReportProps {
    recordData: StaffRecord;
}
