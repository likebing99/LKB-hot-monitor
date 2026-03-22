import { useMemo } from 'react';

export function Meteors({ number = 12 }) {
  const meteors = useMemo(() => {
    return Array.from({ length: number }, (_, i) => ({
      id: i,
      left: Math.floor(Math.random() * 100) + '%',
      delay: Math.random() * 3 + 's',
      duration: Math.floor(Math.random() * 3 + 4) + 's',
    }));
  }, [number]);

  return (
    <>
      {meteors.map((m) => (
        <span
          key={m.id}
          className="absolute top-1/2 left-1/2 h-0.5 w-0.5 rounded-full bg-slate-400 shadow-[0_0_0_1px_#ffffff10] rotate-[215deg] animate-meteor-effect before:content-[''] before:absolute before:top-1/2 before:-translate-y-1/2 before:w-[50px] before:h-px before:bg-gradient-to-r before:from-cyan-400/80 before:to-transparent"
          style={{
            top: 0,
            left: m.left,
            animationDelay: m.delay,
            animationDuration: m.duration,
          }}
        />
      ))}
    </>
  );
}
