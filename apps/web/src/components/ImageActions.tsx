"use client";

type Props = {
  prompt: string;
  imageUrl: string;
  onRegenerate: (prompt: string) => void;
};

export default function ImageActions({
  prompt,
  imageUrl,
  onRegenerate,
}: Props) {
  async function download() {
    const response = await fetch(imageUrl);
    const blob = await response.blob();

    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = `bobai-${Date.now()}.png`;
    a.click();

    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex gap-2">
      <button
        onClick={download}
        className="rounded-xl border border-white/10 bg-[#181818] px-3 py-2 text-sm text-white transition hover:bg-[#202020]"
      >
        download
      </button>

      <button
        onClick={() => onRegenerate(prompt)}
        className="rounded-xl border border-white/10 bg-[#181818] px-3 py-2 text-sm text-white transition hover:bg-[#202020]"
      >
        regenerate
      </button>
    </div>
  );
}