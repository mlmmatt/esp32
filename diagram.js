// diagram.js
// Renders a more realistic SVG wiring diagram purely from the pin
// assignments produced by pinmap.js. No LLM involvement -- this is
// deterministic so the picture on screen always matches reality.

const PIN_LAYOUTS = {
  devkit: {
    boardLabel: "ESP32 DevKit (WROOM-32)",
    left: [
      { label: "EN", gpio: null },
      { label: "GPIO36 (VP)", gpio: 36 },
      { label: "GPIO39 (VN)", gpio: 39 },
      { label: "GPIO34", gpio: 34 },
      { label: "GPIO35", gpio: 35 },
      { label: "GPIO32", gpio: 32 },
      { label: "GPIO33", gpio: 33 },
      { label: "GPIO25", gpio: 25 },
      { label: "GPIO26", gpio: 26 },
      { label: "GPIO27", gpio: 27 },
      { label: "GPIO14", gpio: 14 },
      { label: "GPIO12", gpio: 12 },
      { label: "GND", gpio: null },
      { label: "GPIO13", gpio: 13 },
    ],
    right: [
      { label: "VIN (5V)", gpio: null },
      { label: "GND", gpio: null },
      { label: "GPIO23", gpio: 23 },
      { label: "GPIO22 (SCL)", gpio: 22 },
      { label: "GPIO1 (TX0)", gpio: 1 },
      { label: "GPIO3 (RX0)", gpio: 3 },
      { label: "GPIO21 (SDA)", gpio: 21 },
      { label: "GND", gpio: null },
      { label: "GPIO19", gpio: 19 },
      { label: "GPIO18", gpio: 18 },
      { label: "GPIO5", gpio: 5 },
      { label: "GPIO17", gpio: 17 },
      { label: "GPIO16", gpio: 16 },
      { label: "GPIO4", gpio: 4 },
      { label: "GPIO0", gpio: 0 },
      { label: "GPIO2", gpio: 2 },
      { label: "GPIO15", gpio: 15 },
      { label: "3V3", gpio: null },
    ],
  },
  cam: {
    boardLabel: "ESP32-CAM (AI-Thinker)",
    left: [
      { label: "5V", gpio: null },
      { label: "GND", gpio: null },
      { label: "GPIO12", gpio: 12 },
      { label: "GPIO13", gpio: 13 },
      { label: "GPIO15", gpio: 15 },
      { label: "GPIO14", gpio: 14 },
      { label: "GPIO2", gpio: 2 },
      { label: "GPIO4 (flash LED)", gpio: 4 },
      { label: "GPIO0", gpio: 0 },
      { label: "GPIO3 (U0R)", gpio: 3 },
      { label: "GPIO1 (U0T)", gpio: 1 },
      { label: "GND", gpio: null },
      { label: "3V3", gpio: null },
    ],
    right: [],
  },
};

const ROW_H = 32;
const TOP_MARGIN = 86;
const BOARD_X = 390;
const BOARD_W = 264;
const CARD_W = 220;
const CARD_H = 82;
const CARD_GAP = 10;
const SVG_W = 1180;
const COLORS = {
  used: "var(--diagram-accent, #22c55e)",
  unused: "var(--diagram-muted, #5b6473)",
  bus: "var(--diagram-bus, #38bdf8)",
  pulse: "var(--diagram-pulse, #f59e0b)",
  power: "var(--diagram-power, #f87171)",
  ground: "var(--diagram-ground, #94a3b8)",
  text: "var(--diagram-text, #e5e7eb)",
  boardFill: "var(--diagram-board, #111827)",
  boardDeep: "var(--diagram-board-deep, #0b1220)",
  card: "var(--diagram-card, #101827)",
  cardAlt: "var(--diagram-card-alt, #162033)",
  copper: "var(--diagram-copper, #f4b860)",
  silver: "var(--diagram-silver, #cbd5e1)",
};

function esc(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function sideColor(label, used) {
  if (/GND/.test(label)) return COLORS.ground;
  if (/3V3|5V|VIN/.test(label)) return COLORS.power;
  return used ? COLORS.used : COLORS.unused;
}

function moduleTheme(mod) {
  if (!mod) return { stroke: COLORS.used, accent: COLORS.used, icon: "generic" };
  if (mod.id === "rain_gauge") return { stroke: COLORS.pulse, accent: COLORS.pulse, icon: "rain" };
  if (mod.id === "anemometer") return { stroke: COLORS.pulse, accent: "#fb923c", icon: "wind" };
  if (mod.interface === "i2c") return { stroke: COLORS.bus, accent: COLORS.bus, icon: "display" };
  if (mod.id === "dht22") return { stroke: "#60a5fa", accent: "#60a5fa", icon: "sensor" };
  if (mod.id === "bmp280") return { stroke: COLORS.bus, accent: COLORS.bus, icon: "chip" };
  if (mod.id === "oled_ssd1306") return { stroke: COLORS.bus, accent: COLORS.bus, icon: "display" };
  if (mod.id === "buzzer") return { stroke: "#a78bfa", accent: "#a78bfa", icon: "buzzer" };
  if (mod.category === "sensor") return { stroke: COLORS.used, accent: COLORS.used, icon: "sensor" };
  return { stroke: COLORS.used, accent: COLORS.used, icon: "generic" };
}

function moduleDetailText(mod) {
  if (!mod) return "Deterministic module assignment";
  if (mod.id === "rain_gauge") return "Tipping bucket pulse input";
  if (mod.id === "anemometer") return "Pulse output for wind speed";
  if (mod.id === "dht22") return "Single-wire temp / humidity sensor";
  if (mod.id === "bmp280") return "Shared I²C pressure sensor";
  if (mod.id === "oled_ssd1306") return "Shared I²C 128×64 display";
  if (mod.id === "buzzer") return "PWM alert output";
  return mod.tutorSummary || mod.notes || "Deterministic module assignment";
}

function renderModuleIcon(icon, x, y, accent) {
  if (icon === "rain") {
    return [
      `<rect x="${x + 8}" y="${y + 22}" width="26" height="18" rx="4" fill="#18314d" stroke="${accent}" stroke-width="1.5"/>`,
      `<path d="M ${x + 21} ${y + 22} L ${x + 15} ${y + 13} H ${x + 27} Z" fill="#24476d" stroke="${accent}" stroke-width="1"/>`,
      `<path d="M ${x + 42} ${y + 16} C ${x + 45} ${y + 10}, ${x + 49} ${y + 10}, ${x + 52} ${y + 16} C ${x + 52} ${y + 21}, ${x + 47} ${y + 24}, ${x + 42} ${y + 16} Z" fill="${accent}" opacity="0.95"/>`,
      `<path d="M ${x + 53} ${y + 29} C ${x + 56} ${y + 23}, ${x + 60} ${y + 23}, ${x + 63} ${y + 29} C ${x + 63} ${y + 34}, ${x + 58} ${y + 37}, ${x + 53} ${y + 29} Z" fill="${accent}" opacity="0.82"/>`,
    ].join("");
  }

  if (icon === "wind") {
    return [
      `<line x1="${x + 18}" y1="${y + 42}" x2="${x + 18}" y2="${y + 18}" stroke="${accent}" stroke-width="2.6"/>`,
      `<circle cx="${x + 18}" cy="${y + 18}" r="4" fill="${accent}"/>`,
      `<line x1="${x + 18}" y1="${y + 18}" x2="${x + 33}" y2="${y + 11}" stroke="${accent}" stroke-width="1.8"/>`,
      `<line x1="${x + 18}" y1="${y + 18}" x2="${x + 6}" y2="${y + 7}" stroke="${accent}" stroke-width="1.8"/>`,
      `<line x1="${x + 18}" y1="${y + 18}" x2="${x + 17}" y2="${y + 1}" stroke="${accent}" stroke-width="1.8"/>`,
      `<circle cx="${x + 36}" cy="${y + 10}" r="5" fill="#203048" stroke="${accent}" stroke-width="1.5"/>`,
      `<circle cx="${x + 4}" cy="${y + 5}" r="5" fill="#203048" stroke="${accent}" stroke-width="1.5"/>`,
      `<circle cx="${x + 17}" cy="${y - 2}" r="5" fill="#203048" stroke="${accent}" stroke-width="1.5"/>`,
      `<path d="M ${x + 44} ${y + 34} C ${x + 54} ${y + 27}, ${x + 64} ${y + 27}, ${x + 74} ${y + 34}" fill="none" stroke="#7dd3fc" stroke-width="2" opacity="0.8"/>`,
      `<path d="M ${x + 42} ${y + 43} C ${x + 53} ${y + 37}, ${x + 66} ${y + 37}, ${x + 76} ${y + 43}" fill="none" stroke="#7dd3fc" stroke-width="2" opacity="0.55"/>`,
    ].join("");
  }

  if (icon === "display") {
    return [
      `<rect x="${x + 6}" y="${y + 10}" width="54" height="34" rx="5" fill="#071522" stroke="${accent}" stroke-width="1.6"/>`,
      `<rect x="${x + 12}" y="${y + 16}" width="42" height="22" rx="2" fill="#0a2435" opacity="0.95"/>`,
      `<circle cx="${x + 64}" cy="${y + 16}" r="2.3" fill="${accent}"/>`,
      `<circle cx="${x + 64}" cy="${y + 24}" r="2.3" fill="${accent}" opacity="0.8"/>`,
      `<circle cx="${x + 64}" cy="${y + 32}" r="2.3" fill="${accent}" opacity="0.65"/>`,
    ].join("");
  }

  if (icon === "buzzer") {
    return [
      `<circle cx="${x + 24}" cy="${y + 28}" r="15" fill="#221435" stroke="${accent}" stroke-width="1.8"/>`,
      `<circle cx="${x + 24}" cy="${y + 28}" r="4" fill="${accent}" opacity="0.75"/>`,
      `<path d="M ${x + 46} ${y + 19} Q ${x + 54} ${y + 28} ${x + 46} ${y + 37}" fill="none" stroke="${accent}" stroke-width="2" opacity="0.8"/>`,
      `<path d="M ${x + 54} ${y + 15} Q ${x + 66} ${y + 28} ${x + 54} ${y + 41}" fill="none" stroke="${accent}" stroke-width="2" opacity="0.5"/>`,
    ].join("");
  }

  if (icon === "chip") {
    return [
      `<rect x="${x + 10}" y="${y + 12}" width="42" height="28" rx="4" fill="#17263a" stroke="${accent}" stroke-width="1.6"/>`,
      ...Array.from({ length: 5 }, (_, i) => `<line x1="${x + 12 + i * 8}" y1="${y + 8}" x2="${x + 12 + i * 8}" y2="${y + 12}" stroke="${COLORS.silver}" stroke-width="1.1"/>`),
      ...Array.from({ length: 5 }, (_, i) => `<line x1="${x + 12 + i * 8}" y1="${y + 40}" x2="${x + 12 + i * 8}" y2="${y + 44}" stroke="${COLORS.silver}" stroke-width="1.1"/>`),
    ].join("");
  }

  if (icon === "sensor") {
    return [
      `<rect x="${x + 10}" y="${y + 8}" width="34" height="42" rx="5" fill="#163047" stroke="${accent}" stroke-width="1.5"/>`,
      `<circle cx="${x + 27}" cy="${y + 20}" r="4" fill="${accent}" opacity="0.8"/>`,
      `<line x1="${x + 18}" y1="${y + 34}" x2="${x + 36}" y2="${y + 34}" stroke="${accent}" stroke-width="1.4" opacity="0.7"/>`,
      `<line x1="${x + 18}" y1="${y + 40}" x2="${x + 36}" y2="${y + 40}" stroke="${accent}" stroke-width="1.4" opacity="0.5"/>`,
      `<line x1="${x + 18}" y1="${y + 46}" x2="${x + 36}" y2="${y + 46}" stroke="${accent}" stroke-width="1.4" opacity="0.35"/>`,
    ].join("");
  }

  return [
    `<rect x="${x + 10}" y="${y + 14}" width="42" height="26" rx="6" fill="#1a2638" stroke="${accent}" stroke-width="1.6"/>`,
    `<circle cx="${x + 31}" cy="${y + 27}" r="5" fill="${accent}" opacity="0.75"/>`,
  ].join("");
}

function layoutCards(items, minY, maxY) {
  const sorted = items.slice().sort((a, b) => a.anchorY - b.anchorY);
  const out = [];
  let nextY = minY;
  for (const item of sorted) {
    const desired = item.anchorY - CARD_H / 2;
    const y = Math.max(nextY, Math.min(desired, maxY - CARD_H));
    out.push({ ...item, cardY: y });
    nextY = y + CARD_H + CARD_GAP;
  }
  for (let i = out.length - 2; i >= 0; i--) {
    const limit = out[i + 1].cardY - CARD_H - CARD_GAP;
    if (out[i].cardY > limit) out[i].cardY = Math.max(minY, limit);
  }
  return out;
}

function renderBoardArt(parts, boardTop, boardBottom, boardLabel, rows, boardId) {
  const boardH = boardBottom - boardTop;
  const centerX = BOARD_X + BOARD_W / 2;
  parts.push(`<defs>
    <linearGradient id="boardShell" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#182335"/>
      <stop offset="55%" stop-color="${COLORS.boardFill}"/>
      <stop offset="100%" stop-color="${COLORS.boardDeep}"/>
    </linearGradient>
    <linearGradient id="moduleCard" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${COLORS.cardAlt}"/>
      <stop offset="100%" stop-color="${COLORS.card}"/>
    </linearGradient>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="8" stdDeviation="10" flood-color="#020617" flood-opacity="0.45"/>
    </filter>
  </defs>`);

  parts.push(`<rect x="${BOARD_X}" y="${boardTop}" width="${BOARD_W}" height="${boardH}" rx="18" fill="url(#boardShell)" stroke="#334155" stroke-width="1.6" filter="url(#shadow)"/>`);
  parts.push(`<rect x="${BOARD_X + 80}" y="${boardTop + 14}" width="${BOARD_W - 160}" height="26" rx="8" fill="#0b1220" stroke="#3b4b63" stroke-width="1"/>`);
  parts.push(`<text x="${centerX}" y="${boardTop + 31}" text-anchor="middle" font-size="11" font-weight="600" letter-spacing="1.3" fill="#cbd5e1">${esc(boardLabel)}</text>`);

  if (boardId === "devkit") {
    parts.push(`<rect x="${centerX - 42}" y="${boardTop - 16}" width="84" height="28" rx="8" fill="#cbd5e1" stroke="#94a3b8" stroke-width="1.2"/>`);
    parts.push(`<rect x="${centerX - 18}" y="${boardTop - 8}" width="36" height="10" rx="3" fill="#64748b"/>`);
    parts.push(`<rect x="${BOARD_X + 76}" y="${boardTop + 58}" width="${BOARD_W - 152}" height="70" rx="8" fill="#101b2d" stroke="#314156" stroke-width="1.2"/>`);
    parts.push(`<rect x="${BOARD_X + 96}" y="${boardTop + 70}" width="${BOARD_W - 192}" height="44" rx="4" fill="#0f172a" stroke="#475569" stroke-width="1"/>`);
    parts.push(`<text x="${centerX}" y="${boardTop + 97}" text-anchor="middle" font-size="12" fill="#9ca3af">ESP-WROOM-32</text>`);
    parts.push(`<rect x="${BOARD_X + 36}" y="${boardTop + 56}" width="24" height="30" rx="4" fill="#1e293b" stroke="#475569" stroke-width="1"/>`);
    parts.push(`<circle cx="${BOARD_X + 48}" cy="${boardTop + 71}" r="6" fill="#475569"/>`);
    parts.push(`<text x="${BOARD_X + 48}" y="${boardTop + 75}" text-anchor="middle" font-size="8" fill="#cbd5e1">EN</text>`);
  } else {
    parts.push(`<rect x="${BOARD_X + 56}" y="${boardTop + 54}" width="${BOARD_W - 112}" height="94" rx="8" fill="#0f172a" stroke="#334155" stroke-width="1.2"/>`);
    parts.push(`<rect x="${BOARD_X + 94}" y="${boardTop + 66}" width="${BOARD_W - 188}" height="50" rx="5" fill="#111827" stroke="#475569" stroke-width="1"/>`);
    parts.push(`<circle cx="${centerX}" cy="${boardTop + 134}" r="28" fill="#0b1220" stroke="#475569" stroke-width="1.1"/>`);
    parts.push(`<text x="${centerX}" y="${boardTop + 139}" text-anchor="middle" font-size="9" fill="#cbd5e1">CAM</text>`);
  }

  const headerYStart = TOP_MARGIN;
  const headerYEnd = headerYStart + (rows - 1) * ROW_H;
  parts.push(`<line x1="${BOARD_X + 20}" y1="${headerYStart}" x2="${BOARD_X + 20}" y2="${headerYEnd}" stroke="#374151" stroke-width="8" stroke-linecap="round"/>`);
  parts.push(`<line x1="${BOARD_X + BOARD_W - 20}" y1="${headerYStart}" x2="${BOARD_X + BOARD_W - 20}" y2="${headerYEnd}" stroke="#374151" stroke-width="8" stroke-linecap="round"/>`);

  [
    [BOARD_X + 18, boardTop + 18],
    [BOARD_X + BOARD_W - 18, boardTop + 18],
    [BOARD_X + 18, boardBottom - 18],
    [BOARD_X + BOARD_W - 18, boardBottom - 18],
  ].forEach(([x, y]) => {
    parts.push(`<circle cx="${x}" cy="${y}" r="4.2" fill="#020617" stroke="#475569" stroke-width="1"/>`);
  });
}

function renderDiagramSVG(boardId, catalog, assignResult) {
  const layout = PIN_LAYOUTS[boardId];
  const rows = Math.max(layout.left.length, layout.right.length);
  const boardTop = TOP_MARGIN - 18;
  const boardBottom = TOP_MARGIN + rows * ROW_H + 14;
  const legendY = boardBottom + 116;
  const height = legendY + 58;

  const gpioMeta = {};
  layout.left.forEach((pin, i) => {
    if (pin.gpio !== null) gpioMeta[pin.gpio] = { side: "left", row: i, label: pin.label };
  });
  layout.right.forEach((pin, i) => {
    if (pin.gpio !== null) gpioMeta[pin.gpio] = { side: "right", row: i, label: pin.label };
  });

  const gpioToModules = {};
  const i2cModules = [];
  const moduleCards = [];

  for (const [modId, info] of Object.entries(assignResult.assignments)) {
    const mod = catalog.find((m) => m.id === modId);
    const modName = mod ? mod.name : modId;
    if (info.type === "i2c") {
      i2cModules.push(mod);
      continue;
    }
    if (info.type === "camera") continue;

    for (const [pinName, gpio] of Object.entries(info.pins)) {
      if (!gpioToModules[gpio]) gpioToModules[gpio] = [];
      gpioToModules[gpio].push(`${modName} (${pinName})`);
    }

    const firstPinEntry = Object.entries(info.pins)[0];
    if (!firstPinEntry) continue;
    const [pinName, gpio] = firstPinEntry;
    const meta = gpioMeta[gpio];
    if (!meta) continue;
    moduleCards.push({
      modId,
      mod,
      info,
      name: modName,
      roleLabel: pinName,
      gpio,
      side: meta.side,
      pinLabel: meta.label,
      anchorY: TOP_MARGIN + meta.row * ROW_H,
      theme: moduleTheme(mod),
    });
  }

  const leftCards = layoutCards(moduleCards.filter((m) => m.side === "left"), boardTop + 28, boardBottom - 28);
  const rightCards = layoutCards(moduleCards.filter((m) => m.side === "right"), boardTop + 28, boardBottom - 28);

  const parts = [];
  parts.push(`<svg viewBox="0 0 ${SVG_W} ${height}" xmlns="http://www.w3.org/2000/svg" font-family="Inter, system-ui, sans-serif">`);
  parts.push(`<rect x="0" y="0" width="${SVG_W}" height="${height}" fill="none"/>`);
  parts.push(`<text x="${SVG_W / 2}" y="34" text-anchor="middle" font-size="21" font-weight="700" fill="${COLORS.text}">${esc(layout.boardLabel)}</text>`);
  parts.push(`<text x="${SVG_W / 2}" y="56" text-anchor="middle" font-size="12" fill="#94a3b8">Deterministic wiring plan — board pins and module cards stay grounded to the real allocation.</text>`);

  renderBoardArt(parts, boardTop, boardBottom, layout.boardLabel, rows, boardId);

  function drawSidePins(pins, side) {
    const isLeft = side === "left";
    pins.forEach((pin, i) => {
      const y = TOP_MARGIN + i * ROW_H;
      const boardEdgeX = isLeft ? BOARD_X : BOARD_X + BOARD_W;
      const padX = isLeft ? BOARD_X + 20 : BOARD_X + BOARD_W - 20;
      const pinTipX = isLeft ? boardEdgeX - 32 : boardEdgeX + 32;
      const used = pin.gpio !== null && gpioToModules[pin.gpio];
      const color = sideColor(pin.label, used);

      parts.push(`<circle cx="${padX}" cy="${y}" r="3.2" fill="${used ? COLORS.copper : "#6b7280"}" stroke="#0f172a" stroke-width="1"/>`);
      parts.push(`<line x1="${boardEdgeX}" y1="${y}" x2="${pinTipX}" y2="${y}" stroke="${color}" stroke-width="${used ? 2.8 : 1.8}" opacity="${used ? 1 : 0.72}"/>`);
      parts.push(`<circle cx="${pinTipX}" cy="${y}" r="4.2" fill="${color}" opacity="${used ? 1 : 0.65}"/>`);
      const textX = isLeft ? pinTipX - 10 : pinTipX + 10;
      parts.push(`<text x="${textX}" y="${y + 4}" text-anchor="${isLeft ? "end" : "start"}" font-size="11.5" fill="${color}" font-weight="${used ? 600 : 500}">${esc(pin.label)}</text>`);
    });
  }

  function drawModuleCards(items, side) {
    const isLeft = side === "left";
    items.forEach((item) => {
      const cardX = isLeft ? 72 : SVG_W - 72 - CARD_W;
      const cardY = item.cardY;
      const cardCenterY = cardY + CARD_H / 2;
      const pinX = isLeft ? BOARD_X - 32 : BOARD_X + BOARD_W + 32;
      const cardJoinX = isLeft ? cardX + CARD_W : cardX;
      const midX = isLeft ? cardJoinX + 32 : cardJoinX - 32;
      const connectorX = isLeft ? cardX + CARD_W - 12 : cardX + 12;
      const pinBadgeX = isLeft ? cardX + CARD_W - 76 : cardX + 18;
      const stroke = item.theme.stroke;
      const accent = item.theme.accent;

      parts.push(`<path d="M ${pinX} ${item.anchorY} C ${isLeft ? pinX - 36 : pinX + 36} ${item.anchorY}, ${isLeft ? midX + 16 : midX - 16} ${cardCenterY}, ${cardJoinX} ${cardCenterY}" fill="none" stroke="${stroke}" stroke-width="2.4" stroke-linecap="round"/>`);
      parts.push(`<circle cx="${cardJoinX}" cy="${cardCenterY}" r="5" fill="${stroke}"/>`);
      parts.push(`<rect x="${cardX}" y="${cardY}" width="${CARD_W}" height="${CARD_H}" rx="14" fill="url(#moduleCard)" stroke="${stroke}" stroke-width="1.8" filter="url(#shadow)"/>`);
      parts.push(`<rect x="${cardX + 8}" y="${cardY + 8}" width="${CARD_W - 16}" height="${CARD_H - 16}" rx="10" fill="#0d1726" opacity="0.55"/>`);
      parts.push(renderModuleIcon(item.theme.icon, cardX + 14, cardY + 10, accent));
      parts.push(`<text x="${cardX + 90}" y="${cardY + 28}" font-size="13" font-weight="700" fill="${COLORS.text}">${esc(item.name)}</text>`);
      parts.push(`<text x="${cardX + 90}" y="${cardY + 46}" font-size="11" fill="#a5b4c9">${esc(item.pinLabel)} • ${esc(item.roleLabel)}</text>`);
      parts.push(`<text x="${cardX + 90}" y="${cardY + 63}" font-size="11" fill="#93c5fd">${esc(moduleDetailText(item.mod))}</text>`);
      parts.push(`<rect x="${pinBadgeX}" y="${cardY + CARD_H - 24}" width="58" height="16" rx="8" fill="#142235" stroke="${stroke}" stroke-width="1"/>`);
      parts.push(`<text x="${pinBadgeX + 29}" y="${cardY + CARD_H - 12}" text-anchor="middle" font-size="10.5" font-weight="700" fill="${stroke}">GPIO ${item.gpio}</text>`);
      parts.push(`<circle cx="${connectorX}" cy="${cardCenterY}" r="4" fill="${stroke}"/>`);
    });
  }

  drawSidePins(layout.left, "left");
  if (layout.right.length) drawSidePins(layout.right, "right");
  drawModuleCards(leftCards, "left");
  drawModuleCards(rightCards, "right");

  if (i2cModules.length) {
    const busY = boardBottom + 30;
    const busX1 = BOARD_X + BOARD_W * 0.28;
    const busX2 = BOARD_X + BOARD_W * 0.72;
    const boxW = 340;
    const boxH = 44 + i2cModules.length * 24;
    const boxX = BOARD_X + BOARD_W / 2 - boxW / 2;

    parts.push(`<line x1="${busX1}" y1="${boardBottom}" x2="${busX1}" y2="${busY}" stroke="${COLORS.bus}" stroke-width="2.4"/>`);
    parts.push(`<line x1="${busX2}" y1="${boardBottom}" x2="${busX2}" y2="${busY}" stroke="${COLORS.bus}" stroke-width="2.4"/>`);
    parts.push(`<line x1="${busX1}" y1="${busY}" x2="${busX2}" y2="${busY}" stroke="${COLORS.bus}" stroke-width="3"/>`);
    parts.push(`<rect x="${boxX}" y="${busY + 18}" width="${boxW}" height="${boxH}" rx="14" fill="url(#moduleCard)" stroke="${COLORS.bus}" stroke-width="1.7" filter="url(#shadow)"/>`);
    parts.push(`<text x="${boxX + boxW / 2}" y="${busY + 41}" text-anchor="middle" font-size="12" font-weight="700" fill="${COLORS.bus}">Shared I²C bus on GPIO21 (SDA) and GPIO22 (SCL)</text>`);
    i2cModules.forEach((mod, i) => {
      const theme = moduleTheme(mod);
      const rowY = busY + 62 + i * 24;
      const leftDot = boxX + 24;
      parts.push(`<circle cx="${leftDot}" cy="${rowY - 4}" r="4" fill="${theme.stroke}"/>`);
      parts.push(`<text x="${leftDot + 16}" y="${rowY}" font-size="11.5" fill="${COLORS.text}">${esc(mod.name)}</text>`);
      parts.push(`<text x="${boxX + boxW - 18}" y="${rowY}" text-anchor="end" font-size="10.5" fill="#93c5fd">${esc(moduleDetailText(mod))}</text>`);
    });
  }

  const legendX = SVG_W / 2 - 250;
  parts.push(`<rect x="${legendX}" y="${legendY}" width="500" height="30" rx="15" fill="#0b1220" stroke="#233247" stroke-width="1"/>`);
  [
    [legendX + 20, COLORS.power, "Power"],
    [legendX + 120, COLORS.ground, "Ground"],
    [legendX + 225, COLORS.bus, "I²C"],
    [legendX + 300, COLORS.used, "Signal"],
    [legendX + 390, COLORS.pulse, "Pulse sensor"],
  ].forEach(([x, color, label]) => {
    parts.push(`<circle cx="${x}" cy="${legendY + 15}" r="5" fill="${color}"/>`);
    parts.push(`<text x="${x + 12}" y="${legendY + 19}" font-size="10.5" fill="${COLORS.text}">${esc(label)}</text>`);
  });

  parts.push(`</svg>`);
  return parts.join("\n");
}

if (typeof module !== "undefined") {
  module.exports = { renderDiagramSVG, PIN_LAYOUTS };
}

if (typeof window !== "undefined") {
  window.renderDiagramSVG = renderDiagramSVG;
  window.PIN_LAYOUTS = PIN_LAYOUTS;
}
