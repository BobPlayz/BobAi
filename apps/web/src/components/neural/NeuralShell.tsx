"use client";

import { Menu } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";

type Props = { sidebar: ReactNode; topbar: ReactNode; children: ReactNode; composer: ReactNode };

/** Workspace frame: sidebar, hairline top bar, conversation, composer. Phones get the sidebar as a drawer. */
export default function NeuralShell({ sidebar, topbar, children, composer }: Props) {
  const [drawer, setDrawer] = useState(false);

  useEffect(() => {
    if (!drawer) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") setDrawer(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [drawer]);

  return (
    <div className="atelier-shell">
      <aside className="atelier-sidebar" aria-label="Conversations">{sidebar}</aside>
      {drawer && (
        <div className="atelier-sidebar-mobile md:hidden" role="dialog" aria-modal="true" aria-label="Conversations">
          {/* Clicking a conversation closes the drawer too. */}
          <aside className="atelier-sidebar" onClick={(event) => { if ((event.target as HTMLElement).closest("[data-close-drawer]")) setDrawer(false); }}>{sidebar}</aside>
          <button type="button" className="atelier-scrim" aria-label="Close conversations" onClick={() => setDrawer(false)} />
        </div>
      )}
      <div className="atelier-main">
        <header className="atelier-topbar">
          <button type="button" className="atelier-iconbtn md:hidden" aria-label="Open conversations" onClick={() => setDrawer(true)}>
            <Menu className="h-5 w-5" aria-hidden />
          </button>
          <div className="min-w-0 flex-1">{topbar}</div>
        </header>
        <main className="relative min-h-0 flex-1 overflow-hidden">{children}</main>
        <footer className="atelier-composer-wrap">{composer}</footer>
      </div>
    </div>
  );
}
