const HOST_PERMISSION_PROTOCOLS = new Set(['http:', 'https:']);

const toHostPermissionPattern = (rawUrl: string) => {
  let url: URL;
  try {
    url = new URL(rawUrl.trim());
  } catch {
    throw new Error(`API 地址无效：${rawUrl}`);
  }

  if (!HOST_PERMISSION_PROTOCOLS.has(url.protocol)) {
    throw new Error(`不支持的 API 协议：${url.protocol}`);
  }

  return `${url.protocol}//${url.host}/*`;
};

const resolveHostPermissionPatterns = (urls: string[]) =>
  Array.from(new Set(urls.filter(url => url.trim().length > 0).map(toHostPermissionPattern)));

const requestHostPermissions = async (urls: string[]) => {
  const origins = resolveHostPermissionPatterns(urls);
  if (origins.length === 0) {
    return;
  }

  // permissions.request 必须直接由用户操作触发，因此不要在调用前插入异步检查。
  const granted = await chrome.permissions.request({ origins });
  if (!granted) {
    throw new Error(`未授权访问 API 域名：${origins.join('、')}`);
  }
};

const assertHostPermission = async (rawUrl: string) => {
  const origin = toHostPermissionPattern(rawUrl);
  const granted = await chrome.permissions.contains({ origins: [origin] });
  if (!granted) {
    throw new Error(`未授权访问 API 域名：${origin}。请在扩展设置中授权当前配置域名。`);
  }
};

export { assertHostPermission, requestHostPermissions, toHostPermissionPattern };
