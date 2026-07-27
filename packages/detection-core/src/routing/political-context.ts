import type { VideoContext } from "@bp/shared";
import { wholeWord } from "../rules/pattern-utils";

export const POLITICAL_TERMS_VERSION = "2026.1";

const TERMS = {
  people: ["lula", "luiz inacio lula da silva", "bolsonaro", "jair bolsonaro"],
  election: [
    "eleicao",
    "eleicoes",
    "eleicao 2026",
    "eleicoes 2026",
    "campanha eleitoral",
    "propaganda eleitoral",
    "candidatura",
    "candidato",
    "candidata",
    "voto",
    "votacao",
    "urna",
    "urna eletronica",
    "primeiro turno",
    "segundo turno",
    "pesquisa eleitoral",
    "debate eleitoral",
    "horario eleitoral",
  ],
  institution: ["justica eleitoral", "tribunal superior eleitoral", "tse", "tre"],
  office: [
    "presidente",
    "presidente da republica",
    "vice-presidente",
    "governador",
    "governadora",
    "senador",
    "senadora",
    "deputado federal",
    "deputada federal",
    "deputado estadual",
    "deputada estadual",
    "deputado distrital",
    "deputada distrital",
  ],
  party: [
    "partido dos trabalhadores",
    "partido liberal",
    "movimento democratico brasileiro",
    "mdb",
    "partido social democratico",
    "psd",
    "partido socialismo e liberdade",
    "psol",
  ],
} as const;

type PoliticalCategory = keyof typeof TERMS | "party_acronym";

export interface PoliticalContextResult {
  detected: boolean;
  categories: PoliticalCategory[];
  matches: string[];
  version: string;
}

const AMBIGUOUS_PARTIES = ["pt", "pl"] as const;
const AMBIGUOUS_ANCHORS = [
  "partido",
  "candidato",
  "candidata",
  "eleicao",
  "eleicoes",
  "campanha",
  "voto",
  "deputado",
  "deputada",
  "senador",
  "senadora",
  "presidente",
  "governador",
  "governadora",
];

function normalize(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLocaleLowerCase("pt-BR")
    .replace(/\s+/g, " ")
    .trim();
}

function textFields(context: VideoContext): string[] {
  return [
    context.title,
    context.description,
    context.authorName,
    ...context.ariaLabels,
    ...context.captions,
    ...(context.authorStatements ?? []),
    ...(context.platformLabels ?? []),
  ]
    .filter((value): value is string => Boolean(value))
    .map(normalize);
}

export function detectPoliticalContext(context: VideoContext): PoliticalContextResult {
  const categories = new Set<PoliticalCategory>();
  const matches = new Set<string>();
  const fields = textFields(context);

  for (const [category, terms] of Object.entries(TERMS) as Array<[
    keyof typeof TERMS,
    readonly string[],
  ]>) {
    for (const term of terms) {
      if (fields.some((field) => wholeWord(term).test(field))) {
        categories.add(category);
        matches.add(term);
      }
    }
  }

  for (const party of AMBIGUOUS_PARTIES) {
    const exactHashtag = context.hashtags.some((tag) => normalize(tag) === `#${party}`);
    const anchoredText = fields.some(
      (field) =>
        wholeWord(party).test(field) &&
        AMBIGUOUS_ANCHORS.some((anchor) => wholeWord(anchor).test(field)),
    );
    if (exactHashtag || anchoredText) {
      categories.add("party_acronym");
      matches.add(party);
    }
  }

  const politicalHashtags = new Map([
    ["#lula", "lula"],
    ["#bolsonaro", "bolsonaro"],
    ["#eleicoes2026", "eleicoes 2026"],
  ]);
  for (const tag of context.hashtags.map(normalize)) {
    const term = politicalHashtags.get(tag);
    if (term) {
      categories.add(term === "eleicoes 2026" ? "election" : "people");
      matches.add(term);
    }
  }

  return {
    detected: matches.size > 0,
    categories: [...categories],
    matches: [...matches],
    version: POLITICAL_TERMS_VERSION,
  };
}
