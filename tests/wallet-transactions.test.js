import test from "node:test";
import assert from "node:assert";
import { formatWalletTransactionRow, renderWalletTransactionsTable } from "../src/features/wallet-transactions.js";

test("wallet transactions feature", async (t) => {
  await t.test("formats credit and debit amounts from paise", () => {
    const credit = formatWalletTransactionRow({ direction: "credit", amountPaise: 250000 });
    const debit = formatWalletTransactionRow({ direction: "debit", amount_paise: 9000 });

    assert.match(credit[0], /status-pill success/);
    assert.strictEqual(credit[1], "<strong>+₹2,500</strong>");
    assert.match(debit[0], /status-pill warning/);
    assert.strictEqual(debit[1], "<strong>-₹90</strong>");
  });

  await t.test("escapes user-controlled transaction labels and references", () => {
    const row = formatWalletTransactionRow({
      direction: "<script>",
      amountPaise: 10000,
      entryType: "bonus_<img>",
      referenceType: "order",
      referenceId: `pay_"bad"`
    });

    assert.match(row[0], /&lt;script&gt;/);
    assert.strictEqual(row[2], "bonus &lt;img&gt;");
    assert.strictEqual(row[3], "order<br><small>pay_&quot;bad&quot;</small>");
  });

  await t.test("renders a complete table shell", () => {
    const markup = renderWalletTransactionsTable([
      { direction: "credit", amountPaise: 10000, entryType: "wallet_topup", referenceId: "pay_123" }
    ]);

    assert.match(markup, /<th>Direction<\/th>/);
    assert.match(markup, /wallet topup/);
    assert.match(markup, /pay_123/);
  });
});
