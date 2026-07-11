/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */


export async function getLatestReleaseTag(pathInfo) {
	const GitHubReleasesUrl = `https://github.com/${pathInfo.owner}/${pathInfo.repo}/releases`;
	const GitHubLatestReleaseUrl = `${GitHubReleasesUrl}/latest`;
	const GitHubTagReleaseUrlPrefix = `${GitHubReleasesUrl}/tag/`;

	/**
	 * 向 releases/latest 发起请求。不跟随重定向。
	 * 仅从响应头中的重定向目标网址中获取最新发行版本的标签。
	 */
	let response;
	try {
		response = await fetch(GitHubLatestReleaseUrl, {redirect: "manual"});
	} catch {
		return null;
	}
	/* releases/latest 的响应的状态码一般都是 302。 */
	if (response.status !== 302) {
		return null;
	}

	const location = response.headers.get("Location");
	if (!location.startsWith(GitHubTagReleaseUrlPrefix)) {
		return null;
	}

	const tag = location.slice(GitHubTagReleaseUrlPrefix.length);

	return {
		tag: tag,
		releasesUrl: GitHubReleasesUrl,
	};
}
