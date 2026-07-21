function escapeForRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Casa `term` como palavra/frase inteira, não como substring de outra palavra.
 * `\b` nativo do JS classifica letras acentuadas como "não-palavra", então falha
 * silenciosamente em termos pt-BR como "última" ou "só" quando adjacentes a um
 * limite (ex.: precedido de espaço). Usamos lookaround com \p{L}/\p{N} (unicode-aware)
 * em vez de \b para que acentos sejam tratados como letras nos dois lados do termo.
 */
export function wholeWord(term: string): RegExp {
  const escaped = escapeForRegExp(term);
  return new RegExp(`(?<![\\p{L}\\p{N}_])${escaped}(?![\\p{L}\\p{N}_])`, "iu");
}

/** Casa `text` como o conteúdo inteiro de uma linha (usado para hashtags exatas). */
export function exactLine(text: string): RegExp {
  return new RegExp(`^${escapeForRegExp(text)}$`, "im");
}
