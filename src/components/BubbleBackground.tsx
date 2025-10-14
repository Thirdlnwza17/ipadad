'use client';

import { useEffect, useRef } from 'react';

interface Bubble {
  x: number;
  y: number;
  radius: number;
  dx: number;
  dy: number;
  alpha: number;
}

export default function BubbleBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number | null>(null);
  const bubblesRef = useRef<Bubble[]>([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resizeCanvas();

    const createBubbles = () => {
      const bubbles: Bubble[] = [];
      const bubbleCount = Math.floor((window.innerWidth * window.innerHeight) / 40000);

      for (let i = 0; i < bubbleCount; i++) {
        const radius = Math.random() * 20 + 10;
        bubbles.push({
          x: Math.random() * (canvas.width - radius * 2) + radius,
          y: Math.random() * (canvas.height - radius * 2) + radius,
          radius,
          dx: (Math.random() - 0.5) * 0.5,
          dy: (Math.random() - 0.5) * 0.5,
          alpha: Math.random() * 0.3 + 0.2,
        });
      }
      return bubbles;
    };

    const drawBubble = (bubble: Bubble) => {
      if (!ctx) return;

      ctx.beginPath();
      ctx.arc(bubble.x, bubble.y, bubble.radius, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(200, 230, 255, ${bubble.alpha})` ;
      ctx.fill();

      // Add highlight to make bubbles look more 3D
      ctx.beginPath();
      ctx.arc(
        bubble.x - bubble.radius * 0.3,
        bubble.y - bubble.radius * 0.3,
        bubble.radius * 0.4,
        0,
        Math.PI * 2
      );
      ctx.fillStyle = `rgba(255, 255, 255, ${bubble.alpha * 0.6})` ;
      ctx.fill();
    };

    const updateBubbles = () => {
      const bubbles = bubblesRef.current;

      bubbles.forEach((bubble) => {
        bubble.x += bubble.dx;
        bubble.y += bubble.dy;

        // Bounce off edges
        if (bubble.x + bubble.radius > canvas.width || bubble.x - bubble.radius < 0) {
          bubble.dx = -bubble.dx;
        }

        if (bubble.y + bubble.radius > canvas.height || bubble.y - bubble.radius < 0) {
          bubble.dy = -bubble.dy;
        }
      });
    };

    const animate = () => {
      if (!ctx) return;

      // Clear with slight opacity for trail effect
      ctx.fillStyle = 'rgba(240, 248, 255, 0.1)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      updateBubbles();
      bubblesRef.current.forEach(drawBubble);

      animationRef.current = requestAnimationFrame(animate);
    };

    // Initialize bubbles and start animation
    bubblesRef.current = createBubbles();
    animate();

    const handleResize = () => {
      resizeCanvas();
      bubblesRef.current = createBubbles();
    };

    window.addEventListener('resize', handleResize);

    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  return (
    <div className="fixed inset-0 w-full h-full overflow-hidden">
      <canvas
        ref={canvasRef}
        className="absolute top-0 left-0 w-full h-full -z-10 pointer-events-none"
        style={{ zIndex: -1 }}
      />
    </div>
  );
}
