"use client";

type Props = {
  onStop: () => void;
};

export default function StopButton({
  onStop,
}: Props) {
  return (
    <button
      onClick={onStop}
      className="inline-flex h-9 items-center justify-center rounded-full border border-white/10 bg-[#121212] px-4 text-sm text-white transition hover:bg-[#1a1a1a]"
    >
        Stop
    </button>
  );
}