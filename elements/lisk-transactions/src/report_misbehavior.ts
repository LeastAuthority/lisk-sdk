/*
 * Copyright © 2019 Lisk Foundation
 *
 * See the LICENSE file at the top-level directory of this distribution
 * for licensing information.
 *
 * Unless otherwise agreed in a custom licensing agreement with the Lisk Foundation,
 * no part of this software, including this file, may be copied, modified,
 * propagated, or distributed except according to the terms contained in the
 * LICENSE file.
 *
 * Removal or modification of this copyright notice is prohibited.
 *
 */

import { hexToBuffer } from '@liskhq/lisk-cryptography';
import { isUInt64, isNumberString } from '@liskhq/lisk-validator';

import { ProofOfMisbehaviorTransaction } from './15_proof_of_misbehavior_transaction';
import { BlockHeader, BlockHeaderJSON, TransactionJSON } from './types';
import { createBaseTransaction, baseTransactionToJSON } from './utils';

export interface ReportMisbehaviorInputs {
	readonly fee: string;
	readonly nonce: string;
	readonly networkIdentifier: string;
	readonly senderPublicKey?: string;
	readonly passphrase?: string;
	readonly header1: BlockHeaderJSON;
	readonly header2: BlockHeaderJSON;
}

const validateInputs = ({
	networkIdentifier,
	fee,
	nonce,
	header1,
	header2,
}: ReportMisbehaviorInputs): void => {
	if (!isNumberString(nonce) || !isUInt64(BigInt(nonce))) {
		throw new Error('Nonce must be a valid number in string format.');
	}

	if (!isNumberString(fee) || !isUInt64(BigInt(fee))) {
		throw new Error('Fee must be a valid number in string format.');
	}

	if (hexToBuffer(networkIdentifier).length !== 32) {
		throw new Error('Invalid network identifier length');
	}

	// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
	if (!header1) {
		throw new Error('Header 1 is required for poof of misbehavior');
	}

	// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
	if (!header2) {
		throw new Error('Header 2 is required for poof of misbehavior');
	}
};

const convertHeader = (header: BlockHeaderJSON): BlockHeader => ({
	...header,
	id: hexToBuffer(header.id),
	reward: BigInt(header.reward),
	previousBlockID: header.previousBlockID
		? hexToBuffer(header.previousBlockID)
		: Buffer.from(''),
	signature: hexToBuffer(header.signature),
	generatorPublicKey: hexToBuffer(header.generatorPublicKey),
	transactionRoot: hexToBuffer(header.transactionRoot),
	asset: {
		...header.asset,
		seedReveal: hexToBuffer(header.asset.seedReveal),
	},
});

export const reportMisbehavior = (
	inputs: ReportMisbehaviorInputs,
): Partial<TransactionJSON> => {
	validateInputs(inputs);
	const { passphrase, header1, header2 } = inputs;
	const networkIdentifier = hexToBuffer(inputs.networkIdentifier);

	const transaction = {
		...createBaseTransaction(inputs),
		type: ProofOfMisbehaviorTransaction.TYPE,
		asset: {
			header1: convertHeader(header1),
			header2: convertHeader(header2),
		},
	} as ProofOfMisbehaviorTransaction;

	if (!passphrase) {
		return baseTransactionToJSON(transaction);
	}

	const pomTransaction = new ProofOfMisbehaviorTransaction(transaction);

	pomTransaction.sign(networkIdentifier, passphrase);

	const { errors } = pomTransaction.validate();
	if (errors.length > 0) {
		throw new Error(errors.toString());
	}

	return baseTransactionToJSON(pomTransaction);
};
