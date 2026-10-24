import { getStatusColor, getStatusText } from '../../utils/formatters';

export default function StatusBadge({ status }) {
  const color = getStatusColor(status);
  const text = getStatusText(status);

  const colorClasses = {
    green: 'bg-green-100 text-green-800 border-green-200',
    amber: 'bg-amber-100 text-amber-800 border-amber-200',
    red: 'bg-red-100 text-red-800 border-red-200',
    blue: 'bg-blue-100 text-blue-800 border-blue-200',
    gray: 'bg-gray-100 text-gray-800 border-gray-200',
  };

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${colorClasses[color]}`}>
      {text}
    </span>
  );
}
