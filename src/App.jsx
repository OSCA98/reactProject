import React, { useEffect, useRef, useState } from 'https://esm.sh/react@18.2.0';

const DT = 0.05; // Sekunden pro Simulationsschritt
const G = 800; // effektive Gravitationskonstante (skalierter Wert für die Bildschirmgrößen)
const SOFTENING = 25; // verhindert Singularitäten bei sehr kleinen Abständen
const MIN_RADIUS = 6;
const MAX_RADIUS = 60;
const RADIUS_GROWTH_PER_MS = 0.04;
const VELOCITY_SCALE = 0.75;
const COLORS = ['#4f46e5', '#ec4899', '#22c55e', '#f59e0b', '#06b6d4'];
const EPSILON = 0.05

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function computeRadius(elapsed = 0) {
  const grown = MIN_RADIUS + elapsed * RADIUS_GROWTH_PER_MS;
  return clamp(grown, MIN_RADIUS, MAX_RADIUS);
}

function isDivergating(b1,b2) {
  const currentDistance = Math.sqrt(Math.pow(b1.x-b2.x,2),Math.pow(b1.x-b2.y,2))
  const newDistance = Math.sqrt(Math.pow((b1.x+b1.vx*EPSILON)-(b2.x+b2.vx*EPSILON),2),Math.pow((b1.y+b1.vy*EPSILON)-(b2.y+b2.vy*EPSILON),2))
  return currentDistance < newDistance;
}
function stepSimulation(balls, bounds) {
  const { width, height } = bounds;
  if (width === 0 || height === 0) {
    return balls;
  }

  return balls.map((ball, index) => {
    //Gravity force
    let ax = 0;
    let ay = 0;

    let isBallCollision = false;
    let collisionPartnerId = null;
    //Compute gravity forcevector and check for collision
    for (let i = 0; i < balls.length; i += 1) {
      if (i === index) continue;
      const other = balls[i];
      const dx = other.x - ball.x;
      const dy = other.y - ball.y;
      const distanceSq = dx * dx + dy * dy + SOFTENING;
      const distance = Math.sqrt(distanceSq);
      //Check for collision
      if (distance <= ball.radius+other.radius && !isDivergating(ball,balls[i])) {
        console.log("Collision");
        console.log(isDivergating(ball,balls[i]))        
        isBallCollision=true;
        collisionPartnerId = i;
      }
      const acceleration = (G * other.mass) / distanceSq;
      ax += acceleration * (dx / distance);
      ay += acceleration * (dy / distance);
    }

    if (isBallCollision) {
      console.log("swap")
      ball.vx *= -1;
      ball.vy *= -1;
      balls[collisionPartnerId].vx *= -1;
      balls[collisionPartnerId].vy *= -1;
    }
    //Update speedvector by gravity forcevector
    let vx = ball.vx + ax * DT;
    let vy = ball.vy + ay * DT;

    //New position
    let x = ball.x + vx * DT;
    let y = ball.y + vy * DT;

    //Check boundrycollision
    if (x < ball.radius) {
      //Hitting left
      x = ball.radius;
      vx = -vx;
      vy *= 0.98;
    } else if (x > width - ball.radius) {
      //Hitting right
      x = width - ball.radius;
      vx = -vx;
      vy *= 0.98;
    }

    if (y < ball.radius) {
      //Hitting top
      y = ball.radius;
      vy = -vy;
      vx *= 0.98;
    } else if (y > height - ball.radius) {
      //Hitting bottom
      y = height - ball.radius;
      vy = -vy;
      vx *= 0.98;
    }

    return {
      ...ball,
      x,
      y,
      vx,
      vy,
    };
  });
}

function App() {
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [balls, setBalls] = useState([]);
  const [dragState, setDragState] = useState(null);
  const dragStateRef = useRef(null);
  const nextIdRef = useRef(0);

  useEffect(() => {
    dragStateRef.current = dragState;
  }, [dragState]);

  useEffect(() => {
    if (!containerRef.current) return undefined;

    const element = containerRef.current;
    const updateSize = () => {
      const rect = element.getBoundingClientRect();
      setSize({ width: rect.width, height: rect.height });
    };

    updateSize();
    window.addEventListener('resize', updateSize);

    let observer;
    if (typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(() => updateSize());
      observer.observe(element);
    }

    return () => {
      window.removeEventListener('resize', updateSize);
      if (observer) {
        observer.disconnect();
      }
    };
  }, []);

  useEffect(() => {
    if (size.width === 0 || size.height === 0) return undefined;

    const interval = setInterval(() => {
      setBalls((prev) => {
        if (prev.length === 0) return prev;
        return stepSimulation(prev, size);
      });
    }, DT * 1000);

    return () => clearInterval(interval);
  }, [size]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = size.width * dpr;
    canvas.height = size.height * dpr;
    canvas.style.width = `${size.width}px`;
    canvas.style.height = `${size.height}px`;

    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size.width, size.height);

    balls.forEach((ball) => {
      ctx.beginPath();
      const gradient = ctx.createRadialGradient(
        ball.x - ball.radius * 0.3,
        ball.y - ball.radius * 0.3,
        ball.radius * 0.2,
        ball.x,
        ball.y,
        ball.radius
      );
      gradient.addColorStop(0, '#ffffff');
      gradient.addColorStop(1, ball.color);
      ctx.fillStyle = gradient;
      ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
      ctx.fill();
    });

    if (dragState) {
      const radius = computeRadius(dragState.elapsed);
      const x = clamp(dragState.startX, radius, size.width - radius);
      const y = clamp(dragState.startY, radius, size.height - radius);
      const dx = dragState.currentX - dragState.startX;
      const dy = dragState.currentY - dragState.startY;
      const previewVx = dx /2;
      const previewVy = dy /2;

      ctx.beginPath();
      ctx.setLineDash([6, 6]);
      ctx.strokeStyle = 'rgba(79, 70, 229, 0.6)';
      ctx.fillStyle = 'rgba(79, 70, 229, 0.2)';
      ctx.lineWidth = 2;
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.beginPath();
      ctx.strokeStyle = 'rgba(255, 108, 108, 1)';
      ctx.lineWidth = 2;
      ctx.moveTo(x, y);
      ctx.lineTo(x + previewVx, y + previewVy);
      ctx.stroke();

      ctx.beginPath();
      ctx.fillStyle = 'red';
      ctx.arc(x + previewVx, y + previewVy, 4, 0, Math.PI * 2);
      ctx.fill();
    }
  }, [balls, dragState, size]);

  useEffect(() => {
    if (!dragState) return undefined;

    let animationFrame;
    const tick = () => {
      setDragState((prev) => {
        if (!prev) return prev;
        const elapsed = performance.now() - prev.startTime;
        return { ...prev, elapsed };
      });
      animationFrame = requestAnimationFrame(tick);
    };

    animationFrame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animationFrame);
  }, [dragState?.startTime]);

  const getRelativePosition = (event) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) {
      return { x: event.clientX, y: event.clientY };
    }

    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    };
  };

  const handlePointerDown = (event) => {
    if (event.button !== undefined && event.button !== 0) return;
    event.preventDefault();

    const position = getRelativePosition(event);
    const startTime = performance.now();
    const pointerId = event.pointerId ?? 0;

    if (containerRef.current?.setPointerCapture) {
      try {
        containerRef.current.setPointerCapture(pointerId);
      } catch (error) {
        // ignore if pointer capture is not allowed (e.g. right click)
      }
    }

    setDragState({
      pointerId,
      startX: position.x,
      startY: position.y,
      currentX: position.x,
      currentY: position.y,
      startTime,
      elapsed: 0,
    });
  };

  const handlePointerMove = (event) => {
    const current = dragStateRef.current;
    if (!current || current.pointerId !== (event.pointerId ?? 0)) return;

    const position = getRelativePosition(event);
    setDragState((prev) => {
      if (!prev) return prev;
      return { ...prev, currentX: position.x, currentY: position.y };
    });
  };

  const finalizeBall = () => {
    const current = dragStateRef.current;
    if (!current || size.width === 0 || size.height === 0) {
      setDragState(null);
      return;
    }

    const radius = computeRadius(current.elapsed);
    const x = clamp(current.startX, radius, size.width - radius);
    const y = clamp(current.startY, radius, size.height - radius);
    const dx = current.currentX - current.startX;
    const dy = current.currentY - current.startY;
    const vx = dx * VELOCITY_SCALE;
    const vy = dy * VELOCITY_SCALE;
    const id = nextIdRef.current++;
    const color = COLORS[id % COLORS.length];

    setBalls((prev) => [
      ...prev,
      {
        id,
        x,
        y,
        vx,
        vy,
        radius,
        mass: radius * radius,
        color,
      },
    ]);

    setDragState(null);
  };

  const handlePointerUp = (event) => {
    const current = dragStateRef.current;
    if (!current || current.pointerId !== (event.pointerId ?? 0)) return;

    finalizeBall();

    if (containerRef.current?.releasePointerCapture) {
      try {
        containerRef.current.releasePointerCapture(event.pointerId ?? 0);
      } catch (error) {
        // ignore
      }
    }
  };

  const handlePointerLeave = () => {
    if (!dragStateRef.current) return;
    finalizeBall();
  };

  return (
    <div
      ref={containerRef}
      className="app"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerLeave}
      onPointerLeave={handlePointerLeave}
    >
      <canvas ref={canvasRef} className="canvas" />
      <div className="hint">
        
      </div>
    </div>
  );
}

export default App;
