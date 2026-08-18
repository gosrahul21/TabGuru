const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src', 'popup', 'Popup.tsx');
let content = fs.readFileSync(filePath, 'utf8');

const replacements = [
  { search: /color:\s*'#1e1b4b'/g, replace: "color: 'var(--text)'" },
  { search: /color:\s*'#7c3aed'/g, replace: "color: 'var(--violet)'" },
  { search: /borderBottom:\s*'1px solid rgba\(139,92,246,0\.1\)'/g, replace: "borderBottom: '1px solid var(--border-subtle)'" },
  { search: /background:\s*'linear-gradient\(135deg,rgba\(124,58,237,0\.15\),rgba\(79,70,229,0\.15\)\)'/g, replace: "background: 'var(--border-subtle)'" },
  { search: /border:\s*'1px solid rgba\(255,255,255,0\.7\)'/g, replace: "border: '1px solid var(--border)'" },
  { search: /boxShadow:\s*'0 2px 12px rgba\(124,58,237,0\.2\), inset 0 1px 0 rgba\(255,255,255,0\.9\)'/g, replace: "boxShadow: '0 2px 12px var(--border-subtle)'" },
  { search: /color:\s*'#2d2452'/g, replace: "color: 'var(--text)'" },
  { search: /color:\s*'#8b5cf6'/g, replace: "color: 'var(--violet-light)'" },
  { search: /background:\s*'rgba\(237,233,254,0\.7\)'/g, replace: "background: 'var(--surface)'" },
  { search: /border:\s*'1px solid rgba\(139,92,246,0\.25\)'/g, replace: "border: '1px solid var(--border)'" },
  { search: /color:\s*'#6d28d9'/g, replace: "color: 'var(--violet)'" },
  { search: /rgba\(237,233,254,0\.9\)/g, replace: "var(--surface-hover)" },
  { search: /rgba\(237,233,254,0\.7\)/g, replace: "var(--surface)" },
  { search: /border:\s*'2px solid rgba\(139,92,246,0\.15\)'/g, replace: "border: '2px solid var(--border-subtle)'" },
  { search: /borderTop:\s*'2px solid #7c3aed'/g, replace: "borderTop: '2px solid var(--violet)'" },
  { search: /borderBottom:\s*'1px solid rgba\(139,92,246,0\.08\)'/g, replace: "borderBottom: '1px solid var(--border-subtle)'" },
  { search: /color:\s*'#a78bfa'/g, replace: "color: 'var(--violet-light)'" },
  { search: /color:\s*'#22d3ee'/g, replace: "color: 'var(--cyan)'" },
  { search: /'#34d399'/g, replace: "'var(--emerald)'" },
  { search: /'#fb7185'/g, replace: "'var(--rose)'" },
  { search: /color:\s*'#fbbf24'/g, replace: "color: 'var(--amber)'" },
  { search: /color:\s*'#475569'/g, replace: "color: 'var(--text-dim)'" },
  { search: /borderTop:\s*'1px solid rgba\(139,92,246,0\.08\)'/g, replace: "borderTop: '1px solid var(--border-subtle)'" }
];

replacements.forEach(({ search, replace }) => {
  content = content.replace(search, replace);
});

fs.writeFileSync(filePath, content, 'utf8');
console.log('Successfully replaced styles in Popup.tsx');
