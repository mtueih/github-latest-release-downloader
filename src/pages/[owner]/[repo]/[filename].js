/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

/**
 * `/owner/repo/<filename>` 的重定向端点，保留项目最初的行为：
 * 把请求的文件名重定向到该仓库最新发行版本中的同名文件。
 *
 * 文件名中出现的占位符会被替换为当前发行版本的真实取值。
 */

import {getConfig} from "../../../lib/config.js";
import {isValidOwnerRepo} from "../../../lib/github-api.js";
import {resolveDownloadUrl, ResolveError} from "../../../lib/resolve.js";

export const prerender = false;

export async function GET({params, redirect, url}) {
	const {owner, repo, filename} = params;

	if (!owner || !repo || !filename || !isValidOwnerRepo(owner, repo)) {
		return new Response("400 Bad Request", {status: 400, headers: {"Cache-Control": "no-store"}});
	}

	const config = getConfig();

	let resolved;
	try {
		resolved = await resolveDownloadUrl({owner, repo, filename, token: config.githubToken});
	} catch (error) {
		if (error instanceof ResolveError) {
			const status = error.kind === "not-found" ? 404 : 502;
			return new Response(error.message, {status, headers: {"Cache-Control": "no-store"}});
		}
		return new Response("502 Bad Gateway", {status: 502, headers: {"Cache-Control": "no-store"}});
	}

	const response = redirect(resolved.url, 302);
	/* 重定向结果只与当前发行版本有关，让浏览器短暂缓存，减少重复解析。 */
	response.headers.set("Cache-Control", "public, max-age=300");
	response.headers.set("Referrer-Policy", "no-referrer");
	return response;
}
