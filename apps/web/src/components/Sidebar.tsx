const conversations = [
  "bobai website ideas",
  "project origin rewrite",
  "bobai-1 roadmap",
];

export default function Sidebar() {
  return (
    <aside className="w-72 border-r border-white/10 bg-[#0d0d0d] p-4 flex flex-col">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-bold">bobai</h1>
        <button className="rounded-lg bg-white/10 px-3 py-1 text-sm hover:bg-white/20">
          +
        </button>
      </div>

      <button className="mb-6 w-full rounded-2xl bg-white px-4 py-3 text-left font-semibold text-black hover:bg-gray-200">
        + new chat
      </button>

      <div className="flex-1 space-y-2">
        <p className="px-2 text-xs uppercase tracking-widest text-white/40">
          today
        </p>

        {conversations.map((title) => (
          <div
            key={title}
            className="rounded-xl px-3 py-3 text-white/80 hover:bg-white/5 cursor-pointer"
          >
            {title}
          </div>
        ))}
      </div>

      <div className="pt-6">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
          <p className="font-semibold">bob</p>
          <p className="text-sm text-white/60">
            8th class • building bobai
          </p>
        </div>
      </div>
    </aside>
  );
}