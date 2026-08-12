import React, { useEffect, useState } from 'react';
import { Megaphone, Plus, Calendar, Paperclip, Trash2, Search, Filter, Users, Building, MapPin, ShieldAlert, CheckCircle, Clock } from 'lucide-react';
import { hrmsApi } from '../../lib/api-client';
import { Announcement } from '../../types/hrms';

interface AnnouncementsViewProps {
  userRole: string;
}

export const AnnouncementsView: React.FC<AnnouncementsViewProps> = ({ userRole }) => {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [orgMeta, setOrgMeta] = useState<{ departments: string[]; branches: string[] }>({
    departments: ['Engineering', 'Human Resources', 'Sales', 'Marketing', 'Finance', 'Operations'],
    branches: ['Corporate HQ', 'Mumbai Regional Office', 'Bangalore Tech Hub', 'Delhi Branch']
  });
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [audienceFilter, setAudienceFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ACTIVE');

  // Creation Modal State
  const [showModal, setShowModal] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [audience, setAudience] = useState<'ALL' | 'DEPARTMENT' | 'BRANCH' | 'MANAGERS_ONLY'>('ALL');
  const [targetName, setTargetName] = useState('');
  const [publishDate, setPublishDate] = useState(new Date().toISOString().split('T')[0]);
  const [expiryDate, setExpiryDate] = useState('');
  const [attachmentName, setAttachmentName] = useState('');
  const [attachmentUrl, setAttachmentUrl] = useState('');

  const canCreate = ['SUPER_ADMIN', 'ADMIN', 'HR_MANAGER'].includes(userRole);

  useEffect(() => {
    loadAnnouncements();
    loadMeta();
  }, []);

  const loadMeta = async () => {
    try {
      const meta = await hrmsApi.getOrganizationMeta();
      if (meta) {
        setOrgMeta({
          departments: meta.departments || ['Engineering', 'Human Resources', 'Sales', 'Marketing', 'Finance', 'Operations'],
          branches: meta.branches || ['Corporate HQ', 'Mumbai Regional Office', 'Bangalore Tech Hub', 'Delhi Branch']
        });
      }
    } catch (err) {
      console.error(err);
    }
  };

  const loadAnnouncements = async () => {
    try {
      setLoading(true);
      const res = await hrmsApi.getAnnouncements();
      setAnnouncements(res.data || []);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) return;

    try {
      await hrmsApi.createAnnouncement({
        title,
        content,
        audience,
        target_name: targetName || undefined,
        publish_date: publishDate,
        expiry_date: expiryDate || undefined,
        attachment_name: attachmentName || undefined,
        attachment_url: attachmentUrl || undefined,
        category: 'GENERAL'
      });

      setShowModal(false);
      setTitle('');
      setContent('');
      setAudience('ALL');
      setTargetName('');
      setExpiryDate('');
      setAttachmentName('');
      setAttachmentUrl('');

      loadAnnouncements();
      alert('Announcement created as draft!');
    } catch (err: any) {
      alert(err.message || 'Failed to create announcement');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this announcement?')) return;
    try {
      await hrmsApi.deleteAnnouncement(id);
      setAnnouncements(prev => prev.filter(a => a.id !== id));
      alert('Announcement deleted.');
    } catch (err: any) {
      alert(err.message || 'Failed to delete announcement');
    }
  };

  const handlePublish = async (id: string) => {
    try {
      await hrmsApi.publishAnnouncement(id);
      loadAnnouncements();
      alert('Announcement published successfully!');
    } catch (err: any) {
      alert(err.message || 'Failed to publish announcement');
    }
  };

  const handleArchive = async (id: string) => {
    try {
      await hrmsApi.archiveAnnouncement(id);
      loadAnnouncements();
      alert('Announcement archived.');
    } catch (err: any) {
      alert(err.message || 'Failed to archive announcement');
    }
  };

  const todayStr = new Date().toISOString().split('T')[0];

  const filteredAnnouncements = announcements.filter(a => {
    const isExpired = a.expiryDate && a.expiryDate < todayStr;
    if (statusFilter === 'ACTIVE' && isExpired) return false;
    if (statusFilter === 'EXPIRED' && !isExpired) return false;

    if (audienceFilter !== 'ALL' && a.audience !== audienceFilter) return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = a.title.toLowerCase().includes(q);
      const matchContent = a.content.toLowerCase().includes(q);
      const matchAuthor = (a.authorName || '').toLowerCase().includes(q);
      if (!matchTitle && !matchContent && !matchAuthor) return false;
    }
    return true;
  });

  const getAudienceBadge = (a: Announcement) => {
    switch (a.audience) {
      case 'ALL':
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-blue-100 text-blue-800">
            <Users className="w-3 h-3" />
            <span>Company Wide</span>
          </span>
        );
      case 'DEPARTMENT':
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-purple-100 text-purple-800">
            <Building className="w-3 h-3" />
            <span>Dept: {a.target_name || 'Specific Department'}</span>
          </span>
        );
      case 'BRANCH':
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-100 text-amber-800">
            <MapPin className="w-3 h-3" />
            <span>Branch: {a.target_name || 'Specific Location'}</span>
          </span>
        );
      case 'MANAGERS_ONLY':
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-rose-100 text-rose-800">
            <ShieldAlert className="w-3 h-3" />
            <span>Managers Only</span>
          </span>
        );
    }
  };

  return (
    <div id="announcements-view-root" className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-900 tracking-tight">Organization Announcements</h2>
          <p className="text-xs text-slate-500">Official circulars, holiday notices, and company wide broadcasts</p>
        </div>

        {canCreate && (
          <button
            onClick={() => setShowModal(true)}
            className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-xs transition-all flex items-center space-x-2 self-start sm:self-auto"
          >
            <Plus className="w-4 h-4" />
            <span>Create Broadcast</span>
          </button>
        )}
      </div>

      {/* Search and Filters Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-400" />
          <input
            type="text"
            placeholder="Search announcements..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        <div className="flex items-center space-x-2 w-full sm:w-auto">
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700"
          >
            <option value="ACTIVE">Active Broadcasts</option>
            <option value="EXPIRED">Expired Notices</option>
            <option value="ALL">All Announcements</option>
          </select>

          <select
            value={audienceFilter}
            onChange={e => setAudienceFilter(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700"
          >
            <option value="ALL">Audience: All</option>
            <option value="DEPARTMENT">Department Specific</option>
            <option value="BRANCH">Branch / Location</option>
            <option value="MANAGERS_ONLY">Managers Only</option>
          </select>
        </div>
      </div>

      {/* List of Announcements */}
      <div className="space-y-4">
        {loading ? (
          <div className="bg-white p-8 rounded-2xl border border-slate-200 text-center text-xs text-slate-400">
            Loading announcements...
          </div>
        ) : filteredAnnouncements.length === 0 ? (
          <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center space-y-2">
            <Megaphone className="w-10 h-10 text-slate-300 mx-auto" />
            <div className="font-bold text-sm text-slate-700">No announcements found</div>
            <p className="text-xs text-slate-400">Check back later for company circulars and noticeboard updates</p>
          </div>
        ) : (
          filteredAnnouncements.map(a => {
            const isExpired = a.expiryDate && a.expiryDate < todayStr;
            return (
              <div
                key={a.id}
                className={`bg-white p-6 rounded-2xl border shadow-2xs space-y-3 transition-all hover:border-slate-300 ${
                  isExpired ? 'border-slate-200 opacity-75 bg-slate-50/50' : 'border-slate-200'
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      {getAudienceBadge(a)}
                      {a.status === 'DRAFT' && <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-slate-200 text-slate-600">DRAFT</span>}
                      {a.status === 'ARCHIVED' && <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-slate-400 text-white">ARCHIVED</span>}
                      {a.status === 'PUBLISHED' && isExpired ? (
                        <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-amber-100 text-amber-800">EXPIRED</span>
                      ) : a.status === 'PUBLISHED' ? (
                        <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-emerald-100 text-emerald-800">ACTIVE</span>
                      ) : null}
                    </div>
                    <h3 className="font-extrabold text-base text-slate-900 tracking-tight">{a.title}</h3>
                  </div>

                  {canCreate && (
                    <div className="flex items-center gap-2">
                      {a.status === 'DRAFT' && (
                        <button
                          onClick={() => handlePublish(a.id)}
                          className="px-2 py-1 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 font-bold text-[10px] rounded"
                        >
                          PUBLISH
                        </button>
                      )}
                      {a.status === 'PUBLISHED' && !isExpired && (
                        <button
                          onClick={() => handleArchive(a.id)}
                          className="px-2 py-1 bg-amber-50 text-amber-600 hover:bg-amber-100 font-bold text-[10px] rounded"
                        >
                          ARCHIVE
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(a.id)}
                        className="text-slate-400 hover:text-rose-600 p-1 rounded-lg transition-colors"
                        title="Delete Announcement"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>

                <div className="text-[11px] text-slate-500 font-medium">Target: {a.target_name || a.audience}</div><p className="text-xs text-slate-700 leading-relaxed whitespace-pre-line">{a.content}</p>

                {a.attachmentName && (
                  <div className="pt-1">
                    <a
                      href={a.attachmentUrl || '#'}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center space-x-2 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-emerald-700 hover:bg-slate-100"
                    >
                      <Paperclip className="w-3.5 h-3.5" />
                      <span>{a.attachmentName}</span>
                    </a>
                  </div>
                )}

                <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between text-[11px] text-slate-400 font-medium">
                  <div>
                    Published by <span className="font-bold text-slate-700">{a.authorName}</span>
                  </div>

                  <div className="flex items-center space-x-3">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-emerald-600" />
                      Published: {a.publishDate}
                    </span>
                    {a.expiryDate && (
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-amber-600" />
                        Expires: {a.expiryDate}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Modal for Creating Announcement */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <h3 className="font-black text-base text-slate-900 border-b border-slate-200 pb-3">Create New Organization Announcement</h3>

            <form onSubmit={handleCreate} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Headline / Title *</label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                  placeholder="e.g. Independence Day Holiday Schedule & Flag Hoisting Ceremony"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Target Audience *</label>
                  <select
                    value={audience}
                    onChange={e => {
                      setAudience(e.target.value as any);
                      setTargetName('');
                    }}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold"
                  >
                    <option value="ALL">All Staff (Company Wide)</option>
                    <option value="DEPARTMENT">Specific Department</option>
                    <option value="BRANCH">Specific Branch / Office</option>
                    <option value="MANAGERS_ONLY">Managers & Leadership Only</option>
                  </select>
                </div>

                {audience === 'DEPARTMENT' && (
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Select Department *</label>
                    <select
                      value={targetName}
                      onChange={e => setTargetName(e.target.value)}
                      required
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold"
                    >
                      <option value="">-- Choose Department --</option>
                      {orgMeta.departments.map(d => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                    </select>
                  </div>
                )}

                {audience === 'BRANCH' && (
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Select Branch *</label>
                    <select
                      value={targetName}
                      onChange={e => setTargetName(e.target.value)}
                      required
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold"
                    >
                      <option value="">-- Choose Branch --</option>
                      {orgMeta.branches.map(b => (
                        <option key={b} value={b}>{b}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Message Content / Circular Text *</label>
                <textarea
                  required
                  rows={4}
                  value={content}
                  onChange={e => setContent(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                  placeholder="Provide complete circular information..."
                ></textarea>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Publish Date *</label>
                  <input
                    type="date"
                    required
                    value={publishDate}
                    onChange={e => setPublishDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Expiry Date (Optional)</label>
                  <input
                    type="date"
                    value={expiryDate}
                    onChange={e => setExpiryDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                  />
                </div>
              </div>

              <div className="border border-dashed border-slate-300 p-3 rounded-xl bg-slate-50/50 space-y-2">
                <span className="block font-bold text-slate-700">Optional Attachment (Policy PDF / Image)</span>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    placeholder="Attachment Title (e.g. policy.pdf)"
                    value={attachmentName}
                    onChange={e => setAttachmentName(e.target.value)}
                    className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-md text-xs"
                  />
                  <input
                    type="text"
                    placeholder="URL or Attachment Path"
                    value={attachmentUrl}
                    onChange={e => setAttachmentUrl(e.target.value)}
                    className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-md text-xs"
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 font-semibold text-slate-600 hover:text-slate-900"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 font-bold bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl shadow-xs"
                >
                  Publish Notice
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
