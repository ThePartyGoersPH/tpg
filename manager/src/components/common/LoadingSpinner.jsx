import React from 'react';
import { Loader2 } from 'lucide-react';

const LoadingSpinner = ({ size = 'md', text = 'Loading...' }) => {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-8 h-8',
    lg: 'w-12 h-12',
  };

  return (
    <div className="flex flex-col items-center justify-center py-12">
      <Loader2 className={`${sizeClasses[size]} animate-spin`} style={{ color: '#CC0000' }} />
      {text && <p className="mt-3 text-sm" style={{ color: '#666' }}>{text}</p>}
    </div>
  );
};

export default LoadingSpinner;
