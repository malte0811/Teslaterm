const path = require('path');

module.exports = {
	entry: './js/render/entry_browser.js',
	devtool: 'inline-source-map',
	resolve: {
		extensions: ['.js'],
	},
	output: {
		filename: 'bundle.js',
		path: path.resolve(__dirname, 'dist'),
	},
    performance: {
        // We do not care about this size; TT is never loaded over anything worse than a fast LAN connection
        maxEntrypointSize: 5120000,
        maxAssetSize: 5120000,
    }
};
