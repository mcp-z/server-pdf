/**
 * Flexbox Layout Tests for pdf-layout tool
 *
 * Tests the Yoga layout integration for flexbox-style layouts
 */

import { mcp } from '@mcp-z/mcp-pdf';
import assert from 'assert';
import { existsSync, mkdirSync } from 'fs';
import { safeRmSync } from 'fs-remove-compat';
import { join } from 'path';
import type { Input, Output } from '../../../../src/mcp/tools/pdf-layout.ts';
import { createExtra } from '../../../lib/create-extra.ts';
import { createTestConfig } from '../../../lib/create-test-config.ts';

// Use .tmp/ in package root, never os.tmpdir() (testing-standards)
describe('Flexbox Layout Tests', () => {
  const testOutputDir = join(process.cwd(), '.tmp', 'flexbox-tests');
  const testStorageDir = join(testOutputDir, 'storage');
  const config = createTestConfig(testOutputDir, testStorageDir);
  const tool = mcp.toolFactories.pdfLayout();
  const extra = createExtra(config);

  before(() => {
    mkdirSync(testStorageDir, { recursive: true });
  });

  after(() => {
    if (existsSync(testOutputDir)) {
      safeRmSync(testOutputDir, { recursive: true, force: true });
    }
  });

  describe('Two-column layout', () => {
    it('creates two equal columns with flex: 1', async () => {
      const result = await tool.handler(
        {
          content: [
            {
              type: 'group',
              direction: 'row',
              gap: 20,
              children: [
                {
                  type: 'group',
                  flex: 1,
                  border: { color: '#333', width: 1 },
                  padding: 10,
                  children: [
                    { type: 'heading', text: 'LEFT COLUMN', textAlign: 'center' },
                    { type: 'text', text: 'This is the left column content.' },
                  ],
                },
                {
                  type: 'group',
                  flex: 1,
                  border: { color: '#333', width: 1 },
                  padding: 10,
                  children: [
                    { type: 'heading', text: 'RIGHT COLUMN', textAlign: 'center' },
                    { type: 'text', text: 'This is the right column content.' },
                  ],
                },
              ],
            },
          ],
          filename: 'flexbox-two-columns.pdf',
        },
        extra
      );

      assert.ok(result.structuredContent, 'Should return structured content');
      const output = (result.structuredContent as { result?: unknown } | undefined)?.result as Output;
      assert.ok(output.uri, 'Should have uri in result');
    });
  });

  describe('Three-column layout with proportions', () => {
    it('creates three columns with flex: 1, 2, 1', async () => {
      const result = await tool.handler(
        {
          content: [
            {
              type: 'group',
              direction: 'row',
              gap: 15,
              children: [
                {
                  type: 'group',
                  flex: 1,
                  border: { color: '#666', width: 1 },
                  padding: 10,
                  children: [{ type: 'text', text: 'NARROW (1)' }],
                },
                {
                  type: 'group',
                  flex: 2,
                  border: { color: '#333', width: 2 },
                  padding: 10,
                  children: [{ type: 'heading', text: 'WIDE (2)', textAlign: 'center' }],
                },
                {
                  type: 'group',
                  flex: 1,
                  border: { color: '#666', width: 1 },
                  padding: 10,
                  children: [{ type: 'text', text: 'NARROW (1)' }],
                },
              ],
            },
          ],
          filename: 'flexbox-three-columns-proportional.pdf',
        },
        extra
      );

      assert.ok(result.structuredContent, 'Should return structured content');
    });
  });

  describe('Nested groups', () => {
    it('handles nested group layouts', async () => {
      const result = await tool.handler(
        {
          content: [
            {
              type: 'group',
              direction: 'column',
              gap: 20,
              children: [
                {
                  type: 'heading',
                  text: 'NESTED LAYOUT EXAMPLE',
                  textAlign: 'center',
                },
                {
                  type: 'group',
                  direction: 'row',
                  gap: 20,
                  children: [
                    {
                      type: 'group',
                      flex: 1,
                      direction: 'column',
                      gap: 10,
                      border: { color: '#999', width: 1 },
                      padding: 10,
                      children: [
                        { type: 'text', text: 'Outer left' },
                        {
                          type: 'group',
                          border: { color: '#ccc', width: 1 },
                          padding: 5,
                          children: [{ type: 'text', text: 'Inner nested' }],
                        },
                      ],
                    },
                    {
                      type: 'group',
                      flex: 1,
                      border: { color: '#999', width: 1 },
                      padding: 10,
                      children: [{ type: 'text', text: 'Outer right' }],
                    },
                  ],
                },
              ],
            },
          ],
          filename: 'flexbox-nested-groups.pdf',
        },
        extra
      );

      assert.ok(result.structuredContent, 'Should return structured content');
    });
  });

  describe('Direction: row vs column', () => {
    it('row direction arranges children horizontally', async () => {
      const result = await tool.handler(
        {
          content: [
            {
              type: 'group',
              direction: 'row',
              gap: 10,
              children: [
                { type: 'text', text: '[A]' },
                { type: 'text', text: '[B]' },
                { type: 'text', text: '[C]' },
              ],
            },
          ],
          filename: 'flexbox-direction-row.pdf',
        },
        extra
      );

      assert.ok(result.structuredContent, 'Should return structured content');
    });

    it('column direction arranges children vertically', async () => {
      const result = await tool.handler(
        {
          content: [
            {
              type: 'group',
              direction: 'column',
              gap: 10,
              children: [
                { type: 'text', text: '[A]' },
                { type: 'text', text: '[B]' },
                { type: 'text', text: '[C]' },
              ],
            },
          ],
          filename: 'flexbox-direction-column.pdf',
        },
        extra
      );

      assert.ok(result.structuredContent, 'Should return structured content');
    });
  });

  describe('Justify content', () => {
    it('space-between distributes items with space between', async () => {
      const result = await tool.handler(
        {
          content: [
            {
              type: 'group',
              direction: 'row',
              justify: 'space-between',
              border: { color: '#ddd', width: 1 },
              padding: 10,
              children: [
                { type: 'text', text: 'LEFT' },
                { type: 'text', text: 'RIGHT' },
              ],
            },
          ],
          filename: 'flexbox-justify-space-between.pdf',
        },
        extra
      );

      assert.ok(result.structuredContent, 'Should return structured content');
    });

    it('center aligns items to center', async () => {
      const result = await tool.handler(
        {
          content: [
            {
              type: 'group',
              direction: 'row',
              justify: 'center',
              gap: 20,
              border: { color: '#ddd', width: 1 },
              padding: 10,
              children: [
                { type: 'text', text: '[A]' },
                { type: 'text', text: '[B]' },
                { type: 'text', text: '[C]' },
              ],
            },
          ],
          filename: 'flexbox-justify-center.pdf',
        },
        extra
      );

      assert.ok(result.structuredContent, 'Should return structured content');
    });

    it('end aligns items to end', async () => {
      const result = await tool.handler(
        {
          content: [
            {
              type: 'group',
              direction: 'row',
              justify: 'end',
              gap: 20,
              border: { color: '#ddd', width: 1 },
              padding: 10,
              children: [
                { type: 'text', text: '[A]' },
                { type: 'text', text: '[B]' },
                { type: 'text', text: '[C]' },
              ],
            },
          ],
          filename: 'flexbox-justify-end.pdf',
        },
        extra
      );

      assert.ok(result.structuredContent, 'Should return structured content');
    });
  });

  describe('Align items', () => {
    it('alignItems: center centers children on cross axis', async () => {
      const result = await tool.handler(
        {
          content: [
            {
              type: 'group',
              direction: 'row',
              alignItems: 'center',
              gap: 20,
              height: 100,
              border: { color: '#ddd', width: 1 },
              children: [
                { type: 'text', text: 'Short' },
                { type: 'heading', text: 'TALL', fontSize: 24 },
                { type: 'text', text: 'Short' },
              ],
            },
          ],
          filename: 'flexbox-align-items-center.pdf',
        },
        extra
      );

      assert.ok(result.structuredContent, 'Should return structured content');
    });
  });

  describe('Self-centering with align', () => {
    it('align: center centers group horizontally on page', async () => {
      const result = await tool.handler(
        {
          content: [
            {
              type: 'group',
              width: 300,
              align: 'center',
              border: { color: '#333', width: 2 },
              padding: 20,
              children: [
                { type: 'heading', text: 'CENTERED CARD', textAlign: 'center' },
                { type: 'text', text: 'This card is centered on the page using align: "center"' },
              ],
            },
          ],
          filename: 'flexbox-self-center.pdf',
        },
        extra
      );

      assert.ok(result.structuredContent, 'Should return structured content');
    });

    it('align: end positions group at right', async () => {
      const result = await tool.handler(
        {
          content: [
            {
              type: 'group',
              width: 200,
              align: 'end',
              border: { color: '#333', width: 1 },
              padding: 15,
              children: [{ type: 'text', text: 'Right-aligned box' }],
            },
          ],
          filename: 'flexbox-self-end.pdf',
        },
        extra
      );

      assert.ok(result.structuredContent, 'Should return structured content');
    });
  });

  describe('Percentage widths', () => {
    it('supports percentage width like "50%"', async () => {
      const result = await tool.handler(
        {
          content: [
            {
              type: 'group',
              width: '50%',
              border: { color: '#333', width: 1 },
              padding: 10,
              children: [{ type: 'text', text: 'This box is 50% of the page width' }],
            },
            {
              type: 'group',
              width: '75%',
              border: { color: '#666', width: 1 },
              padding: 10,
              children: [{ type: 'text', text: 'This box is 75% of the page width' }],
            },
          ],
          filename: 'flexbox-percentage-widths.pdf',
        },
        extra
      );

      assert.ok(result.structuredContent, 'Should return structured content');
    });
  });

  describe('Padding and gap interaction', () => {
    it('padding affects internal space, gap affects between children', async () => {
      const result = await tool.handler(
        {
          content: [
            {
              type: 'group',
              direction: 'row',
              gap: 30,
              padding: 20,
              border: { color: '#333', width: 2 },
              background: '#f5f5f5',
              children: [
                {
                  type: 'group',
                  flex: 1,
                  padding: 10,
                  border: { color: '#666', width: 1 },
                  children: [{ type: 'text', text: 'Box A with inner padding' }],
                },
                {
                  type: 'group',
                  flex: 1,
                  padding: 10,
                  border: { color: '#666', width: 1 },
                  children: [{ type: 'text', text: 'Box B with inner padding' }],
                },
              ],
            },
          ],
          filename: 'flexbox-padding-gap.pdf',
        },
        extra
      );

      assert.ok(result.structuredContent, 'Should return structured content');
    });
  });

  describe('Mixed absolute + flex positioning', () => {
    it('absolute positioned items bypass flex layout', async () => {
      const result = await tool.handler(
        {
          content: [
            // Absolute positioned header (wrapped in group for positioning)
            {
              type: 'group',
              left: 54,
              top: 50,
              children: [{ type: 'heading', text: 'MIXED POSITIONING' }],
            },
            // Flex group positioned at specific y
            {
              type: 'group',
              direction: 'row',
              gap: 20,
              left: 54,
              top: 100,
              children: [
                {
                  type: 'group',
                  flex: 1,
                  border: { color: '#333', width: 1 },
                  padding: 10,
                  children: [{ type: 'text', text: 'Flex child 1' }],
                },
                {
                  type: 'group',
                  flex: 1,
                  border: { color: '#333', width: 1 },
                  padding: 10,
                  children: [{ type: 'text', text: 'Flex child 2' }],
                },
              ],
            },
            // Another absolute element (wrapped in group for positioning)
            {
              type: 'group',
              left: 54,
              top: 700,
              children: [{ type: 'text', text: 'Footer at absolute position' }],
            },
          ],
          filename: 'flexbox-mixed-positioning.pdf',
        },
        extra
      );

      assert.ok(result.structuredContent, 'Should return structured content');
    });
  });

  describe('Visual styling on groups', () => {
    it('renders background color on groups', async () => {
      const result = await tool.handler(
        {
          content: [
            {
              type: 'group',
              direction: 'row',
              gap: 20,
              children: [
                {
                  type: 'group',
                  flex: 1,
                  padding: 15,
                  background: '#e3f2fd',
                  children: [{ type: 'text', text: 'Light blue background' }],
                },
                {
                  type: 'group',
                  flex: 1,
                  padding: 15,
                  background: '#fff3e0',
                  children: [{ type: 'text', text: 'Light orange background' }],
                },
              ],
            },
          ],
          filename: 'flexbox-background-colors.pdf',
        },
        extra
      );

      assert.ok(result.structuredContent, 'Should return structured content');
    });
  });

  describe('Complex real-world example: Flyer', () => {
    it('creates a two-column event flyer', async () => {
      const result = await tool.handler(
        {
          color: {
            background: '#fffef5',
          },
          content: [
            // Header (wrapped in group for positioning)
            {
              type: 'group',
              top: 50,
              children: [{ type: 'heading', text: 'SUMMER FESTIVAL 2024', textAlign: 'center', fontSize: 28, bold: true }],
            },
            {
              type: 'group',
              top: 90,
              children: [{ type: 'text', text: 'July 15-17 | Central Park', textAlign: 'center' }],
            },
            // Two-column content
            {
              type: 'group',
              direction: 'row',
              gap: 20,
              left: 54,
              top: 130,
              children: [
                {
                  type: 'group',
                  flex: 1,
                  border: { color: '#2196f3', width: 2 },
                  padding: 15,
                  children: [
                    { type: 'heading', text: 'MUSIC', textAlign: 'center', fontSize: 18 },
                    { type: 'text', text: 'Live bands all weekend' },
                    { type: 'text', text: '• Main Stage' },
                    { type: 'text', text: '• Acoustic Tent' },
                    { type: 'text', text: '• DJ Zone' },
                  ],
                },
                {
                  type: 'group',
                  flex: 1,
                  border: { color: '#4caf50', width: 2 },
                  padding: 15,
                  children: [
                    { type: 'heading', text: 'FOOD', textAlign: 'center', fontSize: 18 },
                    { type: 'text', text: '50+ local vendors' },
                    { type: 'text', text: '• Food Court' },
                    { type: 'text', text: '• Craft Beers' },
                    { type: 'text', text: '• Dessert Row' },
                  ],
                },
              ],
            },
            // Footer
            {
              type: 'group',
              width: 300,
              align: 'center',
              top: 400,
              border: { color: '#ff9800', width: 2 },
              padding: 15,
              background: '#fff8e1',
              children: [
                { type: 'heading', text: 'TICKETS', textAlign: 'center', fontSize: 16 },
                { type: 'text', text: 'Early Bird: $25', textAlign: 'center' },
                { type: 'text', text: 'At Door: $35', textAlign: 'center' },
              ],
            },
          ],
          filename: 'flexbox-flyer-example.pdf',
        },
        extra
      );

      assert.ok(result.structuredContent, 'Should return structured content');
    });
  });
});
describe('pdf-layout tool', () => {
  const testOutputDir = join(process.cwd(), '.tmp', 'pdf-layout-tests');
  const testStorageDir = join(testOutputDir, 'storage');
  before(() => {
    mkdirSync(testStorageDir, { recursive: true });
  });

  after(() => {
    if (existsSync(testOutputDir)) {
      safeRmSync(testOutputDir, { recursive: true, force: true });
    }
  });

  it('creates PDF with text content', async () => {
    const config = createTestConfig(testOutputDir, testStorageDir);
    const tool = mcp.toolFactories.pdfLayout();
    const extra = createExtra(config);

    assert.equal(tool.name, 'pdf-layout', 'tool name should match');

    const input: Input = {
      filename: 'test-document.pdf',
      content: [
        { type: 'text', text: 'Hello World' },
        { type: 'heading', text: 'Test Heading' },
      ],
    };

    const result = await tool.handler(input, extra);

    assert.ok(result.structuredContent, 'should have structuredContent');
    const output = (result.structuredContent as { result?: unknown } | undefined)?.result as Output;
    assert.ok(output.documentId, 'should have documentId');
    assert.ok(output.uri, 'should have uri');
    assert.ok(output.sizeBytes > 0, 'should have non-zero size');
    assert.equal(output.filename, 'test-document.pdf', 'should preserve filename');
  });

  it('creates PDF with shapes', async () => {
    const config = createTestConfig(testOutputDir, testStorageDir);
    const tool = mcp.toolFactories.pdfLayout();
    const extra = createExtra(config);

    const input: Input = {
      filename: 'shapes.pdf',
      content: [
        { type: 'rect', left: 50, top: 50, width: 100, height: 100, fillColor: 'blue' },
        { type: 'circle', left: 200, top: 100, radius: 50, fillColor: 'red' },
        { type: 'line', x1: 50, y1: 200, x2: 250, y2: 200, strokeColor: 'green' },
      ],
    };

    const result = await tool.handler(input, extra);

    assert.ok(result.structuredContent, 'should have structuredContent');
    const output = (result.structuredContent as { result?: unknown } | undefined)?.result as Output;
    assert.ok(output.sizeBytes > 0, 'should have non-zero size');
  });

  it('creates PDF with page setup', async () => {
    const config = createTestConfig(testOutputDir, testStorageDir);
    const tool = mcp.toolFactories.pdfLayout();
    const extra = createExtra(config);

    const input: Input = {
      filename: 'custom-page.pdf',
      pageSetup: {
        margins: { top: 100, bottom: 100, left: 100, right: 100 },
      },
      color: {
        background: '#f0f0f0',
      },
      content: [{ type: 'text', text: 'Custom page setup' }],
    };

    const result = await tool.handler(input, extra);

    assert.ok(result.structuredContent, 'should have structuredContent');
  });
});
