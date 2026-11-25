import test from "node:test";
import assert from "node:assert/strict";
import {
  clampTocWidth,
  clampPanelWidth,
  tocPanelLimits,
} from "../src/shared/reading-methods.js";
test("contents width grows within its own bounds and preserves the reading column", () => {
  assert.equal(clampTocWidth(400, 1400, 420), 400);
  assert.equal(clampTocWidth(900, 1400, 420), 600);
  assert.equal(clampTocWidth(-50, 1400, 420), 140);
  assert.equal(clampTocWidth(0, 1400, 420), 140);
  assert.equal(clampTocWidth(NaN, 1400, 420), 200);
});
test("contents and companion widths share available space without consuming the main column", () => {
  const available = 1000,
    right = 420,
    left = clampTocWidth(600, available, right);
  assert.equal(left, 260);
  assert.equal(available - right - left, 320);
  assert.equal(clampTocWidth(600, available, 0), 600);
  assert.equal(clampPanelWidth(800, 1200, 460), 420);
  assert.equal(tocPanelLimits(1600, 420).max, 600);
});
