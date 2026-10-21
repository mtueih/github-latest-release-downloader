/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

/**
 * 网址中允许的占位符名称。
 * 占位符使用花括号包裹，例如 `{version}`；花括号在网址中会被编码为 `%7B`/`%7D`。
 */
export const PLACEHOLDERS = ["tag", "version"];

const PLACEHOLDER_PATTERN = new RegExp(`\\{(${PLACEHOLDERS.join("|")})\\}`, "g");

/**
 * 由发行标签推导出各占位符的取值。
 * `version` 取标签中第一段由数字与点号组成的子串（如 `v1.2.3` → `1.2.3`）；
 * 若标签中没有这样的子串，则退化为标签本身。
 */
export function buildPlaceholderValues(tag) {
	const text = String(tag ?? "");
	const match = text.match(/[\d.]+/);
	return {
		tag: text,
		version: match ? match[0] : text,
	};
}

/** 把文本中所有已知占位符替换为对应取值。 */
export function substitutePlaceholders(text, values) {
	let result = String(text ?? "");
	for (const name of PLACEHOLDERS) {
		result = result.replaceAll(`{${name}}`, values[name] ?? "");
	}
	return result;
}

/**
 * 把文本切分为若干片段，标记哪些片段是占位符。
 * 用于在页面上把占位符部分特殊标识出来。
 */
export function tokenizePlaceholders(text) {
	const source = String(text ?? "");
	const tokens = [];
	let lastIndex = 0;

	for (const match of source.matchAll(PLACEHOLDER_PATTERN)) {
		if (match.index > lastIndex) {
			tokens.push({text: source.slice(lastIndex, match.index), placeholder: false});
		}
		tokens.push({text: match[0], placeholder: true});
		lastIndex = match.index + match[0].length;
	}

	if (lastIndex < source.length) {
		tokens.push({text: source.slice(lastIndex), placeholder: false});
	}

	return tokens;
}
