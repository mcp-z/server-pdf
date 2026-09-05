import { fonts } from '@mcp-z/mcp-pdf';
import assert from 'assert';
import { createWriteStream, existsSync, mkdirSync, readFileSync, statSync, unlinkSync, writeFileSync } from 'fs';
import { safeRmSync } from 'fs-remove-compat';
import { join } from 'path';
import PDFDocument from 'pdfkit';
import { registerEmojiFont } from '../../../src/lib/emoji-renderer.ts';
import { renderText } from '../../../src/lib/pdf-helpers.ts';

// Use .tmp/ in package root, never os.tmpdir() (testing-standards)
const testOutputDir = join(process.cwd(), '.tmp', 'fonts-tests');

describe('fonts.PDF_STANDARD_FONTS', (): void => {
  it('should contain all 14 standard PDF fonts', (): void => {
    assert.strictEqual(fonts.PDF_STANDARD_FONTS.length, 14);

    // Verify all standard fonts are present
    const expectedFonts = ['Helvetica', 'Helvetica-Bold', 'Helvetica-Oblique', 'Helvetica-BoldOblique', 'Times-Roman', 'Times-Bold', 'Times-Italic', 'Times-BoldItalic', 'Courier', 'Courier-Bold', 'Courier-Oblique', 'Courier-BoldOblique', 'Symbol', 'ZapfDingbats'] as const;

    for (const font of expectedFonts) {
      assert.ok((fonts.PDF_STANDARD_FONTS as readonly string[]).includes(font), `Should include ${font}`);
    }
  });
});

describe('fonts.hasEmoji', (): void => {
  it('returns false for ASCII-only text', (): void => {
    assert.strictEqual(fonts.hasEmoji('Hello World'), false);
    assert.strictEqual(fonts.hasEmoji('Test 123'), false);
    assert.strictEqual(fonts.hasEmoji(''), false);
  });

  it('returns false for Latin-1 characters', (): void => {
    assert.strictEqual(fonts.hasEmoji('Café'), false);
    assert.strictEqual(fonts.hasEmoji('résumé'), false);
  });

  it('returns false for non-emoji Unicode', (): void => {
    assert.strictEqual(fonts.hasEmoji('你好'), false);
    assert.strictEqual(fonts.hasEmoji('こんにちは'), false);
    assert.strictEqual(fonts.hasEmoji('Привет'), false);
  });

  it('returns false for Greek letters (render fine in standard fonts)', (): void => {
    assert.strictEqual(fonts.hasEmoji('Ξ'), false, 'Greek Xi should not be detected as emoji');
    assert.strictEqual(fonts.hasEmoji('Δ'), false, 'Greek Delta should not be detected as emoji');
    assert.strictEqual(fonts.hasEmoji('Ω'), false, 'Greek Omega should not be detected as emoji');
  });

  it('returns false for geometric shapes (render fine in standard fonts)', (): void => {
    assert.strictEqual(fonts.hasEmoji('△'), false, 'White triangle should not be detected as emoji');
    assert.strictEqual(fonts.hasEmoji('○'), false, 'White circle should not be detected as emoji');
    assert.strictEqual(fonts.hasEmoji('◆'), false, 'Black diamond should not be detected as emoji');
  });

  it('correctly identifies emoji per Unicode Standard', (): void => {
    // emoji-regex follows the official Unicode emoji list
    // ☑, ⚠, ✂ ARE emoji per Unicode Standard (they have color versions!)
    assert.strictEqual(fonts.hasEmoji('☑'), true, 'Checked ballot box IS an emoji per Unicode');
    assert.strictEqual(fonts.hasEmoji('⚠'), true, 'Warning sign IS an emoji per Unicode');
    assert.strictEqual(fonts.hasEmoji('✂'), true, 'Scissors IS an emoji per Unicode');

    // These are NOT on the official emoji list
    assert.strictEqual(fonts.hasEmoji('☐'), false, 'Ballot box is not an emoji');
    assert.strictEqual(fonts.hasEmoji('★'), false, 'Star is not an emoji');
    assert.strictEqual(fonts.hasEmoji('✓'), false, 'Check mark is not an emoji');
    assert.strictEqual(fonts.hasEmoji('✗'), false, 'X mark is not an emoji');
  });

  it('returns true for true color emoji (U+1F300-U+1F9FF)', (): void => {
    assert.strictEqual(fonts.hasEmoji('Hello 👋'), true, 'Waving hand is true emoji');
    assert.strictEqual(fonts.hasEmoji('😀'), true, 'Grinning face is true emoji');
    assert.strictEqual(fonts.hasEmoji('🎉'), true, 'Party popper is true emoji');
    assert.strictEqual(fonts.hasEmoji('🚀'), true, 'Rocket is true emoji');
  });

  it('returns true for extended emoji (U+1FA00-U+1FAFF)', (): void => {
    assert.strictEqual(fonts.hasEmoji('🪀'), true, 'Yo-yo is extended emoji');
    assert.strictEqual(fonts.hasEmoji('🫶'), true, 'Heart hands is extended emoji');
  });

  it('returns true for various true emoji categories', (): void => {
    assert.strictEqual(fonts.hasEmoji('💙'), true, 'Blue heart is true emoji');
    assert.strictEqual(fonts.hasEmoji('📱'), true, 'Mobile phone is true emoji');
    assert.strictEqual(fonts.hasEmoji('🔥'), true, 'Fire is true emoji');
    assert.strictEqual(fonts.hasEmoji('🏆'), true, 'Trophy is true emoji');
  });

  it('detects emoji in mixed content', (): void => {
    assert.strictEqual(fonts.hasEmoji('Skills: TypeScript 💙'), true);
    assert.strictEqual(fonts.hasEmoji('First place 🏆'), true);
  });

  it('correctly handles mixed symbols and emoji', (): void => {
    // Only symbols (not emoji)
    assert.strictEqual(fonts.hasEmoji('Ξ △ ☐ ○'), false, 'Only standard symbols should return false');

    // Mixed: symbols + true emoji
    assert.strictEqual(fonts.hasEmoji('Ξ △ ☐ ○ 😀'), true, 'Mix with true emoji should return true');
  });
});

describe('fonts.needsUnicodeFont', (): void => {
  it('returns false for ASCII-only text', (): void => {
    assert.strictEqual(fonts.needsUnicodeFont('Hello World'), false);
    assert.strictEqual(fonts.needsUnicodeFont('Test 123'), false);
    assert.strictEqual(fonts.needsUnicodeFont(''), false);
  });

  it('returns false for Latin-1 characters', (): void => {
    assert.strictEqual(fonts.needsUnicodeFont('Café'), false);
    assert.strictEqual(fonts.needsUnicodeFont('résumé'), false);
    assert.strictEqual(fonts.needsUnicodeFont('naïve'), false);
  });

  it('returns true for emoji', (): void => {
    assert.strictEqual(fonts.needsUnicodeFont('Hello 👋'), true);
    assert.strictEqual(fonts.needsUnicodeFont('😀 🎉'), true);
    assert.strictEqual(fonts.needsUnicodeFont('Test ✅'), true);
  });

  it('returns true for CJK characters', (): void => {
    assert.strictEqual(fonts.needsUnicodeFont('你好'), true);
    assert.strictEqual(fonts.needsUnicodeFont('こんにちは'), true);
    assert.strictEqual(fonts.needsUnicodeFont('안녕하세요'), true);
  });

  it('returns true for Cyrillic', (): void => {
    assert.strictEqual(fonts.needsUnicodeFont('Привет'), true);
    assert.strictEqual(fonts.needsUnicodeFont('Здравствуйте'), true);
  });

  it('returns true for Arabic', (): void => {
    assert.strictEqual(fonts.needsUnicodeFont('مرحبا'), true);
    assert.strictEqual(fonts.needsUnicodeFont('السلام عليكم'), true);
  });

  it('returns correctly for special symbols', (): void => {
    // ™ and € are beyond Latin-1, need Unicode
    assert.strictEqual(fonts.needsUnicodeFont('™'), true);
    assert.strictEqual(fonts.needsUnicodeFont('€'), true);
    // © and ® are in Latin-1 (0x00-0xFF), don't need Unicode
    assert.strictEqual(fonts.needsUnicodeFont('©'), false);
    assert.strictEqual(fonts.needsUnicodeFont('®'), false);
  });
});

describe('fonts.getSystemFont', (): void => {
  it('returns a font path or null', (): void => {
    const result: string | null = fonts.getSystemFont();
    // Result should be either null or a string path
    assert.ok(result === null || typeof result === 'string');
  });

  it('returns existing font path if found', (): void => {
    const result: string | null = fonts.getSystemFont();
    if (result !== null) {
      assert.ok(existsSync(result), `Font path should exist: ${result}`);
    }
  });
});

describe('fonts.resolveFont', (): void => {
  describe('built-in PDF fonts', (): void => {
    it('resolves Helvetica', async (): Promise<void> => {
      const result: string | null = await fonts.resolveFont('Helvetica');
      assert.strictEqual(result, 'Helvetica');
    });

    it('resolves Helvetica-Bold', async (): Promise<void> => {
      const result: string | null = await fonts.resolveFont('Helvetica-Bold');
      assert.strictEqual(result, 'Helvetica-Bold');
    });

    it('resolves Times-Roman', async (): Promise<void> => {
      const result: string | null = await fonts.resolveFont('Times-Roman');
      assert.strictEqual(result, 'Times-Roman');
    });

    it('resolves Courier-Oblique', async (): Promise<void> => {
      const result: string | null = await fonts.resolveFont('Courier-Oblique');
      assert.strictEqual(result, 'Courier-Oblique');
    });

    it('resolves Symbol', async (): Promise<void> => {
      const result: string | null = await fonts.resolveFont('Symbol');
      assert.strictEqual(result, 'Symbol');
    });

    it('resolves ZapfDingbats', async (): Promise<void> => {
      const result: string | null = await fonts.resolveFont('ZapfDingbats');
      assert.strictEqual(result, 'ZapfDingbats');
    });

    it('resolves all 14 standard fonts', async (): Promise<void> => {
      for (const fontName of fonts.PDF_STANDARD_FONTS) {
        const result: string | null = await fonts.resolveFont(fontName);
        assert.strictEqual(result, fontName, `Should resolve ${fontName}`);
      }
    });
  });

  describe('auto-detect', (): void => {
    it('resolves "auto" to system font', async (): Promise<void> => {
      const result: string | null = await fonts.resolveFont('auto');
      // Should be either null (no font found) or a path
      assert.ok(result === null || typeof result === 'string');
    });
  });

  describe('absolute paths', (): void => {
    before(() => {
      mkdirSync(testOutputDir, { recursive: true });
    });

    after(() => {
      if (existsSync(testOutputDir)) {
        safeRmSync(testOutputDir, { recursive: true, force: true });
      }
    });

    it('resolves existing absolute path', async (): Promise<void> => {
      // Create a temp file to test
      const testFont: string = join(testOutputDir, 'test.ttf');
      writeFileSync(testFont, 'fake font data');

      const result: string | null = await fonts.resolveFont(testFont);
      assert.strictEqual(result, testFont);
    });

    it('returns null for non-existent path', async (): Promise<void> => {
      const result: string | null = await fonts.resolveFont('/nonexistent/font.ttf');
      assert.strictEqual(result, null);
    });

    it('handles Windows paths', async (): Promise<void> => {
      const result: string | null = await fonts.resolveFont('C:\\Windows\\Fonts\\nonexistent.ttf');
      // Should return null since file doesn't exist
      assert.strictEqual(result, null);
    });
  });

  describe('URLs', (): void => {
    it('downloads font from valid URL', async (): Promise<void> => {
      // This will actually download - use a small font
      const url: string = 'https://cdn.jsdelivr.net/npm/@fontsource/noto-sans@5.0.0/files/noto-sans-latin-400-normal.woff2';
      const result: string | null = await fonts.resolveFont(url);

      assert.ok(result !== null, 'Should download font');
      assert.ok(typeof result === 'string', 'Should return path string');
      assert.ok(existsSync(result), 'Downloaded font should exist');
    });

    it('throws error for invalid URL', async (): Promise<void> => {
      await assert.rejects(async () => await fonts.resolveFont('https://invalid.example.com/font.ttf'), /fetch failed|ENOTFOUND/, 'Should throw error for invalid URL');
    });
  });

  describe('invalid fonts', (): void => {
    it('returns null for unknown font name', async (): Promise<void> => {
      const result: string | null = await fonts.resolveFont('UnknownFont');
      assert.strictEqual(result, null);
    });

    it('returns null for empty string', async (): Promise<void> => {
      const result: string | null = await fonts.resolveFont('');
      assert.strictEqual(result, null);
    });
  });
});

async function createTestPDF(outputDir: string, filename: string, text: string, fontSpec?: string): Promise<string> {
  const outputPath = join(outputDir, filename);

  const doc = new PDFDocument();
  const stream = createWriteStream(outputPath);
  doc.pipe(stream);

  // Setup fonts
  const fontSet = await fonts.setupFonts(doc, fontSpec);
  doc.font(fontSet.regular).fontSize(24).text(text);
  doc.end();

  await new Promise<void>((resolve, reject) => {
    stream.on('finish', () => resolve());
    stream.on('error', reject);
  });

  return outputPath;
}

describe('Chinese/CJK Character Rendering', (): void => {
  const testOutputDir = join(process.cwd(), '.tmp', 'chinese-tests');
  before(() => {
    mkdirSync(testOutputDir, { recursive: true });
  });

  after(() => {
    if (existsSync(testOutputDir)) {
      safeRmSync(testOutputDir, { recursive: true, force: true });
    }
  });

  it('should detect Chinese characters need Unicode font', async (): Promise<void> => {
    // Traditional Chinese
    assert.strictEqual(fonts.needsUnicodeFont('很久很久以前'), true);
    assert.strictEqual(fonts.needsUnicodeFont('凱文·馬拉科夫的傳奇'), true);

    // Simplified Chinese
    assert.strictEqual(fonts.needsUnicodeFont('很久很久以前'), true);

    // Japanese
    assert.strictEqual(fonts.needsUnicodeFont('こんにちは世界'), true);

    // Korean
    assert.strictEqual(fonts.needsUnicodeFont('안녕하세요'), true);

    // Mixed English and Chinese
    assert.strictEqual(fonts.needsUnicodeFont('Hello 世界'), true);
  });

  it('should render Chinese characters with auto font detection', async (): Promise<void> => {
    const outputPath = join(testOutputDir, `test-chinese-${Date.now()}.pdf`);

    try {
      const doc = new PDFDocument();
      const stream = doc.pipe(createWriteStream(outputPath));

      // Setup fonts with auto-detection
      const fontSet = await fonts.setupFonts(doc, 'auto');

      // Render Chinese text
      const chineseText = '測試中文字符渲染';
      renderText(doc, chineseText, {
        typography: { fontSize: 12, fontName: fontSet.regular },
        features: { enableEmoji: false },
      });

      // Render mixed text
      const mixedText = 'Hello 世界 World';
      renderText(doc, mixedText, {
        typography: { fontSize: 12, fontName: fontSet.regular },
        features: { enableEmoji: false },
      });

      doc.end();

      // Wait for PDF to be written
      await new Promise<void>((resolve, reject) => {
        stream.on('finish', () => resolve());
        stream.on('error', reject);
      });

      // Verify PDF was created
      assert.ok(existsSync(outputPath), 'PDF should be created');
      const stats = statSync(outputPath);
      assert.ok(stats.size > 0, 'PDF should have content');
    } finally {
      // Clean up
      if (existsSync(outputPath)) {
        unlinkSync(outputPath);
      }
    }
  });

  it('should render Cantonese/Traditional Chinese text', async (): Promise<void> => {
    const outputPath = join(testOutputDir, `test-cantonese-${Date.now()}.pdf`);

    try {
      const doc = new PDFDocument({
        margins: { top: 50, bottom: 50, left: 50, right: 50 },
      });
      const stream = doc.pipe(createWriteStream(outputPath));

      // Setup fonts with auto-detection
      const fontSet = await fonts.setupFonts(doc, 'auto');

      // Render traditional Chinese headings and text
      const heading = '凱文·馬拉科夫的傳奇';
      const body = '在銀河系需要英雄的時代，一位工程師發現自己擁有一種罕見的天賦。';

      doc.font(fontSet.bold);
      doc.fontSize(24);
      doc.text(heading, { align: 'center' });

      doc.moveDown();

      doc.font(fontSet.regular);
      doc.fontSize(12);
      doc.text(body);

      doc.end();

      // Wait for PDF to be written
      await new Promise<void>((resolve, reject) => {
        stream.on('finish', () => resolve());
        stream.on('error', reject);
      });

      // Verify PDF was created
      assert.ok(existsSync(outputPath), 'PDF should be created');
      const stats = statSync(outputPath);
      assert.ok(stats.size > 0, 'PDF should have content');
    } finally {
      // Clean up
      if (existsSync(outputPath)) {
        unlinkSync(outputPath);
      }
    }
  });

  it('should handle Japanese characters', async (): Promise<void> => {
    const outputPath = join(testOutputDir, `test-japanese-${Date.now()}.pdf`);

    try {
      const doc = new PDFDocument();
      const stream = doc.pipe(createWriteStream(outputPath));

      const fontSet = await fonts.setupFonts(doc, 'auto');

      // Hiragana and Kanji
      const japaneseText = 'こんにちは世界。これはテストです。';
      renderText(doc, japaneseText, {
        typography: { fontSize: 12, fontName: fontSet.regular },
        features: { enableEmoji: false },
      });

      doc.end();

      await new Promise<void>((resolve, reject) => {
        stream.on('finish', () => resolve());
        stream.on('error', reject);
      });

      assert.ok(existsSync(outputPath), 'PDF should be created');
    } finally {
      if (existsSync(outputPath)) {
        unlinkSync(outputPath);
      }
    }
  });

  it('should handle Korean characters', async (): Promise<void> => {
    const outputPath = join(testOutputDir, `test-korean-${Date.now()}.pdf`);

    try {
      const doc = new PDFDocument();
      const stream = doc.pipe(createWriteStream(outputPath));

      const fontSet = await fonts.setupFonts(doc, 'auto');

      const koreanText = '안녕하세요 세계. 이것은 테스트입니다.';
      renderText(doc, koreanText, {
        typography: { fontSize: 12, fontName: fontSet.regular },
        features: { enableEmoji: false },
      });

      doc.end();

      await new Promise<void>((resolve, reject) => {
        stream.on('finish', () => resolve());
        stream.on('error', reject);
      });

      assert.ok(existsSync(outputPath), 'PDF should be created');
    } finally {
      if (existsSync(outputPath)) {
        unlinkSync(outputPath);
      }
    }
  });

  it('should handle mixed CJK and emoji', async (): Promise<void> => {
    const outputPath = join(testOutputDir, `test-mixed-cjk-emoji-${Date.now()}.pdf`);

    try {
      const doc = new PDFDocument();
      const stream = doc.pipe(createWriteStream(outputPath));

      // Register emoji font
      const emojiAvailable = registerEmojiFont();

      const fontSet = await fonts.setupFonts(doc, 'auto');

      // Chinese with emoji
      const mixedText = '你好 👋 世界 🌍';
      const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
      renderText(doc, mixedText, {
        typography: { fontSize: 12, fontName: fontSet.regular },
        features: { enableEmoji: emojiAvailable },
        layout: { width: pageWidth },
      });

      doc.end();

      await new Promise<void>((resolve, reject) => {
        stream.on('finish', () => resolve());
        stream.on('error', reject);
      });

      assert.ok(existsSync(outputPath), 'PDF should be created');
    } finally {
      if (existsSync(outputPath)) {
        unlinkSync(outputPath);
      }
    }
  });

  it('should gracefully handle missing Unicode font', async (): Promise<void> => {
    // This test verifies the fallback behavior when no Unicode font is available
    const doc = new PDFDocument();

    // Force a scenario where auto-detect might fail
    // fonts.setupFonts should fall back to Helvetica
    const fontSet = await fonts.setupFonts(doc, 'invalid-font-spec');

    // Should return Helvetica fallback
    assert.strictEqual(fontSet.regular, 'Helvetica');
    assert.strictEqual(fontSet.bold, 'Helvetica-Bold');
    assert.strictEqual(fontSet.italic, 'Helvetica-Oblique');
    assert.strictEqual(fontSet.boldItalic, 'Helvetica-BoldOblique');
  });

  it('should support Star Wars themed Chinese resume', async (): Promise<void> => {
    const outputPath = join(testOutputDir, `test-starwars-chinese-${Date.now()}.pdf`);

    try {
      const doc = new PDFDocument({
        size: [612, 792],
        margins: { top: 50, bottom: 50, left: 50, right: 50 },
      });
      const stream = doc.pipe(createWriteStream(outputPath));

      // Black background
      doc.rect(0, 0, 612, 792).fill('#000000');

      const fontSet = await fonts.setupFonts(doc, 'auto');

      // Star Wars opening crawl style
      doc.fillColor('#4A9EFF');
      doc.font(fontSet.regular);
      doc.fontSize(14);
      doc.text('很久很久以前，在一個不太遙遠的銀河系...', { align: 'center' });

      doc.moveDown(1.5);

      // Title
      doc.fillColor('#FFD700');
      doc.font(fontSet.bold);
      doc.fontSize(28);
      doc.text('凱文·馬拉科夫的傳奇', { align: 'center' });

      doc.moveDown(0.5);

      // Episode style
      doc.font(fontSet.italic);
      doc.fontSize(16);
      doc.text('第一章：英雄覺醒', { align: 'center' });

      doc.end();

      await new Promise<void>((resolve, reject) => {
        stream.on('finish', () => resolve());
        stream.on('error', reject);
      });

      assert.ok(existsSync(outputPath), 'PDF should be created');
      const stats = statSync(outputPath);
      assert.ok(stats.size > 0, 'PDF should have content');
    } finally {
      if (existsSync(outputPath)) {
        unlinkSync(outputPath);
      }
    }
  });
});

describe('Emoji and Unicode Rendering', (): void => {
  const testOutputDir = join(process.cwd(), '.tmp', 'emoji-tests');
  before(async () => {
    mkdirSync(testOutputDir, { recursive: true });
  });

  after(async () => {
    if (existsSync(testOutputDir)) {
      safeRmSync(testOutputDir, { recursive: true, force: true });
    }
  });

  it('detects emoji as needing Unicode font', (): void => {
    assert.strictEqual(fonts.needsUnicodeFont('Hello 👋'), true);
    assert.strictEqual(fonts.needsUnicodeFont('😀 🎉 🚀'), true);
    assert.strictEqual(fonts.needsUnicodeFont('Test ✅ ❌'), true);
  });

  it('creates PDF with emoji using default font', async (): Promise<void> => {
    const text = 'Hello World 👋 😀 🎉';
    const path = await createTestPDF(testOutputDir, 'emoji-default.pdf', text);

    assert.ok(existsSync(path), 'PDF should be created');
    const stats = readFileSync(path);
    assert.ok(stats.length > 0, 'PDF should have content');
    console.log(`    📄 Created: ${path} (${stats.length} bytes)`);
  });

  it('creates PDF with emoji using auto-detect font', async (): Promise<void> => {
    const text = 'Hello World 👋 😀 🎉';
    const path = await createTestPDF(testOutputDir, 'emoji-auto.pdf', text, 'auto');

    assert.ok(existsSync(path), 'PDF should be created');
    const stats = readFileSync(path);
    assert.ok(stats.length > 0, 'PDF should have content');
    console.log(`    📄 Created: ${path} (${stats.length} bytes)`);
  });

  it('creates PDF with various emoji categories', async (): Promise<void> => {
    const emojiTests = [
      { category: 'Smileys', text: '😀 😃 😄 😁 😆 😅 🤣 😂' },
      { category: 'Gestures', text: '👋 🤚 🖐 ✋ 🖖 👌 🤌' },
      { category: 'Symbols', text: '❤️ 💔 💯 ✅ ❌ ⭐ 🔥' },
      { category: 'Objects', text: '📱 💻 ⌨️ 🖥 🖨 📞 📧' },
    ];

    for (const { category, text } of emojiTests) {
      const filename = `emoji-${category.toLowerCase()}.pdf`;
      const path = await createTestPDF(testOutputDir, filename, `${category}: ${text}`, 'auto');

      assert.ok(existsSync(path), `${category} PDF should be created`);
      const stats = readFileSync(path);
      console.log(`    📄 ${category}: ${path} (${stats.length} bytes)`);
    }
  });

  it('creates PDF with CJK characters', async (): Promise<void> => {
    const text = '你好世界 こんにちは世界 안녕하세요 세계';
    const path = await createTestPDF(testOutputDir, 'unicode-cjk.pdf', text, 'auto');

    assert.ok(existsSync(path), 'CJK PDF should be created');
    const stats = readFileSync(path);
    assert.ok(stats.length > 0, 'PDF should have content');
    console.log(`    📄 Created: ${path} (${stats.length} bytes)`);
  });

  it('creates PDF with mixed ASCII and emoji', async (): Promise<void> => {
    const text = `
Technical Skills:
• TypeScript 💙
• Node.js ⚡
• React ⚛️
• Testing ✅

Achievements:
🏆 First place in hackathon
🎯 100% test coverage
🚀 Launched 5 products
		`;

    const path = await createTestPDF(testOutputDir, 'mixed-content.pdf', text, 'auto');

    assert.ok(existsSync(path), 'Mixed content PDF should be created');
    const stats = readFileSync(path);
    console.log(`    📄 Created: ${path} (${stats.length} bytes)`);
  });

  it('creates PDF with font from URL', async (): Promise<void> => {
    // Noto Sans has good Unicode coverage
    const fontUrl = 'https://cdn.jsdelivr.net/npm/@fontsource/noto-sans@5.0.0/files/noto-sans-latin-400-normal.woff2';
    const text = 'Hello World 👋 Testing with downloaded font';

    const path = await createTestPDF(testOutputDir, 'emoji-url-font.pdf', text, fontUrl);

    assert.ok(existsSync(path), 'PDF with URL font should be created');
    const stats = readFileSync(path);
    console.log(`    📄 Created: ${path} (${stats.length} bytes)`);
  });

  it('print test output directory', (): void => {
    console.log(`\n📁 Test PDFs generated in: ${testOutputDir}`);
    console.log('   Open these files to visually verify emoji rendering\n');
  });
});
