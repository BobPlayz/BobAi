"use client";

import { useEffect, useState } from "react";
import {
  loadSettings,
  saveSettings,
  type BobSettings,
} from "@/lib/settings";

export default function SettingsPage() {
  const [settings, setSettings] =
    useState<BobSettings | null>(null);

  useEffect(() => {
    setSettings(loadSettings());
  }, []);

  if (!settings) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-black text-white">
        loading settings...
      </main>
    );
  }

  function update(next: Partial<BobSettings>) {
    const updated = { ...settings, ...next };
    setSettings(updated);
    saveSettings(updated);
  }

  return (
    <main className="min-h-screen bg-black px-6 py-8 text-white">
      <div className="mx-auto max-w-3xl">
        <h1 className="text-3xl font-semibold">settings</h1>
        <p className="mt-2 text-white/50">
          personalize how bobai talks and remembers you
        </p>

        <div className="mt-8 space-y-6">
          <section className="rounded-2xl border border-white/10 bg-[#121212] p-5">
            <h2 className="text-lg font-medium">profile</h2>

            <div className="mt-4 space-y-4">
              <div>
                <label className="text-sm text-white/60">
                  display name
                </label>
                <input
                  value={settings.displayName}
                  onChange={(e) =>
                    update({
                      displayName: e.target.value,
                    })
                  }
                  className="mt-2 w-full rounded-xl border border-white/10 bg-black px-3 py-2 outline-none"
                />
              </div>

              <div>
                <label className="text-sm text-white/60">
                  username
                </label>
                <input
                  value={settings.username}
                  onChange={(e) =>
                    update({
                      username: e.target.value,
                    })
                  }
                  className="mt-2 w-full rounded-xl border border-white/10 bg-black px-3 py-2 outline-none"
                />
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-white/10 bg-[#121212] p-5">
            <h2 className="text-lg font-medium">
              personalization
            </h2>

            <div className="mt-4 space-y-4">
              <div>
                <label className="text-sm text-white/60">
                  typing style
                </label>
                <select
                  value={settings.typingStyle}
                  onChange={(e) =>
                    update({
                      typingStyle:
                        e.target.value as BobSettings["typingStyle"],
                    })
                  }
                  className="mt-2 w-full rounded-xl border border-white/10 bg-black px-3 py-2 outline-none"
                >
                  <option value="casual">casual</option>
                  <option value="balanced">balanced</option>
                  <option value="formal">formal</option>
                </select>
              </div>

              <div>
                <label className="text-sm text-white/60">
                  response length
                </label>
                <select
                  value={settings.responseLength}
                  onChange={(e) =>
                    update({
                      responseLength:
                        e.target.value as BobSettings["responseLength"],
                    })
                  }
                  className="mt-2 w-full rounded-xl border border-white/10 bg-black px-3 py-2 outline-none"
                >
                  <option value="short">short</option>
                  <option value="medium">medium</option>
                  <option value="long">long</option>
                </select>
              </div>

              <label className="flex items-center justify-between rounded-xl border border-white/10 bg-black px-3 py-3">
                <span>memory enabled</span>
                <input
                  type="checkbox"
                  checked={settings.memoryEnabled}
                  onChange={(e) =>
                    update({
                      memoryEnabled: e.target.checked,
                    })
                  }
                />
              </label>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}