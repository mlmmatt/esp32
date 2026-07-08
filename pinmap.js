// pinmap.js
// Deterministic, hardcoded pin-safety layer. This never touches the LLM --
// it is the part of the app that must always be correct on camera.
//
// Board profiles encode real ESP32 hardware constraints:
//  - GPIO 0,2,15,12 are boot-strapping pins (avoid driving at boot)
//  - GPIO 1,3 are UART0 (used by the USB serial monitor, never reassign)
//  - GPIO 6-11 are wired to the internal SPI flash, never usable
//  - GPIO 34,35,36,39 are input-only (no internal pull-up/down, no output)
//  - GPIO 32-39 are ADC1 (safe to read with Wi-Fi active)
//  - GPIO 0,2,4,12,13,14,15,25,26,27 are ADC2 (Wi-Fi driver can starve these)
//  - Default I2C bus is SDA=21 / SCL=22

const BOARD_PROFILES = {
  devkit: {
    label: "ESP32 DevKit (WROOM-32)",
    i2c: { sda: 21, scl: 22 },
    generalPool: [4, 5, 13, 14, 16, 17, 18, 19, 23, 25, 26, 27],
    adcPool: [36, 39, 34, 35, 32, 33],
    reserved: [0, 1, 2, 3, 6, 7, 8, 9, 10, 11, 12, 15],
    supportsI2C: true,
  },
  cam: {
    label: "ESP32-CAM (AI-Thinker)",
    i2c: null,
    generalPool: [13, 14, 15, 2],
    adcPool: [13, 14, 15, 2],
    fallbackPool: [4, 12],
    reserved: [0, 1, 3, 5, 16, 18, 19, 21, 22, 23, 25, 26, 27, 32, 34, 35, 36, 39],
    supportsI2C: false,
  },
};

function assignPins(selectedModuleIds, boardId, catalog) {
  const board = BOARD_PROFILES[boardId];
  const result = {
    board: boardId,
    boardLabel: board.label,
    assignments: {},
    bus: {},
    warnings: [],
    errors: [],
  };

  const general = [...board.generalPool];
  const adc = [...board.adcPool];
  const fallback = board.fallbackPool ? [...board.fallbackPool] : [];
  let i2cClaimed = false;
  const usedPins = new Set();

  function takeFrom(pool, label) {
    while (pool.length) {
      const candidate = pool.shift();
      if (!usedPins.has(candidate)) {
        usedPins.add(candidate);
        return candidate;
      }
    }
    while (fallback.length) {
      const candidate = fallback.shift();
      if (!usedPins.has(candidate)) {
        usedPins.add(candidate);
        result.warnings.push(
          "Ran out of preferred pins for " + label + "; falling back to GPIO" + candidate + " (use with caution -- see board notes)."
        );
        return candidate;
      }
    }
    return null;
  }

  for (const modId of selectedModuleIds) {
    const mod = catalog.find(function (m) { return m.id === modId; });
    if (!mod) continue;

    if (!mod.boards.includes(boardId)) {
      result.errors.push(mod.name + " is not available on " + board.label + ".");
      continue;
    }

    if (mod.interface === "i2c") {
      if (!board.supportsI2C) {
        result.errors.push(mod.name + " needs I2C, which isn't broken out on " + board.label + ".");
        continue;
      }
      if (!i2cClaimed) {
        result.bus.i2c = board.i2c;
        i2cClaimed = true;
      }
      result.assignments[modId] = { type: "i2c", pins: { SDA: board.i2c.sda, SCL: board.i2c.scl } };
      continue;
    }

    if (mod.interface === "camera") {
      result.assignments[modId] = { type: "camera", pins: {}, notes: mod.notes };
      continue;
    }

    if (mod.interface === "analog-in") {
      const pin = takeFrom(adc, mod.name);
      if (pin === null) {
        result.errors.push("No free analog-capable pin left for " + mod.name + ".");
        continue;
      }
      result.assignments[modId] = { type: "analog-in", pins: { SIG: pin } };
      if (boardId === "cam") {
        result.warnings.push(
          mod.name + " on GPIO" + pin + " shares ADC2 with the Wi-Fi radio -- sample it right after boot, before Wi-Fi/camera streaming starts."
        );
      }
      continue;
    }

    if (mod.interface === "digital-multi") {
      const pins = {};
      let ok = true;
      for (const pinName of mod.pinNames) {
        const p = takeFrom(general, mod.name + " (" + pinName + ")");
        if (p === null) {
          ok = false;
          break;
        }
        pins[pinName] = p;
      }
      if (!ok) {
        result.errors.push("Not enough free pins left for " + mod.name + ".");
        continue;
      }
      result.assignments[modId] = { type: "digital-multi", pins };
      continue;
    }

    const pin = takeFrom(general, mod.name);
    if (pin === null) {
      result.errors.push("No free GPIO left for " + mod.name + ".");
      continue;
    }
    result.assignments[modId] = { type: mod.interface, pins: { SIG: pin } };

    if (boardId === "cam" && (pin === 4 || pin === 12)) {
      result.warnings.push(
        pin === 4
          ? mod.name + " is on GPIO4, which also drives the onboard flash LED -- it will flash when this pin toggles."
          : mod.name + " is on GPIO12, a boot-strapping pin -- avoid holding it HIGH during power-on."
      );
    }
  }

  return result;
}

if (typeof module !== "undefined") {
  module.exports = { BOARD_PROFILES, assignPins };
}

if (typeof window !== "undefined") {
  window.BOARD_PROFILES = BOARD_PROFILES;
  window.assignPins = assignPins;
}