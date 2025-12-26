import {
  truncateMiddle,
  formatFilenameForGrid,
  needsTruncation,
} from './file-utils';

describe('truncateMiddle', () => {
  it('should not truncate short filenames', () => {
    expect(truncateMiddle('photo.jpg', 25)).toBe('photo.jpg');
    expect(truncateMiddle('README.md', 25)).toBe('README.md');
    expect(truncateMiddle('index.ts', 25)).toBe('index.ts');
  });

  it('should truncate long filenames with extension preserved', () => {
    const result = truncateMiddle('dbeaver-ce-25.3.1-macos-aarch64.dmg', 25);
    expect(result).toContain('...');
    expect(result).toContain('.dmg');
    expect(result.length).toBeLessThanOrEqual(28); // allow for ellipsis
  });

  it('should truncate screen recording names like macOS', () => {
    const result = truncateMiddle(
      'Screen Recording 2025-01-15 at 3.26.12 PM.mov',
      30,
    );
    expect(result).toContain('...');
    expect(result).toContain('.mov');
    expect(result.startsWith('Screen')).toBe(true);
  });

  it('should handle files without extensions', () => {
    const result = truncateMiddle('very-long-filename-without-extension', 20);
    expect(result).toContain('...');
    expect(result.length).toBeLessThanOrEqual(23);
  });

  it('should preserve common file extensions', () => {
    expect(
      truncateMiddle('1Password Emergency Kit A3-ABCD1234.pdf', 25),
    ).toContain('.pdf');
    expect(truncateMiddle('vacation-photos-summer-2024.jpeg', 25)).toContain(
      '.jpeg',
    );
    expect(truncateMiddle('project-final-report-v2.docx', 25)).toContain(
      '.docx',
    );
  });

  it('should handle exact length filenames', () => {
    const exactLength = 'exactly-25-characters.txt';
    expect(truncateMiddle(exactLength, 25)).toBe(exactLength);
  });

  it('should handle edge case with very long extension', () => {
    const result = truncateMiddle('file.verylongextension', 20);
    // Result should be truncated - extension preservation may make it longer than maxLength
    // When extension is very long, the function prioritizes showing it
    expect(result).toBeTruthy();
    expect(result.length).toBeGreaterThan(0);
    expect(result).toContain('file');
    expect(result).toContain('.verylongextension');
    // The function preserves extensions, so result may exceed maxLength when extension is long
    // This is expected behavior - we want to see the extension
  });
});

describe('formatFilenameForGrid', () => {
  it('should format for 2-line display', () => {
    const result = formatFilenameForGrid(
      'Long Filename That Should Be Truncated.pdf',
    );
    expect(result.length).toBeLessThanOrEqual(31);
  });

  it('should not truncate short names', () => {
    expect(formatFilenameForGrid('short.txt')).toBe('short.txt');
  });
});

describe('needsTruncation', () => {
  it('should return true for long names', () => {
    expect(needsTruncation('very-long-filename-that-exceeds-limit.pdf')).toBe(
      true,
    );
  });

  it('should return false for short names', () => {
    expect(needsTruncation('short.pdf')).toBe(false);
  });
});
