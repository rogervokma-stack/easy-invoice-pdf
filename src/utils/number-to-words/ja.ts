const DIGITS = ["", "一", "二", "三", "四", "五", "六", "七", "八", "九"];

/** The places inside one four-digit group, from the thousands down. */
const PLACES = [
  [1000, "千"],
  [100, "百"],
  [10, "十"],
] as const;

/**
 * The scale words, one per four digits. Japanese groups by ten thousand rather than by a
 * thousand, so 999,999,999,999 is 9999 oku, 9999 man and 9999 -- the cap fits in two of them.
 */
const SCALES = [
  [100_000_000, "億"],
  [10_000, "万"],
] as const;

/**
 * Spell out 1 to 9999 in kanji numerals.
 *
 * A one in front of 千, 百 and 十 is left unsaid ("千二百", not "一千二百"), the way the
 * numbers are read aloud and written out in words.
 */
function groupToWords(value: number) {
  let rest = value;
  let words = "";

  for (const [place, word] of PLACES) {
    const digit = Math.floor(rest / place);

    if (digit > 0) {
      words += (digit === 1 ? "" : DIGITS[digit]) + word;
      rest -= digit * place;
    }
  }

  return words + DIGITS[rest];
}

/**
 * Japanese has no "and", no hyphens and no spaces between the parts of a number: each
 * four-digit group is followed by its scale word and the groups run together ("一万二千",
 * 12,000). The one in front of a scale word is said, unlike the one in front of a place
 * ("一万", not "万"), and a group of zero is skipped with its scale word ("一億五", 100,000,005).
 *
 * These are the everyday kanji numerals. The anti-forgery numerals of handwritten receipts
 * (壱, 弐, 参, 拾, "金壱萬円也") guard a figure someone could alter with a pen; a printed
 * invoice has no such risk, and they would make the line harder to read for nothing.
 */
export function toWords(value: number) {
  if (value === 0) {
    return "零";
  }

  let rest = value;
  let words = "";

  for (const [scale, word] of SCALES) {
    const group = Math.floor(rest / scale);

    if (group > 0) {
      words += groupToWords(group) + word;
      rest -= group * scale;
    }
  }

  return words + (rest > 0 ? groupToWords(rest) : "");
}
