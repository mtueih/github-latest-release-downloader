/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */


export async function requestUrlParser(requestUrl) {
  let url;

  try {
    url = new URL(requestUrl);
  } catch {
    return null;
  }

  const urlPaths = url.pathname.slice(1).split("/");

  if (urlPaths.length !== 3) {
    return null;
  }

  return {
    user: urlPaths[0],
    repo: urlPaths[1],
    file: urlPaths[2],
  };
}