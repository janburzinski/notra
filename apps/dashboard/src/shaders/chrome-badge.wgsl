struct Params {
  size: vec2f,
  time: f32,
  radius: f32,
  dpr: f32,
  iridescence: f32,
  glint: f32,
  // rgb: metal tint, a: 1 on light themes
  tint: vec4f,
}
@group(0) @binding(0) var<uniform> params: Params;

const TAU: f32 = 6.2831853;
const GLINT_PERIOD: f32 = 3.6;
const GLINT_CROSSING: f32 = 1.1;
const ORBIT_SPEED: f32 = 1.4;

fn rounded_rect(p: vec2f, half_size: vec2f, r: f32) -> f32 {
  let q = abs(p) - half_size + vec2f(r);
  return length(max(q, vec2f(0.0))) + min(max(q.x, q.y), 0.0) - r;
}

fn iridescent(c: vec3f, phase: f32) -> vec3f {
  let rainbow = 0.5 + 0.5 * cos(TAU * (vec3f(0.0, 0.33, 0.67) + phase));
  return mix(c, c * (0.55 + 0.75 * rainbow), params.iridescence);
}

fn glint(x: f32, y: f32, aspect: f32, t: f32) -> f32 {
  let cycle = fract(t / GLINT_PERIOD) * GLINT_PERIOD;
  let sweep = clamp(cycle / GLINT_CROSSING, 0.0, 1.0) * (aspect + 1.8) - 0.9;
  let g = x + y * 0.6 - sweep;
  return exp(-g * g * 70.0);
}

// Smoked-glass pill with a chrome edge.
@fragment fn fs_main(@location(0) uv: vec2f) -> @location(0) vec4f {
  let px = uv * params.size;
  let center = params.size * 0.5;
  let d = rounded_rect(px - center, center - vec2f(0.5), params.radius);
  let coverage = clamp(0.5 - d, 0.0, 1.0);
  if (coverage <= 0.0) {
    return vec4f(0.0);
  }

  let t = params.time;
  let aspect = params.size.x / params.size.y;
  let tint = params.tint.rgb;
  let is_light = params.tint.a;
  let shine = glint(uv.x * aspect, uv.y, aspect, t) * params.glint;

  // Near-black body, gloss on the upper half, a faint caustic glow where
  // light exits at the bottom.
  let base = mix(0.025, 0.07, is_light);
  let gloss = smoothstep(0.55, 0.0, uv.y) * mix(0.09, 0.16, is_light);
  let caustic = smoothstep(0.6, 1.0, uv.y) * mix(0.07, 0.0, is_light);
  let alpha = 0.97;
  let smoke = mix(vec3f(base), tint * base * 2.2, 0.35) + vec3f(gloss) + caustic * tint + 0.28 * shine * tint;

  // Rim: one CSS pixel inside the edge, lit by two lights orbiting the badge.
  // Glass catches light on its top edge and less at the bottom.
  let rim_mask = clamp(smoothstep(-params.dpr - 0.75, -params.dpr + 0.25, d), 0.0, 1.0);
  let p = (px - center) / center;
  let angle = atan2(p.y, p.x);
  let key = pow(max(cos(angle - t * ORBIT_SPEED), 0.0), 6.0);
  let fill_light = 0.5 * pow(max(cos(angle - t * ORBIT_SPEED + 3.14159), 0.0), 10.0);
  let sky = 0.32 + 0.3 * (1.0 - uv.y);
  let rim_level = clamp(sky + 1.1 * key + fill_light + shine, 0.0, 1.0);
  let rim_rgb = iridescent(tint * rim_level * mix(0.45, 1.0, smoothstep(0.85, 0.15, uv.y)), angle / TAU + t * 0.08);

  let rgb = mix(smoke * alpha, rim_rgb, rim_mask);
  let out_alpha = mix(alpha, 1.0, rim_mask);
  return vec4f(rgb * coverage, out_alpha * coverage);
}
