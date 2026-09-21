import React, { useState } from 'react';
import { Upload, FileSpreadsheet, Loader2 } from 'lucide-react';
import { parseExcelFiles } from '../services/excelService';
import { AttendanceRecord } from '../types';

interface FileUploadProps {
  onDataLoaded: (data: AttendanceRecord[]) => void;
}

export const FileUpload: React.FC<FileUploadProps> = ({ onDataLoaded }) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setIsProcessing(true);
      setError(null);
      try {
        const records = await parseExcelFiles(e.target.files);
        if (records.length === 0) {
          setError("未找到有效记录。请确认表头在第3行，且包含 '姓名'、'部门'、'工作时长' 列。");
        } else {
          onDataLoaded(records);
        }
      } catch (err) {
        console.error(err);
        setError("文件解析失败，请确保是有效的 Excel (.xlsx) 文件。");
      } finally {
        setIsProcessing(false);
      }
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto mb-8">
      <div className="relative border-2 border-dashed border-slate-300 rounded-xl p-12 text-center hover:border-blue-500 hover:bg-blue-50 transition-all group bg-white">
        <input
          type="file"
          multiple
          accept=".xlsx, .xls"
          onChange={handleFileChange}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          disabled={isProcessing}
        />
        <div className="flex flex-col items-center justify-center space-y-4">
          <div className="p-4 bg-blue-100 rounded-full group-hover:bg-blue-200 transition-colors text-blue-600">
            {isProcessing ? (
              <Loader2 className="w-8 h-8 animate-spin" />
            ) : (
              <FileSpreadsheet className="w-8 h-8" />
            )}
          </div>
          <div className="space-y-1">
            <h3 className="text-lg font-semibold text-slate-800">
              {isProcessing ? '正在处理数据...' : '上传考勤 Excel'}
            </h3>
            <p className="text-sm text-slate-500">
              拖拽或点击选择文件 <br/>
              <span className="text-xs text-slate-400">(支持批量上传多月数据，表头需在第3行)</span>
            </p>
          </div>
        </div>
      </div>
      {error && (
        <div className="mt-4 p-3 bg-red-50 text-red-600 text-sm rounded-lg border border-red-100 flex items-center">
           ⚠️ {error}
        </div>
      )}
    </div>
  );
};