/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

/** 页面展示所需的字段格式化工具。 */

/** 把字节数格式化为便于阅读的容量文本。 */
export function formatBytes(bytes) {
	if (!Number.isFinite(bytes) || bytes <= 0) {
		return "0 B";
	}

	const units = ["B", "KB", "MB", "GB", "TB"];
	const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
	const value = bytes / 1024 ** exponent;

	return `${value >= 100 || exponent === 0 ? Math.round(value) : value.toFixed(1)} ${units[exponent]}`;
}

/** 把数字格式化为带千位分隔符的文本。 */
export function formatCount(value) {
	if (!Number.isFinite(value)) {
		return "0";
	}
	return new Intl.NumberFormat("zh-CN").format(value);
}

/** 把 ISO 时间戳裁剪为 `YYYY-MM-DD`。 */
export function formatDate(isoString) {
	const text = String(isoString ?? "");
	return text.length >= 10 ? text.slice(0, 10) : text;
}
