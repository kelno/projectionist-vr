const path = require("path");
const fs = require("fs");
const webpack = require("webpack");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const { parse: parseToml } = require("smol-toml");

const PROJECT_ROOT = __dirname;
const DIST_DIRECTORY = path.resolve(PROJECT_ROOT, "dist");

// config.toml (config.toml.example describes it), or nothing: a release is
// built without one, with the player's defaults.
function readConfig() {
  const configPath = path.resolve(PROJECT_ROOT, "config.toml");
  return fs.existsSync(configPath)
    ? parseToml(fs.readFileSync(configPath, "utf8"))
    : {};
}

function playerConfig(config) {
  const configuredZoom = Number(config.player?.default_sbs_zoom ?? 100);
  return {
    // A bad local setting should not prevent the player from loading. Zero is
    // useful for users who prefer to start with the screen at its base size.
    defaultSbsZoom:
      Number.isFinite(configuredZoom) && configuredZoom >= 0 && configuredZoom <= 180
        ? configuredZoom
        : 100,
  };
}

function urlPrefix(value, fallback) {
  const prefix = value || fallback;
  return `/${prefix.replace(/^\/+|\/+$/g, "")}`;
}

function siteUrlPrefix(value) {
  const prefix = urlPrefix(value, "/");
  return prefix === "/" ? "" : prefix;
}

function joinUrlPrefix(sitePrefix, routePrefix) {
  return `${sitePrefix}${urlPrefix(routePrefix, "/")}`;
}

module.exports = (env) => {
  const isDevelopment = env.development === true;
  const config = readConfig();
  const libraryConfig = config.library ?? {};
  const webConfig = config.web ?? {};
  const sitePrefix = siteUrlPrefix(webConfig.site_url_prefix);
  const assetPublicPath = sitePrefix ? `${sitePrefix}/` : "/";

  const indexConfig = {
    entry: {
      index: "./src/index.js",
    },
    mode: isDevelopment ? "development" : "production",
    // Production writes index.js.map without linking it from the bundle: it
    // turns the positions in reported errors (src/errorReport.mjs) back into
    // source lines, and browsers never load it.
    devtool: isDevelopment ? "source-map" : "hidden-source-map",
    output: {
      filename: "[name].js",
      path: DIST_DIRECTORY,
      // Production bundles find their assets relative to the loaded script, so
      // one release works at any site path, such as /vr-player/. The
      // development server serves them at the configured site path.
      publicPath: isDevelopment ? assetPublicPath : "auto",
      // Production releases are rebuilt from scratch. Development must retain
      // dist/files.json, which is generated independently from source code.
      clean: !isDevelopment,
    },
    module: {
      rules: [
        {
          test: /\.(png|svg|jpg|gif)$/,
          use: ["file-loader"],
        },
      ],
    },
    plugins: [
      // config.toml is local deployment configuration. Embed only browser-safe
      // player preferences; filesystem paths remain available to Webpack only.
      new webpack.DefinePlugin({
        __PLAYER_CONFIG__: JSON.stringify(playerConfig(config)),
        __PLAYER_VERSION__: JSON.stringify(require("./package.json").version),
      }),
      new HtmlWebpackPlugin({
        template: "./index.html",
        filename: "index.html",
        favicon: "./favicon.ico",
        inject: "body",
        scriptLoading: "defer",
      }),
    ],
  };

  if (isDevelopment) {
    const staticDirectories = [
      {
        // The development server uses the same self-contained release layout
        // as production. The catalogue generator writes dist/files.json.
        directory: DIST_DIRECTORY,
        publicPath: assetPublicPath,
        watch: false,
      },
    ];
    const addMediaMount = (directory, prefix) => {
      if (directory) {
        staticDirectories.push({
          directory: path.resolve(directory),
          publicPath: prefix,
          watch: false,
        });
      }
    };
    addMediaMount(
      libraryConfig.videos_path,
      joinUrlPrefix(sitePrefix, webConfig.videos_url_prefix || "/media"),
    );
    addMediaMount(
      libraryConfig.thumbnails_path,
      joinUrlPrefix(
        sitePrefix,
        webConfig.thumbnails_url_prefix || "/thumbnails",
      ),
    );

    indexConfig.devServer = {
      host: "0.0.0.0",
      port: 8040,
      server: "https",
      static: staticDirectories,
      devMiddleware: {
        // Static files (including files.json) are read from dist, so write the
        // Webpack output there as well as serving it from memory.
        writeToDisk: true,
        publicPath: assetPublicPath,
      },
    };

    if (sitePrefix) {
      indexConfig.devServer.setupMiddlewares = (middlewares, devServer) => {
        // The terminal prints the server origin, but the player is intentionally
        // hosted below site_url_prefix. Make opening that origin convenient.
        devServer.app.use((request, response, next) => {
          // Express considers /vr-player and /vr-player/ equivalent when
          // matching a route. Check the exact request path to avoid redirecting
          // the destination back to itself.
          if (request.path === "/" || request.path === sitePrefix) {
            response.redirect(302, assetPublicPath);
            return;
          }
          next();
        });
        return middlewares;
      };
    }
  }

  return [indexConfig];
};

// Export the small configuration pieces so their edge cases can be checked
// without creating a Webpack compiler.
module.exports.parseToml = parseToml;
module.exports.playerConfig = playerConfig;
