/**
 * pdf-image tool - Generate PNG image(s) from PDF pages.
 *
 * Best for: Viewing PDF output without opening external apps.
 * Returns PNG images of specified pages at controllable resolution.
 *
 * For minimal context usage, use viewportScale 0.25 (thumbnail) or 0.5 (preview).
 * Full scale (1.0) provides detailed view but larger file size.
 */

import { type CallToolResult, getFileUri, ProtocolError, ProtocolErrorCode, type ToolModule, writeFile } from '@mcp-z/server';
import { existsSync } from 'fs';
import { basename } from 'path';
import { type PngPageOutput, pdfToPng } from 'pdf-to-png-converter';
import { z } from 'zod';
import type { StorageExtra } from '../../types.ts';

// ============================================================================
// Schemas
// ============================================================================

const pagesSchema = z
  .union([z.number().int().min(1), z.array(z.number().int().min(1)), z.literal('all')])
  .optional()
  .describe('Pages to render: single number (e.g., 1), array (e.g., [1, 3, 5]), or "all". Default: 1');

const inputSchema = z.object({
  pdfPath: z.string().describe('Absolute path to the PDF file'),
  pages: pagesSchema,
  viewportScale: z.number().min(0.1).max(3.0).optional().describe('Scale factor for the image. Recommended: 0.25 (thumbnail, ~150px wide, smallest), 0.5 (preview, ~300px wide, good balance), 1.0 (full size, ~612px wide). Default: 0.5'),
});

const imageResultSchema = z.object({
  imagePath: z.string().describe('Path to the generated PNG image'),
  uri: z.string().describe('URI to access the image'),
  width: z.number().describe('Image width in pixels'),
  height: z.number().describe('Image height in pixels'),
  pageNumber: z.number().describe('Page number that was rendered'),
  fileSizeBytes: z.number().describe('File size in bytes'),
});

const outputSchema = z.object({
  images: z.array(imageResultSchema).describe('Array of generated images'),
  totalPages: z.number().describe('Total pages rendered'),
});

const config = {
  title: 'Convert PDF to Image',
  description: `Generate PNG image(s) from PDF pages.

Use this to visually verify PDF output without opening external applications.

**Pages Options:**
- Single page: \`pages: 1\` or \`pages: 3\`
- Multiple pages: \`pages: [1, 3, 5]\`
- All pages: \`pages: "all"\`
- Default: page 1 only

**Viewport Scale Recommendations:**
- **0.25 (thumbnail)**: ~150px wide, smallest file (~15-30KB). Use for quick verification.
- **0.5 (preview)**: ~300px wide, good balance (~40-80KB). **Recommended default.**
- **1.0 (full)**: ~612px wide, detailed view (~150-300KB). Use when details matter.

Lower scales produce smaller files, reducing context usage when sharing images.`,
  inputSchema,
  outputSchema,
} as const;

export type Input = z.infer<typeof inputSchema>;
export type Output = z.infer<typeof outputSchema>;

export default function createTool() {
  async function handler(args: Input, extra: StorageExtra): Promise<CallToolResult> {
    const { storageContext } = extra;
    const { resourceStoreUri, baseUrl, transport } = storageContext;
    const { pdfPath, pages = 1, viewportScale = 0.5 } = args;

    try {
      // Validate PDF exists
      if (!existsSync(pdfPath)) {
        throw new ProtocolError(ProtocolErrorCode.InvalidParams, `PDF file not found: ${pdfPath}`);
      }

      // Determine pages to process
      let pagesToProcess: number[];
      if (pages === 'all') {
        // Metadata-only pass never calls page.render(), so it's unaffected by the concurrency defect below.
        const metadata = await pdfToPng(pdfPath, { viewportScale, verbosityLevel: 0, returnMetadataOnly: true });
        pagesToProcess = metadata.map((page) => page.pageNumber);
      } else if (typeof pages === 'number') {
        pagesToProcess = [pages];
      } else {
        pagesToProcess = pages;
      }

      // One pdfToPng() call per page: Node 20's pdfjs-dist fake-worker hangs on concurrent page.render() calls sharing a PDFDocumentProxy.
      const pngPages: PngPageOutput[] = [];
      for (const pageNumber of pagesToProcess) {
        const rendered = await pdfToPng(pdfPath, {
          viewportScale,
          pagesToProcess: [pageNumber],
          verbosityLevel: 0,
        });
        pngPages.push(...rendered);
      }

      if (pngPages.length === 0) {
        throw new ProtocolError(ProtocolErrorCode.InternalError, 'Failed to render any pages. The PDF may be empty or invalid.');
      }

      const pdfBasename = basename(pdfPath, '.pdf');
      const images: z.infer<typeof imageResultSchema>[] = [];

      for (const pngPage of pngPages) {
        const pngBuffer = pngPage.content;
        const pageNum = pngPage.pageNumber;
        if (!pngBuffer) throw new ProtocolError(ProtocolErrorCode.InternalError, `Failed to render page ${pageNum}.`);

        // Generate output filename
        const outputFilename = `${pdfBasename}-p${pageNum}.png`;

        // Write to storage
        const { storedName } = await writeFile(pngBuffer, outputFilename, { resourceStoreUri });

        // Generate URI
        const uri = getFileUri(storedName, transport, {
          resourceStoreUri,
          ...(baseUrl && { baseUrl }),
          endpoint: '/files',
        });

        images.push({
          imagePath: storedName,
          uri,
          width: pngPage.width,
          height: pngPage.height,
          pageNumber: pageNum,
          fileSizeBytes: pngBuffer.length,
        });
      }

      const result: Output = {
        images,
        totalPages: images.length,
      };

      return {
        content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
        structuredContent: result,
      };
    } catch (error) {
      if (error instanceof ProtocolError) throw error;
      const message = error instanceof Error ? error.message : String(error);
      throw new ProtocolError(ProtocolErrorCode.InternalError, `Error generating PDF image: ${message}`, {
        stack: error instanceof Error ? error.stack : undefined,
      });
    }
  }

  return {
    name: 'pdf-image',
    config,
    handler,
  } satisfies ToolModule;
}
