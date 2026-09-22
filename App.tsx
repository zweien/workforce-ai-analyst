import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  LayoutDashboard,
  Filter,
  Sparkles,
  BarChart3,
  LogOut,
  AlertCircle,
  ChevronDown,
  Check,
  CalendarDays,
  Download,
  FileDown,
  Settings as SettingsIcon,
  Users as UsersIcon,
  Briefcase
} from 'lucide-react';
import { FileUpload } from './components/FileUpload';
import { SettingsModal } from './components/SettingsModal';
import { DepartmentBarChart, DistributionChart, MonthlyTrendChart } from './components/Charts';
import { StatsCards } from './components/StatsCards';
import { AttendanceRecord, AnalysisStatus } from './types';
import { generateAttendanceReport, LlmConfigError } from './services/llmService';
import { buildSummaryWorkbook } from './services/excelService';
import { saveBinaryFile, saveTextFile } from './services/fileIO';
import { hasApiKey } from './services/settings';

const App: React.FC = () => {
  const [data, setData] = useState<AttendanceRecord[]>([]);
  const [selectedDepts, setSelectedDepts] = useState<Set<string>>(new Set());
  const [selectedPositions, setSelectedPositions] = useState<Set<string>>(new Set());
  const [selectedBatches, setSelectedBatches] = useState<Set<string>>(new Set());
  
  const [isBatchMenuOpen, setIsBatchMenuOpen] = useState(false);
  const [isDeptMenuOpen, setIsDeptMenuOpen] = useState(false);
  const [isPosMenuOpen, setIsPosMenuOpen] = useState(false);
  
  const [analysisStatus, setAnalysisStatus] = useState<AnalysisStatus>(AnalysisStatus.IDLE);
  const [aiReport, setAiReport] = useState<string>('');
  const [aiError, setAiError] = useState<string | null>(null);
  const [keyMissing, setKeyMissing] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  
  const batchMenuRef = useRef<HTMLDivElement>(null);
  const deptMenuRef = useRef<HTMLDivElement>(null);
  const posMenuRef = useRef<HTMLDivElement>(null);

  // Close menus when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (batchMenuRef.current && !batchMenuRef.current.contains(event.target as Node)) {
        setIsBatchMenuOpen(false);
      }
      if (deptMenuRef.current && !deptMenuRef.current.contains(event.target as Node)) {
        setIsDeptMenuOpen(false);
      }
      if (posMenuRef.current && !posMenuRef.current.contains(event.target as Node)) {
        setIsPosMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Extract unique departments, positions and batches
  const { allDepartments, allPositions, allBatches } = useMemo(() => {
    const depts = new Set<string>();
    const positions = new Set<string>();
    const batches = new Set<string>();
    
    data.forEach(d => {
      if (d.department && d.department !== 'undefined') depts.add(d.department);
      if (d.position && d.position !== 'undefined') positions.add(d.position);
      if (d.date) batches.add(d.date);
    });

    return {
      allDepartments: Array.from(depts).sort(),
      allPositions: Array.from(positions).sort(),
      allBatches: Array.from(batches).sort()
    };
  }, [data]);

  // Filtered Data (Raw records)
  const filteredRawData = useMemo(() => {
    return data.filter(d => {
      const deptMatch = selectedDepts.has(d.department);
      const posMatch = selectedPositions.has(d.position);
      const batchMatch = selectedBatches.has(d.date || '');
      return deptMatch && posMatch && batchMatch;
    }).sort((a, b) => b.workDuration - a.workDuration);
  }, [data, selectedDepts, selectedPositions, selectedBatches]);

  // Aggregated Data (Grouped by Person) for the Detail Table
  const aggregatedTableData = useMemo(() => {
    const map = new Map<string, {
      id: string;
      name: string;
      department: string;
      position: string;
      totalDuration: number;
      recordsCount: number;
      batches: string[];
    }>();

    filteredRawData.forEach(record => {
      const key = `${record.name}|${record.department}|${record.position}`;
      if (!map.has(key)) {
        map.set(key, {
          id: key,
          name: record.name,
          department: record.department,
          position: record.position,
          totalDuration: 0,
          recordsCount: 0,
          batches: []
        });
      }
      const entry = map.get(key)!;
      entry.totalDuration += record.workDuration;
      entry.recordsCount += 1;
      if (record.date) entry.batches.push(record.date);
    });

    return Array.from(map.values()).sort((a, b) => b.totalDuration - a.totalDuration);
  }, [filteredRawData]);

  const handleDataLoaded = (records: AttendanceRecord[]) => {
    setData(records);
    
    // Auto-select everything initially
    const batches = new Set(records.map(r => r.date).filter(Boolean) as string[]);
    const depts = new Set(records.map(r => r.department).filter(d => d && d !== 'undefined'));
    const positions = new Set(records.map(r => r.position).filter(p => p && p !== 'undefined'));
    
    setSelectedBatches(batches);
    setSelectedDepts(depts);
    setSelectedPositions(positions);
    setAnalysisStatus(AnalysisStatus.IDLE);
    setAiReport('');
    setAiError(null);
    hasApiKey().then(ok => setKeyMissing(!ok));
  };

  const toggleBatch = (batch: string) => {
    const newSet = new Set(selectedBatches);
    if (newSet.has(batch)) newSet.delete(batch);
    else newSet.add(batch);
    setSelectedBatches(newSet);
  };

  const toggleAllBatches = () => {
    if (selectedBatches.size === allBatches.length) setSelectedBatches(new Set());
    else setSelectedBatches(new Set(allBatches));
  };

  const toggleDept = (dept: string) => {
    const newSet = new Set(selectedDepts);
    if (newSet.has(dept)) newSet.delete(dept);
    else newSet.add(dept);
    setSelectedDepts(newSet);
  };

  const toggleAllDepts = () => {
    if (selectedDepts.size === allDepartments.length) setSelectedDepts(new Set());
    else setSelectedDepts(new Set(allDepartments));
  };

  const togglePos = (pos: string) => {
    const newSet = new Set(selectedPositions);
    if (newSet.has(pos)) newSet.delete(pos);
    else newSet.add(pos);
    setSelectedPositions(newSet);
  };

  const toggleAllPositions = () => {
    if (selectedPositions.size === allPositions.length) setSelectedPositions(new Set());
    else setSelectedPositions(new Set(allPositions));
  };

  const handleGenerateReport = async () => {
    if (filteredRawData.length === 0) return;

    setAnalysisStatus(AnalysisStatus.ANALYZING);
    setAiError(null);
    try {
      const deptContext = selectedDepts.size === allDepartments.length
        ? null
        : Array.from(selectedDepts).join(', ');

      const posContext = selectedPositions.size === allPositions.length
        ? null
        : Array.from(selectedPositions).join(', ');

      const report = await generateAttendanceReport(filteredRawData, deptContext, posContext);
      setAiReport(report);
      setAnalysisStatus(AnalysisStatus.COMPLETED);
    } catch (error) {
      console.error(error);
      setAiError(error instanceof Error ? error.message : String(error));
      if (error instanceof LlmConfigError) setKeyMissing(true);
      setAnalysisStatus(AnalysisStatus.ERROR);
    }
  };

  const handleExportExcel = async () => {
    const deptTag = selectedDepts.size === allDepartments.length ? '全部部门' : '部分部门';
    const fileName = `考勤汇总_${deptTag}_${new Date().toISOString().slice(0, 10)}.xlsx`;
    await saveBinaryFile(fileName, buildSummaryWorkbook(aggregatedTableData));
  };

  const handleDownloadReport = async () => {
    if (!aiReport) return;
    await saveTextFile(`AI分析报告_${new Date().toISOString().slice(0, 10)}.md`, aiReport);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-20 font-sans">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-slate-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="bg-gradient-to-br from-blue-600 to-indigo-600 p-2 rounded-lg shadow-blue-200">
              <BarChart3 className="text-white w-5 h-5" />
            </div>
            <h1 className="text-xl font-bold text-slate-800 tracking-tight">
              WorkForce <span className="text-blue-600">AI 考勤分析</span>
            </h1>
          </div>
          
          {data.length > 0 && (
            <div className="flex items-center space-x-2">
              {/* Batch Filter */}
              <div className="relative" ref={batchMenuRef}>
                <button 
                  onClick={() => { setIsBatchMenuOpen(!isBatchMenuOpen); setIsDeptMenuOpen(false); setIsPosMenuOpen(false); }}
                  className={`flex items-center space-x-2 bg-white border rounded-lg px-3 py-1.5 shadow-sm transition-colors text-xs font-medium ${isBatchMenuOpen ? 'border-blue-400 ring-2 ring-blue-50' : 'border-slate-200 hover:border-blue-300'}`}
                >
                  <CalendarDays className="w-4 h-4 text-slate-500" />
                  <span className="max-w-[80px] truncate">
                    {selectedBatches.size === allBatches.length ? '所有月份' : `已选 ${selectedBatches.size}月`}
                  </span>
                  <ChevronDown className="w-3 h-3 text-slate-400" />
                </button>
                {isBatchMenuOpen && (
                  <div className="absolute top-full mt-2 right-0 w-64 bg-white rounded-xl shadow-xl border border-slate-100 p-2 z-50 animate-in fade-in zoom-in-95 duration-200">
                    <div className="flex items-center justify-between px-2 py-2 border-b border-slate-50 mb-1">
                      <span className="text-xs font-semibold text-slate-500">选择批次</span>
                      <button onClick={toggleAllBatches} className="text-xs text-blue-600 hover:text-blue-700 font-medium">
                        {selectedBatches.size === allBatches.length ? '全不选' : '全选'}
                      </button>
                    </div>
                    <div className="max-h-60 overflow-y-auto space-y-1">
                      {allBatches.map(batch => (
                        <button key={batch} onClick={() => toggleBatch(batch)} className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs transition-colors ${selectedBatches.has(batch) ? 'bg-blue-50 text-blue-700' : 'hover:bg-slate-50 text-slate-600'}`}>
                          <span>{batch}</span>
                          {selectedBatches.has(batch) && <Check className="w-4 h-4" />}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Department Filter */}
              <div className="relative" ref={deptMenuRef}>
                <button 
                  onClick={() => { setIsDeptMenuOpen(!isDeptMenuOpen); setIsBatchMenuOpen(false); setIsPosMenuOpen(false); }}
                  className={`flex items-center space-x-2 bg-white border rounded-lg px-3 py-1.5 shadow-sm transition-colors text-xs font-medium ${isDeptMenuOpen ? 'border-blue-400 ring-2 ring-blue-50' : 'border-slate-200 hover:border-blue-300'}`}
                >
                  <UsersIcon className="w-4 h-4 text-slate-500" />
                  <span className="max-w-[80px] truncate">
                    {selectedDepts.size === allDepartments.length ? '全部部门' : `已选 ${selectedDepts.size}部门`}
                  </span>
                  <ChevronDown className="w-3 h-3 text-slate-400" />
                </button>
                {isDeptMenuOpen && (
                  <div className="absolute top-full mt-2 right-0 w-64 bg-white rounded-xl shadow-xl border border-slate-100 p-2 z-50 animate-in fade-in zoom-in-95 duration-200">
                    <div className="flex items-center justify-between px-2 py-2 border-b border-slate-50 mb-1">
                      <span className="text-xs font-semibold text-slate-500">选择部门</span>
                      <button onClick={toggleAllDepts} className="text-xs text-blue-600 hover:text-blue-700 font-medium">
                        {selectedDepts.size === allDepartments.length ? '全不选' : '全选'}
                      </button>
                    </div>
                    <div className="max-h-60 overflow-y-auto space-y-1">
                      {allDepartments.map(dept => (
                        <button key={dept} onClick={() => toggleDept(dept)} className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs transition-colors ${selectedDepts.has(dept) ? 'bg-blue-50 text-blue-700' : 'hover:bg-slate-50 text-slate-600'}`}>
                          <span className="truncate mr-2">{dept}</span>
                          {selectedDepts.has(dept) && <Check className="w-4 h-4 flex-shrink-0" />}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Position Filter */}
              <div className="relative" ref={posMenuRef}>
                <button 
                  onClick={() => { setIsPosMenuOpen(!isPosMenuOpen); setIsBatchMenuOpen(false); setIsDeptMenuOpen(false); }}
                  className={`flex items-center space-x-2 bg-white border rounded-lg px-3 py-1.5 shadow-sm transition-colors text-xs font-medium ${isPosMenuOpen ? 'border-blue-400 ring-2 ring-blue-50' : 'border-slate-200 hover:border-blue-300'}`}
                >
                  <Briefcase className="w-4 h-4 text-slate-500" />
                  <span className="max-w-[80px] truncate">
                    {selectedPositions.size === allPositions.length ? '所有职位' : `已选 ${selectedPositions.size}职位`}
                  </span>
                  <ChevronDown className="w-3 h-3 text-slate-400" />
                </button>
                {isPosMenuOpen && (
                  <div className="absolute top-full mt-2 right-0 w-64 bg-white rounded-xl shadow-xl border border-slate-100 p-2 z-50 animate-in fade-in zoom-in-95 duration-200">
                    <div className="flex items-center justify-between px-2 py-2 border-b border-slate-50 mb-1">
                      <span className="text-xs font-semibold text-slate-500">选择职位</span>
                      <button onClick={toggleAllPositions} className="text-xs text-blue-600 hover:text-blue-700 font-medium">
                        {selectedPositions.size === allPositions.length ? '全不选' : '全选'}
                      </button>
                    </div>
                    <div className="max-h-60 overflow-y-auto space-y-1">
                      {allPositions.map(pos => (
                        <button key={pos} onClick={() => togglePos(pos)} className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs transition-colors ${selectedPositions.has(pos) ? 'bg-blue-50 text-blue-700' : 'hover:bg-slate-50 text-slate-600'}`}>
                          <span className="truncate mr-2">{pos}</span>
                          {selectedPositions.has(pos) && <Check className="w-4 h-4 flex-shrink-0" />}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <button
                onClick={() => setSettingsOpen(true)}
                className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                title="AI 服务设置"
              >
                <SettingsIcon className="w-5 h-5" />
              </button>
              <button
                onClick={() => { setData([]); setSelectedBatches(new Set()); setSelectedDepts(new Set()); setSelectedPositions(new Set()); }}
                className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                title="清除所有数据"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          )}
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {data.length === 0 ? (
          <div className="flex flex-col items-center justify-center min-h-[70vh] animate-in fade-in duration-700">
            <div className="text-center mb-10 max-w-2xl">
              <h2 className="text-4xl font-extrabold text-slate-900 mb-6 tracking-tight">
                考勤智能分析系统
              </h2>
              <p className="text-lg text-slate-500 leading-relaxed">
                上传您的月度 Excel 考勤记录，立即生成可视化效率报告。
                <br />
                <span className="text-sm text-slate-400 mt-2 block">
                  支持批量上传多月文件 (表头需在第3行, E列为职位, I列为工作时长)。
                </span>
              </p>
            </div>
            <FileUpload onDataLoaded={handleDataLoaded} />
          </div>
        ) : (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Top Stats */}
            <section>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-slate-800 flex items-center">
                  <LayoutDashboard className="w-5 h-5 mr-2 text-blue-600" />
                  数据概览
                </h2>
                <div className="flex items-center space-x-2">
                   {selectedDepts.size < allDepartments.length && <span className="text-[10px] bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">已选{selectedDepts.size}部门</span>}
                   {selectedPositions.size < allPositions.length && <span className="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">已选{selectedPositions.size}职位</span>}
                   <span className="text-xs font-mono text-slate-400 bg-slate-100 px-2 py-1 rounded-full">筛选记录 N={filteredRawData.length}</span>
                </div>
              </div>
              <StatsCards data={filteredRawData} />
            </section>

            {/* Charts */}
            <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <DepartmentBarChart data={filteredRawData} />
              <DistributionChart data={filteredRawData} />
            </section>

            {allBatches.length > 1 && (
              <section className="grid grid-cols-1 gap-6">
                 <MonthlyTrendChart data={filteredRawData} />
              </section>
            )}

            {/* AI Analysis */}
            <section className="bg-gradient-to-br from-indigo-900 via-blue-900 to-slate-900 rounded-2xl p-8 text-white shadow-2xl overflow-hidden relative border border-white/10">
              <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none"></div>
              <div className="relative z-10">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
                  <div className="flex items-start space-x-4">
                    <div className="bg-white/10 p-3 rounded-xl backdrop-blur-md border border-white/20 shadow-inner">
                      <Sparkles className="w-8 h-8 text-amber-300" />
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold tracking-tight">AI 智能分析顾问</h2>
                      <p className="text-indigo-200 text-sm mt-1">
                        基于大数据模型，深度解读团队效能、疲劳风险与管理建议。
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex space-x-3">
                    {analysisStatus === AnalysisStatus.COMPLETED && (
                      <button onClick={handleDownloadReport} className="inline-flex items-center px-4 py-3 text-sm font-semibold text-white bg-white/10 border border-white/20 rounded-xl hover:bg-white/20">
                        <FileDown className="w-4 h-4 mr-2" />
                        下载报告
                      </button>
                    )}
                    <button
                      onClick={handleGenerateReport}
                      disabled={analysisStatus === AnalysisStatus.ANALYZING}
                      className="inline-flex items-center px-8 py-3 text-sm font-semibold text-indigo-900 bg-white rounded-xl hover:bg-indigo-50 disabled:opacity-70 disabled:cursor-not-allowed shadow-[0_0_20px_rgba(255,255,255,0.3)]"
                    >
                      {analysisStatus === AnalysisStatus.ANALYZING ? '分析中...' : '生成智能分析'}
                    </button>
                  </div>
                </div>

                {keyMissing && analysisStatus !== AnalysisStatus.ANALYZING && (
                  <div className="flex items-center justify-between p-4 mb-4 rounded-xl bg-amber-500/10 border border-amber-400/30 text-amber-100">
                    <span className="text-sm">首次使用请先配置 AI 服务(地址 / 模型 / API Key),本地统计不受影响。</span>
                    <button
                      onClick={() => setSettingsOpen(true)}
                      className="ml-4 px-4 py-1.5 rounded-lg bg-amber-400/20 border border-amber-300/40 text-xs font-medium hover:bg-amber-400/30 whitespace-nowrap"
                    >
                      打开设置
                    </button>
                  </div>
                )}
                {analysisStatus === AnalysisStatus.COMPLETED && (
                  <div className="prose prose-invert max-w-none bg-black/20 p-8 rounded-xl border border-white/10">
                    <pre className="whitespace-pre-wrap font-sans text-sm leading-7 text-indigo-50">{aiReport}</pre>
                  </div>
                )}
                {analysisStatus === AnalysisStatus.ERROR && (
                   <div className="flex items-center justify-between p-4 rounded-lg bg-red-900/30 border border-red-500/30 text-red-200">
                    <span className="text-sm flex items-center">
                      <AlertCircle className="w-5 h-5 mr-2 flex-shrink-0" />
                      {aiError || '报告生成失败,请重试。'}
                    </span>
                    <button
                      onClick={() => setSettingsOpen(true)}
                      className="ml-4 px-4 py-1.5 rounded-lg bg-red-500/20 border border-red-400/40 text-xs font-medium hover:bg-red-500/30 whitespace-nowrap"
                    >
                      检查设置
                    </button>
                   </div>
                )}
              </div>
            </section>

            {/* Table */}
            <section className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
               <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                 <div className="flex items-center space-x-2">
                   <h3 className="font-semibold text-slate-700">工时明细汇总</h3>
                   <span className="text-xs bg-blue-50 text-blue-600 px-2 py-1 rounded border border-blue-100">
                     按{selectedBatches.size}个选中月份汇总
                   </span>
                 </div>
                 <div className="flex items-center space-x-3">
                    <button 
                      onClick={handleExportExcel}
                      className="flex items-center space-x-1 text-sm text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-100 hover:bg-emerald-100"
                    >
                      <Download className="w-4 h-4" />
                      <span>导出 Excel</span>
                    </button>
                 </div>
               </div>
               <div className="overflow-x-auto">
                 <table className="w-full text-sm text-left">
                   <thead className="bg-slate-50 text-slate-500 font-medium">
                     <tr>
                       <th className="px-6 py-3">姓名</th>
                       <th className="px-6 py-3">部门</th>
                       <th className="px-6 py-3">职位</th>
                       <th className="px-6 py-3 text-center">记录数</th>
                       <th className="px-6 py-3 text-right bg-blue-50/50">总工时</th>
                       <th className="px-6 py-3 text-right">月均工时</th>
                     </tr>
                   </thead>
                   <tbody className="divide-y divide-slate-100">
                     {aggregatedTableData.slice(0, 100).map((person) => {
                       const avgDuration = person.totalDuration / person.recordsCount;
                       return (
                       <tr key={person.id} className="hover:bg-slate-50 transition-colors">
                         <td className="px-6 py-3 font-medium text-slate-700">{person.name}</td>
                         <td className="px-6 py-3 text-slate-500">
                           <span className="inline-block bg-slate-100 px-2 py-0.5 rounded text-xs">{person.department}</span>
                         </td>
                         <td className="px-6 py-3 text-slate-500">
                           <span className="text-xs italic">{person.position}</span>
                         </td>
                         <td className="px-6 py-3 text-center">{person.recordsCount}</td>
                         <td className="px-6 py-3 text-right font-mono text-blue-700 font-bold bg-blue-50/30">
                           {person.totalDuration.toFixed(2)}
                         </td>
                         <td className="px-6 py-3 text-right font-mono text-slate-600 font-medium">
                            {avgDuration.toFixed(2)}
                         </td>
                       </tr>
                     )})}
                   </tbody>
                 </table>
               </div>
            </section>
          </div>
        )}
      </main>
      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  );
};

export default App;