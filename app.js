// app.js -- main frontend controller. Pure vanilla JS, no build step.

const state = {
  board: "devkit",
  selected: new Set(),
  chatHistory: [], // {role, content}
  lastAssign: null,
  lastCode: "",
  agentBusy: false,
  autoRegenTimer: null,
};

const el = {};

document.addEventListener("DOMContentLoaded", () => {
  el.moduleList = document.getElementById("module-list");
  el.presets = document.getElementById("presets");
  el.boardButtons = document.getElementById("board-select");
  el.diagramWrap = document.getElementById("diagram-wrap");
  el.messages = document.getElementById("messages");
  el.codeEl = document.getElementById("code-output");
  el.serial = document.getElementById("serial-monitor");
  el.chatLog = document.getElementById("chat-log");
  el.chatInput = document.getElementById("chat-input");
  el.chatSend = document.getElementById("chat-send");
  el.statusPill = document.getElementById("status-pill");

  renderBoardSelector();
  renderPresets();
  renderModuleList();
  recomputeDiagram();

  el.chatSend.addEventListener("click", onSend);
  el.chatInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") onSend();
  });

  appendChat("system", "Pick modules on the left (or a preset above), then ask the agent for behavior in the chat box.");
});

function renderBoardSelector() {
  el.boardButtons.innerHTML = "";
  const boards = [
    { id: "devkit", label: "ESP32 DevKit" },
    { id: "cam", label: "ESP32-CAM" },
  ];
  for (const b of boards) {
    const btn = document.createElement("button");
    btn.textContent = b.label;
    btn.className = b.id === state.board ? "active" : "";
    btn.addEventListener("click", () => {
      state.board = b.id;
      // Drop any selected modules that aren't valid on the new board.
      state.selected = new Set(
        [...state.selected].filter((id) => {
          const mod = MODULE_CATALOG.find((m) => m.id === id);
          return mod && mod.boards.includes(b.id);
        })
      );
      renderBoardSelector();
      renderModuleList();
      recomputeDiagram();
      scheduleAutoRegenerate(`Update the sketch for the current ${BOARD_PROFILES[state.board].label} selection.`);
    });
    el.boardButtons.appendChild(btn);
  }
}

function renderPresets() {
  el.presets.innerHTML = "";
  for (const [key, preset] of Object.entries(PRESETS)) {
    const btn = document.createElement("button");
    btn.className = "preset-btn";
    btn.innerHTML = `${preset.name}<small>${preset.description}</small>`;
    btn.addEventListener("click", () => {
      state.board = preset.board;
      state.selected = new Set(preset.modules);
      renderBoardSelector();
      renderModuleList();
      recomputeDiagram();
      scheduleAutoRegenerate(`Generate the initial sketch for the "${preset.name}" preset.`);
    });
    el.presets.appendChild(btn);
  }
}

function renderModuleList() {
  el.moduleList.innerHTML = "";
  for (const mod of MODULE_CATALOG) {
    const compatible = mod.boards.includes(state.board);
    const item = document.createElement("div");
    item.className = "module-item" + (compatible ? "" : " disabled");

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.disabled = !compatible;
    checkbox.checked = state.selected.has(mod.id);
    checkbox.id = "mod-" + mod.id;
    checkbox.addEventListener("change", () => {
      if (checkbox.checked) state.selected.add(mod.id);
      else state.selected.delete(mod.id);
      recomputeDiagram();
      scheduleAutoRegenerate("Update the sketch for the current hardware selection.");
    });

    const labelWrap = document.createElement("div");
    const label = document.createElement("label");
    label.htmlFor = checkbox.id;
    label.textContent = mod.name;
    const notes = document.createElement("div");
    notes.className = "notes";
    notes.textContent = compatible ? mod.notes : "Not available on this board.";
    labelWrap.appendChild(label);
    labelWrap.appendChild(notes);

    item.appendChild(checkbox);
    item.appendChild(labelWrap);
    el.moduleList.appendChild(item);
  }
}

function recomputeDiagram() {
  const assign = assignPins([...state.selected], state.board, MODULE_CATALOG);
  state.lastAssign = assign;

  if (state.selected.size === 0) {
    el.diagramWrap.innerHTML = '<p style="color:var(--muted);font-size:13px;">Select modules to see the wiring diagram.</p>';
  } else {
    el.diagramWrap.innerHTML = renderDiagramSVG(state.board, MODULE_CATALOG, assign);
  }

  el.messages.innerHTML = "";
  for (const w of assign.warnings) addMessage(w, "warning");
  for (const e of assign.errors) addMessage(e, "error");

  return assign;
}

function addMessage(text, cls) {
  const li = document.createElement("li");
  li.className = cls;
  li.textContent = (cls === "error" ? "⚠ " : "⚙ ") + text;
  el.messages.appendChild(li);
}

function appendChat(role, text) {
  const div = document.createElement("div");
  div.className = "chat-msg " + role;
  div.textContent = text;
  el.chatLog.appendChild(div);
  el.chatLog.scrollTop = el.chatLog.scrollHeight;
}

function setStatus(mode) {
  el.statusPill.className = "status-pill " + mode;
  el.statusPill.textContent = mode === "live" ? "Hy3: live" : mode === "offline" ? "Hy3: no key yet (fallback mode)" : "Hy3: thinking...";
}

function scheduleAutoRegenerate(message) {
  if (state.autoRegenTimer) clearTimeout(state.autoRegenTimer);
  if (state.selected.size === 0) return;
  state.autoRegenTimer = setTimeout(() => {
    state.autoRegenTimer = null;
    requestAgent(message, true);
  }, 700);
}

async function onSend() {
  const text = el.chatInput.value.trim();
  if (!text) return;
  if (state.selected.size === 0) {
    appendChat("system", "Select at least one module first.");
    return;
  }
  el.chatInput.value = "";
  appendChat("user", text);
  await requestAgent(text, false);
}

async function requestAgent(userMessage, silent) {
  if (state.agentBusy) return;
  const assign = recomputeDiagram();
  if (assign.errors.length) {
    appendChat("system", "Fix the errors above before generating code.");
    return;
  }

  state.agentBusy = true;
  el.chatSend.disabled = true;
  setStatus("thinking");
  if (!silent) appendChat("system", "Hy3 is generating code...");

  const payload = {
    board: state.board,
    boardLabel: assign.boardLabel,
    modules: [...state.selected].map((id) => MODULE_CATALOG.find((m) => m.id === id).name),
    pinAssignments: assign.assignments,
    bus: assign.bus,
    warnings: assign.warnings,
    chatHistory: state.chatHistory,
    userMessage,
  };

  try {
    const resp = await fetch("/api/agent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await resp.json();

    if (!resp.ok || data.error) {
      setStatus("offline");
      const fallback = generateFallbackCode(state.board, [...state.selected], assign, MODULE_CATALOG);
      renderCode(fallback.code);
      renderSerial(fallback.serialLines);
      appendChat(
        "system",
        silent
          ? "Sketch updated locally (fallback mode)."
          : (data && data.error ? data.error : "Agent unavailable") + " -- showing a local template instead."
      );
      return;
    }

    setStatus("live");
    state.chatHistory.push({ role: "user", content: userMessage });
    state.chatHistory.push({ role: "assistant", content: data.explanation || "" });
    renderCode(data.code || "");
    renderSerial(data.serialLines || []);
    if (data.explanation) {
      if (silent) appendChat("system", "Sketch updated for the current hardware selection.");
      else appendChat("assistant", data.explanation);
    }
    if (Array.isArray(data.warnings)) {
      for (const w of data.warnings) addMessage(w, "warning");
    }
  } catch (err) {
    setStatus("offline");
    const fallback = generateFallbackCode(state.board, [...state.selected], assign, MODULE_CATALOG);
    renderCode(fallback.code);
    renderSerial(fallback.serialLines);
    appendChat(
      "system",
      silent ? "Sketch updated locally (fallback mode)." : "Network error reaching the agent -- showing a local template instead."
    );
  } finally {
    state.agentBusy = false;
    el.chatSend.disabled = false;
  }
}

function renderCode(code) {
  state.lastCode = code;
  el.codeEl.textContent = code;
}

function renderSerial(lines) {
  el.serial.innerHTML = "";
  let i = 0;
  function step() {
    if (i >= lines.length) return;
    const div = document.createElement("div");
    div.className = "line";
    div.textContent = lines[i];
    el.serial.appendChild(div);
    el.serial.scrollTop = el.serial.scrollHeight;
    i++;
    setTimeout(step, 220);
  }
  step();
}