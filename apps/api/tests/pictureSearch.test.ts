import assert from "node:assert/strict";
import test from "node:test";

process.env.DATABASE_URL ||= "postgres://test:test@127.0.0.1:1/test";
const { searchPictures } = await import("../src/services/pictureSearch.js");

const page = (index: number, title: string, thumb: string, extra: Record<string, string> = {}) => ({ index, title: `File:${title}.jpg`, imageinfo: [{ thumburl: thumb, descriptionurl: `https://commons.wikimedia.org/wiki/File:${index}`, mime: "image/jpeg", extmetadata: { Artist: { value: "<a href='x'>Ravi</a>" }, LicenseShortName: { value: "CC BY-SA 4.0" }, ...Object.fromEntries(Object.entries(extra).map(([k, v]) => [k, { value: v }])) } }] });

test("picture search keeps credited Wikimedia pictures and drops adult or off-site results", async () => {
  const original = globalThis.fetch;
  let asked = "";
  globalThis.fetch = (async (input: string | URL | Request) => {
    asked = String(input);
    return Response.json({ query: { pages: {
      a: page(1, "Muggulu design", "https://thumb.wikimedia.org/a.jpg"),
      b: page(2, "Beach bikini photo", "https://upload.wikimedia.org/b.jpg"),
      c: page(3, "Rangoli", "https://evil.example/c.jpg"),
      d: page(4, "Kolam", "https://upload.wikimedia.org/d.jpg", { ImageDescription: "an explicit image" }),
    } } });
  }) as typeof fetch;
  try {
    const pictures = await searchPictures("muggulu", 6);
    assert.deepEqual(pictures.map((p) => p.title), ["Muggulu design"]);
    assert.equal(pictures[0].credit, "Ravi");
    assert.equal(pictures[0].license, "CC BY-SA 4.0");
    assert.match(asked, /^https:\/\/commons\.wikimedia\.org\/w\/api\.php\?/);
    await assert.rejects(searchPictures("naked people", 6), /safety policy/);
  } finally { globalThis.fetch = original; }
});
