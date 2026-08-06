"use client";

export default function Topbar() {
  return (
    <header className="border-b border-white/10 bg-black px-6 py-4">
      <div className="mx-auto flex max-w-4xl items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-white">
            bobai
          </h1>
          <p className="text-xs text-white/40">
            localhost • alpha
          </p>
        </div>

        <div className="rounded-full border border-white/10 bg-[#121212] px-3 py-1 text-xs text-white/50">
          local
        </div>
      </div>
    </header>
  );
}