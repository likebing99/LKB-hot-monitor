import { useRef, useState, useCallback } from 'react';

export function GlowBorder({ children, className = '', glowColor = 'cyan' }) {
  const ref = useRef(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [isHover, setIsHover] = useState(false);

  const colors = {
    cyan: 'rgba(6, 182, 212, 0.4)',
    purple: 'rgba(139, 92, 246, 0.4)',
    pink: 'rgba(236, 72, 153, 0.4)',
    green: 'rgba(34, 197, 94, 0.4)',
  };

  const handleMouseMove = useCallback((e) => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  }, []);

  return (
    <div
      ref={ref}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setIsHover(true)}
      onMouseLeave={() => setIsHover(false)}
      className={`relative group ${className}`}
    >
      {/* Glow effect */}
      <div
        className="absolute -inset-px rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 blur-sm"
        style={{
          background: isHover
            ? `radial-gradient(300px circle at ${mousePos.x}px ${mousePos.y}px, ${colors[glowColor] || colors.cyan}, transparent 40%)`
            : 'none',
        }}
      />
      {/* Content */}
      <div className="relative">
        {children}
      </div>
    </div>
  );
}
