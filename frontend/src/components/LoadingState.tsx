import styles from './States.module.css';

export function LoadingState() {
  return (
    <div className={styles.container}>
      <div className={styles.spinner} />
      <p className={styles.message}>Loading analytics data...</p>
    </div>
  );
}
