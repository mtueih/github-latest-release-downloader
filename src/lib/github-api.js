/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

/**
 * GitHub REST API 客户端。
 * 仅在渲染「某仓库最新发行 Assets 列表」页面时使用，因此做了内存微缓存，
 * 尽量减少受限流影响的 API 调用次数。
 */

const API_BASE = "https://api.github.com";
const CACHE_TTL_MS = 5 * 60 * 1000;
const CACHE_MAX_ENTRIES = 64;

/**
 * 模块级缓存。Cloudflare Workers 的 isolate 会被复用，
 * 因此同一实例上的重复访问可以直接命中，不再消耗 GitHub 限额。
 */
const releaseCache = new Map();

export class GitHubApiError extends Error {
	/**
	 * @param {"not-found" | "rate-limited" | "unauthorized" | "network" | "bad-response"} kind
	 * @param {string} message
	 * @param {{status?: number, resetAt?: number, remaining?: number}} [details]
	 */
	constructor(kind, message, details = {}) {
		super(message);
		this.name = "GitHubApiError";
		this.kind = kind;
		this.status = details.status ?? 0;
		this.resetAt = details.resetAt ?? 0;
		this.remaining = details.remaining ?? 0;
	}
}

/** GitHub 用户名：字母数字与连字符，不允许以连字符开头或结尾。 */
const OWNER_PATTERN = /^[A-Za-z0-9](?:[A-Za-z0-9]|-(?=[A-Za-z0-9])){0,38}$/;
/** GitHub 仓库名：字母数字、点、下划线、连字符。 */
const REPO_PATTERN = /^[A-Za-z0-9._-]{1,100}$/;

/** 校验 owner/repo 是否可能是合法仓库标识，避免把明显非法的值送去请求 API。 */
export function isValidOwnerRepo(owner, repo) {
	return OWNER_PATTERN.test(String(owner ?? "")) && REPO_PATTERN.test(String(repo ?? ""));
}

function readCache(key) {
	const entry = releaseCache.get(key);
	if (!entry) {
		return null;
	}
	if (entry.expiresAt <= Date.now()) {
		releaseCache.delete(key);
		return null;
	}
	/* 命中后重新插入，让 Map 的迭代顺序近似 LRU。 */
	releaseCache.delete(key);
	releaseCache.set(key, entry);
	return entry.value;
}

function writeCache(key, value) {
	if (releaseCache.size >= CACHE_MAX_ENTRIES) {
		const oldestKey = releaseCache.keys().next().value;
		if (oldestKey !== undefined) {
			releaseCache.delete(oldestKey);
		}
	}
	releaseCache.set(key, {value, expiresAt: Date.now() + CACHE_TTL_MS});
}

function toRateLimitDetails(response) {
	const resetSeconds = Number(response.headers.get("x-ratelimit-reset"));
	return {
		status: response.status,
		remaining: Number(response.headers.get("x-ratelimit-remaining") ?? 0),
		resetAt: Number.isFinite(resetSeconds) ? resetSeconds * 1000 : 0,
	};
}

/** 把 API 返回的发行对象整理成页面直接可用的结构。 */
function normalizeRelease(payload, owner, repo) {
	const assets = Array.isArray(payload.assets) ? payload.assets : [];
	return {
		owner,
		repo,
		tag: String(payload.tag_name ?? ""),
		releaseName: String(payload.name ?? payload.tag_name ?? ""),
		releaseUrl: String(payload.html_url ?? `https://github.com/${owner}/${repo}/releases`),
		publishedAt: String(payload.published_at ?? ""),
		prerelease: payload.prerelease === true,
		assets: assets.map((asset) => ({
			name: String(asset.name ?? ""),
			size: Number(asset.size ?? 0),
			contentType: String(asset.content_type ?? ""),
			downloadUrl: String(asset.browser_download_url ?? ""),
			downloadCount: Number(asset.download_count ?? 0),
			updatedAt: String(asset.updated_at ?? asset.created_at ?? ""),
		})),
	};
}

/**
 * 获取仓库最新正式发行版本及其 Assets 列表。
 *
 * @param {{owner: string, repo: string, token?: string}} options
 * @returns {Promise<ReturnType<typeof normalizeRelease>>}
 * @throws {GitHubApiError}
 */
export async function getLatestRelease({owner, repo, token = ""}) {
	const cacheKey = `${owner}/${repo}`.toLowerCase();
	const cached = readCache(cacheKey);
	if (cached) {
		return cached;
	}

	const headers = {
		Accept: "application/vnd.github+json",
		"X-GitHub-Api-Version": "2022-11-28",
		/* GitHub API 要求携带 User-Agent，否则直接 403。 */
		"User-Agent": "github-latest-release-downloader",
	};
	if (token) {
		headers.Authorization = `Bearer ${token}`;
	}

	let response;
	try {
		response = await fetch(`${API_BASE}/repos/${owner}/${repo}/releases/latest`, {headers});
	} catch {
		throw new GitHubApiError("network", "无法连接到 GitHub API");
	}

	if (response.status === 404) {
		throw new GitHubApiError("not-found", "仓库或正式发行版本不存在", toRateLimitDetails(response));
	}

	if (response.status === 401) {
		throw new GitHubApiError("unauthorized", "GitHub Token 无效", toRateLimitDetails(response));
	}

	if (response.status === 403 || response.status === 429) {
		const details = toRateLimitDetails(response);
		const exhausted = details.remaining === 0 || response.status === 429;
		throw new GitHubApiError(
			exhausted ? "rate-limited" : "unauthorized",
			exhausted ? "GitHub API 访问次数已达上限" : "GitHub API 拒绝访问",
			details,
		);
	}

	if (!response.ok) {
		throw new GitHubApiError("bad-response", `GitHub API 返回了意外的状态码 ${response.status}`, {
			status: response.status,
		});
	}

	let payload;
	try {
		payload = await response.json();
	} catch {
		throw new GitHubApiError("bad-response", "GitHub API 返回的内容无法解析");
	}

	const release = normalizeRelease(payload, owner, repo);
	writeCache(cacheKey, release);
	return release;
}
