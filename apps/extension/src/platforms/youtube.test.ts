import { beforeEach, describe, expect, it } from "vitest";
import { youtubeAdapter } from "./youtube";

const locationFor = (hostname: string) => ({ hostname }) as Location;

beforeEach(() => {
  document.head.innerHTML = "";
  document.body.innerHTML = "";
});

describe("youtubeAdapter", () => {
  it("reconhece domínios do YouTube", () => {
    expect(youtubeAdapter.matches(locationFor("www.youtube.com"))).toBe(true);
    expect(youtubeAdapter.matches(locationFor("m.youtube.com"))).toBe(true);
    expect(youtubeAdapter.matches(locationFor("example.com"))).toBe(false);
  });

  it("extrai metadados do post e o rótulo nativo ligado ao vídeo", () => {
    document.body.innerHTML = `
      <ytd-watch-flexy>
        <h1><yt-formatted-string>Meu vídeo</yt-formatted-string></h1>
        <div id="owner"><div id="channel-name"><a>Canal Teste</a></div></div>
        <div id="description-inline-expander">Este vídeo foi gerado por IA. #Sora</div>
        <div id="structured-description"><span>Conteúdo alterado ou sintético</span></div>
        <div id="movie_player"><video></video></div>
      </ytd-watch-flexy>
    `;
    const context = youtubeAdapter.extractContext(document.querySelector("video")!, document);
    expect(context).toMatchObject({
      platform: "youtube",
      title: "Meu vídeo",
      authorName: "Canal Teste",
      platformLabels: ["Conteúdo alterado ou sintético"],
    });
    expect(context.authorStatements).toContain("Este vídeo foi gerado por IA. #Sora");
    expect(context.hashtags).toContain("#sora");
  });
});
