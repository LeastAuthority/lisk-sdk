const Codec = require('../dist-node').Codec;
const assert = require('assert');

const schema = {
	$id: 'testSchema',
	type: 'object',
	properties: {
		b: { fieldNumber: 2, dataType: 'string' },
		a: { fieldNumber: 1, dataType: 'string' },
		d: { fieldNumber: 4, dataType: 'bytes' },
		e: { fieldNumber: 5, dataType: 'uint32' },
		c: {
			type: 'object',
			fieldNumber: 3,
			properties: {
				cc: { fieldNumber: 3, dataType: 'string' },
				ca: { fieldNumber: 1, dataType: 'string' },
				cb: {
					type: 'object',
					fieldNumber: 2,
					properties: {
						cbb: { fieldNumber: 2, dataType: 'string' },
						cba: { fieldNumber: 1, dataType: 'string' },
						cbc: {
							type: 'object',
							fieldNumber: 3,
							properties: {
								cbcb: { fieldNumber: 3, dataType: 'string' },
								cbca: { fieldNumber: 2, dataType: 'string' },
							},
						},
						cbd: { fieldNumber: 4, dataType: 'string' },
					},
				},
			},
		},
		f: {
			type: 'array',
			fieldNumber: 6,
			items: {
				properties: {
					fc: { fieldNumber: 3, dataType: 'string' },
					fa: { fieldNumber: 1, dataType: 'string' },
					fb: {
						type: 'object',
						fieldNumber: 2,
						properties: {
							fbb: { fieldNumber: 2, dataType: 'string' },
							fba: { fieldNumber: 1, dataType: 'string' },
							fbc: {
								type: 'object',
								fieldNumber: 3,
								properties: {
									fbcb: { fieldNumber: 3, dataType: 'string' },
									fbca: { fieldNumber: 2, dataType: 'string' },
								},
							},
							fbd: { fieldNumber: 4, dataType: 'string' },
						},
					},
				},
			},
		},
	},
};

// Single-property schemas, iterate through all schemas per input.

function fuzz(input) {
	let firstDecode;
	const codec = new Codec();
	try {
		firstDecode = codec.decode(schema, Buffer.from(input, 'utf8'));

		// NB: ignore expected errors.
	} catch (e) {
		if (
			e.message.indexOf('Invalid container type') !== -1 ||
			e.message.indexOf('Invalid buffer length') !== -1 ||
			e.message.indexOf('Value out of range of uint32') !== -1 ||
			e.message.indexOf('Value out of range of uint64') !== -1 ||
			e.message.indexOf('Terminating bit not found') !== -1 ||
			e.message.indexOf('Value yields unsupported wireType') !== -1
		) {
		} else {
			throw e;
		}
	}

	if (firstDecode === undefined) {
		return 0;
	}

	const firstEncode = codec.encode(schema, firstDecode);
	const secondDecode = codec.decode(schema, firstEncode);

	assert.deepEqual(firstDecode, secondDecode);

	return 1;
}

module.exports = {
	fuzz,
};
