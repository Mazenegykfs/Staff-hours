import { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, AlignmentType, DirectionMode, BorderStyle, TableLayoutType, VerticalAlign, PageBreak, ImageRun } from 'docx';
import { saveAs } from 'file-saver';
import { StaffRecord } from '../types';
import { computeReportData, displayValueOrDash, numberToArabicText } from './reportLogic';

const createCell = (text: string | number, bold = false, shading?: string, colSpan = 1, rowSpan = 1) => {
    return new TableCell({
        children: [new Paragraph({
            children: [new TextRun({ text: String(text), bold, rightToLeft: true, font: "Arial", size: 22 })],
            alignment: AlignmentType.CENTER,
            bidirectional: true,
        })],
        shading: shading ? { fill: shading } : undefined,
        columnSpan: colSpan,
        rowSpan: rowSpan,
        verticalAlign: VerticalAlign.CENTER,
        margins: { top: 100, bottom: 100, left: 100, right: 100 }
    });
};

const createInfoRow = (label1: string, value1: string | number, label2: string, value2: string | number) => {
    return new TableRow({
        children: [
            new TableCell({
                children: [new Paragraph({ children: [new TextRun({ text: String(value2), rightToLeft: true, font: "Arial", size: 24 })], alignment: AlignmentType.RIGHT, bidirectional: true })],
                borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.SINGLE, size: 1, color: "E5E7EB" }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE } },
                width: { size: 40, type: WidthType.PERCENTAGE },
            }),
            new TableCell({
                children: [new Paragraph({ children: [new TextRun({ text: label2, bold: true, rightToLeft: true, font: "Arial", size: 24 })], alignment: AlignmentType.RIGHT, bidirectional: true })],
                borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE } },
                width: { size: 10, type: WidthType.PERCENTAGE },
            }),
            new TableCell({
                children: [new Paragraph({ children: [new TextRun({ text: String(value1), rightToLeft: true, font: "Arial", size: 24 })], alignment: AlignmentType.RIGHT, bidirectional: true })],
                borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.SINGLE, size: 1, color: "E5E7EB" }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE } },
                width: { size: 40, type: WidthType.PERCENTAGE },
            }),
            new TableCell({
                children: [new Paragraph({ children: [new TextRun({ text: label1, bold: true, rightToLeft: true, font: "Arial", size: 24 })], alignment: AlignmentType.RIGHT, bidirectional: true })],
                borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE } },
                width: { size: 10, type: WidthType.PERCENTAGE },
            }),
        ],
    });
};

const formatDateForWord = (dateStr: string | number) => {
    if (typeof dateStr === 'string' && dateStr.includes('-')) {
        const parts = dateStr.split('-');
        if (parts.length === 3) {
            return `${parts[2]}-${parts[1]}-${parts[0]}`;
        }
    }
    return dateStr;
};

const generateReportChildren = (record: StaffRecord, deanName: string, clerkName: string, secretaryName: string, addPageBreak: boolean, ministryLogoBuffer: ArrayBuffer | null, kfsLogoBuffer: ArrayBuffer | null) => {
    const reportData = computeReportData(record);
    
    const children = [
        // Header
        new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            layout: TableLayoutType.FIXED,
            borders: {
                top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.SINGLE, size: 2, color: "E5E7EB" },
                left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE },
                insideHorizontal: { style: BorderStyle.NONE }, insideVertical: { style: BorderStyle.NONE }
            },
            rows: [
                new TableRow({
                    children: [
                        new TableCell({
                            children: [
                                ...(kfsLogoBuffer ? [new Paragraph({
                                    children: [new ImageRun({ data: kfsLogoBuffer, transformation: { width: 50, height: 50 } })],
                                    alignment: AlignmentType.CENTER
                                })] : []),
                                new Paragraph({ children: [new TextRun({ text: "المعهد العالي للهندسة والتكنولوجيا", bold: true, rightToLeft: true, font: "Arial", size: 24 })], alignment: AlignmentType.CENTER, bidirectional: true }),
                                new Paragraph({ children: [new TextRun({ text: "بكفر الشيخ", rightToLeft: true, font: "Arial", size: 20 })], alignment: AlignmentType.CENTER, bidirectional: true }),
                            ],
                            width: { size: 33, type: WidthType.PERCENTAGE },
                        }),
                        new TableCell({
                            children: [
                                new Paragraph({ children: [new TextRun({ text: `استمارة شهر ${reportData.attendanceMonth} ${reportData.attendanceYearEnd}-${reportData.attendanceYearStart}م`, bold: true, rightToLeft: true, font: "Arial", size: 28 })], alignment: AlignmentType.CENTER, bidirectional: true }),
                            ],
                            width: { size: 34, type: WidthType.PERCENTAGE },
                            verticalAlign: VerticalAlign.CENTER,
                        }),
                        new TableCell({
                            children: [
                                ...(ministryLogoBuffer ? [new Paragraph({
                                    children: [new ImageRun({ data: ministryLogoBuffer, transformation: { width: 50, height: 50 } })],
                                    alignment: AlignmentType.CENTER
                                })] : []),
                                new Paragraph({ children: [new TextRun({ text: "وزارة التعليم العالي والبحث العلمي", bold: true, rightToLeft: true, font: "Arial", size: 28 })], alignment: AlignmentType.CENTER, bidirectional: true }),
                            ],
                            width: { size: 33, type: WidthType.PERCENTAGE },
                            verticalAlign: VerticalAlign.CENTER,
                        }),
                    ],
                }),
            ],
        }),
        new Paragraph({ text: "", spacing: { after: 200 } }),

        // Info Section
        new Paragraph({
            children: [new TextRun({ text: reportData.isFacultyMember ? "بيانات عضو هيئة التدريس" : "بيانات عضو الهيئة المعاونة", bold: true, rightToLeft: true, font: "Arial", size: 28 })],
            alignment: AlignmentType.CENTER,
            bidirectional: true,
            spacing: { after: 100 }
        }),
        new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            layout: TableLayoutType.FIXED,
            borders: {
                top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE },
                left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE },
                insideHorizontal: { style: BorderStyle.NONE }, insideVertical: { style: BorderStyle.NONE }
            },
            rows: [
                createInfoRow("الاسم:", displayValueOrDash(reportData.name), "الدرجة:", displayValueOrDash(reportData.degree)),
                createInfoRow("القسم:", displayValueOrDash(reportData.department), "جهة الانتداب:", displayValueOrDash(reportData.employer)),
            ],
        }),
        new Paragraph({ text: "", spacing: { after: 300 } }),

        // Weekly Schedule Table
        new Paragraph({
            children: [new TextRun({ text: "توزيع الساعات اسبوعيا", bold: true, rightToLeft: true, font: "Arial", size: 28 })],
            alignment: AlignmentType.CENTER,
            bidirectional: true,
            spacing: { after: 100 }
        }),
        new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
                new TableRow({
                    children: [
                        createCell("درس / اشراف", true, "F3F4F6"),
                        createCell("نظري", true, "F3F4F6"),
                        createCell("ايام الحضور", true, "F3F4F6"),
                    ],
                }),
                ...reportData.weeklyScheduledDaysForDisplay.map(schedule => (
                    new TableRow({
                        children: [
                            createCell(displayValueOrDash(schedule.practical)),
                            createCell(displayValueOrDash(schedule.theoretical)),
                            createCell(displayValueOrDash(schedule.day)),
                        ],
                    })
                )),
                new TableRow({
                    children: [
                        createCell(displayValueOrDash(reportData.totalScheduledPracticalHours), true, "F9FAFB"),
                        createCell(displayValueOrDash(reportData.totalScheduledTheoreticalHours), true, "F9FAFB"),
                        createCell("إجمالي الساعات الأسبوعية", true, "F9FAFB"),
                    ],
                }),
            ],
        }),
        new Paragraph({ text: "", spacing: { after: 300 } }),

        // Attendance Table
        new Paragraph({
            children: [new TextRun({ text: "عدد أيام الحضور الفعلي شهريا", bold: true, rightToLeft: true, font: "Arial", size: 28 })],
            alignment: AlignmentType.CENTER,
            bidirectional: true,
            spacing: { after: 100 }
        }),
        new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
                new TableRow({
                    children: [
                        createCell("عملي", true, "F3F4F6"),
                        createCell("نظري", true, "F3F4F6"),
                        createCell("اليوم", true, "F3F4F6"),
                        createCell("تاريخ الحضور", true, "F3F4F6"),
                        createCell("م", true, "F3F4F6"),
                    ],
                }),
                ...reportData.attendanceDates.map(att => (
                    new TableRow({
                        children: [
                            createCell(displayValueOrDash(att.practical)),
                            createCell(displayValueOrDash(att.theoretical)),
                            createCell(displayValueOrDash(att.day)),
                            createCell(displayValueOrDash(formatDateForWord(att.date))),
                            createCell(displayValueOrDash(att.serial)),
                        ],
                    })
                )),
                new TableRow({
                    children: [
                        createCell(displayValueOrDash(reportData.totalPracticalHoursAttendance), true, "F9FAFB"),
                        createCell(displayValueOrDash(reportData.totalTheoreticalHoursAttendance), true, "F9FAFB"),
                        createCell("إجمالي الساعات الفعلية", true, "F9FAFB", 3),
                    ],
                }),
            ],
        }),
        new Paragraph({ text: "", spacing: { after: 200 } }),

        // Totals Text
        new Paragraph({
            children: [
                new TextRun({ text: `إجمالي ساعات الدرس/الاشراف الفعلية: ${displayValueOrDash(reportData.totalPracticalHoursAttendance)} (${numberToArabicText(reportData.totalPracticalHoursAttendance)}) ساعة`, bold: true, rightToLeft: true, font: "Arial", size: 22 }),
            ],
            alignment: AlignmentType.RIGHT,
            bidirectional: true,
            spacing: { after: 100 }
        }),
        new Paragraph({
            children: [
                new TextRun({ text: `إجمالي ساعات المحاضرات الفعلية: ${displayValueOrDash(reportData.totalTheoreticalHoursAttendance)} (${numberToArabicText(reportData.totalTheoreticalHoursAttendance)}) ساعة`, bold: true, rightToLeft: true, font: "Arial", size: 22 }),
            ],
            alignment: AlignmentType.RIGHT,
            bidirectional: true,
            spacing: { after: 400 }
        }),

        // Signatures
        new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            layout: TableLayoutType.FIXED,
            borders: {
                top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE },
                left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE },
                insideHorizontal: { style: BorderStyle.NONE }, insideVertical: { style: BorderStyle.NONE }
            },
            rows: [
                new TableRow({
                    children: [
                        new TableCell({
                            children: [
                                new Paragraph({ children: [new TextRun({ text: "أمين المعهد", bold: true, rightToLeft: true, font: "Arial", size: 20 })], alignment: AlignmentType.CENTER, bidirectional: true }),
                                new Paragraph({ children: [new TextRun({ text: "...................................", rightToLeft: true, font: "Arial", size: 20 })], alignment: AlignmentType.CENTER, bidirectional: true }),
                                new Paragraph({ children: [new TextRun({ text: secretaryName, bold: true, rightToLeft: true, font: "Arial", size: 20 })], alignment: AlignmentType.CENTER, bidirectional: true }),
                            ],
                            width: { size: 33, type: WidthType.PERCENTAGE },
                        }),
                        new TableCell({
                            children: [
                                new Paragraph({ children: [new TextRun({ text: "شئون هيئة التدريس", bold: true, rightToLeft: true, font: "Arial", size: 20 })], alignment: AlignmentType.CENTER, bidirectional: true }),
                                new Paragraph({ children: [new TextRun({ text: "...................................", rightToLeft: true, font: "Arial", size: 20 })], alignment: AlignmentType.CENTER, bidirectional: true }),
                                new Paragraph({ children: [new TextRun({ text: clerkName, bold: true, rightToLeft: true, font: "Arial", size: 20 })], alignment: AlignmentType.CENTER, bidirectional: true }),
                            ],
                            width: { size: 34, type: WidthType.PERCENTAGE },
                        }),
                        new TableCell({
                            children: [
                                new Paragraph({ children: [new TextRun({ text: "التوقيع", bold: true, rightToLeft: true, font: "Arial", size: 20 })], alignment: AlignmentType.CENTER, bidirectional: true }),
                                new Paragraph({ children: [new TextRun({ text: "...................................", rightToLeft: true, font: "Arial", size: 20 })], alignment: AlignmentType.CENTER, bidirectional: true }),
                            ],
                            width: { size: 33, type: WidthType.PERCENTAGE },
                        }),
                    ],
                }),
            ],
        }),
        new Paragraph({ text: "", spacing: { after: 600 } }),
        new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            layout: TableLayoutType.FIXED,
            borders: {
                top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE },
                left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE },
                insideHorizontal: { style: BorderStyle.NONE }, insideVertical: { style: BorderStyle.NONE }
            },
            rows: [
                new TableRow({
                    children: [
                        new TableCell({
                            children: [
                                new Paragraph({ children: [new TextRun({ text: "عميد المعهد", bold: true, rightToLeft: true, font: "Arial", size: 22 })], alignment: AlignmentType.CENTER, bidirectional: true }),
                                new Paragraph({ text: "", spacing: { after: 400 } }),
                                new Paragraph({ children: [new TextRun({ text: deanName, bold: true, rightToLeft: true, font: "Arial", size: 22 })], alignment: AlignmentType.CENTER, bidirectional: true }),
                            ],
                            width: { size: 33, type: WidthType.PERCENTAGE },
                        }),
                        new TableCell({
                            children: [],
                            width: { size: 67, type: WidthType.PERCENTAGE },
                        }),
                    ],
                }),
            ],
        }),
    ];

    if (addPageBreak) {
        children.push(new Paragraph({ children: [new PageBreak()] }));
    }

    return children;
};

const fetchImageAsArrayBuffer = async (url: string): Promise<ArrayBuffer | null> => {
    try {
        const response = await fetch(url);
        if (!response.ok) return null;
        const blob = await response.blob();
        return await blob.arrayBuffer();
    } catch (e) {
        console.error("Failed to fetch image", e);
        return null;
    }
};

export const exportToDocx = async (record: StaffRecord, deanName: string, clerkName: string, secretaryName: string) => {
    const ministryLogoBuffer = await fetchImageAsArrayBuffer("https://api.allorigins.win/raw?url=https%3A%2F%2Fyt3.googleusercontent.com%2Fp-gOwvpL7qWfqZ0XAC-zsuWXg4ATxIxGCYtGtbsSSh2HGogCeFX17SaueyejOtnJywe32_93FQ%3Ds160-c-k-c0x00ffffff-no-rj");
    const kfsLogoBuffer = await fetchImageAsArrayBuffer("https://api.allorigins.win/raw?url=https%3A%2F%2Fencrypted-tbn0.gstatic.com%2Fimages%3Fq%3Dtbn%3AANd9GcTkwEB_T_tTBcOVvP7OZtXjcLH0txqZK902Qg%26s");

    const doc = new Document({
        creator: "Report Generator",
        title: `تقرير ${record.name}`,
        sections: [{
            properties: {},
            children: generateReportChildren(record, deanName, clerkName, secretaryName, false, ministryLogoBuffer, kfsLogoBuffer),
        }],
    });

    const blob = await Packer.toBlob(doc);
    saveAs(blob, `تقرير_${record.name.replace(/\s/g, '_')}.docx`);
};

export const exportAllToDocx = async (records: StaffRecord[], deanName: string, clerkName: string, secretaryName: string) => {
    const ministryLogoBuffer = await fetchImageAsArrayBuffer("https://api.allorigins.win/raw?url=https%3A%2F%2Fyt3.googleusercontent.com%2Fp-gOwvpL7qWfqZ0XAC-zsuWXg4ATxIxGCYtGtbsSSh2HGogCeFX17SaueyejOtnJywe32_93FQ%3Ds160-c-k-c0x00ffffff-no-rj");
    const kfsLogoBuffer = await fetchImageAsArrayBuffer("https://api.allorigins.win/raw?url=https%3A%2F%2Fencrypted-tbn0.gstatic.com%2Fimages%3Fq%3Dtbn%3AANd9GcTkwEB_T_tTBcOVvP7OZtXjcLH0txqZK902Qg%26s");

    const allChildren: any[] = [];
    
    records.forEach((record, index) => {
        const isLast = index === records.length - 1;
        const recordChildren = generateReportChildren(record, deanName, clerkName, secretaryName, !isLast, ministryLogoBuffer, kfsLogoBuffer);
        allChildren.push(...recordChildren);
    });

    const doc = new Document({
        creator: "Report Generator",
        title: `جميع التقارير`,
        sections: [{
            properties: {},
            children: allChildren,
        }],
    });

    const blob = await Packer.toBlob(doc);
    saveAs(blob, `جميع_التقارير.docx`);
};
