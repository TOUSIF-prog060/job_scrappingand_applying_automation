export default function StatsBar({ stats = {} }) {
  const items = [
    { label: 'Total Jobs', value: stats.total ?? 0, cls: 'stat-total' },
    { label: 'Pending', value: stats.not_started ?? 0, cls: 'stat-pending' },
    { label: 'Running', value: stats.processing ?? 0, cls: 'stat-processing' },
    { label: 'Completed', value: stats.completed ?? 0, cls: 'stat-done' },
    { label: 'Failed', value: stats.failed ?? 0, cls: 'stat-failed' },
  ];

  return (
    <div className="stats-bar">
      {items.map(({ label, value, cls }) => (
        <div key={label} className={`stat-card ${cls}`}>
          <span className="stat-number">{value}</span>
          <span className="stat-label">{label}</span>
        </div>
      ))}
    </div>
  );
}
