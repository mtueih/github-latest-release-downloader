/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */


export async function requestUrlParser(requestUrlString) {
	/* 构造 URL 对象。 */
	let requestUrl;

	try {
		requestUrl = new URL(requestUrlString);
	} catch {
		return null;
	}

	/* 提取路径各部分（路径段）。 */
	const pathSegments = requestUrl.pathname.split("/").filter(Boolean);

	if (pathSegments.length !== 3) {
		return null;
	}

	return {
		owner: pathSegments[0],
		repo: pathSegments[1],
		filename: pathSegments[2],
	};
}
