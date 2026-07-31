const { Transform } = require('stream');

const esbuild = require('esbuild');

/**
 * Browserify transform that compiles TypeScript sources to CommonJS via esbuild.
 *
 * This replaces the `tsify` plugin, which is unmaintained and cannot run against
 * TypeScript 5+: as of TypeScript 7 the `typescript` package no longer exposes the
 * compiler API from its main entry point, so `require('typescript')` returns only
 * version information and tsify fails on load.
 *
 * esbuild only strips and transpiles types, it does not check them. Type errors are
 * reported by `npm run typecheck` (tsc --noEmit) instead, which `npm run build` runs
 * first so that a type error still fails the build like it did under tsify.
 */
module.exports = function tsTransform(file) {
  if (!file.endsWith('.ts') || file.endsWith('.d.ts')) {
    return new Transform({
      transform(chunk, encoding, callback) {
        callback(null, chunk);
      },
    });
  }

  const chunks = [];
  return new Transform({
    transform(chunk, encoding, callback) {
      chunks.push(chunk);
      callback();
    },
    flush(callback) {
      try {
        const { code } = esbuild.transformSync(Buffer.concat(chunks).toString('utf8'), {
          loader: 'ts',
          format: 'cjs',
          target: 'es2022',
          sourcefile: file,
          sourcemap: 'inline',
        });
        callback(null, code);
      } catch (err) {
        callback(err);
      }
    },
  });
};
