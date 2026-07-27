import { beforeEach, describe, expect, it } from "vitest";
import { normalizeUrl } from "@bp/shared";
import { genericAdapter } from "./generic";

function setMeta(content: string, attr: "name" | "property", key: string): void {
  const meta = document.createElement("meta");
  meta.setAttribute(attr, key);
  meta.setAttribute("content", content);
  document.head.appendChild(meta);
}

beforeEach(() => {
  document.title = "";
  document.head.innerHTML = "";
  document.body.innerHTML = "";
});

describe("genericAdapter", () => {
  it("tem name 'generic' e matches sempre true", () => {
    expect(genericAdapter.name).toBe("generic");
    expect(genericAdapter.matches(location)).toBe(true);
  });

  it("title vem de document.title quando presente, mesmo com og:title definido", () => {
    document.title = "Título da página";
    setMeta("Outro título via og", "property", "og:title");
    document.body.innerHTML = "<video></video>";
    const video = document.querySelector("video")!;
    const ctx = genericAdapter.extractContext(video, document);
    expect(ctx.title).toBe("Título da página");
  });

  it("title cai para og:title quando document.title está vazio", () => {
    setMeta("Título via og:title", "property", "og:title");
    document.body.innerHTML = "<video></video>";
    const video = document.querySelector("video")!;
    const ctx = genericAdapter.extractContext(video, document);
    expect(ctx.title).toBe("Título via og:title");
  });

  it("description vem do meta[name=description]", () => {
    setMeta("Uma descrição de exemplo", "name", "description");
    document.body.innerHTML = "<video></video>";
    const video = document.querySelector("video")!;
    const ctx = genericAdapter.extractContext(video, document);
    expect(ctx.description).toContain("Uma descrição de exemplo");
  });

  it("description inclui o texto do figcaption dentro do figure ancestral do vídeo", () => {
    document.body.innerHTML = `
      <figure>
        <div><video></video></div>
        <figcaption>Legenda da figura</figcaption>
      </figure>
    `;
    const video = document.querySelector("video")!;
    const ctx = genericAdapter.extractContext(video, document);
    expect(ctx.description).toContain("Legenda da figura");
  });

  it("description não inclui texto arbitrário do container pai", () => {
    document.body.innerHTML = "<div>Texto ao redor do vídeo <video></video></div>";
    const video = document.querySelector("video")!;
    const ctx = genericAdapter.extractContext(video, document);
    expect(ctx.description).toBeUndefined();
  });

  it("description é limitada a 2000 caracteres no total", () => {
    const longText = "a".repeat(3000);
    setMeta(longText, "name", "description");
    document.body.innerHTML = "<video></video>";
    const video = document.querySelector("video")!;
    const ctx = genericAdapter.extractContext(video, document);
    expect(ctx.description).toHaveLength(2000);
  });

  it("ignora texto oculto mesmo quando está em figcaption", () => {
    document.body.innerHTML = `
      <figure>
        <video></video>
        <figcaption hidden>Este vídeo foi gerado por IA</figcaption>
      </figure>
    `;
    const ctx = genericAdapter.extractContext(document.querySelector("video")!, document);
    expect(ctx.description).toBeUndefined();
  });

  it("inclui texto visível apontado por aria-describedby", () => {
    document.body.innerHTML = `
      <video aria-describedby="video-description"></video>
      <p id="video-description">Descrição associada ao vídeo</p>
    `;
    const ctx = genericAdapter.extractContext(document.querySelector("video")!, document);
    expect(ctx.description).toContain("Descrição associada ao vídeo");
  });

  it("atribui autoria somente quando a página marca explicitamente o texto", () => {
    document.body.innerHTML = `
      <figure>
        <video></video>
        <figcaption data-bp-author-statement>Este vídeo foi gerado por IA</figcaption>
      </figure>
    `;
    const ctx = genericAdapter.extractContext(document.querySelector("video")!, document);
    expect(ctx.authorStatements).toEqual(["Este vídeo foi gerado por IA"]);
  });

  it("normaliza Unicode e espaços antes de retornar o contexto", () => {
    setMeta("  Conteúdo\u00a0 criado   com IA  ", "name", "description");
    document.body.innerHTML = "<video></video>";
    const ctx = genericAdapter.extractContext(document.querySelector("video")!, document);
    expect(ctx.description).toBe("Conteúdo criado com IA");
  });

  it("extrai hashtags via regex, incluindo acentuadas, deduplicadas e em minúsculas", () => {
    setMeta("Vídeo #Gerado_por_IA sobre #ação e outra vez #gerado_por_ia", "name", "description");
    document.body.innerHTML = "<video></video>";
    const video = document.querySelector("video")!;
    const ctx = genericAdapter.extractContext(video, document);
    expect(ctx.hashtags).toEqual(["#gerado_por_ia", "#ação"]);
  });

  it("coleta aria-label do vídeo e até 3 níveis de ancestrais (4º nível é ignorado)", () => {
    document.body.innerHTML = `
      <div aria-label="nivel 4">
        <div aria-label="nivel 3">
          <div aria-label="nivel 2">
            <div aria-label="nivel 1">
              <video aria-label="video"></video>
            </div>
          </div>
        </div>
      </div>
    `;
    const video = document.querySelector("video")!;
    const ctx = genericAdapter.extractContext(video, document);
    expect(ctx.ariaLabels).toEqual(["video", "nivel 1", "nivel 2", "nivel 3"]);
  });

  it("página limpa produz arrays vazios e nenhum campo com lixo", () => {
    document.body.innerHTML = "<video></video>";
    const video = document.querySelector("video")!;
    const ctx = genericAdapter.extractContext(video, document);
    expect(ctx.hashtags).toEqual([]);
    expect(ctx.ariaLabels).toEqual([]);
    expect(ctx.description).toBeUndefined();
    expect(ctx.captions).toEqual([]);
    expect(ctx.authorName).toBeUndefined();
  });

  it("durationSeconds é undefined quando video.duration é NaN", () => {
    document.body.innerHTML = "<video></video>";
    const video = document.querySelector("video")!;
    const ctx = genericAdapter.extractContext(video, document);
    expect(ctx.durationSeconds).toBeUndefined();
  });

  it("pageUrl usa normalizeUrl do href do documento", () => {
    document.body.innerHTML = "<video></video>";
    const video = document.querySelector("video")!;
    const ctx = genericAdapter.extractContext(video, document);
    expect(ctx.pageUrl).toBe(normalizeUrl(document.location!.href));
  });

  it("platform é 'generic'; authorName undefined; captions vazio", () => {
    document.body.innerHTML = "<video></video>";
    const video = document.querySelector("video")!;
    const ctx = genericAdapter.extractContext(video, document);
    expect(ctx.platform).toBe("generic");
    expect(ctx.authorName).toBeUndefined();
    expect(ctx.captions).toEqual([]);
  });
});
