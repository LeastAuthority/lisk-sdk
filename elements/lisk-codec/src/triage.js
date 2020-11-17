fuzzEncoding = require('./codec_fuzz').fuzzEncoding;

input = '80000000008000e348328000000000804800';
try {
	fuzzEncoding(input, 'hex');
} catch (e) {
	console.error(e);
}
