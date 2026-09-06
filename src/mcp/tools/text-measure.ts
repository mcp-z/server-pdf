/**
 * text-measure tool - Measure text dimensions before rendering.
 *
 * Best for: Planning layouts by measuring text width/height before rendering.
 * Returns exact dimensions based on font, size, and text content.
 */

import type { ToolModule } from '@mcp-z/server';
import { type CallToolResult, ProtocolError, ProtocolErrorCode } from '@mcp-z/server';
import PDFDocument from 'pdfkit';
import { z } from 'zod';
import { DEFAULT_TEXT_FONT_SIZE } from '../../constants.ts';
import { measureTextHeight, measureTextWidth } from '../../lib/content-measure.ts';
import { registerEmojiFont } from '../../lib/emoji-renderer.ts';
import { hasEmoji, setupFonts } from '../../lib/fonts.ts';

// ============================================================================
// Schemas
// ============================================================================

const textItemSchema = z.object({
  text: z.string().describe('Text content to measure'),
  fontSize: z.number().optional().describe('Font size in points (default: 12)'),
  bold: z.boolean().optional().describe('Use bold font weight (default: false)'),
  width: z.number().optional().describe('Constrain width for height calculation (enables text wrapping)'),
  lineGap: z.number().optional().describe('Extra spacing between lines in points (default: 0)'),
});

const inputSchema = z.object({
  items: z.array(textItemSchema).describe('Array of text items to measure'),
  font: z.string().optional().describe('Font specification (default: auto). Built-ins: Helvetica, Times-Roman, Courier. Use a path or URL for custom fonts.'),
});

const measurementResultSchema = z.object({
  text: z.string(),
  width: z.number().describe('Natural text width in points (single line)'),
  height: z.number().describe('Text height in points (accounts for wrapping if width specified)'),
  fontSize: z.number(),
  font: z.string(),
});

const outputSchema = z.object({
  measurements: z.array(measurementResultSchema),
  font: z.string().describe('Font used for measurements'),
});

const config = {
  title: 'Measure Text Dimensions',
  description: `Measure text width and height before rendering.

Returns exact dimensions based on font, font size, and text content. Use this to:
- Calculate text width to set proper container sizes
- Determine if text will fit in a given space
- Plan multi-line layouts by specifying width constraint

Width is measured as single-line natural width. Height accounts for text wrapping when width is specified.`,
  inputSchema,
  outputSchema,
} as const;

export type Input = z.infer<typeof inputSchema>;
export type Output = z.infer<typeof outputSchema>;

export default function createTool() {
  async function handler(args: Input): Promise<CallToolResult> {
    const { items, font } = args;

    try {
      // Create a temporary PDFDocument for measurements (not saved)
      const doc = new PDFDocument({ size: 'LETTER' });

      // Setup fonts
      const contentText = items.map((i) => i.text).join(' ');
      const containsEmoji = hasEmoji(contentText);
      const emojiAvailable = containsEmoji ? registerEmojiFont() : false;
      const fonts = await setupFonts(doc, font);
      const { regular: regularFont, bold: boldFont } = fonts;

      // Measure each item
      const measurements: z.infer<typeof measurementResultSchema>[] = [];

      for (const item of items) {
        const fontSize = item.fontSize ?? DEFAULT_TEXT_FONT_SIZE;
        const fontName = item.bold ? boldFont : regularFont;

        // Measure natural width (single line)
        const width = measureTextWidth(doc, item.text, fontSize, fontName, emojiAvailable);

        // Measure height (accounts for wrapping if width specified)
        const height = measureTextHeight(doc, item.text, fontSize, fontName, emojiAvailable, {
          width: item.width,
          lineGap: item.lineGap,
        });

        measurements.push({
          text: item.text,
          width: Math.round(width * 100) / 100, // Round to 2 decimal places
          height: Math.round(height * 100) / 100,
          fontSize,
          font: fontName,
        });
      }

      // Close doc (not saving, just cleaning up)
      doc.end();

      const result: Output = {
        measurements,
        font: regularFont,
      };

      return {
        content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
        structuredContent: result,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new ProtocolError(ProtocolErrorCode.InternalError, `Error measuring text: ${message}`, {
        stack: error instanceof Error ? error.stack : undefined,
      });
    }
  }

  return {
    name: 'text-measure',
    config,
    handler,
  } satisfies ToolModule;
}
