import styles from './EventsTable.module.css';

interface EventsTableProps {
  eventsByType: Record<string, number>;
}

export function EventsTable({ eventsByType }: EventsTableProps) {
  const entries = Object.entries(eventsByType).sort((a, b) => b[1] - a[1]);
  const total = entries.reduce((sum, [, count]) => sum + count, 0);

  return (
    <div className={styles.container}>
      <h3 className={styles.heading}>Events by Type</h3>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Event Type</th>
            <th>Count</th>
            <th>Percentage</th>
          </tr>
        </thead>
        <tbody>
          {entries.map(([type, count]) => (
            <tr key={type}>
              <td className={styles.eventType}>{type}</td>
              <td className={styles.count}>{count.toLocaleString()}</td>
              <td className={styles.percentage}>
                <div className={styles.percentageBar}>
                  <div 
                    className={styles.percentageFill}
                    style={{ width: `${(count / total) * 100}%` }}
                  />
                  <span>{((count / total) * 100).toFixed(1)}%</span>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
