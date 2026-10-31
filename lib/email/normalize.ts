export type EmailLink = { label: string; url: string };

export type NormalizedEmail = {
  subject: string;
  body: string;
  links: EmailLink[];
};

function decodeEntities(value: string): string {
  const named: Record<string, string> = {
    amp: "&",
    apos: "'",
    gt: ">",
    lt: "<",
    nbsp: " ",
    quot: '"',
    "#39": "'",
  };

  return value.replace(
    /&(#x[\da-f]+|#\d+|[a-z]+);/gi,
    (entity, token: string) => {
      if (token.startsWith("#x")) {
        const point = Number.parseInt(token.slice(2), 16);
        return Number.isSafeInteger(point) && point > 0 && point <= 0x10ffff
          ? String.fromCodePoint(point)
          : entity;
      }
      if (token.startsWith("#")) {
        const point = Number.parseInt(token.slice(1), 10);
        return Number.isSafeInteger(point) && point > 0 && point <= 0x10ffff
          ? String.fromCodePoint(point)
          : entity;
      }
      return named[token.toLowerCase()] ?? entity;
    },
  );
}

function safeHttpUrl(value: string): string | null {
  try {
    const url = new URL(value);
    if (
      (url.protocol !== "https:" && url.protocol !== "http:") ||
      url.username ||
      url.password
    ) {
      return null;
    }
    return url.toString();
  } catch {
    return null;
  }
}

function plainText(fragment: string): string {
  return decodeEntities(
    fragment
      .replace(
        /<(script|style|head|svg|iframe|object)\b[^>]*>[\s\S]*?<\/\1\s*>/gi,
        " ",
      )
      .replace(/<(?:br|\/p|\/div|\/li|\/tr|\/h[1-6])\b[^>]*>/gi, "\n")
      .replace(/<[^>]*>/g, " "),
  );
}

export function normalizeEmail(input: {
  subject: string;
  body: string;
}): NormalizedEmail {
  const links: EmailLink[] = [];
  const bodyWithAnchors = input.body.replace(
    /<a\b[^>]*href\s*=\s*(["'])(.*?)\1[^>]*>([\s\S]*?)<\/a\s*>/gi,
    (_match, _quote: string, href: string, labelHtml: string) => {
      const url = safeHttpUrl(decodeEntities(href).trim());
      const label = plainText(labelHtml).replace(/\s+/g, " ").trim();
      if (url) links.push({ label, url });
      return label ? `${label} ${url ?? ""}` : (url ?? "");
    },
  );

  const body = plainText(bodyWithAnchors)
    .normalize("NFKC")
    .replace(/\r\n?/g, "\n")
    .replace(/[\t\f\v ]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  const subject = plainText(input.subject)
    .normalize("NFKC")
    .replace(/\s+/g, " ")
    .trim();

  const plainUrls = body.match(/https?:\/\/[^\s<>"')\]]+/gi) ?? [];
  for (const candidate of plainUrls) {
    const url = safeHttpUrl(candidate.replace(/[.,;:!?]+$/, ""));
    if (url && !links.some((link) => link.url === url)) {
      links.push({ label: "", url });
    }
  }

  return { subject, body, links };
}
