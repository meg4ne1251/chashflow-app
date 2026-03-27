import { useState, useEffect, useRef } from 'react';
import { TextField } from '@mui/material';
import { evaluateExpression, hasOperator } from '@/utils/calc';

interface CalculatorAmountFieldProps {
  value: number | undefined;
  onChange: (value: number) => void;
  onBlur: () => void;
  error?: boolean;
  helperText?: React.ReactNode;
  inputRef?: React.Ref<HTMLInputElement>;
}

export default function CalculatorAmountField({
  value,
  onChange,
  onBlur,
  error,
  helperText,
  inputRef,
}: CalculatorAmountFieldProps) {
  const [text, setText] = useState(value != null ? String(value) : '');
  const [preview, setPreview] = useState<number | null>(null);
  const lastInternalValue = useRef<number | undefined>(value);

  // Sync from external value changes (form reset, template prefill, edit load)
  useEffect(() => {
    if (value !== lastInternalValue.current) {
      setText(value != null ? String(value) : '');
      setPreview(null);
      lastInternalValue.current = value;
    }
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target.value;
    // Only allow digits and arithmetic operators
    if (input && !/^[\d+\-*/]+$/.test(input)) return;

    setText(input);

    if (!input) {
      lastInternalValue.current = undefined;
      onChange(NaN);
      setPreview(null);
      return;
    }

    const result = evaluateExpression(input);
    if (result !== null) {
      lastInternalValue.current = result;
      onChange(result);
      setPreview(hasOperator(input) ? result : null);
    } else {
      // Incomplete expression (e.g. "100+") — keep last valid form value
      // Invalid expression (e.g. "++") — clear form value
      if (!/[+\-*/]$/.test(input)) {
        lastInternalValue.current = undefined;
        onChange(NaN);
      }
      setPreview(null);
    }
  };

  const handleBlur = () => {
    // On blur, evaluate and replace text with the result
    if (hasOperator(text)) {
      const result = evaluateExpression(text);
      if (result !== null) {
        setText(String(result));
        lastInternalValue.current = result;
        onChange(result);
        setPreview(null);
      }
    }
    onBlur();
  };

  const displayHelperText =
    !error && preview !== null
      ? `= ${preview.toLocaleString('ja-JP')}`
      : helperText;

  return (
    <TextField
      fullWidth
      label="金額"
      value={text}
      onChange={handleChange}
      onBlur={handleBlur}
      error={error}
      helperText={displayHelperText}
      inputRef={inputRef}
      placeholder="例: 1000+500"
    />
  );
}
