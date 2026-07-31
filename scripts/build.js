const fsSync = require('fs');
const fs = fsSync.promises;
const path = require('path');

const browserify = require('browserify');
const exorcist = require('exorcist');
const { mkdirp } = require('mkdirp');
const sass = require('sass');

const tsTransform = require('./ts-transform');

const baseDir = path.join(__dirname, '..');

(async () => {
  await mkdirp(path.join(baseDir, 'public', 'css'));
  await mkdirp(path.join(baseDir, 'public', 'js'));

  const dir = await fs.readdir('components', { withFileTypes: true });
  const components = dir
    .filter((component) => component.isDirectory())
    .map((component) => component.name);

  // sass
  console.log('sass:common');
  await sassFile(
    path.join(baseDir, 'public/scss/styles.scss'),
    path.join(baseDir, 'public/css/styles.css')
  );

  console.log('sass:components');
  await Promise.all(
    components.map(async (component) => {
      const componentPath = path.join(baseDir, `components/${component}/${component}`);
      try {
        await fs.access(`${componentPath}.scss`);
      } catch {
        /* ignore */
        return;
      }
      return sassFile(`${componentPath}.scss`, `${componentPath}.css`);
    })
  );

  // browserify
  console.log('browserify:common');
  const publicSourceDir = path.join(baseDir, 'public/source');
  const b = browserify(path.join(baseDir, 'public/source/main.js'), {
    noParse: ['dnd-page-scroll', 'jquery', 'knockout'],
    debug: true,
  });
  b.require(path.join(publicSourceDir, 'components.js'), { expose: 'ungit-components' });
  b.require(path.join(publicSourceDir, 'main.js'), { expose: 'ungit-main' });
  b.require(path.join(publicSourceDir, 'navigation.js'), { expose: 'ungit-navigation' });
  b.require(path.join(publicSourceDir, 'program-events.js'), { expose: 'ungit-program-events' });
  b.require(path.join(publicSourceDir, 'storage.js'), { expose: 'ungit-storage' });
  b.require(path.join(baseDir, 'source/address-parser.js'), { expose: 'ungit-address-parser' });
  b.require('bluebird', { expose: 'bluebird' });
  b.require('blueimp-md5', { expose: 'blueimp-md5' });
  // Exposed so component bundles, which are built with bundleExternal: false,
  // can drive modals imperatively now that Bootstrap 5 has no jQuery plugin.
  b.require('bootstrap/js/dist/modal', { expose: 'bootstrap/js/dist/modal' });
  b.require('diff2html', { expose: 'diff2html' });
  b.require('jquery', { expose: 'jquery' });
  b.require('knockout', { expose: 'knockout' });
  b.require('lodash', { expose: 'lodash' });
  b.require(path.join(baseDir, 'node_modules/snapsvg/src/mina.js'), { expose: 'mina' });
  b.require('moment', { expose: 'moment' });
  b.require('@primer/octicons', { expose: 'octicons' });
  b.require('signals', { expose: 'signals' });
  b.require('winston', { expose: 'winston' });
  const ungitjsFile = path.join(baseDir, 'public/js/ungit.js');
  const mapFile = path.join(baseDir, 'public/js/ungit.js.map');
  await new Promise((resolve, reject) => {
    const outFile = fsSync.createWriteStream(ungitjsFile);
    outFile.on('close', () => resolve());
    outFile.on('error', reject);
    b.bundle().on('error', reject).pipe(exorcist(mapFile)).pipe(outFile);
  });
  console.log(`browserify ${path.relative(baseDir, ungitjsFile)}`);

  console.log('browserify:components');
  for (const component of components) {
    console.log(`browserify:components:${component}`);
    const sourcePrefix = path.join(baseDir, `components/${component}/${component}`);
    const destination = path.join(baseDir, `components/${component}/${component}.bundle.js`);

    // Resolve the entry point first, so that a bundling failure below is reported as
    // such instead of being misattributed to a missing component.
    const source = await firstExisting([`${sourcePrefix}.js`, `${sourcePrefix}.ts`]);
    if (!source) {
      console.warn(
        `${sourcePrefix} does not exist. If this component is obsolete, please remove that directory or perform a clean build.`
      );
      continue;
    }
    await browserifyFile(source, destination);
  }

  // copy
  // Bootstrap dropped Glyphicons in v4, so there are no longer any fonts to
  // copy out of the package; see the glyphicon rules in public/scss/_compat.scss.

  console.log('copy raven');
  await Promise.all(
    ['node_modules/raven-js/dist/raven.min.js', 'node_modules/raven-js/dist/raven.min.js.map'].map(
      async (file) => {
        await copyToFolder(file, 'public/js');
      }
    )
  );
})();

async function sassFile(source, destination) {
  const output = sass.compile(source, {
    // Component stylesheets are compiled individually and refer to the shared
    // variables as 'public/scss/variables', which resolves from the repo root.
    loadPaths: [baseDir],
    sourceMap: true,
    sourceMapIncludeSources: true,
    // Bootstrap 5.3 predates several Dart Sass deprecations (@import, global
    // colour/maths builtins, the old if() signature) and emits ~290 warnings
    // that would bury real build output. These are silenced for that reason
    // only; the application's own Sass is free of them, so the list should be
    // trimmed as Bootstrap modernises rather than extended.
    silenceDeprecations: ['import', 'global-builtin', 'color-functions', 'if-function'],
  });

  const map = { ...output.sourceMap, sources: output.sourceMap.sources.map(relativeSource) };
  await fs.writeFile(
    destination,
    `${output.css}\n/*# sourceMappingURL=${path.basename(destination)}.map */\n`
  );
  await fs.writeFile(`${destination}.map`, JSON.stringify(map));
  console.log(`sass ${path.relative(baseDir, destination)}`);
}

function relativeSource(source) {
  return source.startsWith('file://') ? path.relative(baseDir, new URL(source).pathname) : source;
}

async function firstExisting(candidates) {
  for (const candidate of candidates) {
    try {
      await fs.access(candidate);
      return candidate;
    } catch {
      /* try the next one */
    }
  }
  return undefined;
}

async function browserifyFile(source, destination) {
  const mapDestination = `${destination}.map`;
  await new Promise((resolve, reject) => {
    const b = browserify(source, {
      bundleExternal: false,
      debug: true,
      // `require('../ComponentRoot')` has to resolve to ComponentRoot.ts
      extensions: ['.js', '.ts'],
    }).transform(tsTransform);

    const outFile = fsSync.createWriteStream(destination);
    outFile.on('close', () => resolve());
    outFile.on('error', reject);
    b.bundle().on('error', reject).pipe(exorcist(mapDestination)).pipe(outFile);
  });
  console.log(`browserify ${path.relative(baseDir, destination)}`);
}
async function copyToFolder(source, destination) {
  source = path.join(baseDir, source);
  destination = path.join(baseDir, destination, path.basename(source));
  await fs.copyFile(source, destination);
  console.log(`copy ${path.relative(baseDir, destination)}`);
}
