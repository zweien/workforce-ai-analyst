
import React from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, 
  ReferenceLine, Cell, LineChart, Line
} from 'recharts';
import { AttendanceRecord } from '../types';

interface ChartProps {
  data: AttendanceRecord[];
}

const COLORS = ['#3b82f6', '#0ea5e9', '#06b6d4', '#6366f1', '#8b5cf6'];

export const DepartmentBarChart: React.FC<ChartProps> = ({ data }) => {
  // Aggregate data by department
  // Fixed error: Moved generic type argument from reduce call to 'as' assertion to avoid TSX parser confusion
  const aggregated = data.reduce((acc, curr) => {
    if (!acc[curr.department]) {
      acc[curr.department] = { name: curr.department, totalDuration: 0, count: 0 };
    }
    acc[curr.department].totalDuration += curr.workDuration;
    acc[curr.department].count += 1;
    return acc;
  }, {} as Record<string, { name: string; totalDuration: number; count: number }>);

  const chartData = Object.values(aggregated).map((d: { name: string; totalDuration: number; count: number }) => ({
    name: d.name,
    平均工时: parseFloat((d.totalDuration / d.count).toFixed(2)),
    人数: d.count
  })).sort((a, b) => b.平均工时 - a.平均工时);

  return (
    <div className="w-full h-[350px] bg-white p-4 rounded-xl shadow-sm border border-slate-100">
      <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-4">部门平均工时排行 (小时)</h3>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} layout="vertical" margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={true} stroke="#e2e8f0" />
          <XAxis type="number" domain={[0, 'auto']} />
          <YAxis dataKey="name" type="category" width={100} tick={{fontSize: 12}} />
          <Tooltip 
            contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
            cursor={{fill: '#f1f5f9'}}
          />
          <ReferenceLine x={8} stroke="#ef4444" strokeDasharray="3 3" label={{ value: "标准 8h", fill: '#ef4444', fontSize: 10 }} />
          <Bar dataKey="平均工时" name="平均工时" radius={[0, 4, 4, 0]} barSize={20}>
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.平均工时 > 9 ? '#f43f5e' : COLORS[index % COLORS.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export const DistributionChart: React.FC<ChartProps> = ({ data }) => {
  const buckets = [
    { name: '< 6h', count: 0, fill: '#ef4444' },
    { name: '6-8h', count: 0, fill: '#f59e0b' },
    { name: '8-9h', count: 0, fill: '#22c55e' },
    { name: '9-10h', count: 0, fill: '#3b82f6' },
    { name: '> 10h', count: 0, fill: '#6366f1' },
  ];

  data.forEach(r => {
    if (r.workDuration < 6) buckets[0].count++;
    else if (r.workDuration < 8) buckets[1].count++;
    else if (r.workDuration < 9) buckets[2].count++;
    else if (r.workDuration < 10) buckets[3].count++;
    else buckets[4].count++;
  });

  return (
    <div className="w-full h-[350px] bg-white p-4 rounded-xl shadow-sm border border-slate-100">
      <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-4">工时分布 (人数)</h3>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={buckets}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
          <XAxis dataKey="name" tick={{fontSize: 12}} />
          <YAxis />
          <Tooltip contentStyle={{ borderRadius: '8px', border: 'none' }} />
          <Bar dataKey="count" name="人数" radius={[4, 4, 0, 0]} barSize={40}>
            {buckets.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.fill} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export const MonthlyTrendChart: React.FC<ChartProps> = ({ data }) => {
  // Group by date/batch tag
  // Fixed error: Moved generic type argument from reduce call to 'as' assertion
  const aggregated = data.reduce((acc, curr) => {
    const key = curr.date || 'Unknown';
    if (!acc[key]) {
      acc[key] = { date: key, total: 0, count: 0 };
    }
    acc[key].total += curr.workDuration;
    acc[key].count += 1;
    return acc;
  }, {} as Record<string, { date: string; total: number; count: number }>);

  // Fixed error: Added explicit type annotation to map function parameter 'd' to resolve unknown property errors
  const chartData = Object.values(aggregated)
    .map((d: { date: string; total: number; count: number }) => ({
      name: d.date,
      平均工时: parseFloat((d.total / d.count).toFixed(2))
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  // If only 1 month, show a message or just a single point
  if (chartData.length <= 1) {
    return (
      <div className="w-full h-[350px] bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex items-center justify-center">
        <p className="text-slate-400 text-sm">上传多个月份数据以查看趋势分析</p>
      </div>
    );
  }

  return (
    <div className="w-full h-[350px] bg-white p-4 rounded-xl shadow-sm border border-slate-100">
      <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-4">月度/批次平均工时趋势</h3>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
          <XAxis dataKey="name" tick={{fontSize: 10}} />
          <YAxis domain={['auto', 'auto']} />
          <Tooltip contentStyle={{ borderRadius: '8px', border: 'none' }} />
          <Legend />
          <Line type="monotone" dataKey="平均工时" stroke="#8884d8" strokeWidth={3} dot={{r: 4}} activeDot={{r: 6}} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};
