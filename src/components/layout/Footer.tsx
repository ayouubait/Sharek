export default function Footer() {
  return (
    <footer className="bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 mt-auto">
      <div className="max-w-7xl mx-auto px-4 lg:px-8 xl:px-12 py-4 md:py-5">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-2 md:gap-3">
          <p className="text-[11px] md:text-xs text-slate-400 dark:text-slate-500">
            &copy; {new Date().getFullYear()} ShareK — Tous droits réservés
          </p>
          <p className="text-[11px] md:text-xs text-slate-400 dark:text-slate-500 text-center sm:text-right">
            Développé par l&apos;équipe ERIPDS, ENS Tétouan, UAE — Maroc
          </p>
        </div>
      </div>
    </footer>
  );
}
