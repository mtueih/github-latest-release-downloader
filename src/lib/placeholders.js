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
 * 找出资产名称中应高亮的占位符值。
 * `{tag}` 优先；仅在名称中找不到 tag 时才尝试 `{version}`。
 */
export function tokenizePlaceholders(text, values = {}) {
	const source = String(text ?? "");
	const tag = String(values.tag ?? "");
	const version = String(values.version ?? "");
	const candidates = [{name: "tag", text: tag}, {name: "version", text: version}].filter((candidate) => candidate.text);
	const match = candidates.find((candidate) => source.includes(candidate.text));

	if (!match) return [{text: source, placeholder: false, name: null}];

	const index = source.indexOf(match.text);
	return [
		...(index > 0 ? [{text: source.slice(0, index), placeholder: false, name: null}] : []),
		{text: match.text, placeholder: true, name: match.name},
		...(index + match.text.length < source.length
			? [{text: source.slice(index + match.text.length), placeholder: false, name: null}]
			: []),
	];
}
