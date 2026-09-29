import { expect, it } from "vitest";

import { parsePageSpec } from "../../src/cli/stamp.mts";

it("resolves the pages named from the end of the document", () => {
  expect(parsePageSpec("last", 100)).toEqual([100]);
  expect(parsePageSpec("penultimate", 100)).toEqual([99]);
  expect(parsePageSpec("first", 100)).toEqual([1]);
  expect(parsePageSpec("second", 100)).toEqual([2]);
});

it("sorts and de-duplicates the pages into print order", () => {
  expect(parsePageSpec("last,2,last,penultimate", 100)).toEqual([2, 99, 100]);
  expect(parsePageSpec("5 3 3", 100)).toEqual([3, 5]);
});

it("refuses a page the document does not have", () => {
  expect(() => parsePageSpec("101", 100)).toThrow(/does not exist/u);
  expect(() => parsePageSpec("0", 100)).toThrow(/Cannot understand/u);
  expect(() => parsePageSpec("cover", 100)).toThrow(/Cannot understand/u);
  expect(() => parsePageSpec("", 100)).toThrow(/at least one page/u);
});
