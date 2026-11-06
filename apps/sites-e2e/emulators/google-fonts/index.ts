import { EmulatorError, startEmulator } from "../core/service";
import type { EmulatedFontFamily, GoogleFontsEmulatorOptions } from "./types";

const FAMILY_SPEC = /^(.+):wght@([\d.;]+)$/;

function directoryOf(family: string): string {
  return family.toLowerCase().replace(/[^a-z0-9]/g, "");
}

// Google Fonts as the Sites server downloads it before a build: the CSS API
// (`/css2?family=Name:wght@300..800`), the font files it links and the
// licenses in the google/fonts repository (`/ofl/<dir>/OFL.txt`), all on one
// origin. Like Google, the CSS API answers 400 for an unknown family or a
// weight outside the font's axis.
export async function startGoogleFontsEmulator(
  options: GoogleFontsEmulatorOptions
) {
  const byDirectory = new Map<string, [string, EmulatedFontFamily]>(
    Object.entries(options.families).map(([name, family]) => [
      directoryOf(name),
      [name, family],
    ])
  );
  const server = await startEmulator("google-fonts", [
    {
      method: "GET",
      path: "/css2",
      handle: (_request, _params, url) => {
        const faces = url.searchParams.getAll("family").flatMap((value) => {
          const [, name = "", spec = ""] = FAMILY_SPEC.exec(value) ?? [];
          const family = options.families[name];
          if (!family) {
            throw new EmulatorError(400, `Unknown font family ${value}`);
          }
          const [low, high] = family.weights;
          const weights = spec.includes("..")
            ? [spec.replace("..", " ")]
            : spec.split(";");
          for (const weight of weights.flatMap((item) =>
            item.split(" ").map(Number)
          )) {
            if (!(weight >= low && weight <= high)) {
              throw new EmulatorError(400, `${name} has no weight ${weight}`);
            }
          }
          return weights.map(
            (weight) =>
              `/* latin */\n@font-face {\n  font-family: '${name}';\n  font-style: normal;\n  font-weight: ${weight};\n  font-display: swap;\n  src: url(${url.origin}/s/${directoryOf(name)}/v1/${directoryOf(name)}-latin.woff2) format('woff2');\n  unicode-range: U+0000-00FF;\n}\n`
          );
        });
        if (faces.length === 0) {
          throw new EmulatorError(400, "Missing font family");
        }
        return new Response(faces.join(""), {
          headers: { "content-type": "text/css; charset=utf-8" },
        });
      },
    },
    {
      method: "GET",
      path: "/s/:directory/v1/:file",
      handle: (_request, params) => {
        const entry = byDirectory.get(params.directory ?? "");
        if (!entry) {
          throw new EmulatorError(404, "No such font file");
        }
        return new Response(entry[1].file, {
          headers: { "content-type": "font/woff2" },
        });
      },
    },
    {
      // Sites tries ofl/, apache/ and ufl/ in turn, as google/fonts sorts them.
      method: "GET",
      path: "/:category/:directory/:file",
      handle: (_request, params) => {
        const entry = byDirectory.get(params.directory ?? "");
        if (
          !(entry && params.category === "ofl" && params.file === "OFL.txt")
        ) {
          return new Response("404: Not Found", { status: 404 });
        }
        return new Response(entry[1].license);
      },
    },
  ]);
  return {
    ...server,
    env: { SITES_GOOGLE_FONTS_URL: server.url },
  };
}
