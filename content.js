/***********************
 * REGEX PATTERNS
 ***********************/
const emailRegex = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;
const apiKeyRegex = /sk_(live|test)_[0-9a-zA-Z]{16,}/;
const jwtRegex = /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/;
const ipRegex = /\b\d{1,3}(\.\d{1,3}){3}\b/;
const sshKeyRegex = /-----BEGIN (RSA|OPENSSH) PRIVATE KEY-----/;

let activeInput = null;

/***********************
 * TRACK ACTIVE INPUT
 ***********************/
document.addEventListener(
  "focusin",
  (e) => {
    if (e.target.tagName === "TEXTAREA" || e.target.isContentEditable) {
      activeInput = e.target;
    }
  },
  true
);

/***********************
 * INTERCEPT CTRL+V / CMD+V
 ***********************/
document.addEventListener(
  "keydown",
  async (event) => {
    if (!activeInput) return;

    const isPaste =
      (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "v";

    if (!isPaste) return;

    event.preventDefault();
    event.stopPropagation();

    const clipboardText = await navigator.clipboard.readText();

    chrome.storage.sync.get({ rules: [] }, (data) => {
      const findings = detectSensitive(clipboardText, data.rules);

      if (findings.length === 0) {
        insertText(clipboardText);
        return;
      }

      const redacted = redactText(clipboardText, data.rules);
      showDialog(findings, clipboardText, redacted);
    });
  },
  true
);

/***********************
 * DETECTION
 ***********************/
function detectSensitive(text, rules) {
  const found = [];

  if (rules.some(r => new RegExp(`\\b${escapeRegex(r)}\\b`, "i").test(text)))
    found.push("Custom Rule");

  if (emailRegex.test(text)) found.push("Email Address");
  if (apiKeyRegex.test(text)) found.push("API Key");
  if (jwtRegex.test(text)) found.push("JWT Token");
  if (ipRegex.test(text)) found.push("IP Address");
  if (sshKeyRegex.test(text)) found.push("SSH Private Key");

  return [...new Set(found)];
}

/***********************
 * REDACTION
 ***********************/
function redactText(text, rules) {
  let output = text;

  rules.forEach(rule => {
    const regex = new RegExp(`\\b${escapeRegex(rule)}\\b`, "gi");
    output = output.replace(regex, "[REDACTED]");
  });

  return output
    .replace(emailRegex, "[REDACTED_EMAIL]")
    .replace(apiKeyRegex, "[REDACTED_API_KEY]")
    .replace(jwtRegex, "[REDACTED_JWT]")
    .replace(ipRegex, "[REDACTED_IP]")
    .replace(sshKeyRegex, "[REDACTED_SSH_KEY]");
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/***********************
 * DIALOG UI (CENTERED)
 ***********************/
function showDialog(findings, original, redacted) {
  removeDialog();

  const overlay = document.createElement("div");
  overlay.className = "guard-overlay";

  overlay.innerHTML = `
  <div class="guard-dialog">
    <div class="guard-header">
      <span class="icon">⚠️</span>
      <span>Sensitive Information Detected</span>
    </div>

    <div class="guard-body">
      <p class="guard-subtext">
        The following sensitive data was found in your clipboard:
      </p>

      <ul class="guard-list">
        ${findings.map(f => `<li>${f}</li>`).join("")}
      </ul>

      <label class="guard-label">Redaction Preview (editable)</label>
      <textarea id="guard-preview">${redacted}</textarea>
    </div>

    <div class="guard-actions">
      <button class="btn-safe" id="paste-redacted">Paste Redacted</button>
      <button class="btn-warn" id="paste-anyway">Paste Anyway</button>
      <button class="btn-cancel" id="cancel">Cancel</button>
    </div>
  </div>
`;


  document.body.appendChild(overlay);

  document.getElementById("paste-redacted").onclick = () => {
    insertText(document.getElementById("guard-preview").value);
    removeDialog();
  };

  document.getElementById("paste-anyway").onclick = () => {
    insertText(original);
    removeDialog();
  };

  document.getElementById("cancel").onclick = removeDialog;
}

function removeDialog() {
  document.querySelector(".guard-overlay")?.remove();
}

/***********************
 * INSERT TEXT
 ***********************/
function insertText(text) {
  if (!activeInput) return;

  activeInput.focus();

  if (activeInput.isContentEditable) {
    document.execCommand("insertText", false, text);
  } else {
    activeInput.setRangeText(
      text,
      activeInput.selectionStart,
      activeInput.selectionEnd,
      "end"
    );
  }
}
