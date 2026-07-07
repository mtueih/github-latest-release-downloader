/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */


export async function getLatestReleaseTag(repoInfo) {
  const githubReleaseUrlPrefix = `https://github.com/${repoInfo.user}/${repoInfo.repo}/releases`;
  const githubReleaseLatestUrl = `${githubReleaseUrlPrefix}/latest`;
  const githubReleaseTagUrlPrefix = `${githubReleaseUrlPrefix}/tag/`;

  let response;

  try {
    response = await fetch(githubReleaseLatestUrl, {redirect: "manual"});
  } catch {
    return null;
  }

  if (response.status !== 302) {
    return null;
  }

  const location = response.headers.get("Location");

  if (!location.startsWith(githubReleaseTagUrlPrefix)) {
    return null;
  }

  const tag = location.slice(githubReleaseTagUrlPrefix.length);

  return {
    tag: tag,
    urlPrefix: githubReleaseUrlPrefix,
  };
}