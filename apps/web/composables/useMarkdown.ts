import DOMPurify from 'dompurify';
import { marked } from 'marked';

/** Parses markdown text to sanitised HTML safe for injection via v-html. */
export function parseMarkdown(text: string): string {
    const html = marked.parse(text) as string;
    return DOMPurify.sanitize(html);
}
