const webpack = require("@nativescript/webpack");
const packageJson = require("./package.json");

module.exports = (env) => {
	webpack.init(env);

	// Learn how to customize:
	// https://docs.nativescript.org/webpack
	const prodBaseUrl = "https://cctec.aspiware.com/v1";
	const devBaseUrl = "http://10.0.0.237:3000/v1";
	const isProduction = !!(env && env.production);
	const isDevRun = !!(env && (env.hmr || env.watch));
	const defaultBaseUrl = isProduction ? prodBaseUrl : (isDevRun ? devBaseUrl : prodBaseUrl);
	const apiBaseUrl =
		(env && env.apiUrl) ||
		process.env.API_BASE_URL ||
		defaultBaseUrl;

	webpack.chainWebpack((config) => {
		config.plugin("DefinePlugin").tap((args) => {
			args[0]["globalThis.AppVersion"] = JSON.stringify(packageJson.version);
			args[0]["globalThis.API_BASE_URL"] = JSON.stringify(apiBaseUrl);
			return args;
		});
	});

	return webpack.resolveConfig();
};
