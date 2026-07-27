const THUMBNAIL_SIZE = 9 * 8;

function differenceHash(pixels: Uint8Array): Uint8Array {
  if (pixels.length !== THUMBNAIL_SIZE) {
    throw new RangeError("cada amostra deve conter 9x8 pixels em escala de cinza");
  }

  const hash = new Uint8Array(8);
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      if (pixels[y * 9 + x]! < pixels[y * 9 + x + 1]!) {
        hash[y] = hash[y]! | (1 << (7 - x));
      }
    }
  }
  return hash;
}

/** SHA-256 da sequência de dHashes; não persiste pixels nem depende do JPEG original. */
export async function createFrameFingerprint(samples: readonly Uint8Array[]): Promise<string> {
  if (samples.length === 0) throw new RangeError("ao menos uma amostra é necessária");

  const compact = new Uint8Array(samples.length * 8);
  samples.forEach((sample, index) => compact.set(differenceHash(sample), index * 8));
  const digest = await crypto.subtle.digest("SHA-256", compact);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
