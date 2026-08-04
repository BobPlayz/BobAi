export default function Topbar() {
  return (
    <div className="flex h-14 items-center justify-between border-b border-white/10 px-6 bg-black">
      <h1 className="text-[15px] font-semibold text-white">new chat</h1>

      <div className="flex items-center gap-2 text-xs text-white/55">
        <div className="h-2 w-2 rounded-full bg-emerald-400" />
        <span>localhost • bobai alpha</span>
      </div>
    </div>
  );
}