import React from 'react';
import { LucideIcon } from 'lucide-react';

interface FeatureCardProps {
  icon: LucideIcon;
  title: string;
  description: string;
  color: 'cyan' | 'blue' | 'emerald' | 'amber' | 'red' | 'violet';
  delay?: number;
}

const colorMap = {
  cyan: {
    bg: 'bg-cyan-500/10',
    border: 'border-cyan-500/20',
    text: 'text-cyan-400',
    shadow: 'group-hover:shadow-cyan-500/10',
    glow: 'bg-cyan-500',
  },
  blue: {
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/20',
    text: 'text-blue-400',
    shadow: 'group-hover:shadow-blue-500/10',
    glow: 'bg-blue-500',
  },
  emerald: {
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/20',
    text: 'text-emerald-400',
    shadow: 'group-hover:shadow-emerald-500/10',
    glow: 'bg-emerald-500',
  },
  amber: {
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/20',
    text: 'text-amber-400',
    shadow: 'group-hover:shadow-amber-500/10',
    glow: 'bg-amber-500',
  },
  red: {
    bg: 'bg-red-500/10',
    border: 'border-red-500/20',
    text: 'text-red-400',
    shadow: 'group-hover:shadow-red-500/10',
    glow: 'bg-red-500',
  },
  violet: {
    bg: 'bg-violet-500/10',
    border: 'border-violet-500/20',
    text: 'text-violet-400',
    shadow: 'group-hover:shadow-violet-500/10',
    glow: 'bg-violet-500',
  },
};

const FeatureCard: React.FC<FeatureCardProps> = ({ icon: Icon, title, description, color }) => {
  const c = colorMap[color];

  return (
    <div className={`group relative glass rounded-2xl p-6 card-hover cursor-default ${c.shadow} transition-all duration-300`}>
      {/* Subtle glow dot */}
      <div className={`absolute top-4 right-4 w-1.5 h-1.5 rounded-full ${c.glow} opacity-40 group-hover:opacity-100 transition-opacity`} />

      {/* Icon */}
      <div className={`w-11 h-11 rounded-xl ${c.bg} border ${c.border} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300`}>
        <Icon className={`w-5 h-5 ${c.text}`} />
      </div>

      {/* Content */}
      <h3 className="text-sm font-bold text-white mb-2 tracking-tight">{title}</h3>
      <p className="text-xs text-slate-400 leading-relaxed">{description}</p>

      {/* Bottom accent line */}
      <div className={`absolute bottom-0 left-6 right-6 h-px bg-gradient-to-r from-transparent ${c.border} to-transparent opacity-0 group-hover:opacity-100 transition-opacity`} />
    </div>
  );
};

export default FeatureCard;
