/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

/**
 * 解析「请求的文件名」对应的真实下载地址。
 *
 * 两条路径：
 * 1. 命中 GitHub API（结果带内存缓存）时，先用 Assets 名称做精确匹配，
 *    这样即使文件名本身含有 `{version}` 这类字面量也能拿到正确的文件；
 * 2. API 不可用（限流、网络异常）时，退回轻量的 `releases/latest` 跳转探测，
 *    只做占位符替换后拼出下载地址 —— 与项目最初的实现一致。
 */

import {getLatestReleaseTag} from "../github.js";
import {getLatestRelease, GitHubApiError} from "./github-api.js";
import {buildPlaceholderValues, substitutePlaceholders} from "./placeholders.js";

export class ResolveError extends Error {
	/**
	 * @param {"not-found" | "rate-limited" | "upstream"} kind
	 * @param {string} message
	 */
	constructor(kind, message) {
		super(message);
		this.name = "ResolveError";
		this.kind = kind;
	}
}

/** 由发行标签拼出「下载某个文件」的地址。 */
function buildDownloadUrl(owner, repo, tag, filename) {
	return `https://github.com/${owner}/${repo}/releases/download/${tag}/${filename}`;
}

/**
 * @param {{owner: string, repo: string, filename: string, token?: string}} options
 * @returns {Promise<{url: string, tag: string, exact: boolean}>}
 * @throws {ResolveError}
 */
export async function resolveDownloadUrl({owner, repo, filename, token = ""}) {
	let release = null;
	try {
		release = await getLatestRelease({owner, repo, token});
	} catch (error) {
		if (error instanceof GitHubApiError && error.kind === "not-found") {
			throw new ResolveError("not-found", "仓库或正式发行版本不存在");
		}
		/* 其余情况（限流、Token 失效、网络异常）留给下面的轻量探测兜底。 */
	}

	if (release) {
		const exact = release.assets.find((asset) => asset.name === filename);
		if (exact) {
			return {url: exact.downloadUrl, tag: release.tag, exact: true};
		}

		const substituted = substitutePlaceholders(filename, buildPlaceholderValues(release.tag));
		return {url: buildDownloadUrl(owner, repo, release.tag, substituted), tag: release.tag, exact: false};
	}

	const tagInfo = await getLatestReleaseTag({owner, repo});
	if (!tagInfo) {
		throw new ResolveError("upstream", "无法获取该仓库的最新发行版本");
	}

	const substituted = substitutePlaceholders(filename, buildPlaceholderValues(tagInfo.tag));
	return {url: buildDownloadUrl(owner, repo, tagInfo.tag, substituted), tag: tagInfo.tag, exact: false};
}
