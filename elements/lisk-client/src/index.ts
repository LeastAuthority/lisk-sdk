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
import { Buffer as BrowserBuffer } from 'buffer';

export * as cryptography from '@liskhq/lisk-cryptography';
export * as passphrase from '@liskhq/lisk-passphrase';
export * as transactions from '@liskhq/lisk-transactions';
export * as utils from '@liskhq/lisk-utils';
export * as tree from '@liskhq/lisk-tree';
export * as validator from '@liskhq/lisk-validator';
export * as codec from '@liskhq/lisk-codec';

if (!global.Buffer) {
	global.Buffer = BrowserBuffer;
}

export const { Buffer } = global;
