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
    // Growing the window to laptop size shows the real sidebar, so the drawer closes.
    const wide = window.matchMedia("(min-width: 768px)");
    const onWide = () => { if (wide.matches) setDrawer(false); };
    window.addEventListener("keydown", onKey);
    wide.addEventListener("change", onWide);
    return () => { window.removeEventListener("keydown", onKey); wide.removeEventListener("change", onWide); };
  }, [drawer]);

  return (
    <div className="atelier-shell">
      <aside className="atelier-sidebar" aria-label="Conversations">{sidebar}</aside>
      {drawer && (
        <div className="atelier-sidebar-mobile" role="dialog" aria-modal="true" aria-label="Conversations">
          {/* Clicking a conversation closes the drawer too. */}
          <aside className="atelier-sidebar" onClick={(event) => { if ((event.target as HTMLElement).closest("[data-close-drawer]")) setDrawer(false); }}>{sidebar}</aside>
          <button type="button" className="atelier-scrim" aria-label="Close conversations" onClick={() => setDrawer(false)} />
        </div>
      )}
      <div className="atelier-main">
        <header className="atelier-topbar">
          <button type="button" className="atelier-iconbtn atelier-menu-btn" aria-label="Open conversations" onClick={() => setDrawer(true)}>
            <Menu className="h-5 w-5" aria-hidden />
          </button>
          <div className="min-w-0 flex-1">{topbar}</div>
        </header>
        <main id="main" tabIndex={-1} className="relative min-h-0 flex-1 overflow-hidden">{children}</main>
        <footer className="atelier-composer-wrap">{composer}</footer>
      </div>
    </div>
  );
}
