export default function Stats({ stats, worker }) {
  const statItems = [
    { label: 'In Queue', value: stats.queued || 0, color: 'text-blue-400' },
    { label: 'Processing', value: stats.processing || 0, color: 'text-yellow-400' },
    { label: 'Ready', value: stats.readyForSubmit || 0, color: 'text-green-400' },
    { label: 'Completed Today', value: stats.completedToday || 0, color: 'text-emerald-400' },
    { label: 'Your Total', value: worker?.totalCompleted || 0, color: 'text-purple-400' }
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
      {statItems.map((stat) => (
        <div key={stat.label} className="bg-slate-800 rounded-lg p-4 text-center">
          <div className={`text-2xl font-bold ${stat.color}`}>
            {stat.value}
          </div>
          <div className="text-xs text-slate-400 mt-1">
            {stat.label}
          </div>
        </div>
      ))}
    </div>
  );
}
