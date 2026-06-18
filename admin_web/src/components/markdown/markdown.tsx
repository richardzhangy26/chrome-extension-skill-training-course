import { m } from '@/locale/paraglide/messages';
import parse, {
  type DOMNode,
  type HTMLReactParserOptions,
  domToReact,
  Element,
} from 'html-react-parser';
import { renderMarkdown, type MarkdownResult } from '@/lib/markdown';
import { useEffect, useState } from 'react';
import { Link } from '@tanstack/react-router';
type MarkdownProps = {
  content: string;
  className?: string;
};
/**
 * Renders markdown component
 * https://tanstack.dev/start/latest/docs/framework/react/guide/rendering-markdown
 */
export function Markdown({ content, className }: MarkdownProps) {
  const [result, setResult] = useState<MarkdownResult | null>(null);
  useEffect(() => {
    renderMarkdown(content).then(setResult);
  }, [content]);
  if (!result) {
    return <div className={className}>{m.common_loading()}</div>;
  }
  const options: HTMLReactParserOptions = {
    replace: (domNode) => {
      if (domNode instanceof Element) {
        // Customize rendering of specific elements
        if (domNode.name === 'a') {
          // Handle links
          const href = domNode.attribs.href;
          if (href?.startsWith('/')) {
            // Internal link - use your router's Link component
            return (
              <Link to={href} className="underline-offset-4 hover:underline">
                {domToReact(domNode.children as DOMNode[], options)}
              </Link>
            );
          }
        }
        if (domNode.name === 'img') {
          return (
            <img
              {...domNode.attribs}
              alt={domNode.attribs?.alt ?? ''}
              loading="lazy"
              className="rounded-lg shadow-md"
            />
          );
        }
        if (domNode.name === 'code') {
          // Remove backticks from inline code content
          // Check if children are text nodes and remove backticks
          const processedChildren = (domNode.children as DOMNode[]).map(
            (child) => {
              if (
                child.type === 'text' &&
                'data' in child &&
                typeof child.data === 'string'
              ) {
                return {
                  ...child,
                  data: child.data.replace(/^`+|`+$/g, ''),
                };
              }
              return child;
            }
          );
          // Map HTML 'class' to React 'className' to avoid invalid DOM property
          const { class: classAttr, ...restAttribs } = domNode.attribs;
          const codeAttribs = classAttr
            ? { ...restAttribs, className: classAttr }
            : restAttribs;
          return (
            <code {...codeAttribs}>
              {domToReact(processedChildren as DOMNode[], options)}
            </code>
          );
        }
      }
    },
  };
  return <div className={className}>{parse(result.markup, options)}</div>;
}
