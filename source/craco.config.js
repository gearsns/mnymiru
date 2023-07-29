var webpack = require('webpack');
var path = require('path');
var fs = require('fs');

var nodeModules = {};
fs.readdirSync('node_modules')
  .filter(function (x) {
    return ['.bin'].indexOf(x) === -1;
  })
  .forEach(function (mod) {
    nodeModules[mod] = 'commonjs ' + mod;
  });

module.exports = {
  webpack: {
    configure: {
      // See https://github.com/webpack/webpack/issues/6725
      module: {
        rules: [{
          test: /\.wasm$/,
          type: 'webassembly/async',
        }]
      },
      resolve: {
        fallback: {
          fs: false,
          path: false,
          crypto: false,
          stream: false,
          env: false,
          wasi_snapshot_preview1: false,
        },
      },
      experiments: {
        asyncWebAssembly: true,
      },
      devServer: {
        mimeTypes: { 'application/wasm': ['wasm'] },
        port: 9000
      }
    }
  },
  externals: nodeModules
};