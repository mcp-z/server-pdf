/**
 * pdf-document tool - Flowing documents with PDFKit native text flow.
 *
 * Best for: Reports, articles, letters, contracts, and any document with flowing text.
 * Uses PDFKit's native text flow with automatic pagination.
 *
 * Content flows sequentially from top to bottom, automatically breaking across pages.
 * No positioning required - just write content and it flows naturally.
 *
 * Default margins: 72pt (1 inch) for standard document formatting.
 */

import { type CallToolResult, getFileUri, ProtocolError, ProtocolErrorCode, type ToolModule, writeFile } from '@mcp-z/server';
import PDFDocument from 'pdfkit';
import { z } from 'zod';
import { DEFAULT_HEADING_FONT_SIZE, DEFAULT_TEXT_FONT_SIZE, getDefaultMargins, type Margins, type PageSizePreset } from '../../constants.ts';
import { registerEmojiFont } from '../../lib/emoji-renderer.ts';
import { hasEmoji, setupFonts, validateTextForFont } from '../../lib/fonts.ts';
import { resolveImageDimensions } from '../../lib/image-dimensions.ts';
import { extractTextOptions, type PDFOutput, pdfOutputSchema, resolvePageSize } from '../../lib/pdf-core.ts';
import { renderText, type TextRenderConfig } from '../../lib/pdf-helpers.ts';
import { flowingContentItemSchema } from '../../schemas/content.ts';
import type { StorageExtra } from '../../types.ts';

// ============================================================================
// Tool-specific schemas and types
// ============================================================================
// Note: Reusable schemas are now imported from ../../schemas/content.ts

const inputSchema = z.object({
  filename: z.string().optional().describe('Optional logical filename (metadata only). Storage uses UUID. Defaults to "document.pdf".'),
  title: z.string().optional().describe('Document title metadata'),
  author: z.string().optional().describe('Document author metadata'),
  font: z.string().optional().describe('Font strategy (default: auto). Built-ins: Helvetica, Times-Roman, Courier. Use a path or URL for Unicode.'),
  markdown: z.boolean().optional().describe('Enable markdown parsing (links, **bold**, *italic*). Default: false.'),
  color: z
    .object({
      background: z.string().optional().describe('Page background color (hex like "#000000" or named color). Default: white.'),
      hyperlink: z.string().optional().describe('Color for hyperlink text (hex like "#0066CC" or named color). Default: #0066CC (classic browser blue).'),
    })
    .optional()
    .describe('Color settings for the PDF'),
  pageSetup: z
    .object({
      size: z
        .union([z.enum(['LETTER', 'A4', 'LEGAL']), z.tuple([z.number(), z.number()])])
        .optional()
        .describe('Page size preset or custom [width, height] in points. LETTER: 612×792pt (8.5×11in). A4: 595×842pt (210×297mm). LEGAL: 612×1008pt (8.5×14in). Default: LETTER.'),
      margins: z
        .object({
          top: z.number(),
          bottom: z.number(),
          left: z.number(),
          right: z.number(),
        })
        .optional()
        .describe('Page margins in points. all 4 (top, bottom, left, right) are REQUIRED if provided. Defaults vary by page size (LETTER/LEGAL: 72pt, A4: ~56pt).'),
    })
    .optional()
    .describe('Page configuration including size and margins.'),
  content: z.array(flowingContentItemSchema).describe('Document content in flow order'),
});

const config = {
  title: 'Create PDF Document',
  description: `Create a flowing PDF document with automatic pagination.

Best for: Reports, articles, letters, contracts, and documents with sequential content.

Content flows naturally from top to bottom. Pages break automatically when content exceeds page height. Use "pageBreak" to force page breaks, "divider" for horizontal rules, and "spacer" for vertical spacing.

Supported content types:
- text: Body text with optional formatting (bold, italic, color, alignment)
- heading: Section headings (larger font, bold by default)
- image: Inline images that flow with content
- divider: Horizontal line separators
- spacer: Vertical whitespace
- pageBreak: Force new page

Default margins: Varies by page size (e.g., 72pt/1" for Letter, ~56pt for A4).`,
  inputSchema,
  outputSchema: z.object({
    result: pdfOutputSchema.extend({
      margins: z.object({
        top: z.number(),
        bottom: z.number(),
        left: z.number(),
        right: z.number(),
      }),
    }),
  }),
} as const;

export type Input = z.infer<typeof inputSchema>;

export default function createTool() {
  async function handler(args: Input, extra: StorageExtra): Promise<CallToolResult> {
    const { storageContext } = extra;
    const { resourceStoreUri, baseUrl, transport } = storageContext;
    const { filename = 'document.pdf', title, author, font, markdown, color, pageSetup, content } = args;
    const parseMarkdown = markdown ?? false;
    const hyperlinkColor = color?.hyperlink ?? '#0066CC';

    try {
      // Resolve page size and margins
      const resolvedPageSize = resolvePageSize(pageSetup?.size as PageSizePreset | [number, number] | undefined);

      const sizePreset = typeof pageSetup?.size === 'string' ? (pageSetup.size as PageSizePreset) : 'LETTER';
      const margins = pageSetup?.margins ?? getDefaultMargins(sizePreset);

      const docOptions = {
        info: {
          ...(title && { Title: title }),
          ...(author && { Author: author }),
          ...(filename && { Subject: filename }),
        },
        size: [resolvedPageSize.width, resolvedPageSize.height] as [number, number],
        margins: margins,
      };

      const doc = new PDFDocument({ ...docOptions, autoFirstPage: false });

      // Buffer accumulation
      const chunks: Buffer[] = [];
      doc.on('data', (c: Buffer) => chunks.push(c));
      const pdfPromise = new Promise<Buffer>((resolve, reject) => {
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);
      });

      // Setup fonts and emoji
      const contentText = JSON.stringify(content);
      const containsEmoji = hasEmoji(contentText);
      const emojiAvailable = containsEmoji ? registerEmojiFont() : false;
      const fonts = await setupFonts(doc, font);

      const warnings: string[] = [];

      // Track page count and apply background to ALL pages consistently
      let actualPageCount = 0;
      doc.on('pageAdded', () => {
        actualPageCount++;
        if (color?.background) {
          doc.rect(0, 0, resolvedPageSize.width, resolvedPageSize.height).fill(color.background);
          doc.fillColor('black');
        }
      });

      // Add first page explicitly - goes through same event handler as all other pages
      doc.addPage();

      // Validate text content
      for (const item of content) {
        if ((item.type === 'text' || item.type === 'heading') && item.text) {
          const fnt = item.bold ? fonts.bold : fonts.regular;
          const validation = validateTextForFont(item.text, fnt, undefined);
          if (validation.hasUnsupportedCharacters) {
            warnings.push(...validation.warnings);
          }
        }
      }

      // Get content width (page width minus margins)
      const contentWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;

      // Render flowing content
      for (const item of content) {
        switch (item.type) {
          case 'text': {
            const fontSize = item.fontSize ?? DEFAULT_TEXT_FONT_SIZE;
            const fnt = item.bold ? fonts.bold : fonts.regular;

            const options = extractTextOptions(item);
            options.width = item.width ?? contentWidth;

            const textConfig: TextRenderConfig = {
              typography: { fontSize, fontName: fnt, fonts },
              features: { enableEmoji: emojiAvailable, markdown: parseMarkdown },
              color: { hyperlinkColor },
              layout: { width: options.width, align: options.align, indent: options.indent },
              spacing: { lineGap: options.lineGap, paragraphGap: options.paragraphGap, characterSpacing: options.characterSpacing, wordSpacing: options.wordSpacing },
            };
            renderText(doc, item.text ?? '', textConfig);

            if (item.moveDown) {
              doc.moveDown(item.moveDown);
            }
            break;
          }

          case 'heading': {
            const fontSize = item.fontSize ?? DEFAULT_HEADING_FONT_SIZE;
            const fnt = item.bold !== false ? fonts.bold : fonts.regular;

            const options = extractTextOptions(item);
            options.width = item.width ?? contentWidth;

            const textConfig: TextRenderConfig = {
              typography: { fontSize, fontName: fnt, fonts },
              features: { enableEmoji: emojiAvailable, markdown: parseMarkdown },
              color: { hyperlinkColor },
              layout: { width: options.width, align: options.align, indent: options.indent },
              spacing: { lineGap: options.lineGap, paragraphGap: options.paragraphGap, characterSpacing: options.characterSpacing, wordSpacing: options.wordSpacing },
            };
            renderText(doc, item.text ?? '', textConfig);

            if (item.moveDown) {
              doc.moveDown(item.moveDown);
            }
            break;
          }

          case 'image': {
            const dimensions = resolveImageDimensions(
              item.imagePath,
              item.width ?? contentWidth, // Default to content width
              item.height
            );

            // Ensure image doesn't exceed content width
            const imgWidth = Math.min(dimensions.width, contentWidth);
            const imgHeight = dimensions.height * (imgWidth / dimensions.width);

            // Calculate X position based on alignment
            let imgX = doc.x;
            if (item.align === 'center') {
              imgX = doc.page.margins.left + (contentWidth - imgWidth) / 2;
            } else if (item.align === 'right') {
              imgX = doc.page.margins.left + contentWidth - imgWidth;
            }

            doc.image(item.imagePath, imgX, doc.y, {
              width: imgWidth,
              height: imgHeight,
            });
            doc.y += imgHeight;
            doc.moveDown(0.5); // Small spacing after image
            break;
          }

          case 'divider': {
            const marginTop = item.marginTop ?? 10;
            const marginBottom = item.marginBottom ?? 10;
            const thickness = item.thickness ?? 1;
            const color = item.color ?? '#cccccc';

            doc.y += marginTop;
            doc
              .lineWidth(thickness)
              .moveTo(doc.page.margins.left, doc.y)
              .lineTo(doc.page.width - doc.page.margins.right, doc.y)
              .stroke(color);
            doc.y += thickness + marginBottom;
            break;
          }

          case 'spacer': {
            doc.y += item.height;
            break;
          }

          case 'pageBreak': {
            doc.addPage();
            break;
          }
        }
      }

      doc.end();
      const pdfBuffer = await pdfPromise;

      // Write file
      const { storedName } = await writeFile(pdfBuffer, filename, { resourceStoreUri });

      // Generate URI
      const fileUri = getFileUri(storedName, transport, {
        resourceStoreUri,
        ...(baseUrl && { baseUrl }),
        endpoint: '/files',
      });

      const result: PDFOutput & { margins: Margins } = {
        operationSummary: `Created PDF document: ${filename}`,
        itemsProcessed: content.length,
        itemsChanged: 1,
        completedAt: new Date().toISOString(),
        documentId: storedName,
        filename,
        uri: fileUri,
        sizeBytes: pdfBuffer.length,
        pageCount: actualPageCount,
        margins,
        ...(warnings.length > 0 && { warnings }),
      };

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(result),
          },
        ],
        structuredContent: { result },
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new ProtocolError(ProtocolErrorCode.InternalError, `Error creating PDF document: ${message}`, {
        stack: error instanceof Error ? error.stack : undefined,
      });
    }
  }

  return {
    name: 'pdf-document',
    config,
    handler,
  } satisfies ToolModule;
}
