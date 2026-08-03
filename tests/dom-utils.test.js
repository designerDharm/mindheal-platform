import test from "node:test";
import assert from "node:assert";
import { escapeHtml, formatInr, html } from "../src/utils/dom.js";

test("dom utilities", async (t) => {
  await t.test("escapes unsafe text before rendering table and panel values", () => {
    assert.strictEqual(
      escapeHtml(`<img src=x onerror="alert('xss')">&`),
      "&lt;img src=x onerror=&quot;alert(&#039;xss&#039;)&quot;&gt;&amp;"
    );
  });

  await t.test("keeps tagged template rendering predictable for nullish values", () => {
    const rendered = html`<span>${"Ready"}</span><span>${null}</span><span>${undefined}</span>`;

    assert.strictEqual(rendered, "<span>Ready</span><span></span><span></span>");
  });

  await t.test("formats rupee values with Indian grouping", () => {
    assert.strictEqual(formatInr(125000), "₹1,25,000");
  });
});
