/*
 * LiskHQ/lisk-commander
 * Copyright © 2017–2018 Lisk Foundation
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
import Listr from 'listr';
import BaseCommand from '../../../base';
import { restartApplication } from '../../../utils/node/pm2';
import CacheCommand from './cache';
import DatabaseCommand from './database';

interface Args {
	readonly name: string;
}

export default class StartCommand extends BaseCommand {
	static args = [
		{
			name: 'name',
			description: 'Lisk installation directory name.',
			required: true,
		},
	];

	static description = 'Start Lisk';

	static examples = [
		'node:start mainnet_1.6',
	];

	async run(): Promise<void> {
		const { args} = this.parse(StartCommand);
		const { name } = args as Args;

		const tasks = new Listr([
			{
				title: 'Start Lisk Instance',
				task: () =>
					new Listr([
						{
							title: 'Cache',
							task: async () =>
								CacheCommand.run([name]),
						},
						{
							title: 'Database',
							task: async () =>
								DatabaseCommand.run([name]),
						},
						{
							title: 'Lisk',
							task: async () => {
								await restartApplication(name);
							},
						},
					]),
			},
		]);
		await tasks.run();
	}
}
