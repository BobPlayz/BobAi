export default function Topbar() {
  return (
    <header className="border-b border-white/10 px-6 py-4 flex items-center justify-between">
      <div>
        <h2 className="text-lg font-semibold">new chat</h2>
        <p className="text-sm text-white/50">
          localhost • bobai alpha
        </p>
      </div>

      <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-sm text-white/70">
        online
      </div>
    </header>
  );
}