import BobLogo from "@/components/BobLogo";

export default function Sidebar() {
  return (
    <aside className="w-64 border-r border-white/10 bg-[#0a0a0a] flex flex-col">
      <div className="p-4 border-b border-white/10">
        <div className="flex items-center gap-3">
          <BobLogo />
          <div>
            <h1 className="text-lg font-semibold tracking-tight text-white">bobai</h1>
            <p className="text-xs text-white/45">alpha</p>
          </div>
        </div>

        <button className="mt-4 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-left text-sm text-white/80 hover:bg-white/10 transition">
          + new chat
        </button>
      </div>

      <div className="flex-1 p-4">
        <div className="mt-8 text-center text-white/30 text-sm">
          no conversations yet
        </div>
      </div>

      <div className="border-t border-white/10 p-4">
        <div className="flex items-center gap-3">
          <BobLogo />

          <div className="min-w-0">
            <p className="text-sm font-medium text-white truncate">bob</p>
            <p className="text-xs text-white/45 truncate">8th class • building bobai</p>
          </div>
        </div>
      </div>
    </aside>
  );
}