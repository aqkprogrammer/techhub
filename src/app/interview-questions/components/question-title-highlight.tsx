/**
 * Renders question title with technical terms (e.g. $scope, ng-model, CamelCase) highlighted
 * using the design system accent color.
 */
export default function QuestionTitleHighlight({ title }: { title: string }) {
  const parts = title.split(/(\$[a-zA-Z_]+|ng-[a-zA-Z0-9-]+|\b[A-Z][a-z]+(?:[A-Z][a-z]+)+\b)/g);
  return (
    <>
      {parts.map((part, i) => {
        if (/^\$[a-zA-Z_]+$|^ng-[a-zA-Z0-9-]+$|^[A-Z][a-z]+(?:[A-Z][a-z]+)+$/.test(part)) {
          return (
            <span key={i} className="font-medium text-[rgb(var(--accent))]">
              {part}
            </span>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </>
  );
}
