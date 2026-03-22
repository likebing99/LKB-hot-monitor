import { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { Save, Key, Mail, Clock, Cpu } from 'lucide-react';
import { TextGenerateEffect } from '../components/ui/TextGenerateEffect';

export default function SettingsPage() {
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api.getSettings().then(data => {
      setSettings(data || {});
      setLoading(false);
    }).catch(err => {
      console.error(err);
      setLoading(false);
    });
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    try {
      await api.updateSettings(settings);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      alert('保存失败: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const update = (key, value) => setSettings(prev => ({ ...prev, [key]: value }));

  if (loading) return <div className="text-center py-20 text-slate-500">加载中...</div>;

  const sections = [
    {
      icon: Cpu,
      title: 'AI 配置',
      color: 'text-aurora-purple',
      glow: '#059669',
      fields: (
        <div className="flex flex-col gap-4">
          <div>
            <label className="text-sm text-slate-400 mb-1.5 block">OpenRouter API Key</label>
            <input
              type="password"
              className="input-dark"
              placeholder="sk-or-..."
              value={settings.openrouter_api_key || ''}
              onChange={e => update('openrouter_api_key', e.target.value)}
            />
          </div>
          <div>
            <label className="text-sm text-slate-400 mb-1.5 block">AI 模型</label>
            <select
              className="input-dark"
              value={settings.ai_model || 'minimax/minimax-m2.5'}
              onChange={e => update('ai_model', e.target.value)}
            >
              <option value="minimax/minimax-m2.5">MiniMax M2.5 (推荐)</option>
              <option value="deepseek/deepseek-chat-v3-0324">DeepSeek V3 0324</option>
              <option value="google/gemini-2.0-flash-001">Gemini 2.0 Flash</option>
              <option value="anthropic/claude-3.5-sonnet">Claude 3.5 Sonnet</option>
              <option value="openai/gpt-4o-mini">GPT-4o Mini</option>
              <option value="openai/gpt-4o">GPT-4o</option>
              <option value="meta-llama/llama-3.1-70b-instruct">Llama 3.1 70B</option>
            </select>
          </div>
        </div>
      ),
    },
    {
      icon: Key,
      title: 'API 密钥',
      color: 'text-aurora-cyan',
      glow: '#16a34a',
      fields: (
        <div>
          <label className="text-sm text-slate-400 mb-1.5 block">Twitter API Key (twitterapi.io)</label>
          <input
            type="password"
            className="input-dark"
            placeholder="输入 twitterapi.io API Key"
            value={settings.twitter_api_key || ''}
            onChange={e => update('twitter_api_key', e.target.value)}
          />
          <p className="text-xs text-slate-400 mt-1.5">可选 · 不配置则跳过 Twitter 数据源</p>
        </div>
      ),
    },
    {
      icon: Clock,
      title: '扫描设置',
      color: 'text-aurora-green',
      glow: '#22c55e',
      fields: (
        <div>
          <label className="text-sm text-slate-400 mb-1.5 block">扫描间隔 (分钟)</label>
          <input
            type="number"
            className="input-dark"
            min="5"
            max="1440"
            value={settings.scan_interval || 30}
            onChange={e => update('scan_interval', e.target.value)}
          />
        </div>
      ),
    },
    {
      icon: Mail,
      title: '邮件通知',
      color: 'text-aurora-pink',
      glow: '#ec4899',
      fields: (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-slate-400 mb-1.5 block">SMTP 服务器</label>
              <input
                className="input-dark"
                placeholder="smtp.gmail.com"
                value={settings.smtp_host || ''}
                onChange={e => update('smtp_host', e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm text-slate-400 mb-1.5 block">SMTP 端口</label>
              <input
                className="input-dark"
                placeholder="587"
                value={settings.smtp_port || ''}
                onChange={e => update('smtp_port', e.target.value)}
              />
            </div>
          </div>
          <div>
            <label className="text-sm text-slate-400 mb-1.5 block">SMTP 用户名</label>
            <input
              className="input-dark"
              placeholder="your-email@gmail.com"
              value={settings.smtp_user || ''}
              onChange={e => update('smtp_user', e.target.value)}
            />
          </div>
          <div>
            <label className="text-sm text-slate-400 mb-1.5 block">SMTP 密码</label>
            <input
              type="password"
              className="input-dark"
              placeholder="应用密码"
              value={settings.smtp_pass || ''}
              onChange={e => update('smtp_pass', e.target.value)}
            />
          </div>
          <div>
            <label className="text-sm text-slate-400 mb-1.5 block">通知邮箱</label>
            <input
              className="input-dark"
              placeholder="接收通知的邮箱"
              value={settings.notify_email || ''}
              onChange={e => update('notify_email', e.target.value)}
            />
          </div>
        </div>
      ),
    },
  ];

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <TextGenerateEffect words="系统设置" className="text-2xl font-bold text-gradient" />
          <p className="text-sm text-slate-500 mt-1.5">配置 API 密钥和扫描参数</p>
        </div>
        <button onClick={handleSave} disabled={saving} className="btn-primary flex items-center gap-2">
          <Save size={16} />
          {saving ? '保存中...' : saved ? '已保存 ✓' : '保存设置'}
        </button>
      </div>

      <div className="flex flex-col gap-6">
        {sections.map((section, i) => (
          <section key={i} className="stat-card" style={{ '--glow-color': section.glow }}>
            <div className="flex items-center gap-3 mb-5">
              <div className={`p-2 rounded-xl bg-green-50 ${section.color}`}>
                <section.icon size={20} />
              </div>
              <h2 className="text-lg font-semibold text-slate-800">{section.title}</h2>
            </div>
            {section.fields}
          </section>
        ))}
      </div>
    </div>
  );
}
