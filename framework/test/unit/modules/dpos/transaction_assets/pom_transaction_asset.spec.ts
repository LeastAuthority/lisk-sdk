/*
 * Copyright © 2020 Lisk Foundation
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
 */

import { when } from 'jest-when';
import { BlockHeader, Account } from '@liskhq/lisk-chain';
import { objects } from '@liskhq/lisk-utils';
import { getAddressAndPublicKeyFromPassphrase, getRandomBytes } from '@liskhq/lisk-cryptography';
import { ApplyAssetContext, ValidateAssetContext } from '../../../../../src';
import { createFakeDefaultAccount } from '../../../../utils/node';
import { StateStoreMock } from '../../../../utils/node/state_store_mock';
import {
	BlockHeaderAssetForDPOS,
	DPOSAccountProps,
	PomTransactionAssetContext,
} from '../../../../../src/modules/dpos';
import { PomTransactionAsset } from '../../../../../src/modules/dpos/transaction_assets/pom_transaction_asset';
import * as dposUtils from '../../../../../src/modules/dpos/utils';
import { createFakeBlockHeader } from '../../../../fixtures';
import { liskToBeddows } from '../../../../utils/assets';

describe('PomTransactionAsset', () => {
	const lastBlockHeight = 8760000;
	const lastBlockReward = liskToBeddows(69);
	let transactionAsset: PomTransactionAsset;
	let applyContext: ApplyAssetContext<PomTransactionAssetContext>;
	let validateContext: ValidateAssetContext<PomTransactionAssetContext>;
	let sender: any;
	let stateStoreMock: StateStoreMock;
	let misBehavingDelegate: Account<DPOSAccountProps>;
	let normalDelegate: Account<DPOSAccountProps>;
	let header1: BlockHeader<BlockHeaderAssetForDPOS>;
	let header2: BlockHeader<BlockHeaderAssetForDPOS>;

	beforeEach(() => {
		sender = createFakeDefaultAccount({});

		const {
			address: delegate1Address,
			publicKey: delegate1PublicKey,
		} = getAddressAndPublicKeyFromPassphrase(getRandomBytes(20).toString('utf8'));

		misBehavingDelegate = createFakeDefaultAccount({
			address: delegate1Address,
			dpos: { delegate: { username: 'misBehavingDelegate' } },
		});
		normalDelegate = createFakeDefaultAccount({
			dpos: { delegate: { username: 'normalDelegate' } },
		});

		header1 = createFakeBlockHeader({ generatorPublicKey: delegate1PublicKey });
		header2 = createFakeBlockHeader({ generatorPublicKey: delegate1PublicKey });

		stateStoreMock = new StateStoreMock(
			objects.cloneDeep([sender, misBehavingDelegate, normalDelegate]),
			{
				lastBlockHeaders: [{ height: lastBlockHeight }] as any,
				lastBlockReward,
			},
		);
		transactionAsset = new PomTransactionAsset();
		applyContext = ({
			transaction: {
				senderAddress: sender.address,
			},
			asset: {
				header1: {},
				header2: {},
			},
			stateStore: stateStoreMock as any,
			reducerHandler: {
				invoke: jest.fn(),
			},
		} as unknown) as ApplyAssetContext<PomTransactionAssetContext>;
		validateContext = ({ asset: { header1: {}, header2: {} } } as unknown) as ValidateAssetContext<
			PomTransactionAssetContext
		>;

		jest.spyOn(stateStoreMock.account, 'get');
		jest.spyOn(stateStoreMock.account, 'set');
	});

	describe('constructor', () => {
		it('should have valid id', () => {
			expect(transactionAsset.id).toEqual(3);
		});

		it('should have valid name', () => {
			expect(transactionAsset.name).toEqual('reportDelegateMisbehavior');
		});

		it('should have valid schema', () => {
			expect(transactionAsset.schema).toMatchSnapshot();
		});
	});

	describe('validate', () => {
		it('should throw error when generatorPublicKey does not match', () => {
			validateContext.asset = {
				header1: {
					...header1,
				},
				header2: { ...header2, generatorPublicKey: getRandomBytes(20) },
			};

			expect(() => transactionAsset.validate(validateContext)).toThrow(
				'GeneratorPublicKey of each BlockHeader should match.',
			);
		});

		it('should throw error when both headers are identical', () => {
			validateContext.asset = {
				header1: {
					...header1,
				},
				header2: { ...header1 },
			};

			expect(() => transactionAsset.validate(validateContext)).toThrow(
				'BlockHeaders are identical. No contradiction detected.',
			);
		});

		it('should not throw error when first height is equal to second height but equal maxHeightPrevoted', () => {
			validateContext.asset = {
				header1: {
					...header1,
					height: 10999,
					asset: { ...header1.asset, maxHeightPrevoted: 1099 },
				},
				header2: { ...header2, height: 10999 },
			};

			expect(() => transactionAsset.validate(validateContext)).not.toThrow();
		});

		it('should not throw error when first height is greater than the second height but equal maxHeightPrevoted', () => {
			validateContext.asset = {
				header1: {
					...header1,
					height: 10999,
					asset: { ...header1.asset, maxHeightPrevoted: 1099 },
				},
				header2: { ...header2, height: 11999 },
			};

			expect(() => transactionAsset.validate(validateContext)).not.toThrow();
		});

		it("should not throw error when height is greater than the second header's maxHeightPreviouslyForged", () => {
			validateContext.asset = {
				header1: {
					...header1,
					height: 120,
				},
				header2: {
					...header2,
					height: 123,
					asset: { ...header1.asset, maxHeightPreviouslyForged: 98 },
				},
			};

			expect(() => transactionAsset.validate(validateContext)).not.toThrow();
		});

		it('should not throw error when maxHeightPrevoted is greater than the second maxHeightPrevoted', () => {
			validateContext.asset = {
				header1: {
					...header1,
					height: 133,
					asset: { ...header1.asset, maxHeightPrevoted: 101 },
				},
				header2: { ...header2, height: 123, asset: { ...header1.asset, maxHeightPrevoted: 98 } },
			};

			expect(() => transactionAsset.validate(validateContext)).not.toThrow();
		});

		it('should throw error when headers are not contradicting', () => {
			validateContext.asset = {
				header1: {
					...header1,
				},
				header2: { ...header1 },
			};

			expect(() => transactionAsset.validate(validateContext)).toThrow(
				'BlockHeaders are identical. No contradiction detected.',
			);
		});
	});

	describe('apply', () => {
		const block1Height = lastBlockHeight - 768;
		const block2Height = block1Height + 15;

		beforeEach(() => {
			jest.spyOn(dposUtils, 'validateSignature').mockReturnValue(true);

			applyContext.asset = {
				header1: { ...header1, height: block1Height },
				header2: { ...header2, height: block2Height },
			};
		});

		afterEach(() => {
			(dposUtils.validateSignature as any).mockClear();
		});

		it('should not throw error with valid transactions', async () => {
			await expect(transactionAsset.apply(applyContext)).resolves.toBeUndefined();
		});

		it('should throw error if |header1.height - h| >= 260000', async () => {
			applyContext.asset = {
				...applyContext.asset,
				header1: {
					...applyContext.asset.header1,
					height: lastBlockHeight - 260000,
				},
			};

			await expect(transactionAsset.apply(applyContext)).rejects.toThrow(
				'Difference between header1.height and current height must be less than 260000.',
			);
		});

		it('should throw error if |header2.height - h| >= 260000', async () => {
			applyContext.asset = {
				...applyContext.asset,
				header2: {
					...applyContext.asset.header2,
					height: lastBlockHeight - 260000,
				},
			};

			await expect(transactionAsset.apply(applyContext)).rejects.toThrow(
				'Difference between header2.height and current height must be less than 260000.',
			);
		});

		it('should throw error when header1 is not properly signed', async () => {
			when(dposUtils.validateSignature as any)
				.calledWith(
					applyContext.asset.header1.generatorPublicKey,
					applyContext.asset.header1.signature,
					expect.any(Buffer),
				)
				.mockReturnValue(false);
			when(dposUtils.validateSignature as any)
				.calledWith(
					applyContext.asset.header2.generatorPublicKey,
					applyContext.asset.header2.signature,
					expect.any(Buffer),
				)
				.mockReturnValue(true);

			await expect(transactionAsset.apply(applyContext)).rejects.toThrow(
				'Invalid block signature for header 1',
			);
		});

		it('should throw error when header2 is not properly signed', async () => {
			when(dposUtils.validateSignature as any)
				.calledWith(
					applyContext.asset.header1.generatorPublicKey,
					applyContext.asset.header1.signature,
					expect.any(Buffer),
				)
				.mockReturnValue(true);
			when(dposUtils.validateSignature as any)
				.calledWith(
					applyContext.asset.header2.generatorPublicKey,
					applyContext.asset.header2.signature,
					expect.any(Buffer),
				)
				.mockReturnValue(false);

			await expect(transactionAsset.apply(applyContext)).rejects.toThrow(
				'Invalid block signature for header 2',
			);
		});

		it('should throw error if misbehaving account is not a delegate', async () => {
			const updatedDelegateAccount = objects.cloneDeep(misBehavingDelegate);
			updatedDelegateAccount.dpos.delegate.username = '';
			stateStoreMock.account.set(misBehavingDelegate.address, updatedDelegateAccount);

			await expect(transactionAsset.apply(applyContext)).rejects.toThrow(
				'Account is not a delegate',
			);
		});

		it('should throw error if misbehaving account is already banned', async () => {
			const updatedDelegateAccount = objects.cloneDeep(misBehavingDelegate);
			updatedDelegateAccount.dpos.delegate.isBanned = true;
			stateStoreMock.account.set(misBehavingDelegate.address, updatedDelegateAccount);

			await expect(transactionAsset.apply(applyContext)).rejects.toThrow(
				'Cannot apply proof-of-misbehavior. Delegate is already banned.',
			);
		});

		it('should throw error if misbehaving account is already punished at height h', async () => {
			const updatedDelegateAccount = objects.cloneDeep(misBehavingDelegate);
			updatedDelegateAccount.dpos.delegate.pomHeights = [applyContext.asset.header1.height + 10];
			stateStoreMock.account.set(misBehavingDelegate.address, updatedDelegateAccount);

			await expect(transactionAsset.apply(applyContext)).rejects.toThrow(
				'Cannot apply proof-of-misbehavior. Delegate is already punished.',
			);
		});

		it('should reward the sender with last block reward if delegate have enough balance', async () => {
			const remainingBalance = lastBlockReward + BigInt('10000000000');
			const minRemainingBalance = BigInt('5000000');

			when(applyContext.reducerHandler.invoke as any)
				.calledWith('token:getBalance', { address: misBehavingDelegate.address })
				.mockResolvedValue(remainingBalance as never);
			when(applyContext.reducerHandler.invoke as any)
				.calledWith('token:getMinRemainingBalance')
				.mockResolvedValue(minRemainingBalance as never);

			await transactionAsset.apply(applyContext);

			expect(applyContext.reducerHandler.invoke).toHaveBeenCalledWith('token:credit', {
				address: applyContext.transaction.senderAddress,
				amount: lastBlockReward,
			});
		});

		it('should not reward the sender if delegate does not have enough minimum remaining balance', async () => {
			const remainingBalance = BigInt(100);
			const minRemainingBalance = BigInt('5000000');

			when(applyContext.reducerHandler.invoke as any)
				.calledWith('token:getBalance', { address: misBehavingDelegate.address })
				.mockResolvedValue(remainingBalance as never);
			when(applyContext.reducerHandler.invoke as any)
				.calledWith('token:getMinRemainingBalance')
				.mockResolvedValue(minRemainingBalance as never);

			await transactionAsset.apply(applyContext);

			expect(applyContext.reducerHandler.invoke).toHaveBeenCalledWith('token:credit', {
				address: applyContext.transaction.senderAddress,
				amount: BigInt(0),
			});
		});

		it('should add (remaining balance - min remaining balance) of delegate to balance of the sender if delegate balance is less than last block reward', async () => {
			const remainingBalance = lastBlockReward - BigInt(1);
			const minRemainingBalance = BigInt('5000000');

			when(applyContext.reducerHandler.invoke as any)
				.calledWith('token:getBalance', { address: misBehavingDelegate.address })
				.mockResolvedValue(remainingBalance as never);
			when(applyContext.reducerHandler.invoke as any)
				.calledWith('token:getMinRemainingBalance')
				.mockResolvedValue(minRemainingBalance as never);

			await transactionAsset.apply(applyContext);

			expect(applyContext.reducerHandler.invoke).toHaveBeenCalledWith('token:credit', {
				address: applyContext.transaction.senderAddress,
				amount: remainingBalance - minRemainingBalance,
			});
		});

		it('should append height h to pomHeights property of misbehaving account', async () => {
			await transactionAsset.apply(applyContext);

			const updatedDelegate = await stateStoreMock.account.get<Account<DPOSAccountProps>>(
				misBehavingDelegate.address,
			);

			expect(updatedDelegate.dpos.delegate.pomHeights).toEqual([lastBlockHeight + 1]);
		});

		it('should set isBanned property to true is pomHeights.length === 5', async () => {
			const pomHeights = [500, 1000, 2000, 4550];
			const updatedDelegateAccount = objects.cloneDeep(misBehavingDelegate);
			updatedDelegateAccount.dpos.delegate.pomHeights = objects.cloneDeep(pomHeights);
			updatedDelegateAccount.dpos.delegate.isBanned = false;
			stateStoreMock.account.set(misBehavingDelegate.address, updatedDelegateAccount);

			await transactionAsset.apply(applyContext);

			const updatedDelegate = await stateStoreMock.account.get<Account<DPOSAccountProps>>(
				misBehavingDelegate.address,
			);

			expect(updatedDelegate.dpos.delegate.pomHeights).toEqual([
				...pomHeights,
				lastBlockHeight + 1,
			]);
			expect(updatedDelegate.dpos.delegate.pomHeights).toHaveLength(5);
			expect(updatedDelegate.dpos.delegate.isBanned).toBeTrue();
		});

		it('should not return balance if sender and delegate account are same', async () => {
			(applyContext.transaction as any).senderAddress = misBehavingDelegate.address;

			await expect(transactionAsset.apply(applyContext)).resolves.toBeUndefined();
		});
	});
});
