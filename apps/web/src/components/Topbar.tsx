export default function Topbar() {
  return (
    <header className="h-14 border-b border-white/10 flex items-center justify-between px-6">
      <div>
        <h2 className="text-sm font-medium text-white">new chat</h2>
      </div>

      <div className="flex items-center gap-2 text-xs text-white/45">
        <span className="h-2 w-2 rounded-full bg-green-400" />
        localhost • bobai alpha
      </div>
    </header>
  );
}