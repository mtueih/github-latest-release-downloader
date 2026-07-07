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