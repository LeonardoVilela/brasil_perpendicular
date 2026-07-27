import { beforeEach, describe, expect, it } from "vitest";
import { twitterAdapter } from "./twitter";

const locationFor = (hostname: string) => ({ hostname }) as Location;

beforeEach(() => {
  document.body.innerHTML = "";
});

describe("twitterAdapter", () => {
  it("reconhece x.com e twitter.com", () => {
    expect(twitterAdapter.matches(locationFor("x.com"))).toBe(true);
    expect(twitterAdapter.matches(locationFor("mobile.twitter.com"))).toBe(true);
    expect(twitterAdapter.matches(locationFor("example.com"))).toBe(false);
  });

  it("não atribui ao autor o texto de um post citado", () => {
    document.body.innerHTML = `
      <article data-testid="tweet">
        <div data-testid="User-Name"><a role="link">Autor principal</a></div>
        <div data-testid="tweetText">Vídeo principal criado com IA</div>
        <video></video>
        <article data-testid="tweet">
          <div data-testid="tweetText">Texto do post citado</div>
        </article>
      </article>
    `;
    const context = twitterAdapter.extractContext(document.querySelector("video")!, document);
    expect(context.platform).toBe("twitter");
    expect(context.authorName).toBe("Autor principal");
    expect(context.authorStatements).toEqual(["Vídeo principal criado com IA"]);
  });
});
