export function ErrorState({ message }: { message: string }) {
  return (
    <div className="error-state">
      <p>Could not load data. Check that the API is reachable.</p>
      <pre>{message}</pre>
    </div>
  );
}
