import { DateRange } from '@/types/analytics';
import styles from './DateRangePicker.module.css';

interface DateRangePickerProps {
  dateRange: DateRange;
  onChange: (dateRange: DateRange) => void;
  disabled?: boolean;
}

export function DateRangePicker({ dateRange, onChange, disabled }: DateRangePickerProps) {
  const handleFromChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange({ ...dateRange, from: new Date(e.target.value).toISOString() });
  };

  const handleToChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange({ ...dateRange, to: new Date(e.target.value).toISOString() });
  };

  const formatForInput = (isoString: string): string => {
    return isoString.split('T')[0];
  };

  return (
    <div className={styles.container}>
      <div className={styles.field}>
        <label htmlFor="from-date" className={styles.label}>From</label>
        <input
          id="from-date"
          type="date"
          className={styles.input}
          value={formatForInput(dateRange.from)}
          onChange={handleFromChange}
          disabled={disabled}
        />
      </div>
      <div className={styles.field}>
        <label htmlFor="to-date" className={styles.label}>To</label>
        <input
          id="to-date"
          type="date"
          className={styles.input}
          value={formatForInput(dateRange.to)}
          onChange={handleToChange}
          disabled={disabled}
        />
      </div>
    </div>
  );
}
