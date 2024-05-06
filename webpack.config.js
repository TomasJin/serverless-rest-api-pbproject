const path = require('path');
const slsw = require('serverless-webpack');
const argv = require('yargs').argv;
const nodeExternals = require('webpack-node-externals');
const UglifyJsPlugin = require('uglifyjs-webpack-plugin');
const noop = require('noop-webpack-plugin');

const STAGE = argv.stage || argv.s || 'dev';

module.exports = {
  entry: slsw.lib.entries,
  devtool: 'source-map',
  target: 'node',
  // Since 'aws-sdk' is not compatible with webpack,
  // we exclude all node dependencies
  externals: [nodeExternals()],
  // Run babel on all .js files and skip those in node_modules
  module: {
    rules: [
      {
        test: /\.js$/,
        loader: 'babel-loader',
        include: __dirname,
        exclude: /node_modules/
      }
    ]
  },
  resolve: {
    modules: [
      path.resolve(__dirname, 'src'),
      path.resolve(__dirname, 'node_modules')
    ]
  },
  plugins: [
    STAGE === 'prod' ? new UglifyJsPlugin() : noop()
  ]
};
