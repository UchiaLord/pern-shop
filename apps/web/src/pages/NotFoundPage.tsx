import { Link } from 'react-router-dom';

export default function NotFoundPage() {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="text-6xl font-bold tracking-tight">404</h1>

      <p className="max-w-md text-muted-foreground">
        Die angeforderte Seite existiert nicht oder wurde verschoben.
      </p>

      <div className="flex flex-col gap-3 sm:flex-row">
        <Link
          to="/"
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Zur Startseite
        </Link>

        <Link
          to="/products"
          className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-accent"
        >
          Produkte ansehen
        </Link>
      </div>
    </div>
  );
}