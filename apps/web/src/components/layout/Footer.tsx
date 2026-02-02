export function Footer() {
  return (
    <footer className="mx-auto max-w-6xl px-4 pb-10 pt-6 text-sm text-[rgb(var(--muted))]">
      <div className="flex flex-col gap-2 border-t border-white/10 pt-6 md:flex-row md:items-center md:justify-between">
        <div>© {new Date().getFullYear()} PERN Shop</div>
        <div className="flex gap-4">
          <a className="hover:text-[rgb(var(--fg))]" href="#">
            Impressum
          </a>
          <a className="hover:text-[rgb(var(--fg))]" href="#">
            Datenschutz
          </a>
        </div>
      </div>
    </footer>
  );
}