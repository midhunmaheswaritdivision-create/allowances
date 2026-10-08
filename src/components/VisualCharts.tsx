/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { FileData, Category } from '../types';

interface VisualChartsProps {
  files: FileData[];
}

export default function VisualCharts({ files }: VisualChartsProps) {
  // 1. Compute Category Amounts
  const categories: Category[] = ['KSRTC', 'Chalo', 'Chalo Swift', 'KURTC'];
  
  const categoryData = categories.map((cat) => {
    const catFiles = files.filter((f) => f.category === cat);
    const audited = catFiles.reduce((sum, f) => sum + f.auditedAmount, 0);
    const consolidated = catFiles.reduce((sum, f) => sum + (f.consolidatedAmount ?? 0), 0);
    const employees = catFiles.reduce((sum, f) => sum + f.employeeCount, 0);

    return {
      name: cat,
      'Audited Amount': Math.round(audited),
      'Consolidated Amount': Math.round(consolidated),
      employees
    };
  });

  // 2. Compute Depot Amounts (Top 5 Depots)
  const depotMap: Record<string, { audited: number; employees: number }> = {};
  files.forEach((file) => {
    const depot = file.depotName || 'UNKNOWN';
    if (!depotMap[depot]) {
      depotMap[depot] = { audited: 0, employees: 0 };
    }
    depotMap[depot].audited += file.auditedAmount;
    depotMap[depot].employees += file.employeeCount;
  });

  const topDepots = Object.entries(depotMap)
    .map(([name, stats]) => ({
      name,
      'Audited Amount': Math.round(stats.audited),
      Employees: stats.employees
    }))
    .sort((a, b) => b['Audited Amount'] - a['Audited Amount'])
    .slice(0, 5);

  // Colors for Pie Chart
  const COLORS = ['#6366f1', '#10b981', '#06b6d4', '#f59e0b'];

  const pieData = categoryData.map((d, index) => ({
    name: d.name,
    value: d.employees,
    color: COLORS[index]
  })).filter(d => d.value > 0);

  // Formatting for currency Tooltip
  const formatYAxis = (tick: number) => {
    if (tick >= 100000) return `₹${(tick / 100000).toFixed(1)}L`;
    if (tick >= 1000) return `₹${(tick / 1000).toFixed(0)}K`;
    return `₹${tick}`;
  };

  const formatTooltipValue = (value: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(value);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 w-full max-w-7xl mx-auto mb-8">
      {/* 1. Category Audit Balance Chart */}
      <div className="bg-white/20 backdrop-blur-md border border-white/50 rounded-2xl p-5 shadow-lg lg:col-span-2 flex flex-col h-[380px] hover:shadow-xl transition-all duration-300">
        <div className="mb-4">
          <h3 className="text-base font-extrabold text-slate-950 font-display">Audited vs Consolidated Amounts</h3>
          <p className="text-slate-800 text-xs mt-0.5 font-medium">Comparison across payment and ticket categories</p>
        </div>
        <div className="flex-1 min-h-0 w-full text-xs">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={categoryData} margin={{ top: 10, right: 10, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="name" stroke="#64748b" />
              <YAxis stroke="#64748b" tickFormatter={formatYAxis} />
              <Tooltip
                contentStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.9)', backdropFilter: 'blur(8px)', borderColor: 'rgba(255, 255, 255, 0.5)', borderRadius: '12px', boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.04)' }}
                itemStyle={{ color: '#1e293b', fontWeight: 'bold' }}
                labelStyle={{ fontWeight: 'bold', color: '#64748b' }}
                formatter={(value: any) => [formatTooltipValue(value), '']}
              />
              <Legend wrapperStyle={{ paddingTop: '10px' }} />
              <Bar dataKey="Audited Amount" fill="#6366f1" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Consolidated Amount" fill="#10b981" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 2. Employee Distribution (Pie) & Top Depots */}
      <div className="bg-white/20 backdrop-blur-md border border-white/50 rounded-2xl p-5 shadow-lg flex flex-col h-[380px] hover:shadow-xl transition-all duration-300">
        <div className="mb-2">
          <h3 className="text-base font-extrabold text-slate-950 font-display">Employee Breakdown</h3>
          <p className="text-slate-800 text-xs mt-0.5 font-medium">Employee counts distributed by service category</p>
        </div>
        
        {pieData.length === 0 ? (
          <div className="flex-1 flex items-center justify-center text-slate-700 text-xs font-semibold">
            No data available
          </div>
        ) : (
          <div className="flex-1 flex flex-col justify-center">
            <div className="h-[180px] w-full text-xs">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={75}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.9)', backdropFilter: 'blur(8px)', borderColor: 'rgba(255, 255, 255, 0.5)', borderRadius: '12px', boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.04)' }}
                    itemStyle={{ color: '#1e293b', fontWeight: 'bold' }}
                    formatter={(value: any) => [`${value} Employees`, 'Count']}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            
            <div className="grid grid-cols-2 gap-3 mt-4">
              {pieData.map((d, index) => (
                <div key={d.name} className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: d.color }}></div>
                  <div className="min-w-0">
                    <p className="text-[11px] font-extrabold text-slate-700 truncate font-display">{d.name}</p>
                    <p className="text-[10px] text-slate-700 font-medium">{d.value} employees</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 3. Top 5 Depots Volume Chart (Row 2, full width) */}
      <div className="bg-white/20 backdrop-blur-md border border-white/50 rounded-2xl p-5 shadow-lg lg:col-span-3 flex flex-col h-[280px] hover:shadow-xl transition-all duration-300">
        <div className="mb-4">
          <h3 className="text-base font-extrabold text-slate-950 font-display">Top 5 Depots by Volume</h3>
          <p className="text-slate-800 text-xs mt-0.5 font-medium">Highest financial audits across mapped depot codes</p>
        </div>
        <div className="flex-1 min-h-0 w-full text-xs">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={topDepots} layout="vertical" margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
              <XAxis type="number" stroke="#64748b" tickFormatter={formatYAxis} />
              <YAxis dataKey="name" type="category" stroke="#64748b" width={60} />
              <Tooltip
                contentStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.9)', backdropFilter: 'blur(8px)', borderColor: 'rgba(255, 255, 255, 0.5)', borderRadius: '12px', boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.04)' }}
                itemStyle={{ color: '#1e293b', fontWeight: 'bold' }}
                labelStyle={{ fontWeight: 'bold', color: '#64748b' }}
                formatter={(value: any) => [formatTooltipValue(value), 'Audited Amount']}
              />
              <Bar dataKey="Audited Amount" fill="#06b6d4" barSize={18} radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
