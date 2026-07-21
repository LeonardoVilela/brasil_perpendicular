import { beforeEach, describe, expect, it } from "vitest";
import { instagramAdapter } from "./instagram";

const locationFor = (hostname: string) => ({ hostname }) as Location;

beforeEach(() => {
  document.body.innerHTML = "";
});

describe("instagramAdapter", () => {
  it("reconhece Instagram", () => {
    expect(instagramAdapter.matches(locationFor("www.instagram.com"))).toBe(true);
    expect(instagramAdapter.matches(locationFor("example.com"))).toBe(false);
  });

  it("extrai somente o article que contém o vídeo", () => {
    document.body.innerHTML = `
      <article>
        <header><a href="/autora/">autora</a></header>
        <h1 data-testid="post-caption">Vídeo feito com IA #ai</h1>
        <span data-testid="ai-label">Made with AI</span>
        <video></video>
      </article>
      <article><h1 data-testid="post-caption">Post vizinho</h1></article>
    `;
    const context = instagramAdapter.extractContext(document.querySelector("video")!, document);
    expect(context.platform).toBe("instagram");
    expect(context.authorName).toBe("autora");
    expect(context.authorStatements).toEqual(["Vídeo feito com IA #ai"]);
    expect(context.platformLabels).toEqual(["Made with AI"]);
  });
});
