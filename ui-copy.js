(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.UICopy = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  function getStatusPillCopy(mode) {
    switch (mode) {
      case 'thinking':
        return 'Core build: ready • Hy3 assist: updating';
      case 'live':
        return 'Core build: ready • Hy3 assist: active';
      case 'offline':
        return 'Core build: ready • Hy3 assist: unavailable';
      case 'idle':
      default:
        return 'Core build: ready';
    }
  }

  function getAgentUpdateCopy({ mode, silent, summary }) {
    if (mode === 'thinking') {
      return silent
        ? 'Core build is ready. Hy3 is writing a short explanation for this hardware selection.'
        : 'Core build is ready. Hy3 is adapting the explanation and refinement notes for your current hardware.';
    }

    if (mode === 'offline') {
      return silent
        ? 'Core build updated locally for this hardware selection. Hy3 assist is unavailable right now.'
        : 'Core build is ready with a local wiring-safe sketch. Hy3 assist is unavailable right now.';
    }

    if (mode === 'live') {
      return summary
        ? `Core build is ready. Hy3 assist: ${summary}`
        : silent
          ? 'Core build is ready. Hy3 assist updated the explanation for this hardware selection.'
          : 'Core build is ready. Hy3 assist adapted the explanation for your requested behavior.';
    }

    return 'Select a preset or modules to generate a deterministic wiring-safe sketch.';
  }

  function getSystemChatCopy({ mode, errorText, summary }) {
    switch (mode) {
      case 'thinking':
        return 'Hy3 assist is generating explanation and refinement notes...';
      case 'silent-offline':
        return 'Core build updated locally. Hy3 assist is offline, so the deterministic sketch is still shown.';
      case 'loud-offline':
        return `${errorText || 'Hy3 assist is unavailable'} -- showing the deterministic sketch instead.`;
      case 'silent-live':
        return summary
          ? `Hy3 assist updated the explanation: ${summary}`
          : 'Hy3 assist updated the explanation for the current hardware selection.';
      default:
        return '';
    }
  }

  function getHeroSubtitle() {
    return 'Build ESP32 projects visually. Get a deterministic wiring-safe sketch, then use Hy3 for explanation and refinement.';
  }

  function getHeroTagline() {
    return 'Deterministic core build + optional Hy3 assist';
  }

  function getAssistantLabel() {
    return 'Chat with Hy3 assist';
  }

  return {
    getStatusPillCopy,
    getAgentUpdateCopy,
    getSystemChatCopy,
    getHeroSubtitle,
    getHeroTagline,
    getAssistantLabel,
  };
});
