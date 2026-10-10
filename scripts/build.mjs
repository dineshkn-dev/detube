import { build } from 'esbuild';
import { mkdir, copyFile, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { generateIcons } from './icons.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outdir = path.join(root, 'dist');
const watch = process.argv.includes('--watch');

const src = (relative) => path.join(root, relative);
const out = (relative) => path.join(outdir, relative);

/**
 * Exposes a bundled stylesheet to the content bundle as a JS string so the
 * Shadow DOM can adopt it via `adoptedStyleSheets`. A nested esbuild pass
 * resolves `@import` (the shared design tokens) — which a plain `text` loader
 * would leave unresolved, and which is exactly what lets one token file serve
 * the feed and both extension pages without duplication.
 */
function cssTextPlugin() {
  return {
    name: 'css-text',
    setup(pluginBuild) {
      pluginBuild.onLoad({ filter: /\.css$/ }, async (args) => {
        const result = await build({
          entryPoints: [args.path],
          bundle: true,
          write: false,
          outdir: 'virtual',
          metafile: true,
          logLevel: 'silent',
        });
        const css = result.outputFiles?.[0]?.text ?? '';
        // Watch every stylesheet in the graph so `--watch` rebuilds on token edits.
        const watchFiles = Object.keys(result.metafile?.inputs ?? {}).map((input) =>
          path.resolve(root, input),
        );
        return { contents: `export default ${JSON.stringify(css)};`, loader: 'js', watchFiles };
      });
    },
  };
}

const js = {
  bundle: true,
  target: 'chrome120',
  logLevel: 'info',
  minify: false,
  sourcemap: false,
};

const configs = [
  {
    entryPoints: [src('src/background/serviceWorker.ts')],
    outfile: out('background.js'),
    format: 'esm',
    ...js,
  },
  {
    entryPoints: [src('src/content/content.ts')],
    outfile: out('content.js'),
    format: 'iife',
    plugins: [cssTextPlugin()],
    ...js,
  },
  {
    entryPoints: [src('src/options/options.ts')],
    outfile: out('options.js'),
    format: 'iife',
    ...js,
  },
  {
    entryPoints: [src('src/popup/popup.ts')],
    outfile: out('popup.js'),
    format: 'iife',
    ...js,
  },
  // Stylesheets are bundled (not copied) so their shared `@import` resolves.
  { entryPoints: [src('src/options/options.css')], outfile: out('options.css'), ...js },
  { entryPoints: [src('src/popup/popup.css')], outfile: out('popup.css'), ...js },
];

const assets = [
  ['manifest.json', 'manifest.json'],
  ['src/options/options.html', 'options.html'],
  ['src/popup/popup.html', 'popup.html'],
];

async function copyAssets() {
  await Promise.all(assets.map(([from, to]) => copyFile(src(from), out(to))));
}

async function run() {
  await mkdir(outdir, { recursive: true });

  if (watch) {
    const { context } = await import('esbuild');
    const contexts = await Promise.all(configs.map((config) => context(config)));
    await Promise.all(contexts.map((ctx) => ctx.watch()));
    await generateIcons(out('icons'));
    await copyAssets();
    console.log('Watching for changes… (Ctrl+C to stop)');
    return;
  }

  await rm(outdir, { recursive: true, force: true });
  await mkdir(outdir, { recursive: true });
  await generateIcons(out('icons'));
  await Promise.all(configs.map((config) => build(config)));
  await copyAssets();
  console.log('Build complete → dist/');
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
