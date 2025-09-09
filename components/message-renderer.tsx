import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";

interface MessageRendererProps {
  content: string;
  isUser?: boolean;
  isStreaming?: boolean;
}

export function MessageRenderer({
  content,
  isUser = false,
  isStreaming = false,
}: MessageRendererProps) {
  // For user messages, render as plain text with preserved whitespace
  if (isUser) {
    return (
      <div className="text-sm">
        <p className="whitespace-pre-wrap m-0">{content}</p>
      </div>
    );
  }

  // For assistant messages, render as markdown
  return (
    <div className="text-sm prose prose-sm max-w-none dark:prose-invert">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight]}
        components={{
          p: ({ children }) => <p className="m-0 mb-2 last:mb-0">{children}</p>,
          code: ({ children, ...props }: any) => {
            const inline = !props.className?.includes("language-");
            return inline ? (
              <code
                className="bg-muted px-1 py-0.5 rounded text-xs font-mono"
                {...props}
              >
                {children}
              </code>
            ) : (
              <code
                className="block bg-muted p-2 rounded text-xs font-mono overflow-x-auto"
                {...props}
              >
                {children}
              </code>
            );
          },
          pre: ({ children }) => (
            <pre className="bg-muted p-2 rounded overflow-x-auto">
              {children}
            </pre>
          ),
          ul: ({ children }) => (
            <ul className="list-disc list-inside m-0 mb-2">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal list-inside m-0 mb-2">{children}</ol>
          ),
          li: ({ children }) => <li className="mb-1">{children}</li>,
          h1: ({ children }) => (
            <h1 className="text-lg font-bold mb-2">{children}</h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-base font-bold mb-2">{children}</h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-sm font-bold mb-2">{children}</h3>
          ),
          blockquote: ({ children }) => (
            <blockquote className="border-l-4 border-muted-foreground pl-4 italic my-2">
              {children}
            </blockquote>
          ),
          table: ({ children }) => (
            <table className="border-collapse border border-muted w-full text-xs mb-2">
              {children}
            </table>
          ),
          th: ({ children }) => (
            <th className="border border-muted px-2 py-1 bg-muted font-semibold text-left">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="border border-muted px-2 py-1">{children}</td>
          ),
        }}
      >
        {isStreaming ? content + " " : content}
      </ReactMarkdown>
      {isStreaming && <span className="animate-pulse">|</span>}
    </div>
  );
}
