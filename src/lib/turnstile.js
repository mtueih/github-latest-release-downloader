/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

/** Cloudflare Turnstile 服务端校验。 */

const SITEVERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

/**
 * 校验 Turnstile 令牌。
 * 令牌 5 分钟后过期，且只能被校验一次，因此不做任何本地缓存。
 *
 * @param {{secret: string, token: string, remoteIp?: string}} options
 * @returns {Promise<{success: boolean, errorCodes: string[]}>}
 */
export async function verifyTurnstile({secret, token, remoteIp = ""}) {
	if (!secret || !token) {
		return {success: false, errorCodes: ["missing-input"]};
	}

	const body = new FormData();
	body.append("secret", secret);
	body.append("response", token);
	if (remoteIp) {
		body.append("remoteip", remoteIp);
	}

	let response;
	try {
		response = await fetch(SITEVERIFY_URL, {method: "POST", body});
	} catch {
		return {success: false, errorCodes: ["internal-error"]};
	}

	if (!response.ok) {
		return {success: false, errorCodes: [`http-${response.status}`]};
	}

	let payload;
	try {
		payload = await response.json();
	} catch {
		return {success: false, errorCodes: ["bad-response"]};
	}

	return {
		success: payload.success === true,
		errorCodes: Array.isArray(payload["error-codes"]) ? payload["error-codes"].map(String) : [],
	};
}

/** 把 Turnstile 的错误码翻译成给用户看的说明。 */
export function describeTurnstileError(errorCodes) {
	const codes = Array.isArray(errorCodes) ? errorCodes : [];
	if (codes.includes("timeout-or-duplicate")) {
		return "验证已过期或已被使用，请重新完成人机验证。";
	}
	if (codes.some((code) => code.startsWith("invalid-input"))) {
		return "人机验证参数无效，请刷新页面后重试。";
	}
	if (codes.includes("internal-error") || codes.includes("bad-response")) {
		return "人机验证服务暂时不可用，请稍后重试。";
	}
	return "人机验证未通过，请重试。";
}
