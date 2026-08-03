import { escapeHtml, formatInr, html } from "../utils/dom.js";

const walletTransactionHeaders = ["Direction", "Amount", "Type", "Reference", "Date"];

export function renderWalletTransactionsTable(transactions = []) {
  const rows = transactions.map(formatWalletTransactionRow);

  return html`
    <div class="table-wrap">
      <table>
        <thead><tr>${walletTransactionHeaders.map((header) => `<th>${header}</th>`).join("")}</tr></thead>
        <tbody>${rows.map((row) => `<tr>${row.map((cell) => `<td>${cell}</td>`).join("")}</tr>`).join("")}</tbody>
      </table>
    </div>
  `;
}

export function formatWalletTransactionRow(entry = {}) {
  const direction = String(entry.direction || "").toLowerCase();
  const amountPaise = Number(entry.amountPaise ?? entry.amount_paise ?? 0);
  const amount = `${direction === "debit" ? "-" : "+"}${formatInr(amountPaise / 100)}`;
  const entryType = String(entry.entryType || entry.entry_type || "wallet_entry").replace(/_/g, " ");
  const referenceType = entry.referenceType || entry.reference_type || "wallet";
  const referenceId = entry.referenceId || entry.reference_id || entry.gatewayPaymentId || entry.gateway_payment_id || "-";
  const createdAt = entry.createdAt || entry.created_at;
  const createdLabel = createdAt ? new Date(createdAt).toLocaleString() : "-";

  return [
    `<span class="status-pill ${direction === "credit" ? "success" : "warning"}">${escapeHtml(direction || "entry")}</span>`,
    `<strong>${escapeHtml(amount)}</strong>`,
    escapeHtml(entryType),
    `${escapeHtml(referenceType)}<br><small>${escapeHtml(referenceId)}</small>`,
    escapeHtml(createdLabel)
  ];
}
