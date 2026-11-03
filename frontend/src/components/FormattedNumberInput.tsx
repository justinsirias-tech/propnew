import React, { useState, useEffect, useRef, useLayoutEffect } from 'react';

/**
 * Formats any number in the system with thousands commas (,) and optional decimals (.)
 */
export function formatSysNumber(
  value: number | string | null | undefined,
  maxDecimals = 2,
  minDecimals = 0
): string {
  if (value === null || value === undefined || value === '') return '0';
  const num = typeof value === 'number' ? value : Number(String(value).replace(/,/g, ''));
  if (Number.isNaN(num)) return '0';
  return num.toLocaleString('en-US', {
    minimumFractionDigits: minDecimals,
    maximumFractionDigits: maxDecimals,
  });
}

interface FormattedNumberInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'> {
  value: number | string | null | undefined;
  onValueChange: (numericValue: number) => void;
  maxDecimals?: number;
  minDecimals?: number;
  allowNegative?: boolean;
}

function formatRawNumericString(
  numVal: number | string | null | undefined,
  maxDecimals: number,
  minDecimals: number
): string {
  if (numVal === null || numVal === undefined || numVal === '') return '';
  const parsed = typeof numVal === 'number' ? numVal : Number(String(numVal).replace(/,/g, ''));
  if (Number.isNaN(parsed)) return '';
  return parsed.toLocaleString('en-US', {
    minimumFractionDigits: minDecimals,
    maximumFractionDigits: maxDecimals,
  });
}

export const FormattedNumberInput: React.FC<FormattedNumberInputProps> = ({
  value,
  onValueChange,
  maxDecimals = 2,
  minDecimals = 0,
  allowNegative = false,
  onBlur,
  onFocus,
  onKeyDown,
  className = '',
  ...rest
}) => {
  const [focused, setFocused] = useState(false);
  const [displayStr, setDisplayStr] = useState<string>(() =>
    formatRawNumericString(value, maxDecimals, minDecimals)
  );

  const inputRef = useRef<HTMLInputElement>(null);
  const cursorPosRef = useRef<number | null>(null);

  // Sync display string when external value changes while not focused (or if auto-calculated externally)
  useEffect(() => {
    if (!focused) {
      setDisplayStr(formatRawNumericString(value, maxDecimals, minDecimals));
    } else {
      const currentNumeric = Number(displayStr.replace(/,/g, ''));
      const incomingNumeric =
        typeof value === 'number' ? value : Number(String(value ?? 0).replace(/,/g, ''));
      if (
        !Number.isNaN(incomingNumeric) &&
        Math.abs(currentNumeric - incomingNumeric) > 0.0001 &&
        !displayStr.endsWith('.')
      ) {
        setDisplayStr(formatRawNumericString(incomingNumeric, maxDecimals, minDecimals));
      }
    }
  }, [value, focused, maxDecimals, minDecimals]);

  // Keep cursor position stable after re-rendering with new formatted string
  useLayoutEffect(() => {
    if (
      cursorPosRef.current !== null &&
      inputRef.current &&
      document.activeElement === inputRef.current
    ) {
      const pos = Math.min(cursorPosRef.current, inputRef.current.value.length);
      inputRef.current.setSelectionRange(pos, pos);
      cursorPosRef.current = null;
    }
  });

  const processAndFormat = (raw: string, rawCursor: number) => {
    const rawBeforeCursor = raw.slice(0, rawCursor);
    const nonCommaBefore = rawBeforeCursor.replace(/,/g, '').length;

    // Clean input
    let cleaned = raw.replace(/,/g, '');
    if (allowNegative) {
      cleaned = cleaned.replace(/(?!^-)[^0-9.]/g, '');
    } else {
      cleaned = cleaned.replace(/[^0-9.]/g, '');
    }

    const parts = cleaned.split('.');
    if (parts.length > 2) {
      cleaned = `${parts[0]}.${parts.slice(1).join('')}`;
    }

    if (cleaned === '' || cleaned === '-') {
      setDisplayStr(cleaned);
      onValueChange(0);
      cursorPosRef.current = cleaned.length;
      return;
    }

    const isNegative = cleaned.startsWith('-');
    const unsigned = isNegative ? cleaned.slice(1) : cleaned;
    const [intPartRaw, decPartRaw] = unsigned.split('.');

    // Parse integer part cleanly
    const intNum = intPartRaw ? parseInt(intPartRaw, 10) : 0;
    const formattedInt = Number.isNaN(intNum) ? '0' : intNum.toLocaleString('en-US');

    let nextDisplay = (isNegative ? '-' : '') + formattedInt;
    if (decPartRaw !== undefined && maxDecimals > 0) {
      const clippedDec = decPartRaw.slice(0, maxDecimals);
      nextDisplay += `.${clippedDec}`;
    }

    // Determine new cursor position in formatted string
    let targetCursor = nextDisplay.length;
    let countedNonComma = 0;
    for (let i = 0; i < nextDisplay.length; i++) {
      if (countedNonComma >= nonCommaBefore) {
        targetCursor = i;
        break;
      }
      if (nextDisplay[i] !== ',') {
        countedNonComma++;
      }
      targetCursor = i + 1;
    }

    cursorPosRef.current = targetCursor;
    setDisplayStr(nextDisplay);

    const parsedNum = parseFloat(cleaned);
    onValueChange(Number.isNaN(parsedNum) ? 0 : parsedNum);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    const rawCursor = e.target.selectionStart ?? raw.length;
    processAndFormat(raw, rawCursor);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      const input = e.currentTarget;
      const start = input.selectionStart;
      const end = input.selectionEnd;
      // If cursor is placed right after a comma, delete the digit preceding the comma
      if (start !== null && start === end && start > 0) {
        if (input.value[start - 1] === ',') {
          e.preventDefault();
          const before = input.value.slice(0, start - 2);
          const after = input.value.slice(start);
          const newRaw = before + after;
          processAndFormat(newRaw, start - 2);
          return;
        }
      }
    }
    if (onKeyDown) onKeyDown(e);
  };

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    setFocused(true);
    if (onFocus) onFocus(e);
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    setFocused(false);
    setDisplayStr(formatRawNumericString(value, maxDecimals, minDecimals));
    if (onBlur) onBlur(e);
  };

  return (
    <input
      {...rest}
      ref={inputRef}
      type="text"
      inputMode="decimal"
      value={displayStr}
      onChange={handleChange}
      onKeyDown={handleKeyDown}
      onFocus={handleFocus}
      onBlur={handleBlur}
      className={className}
    />
  );
};
