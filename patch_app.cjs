const fs = require('fs');

let appContent = fs.readFileSync('src/App.tsx', 'utf8');

appContent = appContent.replace(
  "import TextReportGenerator from './components/TextReportGenerator';",
  "import TextReportGenerator from './components/TextReportGenerator';\nimport EmployeeSearch from './components/EmployeeSearch';"
);

appContent = appContent.replace(
  "useState<'welcome' | 'extractor' | 'generator' | 'pdf_creator' | 'dashboard' | 'ledger' | 'consolidation'>('welcome');",
  "useState<'welcome' | 'extractor' | 'generator' | 'pdf_creator' | 'employee_search' | 'dashboard' | 'ledger' | 'consolidation'>('welcome');"
);

appContent = appContent.replace(
  "import {\n  FileSpreadsheet,\n  Download,\n  RotateCcw,\n  AlertCircle,\n  Calendar,\n  LayoutDashboard,\n  FileText,\n  Table,\n  Clock,\n  Sparkles,\n  Layers,\n  HelpCircle,\n  ChevronRight,\n  LogOut,\n  FolderSync,\n  FileDown\n} from 'lucide-react';",
  "import {\n  FileSpreadsheet,\n  Download,\n  RotateCcw,\n  AlertCircle,\n  Calendar,\n  LayoutDashboard,\n  FileText,\n  Table,\n  Clock,\n  Sparkles,\n  Layers,\n  HelpCircle,\n  ChevronRight,\n  LogOut,\n  FolderSync,\n  FileDown,\n  UserSearch\n} from 'lucide-react';"
);

const sidebarButton = `
            {/* Employee Allowance Search Button */}
            <button
              id="sidebar-employee-search-btn"
              onClick={() => {
                setActiveTab('employee_search');
                setIsFilteringMismatch(false);
              }}
              className={\`w-full flex items-center justify-between px-3.5 py-3 rounded-xl text-xs font-extrabold transition-all duration-200 border cursor-pointer group \${
                activeTab === 'employee_search'
                  ? 'bg-teal-600 text-white border-teal-600 shadow-md shadow-teal-600/10'
                  : 'bg-transparent text-slate-800 hover:text-slate-900 hover:bg-white/30 border-transparent'
              }\`}
            >
              <div className="flex items-center gap-2.5">
                <UserSearch className={\`w-4 h-4 transition-transform group-hover:rotate-12 \${
                  activeTab === 'employee_search' ? 'text-white' : 'text-slate-600'
                }\`} />
                <span className="font-display">Employee Search</span>
              </div>
              <span className={\`w-2 h-2 rounded-full transition-all duration-200 \${
                activeTab === 'employee_search' ? 'bg-white scale-110' : 'bg-teal-500 opacity-0 group-hover:opacity-100'
              }\`} />
            </button>
`;

appContent = appContent.replace(
  "{/* PDF Report Generator */}",
  `${sidebarButton}\n\n            {/* PDF Report Generator */}`
);

const viewRenderer = `
          {/* 2d. Employee Search View */}
          {activeTab === 'employee_search' && (
            <div className="py-6 animate-fadeIn h-full flex flex-col justify-center">
              <EmployeeSearch files={files} />
            </div>
          )}
`;

appContent = appContent.replace(
  "{/* 2c. PDF Creator View (Always available!) */}",
  `${viewRenderer}\n\n          {/* 2c. PDF Creator View (Always available!) */}`
);

fs.writeFileSync('src/App.tsx', appContent);
