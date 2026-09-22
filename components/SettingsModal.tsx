import React, { useEffect, useState } from 'react';
import { X, KeyRound, ShieldCheck, Loader2 } from 'lucide-react';
import {
  LlmSettings, DEFAULT_SETTINGS, getSettings, saveSettings,
  getApiKey, saveApiKey, deleteApiKey, isTauri,
} from '../services/settings';

interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ open, onClose }) => {
  const [baseUrl, setBaseUrl] = useState(DEFAULT_SETTINGS.baseUrl);
  const [model, setModel] = useState(DEFAULT_SETTINGS.model);
  const [anonymize, setAnonymize] = useState(DEFAULT_SETTINGS.anonymize);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [keyExists, setKeyExists] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedTip, setSavedTip] = useState('');

  useEffect(() => {
    if (!open) return;
    const s = getSettings();
    setBaseUrl(s.baseUrl);
    setModel(s.model);
    setAnonymize(s.anonymize);
    setApiKeyInput('');
    setSavedTip('');
    getApiKey().then(k => setKeyExists(k.length > 0));
  }, [open]);

  if (!open) return null;

  const handleSave = async () => {
    setSaving(true);
    try {
      const settings: LlmSettings = { baseUrl: baseUrl.trim(), model: model.trim(), anonymize };
      saveSettings(settings);
      if (apiKeyInput.trim()) {
        await saveApiKey(apiKeyInput.trim());
        setKeyExists(true);
      }
      setSavedTip('已保存');
      setTimeout(() => setSavedTip(''), 1500);
    } finally {
      setSaving(false);
    }
  };

  const handleClearKey = async () => {
    await deleteApiKey();
    setKeyExists(false);
    setApiKeyInput('');
    setSavedTip('已清除 Key');
    setTimeout(() => setSavedTip(''), 1500);
  };

  const inputCls = "w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition";

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="text-lg font-semibold text-slate-800">AI 服务设置</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1.5">服务地址(OpenAI 兼容 Base URL)</label>
            <input
              type="text"
              value={baseUrl}
              onChange={e => setBaseUrl(e.target.value)}
              placeholder="https://api.deepseek.com/v1"
              className={inputCls}
            />
            <p className="mt-1 text-[11px] text-slate-400">支持 DeepSeek / 通义千问 / 智谱 / Kimi 等任何 OpenAI 兼容服务,以 /v1 结尾即可</p>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1.5">模型名称</label>
            <input
              type="text"
              value={model}
              onChange={e => setModel(e.target.value)}
              placeholder="deepseek-chat"
              className={inputCls}
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1.5 flex items-center">
              <KeyRound className="w-3.5 h-3.5 mr-1" /> API Key
            </label>
            <div className="flex space-x-2">
              <input
                type="password"
                value={apiKeyInput}
                onChange={e => setApiKeyInput(e.target.value)}
                placeholder={keyExists ? '已保存(输入新值可覆盖)' : 'sk-...'}
                className={inputCls}
              />
              {keyExists && (
                <button
                  onClick={handleClearKey}
                  className="px-3 rounded-lg border border-red-100 text-red-500 text-xs font-medium hover:bg-red-50 whitespace-nowrap"
                >
                  清除
                </button>
              )}
            </div>
            <p className="mt-1 text-[11px] text-slate-400 flex items-center">
              <ShieldCheck className="w-3 h-3 mr-1 text-emerald-500" />
              {isTauri()
                ? 'Key 将存入系统凭据管理器,不会写入配置文件或安装包'
                : '浏览器开发模式:Key 仅存于 localStorage,请勿在生产使用'}
            </p>
          </div>

          <label className="flex items-start space-x-3 p-3 rounded-xl bg-slate-50 border border-slate-100 cursor-pointer">
            <input
              type="checkbox"
              checked={anonymize}
              onChange={e => setAnonymize(e.target.checked)}
              className="mt-0.5 w-4 h-4 accent-blue-600"
            />
            <span className="text-xs text-slate-600 leading-relaxed">
              <span className="font-medium text-slate-700">数据脱敏(推荐)</span>
              <br />
              发送给 AI 的"高负荷名单"中,员工姓名将替换为"员工A/B…"等代称,部门与职位保留。
            </span>
          </label>
        </div>

        <div className="flex items-center justify-end space-x-3 px-6 py-4 border-t border-slate-100">
          {savedTip && <span className="text-xs text-emerald-600 font-medium">{savedTip}</span>}
          <button
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center px-5 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-60"
          >
            {saving && <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />}
            保存
          </button>
        </div>
      </div>
    </div>
  );
};
