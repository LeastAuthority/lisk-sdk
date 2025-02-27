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
 */

import * as path from 'path';
import * as assert from 'assert';
import * as childProcess from 'child_process';
import { ChildProcess } from 'child_process';
import { systemDirs } from '../system_dirs';
import { InMemoryChannel } from './channels/in_memory_channel';
import { Bus } from './bus';
import { Logger } from '../logger';
import { SocketPaths, PluginsOptions, PluginOptions } from '../types';

import { BasePlugin, InstantiablePlugin } from '../plugins/base_plugin';
import { EventInfoObject } from './event';
import { BaseChannel } from './channels';

export interface ControllerOptions {
	readonly appLabel: string;
	readonly config: {
		readonly rootPath: string;
		readonly ipc: {
			readonly enabled: boolean;
		};
	};
	readonly logger: Logger;
	readonly channel: InMemoryChannel;
}

interface ControllerConfig {
	readonly dataPath: string;
	readonly socketsPath: SocketPaths;
	readonly dirs: {
		readonly dataPath: string;
		readonly data: string;
		readonly tmp: string;
		readonly logs: string;
		readonly sockets: string;
		readonly pids: string;
	};
	readonly ipc: {
		readonly enabled: boolean;
	};
}

interface PluginsObject {
	readonly [key: string]: InstantiablePlugin<BasePlugin>;
}

export const validatePluginSpec = (pluginSpec: Partial<BasePlugin>): void => {
	assert((pluginSpec.constructor as typeof BasePlugin).alias, 'Plugin alias is required.');
	assert((pluginSpec.constructor as typeof BasePlugin).info.name, 'Plugin name is required.');
	assert((pluginSpec.constructor as typeof BasePlugin).info.author, 'Plugin author is required.');
	assert((pluginSpec.constructor as typeof BasePlugin).info.version, 'Plugin version is required.');
	assert(pluginSpec.defaults, 'Plugin default options are required.');
	assert(pluginSpec.events, 'Plugin events are required.');
	assert(pluginSpec.actions, 'Plugin actions are required.');
	assert(pluginSpec.load, 'Plugin load action is required.');
	assert(pluginSpec.unload, 'Plugin unload actions is required.');
};

export class Controller {
	public readonly logger: Logger;
	public readonly appLabel: string;
	public readonly channel: InMemoryChannel;
	public readonly config: ControllerConfig;
	public bus!: Bus;

	private readonly _childProcesses: Record<string, ChildProcess>;
	private readonly _inMemoryPlugins: Record<string, { plugin: BasePlugin; channel: BaseChannel }>;

	public constructor(options: ControllerOptions) {
		this.logger = options.logger;
		this.appLabel = options.appLabel;
		this.channel = options.channel;
		this.logger.info('Initializing controller');

		const dirs = systemDirs(this.appLabel, options.config.rootPath);
		this.config = {
			dataPath: dirs.dataPath,
			ipc: {
				enabled: options.config.ipc.enabled,
			},
			dirs: {
				...dirs,
			},
			socketsPath: {
				root: `unix://${dirs.sockets}`,
				pub: `unix://${dirs.sockets}/lisk_pub.sock`,
				sub: `unix://${dirs.sockets}/lisk_sub.sock`,
				rpc: `unix://${dirs.sockets}/lisk_rpc.sock`,
			},
		};

		this._inMemoryPlugins = {};
		this._childProcesses = {};
	}

	public async load(): Promise<void> {
		this.logger.info('Loading controller');
		await this._setupBus();
	}

	public async loadPlugins(plugins: PluginsObject, pluginOptions: PluginsOptions): Promise<void> {
		if (!this.bus) {
			throw new Error('Controller bus is not initialized. Plugins can not be loaded.');
		}

		for (const alias of Object.keys(plugins)) {
			const klass = plugins[alias];
			const options = { dataPath: this.config.dataPath, ...pluginOptions[alias] };

			if (options.loadAsChildProcess) {
				if (this.config.ipc.enabled) {
					await this._loadChildProcessPlugin(alias, klass, options);
				} else {
					this.logger.warn(`IPC is disabled. ${alias} will be loaded in-memory.`);
					await this._loadInMemoryPlugin(alias, klass, options);
				}
			} else {
				await this._loadInMemoryPlugin(alias, klass, options);
			}
		}
	}

	public async unloadPlugins(plugins: string[] = []): Promise<void> {
		const pluginsToUnload =
			plugins.length > 0
				? plugins
				: [...Object.keys(this._inMemoryPlugins), ...Object.keys(this._childProcesses)];

		const errors = [];

		for (const alias of pluginsToUnload) {
			try {
				// Unload in-memory plugins
				if (this._inMemoryPlugins[alias]) {
					await this._unloadInMemoryPlugin(alias);

					// Unload child process plugins
				} else if (this._childProcesses[alias]) {
					await this._unloadChildProcessPlugin(alias);
				} else {
					throw new Error(`Unknown plugin "${alias}" was asked to unload.`);
				}
			} catch (error) {
				this.logger.error(error);
				errors.push(error);
			}
		}

		if (errors.length) {
			throw new Error('Unload Plugins failed');
		}
	}

	public async cleanup(_code?: number, reason?: string): Promise<void> {
		this.logger.info('Controller cleanup started');

		if (reason) {
			this.logger.debug(`Reason: ${reason}`);
		}

		try {
			this.logger.debug('Plugins cleanup started');
			await this.unloadPlugins();
			this.logger.debug('Plugins cleanup completed');

			this.logger.debug('Bus cleanup started');
			await this.bus.cleanup();
			this.logger.debug('Bus cleanup completed');

			this.logger.info('Controller cleanup completed');
		} catch (err) {
			this.logger.error(err, 'Controller cleanup failed');
		}
	}

	private async _setupBus(): Promise<void> {
		this.bus = new Bus(this.logger, this.config);

		await this.bus.setup();

		await this.channel.registerToBus(this.bus);

		// If log level is greater than info
		if (this.logger.level !== undefined && this.logger.level() < 30) {
			this.bus.subscribe('*', (event: EventInfoObject) => {
				this.logger.trace(`eventName: ${event.name},`, 'Monitor Bus Channel');
			});
		}
	}

	private async _loadInMemoryPlugin(
		alias: string,
		Klass: InstantiablePlugin<BasePlugin>,
		options: PluginOptions,
	): Promise<void> {
		const pluginAlias = alias || Klass.alias;
		const { name, version } = Klass.info;

		const plugin: BasePlugin = new Klass(options);
		validatePluginSpec(plugin);

		this.logger.info({ name, version, alias: pluginAlias }, 'Loading in-memory plugin');

		const channel = new InMemoryChannel(pluginAlias, plugin.events, plugin.actions);

		await channel.registerToBus(this.bus);

		channel.publish(`${pluginAlias}:registeredToBus`);
		channel.publish(`${pluginAlias}:loading:started`);

		await plugin.init(channel);
		await plugin.load(channel);

		channel.publish(`${pluginAlias}:loading:finished`);

		this._inMemoryPlugins[pluginAlias] = { plugin, channel };

		this.logger.info({ name, version, alias: pluginAlias }, 'Loaded in-memory plugin');
	}

	private async _loadChildProcessPlugin(
		alias: string,
		Klass: InstantiablePlugin<BasePlugin>,
		options: PluginOptions,
	): Promise<void> {
		const pluginAlias = alias || Klass.alias;
		const { name, version } = Klass.info;

		const plugin: BasePlugin = new Klass(options);
		validatePluginSpec(plugin);

		this.logger.info({ name, version, alias: pluginAlias }, 'Loading child-process plugin');

		const program = path.resolve(__dirname, 'child_process_loader.js');

		const parameters = [Klass.info.name, Klass.name];

		// Avoid child processes and the main process sharing the same debugging ports causing a conflict
		const forkedProcessOptions: { execArgv: string[] | undefined } = {
			execArgv: undefined,
		};
		const maxPort = 20000;
		const minPort = 10000;
		if (process.env.NODE_DEBUG) {
			forkedProcessOptions.execArgv = [
				`--inspect=${Math.floor(Math.random() * (maxPort - minPort) + minPort)}`,
			];
		}

		const child = childProcess.fork(program, parameters, forkedProcessOptions);

		child.send({
			action: 'load',
			config: this.config,
			options,
		});

		this._childProcesses[pluginAlias] = child;

		child.on('exit', (code, signal) => {
			// If child process exited with error
			if (code !== null && code !== undefined && code !== 0) {
				this.logger.error(
					{ name, version, pluginAlias, code, signal: signal ?? '' },
					'Child process plugin exited',
				);
			}
		});

		child.on('error', error => {
			this.logger.error(error, `Child process for "${pluginAlias}" faced error.`);
		});

		await Promise.race([
			new Promise(resolve => {
				this.channel.once(`${pluginAlias}:loading:finished`, () => {
					this.logger.info({ name, version, alias: pluginAlias }, 'Loaded child-process plugin');
					resolve();
				});
			}),
			new Promise((_, reject) => {
				setTimeout(() => {
					reject(new Error('Child process plugin loading timeout'));
				}, 2000);
			}),
		]);
	}

	private async _unloadInMemoryPlugin(alias: string): Promise<void> {
		this._inMemoryPlugins[alias].channel.publish(`${alias}:unloading:started`);
		try {
			await this._inMemoryPlugins[alias].plugin.unload();
			this._inMemoryPlugins[alias].channel.publish(`${alias}:unloading:finished`);
		} catch (error) {
			this._inMemoryPlugins[alias].channel.publish(`${alias}:unloading:error`, error);
		} finally {
			delete this._inMemoryPlugins[alias];
		}
	}

	private async _unloadChildProcessPlugin(alias: string): Promise<void> {
		if (!this._childProcesses[alias].connected) {
			this._childProcesses[alias].kill('SIGTERM');
			delete this._childProcesses[alias];
			throw new Error('Child process is not connected any more.');
		}

		this._childProcesses[alias].send({
			action: 'unload',
		});

		await Promise.race([
			new Promise(resolve => {
				this.channel.once(`${alias}:unloading:finished`, () => {
					this.logger.info(`Child process plugin "${alias}" unloaded`);
					delete this._childProcesses[alias];
					resolve();
				});
			}),
			new Promise((_, reject) => {
				this.channel.once(`${alias}:unloading:error`, event => {
					this.logger.info(`Child process plugin "${alias}" unloaded with error`);
					this.logger.error(event.data || {}, 'Unloading plugin error.');
					delete this._childProcesses[alias];
					reject(event.data);
				});
			}),
			new Promise((_, reject) => {
				setTimeout(() => {
					this._childProcesses[alias].kill('SIGTERM');
					delete this._childProcesses[alias];
					reject(new Error('Child process plugin unload timeout'));
				}, 2000);
			}),
		]);
	}
}
