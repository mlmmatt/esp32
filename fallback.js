// fallback.js
// Deterministic local code generator used only when Hy3 isn't reachable
// yet (no API key configured, or a network error) so the UI is fully
// demoable without the live model.

function generateFallbackCode(board, selectedIds, assign, catalog) {
  const includes = new Set(["#include <Arduino.h>"]);
  const globals = [];
  const setupLines = [];
  const loopLines = [];
  const serialLines = ["Booting...", "Board: " + assign.boardLabel];
  let i2cInitialized = false;
  let hasRainGauge = false;
  let hasAnemometer = false;

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
      loopLines.push("  int " + id + "Value = analogRead(" + info.pins.SIG + "); // " + mod.name);
      serialLines.push(mod.name + " reading: " + (Math.random() * 100).toFixed(1));
    } else if (info.type === "digital-multi") {
      const pinsStr = Object.entries(info.pins).map(function (kv) { return kv[0] + "=" + kv[1]; }).join(", ");
      serialLines.push(mod.name + " pins: " + pinsStr);
    } else {
      const mode = info.type === "digital-in" ? "INPUT_PULLUP" : "OUTPUT";
      setupLines.push("  pinMode(" + info.pins.SIG + ", " + mode + "); // " + mod.name);

      if (id === "rain_gauge") {
        hasRainGauge = true;
        globals.push("const float MM_PER_TIP = 0.2794f;");
        globals.push("volatile unsigned long rainTips = 0;");
        globals.push("void IRAM_ATTR onRainTip() { rainTips++; }");
        setupLines.push("  attachInterrupt(digitalPinToInterrupt(" + info.pins.SIG + "), onRainTip, FALLING);");
        loopLines.push("  float rainfallMm = rainTips * MM_PER_TIP; // replace with your gauge constant if different");
        serialLines.push("Rain Gauge on GPIO" + info.pins.SIG + " counting bucket tips.");
      } else if (id === "anemometer") {
        hasAnemometer = true;
        globals.push("const float WIND_MPS_PER_HZ = 0.50f;");
        globals.push("volatile unsigned long windPulses = 0;");
        globals.push("void IRAM_ATTR onWindPulse() { windPulses++; }");
        setupLines.push("  attachInterrupt(digitalPinToInterrupt(" + info.pins.SIG + "), onWindPulse, FALLING);");
        loopLines.push("  float windSpeedMps = windPulses * WIND_MPS_PER_HZ; // placeholder calibration, tune for your sensor");
        serialLines.push("Anemometer on GPIO" + info.pins.SIG + " measuring wind pulses.");
      } else {
        serialLines.push(mod.name + " on GPIO" + info.pins.SIG + " ready.");
      }
    }
  }

  if (hasRainGauge) {
    loopLines.push('  Serial.print("Rain tips: ");');
    loopLines.push("  Serial.println(rainTips);");
    loopLines.push('  Serial.print("Rainfall total (mm): ");');
    loopLines.push("  Serial.println(rainfallMm, 2);");
    serialLines.push("Rain tips: 14");
    serialLines.push("Rainfall total: 3.91 mm");
  }

  if (hasAnemometer) {
    loopLines.push('  Serial.print("Wind pulses: ");');
    loopLines.push("  Serial.println(windPulses);");
    loopLines.push('  Serial.print("Wind speed (m/s): ");');
    loopLines.push("  Serial.println(windSpeedMps, 2);");
    serialLines.push("Wind pulses: 11");
    serialLines.push("Wind speed: 5.50 m/s");
  }

  const code = [
    ...includes,
    "",
    ...globals,
    ...(globals.length ? [""] : []),
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
