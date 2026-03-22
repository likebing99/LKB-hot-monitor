import { useEffect } from 'react';
import { motion, stagger, useAnimate } from 'framer-motion';

export function TextGenerateEffect({ words, className = '', filter = true, duration = 0.5 }) {
  const [scope, animate] = useAnimate();
  const wordsArray = words.split(' ');

  useEffect(() => {
    animate(
      'span',
      { opacity: 1, filter: filter ? 'blur(0px)' : 'none' },
      { duration, delay: stagger(0.08) }
    );
  }, [scope]);

  return (
    <div ref={scope} className={className}>
      {wordsArray.map((word, idx) => (
        <motion.span
          key={word + idx}
          className="opacity-0"
          style={{ filter: filter ? 'blur(10px)' : 'none' }}
        >
          {word}{' '}
        </motion.span>
      ))}
    </div>
  );
}
