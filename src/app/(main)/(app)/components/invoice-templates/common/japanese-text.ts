import { INVOICE_PDF_FONTS } from "@/config";

/**
 * The family a Japanese invoice is set in, in both templates.
 *
 * It replaces the template's own family rather than backing it up as a fallback
 * (`fontFamily: ["Open Sans", "Noto Sans JP"]`): react-pdf loads every family a style names
 * before it lays out a page, so a fallback would download the Japanese font -- megabytes, not
 * kilobytes -- for every invoice in every language.
 */
const JAPANESE_FONT_FAMILY = "Noto Sans JP";

/**
 * The argument to `Font.register` for {@link JAPANESE_FONT_FAMILY}.
 *
 * Kept here rather than inline because the browser and node builds of react-pdf keep separate
 * registries, so the templates and the server renderer each register it. The Stripe
 * template's medium (500) and semibold (600) resolve to these two, the way CSS falls back.
 */
export const JAPANESE_FONT = {
  family: JAPANESE_FONT_FAMILY,
  fonts: [
    { src: INVOICE_PDF_FONTS.JAPANESE.NOTO_SANS_JP_REGULAR, fontWeight: 400 },
    { src: INVOICE_PDF_FONTS.JAPANESE.NOTO_SANS_JP_700, fontWeight: 700 },
  ],
};

/**
 * Swap the font family of every style that names one for {@link JAPANESE_FONT_FAMILY}.
 *
 * The templates set the family on the page and again on each bold style, so swapping the
 * page alone would leave the bold labels in a font without kanji -- blank in the PDF.
 */
export function withJapaneseFont<T extends Record<string, object>>(
  styles: T,
): T {
  const swapped: Record<string, object> = {};

  for (const [name, style] of Object.entries(styles)) {
    swapped[name] =
      "fontFamily" in style
        ? { ...style, fontFamily: JAPANESE_FONT_FAMILY }
        : style;
  }

  return swapped as T;
}

/** Kanji, hiragana, katakana, and the full-width punctuation and forms that go with them. */
const JAPANESE =
  /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\u3000-\u303F\u30FC\uFF00-\uFFEF]/u;

/**
 * Characters a Japanese line may not start with (行頭禁則): closing brackets, the comma and
 * full stop, the long vowel mark, iteration marks and small kana. Each one stays on the line
 * of the character before it.
 */
const NO_LINE_START =
  /[、。，．・：；？！ー々ゝゞヽヾ…‥）」』】〕〉》〙〗｝］〟’”ぁぃぅぇぉっゃゅょゎゕゖァィゥェォッャュョヮヵヶ〜～]/u;

/** Characters a Japanese line may not end with (行末禁則): opening brackets. */
const NO_LINE_END = /[（「『【〔〈《〘〖｛［〝‘“]/u;

/**
 * The hyphenation callback for `Font.registerHyphenationCallback`, which also decides where
 * a line may break.
 *
 * react-pdf finds line breaks only at spaces and at the points this callback returns, and
 * Japanese is written without spaces: a seller's address or an item name in Japanese is one
 * long "word" to it, which overflows its table cell instead of wrapping. So a word with
 * Japanese in it is split between characters, the way Japanese text wraps, keeping the
 * characters together that the line-breaking rules (禁則処理) do not allow apart, and keeping
 * any Latin or digits inside it ("INV-2025-001", "10,000") in one piece.
 *
 * The empty string between the pieces is what makes them a break without a hyphen: react-pdf
 * reads it as zero-width space, where an adjacent piece would be a hyphenation point.
 *
 * Every other word goes to react-pdf's own hyphenation unchanged, so the other languages lay
 * out exactly as before.
 */
export function hyphenateJapanese(
  word: string,
  builtinHyphenate?: (word: string) => string[],
): string[] {
  if (!JAPANESE.test(word)) {
    return builtinHyphenate ? builtinHyphenate(word) : [word];
  }

  const pieces: string[] = [];

  for (const char of word) {
    const previous = pieces.at(-1);
    const previousChar = previous ? Array.from(previous).at(-1) : undefined;

    const staysWithPrevious =
      previousChar !== undefined &&
      (NO_LINE_START.test(char) ||
        NO_LINE_END.test(previousChar) ||
        (!JAPANESE.test(char) && !JAPANESE.test(previousChar)));

    if (staysWithPrevious) {
      pieces[pieces.length - 1] = `${previous}${char}`;
    } else {
      pieces.push(char);
    }
  }

  return pieces.flatMap((piece, index) => {
    return index === 0 ? [piece] : ["", piece];
  });
}
