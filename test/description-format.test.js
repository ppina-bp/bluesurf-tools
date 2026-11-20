import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { formatDescription } from "../src/description-format.js";

describe("formatDescription", () => {
  it("strips html tags", () => {
    const out = formatDescription("<p>Hello <b>world</b></p>", "strip_html");
    assert.match(out, /Hello/);
    assert.doesNotMatch(out, /<p>/);
  });

  it("converts headings to markdown", () => {
    const out = formatDescription("<h2>Title</h2><p>Body</p>", "markdown");
    assert.match(out, /^## Title/m);
  });
});