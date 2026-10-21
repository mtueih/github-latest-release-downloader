/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

/**
 * 人机验证通行 Cookie。
 * 通过一次 Turnstile 校验后签发一个带 HMAC 签名的 Cookie，
 * 在其有效期内的后续访问不再重复消耗 Turnstile 校验与 GitHub API 限额。
 */

export const PASS_COOKIE_NAME = "glrd_pass";
/** 通行有效期：2 小时。 */
export const PASS_TTL_SECONDS = 2 * 60 * 60;

const encoder = new TextEncoder();

function toBase64Url(bytes) {
	let binary = "";
	for (const byte of bytes) {
		binary += String.fromCharCode(byte);
	}
	return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

async function importKey(secret) {
	return crypto.subtle.importKey("raw", encoder.encode(secret), {name: "HMAC", hash: "SHA-256"}, false, [
		"sign",
	]);
}

async function sign(secret, payload) {
	const key = await importKey(secret);
	const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
	return toBase64Url(new Uint8Array(signature));
}

/** 生成一个带签名与过期时间的通行令牌。 */
export async function createPassToken(secret, ttlSeconds = PASS_TTL_SECONDS) {
	const expiresAt = Date.now() + ttlSeconds * 1000;
	const payload = String(expiresAt);
	const signature = await sign(secret, payload);
	return `${payload}.${signature}`;
}

/**
 * 校验通行令牌。
 * 签名不匹配、格式错误、或已过期都视为无效。
 */
export async function verifyPassToken(secret, token) {
	if (!secret || typeof token !== "string") {
		return false;
	}

	const separatorIndex = token.indexOf(".");
	if (separatorIndex <= 0) {
		return false;
	}

	const payload = token.slice(0, separatorIndex);
	const signature = token.slice(separatorIndex + 1);
	const expiresAt = Number(payload);
	if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
		return false;
	}

	const expected = await sign(secret, payload);
	if (expected.length !== signature.length) {
		return false;
	}

	/* 逐字符比较，避免因提前返回而泄露信息。 */
	let mismatch = 0;
	for (let index = 0; index < expected.length; index += 1) {
		mismatch |= expected.charCodeAt(index) ^ signature.charCodeAt(index);
	}
	return mismatch === 0;
}
