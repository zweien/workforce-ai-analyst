export interface AttendanceRecord {
  id: string;
  name: string;
  department: string;
  position: string; // Added position field
  workDuration: number; // In hours
  date?: string;
  employeeId?: string;
}

export interface DepartmentStats {
  name: string;
  avgDuration: number;
  totalEmployees: number;
  totalHours: number;
}

export interface AnalysisSummary {
  totalRecords: number;
  uniqueEmployees: number;
  averageDuration: number;
  departmentCount: number;
}

export enum AnalysisStatus {
  IDLE = 'IDLE',
  ANALYZING = 'ANALYZING',
  COMPLETED = 'COMPLETED',
  ERROR = 'ERROR'
}