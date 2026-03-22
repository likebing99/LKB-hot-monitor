import { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { Plus, Trash2, ToggleLeft, ToggleRight, Edit3, X, Check, Search } from 'lucide-react';

export default function Keywords() {
  const [keywords, setKeywords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [newKeyword, setNewKeyword] = useState('');
  const [newType, setNewType] = useState('keyword');
  const [editId, setEditId] = useState(null);
  const [editValue, setEditValue] = useState('');

  const fetchKeywords = async () => {
    try {
      const data = await api.getKeywords();
      setKeywords(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchKeywords(); }, []);

  const handleAdd = async () => {
    if (!newKeyword.trim()) return;
    try {
      await api.createKeyword({ keyword: newKeyword.trim(), type: newType });
      setNewKeyword('');
      setShowAdd(false);
      fetchKeywords();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('确定删除该关键词？')) return;
    try {
      await api.deleteKeyword(id);
      fetchKeywords();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleToggle = async (id) => {
    try {
      await api.toggleKeyword(id);
      fetchKeywords();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleEdit = async (id) => {
    if (!editValue.trim()) return;
    try {
      await api.updateKeyword(id, { keyword: editValue.trim() });
      setEditId(null);
      fetchKeywords();
    } catch (err) {
      alert(err.message);
    }
  };

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold neon-text">关键词管理</h1>
          <p className="text-sm text-slate-500 mt-1">配置需要监控的关键词和领域</p>
        </div>
        <button onClick={() => setShowAdd(true)} className="btn-primary flex items-center gap-2">
          <Plus size={16} /> 添加关键词
        </button>
      </div>

      {/* Add keyword form */}
      {showAdd && (
        <div className="glass-card p-5 mb-6 animate-fade-in">
          <div className="flex items-center gap-3">
            <input
              className="input-dark flex-1"
              placeholder="输入关键词，例如：GPT-5、AI编程"
              value={newKeyword}
              onChange={e => setNewKeyword(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAdd()}
              autoFocus
            />
            <select
              className="input-dark w-auto"
              value={newType}
              onChange={e => setNewType(e.target.value)}
            >
              <option value="keyword">关键词</option>
              <option value="domain">领域</option>
              <option value="person">人物</option>
              <option value="product">产品</option>
            </select>
            <button onClick={handleAdd} className="btn-primary">
              <Check size={16} />
            </button>
            <button onClick={() => setShowAdd(false)} className="btn-ghost">
              <X size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Keywords list */}
      {loading ? (
        <div className="text-center py-20 text-slate-500">加载中...</div>
      ) : keywords.length === 0 ? (
        <div className="text-center py-20">
          <Search size={48} className="mx-auto mb-4 text-slate-600" />
          <p className="text-slate-500">还没有监控关键词</p>
          <p className="text-sm text-slate-600 mt-1">点击「添加关键词」开始配置</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {keywords.map(kw => (
            <div key={kw.id} className={`glass-card p-4 flex items-center gap-4 ${!kw.enabled ? 'opacity-50' : ''}`}>
              {/* Toggle */}
              <button onClick={() => handleToggle(kw.id)} className="text-slate-400 hover:text-aurora-cyan transition-colors">
                {kw.enabled ? <ToggleRight size={24} className="text-aurora-cyan" /> : <ToggleLeft size={24} />}
              </button>

              {/* Content */}
              <div className="flex-1 min-w-0">
                {editId === kw.id ? (
                  <div className="flex items-center gap-2">
                    <input
                      className="input-dark flex-1"
                      value={editValue}
                      onChange={e => setEditValue(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleEdit(kw.id)}
                      autoFocus
                    />
                    <button onClick={() => handleEdit(kw.id)} className="btn-primary p-2"><Check size={14} /></button>
                    <button onClick={() => setEditId(null)} className="btn-ghost p-2"><X size={14} /></button>
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <span className="text-base font-medium text-slate-100">{kw.keyword}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full border ${
                      kw.type === 'domain' ? 'bg-aurora-purple/15 text-aurora-purple border-aurora-purple/30' :
                      kw.type === 'person' ? 'bg-aurora-pink/15 text-aurora-pink border-aurora-pink/30' :
                      kw.type === 'product' ? 'bg-aurora-green/15 text-aurora-green border-aurora-green/30' :
                      'bg-neon-blue/15 text-neon-blue border-neon-blue/30'
                    }`}>
                      {kw.type === 'domain' ? '领域' : kw.type === 'person' ? '人物' : kw.type === 'product' ? '产品' : '关键词'}
                    </span>
                  </div>
                )}
                <div className="text-xs text-slate-600 mt-1">
                  添加于 {new Date(kw.created_at).toLocaleString('zh-CN')}
                </div>
              </div>

              {/* Actions */}
              {editId !== kw.id && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => { setEditId(kw.id); setEditValue(kw.keyword); }}
                    className="p-2 text-slate-500 hover:text-slate-300 transition-colors"
                  >
                    <Edit3 size={16} />
                  </button>
                  <button
                    onClick={() => handleDelete(kw.id)}
                    className="p-2 text-slate-500 hover:text-red-400 transition-colors"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
