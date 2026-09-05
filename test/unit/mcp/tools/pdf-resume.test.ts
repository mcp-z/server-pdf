import { mcp } from '@mcp-z/mcp-pdf';
import assert from 'assert';
import { existsSync, mkdirSync } from 'fs';
import { safeRmSync } from 'fs-remove-compat';
import { join } from 'path';
import type { Input, Output } from '../../../../src/mcp/tools/pdf-resume.ts';
import { createExtra } from '../../../lib/create-extra.ts';
import { createTestConfig } from '../../../lib/create-test-config.ts';

// Use .tmp/ in package root, never os.tmpdir() (testing-standards)
describe('pdf-resume tool', () => {
  const testOutputDir = join(process.cwd(), '.tmp', 'pdf-resume-tests');
  const testStorageDir = join(testOutputDir, 'storage');
  before(() => {
    mkdirSync(testStorageDir, { recursive: true });
  });

  after(() => {
    if (existsSync(testOutputDir)) {
      safeRmSync(testOutputDir, { recursive: true, force: true });
    }
  });

  it('creates resume PDF from JSON Resume format', async () => {
    const config = createTestConfig(testOutputDir, testStorageDir);
    const tool = mcp.toolFactories.pdfResume();
    const extra = createExtra(config);

    assert.equal(tool.name, 'pdf-resume', 'tool name should match');

    const input: Input = {
      filename: 'resume.pdf',
      resume: {
        basics: {
          name: 'John Doe',
          label: 'Software Engineer',
          email: 'john@example.com',
          phone: '555-1234',
        },
        work: [
          {
            name: 'Tech Corp',
            position: 'Senior Engineer',
            startDate: '2020-01',
            highlights: ['Built scalable systems', 'Led team of 5'],
          },
        ],
        skills: [
          {
            name: 'Languages',
            keywords: ['TypeScript', 'Python', 'Go'],
          },
        ],
      },
    };

    const result = await tool.handler(input, extra);

    assert.ok(result.structuredContent, 'should have structuredContent');
    const output = result.structuredContent?.result as Output;
    assert.ok(output.documentId, 'should have documentId');
    assert.ok(output.sizeBytes > 0, 'should have non-zero size');
    assert.equal(output.filename, 'resume.pdf', 'should preserve filename');
  });

  it('creates resume with custom styling', async () => {
    const config = createTestConfig(testOutputDir, testStorageDir);
    const tool = mcp.toolFactories.pdfResume();
    const extra = createExtra(config);

    const input: Input = {
      resume: {
        basics: {
          name: 'Jane Smith',
          label: 'Product Manager',
        },
      },
      styling: {
        fontSize: {
          name: 28,
          body: 11,
        },
        alignment: {
          header: 'left',
        },
      },
    };

    const result = await tool.handler(input, extra);

    assert.ok(result.structuredContent, 'should have structuredContent');
  });

  it('handles resume with all sections', async () => {
    const config = createTestConfig(testOutputDir, testStorageDir);
    const tool = mcp.toolFactories.pdfResume();
    const extra = createExtra(config);

    const input: Input = {
      resume: {
        basics: {
          name: 'Full Resume Test',
          label: 'Engineer',
          summary: 'Experienced professional',
        },
        work: [
          {
            name: 'Company A',
            position: 'Role',
            summary: 'Did things',
          },
        ],
        education: [
          {
            institution: 'University',
            area: 'Computer Science',
            studyType: 'BS',
          },
        ],
        skills: [{ name: 'Category', keywords: ['Skill1', 'Skill2'] }],
        awards: [{ title: 'Award', awarder: 'Organization' }],
        projects: [{ name: 'Project', description: 'Description' }],
      },
    };

    const result = await tool.handler(input, extra);

    assert.ok(result.structuredContent, 'should have structuredContent');
  });
});
describe('Fine-grained pagination', () => {
  const testOutputDir = join(process.cwd(), '.tmp', 'fine-grained-pagination-tests');
  const testStorageDir = join(testOutputDir, 'storage');
  before(() => {
    mkdirSync(testStorageDir, { recursive: true });
  });

  after(() => {
    // Keep files for visual inspection during development
    // Uncomment to clean up:
    // if (existsSync(testOutputDir)) {
    //   rmSync(testOutputDir, { recursive: true, force: true });
    // }
  });

  it('creates multi-page resume with fine-grained content flow', async () => {
    const config = createTestConfig(testOutputDir, testStorageDir);
    const tool = mcp.toolFactories.pdfResume();
    const extra = createExtra(config);

    // Create a resume with enough content to span multiple pages
    // This tests that:
    // 1. Headers stay grouped with first content item (atomic groups)
    // 2. Individual content lines can flow across pages
    // 3. Spacing is correct at page boundaries
    const input: Input = {
      filename: 'multi-page-pagination-test.pdf',
      resume: {
        basics: {
          name: 'Multi-Page Resume Test',
          label: 'Senior Software Engineer',
          email: 'test@example.com',
          phone: '555-123-4567',
          summary: 'Experienced software engineer with over 15 years of experience building scalable distributed systems. ' + 'Passionate about clean code, test-driven development, and mentoring junior developers. ' + 'Led multiple successful product launches and contributed to open source projects.',
        },
        work: [
          {
            name: 'Tech Giant Corp',
            position: 'Principal Engineer',
            startDate: '2020-01',
            summary: 'Leading the platform engineering team responsible for core infrastructure serving millions of users worldwide.',
            highlights: [
              'Architected and implemented a new microservices platform that reduced deployment time by 80%',
              'Led migration from monolithic architecture to microservices, improving system reliability to 99.99% uptime',
              'Mentored team of 12 engineers, helping 3 achieve promotion to senior level within 18 months',
              'Established engineering best practices including code review standards, testing requirements, and documentation guidelines',
              'Reduced infrastructure costs by $2M annually through optimization and right-sizing initiatives',
            ],
          },
          {
            name: 'Innovation Startup Inc',
            position: 'Senior Software Engineer',
            startDate: '2017-03',
            endDate: '2019-12',
            summary: 'Full-stack development for B2B SaaS platform with focus on performance and scalability.',
            highlights: [
              'Built real-time analytics dashboard processing 10M+ events per day with sub-second latency',
              'Implemented CI/CD pipeline reducing release cycle from weeks to hours',
              'Developed custom caching layer that improved API response times by 300%',
              'Created automated testing framework increasing code coverage from 40% to 95%',
            ],
          },
          {
            name: 'Enterprise Solutions Ltd',
            position: 'Software Engineer',
            startDate: '2014-06',
            endDate: '2017-02',
            summary: 'Backend development for enterprise resource planning systems.',
            highlights: [
              'Designed and implemented RESTful APIs serving 500+ enterprise clients',
              'Optimized database queries reducing average response time from 2s to 200ms',
              'Built integration layer connecting legacy systems with modern cloud services',
              'Contributed to open source projects used by the company, gaining 1000+ GitHub stars',
            ],
          },
          {
            name: 'Digital Agency Co',
            position: 'Junior Developer',
            startDate: '2012-01',
            endDate: '2014-05',
            highlights: ['Developed responsive web applications for Fortune 500 clients', 'Implemented e-commerce solutions processing $10M+ in annual transactions', 'Created mobile-first designs improving user engagement by 45%'],
          },
        ],
        education: [
          {
            institution: 'State University',
            area: 'Computer Science',
            studyType: 'Master of Science',
            startDate: '2010',
            endDate: '2012',
            courses: ['Distributed Systems', 'Machine Learning', 'Advanced Algorithms'],
          },
          {
            institution: 'Tech College',
            area: 'Software Engineering',
            studyType: 'Bachelor of Science',
            startDate: '2006',
            endDate: '2010',
            courses: ['Data Structures', 'Operating Systems', 'Computer Networks', 'Database Design'],
          },
        ],
        skills: [
          {
            name: 'Programming Languages',
            keywords: ['TypeScript', 'Python', 'Go', 'Rust', 'Java', 'C++'],
          },
          {
            name: 'Frameworks & Libraries',
            keywords: ['React', 'Node.js', 'FastAPI', 'Spring Boot', 'Django'],
          },
          {
            name: 'Infrastructure & DevOps',
            keywords: ['AWS', 'Kubernetes', 'Docker', 'Terraform', 'GitHub Actions'],
          },
          {
            name: 'Databases',
            keywords: ['PostgreSQL', 'Redis', 'MongoDB', 'Elasticsearch', 'DynamoDB'],
          },
        ],
        projects: [
          {
            name: 'Open Source Monitoring Tool',
            description: 'Created a lightweight monitoring solution for Kubernetes clusters that provides real-time metrics and alerting.',
            highlights: ['5000+ GitHub stars', 'Used by 200+ companies', 'Featured in KubeCon 2023'],
          },
          {
            name: 'Developer Productivity CLI',
            description: 'Built a command-line tool that automates common development tasks and integrates with popular CI/CD platforms.',
            highlights: ['10,000+ monthly downloads', 'Active community of contributors'],
          },
        ],
        awards: [
          {
            title: 'Engineering Excellence Award',
            awarder: 'Tech Giant Corp',
            date: '2022',
            summary: 'Recognized for outstanding technical leadership and contributions to platform reliability.',
          },
          {
            title: 'Innovation Award',
            awarder: 'Innovation Startup Inc',
            date: '2019',
            summary: 'For developing the real-time analytics system that became a key product differentiator.',
          },
        ],
      },
    };

    const result = await tool.handler(input, extra);

    assert.ok(result.structuredContent, 'should have structuredContent');
    const output = result.structuredContent?.result as Output;
    assert.ok(output.documentId, 'should have documentId');
    assert.ok(output.sizeBytes > 0, 'should have non-zero size');
    // Large resume with extensive content should be multiple pages
    // The size threshold indicates multi-page content (8KB+ for Helvetica, 30KB+ for custom fonts)
    assert.ok(output.sizeBytes > 8000, `should have substantial content size (got ${output.sizeBytes})`);

    console.log(`    📄 Multi-page resume created: ${output.sizeBytes} bytes`);
    console.log(`    📂 Output: ${testStorageDir}/${output.documentId}.pdf`);
    console.log('    ℹ️  Open the PDF to verify fine-grained pagination visually');
  });

  it('handles resume with only summaries (no bullets)', async () => {
    const config = createTestConfig(testOutputDir, testStorageDir);
    const tool = mcp.toolFactories.pdfResume();
    const extra = createExtra(config);

    const input: Input = {
      filename: 'summary-only-pagination-test.pdf',
      resume: {
        basics: {
          name: 'Summary Only Test',
          label: 'Product Manager',
          summary: 'Experienced product manager with a track record of launching successful products.',
        },
        work: [
          {
            name: 'Product Company',
            position: 'Senior Product Manager',
            startDate: '2020-01',
            summary: 'Led product strategy for the core platform, driving 40% year-over-year revenue growth. ' + 'Collaborated with engineering, design, and sales teams to deliver features that exceeded customer expectations.',
          },
          {
            name: 'Startup Inc',
            position: 'Product Manager',
            startDate: '2017-01',
            endDate: '2019-12',
            summary: 'Owned the product roadmap for the B2B SaaS offering. ' + 'Conducted extensive customer research and competitive analysis to prioritize features.',
          },
        ],
      },
    };

    const result = await tool.handler(input, extra);

    assert.ok(result.structuredContent, 'should have structuredContent');
    const output = result.structuredContent?.result as Output;
    assert.ok(output.documentId, 'should have documentId');

    console.log(`    📄 Summary-only resume created: ${output.sizeBytes} bytes`);
  });

  it('handles resume with only bullets (no summaries)', async () => {
    const config = createTestConfig(testOutputDir, testStorageDir);
    const tool = mcp.toolFactories.pdfResume();
    const extra = createExtra(config);

    const input: Input = {
      filename: 'bullets-only-pagination-test.pdf',
      resume: {
        basics: {
          name: 'Bullets Only Test',
          label: 'Software Engineer',
        },
        work: [
          {
            name: 'Tech Company',
            position: 'Senior Engineer',
            startDate: '2020-01',
            highlights: ['Built scalable microservices architecture', 'Implemented CI/CD pipelines', 'Mentored junior developers', 'Contributed to open source projects', 'Reduced system latency by 50%'],
          },
          {
            name: 'Another Company',
            position: 'Engineer',
            startDate: '2017-01',
            endDate: '2019-12',
            highlights: ['Developed RESTful APIs', 'Optimized database performance', 'Created automated tests'],
          },
        ],
      },
    };

    const result = await tool.handler(input, extra);

    assert.ok(result.structuredContent, 'should have structuredContent');
    const output = result.structuredContent?.result as Output;
    assert.ok(output.documentId, 'should have documentId');

    console.log(`    📄 Bullets-only resume created: ${output.sizeBytes} bytes`);
  });

  it('handles education entries with courses', async () => {
    const config = createTestConfig(testOutputDir, testStorageDir);
    const tool = mcp.toolFactories.pdfResume();
    const extra = createExtra(config);

    const input: Input = {
      filename: 'education-pagination-test.pdf',
      resume: {
        basics: {
          name: 'Education Test',
          label: 'Recent Graduate',
        },
        education: [
          {
            institution: 'University of Technology',
            area: 'Computer Science',
            studyType: 'Ph.D.',
            startDate: '2018',
            endDate: '2023',
            courses: ['Advanced Machine Learning', 'Distributed Systems', 'Natural Language Processing', 'Computer Vision', 'Reinforcement Learning'],
          },
          {
            institution: 'State University',
            area: 'Mathematics',
            studyType: 'M.S.',
            startDate: '2016',
            endDate: '2018',
            courses: ['Linear Algebra', 'Probability Theory', 'Numerical Analysis', 'Optimization'],
          },
          {
            institution: 'Liberal Arts College',
            area: 'Physics',
            studyType: 'B.S.',
            startDate: '2012',
            endDate: '2016',
            courses: ['Quantum Mechanics', 'Thermodynamics', 'Electromagnetism'],
          },
        ],
      },
    };

    const result = await tool.handler(input, extra);

    assert.ok(result.structuredContent, 'should have structuredContent');
    const output = result.structuredContent?.result as Output;
    assert.ok(output.documentId, 'should have documentId');

    console.log(`    📄 Education resume created: ${output.sizeBytes} bytes`);
  });
});
describe('pdf-resume two-column layout', () => {
  const testOutputDir = join(process.cwd(), '.tmp', 'two-column-layout-tests');
  const testStorageDir = join(testOutputDir, 'storage');
  before(() => {
    mkdirSync(testStorageDir, { recursive: true });
  });

  after(() => {
    if (existsSync(testOutputDir)) {
      safeRmSync(testOutputDir, { recursive: true, force: true });
    }
  });

  it('creates two-column resume with left sidebar', async () => {
    const config = createTestConfig(testOutputDir, testStorageDir);
    const tool = mcp.toolFactories.pdfResume();
    const extra = createExtra(config);

    const input: Input = {
      filename: 'two-column-resume.pdf',
      resume: {
        basics: {
          name: 'John Doe',
          label: 'Software Engineer',
          email: 'john@example.com',
          phone: '555-1234',
        },
        work: [
          {
            name: 'Tech Corp',
            position: 'Senior Engineer',
            startDate: '2020-01',
            highlights: ['Built scalable systems', 'Led team of 5'],
          },
        ],
        skills: [
          {
            name: 'Languages',
            keywords: ['TypeScript', 'Python', 'Go'],
          },
        ],
        languages: [
          {
            language: 'English',
            fluency: 'Native',
          },
          {
            language: 'Spanish',
            fluency: 'Intermediate',
          },
        ],
      },
      layout: {
        style: 'two-column',
        gap: 20,
        columns: {
          left: {
            width: '30%',
            sections: ['skills', 'languages'],
          },
          right: {
            width: '70%',
            sections: ['work'],
          },
        },
      },
    };

    const result = await tool.handler(input, extra);

    assert.ok(result.structuredContent, 'should have structuredContent');
    const output = result.structuredContent?.result as Output;
    assert.ok(output.documentId, 'should have documentId');
    assert.ok(output.sizeBytes > 0, 'should have non-zero size');
    assert.equal(output.filename, 'two-column-resume.pdf', 'should preserve filename');
    console.log(`    📄 Two-column resume created: ${output.sizeBytes} bytes`);
  });

  it('validates sections exist in layout columns', async () => {
    const config = createTestConfig(testOutputDir, testStorageDir);
    const tool = mcp.toolFactories.pdfResume();
    const extra = createExtra(config);

    const input: Input = {
      resume: {
        basics: { name: 'Test User' },
      },
      layout: {
        style: 'two-column',
        columns: {
          left: {
            sections: ['nonexistent-section'],
          },
        },
      },
    };

    try {
      await tool.handler(input, extra);
      assert.fail('should have thrown validation error');
    } catch (error) {
      assert.ok(error instanceof Error);
      assert.ok(error.message.includes('unknown sections'), `Expected 'unknown sections' in: ${error.message}`);
    }
  });

  it('rejects duplicate sections across columns', async () => {
    const config = createTestConfig(testOutputDir, testStorageDir);
    const tool = mcp.toolFactories.pdfResume();
    const extra = createExtra(config);

    const input: Input = {
      resume: {
        basics: { name: 'Test User' },
        skills: [{ name: 'Test', keywords: ['A'] }],
      },
      layout: {
        style: 'two-column',
        columns: {
          left: {
            sections: ['skills'],
          },
          right: {
            sections: ['skills'],
          },
        },
      },
    };

    try {
      await tool.handler(input, extra);
      assert.fail('should have thrown validation error');
    } catch (error) {
      assert.ok(error instanceof Error);
      assert.ok(error.message.includes('both columns'), `Expected 'both columns' in: ${error.message}`);
    }
  });

  it('creates two-column layout with percentage widths', async () => {
    const config = createTestConfig(testOutputDir, testStorageDir);
    const tool = mcp.toolFactories.pdfResume();
    const extra = createExtra(config);

    const input: Input = {
      filename: 'two-column-percentage.pdf',
      resume: {
        basics: {
          name: 'Jane Smith',
          label: 'Product Designer',
          email: 'jane@example.com',
        },
        work: [
          {
            name: 'Design Studio',
            position: 'Lead Designer',
            startDate: '2019-03',
            highlights: ['Redesigned product UI', 'Increased conversion by 25%'],
          },
        ],
        skills: [
          { name: 'Design', keywords: ['Figma', 'Sketch', 'Adobe XD'] },
          { name: 'Frontend', keywords: ['HTML', 'CSS', 'React'] },
        ],
        education: [
          {
            institution: 'Design School',
            area: 'Interaction Design',
            studyType: 'Bachelor',
            startDate: '2015-09',
            endDate: '2019-05',
          },
        ],
      },
      layout: {
        style: 'two-column',
        gap: 30,
        columns: {
          left: {
            width: '35%',
            sections: ['skills', 'education'],
          },
          right: {
            width: '65%',
            sections: ['work'],
          },
        },
      },
    };

    const result = await tool.handler(input, extra);

    assert.ok(result.structuredContent, 'should have structuredContent');
    const output = result.structuredContent?.result as Output;
    assert.ok(output.documentId, 'should have documentId');
    assert.ok(output.sizeBytes > 0, 'should have non-zero size');
    console.log(`    📄 Two-column (35%/65%) resume created: ${output.sizeBytes} bytes`);
  });

  it('creates two-column layout with point widths', async () => {
    const config = createTestConfig(testOutputDir, testStorageDir);
    const tool = mcp.toolFactories.pdfResume();
    const extra = createExtra(config);

    const input: Input = {
      filename: 'two-column-points.pdf',
      resume: {
        basics: {
          name: 'Bob Johnson',
          label: 'Data Scientist',
          email: 'bob@example.com',
        },
        work: [
          {
            name: 'Analytics Corp',
            position: 'Senior Data Scientist',
            startDate: '2018-06',
            highlights: ['Built ML pipeline', 'Improved model accuracy by 40%'],
          },
        ],
        skills: [{ name: 'ML', keywords: ['Python', 'TensorFlow', 'PyTorch'] }],
      },
      layout: {
        style: 'two-column',
        gap: 25,
        columns: {
          left: {
            width: 150,
            sections: ['skills'],
          },
          right: {
            width: 350,
            sections: ['work'],
          },
        },
      },
    };

    const result = await tool.handler(input, extra);

    assert.ok(result.structuredContent, 'should have structuredContent');
    const output = result.structuredContent?.result as Output;
    assert.ok(output.documentId, 'should have documentId');
    assert.ok(output.sizeBytes > 0, 'should have non-zero size');
    console.log(`    📄 Two-column (150pt/350pt) resume created: ${output.sizeBytes} bytes`);
  });

  it('defaults to single-column when layout not specified', async () => {
    const config = createTestConfig(testOutputDir, testStorageDir);
    const tool = mcp.toolFactories.pdfResume();
    const extra = createExtra(config);

    const input: Input = {
      filename: 'single-column-default.pdf',
      resume: {
        basics: {
          name: 'Test User',
          label: 'Engineer',
        },
        work: [
          {
            name: 'Company',
            position: 'Engineer',
            startDate: '2020-01',
          },
        ],
      },
      // No layout specified - should default to single-column
    };

    const result = await tool.handler(input, extra);

    assert.ok(result.structuredContent, 'should have structuredContent');
    const output = result.structuredContent?.result as Output;
    assert.ok(output.documentId, 'should have documentId');
    assert.ok(output.sizeBytes > 0, 'should have non-zero size');
    console.log(`    📄 Single-column (default) resume created: ${output.sizeBytes} bytes`);
  });
});
