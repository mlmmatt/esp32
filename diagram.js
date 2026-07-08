// diagram.js
// Renders a schematic-style SVG wiring diagram purely from the pin
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
const TOP_MARGIN = 70;
const BOARD_X = 380;
const BOARD_W = 220;
const LABEL_BOX_W = 190;
const COLORS = {
  used: "var(--diagram-accent, #22c55e)",
  unused: "var(--diagram-muted, #6b7280)",
  bus: "var(--diagram-bus, #38bdf8)",
  text: "var(--diagram-text, #e5e7eb)",
  boardFill: "var(--diagram-board, #111827)",
};

function esc(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function renderDiagramSVG(boardId, catalog, assignResult) {
  const layout = PIN_LAYOUTS[boardId];
  const rows = Math.max(layout.left.length, layout.right.length);
  const height = TOP_MARGIN + rows * ROW_H + 60;
  const width = 1000;

  // Build gpio -> [{moduleId, roleLabel}] lookup from the assignment result.
  const gpioToModules = {};
  const i2cModules = [];
  for (const [modId, info] of Object.entries(assignResult.assignments)) {
    const mod = catalog.find((m) => m.id === modId);
    const modName = mod ? mod.name : modId;
    if (info.type === "i2c") {
      i2cModules.push(modName);
      continue;
    }
    if (info.type === "camera") continue; // fixed internal bus, not drawn pin-by-pin
    for (const [pinName, gpio] of Object.entries(info.pins)) {
      if (!gpioToModules[gpio]) gpioToModules[gpio] = [];
      gpioToModules[gpio].push(`${modName} (${pinName})`);
    }
  }

  const parts = [];
  parts.push(
    `<svg viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" font-family="ui-monospace, monospace">`
  );
  parts.push(`<rect x="0" y="0" width="${width}" height="${height}" fill="none"/>`);
  parts.push(
    `<text x="${width / 2}" y="30" text-anchor="middle" font-size="18" fill="${COLORS.text}">${esc(
      layout.boardLabel
    )}</text>`
  );

  // Board body
  const boardTop = TOP_MARGIN - 10;
  const boardBottom = TOP_MARGIN + rows * ROW_H + 10;
  parts.push(
    `<rect x="${BOARD_X}" y="${boardTop}" width="${BOARD_W}" height="${boardBottom - boardTop}" rx="10" fill="${COLORS.boardFill}" stroke="${COLORS.text}" stroke-width="1.5"/>`
  );
  parts.push(
    `<text x="${BOARD_X + BOARD_W / 2}" y="${(boardTop + boardBottom) / 2}" text-anchor="middle" font-size="13" fill="${COLORS.text}" opacity="0.6">ESP32</text>`
  );

  function drawSide(pins, side) {
    const isLeft = side === "left";
    pins.forEach((pin, i) => {
      const y = TOP_MARGIN + i * ROW_H;
      const boardEdgeX = isLeft ? BOARD_X : BOARD_X + BOARD_W;
      const pinTipX = isLeft ? boardEdgeX - 30 : boardEdgeX + 30;
      const used = pin.gpio !== null && gpioToModules[pin.gpio];
      const color = used ? COLORS.used : COLORS.unused;

      parts.push(
        `<line x1="${boardEdgeX}" y1="${y}" x2="${pinTipX}" y2="${y}" stroke="${color}" stroke-width="2"/>`
      );
      parts.push(`<circle cx="${pinTipX}" cy="${y}" r="3" fill="${color}"/>`);

      const textX = isLeft ? pinTipX - 6 : pinTipX + 6;
      const anchor = isLeft ? "end" : "start";
      parts.push(
        `<text x="${textX}" y="${y + 4}" text-anchor="${anchor}" font-size="11" fill="${color}">${esc(pin.label)}</text>`
      );

      if (used) {
        const labelX = isLeft ? pinTipX - LABEL_BOX_W - 90 : pinTipX + 90;
        const modText = gpioToModules[pin.gpio].join(", ");
        parts.push(
          `<line x1="${textX + (isLeft ? -70 : 70)}" y1="${y}" x2="${isLeft ? labelX + LABEL_BOX_W : labelX}" y2="${y}" stroke="${color}" stroke-width="1" stroke-dasharray="3,2"/>`
        );
        parts.push(
          `<rect x="${labelX}" y="${y - 12}" width="${LABEL_BOX_W}" height="24" rx="5" fill="${COLORS.boardFill}" stroke="${color}" stroke-width="1.5"/>`
        );
        parts.push(
          `<text x="${labelX + LABEL_BOX_W / 2}" y="${y + 4}" text-anchor="middle" font-size="11" fill="${COLORS.text}">${esc(modText)}</text>`
        );
      }
    });
  }

  drawSide(layout.left, "left");
  if (layout.right.length) drawSide(layout.right, "right");

  // I2C bus, drawn as a trunk coming off the board bottom
  if (i2cModules.length) {
    const busY = boardBottom + 40;
    const busX1 = BOARD_X + BOARD_W * 0.3;
    const busX2 = BOARD_X + BOARD_W * 0.7;
    parts.push(`<line x1="${busX1}" y1="${boardBottom}" x2="${busX1}" y2="${busY}" stroke="${COLORS.bus}" stroke-width="2"/>`);
    parts.push(`<line x1="${busX2}" y1="${boardBottom}" x2="${busX2}" y2="${busY}" stroke="${COLORS.bus}" stroke-width="2"/>`);
    parts.push(`<line x1="${busX1}" y1="${busY}" x2="${busX2}" y2="${busY}" stroke="${COLORS.bus}" stroke-width="2"/>`);
    const boxW = 260;
    const boxX = BOARD_X + BOARD_W / 2 - boxW / 2;
    parts.push(
      `<rect x="${boxX}" y="${busY + 10}" width="${boxW}" height="${20 + i2cModules.length * 16}" rx="6" fill="${COLORS.boardFill}" stroke="${COLORS.bus}" stroke-width="1.5"/>`
    );
    parts.push(
      `<text x="${boxX + boxW / 2}" y="${busY + 25}" text-anchor="middle" font-size="11" fill="${COLORS.bus}">I2C bus (SDA/SCL shared)</text>`
    );
    i2cModules.forEach((name, i) => {
      parts.push(
        `<text x="${boxX + boxW / 2}" y="${busY + 42 + i * 16}" text-anchor="middle" font-size="11" fill="${COLORS.text}">${esc(name)}</text>`
      );
    });
  }

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