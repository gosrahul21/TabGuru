import { useTheme } from '../ThemeContext';

interface Props {
  value: string;
  onChange: (v: string) => void;
  hasError: boolean;
}

export default function PurposeInput({ value, onChange, hasError }: Props) {
  const { theme } = useTheme();
  return (
    <textarea
      id="purpose-input"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      rows={2}
      placeholder='e.g. "Research Spring Boot Security", "Buy flight tickets"…'
      autoFocus
      className={`
        w-full resize-none rounded-xl px-4 py-3 text-sm font-inter
        border outline-none transition-all duration-200
        ${theme.inputBase}
        ${hasError ? theme.inputBorderError : theme.inputBorderNormal}
      `}
    />
  );
}
