import styles from './States.module.css';

interface EmptyStateProps {
  message?: string;
}

export function EmptyState({ message = 'No events found for the selected date range' }: EmptyStateProps) {
  return (
    <div className={styles.container}>
      <div className={styles.iconEmpty}>∅</div>
      <h3 className={styles.title}>No Data</h3>
      <p className={styles.message}>{message}</p>
    </div>
  );
}
