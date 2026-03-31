const MAX_DPR = 2;
const ATTRIBUTE_THEME = "data-theme";
const reduceMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

const dtr = (deg) => deg * Math.PI / 180;
const rnd = () => Math.sin(Math.floor(Math.random() * 360) * Math.PI / 180);
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const parseHue = (color, fallback) => {
  const temp = document.createElement("span");
  temp.style.color = color || fallback;
  document.body.appendChild(temp);
  const rgb = getComputedStyle(temp).color;
  temp.remove();

  const match = rgb.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
  if (!match) return fallback;

  const r = Number(match[1]) / 255;
  const g = Number(match[2]) / 255;
  const b = Number(match[3]) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;

  if (delta === 0) return fallback;

  let h;
  if (max === r) {
    h = ((g - b) / delta) % 6;
  } else if (max === g) {
    h = (b - r) / delta + 2;
  } else {
    h = (r - g) / delta + 4;
  }

  return Math.round((h * 60 + 360) % 360);
};

const createCam = (w, h) => ({
  obj: { x: 0, y: 0, z: 150 },
  dest: { x: 0, y: 0, z: 1 },
  dist: { x: 0, y: 0, z: 200 },
  ang: { cplane: 0, splane: 0, ctheta: 0, stheta: 0 },
  zoom: 1,
  disp: { x: w / 2, y: h / 2, z: 0 },
  upd() {
    this.dist.x = this.dest.x - this.obj.x;
    this.dist.y = this.dest.y - this.obj.y;
    this.dist.z = this.dest.z - this.obj.z;

    const xz = Math.sqrt(this.dist.x * this.dist.x + this.dist.z * this.dist.z) || 1;
    const xyz = Math.sqrt(this.dist.x * this.dist.x + this.dist.y * this.dist.y + this.dist.z * this.dist.z) || 1;

    this.ang.cplane = -this.dist.z / xz;
    this.ang.splane = this.dist.x / xz;
    this.ang.ctheta = xz / xyz;
    this.ang.stheta = -this.dist.y / xyz;
  }
});

const buildTransform = (cam) => ({
  parts: {
    sz(p, sz) {
      return { x: p.x * sz.x, y: p.y * sz.y, z: p.z * sz.z };
    },
    rot: {
      x(p, rot) {
        return {
          x: p.x,
          y: p.y * Math.cos(dtr(rot.x)) - p.z * Math.sin(dtr(rot.x)),
          z: p.y * Math.sin(dtr(rot.x)) + p.z * Math.cos(dtr(rot.x))
        };
      },
      y(p, rot) {
        return {
          x: p.x * Math.cos(dtr(rot.y)) + p.z * Math.sin(dtr(rot.y)),
          y: p.y,
          z: -p.x * Math.sin(dtr(rot.y)) + p.z * Math.cos(dtr(rot.y))
        };
      },
      z(p, rot) {
        return {
          x: p.x * Math.cos(dtr(rot.z)) - p.y * Math.sin(dtr(rot.z)),
          y: p.x * Math.sin(dtr(rot.z)) + p.y * Math.cos(dtr(rot.z)),
          z: p.z
        };
      }
    },
    pos(p, pos) {
      return { x: p.x + pos.x, y: p.y + pos.y, z: p.z + pos.z };
    }
  },
  pov: {
    plane(p) {
      return {
        x: p.x * cam.ang.cplane + p.z * cam.ang.splane,
        y: p.y,
        z: p.x * -cam.ang.splane + p.z * cam.ang.cplane
      };
    },
    theta(p) {
      return {
        x: p.x,
        y: p.y * cam.ang.ctheta - p.z * cam.ang.stheta,
        z: p.y * cam.ang.stheta + p.z * cam.ang.ctheta
      };
    },
    set(p) {
      return { x: p.x - cam.obj.x, y: p.y - cam.obj.y, z: p.z - cam.obj.z };
    }
  },
  persp(p) {
    return {
      x: p.x * cam.dist.z / p.z * cam.zoom,
      y: p.y * cam.dist.z / p.z * cam.zoom,
      z: p.z * cam.zoom,
      p: cam.dist.z / p.z
    };
  },
  disp(p, disp) {
    return { x: p.x + disp.x, y: -p.y + disp.y, z: p.z + disp.z, p: p.p };
  },
  steps(vtx, sz, rot, pos, disp) {
    let args = this.parts.sz(vtx, sz);
    args = this.parts.rot.x(args, rot);
    args = this.parts.rot.y(args, rot);
    args = this.parts.rot.z(args, rot);
    args = this.parts.pos(args, pos);
    args = this.pov.plane(args);
    args = this.pov.theta(args);
    args = this.pov.set(args);
    args = this.persp(args);
    args = this.disp(args, disp);
    return args;
  }
});

const createParticle = (diff) => ({
  vtx: { x: rnd(), y: rnd(), z: rnd() },
  sz: { x: 0, y: 0, z: 0 },
  rot: { x: 20, y: -20, z: 0 },
  pos: {
    x: diff * Math.sin(dtr(360 * Math.random())),
    y: diff * Math.sin(dtr(360 * Math.random())),
    z: diff * Math.sin(dtr(360 * Math.random()))
  },
  out: null
});

export const initNebulaBackground = () => {
  if (typeof window === "undefined" || typeof document === "undefined") return () => {};

  const host = document.body;
  const appRoot = document.querySelector("#app");
  if (!host || !appRoot) return () => {};

  const old = document.querySelector(".nebula-canvas");
  if (old) old.remove();

  const canvas = document.createElement("canvas");
  canvas.className = "nebula-canvas";
  canvas.setAttribute("aria-hidden", "true");
  host.insertBefore(canvas, appRoot);

  const ctx = canvas.getContext("2d");
  if (!ctx) return () => {};

  const state = {
    width: 0,
    height: 0,
    dpr: 1,
    num: 200,
    vel: 0.04,
    lim: 360,
    diff: 200,
    toX: 0,
    toY: 0,
    rotObj: { x: 0, y: 0, z: 0 },
    objSz: { x: 0, y: 0, z: 0 },
    particles: [],
    calc: [],
    cam: null,
    trans: null,
    hueA: 210,
    hueB: 235,
    hueC: 195,
    night: false,
    profile: null,
    reduced: reduceMotionQuery.matches,
    raf: 0,
    running: true
  };

  const setupPalette = () => {
    const style = getComputedStyle(document.documentElement);
    state.night = document.documentElement.getAttribute(ATTRIBUTE_THEME) === "night";
    state.hueA = parseHue(style.getPropertyValue("--accent").trim(), 220);
    state.hueB = parseHue(style.getPropertyValue("--accent-2").trim(), 200);
    state.hueC = parseHue(style.getPropertyValue("--sky").trim(), 195);

    state.profile = state.night
      ? {
          h1Shift: 12,
          h2Shift: -16,
          h3Shift: 8,
          sat1: 94,
          sat2: 92,
          sat3: 86,
          lit1: 58,
          lit2: 47,
          lit3: 44,
          a1: 1,
          a2: 0.68,
          a3: 0.42
        }
      : {
          h1Shift: -12,
          h2Shift: 10,
          h3Shift: -24,
          sat1: 92,
          sat2: 86,
          sat3: 82,
          lit1: 66,
          lit2: 58,
          lit3: 52,
          a1: 1,
          a2: 0.72,
          a3: 0.44
        };
  };

  const colorStops = (idx, time = 0) => {
    const p = state.profile;
    const dayHueStep = state.night ? 0.72 : 3.2;
    const drift = state.night ? 0 : (time * 0.006) % 360;
    const h1 = (state.hueA + p.h1Shift + idx * dayHueStep + drift + 360) % 360;
    const h2 = (state.hueB + p.h2Shift + idx * (dayHueStep * 0.76) + drift * 0.8 + 360) % 360;
    const h3 = (state.hueC + p.h3Shift + idx * (dayHueStep * 0.54) + drift * 0.6 + 360) % 360;
    return {
      c0: "hsla(0, 0%, 100%, 1)",
      c1: `hsla(${h1}, ${p.sat1}%, ${p.lit1}%, ${p.a1})`,
      c2: `hsla(${h2}, ${p.sat2}%, ${p.lit2}%, ${p.a2})`,
      c3: `hsla(${h3}, ${p.sat3}%, ${p.lit3}%, ${p.a3})`,
      ring: `hsla(${h1}, 92%, 64%, ${state.night ? 0.3 : 0.46})`,
      shine: `hsla(0, 0%, 100%, ${state.night ? 0.22 : 0.42})`
    };
  };

  const addParticle = () => {
    state.particles.push(createParticle(state.diff));
    state.calc.push({
      x: 360 * Math.random(),
      y: 360 * Math.random(),
      z: 360 * Math.random()
    });
  };

  const resetParticles = () => {
    state.particles = [];
    state.calc = [];
    for (let i = 0; i < state.num; i += 1) addParticle();
  };

  const resize = () => {
    state.width = window.innerWidth;
    state.height = window.innerHeight;
    state.dpr = clamp(window.devicePixelRatio || 1, 1, MAX_DPR);

    canvas.width = Math.round(state.width * state.dpr);
    canvas.height = Math.round(state.height * state.dpr);
    canvas.style.width = `${state.width}px`;
    canvas.style.height = `${state.height}px`;

    ctx.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);

    state.diff = clamp(Math.min(state.width, state.height) * 0.18, 130, 220);
    state.objSz = {
      x: state.width / 5,
      y: state.height / 5,
      z: state.width / 5
    };

    if (!state.cam) {
      state.cam = createCam(state.width, state.height);
      state.trans = buildTransform(state.cam);
    }

    state.cam.disp.x = state.width / 2;
    state.cam.disp.y = state.height / 2;

    resetParticles();
  };

  const update = () => {
    state.cam.obj.x += (state.toX - state.cam.obj.x) * 0.05;
    state.cam.obj.y += (state.toY - state.cam.obj.y) * 0.05;
  };

  const draw = () => {
    ctx.clearRect(0, 0, state.width, state.height);
    state.cam.upd();
    const now = performance.now();

    state.rotObj.x += 0.1;
    state.rotObj.y += 0.1;
    state.rotObj.z += 0.1;

    for (let i = 0; i < state.particles.length; i += 1) {
      for (const axis of ["x", "y", "z"]) {
        state.calc[i][axis] += state.vel;
        if (state.calc[i][axis] > state.lim) state.calc[i][axis] = 0;
      }

      state.particles[i].pos = {
        x: state.diff * Math.cos(dtr(state.calc[i].x)),
        y: state.diff * Math.sin(dtr(state.calc[i].y)),
        z: state.diff * Math.sin(dtr(state.calc[i].z))
      };

      state.particles[i].rot = state.rotObj;
      state.particles[i].sz = state.objSz;
      state.particles[i].out = state.trans.steps(
        state.particles[i].vtx,
        state.particles[i].sz,
        state.particles[i].rot,
        state.particles[i].pos,
        state.cam.disp
      );

      const out = state.particles[i].out;
      if (!out || out.p <= 0) continue;

      const r = out.p * 2;
      const gradient = ctx.createRadialGradient(out.x, out.y, out.p, out.x, out.y, r);
      const c = colorStops(i, now);
      gradient.addColorStop(0, c.c0);
      gradient.addColorStop(0.52, c.c1);
      gradient.addColorStop(0.82, c.c2);
      gradient.addColorStop(1, c.c3);

      ctx.globalCompositeOperation = "lighter";
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(out.x, out.y, r, 0, Math.PI * 2, false);
      ctx.fill();
      ctx.closePath();

      if (!state.night && r > 0.75) {
        ctx.globalCompositeOperation = "source-over";
        ctx.strokeStyle = c.ring;
        ctx.lineWidth = Math.max(0.45, out.p * 0.22);
        ctx.beginPath();
        ctx.arc(out.x, out.y, r * 0.96, 0, Math.PI * 2, false);
        ctx.stroke();
        ctx.closePath();

        ctx.fillStyle = c.shine;
        ctx.beginPath();
        ctx.arc(out.x - r * 0.26, out.y - r * 0.26, Math.max(0.18, r * 0.18), 0, Math.PI * 2, false);
        ctx.fill();
        ctx.closePath();
      }
    }
  };

  const frame = () => {
    if (!state.running) return;
    update();
    draw();
    if (!state.reduced) {
      state.raf = window.requestAnimationFrame(frame);
    }
  };

  const start = () => {
    if (state.reduced) {
      update();
      draw();
      return;
    }
    state.raf = window.requestAnimationFrame(frame);
  };

  const onPointerMove = (event) => {
    state.toX = (event.clientX - state.width / 2) * -0.8;
    state.toY = (event.clientY - state.height / 2) * 0.8;
  };

  const onTouchMove = (event) => {
    if (!event.touches || !event.touches[0]) return;
    const touch = event.touches[0];
    state.toX = (touch.clientX - state.width / 2) * -0.8;
    state.toY = (touch.clientY - state.height / 2) * 0.8;
  };

  const onBurst = () => {
    const growBy = state.reduced ? 24 : 100;
    for (let i = 0; i < growBy; i += 1) addParticle();
    const cap = state.reduced ? 260 : 420;
    if (state.particles.length > cap) {
      const trim = state.particles.length - cap;
      state.particles.splice(0, trim);
      state.calc.splice(0, trim);
    }
  };

  const onThemeMutate = () => {
    setupPalette();
    draw();
  };

  const onReduceMotionChange = () => {
    state.reduced = reduceMotionQuery.matches;
    if (state.raf) {
      window.cancelAnimationFrame(state.raf);
      state.raf = 0;
    }
    start();
  };

  const onVisibility = () => {
    const visible = document.visibilityState === "visible";
    if (visible && !state.running) {
      state.running = true;
      start();
      return;
    }
    if (!visible && state.running) {
      state.running = false;
      if (state.raf) {
        window.cancelAnimationFrame(state.raf);
        state.raf = 0;
      }
    }
  };

  const onResize = () => {
    resize();
    draw();
  };

  const themeObserver = new MutationObserver(onThemeMutate);
  themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: [ATTRIBUTE_THEME] });

  setupPalette();
  resize();
  draw();
  start();

  window.addEventListener("pointermove", onPointerMove, { passive: true });
  window.addEventListener("touchmove", onTouchMove, { passive: true });
  window.addEventListener("mousedown", onBurst);
  window.addEventListener("touchstart", onBurst, { passive: true });
  window.addEventListener("resize", onResize, { passive: true });
  document.addEventListener("visibilitychange", onVisibility);

  if (typeof reduceMotionQuery.addEventListener === "function") {
    reduceMotionQuery.addEventListener("change", onReduceMotionChange);
  } else if (typeof reduceMotionQuery.addListener === "function") {
    reduceMotionQuery.addListener(onReduceMotionChange);
  }

  return () => {
    state.running = false;
    if (state.raf) {
      window.cancelAnimationFrame(state.raf);
      state.raf = 0;
    }

    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("touchmove", onTouchMove);
    window.removeEventListener("mousedown", onBurst);
    window.removeEventListener("touchstart", onBurst);
    window.removeEventListener("resize", onResize);
    document.removeEventListener("visibilitychange", onVisibility);

    if (typeof reduceMotionQuery.removeEventListener === "function") {
      reduceMotionQuery.removeEventListener("change", onReduceMotionChange);
    } else if (typeof reduceMotionQuery.removeListener === "function") {
      reduceMotionQuery.removeListener(onReduceMotionChange);
    }

    themeObserver.disconnect();
    canvas.remove();
  };
};
