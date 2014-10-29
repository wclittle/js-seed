var
  path = require("path");

var
  _ = require("lodash"),

  // Gulp
  gulp = require("gulp"),
  gulpHelp = require("gulp-help"),
  gutil = require("gulp-util"),
  stylus = require("gulp-stylus"),
  prefix = require("gulp-autoprefixer"),
  openUrl = require("open"),
  del = require("del"),
  webserver = require("gulp-webserver"),

  // Tests
  karma = require("karma").server,

  // Webpack
  webpack = require("webpack"),
  WebpackDevServer = require("webpack-dev-server");

  // Application config
var
  config = require("./project.config"),
  webpackConfig = require("./webpack.config");

var _frontendTest;

// Change `gulp.task` signature to require task descriptions.
gulpHelp(gulp);


/**
 * Composite Tasks
 */

gulp.task("default", false, ["help"], function () {});

gulp.task("build", "Copy assets, build CSS and JS.", ["lint", "test-phantom"], function () {
  gulp.run("clean");
  gulp.run("copy");
  gulp.run("build:css");
  gulp.run("build:js");
});

gulp.task("build-dev", "Build, but with unminified JS + sourcemaps.", ["clean"], function () {
  gulp.run("copy");
  gulp.run("build:css");
  gulp.run("build:js-dev");
});

gulp.task("watch", "Perform build-dev when sources change.", ["build-dev"], function () {
  gulp.watch(path.join(config.frontendFullPath, "**/*"), ["build-dev"]);
});


/**
 * Component Tasks
 */

gulp.task("clean", false, function (cb) {
  del([
    path.join(config.dest, "**")
  ], cb);
});

gulp.task("copy", false, function () {
  return gulp.src(
    path.join(config.frontendFullPath, config.assets, "**/*"),
    { base: path.join(config.frontendFullPath, config.assets) }
  ).pipe(gulp.dest(config.destFullPath));
});

require("./tasks/lint")(gulp, config);

gulp.task("reload:server", false, function () {
  gulp.src(config.destFullPath)
    .pipe(webserver({
      livereload: true,
      directoryListing: true,
      port: config.port,
      open: "/",
      https: false
    }));
});


/**
 * Stylus / CSS
 */

gulp.task("build:css", "Build CSS.", function () {
  return gulp.src(path.join(config.frontendFullPath, config.styles, "*"))
    .pipe(stylus({
      set: ["compress"],
      define: { "ie8": true }
    }))
    .pipe(prefix("last 1 version", "> 1%", "ie 8"))
    .pipe(gulp.dest(path.join(config.destFullPath, "styles")));
});


/**
 * JS
 */

gulp.task("build:js", "Build minified JS.", function (callback) {
  var webpackConf = _.cloneDeep(webpackConfig);

  webpackConf.plugins = webpackConf.plugins.concat([
    new webpack.DefinePlugin({
      "process.env": {
        "NODE_ENV": JSON.stringify("production")
      }
    }),
    new webpack.optimize.DedupePlugin(),
    new webpack.optimize.UglifyJsPlugin()
  ]);

  webpack(webpackConf, function (err, stats) {
    if (err) {
      throw new gutil.PluginError("build:js", err);
    }
    gutil.log("[build:js]", stats.toString({
      colors: true
    }));
    callback();
  });
});

gulp.task("build:js-dev", "Build unminified JS with sourcemaps.", function (callback) {
  var webpackConf = _.cloneDeep(webpackConfig);
  webpackConf.devtool = "sourcemap";
  webpackConf.debug = true;

  webpack(webpackConf, function (err, stats) {
    if (err) {
      throw new gutil.PluginError("build:js-dev", err);
    }
    gutil.log("[build:js-dev]", stats.toString({
      colors: true
    }));
    callback();
  });
});


/**
 * Tests
 */

_frontendTest = function (includeCoverage) {
  var server,
    wpConfig = Object.create(webpackConfig);

  wpConfig.entry = { test: [
    "webpack/hot/dev-server",
    "mocha!" + path.join(config.root, config.testRunner)
  ]};
  wpConfig.debug = true;
  wpConfig.devtool = "source-map";

  if (includeCoverage) {
    wpConfig.module.postLoaders = [{
      test: /^((?!(\/spec\/|\/node_modules\/)).)*$/,
      loader: "coverjs-loader"
    }];
  }

  wpConfig.plugins.push(new webpack.HotModuleReplacementPlugin());

  server = new WebpackDevServer(webpack(wpConfig), {
    hot: true,
    quiet: false,
    noInfo: false,
    watchDelay: 300,
    publicPath: "/",
    stats: {
      colors: true
    }
  });
  server.listen(9890, "localhost", function (err) {
    if (err) { throw new gutil.PluginError("[webpack-dev-server]", err); }
    openUrl("http://localhost:9890/webpack-dev-server/test.bundle");
  });

  return server;
};

gulp.task("test", "Run unit tests in the browser.", _.partial(_frontendTest, false));
gulp.task("test-coverage", "Run unit tests in browser, include coverage.",
  _.partial(_frontendTest, true));

gulp.task("test-karma", "Auto-run unit tests in multiple browsers.", function (done) {
  karma.start({
    configFile: path.join(config.root, config.karmaConfig),
    browsers: ["Chrome", "Firefox", "Safari"],
    singleRun: true
  }, function (err) {
    if (err) {
      done(err);
      process.exit(1);
    }
    done();
    process.exit(0);
  });
});

gulp.task("test-phantom", "Run browser unit tests in the console.", function (done) {
  karma.start({
    configFile: path.join(config.root, config.karmaConfig),
    browsers: ["PhantomJS"],
    singleRun: true
  }, function (err) {
    if (err) {
      done(err);
      process.exit(1);
    }
    done();
    process.exit(0);
  });
});

gulp.task("test-watch", "Run browser tests in console; run again on change.", function (done) {
  karma.start({
    configFile: path.join(config.root, config.karmaConfig),
    browsers: ["PhantomJS"],
    singleRun: false
  }, function (err) {
    if (err) {
      done(err);
      process.exit(1);
    }
    done();
    process.exit(0);
  });
});
