import React from 'react';

interface PhoneInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  value: string;
  onChange: (val: string) => void;
}

export const PhoneInput: React.FC<PhoneInputProps> = ({ value, onChange, ...props }) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    
    // Allow clearing entirely if they delete everything
    if (val === '') {
      onChange('');
      return;
    }

    let digits = val.replace(/\D/g, '');

    // Allow user to start typing local 0... and auto-convert to 27...
    if (digits.startsWith('0')) {
      digits = '27' + digits.substring(1);
    } else if (digits.length > 0 && !digits.startsWith('27')) {
      // If they type `6` it becomes `276`
      if (digits.length <= 9) {
          digits = '27' + digits;
      }
    }

    // Default to '27' if empty but not fully cleared string (e.g. typing just '+')
    if (!digits.startsWith('27') && digits.length > 0) {
      if (digits[0] === '2' && digits.length === 1) {
         // just 2, okay.
      } else {
         digits = '27';
      }
    }

    digits = digits.substring(0, 11); // 27 + 9 digits max

    let formatted = '';
    if (digits.length > 0) {
      formatted = '+' + digits.substring(0, 2); // +27
    }
    if (digits.length > 2) {
      formatted += ' ' + digits.substring(2, 4); // +27 60
    }
    if (digits.length > 4) {
      formatted += ' ' + digits.substring(4, 7); // +27 60 123
    }
    if (digits.length > 7) {
      formatted += ' ' + digits.substring(7, 11); // +27 60 123 4567
    }

    if (formatted === '+27') {
        formatted = '+27 ';
    }

    onChange(formatted);
  };

  const handleFocus = () => {
    if (!value) {
      onChange('+27 ');
    }
  };

  return (
    <input
      type="tel"
      value={value}
      onChange={handleChange}
      onFocus={handleFocus}
      maxLength={15}
      {...props}
    />
  );
};
