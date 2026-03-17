type CodeBlockProps = { code: string; lang?: string };

export function CodeBlock({ code, lang }: CodeBlockProps) {
  return (
    <pre>
      <code className={lang ? `language-${lang}` : undefined}>{code.trim()}</code>
    </pre>
  );
}
