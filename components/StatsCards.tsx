import React from 'react';
import { Users, Clock, AlertTriangle, TrendingUp } from 'lucide-react';
import { AttendanceRecord } from '../types';

export const StatsCards: React.FC<{ data: AttendanceRecord[] }> = ({ data }) => {
  const totalEmployees = data.length;
  const avgDuration = totalEmployees > 0 
    ? (data.reduce((acc, curr) => acc + curr.workDuration, 0) / totalEmployees).toFixed(1) 
    : 0;
  
  const overtimeCount = data.filter(d => d.workDuration > 9).length;
  const undertimeCount = data.filter(d => d.workDuration < 7).length;

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
      <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm flex items-center space-x-4">
        <div className="p-3 bg-blue-50 text-blue-600 rounded-lg">
          <Users size={24} />
        </div>
        <div>
          <p className="text-sm text-slate-500">总人次</p>
          <p className="text-2xl font-bold text-slate-800">{totalEmployees}</p>
        </div>
      </div>

      <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm flex items-center space-x-4">
        <div className="p-3 bg-emerald-50 text-emerald-600 rounded-lg">
          <Clock size={24} />
        </div>
        <div>
          <p className="text-sm text-slate-500">平均工时</p>
          <p className="text-2xl font-bold text-slate-800">{avgDuration}<span className="text-sm font-normal text-slate-400 ml-1">小时</span></p>
        </div>
      </div>

      <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm flex items-center space-x-4">
        <div className="p-3 bg-indigo-50 text-indigo-600 rounded-lg">
          <TrendingUp size={24} />
        </div>
        <div>
          <p className="text-sm text-slate-500">高负荷 ({'>'}9h)</p>
          <p className="text-2xl font-bold text-slate-800">{overtimeCount}</p>
        </div>
      </div>

      <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm flex items-center space-x-4">
        <div className="p-3 bg-amber-50 text-amber-600 rounded-lg">
          <AlertTriangle size={24} />
        </div>
        <div>
          <p className="text-sm text-slate-500">工时不足 ({'<'}7h)</p>
          <p className="text-2xl font-bold text-slate-800">{undertimeCount}</p>
        </div>
      </div>
    </div>
  );
};