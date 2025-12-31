const input = document.getElementById("ruleInput");
const addBtn = document.getElementById("addRule");
const list = document.getElementById("ruleList");

loadRules();

addBtn.onclick = () => {
  const value = input.value.trim();
  if (!value) return;

  chrome.storage.sync.get({ rules: [] }, (data) => {
    if (data.rules.includes(value)) return;

    const updated = [...data.rules, value];
    chrome.storage.sync.set({ rules: updated }, loadRules);
  });

  input.value = "";
};

function loadRules() {
  chrome.storage.sync.get({ rules: [] }, (data) => {
    list.innerHTML = "";
    data.rules.forEach((rule, index) => {
      const li = document.createElement("li");
      li.textContent = rule;

      const remove = document.createElement("button");
      remove.textContent = "✕";
      remove.style.marginLeft = "6px";
      remove.onclick = () => removeRule(index);

      li.appendChild(remove);
      list.appendChild(li);
    });
  });
}

function removeRule(index) {
  chrome.storage.sync.get({ rules: [] }, (data) => {
    data.rules.splice(index, 1);
    chrome.storage.sync.set({ rules: data.rules }, loadRules);
  });
}
