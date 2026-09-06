/**
 * pdf-layout tool - Fixed/absolute positioning layouts using Yoga flexbox.
 *
 * Best for: Dashboards, slides, certificates, flyers, and any design with precise positioning.
 * Uses Yoga layout engine for flexbox-based positioning within containers.
 *
 * All items are absolutely positioned on specific pages. Use the "page" property to target
 * different pages (e.g., page: 2 for slide decks). Pages are created as needed.
 *
 * Default margins: 0 (full canvas access for precise positioning)
 */

import { type CallToolResult, getFileUri, ProtocolError, ProtocolErrorCode, type ToolModule, writeFile } from '@mcp-z/server';
import { z } from 'zod';
import { DEFAULT_HEADING_FONT_SIZE, DEFAULT_TEXT_FONT_SIZE, type Margins, type PageSizePreset } from '../../constants.ts';
import { createWidthMeasurer, measureTextHeight } from '../../lib/content-measure.ts';
import { resolveImageDimensions } from '../../lib/image-dimensions.ts';
import { createPDFDocument, extractTextOptions, type PDFOutput, pdfOutputSchema, validateContentText } from '../../lib/pdf-core.ts';
import { renderText, type TextRenderConfig } from '../../lib/pdf-helpers.ts';
import { calculateLayout, type LayoutContent, type LayoutNode } from '../../lib/yoga-layout.ts';
import type { BaseContentItem } from '../../schemas/content.ts';
import { type ContentItem, contentItemSchema, type GroupItem, layoutSchema } from '../../schemas/layout.ts';
import type { StorageExtra } from '../../types.ts';

// ============================================================================
// Tool-specific schemas and types
// ============================================================================
// Note: Reusable schemas are now imported from ../../schemas/layout.ts and ../../schemas/content.ts

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
  layout: layoutSchema,
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
        .describe('Page margins in points. all 4 (top, bottom, left, right) are REQUIRED if provided. Default: 0 on all sides for full canvas access.'),
    })
    .optional()
    .describe('Page configuration including size, margins, and background color.'),
  content: z.array(contentItemSchema),
});

const config = {
  title: 'Create PDF Layout',
  description: `Create a PDF with precise positioning using Yoga flexbox layout.

Best for: Dashboards, slides, certificates, flyers, and designs requiring exact placement.

All items are positioned absolutely on specific pages. Use the "page" property to target different pages (e.g., page: 2 for multi-slide presentations). Pages are created as needed.

Use groups for flexbox containers - they support direction, gap, justify, alignItems, and alignment properties for sophisticated layouts.

Default margins: 0 (full canvas access for precise positioning).`,
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
export type Output = PDFOutput & { margins: Margins };

export default function createTool() {
  async function handler(args: Input, extra: StorageExtra): Promise<CallToolResult> {
    const { storageContext } = extra;
    const { resourceStoreUri, baseUrl, transport } = storageContext;
    const { filename = 'document.pdf', title, author, font, markdown, color, layout, pageSetup, content } = args;
    const parseMarkdown = markdown ?? false;
    const hyperlinkColor = color?.hyperlink ?? '#0066CC';
    const overflowBehavior = layout?.overflow ?? 'auto';

    try {
      // Create PDF document with shared utilities
      const contentText = JSON.stringify(content);
      const setup = await createPDFDocument(
        {
          title,
          author,
          subject: filename,
          pageSize: pageSetup?.size as PageSizePreset | [number, number] | undefined,
          margins: pageSetup?.margins ?? { top: 0, bottom: 0, left: 0, right: 0 },
          backgroundColor: color?.background,
        },
        font,
        contentText
      );

      const { doc, pdfPromise, fonts, emojiAvailable, warnings } = setup;

      // Validate text content against font
      validateContentText(content as ContentItem[], fonts.regular, fonts.bold, warnings);

      // Get page dimensions and margins
      const pageWidth = doc.page.width;
      const pageHeight = doc.page.height;
      const margins = {
        top: doc.page.margins.top,
        right: doc.page.margins.right,
        bottom: doc.page.margins.bottom,
        left: doc.page.margins.left,
      };

      // Height measurer for Yoga layout
      const measureHeight = (item: LayoutContent, availableWidth: number): number => {
        if (item.type === 'text' || item.type === 'heading') {
          if (!item.text) return 0;
          const fontSize = item.type === 'heading' ? ((item.fontSize as number) ?? DEFAULT_HEADING_FONT_SIZE) : ((item.fontSize as number) ?? DEFAULT_TEXT_FONT_SIZE);
          const fontName = item.type === 'heading' ? (item.bold !== false ? fonts.bold : fonts.regular) : item.bold ? fonts.bold : fonts.regular;
          let height = measureTextHeight(doc, item.text as string, fontSize, fontName, emojiAvailable, {
            width: availableWidth,
            indent: item.indent as number | undefined,
            lineGap: item.lineGap as number | undefined,
          });
          const moveDown = item.moveDown as number | undefined;
          if (moveDown !== undefined && moveDown > 0) {
            doc.fontSize(fontSize).font(fontName);
            height += moveDown * doc.currentLineHeight();
          }
          return height;
        }
        if (item.type === 'image') {
          const dimensions = resolveImageDimensions(item.imagePath as string, item.width as number | undefined, item.height as number | undefined);
          return dimensions.height;
        }
        if (item.type === 'rect') {
          return item.height as number;
        }
        if (item.type === 'circle') {
          return (item.radius as number) * 2;
        }
        if (item.type === 'line') {
          return Math.abs((item.y2 as number) - (item.y1 as number));
        }
        return 0;
      };

      // Render a base content item at computed position
      function renderBaseItem(item: BaseContentItem, computedX?: number, computedY?: number, computedWidth?: number) {
        switch (item.type) {
          case 'text': {
            const fontSize = item.fontSize ?? DEFAULT_TEXT_FONT_SIZE;
            const fnt = item.bold ? fonts.bold : fonts.regular;

            const options = extractTextOptions(item);
            if (computedX !== undefined) options.x = computedX;
            if (computedY !== undefined) options.y = computedY;
            if (computedWidth !== undefined) options.width = computedWidth;

            const textConfig: TextRenderConfig = {
              typography: { fontSize, fontName: fnt, fonts },
              features: { enableEmoji: emojiAvailable, markdown: parseMarkdown },
              color: { hyperlinkColor },
              layout: { x: options.x, y: options.y, width: options.width, align: options.align, indent: options.indent },
              spacing: { lineGap: options.lineGap, paragraphGap: options.paragraphGap, characterSpacing: options.characterSpacing, wordSpacing: options.wordSpacing, moveDown: options.moveDown },
            };
            renderText(doc, item.text ?? '', textConfig);
            break;
          }
          case 'heading': {
            const fontSize = item.fontSize ?? DEFAULT_HEADING_FONT_SIZE;
            const fnt = item.bold !== false ? fonts.bold : fonts.regular;

            const options = extractTextOptions(item);
            if (computedX !== undefined) options.x = computedX;
            if (computedY !== undefined) options.y = computedY;
            if (computedWidth !== undefined) options.width = computedWidth;

            const textConfig: TextRenderConfig = {
              typography: { fontSize, fontName: fnt, fonts },
              features: { enableEmoji: emojiAvailable, markdown: parseMarkdown },
              color: { hyperlinkColor },
              layout: { x: options.x, y: options.y, width: options.width, align: options.align, indent: options.indent },
              spacing: { lineGap: options.lineGap, paragraphGap: options.paragraphGap, characterSpacing: options.characterSpacing, wordSpacing: options.wordSpacing, moveDown: options.moveDown },
            };
            renderText(doc, item.text ?? '', textConfig);
            if (item.color) doc.fillColor('black');
            break;
          }
          case 'image': {
            const dimensions = resolveImageDimensions(item.imagePath, item.width as number | undefined, item.height as number | undefined);
            const opts = { width: dimensions.width, height: dimensions.height };

            const imgX = computedX ?? item.left;
            const imgY = computedY ?? item.top;

            if (imgX !== undefined && imgY !== undefined) {
              doc.image(item.imagePath, imgX, imgY, opts);
            } else {
              doc.image(item.imagePath, opts);
            }
            break;
          }
          case 'rect': {
            const rectX = computedX ?? item.left;
            const rectY = computedY ?? item.top;
            const rectWidth = computedWidth ?? item.width;

            doc.rect(rectX, rectY, rectWidth, item.height);
            if (item.fillColor && item.strokeColor) {
              if (item.lineWidth) doc.lineWidth(item.lineWidth);
              doc.fillAndStroke(item.fillColor, item.strokeColor);
            } else if (item.fillColor) {
              doc.fill(item.fillColor);
            } else if (item.strokeColor) {
              if (item.lineWidth) doc.lineWidth(item.lineWidth);
              doc.stroke(item.strokeColor);
            }
            doc.fillColor('black');
            break;
          }
          case 'circle': {
            const circleX = computedX ?? item.left;
            const circleY = computedY ?? item.top;

            doc.circle(circleX, circleY, item.radius);
            if (item.fillColor && item.strokeColor) {
              if (item.lineWidth) doc.lineWidth(item.lineWidth);
              doc.fillAndStroke(item.fillColor, item.strokeColor);
            } else if (item.fillColor) {
              doc.fill(item.fillColor);
            } else if (item.strokeColor) {
              if (item.lineWidth) doc.lineWidth(item.lineWidth);
              doc.stroke(item.strokeColor);
            }
            doc.fillColor('black');
            break;
          }
          case 'line': {
            if (item.lineWidth) doc.lineWidth(item.lineWidth);
            doc
              .moveTo(item.x1, item.y1)
              .lineTo(item.x2, item.y2)
              .stroke(item.strokeColor || 'black');
            break;
          }
        }
      }

      // Render a group with its visual properties
      function renderGroupVisuals(group: GroupItem, layoutNode: LayoutNode) {
        if (group.background) {
          doc.rect(layoutNode.x, layoutNode.y, layoutNode.width, layoutNode.height).fill(group.background);
          doc.fillColor('black');
        }

        if (group.border) {
          doc.lineWidth(group.border.width);
          doc.rect(layoutNode.x, layoutNode.y, layoutNode.width, layoutNode.height).stroke(group.border.color);
        }
      }

      // Render a layout node tree
      function renderLayoutNode(node: LayoutNode) {
        const item = node.content as ContentItem;

        if (item.type === 'group') {
          const group = item as GroupItem;
          renderGroupVisuals(group, node);

          if (node.children) {
            for (const childNode of node.children) {
              renderLayoutNode(childNode);
            }
          }
        } else {
          renderBaseItem(item as BaseContentItem, node.x, node.y, node.width);
        }
      }

      // Helper to get page number for an item
      function getItemPage(item: ContentItem): number {
        if ('page' in item && typeof item.page === 'number') return item.page;
        return 1;
      }

      // Group content by page number
      function groupContentByPage(items: ContentItem[]): Map<number, ContentItem[]> {
        const pageGroups = new Map<number, ContentItem[]>();
        for (const item of items) {
          const pageNum = getItemPage(item);
          const existing = pageGroups.get(pageNum) ?? [];
          existing.push(item);
          pageGroups.set(pageNum, existing);
        }
        return pageGroups;
      }

      // Group content by page
      const pageGroups = groupContentByPage(content as ContentItem[]);
      const maxPage = Math.max(...pageGroups.keys(), 1);

      // Width measurer for row layouts with space-between
      const measureWidth = createWidthMeasurer(doc, fonts.regular, fonts.bold, emojiAvailable);

      // Calculate layout and render per page
      for (let pageNum = 1; pageNum <= maxPage; pageNum++) {
        if (pageNum > 1) {
          doc.addPage();
        }

        // Get content for this page
        const pageContent = pageGroups.get(pageNum) ?? [];
        if (pageContent.length === 0) continue;

        // Convert to LayoutContent for Yoga
        const layoutContent: LayoutContent[] = pageContent.map((item) => {
          const layoutItem = item as unknown as LayoutContent;
          // Root items in pdf-layout default to absolute IF they have explicit coordinates
          // Items without coordinates (pure flex layouts) remain relative
          // Users can override with explicit position property
          if (layoutItem.position !== undefined) {
            return layoutItem; // Explicit position, use as-is
          }
          // Default: absolute if coordinates exist, relative otherwise
          const hasCoordinates = layoutItem.left !== undefined && layoutItem.top !== undefined;
          return {
            ...layoutItem,
            position: hasCoordinates ? 'absolute' : 'relative',
          };
        });

        // Calculate layout for THIS page only
        const layoutNodes = await calculateLayout(layoutContent, pageWidth, pageHeight, measureHeight, margins, measureWidth);

        // Check for content overflow when warn mode is enabled
        if (overflowBehavior === 'warn') {
          const getMaxBottom = (node: LayoutNode): number => {
            let maxBottom = node.y + node.height;
            if (node.children) {
              for (const child of node.children) {
                maxBottom = Math.max(maxBottom, getMaxBottom(child));
              }
            }
            return maxBottom;
          };

          for (const node of layoutNodes) {
            const bottom = getMaxBottom(node);
            if (bottom > pageHeight) {
              warnings.push(`Page ${pageNum}: Content exceeds page height by ${Math.ceil(bottom - pageHeight)}px. Consider reducing font sizes or removing content.`);
              break;
            }
          }
        }

        // Render items for this page
        for (const node of layoutNodes) {
          renderLayoutNode(node);
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

      const result: Output = {
        operationSummary: `Created PDF layout: ${filename}`,
        itemsProcessed: 1,
        itemsChanged: 1,
        completedAt: new Date().toISOString(),
        documentId: storedName,
        filename,
        uri: fileUri,
        sizeBytes: pdfBuffer.length,
        pageCount: setup.actualPageCount,
        margins: setup.doc.page.margins as Margins,
        ...(warnings.length > 0 && { warnings }),
      };

      return {
        content: [{ type: 'text' as const, text: JSON.stringify(result) }],
        structuredContent: { result },
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new ProtocolError(ProtocolErrorCode.InternalError, `Error creating PDF layout: ${message}`, {
        stack: error instanceof Error ? error.stack : undefined,
      });
    }
  }

  return {
    name: 'pdf-layout',
    config,
    handler,
  } satisfies ToolModule;
}
