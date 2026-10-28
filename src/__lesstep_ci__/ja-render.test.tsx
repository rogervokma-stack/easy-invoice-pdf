// @vitest-environment node

// CI-only check on the Lesstep fork (not part of the pull request): renders Japanese invoices
// with both templates and writes the PDFs to /tmp/ja-pdf for a visual check.
import { mkdirSync, writeFileSync } from "node:fs";

// eslint-disable-next-line no-restricted-imports
import { Font, renderToBuffer } from "@react-pdf/renderer";
import { describe, expect, it, vi } from "vitest";

import { calculateInvoiceTotal } from "@/app/(main)/(app)/components/invoice-form/utils/calculate-invoice-total";
import { calculateItemTotals } from "@/app/(main)/(app)/components/invoice-form/utils/calculate-item-totals";
import {
  hyphenateJapanese,
  JAPANESE_FONT,
} from "@/app/(main)/(app)/components/invoice-templates/common/japanese-text";
import { StripeInvoicePdfTemplate } from "@/app/(main)/(app)/components/invoice-templates/invoice-pdf-stripe-template";
import { getDefaultInvoiceNumberLabel } from "@/app/(main)/(app)/pdf-i18n-translations/pdf-translations";
import {
  extractPdfText,
  SERVER_PDF_MOCK_INVOICE_DATA,
} from "@/app/api/generate-invoice/__tests__/pdf-test-utils";
import { renderInvoicePdfBuffer } from "@/app/api/generate-invoice/render-pdf-on-server";
import type { InvoiceData } from "@/app/schema";
import { INVOICE_PDF_FONTS } from "@/config";

vi.setConfig({ testTimeout: 120_000, hookTimeout: 120_000 });

vi.mock("@/env", async () => {
  const { TEST_ENV } =
    await import("@/app/api/generate-invoice/__tests__/test-env");

  return { env: TEST_ENV };
});

Font.register({
  family: "Inter",
  fonts: [
    { src: INVOICE_PDF_FONTS.STRIPE_TEMPLATE.INTER_REGULAR, fontWeight: 400 },
    { src: INVOICE_PDF_FONTS.STRIPE_TEMPLATE.INTER_MEDIUM, fontWeight: 500 },
    { src: INVOICE_PDF_FONTS.STRIPE_TEMPLATE.INTER_SEMIBOLD, fontWeight: 600 },
  ],
});
Font.register(JAPANESE_FONT);
Font.registerHyphenationCallback(hyphenateJapanese);

const OUT = "/tmp/ja-pdf";
mkdirSync(OUT, { recursive: true });

function buildJapaneseInvoice(template: "default" | "stripe"): InvoiceData {
  const items = [
    {
      name: "ウェブアプリの日本語化（画面の文言・エラー文・メールの翻訳、入力中の確定キーの不具合の修正、iPhone の Safari での表示確認を含む）",
      netPrice: 120_000,
      vat: 10,
      unit: "式",
    },
    {
      name: "保守（2025年12月分）",
      netPrice: 3_000,
      vat: 10,
      unit: "月",
    },
    {
      name: "お茶菓子",
      netPrice: 1_080,
      vat: 8,
      unit: "箱",
    },
  ].map((overrides) => {
    const item = calculateItemTotals({
      ...SERVER_PDF_MOCK_INVOICE_DATA.items[0],
      amount: 1,
      ...overrides,
    });

    if (!item) {
      throw new Error("Expected an item");
    }

    return item;
  });

  return {
    ...SERVER_PDF_MOCK_INVOICE_DATA,
    language: "ja",
    currency: "JPY",
    template,
    dateFormat: template === "stripe" ? "YYYY[年]M[月]D[日]" : "YYYY-MM-DD",
    invoiceNumberObject: {
      label: getDefaultInvoiceNumberLabel("ja", template),
      value: "INV-2025-012",
    },
    invoiceType: "適格請求書",
    dateOfServiceLabelText: "取引日",
    servicePeriodLabelText: "対象期間",
    taxLabelText: "消費税",
    paymentMethod: "銀行振込（みずほ銀行 丸の内支店 普通 1234567）",
    notes:
      "お振込手数料はご負担ください。ご不明な点は、請求書番号を添えてメールでお問い合わせください。（このメモは長い文章の折り返しを確かめるためのものです。）",
    seller: {
      ...SERVER_PDF_MOCK_INVOICE_DATA.seller,
      name: "株式会社サンプル商事",
      address:
        "〒100-0005 東京都千代田区丸の内一丁目9番2号 グラントウキョウサウスタワー41階（受付は3階です）",
      vatNo: "T1234567890123",
      vatNoLabelText: "登録番号",
      email: "billing@example.co.jp",
      notes: "担当：経理部",
    },
    buyer: {
      ...SERVER_PDF_MOCK_INVOICE_DATA.buyer,
      name: "Example Software Inc.（エグザンプル・ソフトウェア）",
      address: "548 Market St, San Francisco, CA 94104, USA",
      vatNo: "",
      vatNoLabelText: "登録番号",
      notes: "",
    },
    items,
    total: calculateInvoiceTotal(items),
  };
}

describe("Japanese invoice PDFs (Lesstep CI check)", () => {
  it("renders the default template", async () => {
    const buffer = await renderInvoicePdfBuffer({
      invoiceData: buildJapaneseInvoice("default"),
    });
    writeFileSync(`${OUT}/default-ja.pdf`, buffer);
    const text = await extractPdfText(buffer);
    writeFileSync(`${OUT}/default-ja.txt`, text);
    expect(text).toContain("請求元");
  });

  it("renders the Stripe template", async () => {
    const buffer = await renderToBuffer(
      <StripeInvoicePdfTemplate invoiceData={buildJapaneseInvoice("stripe")} />,
    );
    writeFileSync(`${OUT}/stripe-ja.pdf`, buffer);
    const text = await extractPdfText(buffer);
    writeFileSync(`${OUT}/stripe-ja.txt`, text);
    expect(text).toContain("請求書");
  });

  it("renders an English invoice as before", async () => {
    const buffer = await renderInvoicePdfBuffer({
      invoiceData: SERVER_PDF_MOCK_INVOICE_DATA,
    });
    writeFileSync(`${OUT}/default-en.pdf`, buffer);
  });

  it("splits Japanese words for line breaks and leaves others alone", () => {
    const builtin = (word: string) => {
      return [`<${word}>`];
    };
    writeFileSync(
      `${OUT}/hyphenate.json`,
      JSON.stringify(
        {
          latin: hyphenateJapanese("invoice", builtin),
          mixed: hyphenateJapanese("請求書（INV-2025-012）です。", builtin),
          kana: hyphenateJapanese("ちょっとまって", builtin),
        },
        null,
        1,
      ),
    );
    expect(hyphenateJapanese("invoice", builtin)).toEqual(["<invoice>"]);
  });
});
