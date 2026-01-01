class ClipboardGuard {
  constructor() {
    this.activeElement = null;
    this.customRules = [];
    this.init();
  }

  async init() {
    await this.loadRules();
    this.trackFocus();
    this.listenToPaste();
  }

  async loadRules() {
    const data = await chrome.storage.sync.get({ rules: [] });
    this.customRules = data.rules || [];
  }

  trackFocus() {
    document.addEventListener(
      "focusin",
      (e) => {
        if (
          e.target.isContentEditable ||
          e.target.tagName === "TEXTAREA" ||
          e.target.tagName === "INPUT"
        ) {
          this.activeElement = e.target;
        }
      },
      true
    );
  }

  listenToPaste() {
    document.addEventListener(
      "paste",
      (event) => this.handlePaste(event),
      true
    );
  }

  handlePaste(event) {
    if (!this.activeElement) return;

    const clipboardData = event.clipboardData || window.clipboardData;
    if (!clipboardData) return;

    const text = clipboardData.getData("text");

    // Images / files → allow browser default
    if (!text || text.trim() === "") return;

    const findings = this.detect(text);
    if (findings.length === 0) return;

    // Block paste BEFORE insertion
    event.preventDefault();
    event.stopImmediatePropagation();

    const redacted = this.redact(text);
    this.showDialog(findings, text, redacted);
  }

  detect(text) {
    const hits = [];

    this.customRules.forEach((rule) => {
      const regex = new RegExp(`\\b${this.escape(rule)}\\b`, "i");
      if (regex.test(text)) hits.push("Custom Rule");
    });

    if (/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i.test(text))
      hits.push("Email");

    if (/sk_(live|test)_[0-9a-zA-Z]{16,}/.test(text))
      hits.push("API Key");

    if (/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/.test(text))
      hits.push("JWT");

    if (/\b\d{1,3}(\.\d{1,3}){3}\b/.test(text))
      hits.push("IP Address");

    if (/-----BEGIN .* PRIVATE KEY-----/.test(text))
      hits.push("Private Key");

    return [...new Set(hits)];
  }

  redact(text) {
    let output = text;

    this.customRules.forEach((rule) => {
      output = output.replace(
        new RegExp(`\\b${this.escape(rule)}\\b`, "gi"),
        "[REDACTED]"
      );
    });

    return output
      .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[REDACTED_EMAIL]")
      .replace(/sk_(live|test)_[0-9a-zA-Z]{16,}/g, "[REDACTED_API_KEY]")
      .replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, "[REDACTED]")
      .replace(/\b\d{1,3}(\.\d{1,3}){3}\b/g, "[REDACTED_IP]")
      .replace(/-----BEGIN .* PRIVATE KEY-----[\s\S]*?-----END .* PRIVATE KEY-----/g, "[REDACTED]");
  }

  showDialog(findings, original, redacted) {
    document.querySelector(".guard-overlay")?.remove();

    const overlay = document.createElement("div");
    overlay.className = "guard-overlay";

    overlay.innerHTML = `
      <div class="guard-dialog">
        <div class="guard-header">⚠ Sensitive Information Detected</div>
        <ul class="guard-list">${findings.map(f => `<li>${f}</li>`).join("")}</ul>
        <label>Redaction Preview</label>
        <textarea id="guard-preview">${redacted}</textarea>
        <div class="guard-actions">
          <button class="btn-safe" id="paste-redacted">Paste Redacted</button>
          <button class="btn-warn" id="paste-anyway">Paste Anyway</button>
          <button class="btn-cancel" id="cancel">Cancel</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    document.getElementById("paste-redacted").onclick = () => {
      this.insert(document.getElementById("guard-preview").value);
      overlay.remove();
    };

    document.getElementById("paste-anyway").onclick = () => {
      this.insert(original);
      overlay.remove();
    };

    document.getElementById("cancel").onclick = () => overlay.remove();
  }

  insert(text) {
    const el = this.activeElement;
    if (!el) return;

    el.focus();

    if (el.isContentEditable) {
      document.execCommand("insertText", false, text);
    } else {
      const start = el.selectionStart;
      const end = el.selectionEnd;
      el.value = el.value.slice(0, start) + text + el.value.slice(end);
      el.selectionStart = el.selectionEnd = start + text.length;
      el.dispatchEvent(new Event("input", { bubbles: true }));
    }
  }

  escape(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }
}

new ClipboardGuard();
