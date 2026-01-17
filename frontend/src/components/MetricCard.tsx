import styles from './MetricCard.module.css';

interface MetricCardProps {
  title: string;
  value: number | string;
  subtitle?: string;
}

export function MetricCard({ title, value, subtitle }: MetricCardProps) {
  const formattedValue = typeof value === 'number' 
    ? value.toLocaleString() 
    : value;

  return (
    <div className={styles.card}>
      <h3 className={styles.title}>{title}</h3>
      <p className={styles.value}>{formattedValue}</p>
      {subtitle && <span className={styles.subtitle}>{subtitle}</span>}
    </div>
  );
}
