import { Defuddle as defaultDefuddle, type DefuddleOptions, type DefuddleResponse } from "defuddle/node";
import { parseHTML } from "linkedom";

export interface ExtractedHtmlContent {
  title: string;
  content: string;
  extractor: "defuddle" | "simple";
}

type DefuddleFn = (document: Document, url: string, options: DefuddleOptions) => Promise<Pick<DefuddleResponse, "title" | "content">>;

export interface ExtractHtmlContentOptions {
  defuddle?: DefuddleFn;
}

export async function extractHtmlContent(
  html: string,
  finalUrl: string,
  options: ExtractHtmlContentOptions = {},
): Promise<ExtractedHtmlContent> {
  const defuddle = options.defuddle ?? defaultDefuddle;

  try {
    const { document } = parseHTML(html);
    const result = await defuddle(document as unknown as Document, finalUrl, {
      markdown: true,
      useAsync: false,
    });
    const content = typeof result.content === "string" ? result.content.trim() : "";
    if (content) {
      return {
        title: typeof result.title === "string" ? result.title.trim() : "",
        content,
        extractor: "defuddle",
      };
    }
  } catch {
  }

  return { ...extractHtmlSimple(html, finalUrl), extractor: "simple" };
}

function extractHtmlSimple(html: string, finalUrl: string): { title: string; content: string } {
  const withoutScripts = html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, "");
  const title = decodeHtml(stripTags(withoutScripts.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "").trim());
  let body = withoutScripts.match(/<body[^>]*>([\s\S]*?)<\/body>/i)?.[1] ?? withoutScripts;

  body = body
    .replace(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, (_match, href: string, text: string) => {
      const label = decodeHtml(stripTags(text).trim());
      if (!label) return "";
      return `[${label}](${resolveUrl(href, finalUrl)})`;
    })
    .replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, "\n# $1\n")
    .replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, "\n## $1\n")
    .replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, "\n### $1\n")
    .replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, "\n- $1")
    .replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, "\n$1\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(div|section|article|main|ul|ol|blockquote)>/gi, "\n");

  const content = decodeHtml(stripTags(body))
    .split("\n")
    .map((line) => line.replace(/[ \t]+/g, " ").trim())
    .filter(Boolean)
    .join("\n");
  return { title, content };
}

function stripTags(value: string): string {
  return value.replace(/<[^>]+>/g, " ");
}

function resolveUrl(href: string, base: string): string {
  try {
    return new URL(href, base).toString();
  } catch {
    return href;
  }
}

function decodeHtml(value: string): string {
  return value
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}
