export function html(strings, ...values) {
  return strings.reduce((result, string, index) => `${result}${string}${values[index] ?? ""}`, "");
}

export function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function formatInr(value) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0
  }).format(value);
}

export function getFormData(form) {
  return Object.fromEntries(new FormData(form).entries());
}

export function toast(message, type = "success") {
  const root = document.querySelector("#toast-root");
  const node = document.createElement("div");
  node.className = `toast ${type}`;
  node.textContent = message;
  root.appendChild(node);
  window.setTimeout(() => node.remove(), 3600);
}
