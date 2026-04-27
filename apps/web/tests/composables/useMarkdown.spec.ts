import { describe, expect, it } from 'vitest';

import { parseMarkdown } from '~/composables/useMarkdown';

describe('parseMarkdown', () => {
    it('renders bold text', () => {
        const result = parseMarkdown('**bold**');
        expect(result).toContain('<strong>bold</strong>');
    });

    it('renders italic text', () => {
        const result = parseMarkdown('*italic*');
        expect(result).toContain('<em>italic</em>');
    });

    it('renders headings', () => {
        const result = parseMarkdown('## Heading');
        expect(result).toContain('<h2>Heading</h2>');
    });

    it('converts --- to <hr>', () => {
        const result = parseMarkdown('above\n\n---\n\nbelow');
        expect(result).toContain('<hr>');
    });

    it('strips script tags', () => {
        const result = parseMarkdown('<script>alert("xss")</script>');
        expect(result).not.toContain('<script>');
        expect(result).not.toContain('alert');
    });

    it('strips inline event handler attributes', () => {
        const result = parseMarkdown('<p onclick="evil()">text</p>');
        expect(result).not.toContain('onclick');
    });
});
