// The simulation runs in the browser and again on the server to verify a score, so it must give the
// same result in every JS engine. +, -, *, / and Math.sqrt are exact IEEE operations everywhere, but
// Math.sin, Math.cos, Math.atan2, Math.hypot and ** are not, so the game uses these instead.

// Math.PI is a constant, not a computation, so it is the same everywhere.
export const PI = Math.PI;
export const TAU = Math.PI * 2;
const HALF_PI = Math.PI / 2;

/** sin on any angle, from an odd Taylor polynomial on [-π/2, π/2]. Error below 1e-7. */
export function dsin(angle: number) {
  let r = angle - TAU * Math.floor(angle / TAU + 0.5);
  if (r > HALF_PI) {
    r = PI - r;
  } else if (r < -HALF_PI) {
    r = -PI - r;
  }
  const r2 = r * r;
  return (
    r *
    (1 +
      r2 *
        (-1 / 6 +
          r2 *
            (1 / 120 +
              r2 * (-1 / 5040 + r2 * (1 / 362_880 + r2 * (-1 / 39_916_800))))))
  );
}

export function dcos(angle: number) {
  return dsin(angle + HALF_PI);
}

/** atan2 from the Abramowitz & Stegun 4.4.49 polynomial; error below 1e-5 radians. */
export function datan2(y: number, x: number) {
  const ax = Math.abs(x);
  const ay = Math.abs(y);
  if (ax === 0 && ay === 0) {
    return 0;
  }
  const a = Math.min(ax, ay) / Math.max(ax, ay);
  const s = a * a;
  let r =
    a *
    (0.999_866 +
      s *
        (-0.330_299_5 + s * (0.180_141 + s * (-0.085_133 + s * 0.020_835_1))));
  if (ay > ax) {
    r = HALF_PI - r;
  }
  if (x < 0) {
    r = PI - r;
  }
  return y < 0 ? -r : r;
}

export function dlen(x: number, y: number) {
  return Math.sqrt(x * x + y * y);
}

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

/** The signed difference between two angles, in (-π, π]. */
export function angleDiff(to: number, from: number) {
  let d = (to - from) % TAU;
  if (d > PI) {
    d -= TAU;
  } else if (d <= -PI) {
    d += TAU;
  }
  return d;
}

export function turnToward(current: number, desired: number, maxStep: number) {
  return current + clamp(angleDiff(desired, current), -maxStep, maxStep);
}
