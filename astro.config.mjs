/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import {defineConfig} from "astro/config";
import cloudflare from "@astrojs/cloudflare";

export default defineConfig({
	/* 默认静态生成：首页在构建期产出，动态页面单独声明 prerender = false。 */
	output: "static",
	/* 本项目不使用会话，关掉以免部署时额外要求创建 KV 命名空间。 */
	session: false,
	adapter: cloudflare({
		/* 本项目不使用 Astro 图片优化，关掉以免额外要求 Cloudflare Images 绑定。 */
		imageService: "passthrough",
	}),
	build: {
		format: "directory",
	},
});
