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
import { APIClient } from '../../src/api_client';
import { APIResource } from '../../src/api_resource';
import { AccountsResource } from '../../src/resources/accounts';

describe('AccountsResource', () => {
	const defaultBasePath = 'http://localhost:1234';
	const path = '/accounts';

	let apiClient: APIClient;
	let resource: APIResource;

	beforeEach(async () => {
		apiClient = new APIClient([defaultBasePath]);
		resource = new AccountsResource(apiClient);
		return Promise.resolve();
	});

	describe('#constructor', () => {
		it('should be instance of APIResource', () => {
			return expect(resource).toBeInstanceOf(APIResource);
		});

		it('should have correct full path', () => {
			return expect(resource.resourcePath).toEqual(`${defaultBasePath}/api${path}`);
		});

		it('should set resource path', () => {
			return expect(resource.path).toBe(path);
		});

		it('should have a "get" function', () => {
			return expect((resource as any).get).toBeFunction();
		});
	});
});
