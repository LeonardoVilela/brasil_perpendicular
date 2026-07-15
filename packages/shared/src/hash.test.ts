import { describe, expect, it } from "vitest";
import { hashContext } from "./hash";

describe("hashContext", () => {
  it("mesmo input produz o mesmo hash", () => {
    expect(hashContext("abc")).toBe(hashContext("abc"));
  });
  it("inputs diferentes produzem hashes diferentes", () => {
    expect(hashContext("abc")).not.toBe(hashContext("abd"));
  });
  it("retorna hex de 8 caracteres", () => {
    expect(hashContext("qualquer texto")).toMatch(/^[0-9a-f]{8}$/);
  });
});
