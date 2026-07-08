// fallback.js
// Deterministic local code generator used only when Hy3 isn't reachable
// yet (no API key configured, or a network error) so the UI is fully
// demoable without the live model.

function generateFallbackCode(board, selectedIds, assign, catalog) {
  const includes = new Set(["#include <Arduino.h>"]);
  const setupLines = [];
  const loopLines = [];
  const serialLines = ["Booting...", "Board: " + assign.boardLabel];
  let i2cInitialized = false;

  for (const id of selectedIds) {
    const mod = catalog.find(function (m) { return m.id === id; });
    const info = assign.assignments[id];
    if (!mod || !info) continue;

    if (info.type === "i2c") {
      includes.add("#include <Wire.h>");
      if (!i2cInitialized) {
        setupLines.push("  Wire.begin(" + assign.bus.i2c.sda + ", " + assign.bus.i2c.scl + "); // shared I2C bus");
        i2cInitialized = true;
      }
      serialLines.push(mod.name + " ready on I2C.");
    } else if (info.type === "camera") {
      includes.add('#include "esp_camera.h"');
      setupLines.push("  // camera_config_t initialized with AI-Thinker pin map, then esp_camera_init(&config);");
      serialLines.push("Camera initialized.");
    } else if (info.type === "analog-in") {
      serialLines.push(mod.name + " reading: " + (Math.random() * 100).toFixed(1));
      loopLines.push("  int " + id + "Value = analogRead(" + info.pins.SIG + "); // " + mod.name);
    } else if (info.type === "digital-multi") {
      const pinsStr = Object.entries(info.pins).map(function (kv) { return kv[0] + "=" + kv[1]; }).join(", ");
      serialLines.push(mod.name + " pins: " + pinsStr);
    } else {
      const mode = info.type === "digital-in" ? "INPUT" : "OUTPUT";
      setupLines.push("  pinMode(" + info.pins.SIG + ", " + mode + "); // " + mod.name);
      serialLines.push(mod.name + " on GPIO" + info.pins.SIG + " ready.");
    }
  }

  const code = [
    ...includes,
    "",
    "void setup() {",
    "  Serial.begin(115200);",
    ...setupLines,
    "}",
    "",
    "void loop() {",
    ...(loopLines.length ? loopLines : ["  // TODO: add behavior once Hy3 is connected"]),
    "  delay(1000);",
    "}",
  ].join("\n");

  return { code, serialLines };
}

if (typeof module !== "undefined") {
  module.exports = { generateFallbackCode };
}
if (typeof window !== "undefined") {
  window.generateFallbackCode = generateFallbackCode;
}