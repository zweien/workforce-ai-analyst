import ReactMarkdown, { Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';

// Dark-panel markdown styling for the AI report. Explicit component classes
// (instead of the typography plugin) so rendering does not depend on the
// Tailwind CDN serving extra plugins.
const components: Components = {
  h1: ({ children }) => (
    <h1 className="text-xl font-bold text-white mt-6 mb-3 first:mt-0">{children}</h1>
  ),
  h2: ({ children }) => (
    <h2 className="text-lg font-semibold text-white mt-6 mb-2.5 first:mt-0">{children}</h2>
  ),
  h3: ({ children }) => (
    <h3 className="text-base font-semibold text-blue-100 mt-4 mb-2 first:mt-0">{children}</h3>
  ),
  p: ({ children }) => <p className="text-sm leading-7 text-indigo-50 my-3">{children}</p>,
  ul: ({ children }) => <ul className="list-disc pl-5 space-y-1.5 my-3">{children}</ul>,
  ol: ({ children }) => <ol className="list-decimal pl-5 space-y-1.5 my-3">{children}</ol>,
  li: ({ children }) => <li className="text-sm leading-6 text-indigo-50 marker:text-blue-300">{children}</li>,
  strong: ({ children }) => <strong className="font-semibold text-white">{children}</strong>,
  em: ({ children }) => <em className="italic text-blue-100">{children}</em>,
  a: ({ children, href }) => (
    <a href={href} target="_blank" rel="noreferrer" className="text-blue-300 underline underline-offset-2 hover:text-blue-200">
      {children}
    </a>
  ),
  blockquote: ({ children }) => (
    <blockquote className="border-l-4 border-blue-400/50 pl-4 my-3 text-indigo-200 italic">{children}</blockquote>
  ),
  hr: () => <hr className="border-white/20 my-5" />,
  code: ({ className, children }) => {
    const isBlock = /language-/.test(className ?? '');
    if (isBlock) {
      return (
        <code className="block font-mono text-[13px] leading-6 text-indigo-100 whitespace-pre">{children}</code>
      );
    }
    return (
      <code className="font-mono text-[13px] text-amber-200 bg-black/30 rounded px-1.5 py-0.5">{children}</code>
    );
  },
  pre: ({ children }) => (
    <pre className="bg-black/40 rounded-lg p-4 overflow-x-auto my-3">{children}</pre>
  ),
  table: ({ children }) => (
    <div className="overflow-x-auto my-4">
      <table className="w-full text-sm border-collapse">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className="bg-white/10">{children}</thead>,
  th: ({ children }) => (
    <th className="px-3 py-2 border border-white/15 text-left font-semibold text-white whitespace-nowrap">{children}</th>
  ),
  td: ({ children }) => (
    <td className="px-3 py-2 border border-white/10 text-indigo-100">{children}</td>
  ),
};

export const MarkdownReport: React.FC<{ content: string }> = ({ content }) => (
  <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
    {content}
  </ReactMarkdown>
);
