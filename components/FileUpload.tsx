import React, { useEffect, useState } from 'react';
import { Upload, FileSpreadsheet, Loader2, History, Trash2 } from 'lucide-react';
import { parseExcelBuffers, parseExcelFiles } from '../services/excelService';
import { AttendanceRecord } from '../types';
import {
  openExcelFiles, readRecentFile, getRecentFiles,
  addRecentFiles, clearRecentFiles, RecentFile, isTauri,
} from '../services/fileIO';

interface FileUploadProps {
  onDataLoaded: (data: AttendanceRecord[]) => void;
}

const listToArray = (list: FileList): File[] => {
  const arr: File[] = [];
  for (let i = 0; i < list.length; i++) arr.push(list[i]);
  return arr;
};

export const FileUpload: React.FC<FileUploadProps> = ({ onDataLoaded }) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recent, setRecent] = useState<RecentFile[]>([]);

  useEffect(() => {
    setRecent(getRecentFiles());
  }, []);

  const handleFiles = async (files: { name: string; data: ArrayBuffer }[], paths?: string[]) => {
    setIsProcessing(true);
    setError(null);
    try {
      const records = await parseExcelBuffers(files);
      if (records.length === 0) {
        setError("未找到有效记录。请确认表头在第3行，且包含 '姓名'、'部门'、'工作时长' 列。");
      } else {
        if (paths) addRecentFiles(paths);
        setRecent(getRecentFiles());
        onDataLoaded(records);
      }
    } catch (err) {
      console.error(err);
      setError("文件解析失败，请确保是有效的 Excel (.xlsx) 文件。");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const files = await Promise.all(listToArray(e.target.files).map(async f => ({ name: f.name, data: await f.arrayBuffer() })));
      await handleFiles(files);
    }
  };

  const handleNativeOpen = async () => {
    const picked = await openExcelFiles();
    if (!picked) return;
    const paths = picked.map(p => p.path);
    await handleFiles(picked, paths);
  };

  const handleRecentClick = async (file: RecentFile) => {
    setIsProcessing(true);
    setError(null);
    try {
      const picked = await readRecentFile(file.path);
      const records = await parseExcelBuffers([picked]);
      if (records.length === 0) {
        setError('该文件已不含有效记录。');
      } else {
        onDataLoaded(records);
      }
    } catch (err) {
      console.error(err);
      setError('无法读取该文件(应用重启后需重新选择一次以恢复访问权限)。');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const files = await Promise.all(listToArray(e.dataTransfer.files).map(async f => ({ name: f.name, data: await f.arrayBuffer() })));
      await handleFiles(files);
    }
  };

  const inputCls = "absolute inset-0 w-full h-full opacity-0 cursor-pointer";

  return (
    <div className="w-full max-w-2xl mx-auto mb-8">
      <div
        className="relative border-2 border-dashed border-slate-300 rounded-xl p-12 text-center hover:border-blue-500 hover:bg-blue-50 transition-all group bg-white"
        onDragOver={e => e.preventDefault()}
        onDrop={handleDrop}
      >
        <input
          type="file"
          multiple
          accept=".xlsx, .xls"
          onChange={handleFileChange}
          className={inputCls}
          disabled={isProcessing}
        />
        <div className="flex flex-col items-center justify-center space-y-4 pointer-events-none">
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

      {isTauri() && recent.length > 0 && (
        <div className="mt-4 bg-white border border-slate-200 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-500 flex items-center">
              <History className="w-3.5 h-3.5 mr-1.5" /> 最近打开
            </span>
            <button
              onClick={() => { clearRecentFiles(); setRecent([]); }}
              className="text-xs text-slate-400 hover:text-red-500 flex items-center"
              title="清空最近记录"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {recent.map(f => (
              <button
                key={f.path}
                onClick={() => handleRecentClick(f)}
                disabled={isProcessing}
                className="max-w-[240px] truncate px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-600 hover:border-blue-400 hover:text-blue-600 transition disabled:opacity-50"
                title={f.path}
              >
                {f.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {error && (
        <div className="mt-4 p-3 bg-red-50 text-red-600 text-sm rounded-lg border border-red-100 flex items-center">
           ⚠️ {error}
        </div>
      )}
    </div>
  );
};
