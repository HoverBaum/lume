import { initPlugins, readDenoConfig, writeDenoConfig } from "../core/utils.ts";

import type { DenoConfigResult } from "../core/utils.ts";

interface Options {
  plugins?: string[];
}

/** Generate import_map.json and deno.json files */
export default function ({ plugins }: Options = {}) {
  return importMap(new URL(import.meta.resolve("../")), plugins || []);
}

export async function importMap(url: URL, plugins: string[] = []) {
  const denoConfig: DenoConfigResult = await readDenoConfig() || {
    config: {},
    file: "deno.json",
  };

  denoConfig.importMap ??= { imports: {} };

  const { config, importMap, file } = denoConfig;

  // Configure the import map
  config.importMap ||= "./import_map.json";

  const oldUrl = importMap.imports["lume/"];
  const newUrl = new URL("./", url).href;
  importMap.imports["lume/"] = newUrl;

  for (const [specifier, url] of Object.entries(importMap.imports)) {
    if (url.startsWith(oldUrl)) {
      importMap.imports[specifier] = url.replace(oldUrl, newUrl);
    }
  }

  // Configure lume tasks
  const tasks = config.tasks || {};
  tasks.lume = `echo "import 'lume/cli.ts'" | deno run --unstable -A -`;
  tasks.build = "deno task lume";
  tasks.serve = "deno task lume -s";
  config.tasks = tasks;

  // Transform the import map and deno config by the plugins
  await Promise.all(plugins.map(async (name) => {
    if (initPlugins.includes(name)) {
      const { init } = await import(`../plugins/${name}.ts`);
      init(denoConfig);
    }
  }));

  // Write the configuration
  await writeDenoConfig({ file, importMap, config });
}
