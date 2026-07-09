// app.js -- main frontend controller. Pure vanilla JS, no build step.

const state = {
  board: "devkit",
  selected: new Set(),
  chatHistory: [], // {role, content}
  lastAssign: null,
  lastCode: "",
  agentBusy: false,
  autoRegenTimer: null,
  lastSummary: "",
};

const diagramState = {
  scale: 1,
  minScale: 0.45,
  maxScale: 2.6,
  panX: 0,
  panY: 0,
  mode: "empty",
  dragging: false,
  dragStartX: 0,
  dragStartY: 0,
  startPanX: 0,
  startPanY: 0,
  contentWidth: 0,
  contentHeight: 0,
};

const el = {};
const copy = globalThis.UICopy;

document.addEventListener("DOMContentLoaded", () => {
  el.moduleList = document.getElementById("module-list");
  el.presets = document.getElementById("presets");
  el.boardButtons = document.getElementById("board-select");
  el.diagramWrap = document.getElementById("diagram-wrap");
  el.diagramViewport = document.getElementById("diagram-viewport");
  el.diagramCanvas = document.getElementById("diagram-canvas");
  el.diagramZoomIn = document.getElementById("diagram-zoom-in");
  el.diagramZoomOut = document.getElementById("diagram-zoom-out");
  el.diagramZoomBadge = document.getElementById("diagram-zoom-badge");
  el.diagramFit = document.getElementById("diagram-fit");
  el.diagramReset = document.getElementById("diagram-reset");
  el.messages = document.getElementById("messages");
  el.codeEl = document.getElementById("code-output");
  el.serial = document.getElementById("serial-monitor");
  el.chatLog = document.getElementById("chat-log");
  el.chatInput = document.getElementById("chat-input");
  el.chatSend = document.getElementById("chat-send");
  el.statusPill = document.getElementById("status-pill");
  el.agentUpdate = document.getElementById("agent-update");
  el.heroSubtitle = document.getElementById("hero-subtitle");
  el.heroTagline = document.getElementById("hero-tagline");
  el.assistantLabel = document.getElementById("assistant-label");

  if (copy) {
    el.heroSubtitle.textContent = copy.getHeroSubtitle();
    el.heroTagline.textContent = copy.getHeroTagline();
    el.assistantLabel.textContent = copy.getAssistantLabel();
    setStatus("idle");
    setAgentUpdate(copy.getAgentUpdateCopy({}), "");
  }

  renderBoardSelector();
  renderPresets();
  renderModuleList();
  recomputeDiagram();

  el.chatSend.addEventListener("click", onSend);
  el.chatInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") onSend();
  });

  initDiagramControls();

  appendChat("system", "Pick a preset or modules to get a deterministic sketch, then ask Hy3 to explain or refine it.");
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
    el.diagramCanvas.innerHTML = '<div class="diagram-empty">Select modules to see the wiring diagram.</div>';
    diagramState.contentWidth = 0;
    diagramState.contentHeight = 0;
    diagramState.scale = 1;
    diagramState.panX = 0;
    diagramState.panY = 0;
    diagramState.mode = "empty";
    applyDiagramTransform();
  } else {
    el.diagramCanvas.innerHTML = renderDiagramSVG(state.board, MODULE_CATALOG, assign);
    fitDiagramToViewport();
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
  el.statusPill.textContent = copy ? copy.getStatusPillCopy(mode) : mode;
}

function setAgentUpdate(text, mode) {
  el.agentUpdate.textContent = text;
  el.agentUpdate.className = "agent-update" + (mode ? ` ${mode}` : "");
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
  setAgentUpdate(copy ? copy.getAgentUpdateCopy({ mode: "thinking", silent }) : "Updating...", "thinking");
  if (!silent) appendChat("system", copy ? copy.getSystemChatCopy({ mode: "thinking" }) : "Hy3 is generating code...");

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
      setAgentUpdate(
        copy
          ? copy.getAgentUpdateCopy({ mode: "offline", silent })
          : "Local sketch ready.",
        "offline"
      );
      appendChat(
        "system",
        copy
          ? copy.getSystemChatCopy({
              mode: silent ? "silent-offline" : "loud-offline",
              errorText: data && data.error ? data.error : "Hy3 assist unavailable",
            })
          : "Showing local sketch instead."
      );
      return;
    }

    setStatus("live");
    state.chatHistory.push({ role: "user", content: userMessage });
    state.chatHistory.push({ role: "assistant", content: data.explanation || "" });
    renderCode(data.code || "");
    renderSerial(data.serialLines || []);
    state.lastSummary = data.summary || "";
    setAgentUpdate(
      copy
        ? copy.getAgentUpdateCopy({ mode: "live", silent, summary: data.summary || "" })
        : data.summary || "Hy3 updated the sketch.",
      "live"
    );
    if (data.explanation) {
      if (silent) appendChat("system", copy ? copy.getSystemChatCopy({ mode: "silent-live", summary: data.summary || "" }) : (data.summary || "Sketch updated for the current hardware selection."));
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
    setAgentUpdate(
      copy
        ? copy.getAgentUpdateCopy({ mode: "offline", silent })
        : "Local sketch ready.",
      "offline"
    );
    appendChat(
      "system",
      copy
        ? copy.getSystemChatCopy({
            mode: silent ? "silent-offline" : "loud-offline",
            errorText: "Network error reaching Hy3 assist",
          })
        : "Showing local sketch instead."
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

function initDiagramControls() {
  el.diagramZoomIn.addEventListener("click", () => zoomDiagram(1.16));
  el.diagramZoomOut.addEventListener("click", () => zoomDiagram(1 / 1.16));
  el.diagramFit.addEventListener("click", () => fitDiagramToViewport());
  el.diagramReset.addEventListener("click", () => resetDiagramView());

  el.diagramViewport.addEventListener(
    "wheel",
    (e) => {
      if (!el.diagramCanvas.querySelector("svg")) return;
      e.preventDefault();
      const direction = e.deltaY < 0 ? 1.1 : 1 / 1.1;
      zoomDiagram(direction, e.clientX, e.clientY);
    },
    { passive: false }
  );

  el.diagramViewport.addEventListener("pointerdown", (e) => {
    if (!el.diagramCanvas.querySelector("svg")) return;
    if (e.button !== 0) return;
    diagramState.dragging = true;
    diagramState.dragStartX = e.clientX;
    diagramState.dragStartY = e.clientY;
    diagramState.startPanX = diagramState.panX;
    diagramState.startPanY = diagramState.panY;
    el.diagramViewport.classList.add("dragging");
    el.diagramWrap.classList.add("is-dragging");
    el.diagramViewport.setPointerCapture(e.pointerId);
  });

  el.diagramViewport.addEventListener("pointermove", (e) => {
    if (!diagramState.dragging) return;
    diagramState.mode = "custom";
    diagramState.panX = diagramState.startPanX + (e.clientX - diagramState.dragStartX);
    diagramState.panY = diagramState.startPanY + (e.clientY - diagramState.dragStartY);
    clampDiagramPan();
    applyDiagramTransform();
  });

  function stopDragging(e) {
    if (!diagramState.dragging) return;
    diagramState.dragging = false;
    el.diagramViewport.classList.remove("dragging");
    el.diagramWrap.classList.remove("is-dragging");
    if (e && typeof e.pointerId === "number") {
      try {
        el.diagramViewport.releasePointerCapture(e.pointerId);
      } catch (_) {
        // Ignore capture release failures.
      }
    }
  }

  el.diagramViewport.addEventListener("pointerup", stopDragging);
  el.diagramViewport.addEventListener("pointercancel", stopDragging);
  el.diagramViewport.addEventListener("pointerleave", stopDragging);
  el.diagramViewport.addEventListener("dblclick", () => fitDiagramToViewport());
  window.addEventListener("keydown", onDiagramViewportKeydown);
  window.addEventListener("resize", () => {
    if (!el.diagramCanvas.querySelector("svg")) return;
    if (diagramState.mode === "fit") {
      fitDiagramToViewport();
      return;
    }
    clampDiagramPan();
    applyDiagramTransform();
  });

  updateDiagramUi();
}

function onDiagramViewportKeydown(e) {
  const activeTag = document.activeElement && document.activeElement.tagName;
  if (activeTag === "INPUT" || activeTag === "TEXTAREA") return;
  if (!el.diagramCanvas.querySelector("svg")) return;

  if (e.key === "f" || e.key === "F") {
    e.preventDefault();
    fitDiagramToViewport();
  } else if (e.key === "0") {
    e.preventDefault();
    resetDiagramView();
  } else if (e.key === "+" || e.key === "=") {
    e.preventDefault();
    zoomDiagram(1.16);
  } else if (e.key === "-") {
    e.preventDefault();
    zoomDiagram(1 / 1.16);
  }
}

function resetDiagramView() {
  const { width, height } = getDiagramContentSize();
  diagramState.contentWidth = width;
  diagramState.contentHeight = height;
  diagramState.scale = 1;
  diagramState.panX = Math.max((el.diagramViewport.clientWidth - width) / 2, 24);
  diagramState.panY = Math.max((el.diagramViewport.clientHeight - height) / 2, 24);
  diagramState.mode = "reset";
  clampDiagramPan();
  applyDiagramTransform();
}

function fitDiagramToViewport() {
  const svg = el.diagramCanvas.querySelector("svg");
  if (!svg) {
    diagramState.scale = 1;
    diagramState.panX = 0;
    diagramState.panY = 0;
    applyDiagramTransform();
    return;
  }

  const { width, height } = getDiagramContentSize();
  const viewportWidth = el.diagramViewport.clientWidth;
  const viewportHeight = el.diagramViewport.clientHeight;
  if (!width || !height || !viewportWidth || !viewportHeight) return;

  const padding = 28;
  const fitScale = Math.min(
    (viewportWidth - padding * 2) / width,
    (viewportHeight - padding * 2) / height
  );

  diagramState.contentWidth = width;
  diagramState.contentHeight = height;
  diagramState.scale = clamp(fitScale, diagramState.minScale, 1.15);
  const scaledWidth = width * diagramState.scale;
  const scaledHeight = height * diagramState.scale;
  diagramState.panX = (viewportWidth - scaledWidth) / 2;
  diagramState.panY = (viewportHeight - scaledHeight) / 2;
  diagramState.mode = "fit";
  clampDiagramPan();
  applyDiagramTransform();
}

function zoomDiagram(multiplier, clientX, clientY) {
  const svg = el.diagramCanvas.querySelector("svg");
  if (!svg) return;

  const oldScale = diagramState.scale;
  const newScale = clamp(oldScale * multiplier, diagramState.minScale, diagramState.maxScale);
  if (Math.abs(newScale - oldScale) < 0.0001) return;

  const { width, height } = getDiagramContentSize();
  diagramState.contentWidth = width;
  diagramState.contentHeight = height;

  const viewportRect = el.diagramViewport.getBoundingClientRect();
  const anchorX = clientX == null ? viewportRect.left + viewportRect.width / 2 : clientX;
  const anchorY = clientY == null ? viewportRect.top + viewportRect.height / 2 : clientY;
  const localX = anchorX - viewportRect.left;
  const localY = anchorY - viewportRect.top;
  const worldX = (localX - diagramState.panX) / oldScale;
  const worldY = (localY - diagramState.panY) / oldScale;

  diagramState.scale = newScale;
  diagramState.mode = "custom";
  diagramState.panX = localX - worldX * newScale;
  diagramState.panY = localY - worldY * newScale;
  clampDiagramPan();
  applyDiagramTransform();
}

function clampDiagramPan() {
  const viewportWidth = el.diagramViewport.clientWidth;
  const viewportHeight = el.diagramViewport.clientHeight;
  const scaledWidth = diagramState.contentWidth * diagramState.scale;
  const scaledHeight = diagramState.contentHeight * diagramState.scale;
  const gutter = 48;

  const minPanX = scaledWidth <= viewportWidth ? (viewportWidth - scaledWidth) / 2 : viewportWidth - scaledWidth - gutter;
  const maxPanX = scaledWidth <= viewportWidth ? (viewportWidth - scaledWidth) / 2 : gutter;
  const minPanY = scaledHeight <= viewportHeight ? (viewportHeight - scaledHeight) / 2 : viewportHeight - scaledHeight - gutter;
  const maxPanY = scaledHeight <= viewportHeight ? (viewportHeight - scaledHeight) / 2 : gutter;

  diagramState.panX = clamp(diagramState.panX, minPanX, maxPanX);
  diagramState.panY = clamp(diagramState.panY, minPanY, maxPanY);
}

function getDiagramContentSize() {
  const svg = el.diagramCanvas.querySelector("svg");
  if (!svg) return { width: 0, height: 0 };
  const viewBox = svg.viewBox && svg.viewBox.baseVal;
  if (viewBox && viewBox.width && viewBox.height) {
    return { width: viewBox.width, height: viewBox.height };
  }
  return {
    width: svg.clientWidth || 560,
    height: svg.clientHeight || 560,
  };
}

function applyDiagramTransform() {
  el.diagramCanvas.style.transform = `translate(${diagramState.panX}px, ${diagramState.panY}px) scale(${diagramState.scale})`;
  updateDiagramUi();
}

function updateDiagramUi() {
  const hasDiagram = Boolean(el.diagramCanvas && el.diagramCanvas.querySelector("svg"));
  if (el.diagramViewport) {
    el.diagramViewport.classList.toggle("has-diagram", hasDiagram);
  }

  const percent = `${Math.round((diagramState.scale || 1) * 100)}%`;
  if (el.diagramZoomBadge) {
    el.diagramZoomBadge.textContent = percent;
  }

  for (const button of [el.diagramZoomIn, el.diagramZoomOut, el.diagramFit, el.diagramReset]) {
    if (button) button.disabled = !hasDiagram;
  }

  if (el.diagramZoomIn) {
    el.diagramZoomIn.disabled = !hasDiagram || diagramState.scale >= diagramState.maxScale - 0.001;
  }
  if (el.diagramZoomOut) {
    el.diagramZoomOut.disabled = !hasDiagram || diagramState.scale <= diagramState.minScale + 0.001;
  }
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}