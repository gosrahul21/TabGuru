const fs = require('fs');
const path = require('path');

const cssPath = path.join(__dirname, 'src', 'dashboard', 'dashboard.css');
let cssContent = fs.readFileSync(cssPath, 'utf8');

const rootCSS = `:root {
  --bg: linear-gradient(135deg, #e8e4f8 0%, #f0eeff 30%, #e4ecff 60%, #ede8ff 100%);
  --surface: rgba(255,255,255,0.45);
  --surface-hover: rgba(255,255,255,0.65);
  --border: rgba(255,255,255,0.65);
  --border-active: rgba(139,92,246,0.5);
  --text: #2d2452;
  --text-muted: #64748b;
  --text-dim: #94a3b8;
  --violet: #7c3aed;
  --violet-light: #8b5cf6;
  --indigo: #4f46e5;
  --emerald: #10b981;
  --amber: #f59e0b;
  --rose: #f43f5e;
  --cyan: #06b6d4;
  --font-outfit: 'Outfit', system-ui, sans-serif;
  --font-inter: 'Inter', system-ui, sans-serif;
}

[data-theme="dark"] {
  --bg: #07080f;
  --surface: rgba(255,255,255,0.04);
  --surface-hover: rgba(255,255,255,0.07);
  --border: rgba(255,255,255,0.08);
  --border-active: rgba(139,92,246,0.4);
  --text: #e2e8f0;
  --text-muted: #cbd5e1;
  --text-dim: #94a3b8;
  --violet: #7c3aed;
  --violet-light: #a78bfa;
  --indigo: #4f46e5;
  --emerald: #34d399;
  --amber: #fbbf24;
  --rose: #fb7185;
  --cyan: #22d3ee;
}`;

cssContent = cssContent.replace(/:root\s*\{[^}]+\}/, rootCSS);
// Also replace hardcoded backgrounds in css
cssContent = cssContent.replace(/background:\s*#0d111e;/g, 'background: var(--bg);');

fs.writeFileSync(cssPath, cssContent, 'utf8');

const tsxPath = path.join(__dirname, 'src', 'dashboard', 'Dashboard.tsx');
let tsxContent = fs.readFileSync(tsxPath, 'utf8');

const tsxReplacements = [
  { search: /color:\s*'#e2e8f0'/g, replace: "color: 'var(--text)'" },
  { search: /color:\s*'#475569'/g, replace: "color: 'var(--text-dim)'" },
  { search: /color:\s*'#64748b'/g, replace: "color: 'var(--text-muted)'" },
  { search: /color:\s*'#94a3b8'/g, replace: "color: 'var(--text-muted)'" },
  { search: /color:\s*'#a78bfa'/g, replace: "color: 'var(--violet-light)'" },
  { search: /color:\s*'#7c3aed'/g, replace: "color: 'var(--violet)'" },
  { search: /color:\s*'#4f46e5'/g, replace: "color: 'var(--indigo)'" },
  { search: /color:\s*'#10b981'/g, replace: "color: 'var(--emerald)'" },
  { search: /color:\s*'#34d399'/g, replace: "color: 'var(--emerald)'" },
  { search: /color:\s*'#f43f5e'/g, replace: "color: 'var(--rose)'" },
  { search: /color:\s*'#fb7185'/g, replace: "color: 'var(--rose)'" },
  { search: /color:\s*'#06b6d4'/g, replace: "color: 'var(--cyan)'" },
  { search: /color:\s*'#22d3ee'/g, replace: "color: 'var(--cyan)'" },
  { search: /color:\s*'#f59e0b'/g, replace: "color: 'var(--amber)'" },
  { search: /color:\s*'#fbbf24'/g, replace: "color: 'var(--amber)'" },
  { search: /background:\s*'rgba\(255,255,255,0\.04\)'/g, replace: "background: 'var(--surface)'" },
  { search: /background:\s*'rgba\(255,255,255,0\.05\)'/g, replace: "background: 'var(--surface)'" },
  { search: /border:\s*'1px solid rgba\(255,255,255,0\.08\)'/g, replace: "border: '1px solid var(--border)'" },
  { search: /border:\s*'1px solid rgba\(255,255,255,0\.1\)'/g, replace: "border: '1px solid var(--border)'" },
  { search: /background:\s*'rgba\(255,255,255,0\.06\)'/g, replace: "background: 'var(--border)'" },
  { search: /fill="#a78bfa"/g, replace: 'fill="var(--violet-light)"' },
  { search: /fill="#475569"/g, replace: 'fill="var(--text-dim)"' },
  { search: /stopColor="#7c3aed"/g, replace: 'stopColor="var(--violet)"' },
  { search: /stopColor="#4f46e5"/g, replace: 'stopColor="var(--indigo)"' },
  { search: /stopColor="#f43f5e"/g, replace: 'stopColor="var(--rose)"' },
  { search: /fill="#64748b"/g, replace: 'fill="var(--text-muted)"' },
  { search: /background:\s*'#0d111e'/g, replace: "background: 'var(--bg)'" },
];

tsxReplacements.forEach(({ search, replace }) => {
  tsxContent = tsxContent.replace(search, replace);
});

// Adding ThemeProvider to main.tsx
const mainPath = path.join(__dirname, 'src', 'dashboard', 'main.tsx');
let mainContent = fs.readFileSync(mainPath, 'utf8');
if (!mainContent.includes('ThemeProvider')) {
  mainContent = mainContent.replace("import Dashboard from './Dashboard';", "import Dashboard from './Dashboard';\nimport { ThemeProvider } from '../newtab/ThemeContext';");
  mainContent = mainContent.replace("<Dashboard />", "<ThemeProvider><Dashboard /></ThemeProvider>");
  fs.writeFileSync(mainPath, mainContent, 'utf8');
}

fs.writeFileSync(tsxPath, tsxContent, 'utf8');
console.log('Script completed.');
