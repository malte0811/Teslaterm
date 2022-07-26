const path = require('path');

module.exports = {
	entry: './js/render/entry_browser.js',
	devtool: 'inline-source-map',
	output: {
		filename: 'bundle.js',
		path: path.resolve(__dirname, 'dist'),
	},
	module: {
		rules: [
			{ test: /\.css$/, use: 'css-loader' },
			{ test: /\.ts$/, use: 'ts-loader' },
			{ test: /\.tsx$/, use: 'ts-loader' },
		],
	},
	resolve: {
		extensions: ['.tsx', '.ts', '.js'],
	},
    performance: {
        // We do not care about this size; TT is never loaded over anything worse than a fast LAN connection
        maxEntrypointSize: 5120000,
        maxAssetSize: 5120000,
    }
};
