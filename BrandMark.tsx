import React from 'react';
import { Workflow } from 'lucide-react';

interface BrandMarkProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  title?: string;
}

const sizes = {
  sm: { box: 32, icon: 17, radius: 9 },
  md: { box: 40, icon: 21, radius: 11 },
  lg: { box: 64, icon: 32, radius: 17 },
} as const;

export const BrandMark: React.FC<BrandMarkProps> = ({ size = 'md', className = '', title = 'ScriptFlow Pro' }) => {
  const s = sizes[size];

  return (
    <div
      className={`brand-mark ${className}`}
      role="img"
      aria-label={title}
      title={title}
      style={{
        width: s.box,
        height: s.box,
        borderRadius: s.radius,
        display: 'grid',
        placeItems: 'center',
        flexShrink: 0,
        background: 'linear-gradient(135deg, #2563eb 0%, #4f46e5 55%, #7c3aed 100%)',
        border: '1px solid rgba(255,255,255,0.16)',
        boxShadow: '0 8px 22px rgba(37, 99, 235, 0.28), inset 0 1px 0 rgba(255,255,255,0.14)',
      }}
    >
      <Workflow size={s.icon} strokeWidth={2.25} color="#ffffff" aria-hidden="true" className="brand-mark__icon" />
    </div>
  );
};

export default BrandMark;
