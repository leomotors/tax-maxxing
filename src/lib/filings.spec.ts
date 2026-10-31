import { describe, expect, it } from "vitest";

import {
  activeFiling,
  addFiling,
  createLibrary,
  duplicateFiling,
  normalizeLibrary,
  parseBackup,
  parseImportJson,
  removeFiling,
  toBackup,
  updateFiling,
} from "./filings";
import { emptyProfile } from "./tax/calculate";

function named(name: string, id = crypto.randomUUID()) {
  return { ...emptyProfile(), id, name };
}

describe("library operations", () => {
  it("is never empty and points at a real filing", () => {
    const lib = createLibrary();
    expect(lib.filings).toHaveLength(1);
    expect(lib.activeId).toBe(lib.filings[0].id);
  });

  it("reassigns duplicate ids and fixes a dangling activeId", () => {
    const lib = normalizeLibrary({
      version: 1,
      activeId: "missing",
      filings: [named("A", "same"), named("B", "same")],
    });
    expect(new Set(lib.filings.map((f) => f.id)).size).toBe(2);
    expect(lib.filings[0].id).toBe("same");
    expect(lib.activeId).toBe("same");
  });

  it("adds a filing with a fresh id and selects it", () => {
    const base = createLibrary([named("A", "a")]);
    const lib = addFiling(base, named("B", "a"));
    expect(lib.filings).toHaveLength(2);
    expect(lib.filings[1].id).not.toBe("a");
    expect(lib.activeId).toBe(lib.filings[1].id);
  });

  it("duplicates deeply with a new id and a (สำเนา) suffix", () => {
    const source = named("A", "a");
    source.income401 = [{ id: "i", label: "Company A", amount: 100, withheld: 0 }];
    const lib = duplicateFiling(createLibrary([source]), "a");
    const copy = lib.filings[1];
    expect(copy.id).not.toBe("a");
    expect(copy.name).toBe("A (สำเนา)");
    copy.income401[0].amount = 999;
    expect(lib.filings[0].income401[0].amount).toBe(100);
  });

  it("removing the last filing leaves a fresh empty one", () => {
    const lib = removeFiling(createLibrary([named("A", "a")]), "a");
    expect(lib.filings).toHaveLength(1);
    expect(lib.filings[0].id).not.toBe("a");
    expect(lib.activeId).toBe(lib.filings[0].id);
  });

  it("updates only the targeted filing and keeps its id", () => {
    const lib = createLibrary([named("A", "a"), named("B", "b")]);
    const next = updateFiling(lib, "b", (f) => ({ ...f, id: "hijack", name: "B2" }));
    expect(next.filings.map((f) => [f.id, f.name])).toEqual([
      ["a", "A"],
      ["b", "B2"],
    ]);
    expect(activeFiling(next).id).toBe("a");
  });
});

describe("backup envelope", () => {
  it("round-trips through toBackup → parseBackup", () => {
    const lib = createLibrary([named("A", "a"), named("B", "b")]);
    const restored = parseBackup(JSON.parse(JSON.stringify(toBackup({ ...lib, activeId: "b" }))));
    expect(restored.filings.map((f) => f.name)).toEqual(["A", "B"]);
    expect(restored.activeId).toBe("b");
  });

  it("rejects the whole backup when one filing is invalid, naming its index", () => {
    const backup = toBackup(createLibrary([named("A"), named("B")]));
    const broken = { ...backup, filings: [backup.filings[0], { ...backup.filings[1], income402: 5 }] };
    expect(() => parseBackup(broken)).toThrow("รายการที่ 2");
  });

  it("rejects wrong versions and empty backups", () => {
    const backup = toBackup(createLibrary());
    expect(() => parseBackup({ ...backup, version: 2 })).toThrow();
    expect(() => parseBackup({ ...backup, filings: [] })).toThrow();
  });
});

describe("parseImportJson", () => {
  it("detects a backup vs a single filing", () => {
    const backupText = JSON.stringify(toBackup(createLibrary([named("A")])));
    expect(parseImportJson(backupText).kind).toBe("backup");
    expect(parseImportJson(JSON.stringify(named("B"))).kind).toBe("profile");
  });

  it("reports invalid JSON in Thai", () => {
    expect(() => parseImportJson("{not json")).toThrow("JSON");
  });
});
