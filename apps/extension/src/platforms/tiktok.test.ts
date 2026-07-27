import { beforeEach, describe, expect, it } from "vitest";
import { tiktokAdapter } from "./tiktok";

const locationFor = (hostname: string) => ({ hostname }) as Location;

beforeEach(() => {
  document.body.innerHTML = "";
});

describe("tiktokAdapter", () => {
  it("reconhece TikTok sem aceitar domínio parecido", () => {
    expect(tiktokAdapter.matches(locationFor("www.tiktok.com"))).toBe(true);
    expect(tiktokAdapter.matches(locationFor("tiktok.example.com"))).toBe(false);
  });

  it("limita legenda, autor e rótulo ao card dono do vídeo", () => {
    document.body.innerHTML = `
      <article data-e2e="feed-video">
        <a data-e2e="video-author-uniqueid">@autora</a>
        <div data-e2e="video-desc">Criado com IA no Kling #aivideo</div>
        <span data-e2e="ai-generated-label">Conteúdo gerado por IA</span>
        <video></video>
      </article>
      <article data-e2e="feed-video"><div data-e2e="video-desc">Outro post</div></article>
    `;
    const context = tiktokAdapter.extractContext(document.querySelector("video")!, document);
    expect(context.platform).toBe("tiktok");
    expect(context.authorName).toBe("@autora");
    expect(context.authorStatements).toEqual(["Criado com IA no Kling #aivideo"]);
    expect(context.platformLabels).toEqual(["Conteúdo gerado por IA"]);
  });
});
