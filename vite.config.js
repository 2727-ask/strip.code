import { defineConfig } from 'vite';

export default defineConfig({
  // Relative URLs, so the built site works from any path: a GitHub Pages project
  // site lives under /<repo>/, a custom domain at /, a local preview at /.
  base: './',

  build: {
    target: 'es2022',
    sourcemap: false,

    // three.js on its own is a few hundred kB; that is expected, not a warning sign
    chunkSizeWarningLimit: 900,

    rolldownOptions: {
      output: {
        // Split the big libraries into their own files. The age gate loads none of
        // them; after "Yes" they download in parallel, and because their names are
        // content-hashed they stay cached across deploys until the library changes.
        codeSplitting: {
          groups: [
            { name: 'three', test: /node_modules[\\/]three[\\/]/, priority: 20 },
            {
              name: 'editor',
              test: /node_modules[\\/](@codemirror|@lezer|codemirror|crelt|style-mod|w3c-keyname|@marijn)[\\/]/,
              priority: 10,
            },
          ],
        },
      },
    },
  },
});
