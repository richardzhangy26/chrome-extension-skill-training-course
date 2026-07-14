import { useState } from 'react';

interface AuthPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onLogin: (email: string, password: string) => Promise<{ ok: boolean; error?: string; needsVerification?: boolean }>;
  onRegister: (
    email: string,
    password: string,
    name: string,
  ) => Promise<{ ok: boolean; error?: string; needsVerification?: boolean }>;
}

const AuthPanel = ({ isOpen, onClose, onLogin, onRegister }: AuthPanelProps) => {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const submit = async () => {
    setBusy(true);
    setMessage(null);
    const result = mode === 'login' ? await onLogin(email, password) : await onRegister(email, password, name);
    setBusy(false);
    if (result.ok && mode === 'register') {
      setMessage('注册成功！请到邮箱点击验证链接（在浏览器网页打开），验证后再登录。');
      setMode('login');
      return;
    }
    if (result.ok) {
      onClose();
      return;
    }
    setMessage(result.error ?? '操作失败');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        onKeyDown={e => e.key === 'Escape' && onClose()}
        role="button"
        tabIndex={0}
        aria-label="关闭登录弹窗"
      />
      <div className="relative w-[90%] max-w-sm overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="bg-gradient-to-r from-teal-500 to-cyan-500 px-5 py-4">
          <h2 className="text-lg font-semibold text-white">{mode === 'login' ? '登录' : '注册'}</h2>
        </div>
        <div className="space-y-3 p-5">
          {mode === 'register' && (
            <div>
              <label htmlFor="auth-name" className="mb-1 block text-sm font-medium text-slate-700">
                昵称
              </label>
              <input
                id="auth-name"
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm"
              />
            </div>
          )}
          <div>
            <label htmlFor="auth-email" className="mb-1 block text-sm font-medium text-slate-700">
              邮箱
            </label>
            <input
              id="auth-email"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm"
            />
          </div>
          <div>
            <label htmlFor="auth-password" className="mb-1 block text-sm font-medium text-slate-700">
              密码
            </label>
            <input
              id="auth-password"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm"
            />
          </div>
          {message && <p className="text-sm text-amber-600">{message}</p>}
          <button
            type="button"
            onClick={submit}
            disabled={busy}
            className="w-full rounded-lg bg-gradient-to-r from-teal-500 to-cyan-500 py-2.5 text-sm font-medium text-white disabled:opacity-50">
            {busy ? '处理中…' : mode === 'login' ? '登录' : '注册'}
          </button>
          <button
            type="button"
            onClick={() => {
              setMode(mode === 'login' ? 'register' : 'login');
              setMessage(null);
            }}
            className="w-full text-center text-xs text-cyan-600 hover:text-cyan-700">
            {mode === 'login' ? '没有账号？去注册' : '已有账号？去登录'}
          </button>
          <p className="text-center text-xs leading-relaxed text-slate-400">
            登录后在插件里保存配置会自动同步到云端；可在
            <a
              href="https://polymasability.agicoderbit.com"
              target="_blank"
              rel="noreferrer"
              className="text-cyan-600 hover:text-cyan-700">
              控制台
            </a>
            查看历史记录与配置。
          </p>
        </div>
      </div>
    </div>
  );
};

export { AuthPanel };
