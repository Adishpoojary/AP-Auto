const webpack = require("webpack")
const path = require("path")

module.exports = function override(config) {
  // Add polyfills for Node.js modules
  const fallback = config.resolve.fallback || {}
  Object.assign(fallback, {
    crypto: require.resolve("crypto-browserify"),
    stream: require.resolve("stream-browserify"),
    assert: require.resolve("assert"),
    http: require.resolve("stream-http"),
    https: require.resolve("https-browserify"),
    os: require.resolve("os-browserify"),
    url: require.resolve("url"),
    vm: require.resolve("vm-browserify"),
    buffer: require.resolve("buffer/"),
    util: require.resolve("util/"),
    process: require.resolve("process/browser"),
    zlib: false,
    fs: false,
    net: false,
    tls: false,
    child_process: false,
  })
  config.resolve.fallback = fallback

  // Add plugins for global variables
  config.plugins = (config.plugins || []).concat([
    new webpack.ProvidePlugin({
      process: "process/browser",
      Buffer: ["buffer", "Buffer"],
    }),
    new webpack.DefinePlugin({
      process: { env: {} },
    }),
  ])

  // Resolve modules from src directory
  const modules = config.resolve.modules
  config.resolve.modules = [...modules, path.resolve(__dirname, "src")]

  // Handle ES modules
  config.module.rules.push({
    test: /\.m?js/,
    resolve: {
      fullySpecified: false,
    },
  })

  // Ignore warnings from node_modules
  config.ignoreWarnings = [
    {
      module: /node_modules/,
    },
  ]

  return config
}
