/**
 * Tests for pdf-image tool
 */

import assert from 'assert';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { safeRmSync } from 'fs-remove-compat';
import { join } from 'path';
import PDFDocument from 'pdfkit';
import createTool from '../../../../src/mcp/tools/pdf-image.ts';
import { createExtra } from '../../../lib/create-extra.ts';
import { createTestConfig } from '../../../lib/create-test-config.ts';

// Use .tmp/ in package root, never os.tmpdir() (testing-standards)
const testOutputDir = join(process.cwd(), '.tmp', 'pdf-image-tests');
const testStorageDir = join(testOutputDir, 'storage');
const testPdfPath = join(testOutputDir, 'test-document.pdf');

describe('pdf-image tool', () => {
  const config = createTestConfig(testOutputDir, testStorageDir);
  const tool = createTool();
  const extra = createExtra(config);

  before((done) => {
    mkdirSync(testStorageDir, { recursive: true });

    // Create test PDF with 3 pages
    const doc = new PDFDocument({ size: 'LETTER' });
    const chunks: Buffer[] = [];

    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => {
      const pdfBuffer = Buffer.concat(chunks);
      writeFileSync(testPdfPath, pdfBuffer);
      done();
    });

    doc.fontSize(24).text('Page 1', 100, 100);
    doc.addPage();
    doc.fontSize(24).text('Page 2', 100, 100);
    doc.addPage();
    doc.fontSize(24).text('Page 3', 100, 100);
    doc.end();
  });

  after(() => {
    if (existsSync(testOutputDir)) {
      safeRmSync(testOutputDir, { recursive: true, force: true });
    }
  });

  it('renders single page by default', async () => {
    const result = await tool.handler(
      {
        pdfPath: testPdfPath,
      },
      extra
    );

    const output = result.structuredContent as { images: Array<{ pageNumber: number }>; totalPages: number };
    assert.strictEqual(output.totalPages, 1, 'Should render 1 page by default');
    assert.strictEqual(output.images[0].pageNumber, 1, 'Should render page 1');
  });

  it('renders specific single page', async () => {
    const result = await tool.handler(
      {
        pdfPath: testPdfPath,
        pages: 2,
      },
      extra
    );

    const output = result.structuredContent as { images: Array<{ pageNumber: number }>; totalPages: number };
    assert.strictEqual(output.totalPages, 1);
    assert.strictEqual(output.images[0].pageNumber, 2, 'Should render page 2');
  });

  it('renders multiple specific pages', async () => {
    const result = await tool.handler(
      {
        pdfPath: testPdfPath,
        pages: [1, 3],
      },
      extra
    );

    const output = result.structuredContent as { images: Array<{ pageNumber: number }>; totalPages: number };
    assert.strictEqual(output.totalPages, 2);
    assert.strictEqual(output.images[0].pageNumber, 1);
    assert.strictEqual(output.images[1].pageNumber, 3);
  });

  it('renders all pages', async () => {
    const result = await tool.handler(
      {
        pdfPath: testPdfPath,
        pages: 'all',
      },
      extra
    );

    const output = result.structuredContent as { images: Array<{ pageNumber: number }>; totalPages: number };
    assert.strictEqual(output.totalPages, 3, 'Should render all 3 pages');
  });

  it('respects viewportScale', async () => {
    const smallResult = await tool.handler(
      {
        pdfPath: testPdfPath,
        viewportScale: 0.25,
      },
      extra
    );

    const largeResult = await tool.handler(
      {
        pdfPath: testPdfPath,
        viewportScale: 1.0,
      },
      extra
    );

    const smallOutput = smallResult.structuredContent as { images: Array<{ width: number; fileSizeBytes: number }> };
    const largeOutput = largeResult.structuredContent as { images: Array<{ width: number; fileSizeBytes: number }> };

    assert.ok(largeOutput.images[0].width > smallOutput.images[0].width, 'Larger scale should produce wider image');
  });

  it('throws error for non-existent PDF', async () => {
    try {
      await tool.handler(
        {
          pdfPath: '/nonexistent/file.pdf',
        },
        extra
      );
      assert.fail('Should have thrown an error');
    } catch (error) {
      assert.ok(error instanceof Error);
      assert.ok(error.message.includes('not found'));
    }
  });
});
