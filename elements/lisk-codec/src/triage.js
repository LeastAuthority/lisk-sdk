fuzz = require('./codec_fuzz').fuzz;

input = Buffer.from('d0800630000000800630f38e667b69177fa4', 'hex').toString('utf8');
try {
	fuzz(input);
} catch (e) {
	console.error(e);
}
