/*
 * LiskHQ/lisk-commander
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
import * as cryptography from '@liskhq/lisk-cryptography';

interface EncryptMessageInputs {
	readonly message: string;
	readonly passphrase: string;
	readonly recipient: string;
}

export const encryptMessage = ({
	message,
	passphrase,
	recipient,
}: EncryptMessageInputs): cryptography.EncryptedMessageWithNonce =>
	cryptography.encryptMessageWithPassphrase(message, passphrase, Buffer.from(recipient, 'hex'));

interface DecryptMessageInputs {
	readonly cipher: string;
	readonly nonce: string;
	readonly passphrase: string;
	readonly senderPublicKey: string;
}

export const decryptMessage = ({
	cipher,
	nonce,
	passphrase,
	senderPublicKey,
}: DecryptMessageInputs): { message: string } => ({
	message: cryptography.decryptMessageWithPassphrase(
		cipher,
		nonce,
		passphrase,
		Buffer.from(senderPublicKey, 'hex'),
	),
});

interface EncryptPassphraseInputs {
	readonly passphrase: string;
	readonly password: string;
}

export const encryptPassphrase = ({
	passphrase,
	password,
}: EncryptPassphraseInputs): { encryptedPassphrase: string } => {
	const encryptedPassphraseObject = cryptography.encryptPassphraseWithPassword(
		passphrase,
		password,
	);
	const encryptedPassphrase = cryptography.stringifyEncryptedPassphrase(encryptedPassphraseObject);

	return { encryptedPassphrase };
};

interface DecryptPassphraseInput {
	readonly encryptedPassphrase: string;
	readonly password: string;
}

export const decryptPassphrase = ({
	encryptedPassphrase,
	password,
}: DecryptPassphraseInput): { passphrase: string } => {
	const encryptedPassphraseObject = cryptography.parseEncryptedPassphrase(encryptedPassphrase);
	const passphrase = cryptography.decryptPassphraseWithPassword(
		encryptedPassphraseObject,
		password,
	);

	return { passphrase };
};

export const { getKeys } = cryptography;

export const getAddressFromPublicKey = (publicKey: string): { readonly address: string } => ({
	address: cryptography.getAddressFromPublicKey(Buffer.from(publicKey, 'hex')).toString('hex'),
});

interface SignMessageInputs {
	readonly message: string;
	readonly passphrase: string;
}

export const signMessage = ({
	message,
	passphrase,
}: SignMessageInputs): cryptography.SignedMessageWithOnePassphrase =>
	cryptography.signMessageWithPassphrase(message, passphrase);

interface VerifyMessageInputs {
	readonly message: string;
	readonly publicKey: string;
	readonly signature: string;
}

export const verifyMessage = ({
	publicKey,
	signature,
	message,
}: VerifyMessageInputs): { verified: boolean } => ({
	verified: cryptography.verifyMessageWithPublicKey({
		publicKey: Buffer.from(publicKey, 'hex'),
		signature: Buffer.from(signature, 'hex'),
		message,
	}),
});
