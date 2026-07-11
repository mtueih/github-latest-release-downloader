/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */


import {requestUrlParser} from "./routet.js";
import {getLatestReleaseTag} from "./github.js";


export default {
	async fetch(request, env, ctx) {
		const pathInfo = await requestUrlParser(request.url);
		if (!pathInfo) {
			return new Response("400 Bad Request", {status: 400});
		}

		const tagInfo = await getLatestReleaseTag(pathInfo);
		if (!tagInfo) {
			return new Response("500 Internal Server Error", {status: 500});
		}

		/* 定义网址中允许的占位符，以及其值。 */
		const UrlPlaceholders = new Map([
			["tag", `${tagInfo.tag}`],
			["version", `${tagInfo.tag.replaceAll(/^v/g, "")}`],
		]);

		/**
		 * 获取解码后的文件名。用来替换其中的占位符。
		 * 占位符使用花括号（‘{’、‘}’）包裹，花括号会被编码。
		 */
		let filename = decodeURIComponent(pathInfo.filename);
		for (const [k, v] of UrlPlaceholders) {
			filename = filename.replaceAll(`{${k}}`, v);
		}

		return Response.redirect(`${tagInfo.urlPrefix}/download/${tagInfo.tag}/${filename}`);
	},
};
