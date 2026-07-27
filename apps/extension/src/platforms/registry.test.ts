import { describe, expect, it } from "vitest";
import { pickAdapter } from "./registry";

const locationFor = (hostname: string) => ({ hostname }) as Location;

describe("pickAdapter", () => {
  it.each([
    ["www.youtube.com", "youtube"],
    ["www.tiktok.com", "tiktok"],
    ["www.instagram.com", "instagram"],
    ["x.com", "twitter"],
    ["example.com", "generic"],
  ])("seleciona %s como %s", (hostname, expected) => {
    expect(pickAdapter(locationFor(hostname)).name).toBe(expected);
  });
});
