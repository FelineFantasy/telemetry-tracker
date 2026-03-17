export function PageTitle({
  title,
  context,
}: {
  title: string;
  context?: string;
}) {
  return (
    <>
      <h1 className="page-title">{title}</h1>
      {context ? <p className="page-context">{context}</p> : null}
    </>
  );
}
