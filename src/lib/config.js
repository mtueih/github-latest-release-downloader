/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

/**
 * 从 Cloudflare 运行时环境变量中读取配置。
 * 在 Astro 页面与端点中统一通过这里取，避免各处重复兜底逻辑。
 */

import {env} from "cloudflare:workers";

function read(name) {
	const value = env?.[name];
	return typeof value === "string" ? value.trim() : "";
}

export function getConfig() {
	const turnstileSecret = read("TURNSTILE_SECRET_KEY");
	return {
		turnstileSiteKey: read("TURNSTILE_SITE_KEY"),
		turnstileSecret,
		/** 通行 Cookie 的签名密钥，未单独配置时回退到 Turnstile 密钥。 */
		passCookieSecret: read("PASS_COOKIE_SECRET") || turnstileSecret,
		githubToken: read("GITHUB_TOKEN"),
	};
}

/**
 * 是否启用人机验证门禁。
 * 只有在站点密钥与服务端密钥都已配置时才启用；否则页面直出，
 * 以便本地开发与首次部署时不必先配置 Turnstile。
 */
export function isTurnstileEnabled(config = getConfig()) {
	return Boolean(config.turnstileSiteKey && config.turnstileSecret);
}
