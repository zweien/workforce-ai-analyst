import * as XLSX from 'xlsx';
import { AttendanceRecord } from '../types';

export const parseExcelFiles = async (files: FileList): Promise<AttendanceRecord[]> => {
  const allRecords: AttendanceRecord[] = [];

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    
    const dateMatch = file.name.match(/(\d{8}-\d{8})|\d{6}/);
    const batchTag = dateMatch ? dateMatch[0] : `Batch ${i + 1}`;
    
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });
      
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];

      const rawData = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1 });

      const headerRowIndex = 2;
      
      if (rawData.length <= headerRowIndex) {
        console.warn(`File ${file.name} has insufficient rows.`);
        continue;
      }

      const headers = rawData[headerRowIndex].map((h: any) => String(h).trim());
      const rows = rawData.slice(headerRowIndex + 1);

      // Identify Column Indices
      let nameIdx = headers.findIndex((h) => /姓名|Name/i.test(h));
      const deptIdx = headers.findIndex((h) => /部门|Department|Dept|科室|Team/i.test(h));
      
      // Position column: Target "职位" or Column E (Index 4)
      let posIdx = headers.findIndex((h) => /职位|Position|岗位|Job|Post/i.test(h));
      if (posIdx === -1 && headers.length > 4) {
        posIdx = 4; // Column E
      }

      let durationIdx = headers.findIndex((h) => /工作时长|工时|Duration|Hours/i.test(h));

      if (durationIdx === -1 && headers.length > 8) {
        durationIdx = 8;
      }

      if (nameIdx === -1) {
         nameIdx = 1; 
         if (!headers[1]) nameIdx = 0;
      }

      if (durationIdx === -1) {
        console.error(`Missing duration column in ${file.name}. Headers: ${headers.join(', ')}`);
        continue;
      }

      rows.forEach((row, idx) => {
        if (!row[nameIdx]) return;

        const rawDuration = row[durationIdx];
        let duration = 0;

        if (typeof rawDuration === 'number') {
          duration = rawDuration;
        } else if (typeof rawDuration === 'string') {
          const cleanStr = rawDuration.trim();
          if (cleanStr.includes(':')) {
             const parts = cleanStr.split(':');
             const h = parseFloat(parts[0]) || 0;
             const m = parseFloat(parts[1]) || 0;
             duration = h + (m / 60);
          } else {
             duration = parseFloat(cleanStr);
          }
        }

        if (isNaN(duration)) duration = 0;

        allRecords.push({
          id: `${file.name}-${idx}`,
          name: row[nameIdx],
          department: deptIdx !== -1 ? (row[deptIdx] || 'Unassigned') : 'General',
          position: posIdx !== -1 ? (row[posIdx] || 'Staff') : 'Staff',
          workDuration: duration,
          date: batchTag 
        });
      });
    } catch (err) {
      console.error(`Error parsing file ${file.name}:`, err);
    }
  }

  return allRecords;
};

export const exportSummaryToExcel = (
  data: {
    name: string;
    department: string;
    position: string;
    totalDuration: number;
    recordsCount: number;
  }[],
  fileName: string = '考勤分析汇总.xlsx'
) => {
  const exportData = data.map(item => ({
    "姓名": item.name,
    "部门": item.department,
    "职位": item.position,
    "记录批次数": item.recordsCount,
    "总工时 (小时)": parseFloat(item.totalDuration.toFixed(2)),
    "月均工时 (小时)": parseFloat((item.totalDuration / item.recordsCount).toFixed(2))
  }));

  const worksheet = XLSX.utils.json_to_sheet(exportData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "考勤汇总");
  
  const wscols = [
    { wch: 15 }, // Name
    { wch: 20 }, // Dept
    { wch: 20 }, // Position
    { wch: 15 }, // Count
    { wch: 15 }, // Total
    { wch: 15 }, // Avg
  ];
  worksheet['!cols'] = wscols;

  XLSX.writeFile(workbook, fileName);
};