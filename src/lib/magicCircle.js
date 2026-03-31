const SVG_NS = "http://www.w3.org/2000/svg";
const MODE_IDLE = 0;
const MODE_HOVER = 1;
const MODE_UNSEALED = 2;
const BURST_MS = 820;

const createSvgNode = (name, attrs = {}) => {
  const node = document.createElementNS(SVG_NS, name);
  for (const [key, value] of Object.entries(attrs)) {
    node.setAttribute(key, String(value));
  }
  return node;
};

const clearChildren = (node) => {
  while (node.firstChild) {
    node.removeChild(node.firstChild);
  }
};

const tierClass = (index, tier0Count, tier1Count) => {
  if (index < tier0Count) return "arcane-tier-0";
  if (index < tier1Count) return "arcane-tier-1";
  return "arcane-tier-2";
};

const anglePoint = (index, count, radius) => {
  const angle = (Math.PI * 2 * index) / count - Math.PI / 2;
  return {
    angle,
    x: 300 + Math.cos(angle) * radius,
    y: 300 + Math.sin(angle) * radius
  };
};

const buildPolarMarks = (group, { count, radius, length, tier0Count, tier1Count, lineClass }) => {
  clearChildren(group);

  for (let i = 0; i < count; i += 1) {
    const { angle } = anglePoint(i, count, radius);
    const x1 = 300 + Math.cos(angle) * (radius - length);
    const y1 = 300 + Math.sin(angle) * (radius - length);
    const x2 = 300 + Math.cos(angle) * radius;
    const y2 = 300 + Math.sin(angle) * radius;

    const line = createSvgNode("line", {
      x1,
      y1,
      x2,
      y2
    });
    line.classList.add("polar-mark", lineClass, tierClass(i, tier0Count, tier1Count));
    line.style.setProperty("--idx", String(i));
    group.appendChild(line);
  }
};

const buildGrandRuneRing = (group, { count, radius, tier0Count, tier1Count }) => {
  clearChildren(group);

  for (let i = 0; i < count; i += 1) {
    const { x, y } = anglePoint(i, count, radius);
    const degree = (360 / count) * i;
    const node = createSvgNode("g", {
      transform: `translate(${x} ${y}) rotate(${degree})`
    });
    node.classList.add("rune-node", tierClass(i, tier0Count, tier1Count));
    node.style.setProperty("--idx", String(i));

    node.appendChild(
      createSvgNode("circle", {
        r: 16
      })
    );

    node.appendChild(
      createSvgNode("path", {
        d: "M -8 -11 L 0 -16 L 8 -11 L 11 0 L 0 14 L -11 0 Z"
      })
    );

    node.appendChild(
      createSvgNode("path", {
        d: "M -10 0 L 10 0 M 0 -10 L 0 10"
      })
    );

    node.appendChild(
      createSvgNode("path", {
        d: "M -5 -5 L 0 0 L 5 -5 M -5 5 L 0 0 L 5 5"
      })
    );

    group.appendChild(node);
  }
};

const buildConstellationRing = (group, { count, radius, tier0Count, tier1Count }) => {
  clearChildren(group);

  for (let i = 0; i < count; i += 1) {
    const p = anglePoint(i, count, radius);
    const p2 = {
      x: 300 + Math.cos(p.angle + 0.18) * (radius - 18),
      y: 300 + Math.sin(p.angle + 0.18) * (radius - 18)
    };

    const node = createSvgNode("g");
    node.classList.add("const-node", tierClass(i, tier0Count, tier1Count));
    node.style.setProperty("--idx", String(i));

    node.appendChild(
      createSvgNode("line", {
        x1: p.x,
        y1: p.y,
        x2: p2.x,
        y2: p2.y
      })
    );

    node.appendChild(
      createSvgNode("circle", {
        cx: p.x,
        cy: p.y,
        r: 3.4
      })
    );

    group.appendChild(node);
  }
};

const buildDiamondWeb = (group, radius) => {
  clearChildren(group);

  const points = Array.from({ length: 8 }, (_, i) => anglePoint(i, 8, radius));

  for (let i = 0; i < points.length; i += 1) {
    const p1 = points[i];
    const p2 = points[(i + 2) % points.length];
    group.appendChild(
      createSvgNode("line", {
        x1: p1.x,
        y1: p1.y,
        x2: p2.x,
        y2: p2.y
      })
    );
  }

  for (const p of points) {
    group.appendChild(
      createSvgNode("circle", {
        cx: p.x,
        cy: p.y,
        r: 3.2
      })
    );
  }
};

const buildArcBurst = (group, count) => {
  clearChildren(group);

  for (let i = 0; i < count; i += 1) {
    const arc = createSvgNode("g", {
      transform: `rotate(${i * 15} 300 300)`
    });
    arc.classList.add("arc");
    arc.style.setProperty("--idx", String(i));
    arc.appendChild(
      createSvgNode("path", {
        d: "M300 58 C 333 95 338 146 300 183 C 262 146 267 95 300 58 Z"
      })
    );
    group.appendChild(arc);
  }
};

export const initHeroMagicCircle = (selector = "[data-magic-circle]") => {
  const panel = document.querySelector(selector);
  if (!panel) return () => {};

  const outerMarks = panel.querySelector(".polar-marks-outer");
  const midMarks = panel.querySelector(".polar-marks-mid");
  const runeRing = panel.querySelector(".grand-rune-ring");
  const constellationRing = panel.querySelector(".constellation-ring");
  const diamondWeb = panel.querySelector(".diamond-web");
  const arcBurst = panel.querySelector(".arc-burst");

  if (!outerMarks || !midMarks || !runeRing || !constellationRing || !diamondWeb || !arcBurst) {
    return () => {};
  }

  buildPolarMarks(outerMarks, {
    count: 84,
    radius: 262,
    length: 24,
    tier0Count: 28,
    tier1Count: 54,
    lineClass: "polar-mark-outer"
  });

  buildPolarMarks(midMarks, {
    count: 48,
    radius: 198,
    length: 18,
    tier0Count: 18,
    tier1Count: 30,
    lineClass: "polar-mark-mid"
  });

  buildGrandRuneRing(runeRing, {
    count: 24,
    radius: 236,
    tier0Count: 10,
    tier1Count: 16
  });

  buildConstellationRing(constellationRing, {
    count: 30,
    radius: 292,
    tier0Count: 14,
    tier1Count: 22
  });

  buildDiamondWeb(diamondWeb, 150);
  buildArcBurst(arcBurst, 24);

  const state = {
    hovered: false,
    unsealed: false,
    burstTimer: 0
  };

  const setMode = () => {
    const mode = state.unsealed ? MODE_UNSEALED : state.hovered ? MODE_HOVER : MODE_IDLE;
    panel.dataset.mode = String(mode);
    panel.classList.toggle("is-hovered", mode === MODE_HOVER);
    panel.classList.toggle("is-unsealed", mode === MODE_UNSEALED);
  };

  const setMouse = (x, y) => {
    panel.style.setProperty("--mouse-x", x.toFixed(3));
    panel.style.setProperty("--mouse-y", y.toFixed(3));
  };

  const triggerBurst = () => {
    panel.classList.remove("is-burst");
    void panel.offsetWidth;
    panel.classList.add("is-burst");

    if (state.burstTimer) {
      window.clearTimeout(state.burstTimer);
    }

    state.burstTimer = window.setTimeout(() => {
      panel.classList.remove("is-burst");
      state.burstTimer = 0;
    }, BURST_MS);
  };

  const onEnter = () => {
    state.hovered = true;
    setMode();
  };

  const onLeave = () => {
    state.hovered = false;
    setMouse(0, 0);
    setMode();
  };

  const onMove = (event) => {
    const rect = panel.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width - 0.5;
    const y = (event.clientY - rect.top) / rect.height - 0.5;
    setMouse(x, y);
  };

  const onToggle = () => {
    state.unsealed = !state.unsealed;
    setMode();
    triggerBurst();
  };

  panel.addEventListener("pointerenter", onEnter);
  panel.addEventListener("pointerleave", onLeave);
  panel.addEventListener("pointermove", onMove);
  panel.addEventListener("click", onToggle);

  setMouse(0, 0);
  setMode();

  return () => {
    panel.removeEventListener("pointerenter", onEnter);
    panel.removeEventListener("pointerleave", onLeave);
    panel.removeEventListener("pointermove", onMove);
    panel.removeEventListener("click", onToggle);
    if (state.burstTimer) {
      window.clearTimeout(state.burstTimer);
    }
  };
};
