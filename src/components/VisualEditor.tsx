import { RefObject, useEffect, ReactElement, useMemo } from 'react';
import DOMPurify from 'dompurify';

interface VisualEditorProps {
  editorRef: RefObject<HTMLDivElement | null>;
  content: string;
  onBlur: () => void;
  minHeight?: string;
}

/**
 * Visual HTML Editor component
 * Renders HTML content in an editable contentEditable div
 * Uses DOMPurify to sanitize HTML content for security
 */
export default function VisualEditor({
  editorRef,
  content,
  onBlur,
  minHeight = '150px',
}: VisualEditorProps): ReactElement {
  // Sanitize HTML content for safe rendering
  const sanitizedContent = useMemo(() => {
    return DOMPurify.sanitize(content, {
      ALLOWED_TAGS: [
        'p', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'strike',
        'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
        'ul', 'ol', 'li',
        'a', 'img',
        'blockquote', 'pre', 'code',
        'table', 'thead', 'tbody', 'tr', 'th', 'td',
        'div', 'span', 'hr',
      ],
      ALLOWED_ATTR: [
        'href', 'src', 'alt', 'title', 'class', 'id', 'style',
        'target', 'rel', 'width', 'height',
      ],
    });
  }, [content]);

  // Update the editor content when the content prop changes. editorRef is
  // intentionally owned by the parent form (useProductEditForm), which reads
  // .innerHTML back out of it when switching to code-edit mode.
  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== sanitizedContent) {
      // eslint-disable-next-line react-compiler/react-compiler -- see comment above
      editorRef.current.innerHTML = sanitizedContent;
    }
  }, [sanitizedContent, editorRef]);

  return (
    <div
      ref={editorRef}
      contentEditable
      onBlur={onBlur}
      className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none prose prose-sm dark:prose-invert max-w-none overflow-auto"
      style={{ minHeight }}
      dangerouslySetInnerHTML={{ __html: sanitizedContent }}
    />
  );
}
