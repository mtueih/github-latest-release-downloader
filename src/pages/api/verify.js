/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

/**
 * 校验 Turnstile 令牌并签发通行 Cookie。
 *
 * 采用普通表单提交 + 重定向的方式工作，因此即使浏览器禁用脚本也能走完流程：
 * 校验成功后带着 Cookie 回到 `next` 指向的页面，该页面随即直接渲染资源列表。
 */

import {getConfig, isTurnstileEnabled} from "../../lib/config.js";
import {verifyTurnstile, describeTurnstileError} from "../../lib/turnstile.js";
import {createPassToken, PASS_COOKIE_NAME, PASS_TTL_SECONDS} from "../../lib/pass-cookie.js";

export const prerender = false;

/** 只允许站内相对路径，避免被用作开放重定向。 */
function safeNext(rawNext) {
	const value = String(rawNext ?? "");
	if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) {
		return "/";
	}
	return value;
}

/** 把 `next` 与失败原因拼回一个可展示的地址。 */
function withQuery(next, key, value) {
	const separator = next.includes("?") ? "&" : "?";
	return `${next}${separator}${key}=${encodeURIComponent(value)}`;
}

export async function POST({request, cookies, clientAddress, redirect}) {
	const config = getConfig();

	let formData;
	try {
		formData = await request.formData();
	} catch {
		return new Response("400 Bad Request", {status: 400});
	}

	const next = safeNext(formData.get("next"));

	/* 未配置 Turnstile 时不做拦截，直接回到目标页面。 */
	if (!isTurnstileEnabled(config)) {
		return redirect(next, 302);
	}

	const token = String(formData.get("cf-turnstile-response") ?? "");
	if (!token) {
		return redirect(withQuery(next, "verify", "missing"), 302);
	}

	const result = await verifyTurnstile({
		secret: config.turnstileSecret,
		token,
		remoteIp: clientAddress ?? "",
	});

	if (!result.success) {
		return redirect(withQuery(next, "verify", describeTurnstileError(result.errorCodes)), 302);
	}

	const passToken = await createPassToken(config.passCookieSecret, PASS_TTL_SECONDS);
	cookies.set(PASS_COOKIE_NAME, passToken, {
		path: "/",
		maxAge: PASS_TTL_SECONDS,
		httpOnly: true,
		sameSite: "lax",
		secure: new URL(request.url).protocol === "https:",
	});

	return redirect(next, 302);
}
