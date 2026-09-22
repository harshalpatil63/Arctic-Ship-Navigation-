import React from 'react';

interface RiskBadgeProps {
  level: 'Low' | 'Medium' | 'High' | string;
  size?: 'sm' | 'md';
}

const RiskBadge: React.FC<RiskBadgeProps> = ({ level, size = 'sm' }) => {
  const styles = {
    Critical: 'bg-red-700/20 text-red-300 border-red-600/40 shadow-red-600/10',
    High: 'bg-red-500/15 text-red-400 border-red-500/30 shadow-red-500/5',
    Medium: 'bg-amber-500/15 text-amber-400 border-amber-500/30 shadow-amber-500/5',
    Low: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30 shadow-emerald-500/5',
  };

  const dotColors = {
    Critical: 'bg-red-300',
    High: 'bg-red-400',
    Medium: 'bg-amber-400',
    Low: 'bg-emerald-400',
  };

  const sizeStyles = {
    sm: 'px-2.5 py-0.5 text-[10px]',
    md: 'px-3 py-1 text-xs',
  };

  const style = styles[level as keyof typeof styles] || styles.Medium;
  const dot = dotColors[level as keyof typeof dotColors] || dotColors.Medium;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border font-bold uppercase tracking-widest shadow-lg ${style} ${sizeStyles[size]}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${dot} animate-pulse`} />
      {level}
    </span>
  );
};

export default RiskBadge;
