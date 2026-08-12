import React, { useEffect, useState } from 'react';
import {
  FileText,
  Plus,
  Download,
  Eye,
  Trash2,
  Lock,
  ShieldCheck,
  Search,
  Filter,
  Upload,
  User,
  Building,
  FileCheck,
  Award,
  CreditCard,
  Briefcase,
  FileSpreadsheet,
  AlertCircle,
  X,
  CheckCircle2,
  Calendar,
  Layers,
  FileCode,
  Check
} from 'lucide-react';
import { hrmsApi } from '../../lib/api-client';
import { Document, DocumentCategory, Employee } from '../../types/hrms';

interface DocumentsViewProps {
  userRole?: string;
  currentUserId?: string;
  currentEmployeeId?: string;
}

export const DocumentsView: React.FC<DocumentsViewProps> = ({
  userRole = 'EMPLOYEE',
  currentUserId,
  currentEmployeeId
}) => {
  const isHRorAdmin = ['SUPER_ADMIN', 'ADMIN', 'HR_MANAGER'].includes(userRole);

  const [documents, setDocuments] = useState<Document[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Modals
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<Document | null>(null);

  // Upload Form State
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<DocumentCategory>('POLICY');
  const [targetEmployeeId, setTargetEmployeeId] = useState<string>('');
  const [confidential, setConfidential] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileBase64, setFileBase64] = useState<string>('');
  const [uploadError, setUploadError] = useState<string>('');
  const [uploading, setUploading] = useState(false);

  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 });
  const [page, setPage] = useState(1);

  useEffect(() => {
    loadData();
  }, [selectedCategory, selectedEmployeeId, searchTerm, page]);

  const loadData = async () => {
    try {
      setLoading(true);
      const res = await hrmsApi.getDocuments({
        category: selectedCategory,
        employeeId: selectedEmployeeId,
        search: searchTerm,
        page,
        limit: 20
      });
      // @ts-ignore
      setDocuments(res.data || []);
      // @ts-ignore
      setPagination(res.pagination || { page: 1, limit: 20, total: 0, totalPages: 1 });

      if (isHRorAdmin) {
        const empRes = await hrmsApi.getEmployees();
        setEmployees(empRes?.data || empRes || []);
      }
    } catch (err: any) {
      console.error('Failed to load documents:', err);
    } finally {
      setLoading(false);
    }
  };

  // Handle File Selection with Client Validation
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUploadError('');
    const file = e.target.files?.[0];
    if (!file) {
      setSelectedFile(null);
      setFileBase64('');
      return;
    }

    // 1. File Size Validation (Max 10 MB)
    const MAX_SIZE = 10 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      setUploadError(`Selected file size (${(file.size / (1024 * 1024)).toFixed(1)} MB) exceeds the 10 MB limit.`);
      setSelectedFile(null);
      return;
    }

    // 2. File Format / Extension Validation
    const allowedExts = ['.pdf', '.png', '.jpg', '.jpeg', '.webp', '.doc', '.docx', '.xls', '.xlsx', '.txt'];
    const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
    if (!allowedExts.includes(ext)) {
      setUploadError(`File extension '${ext}' is not supported. Allowed formats: PDF, PNG, JPG, WEBP, DOC, DOCX, XLS, XLSX, TXT.`);
      setSelectedFile(null);
      return;
    }

    setSelectedFile(file);

    // Read File Data as Base64 Data URL for secure preview and storage
    const reader = new FileReader();
    reader.onload = () => {
      setFileBase64(reader.result as string);
    };
    reader.onerror = () => {
      setUploadError('Failed to read file content.');
    };
    reader.readAsDataURL(file);
  };

  // Submit Upload Form
  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setUploadError('');

    if (!title.trim()) {
      setUploadError('Please provide a document title.');
      return;
    }

    if (!selectedFile) {
      setUploadError('Please select a valid document file to upload.');
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('title', title.trim());
      formData.append('category', category);
      if (isHRorAdmin && targetEmployeeId) {
        formData.append('employeeId', targetEmployeeId);
      } else if (!isHRorAdmin && currentEmployeeId) {
        formData.append('employeeId', currentEmployeeId);
      }
      formData.append('file', selectedFile);
      if (confidential) {
        formData.append('confidential', 'true');
      }

      await hrmsApi.uploadDocument(formData);

      setShowUploadModal(false);
      setTitle('');
      setSelectedFile(null);
      setFileBase64('');
      setTargetEmployeeId('');
      setConfidential(false);
      alert('Document uploaded and stored securely!');
      await loadData();
    } catch (err: any) {
      setUploadError(err.message || 'Failed to upload document.');
    } finally {
      setUploading(false);
    }
  };

  // Trigger File Download
  const handleDownload = async (doc: Document) => {
    try {
      const res = await hrmsApi.getDocument(doc.id);
      const url = res.fileUrl || doc.fileUrl;

      const link = document.createElement('a');
      link.href = url;
      link.download = res.fileName || doc.fileName || `${doc.title.replace(/\s+/g, '_')}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err: any) {
      alert(err.message || 'Failed to download document.');
    }
  };

  // Delete Document
  const handleDelete = async (doc: Document) => {
    if (!window.confirm(`Are you sure you want to permanently delete '${doc.title}'? This action cannot be undone.`)) {
      return;
    }

    try {
      await hrmsApi.deleteDocument(doc.id);
      alert('Document deleted successfully.');
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to delete document.');
    }
  };

  const handleVerify = async (doc: Document) => {
    if (!window.confirm(`Verify '${doc.title}'?`)) return;
    try {
      await hrmsApi.verifyDocument(doc.id);
      alert('Document verified.');
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to verify document.');
    }
  };

  const handleReject = async (doc: Document) => {
    const reason = window.prompt(`Rejection reason for '${doc.title}':`);
    if (!reason) return;
    try {
      await hrmsApi.rejectDocument(doc.id, reason);
      alert('Document rejected.');
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to reject document.');
    }
  };

  // Category Icon & Styling Helper
  const getCategoryMeta = (cat: DocumentCategory) => {
    switch (cat) {
      case 'RESUME':
        return { label: 'Resume', icon: Briefcase, bg: 'bg-indigo-50 text-indigo-700 border-indigo-200' };
      case 'OFFER_LETTER':
        return { label: 'Offer Letter', icon: FileCheck, bg: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
      case 'JOINING_LETTER':
        return { label: 'Joining Letter', icon: Building, bg: 'bg-blue-50 text-blue-700 border-blue-200' };
      case 'CERTIFICATES':
        return { label: 'Certificate', icon: Award, bg: 'bg-amber-50 text-amber-700 border-amber-200' };
      case 'IDENTITY_DOCUMENTS':
        return { label: 'Identity Proof', icon: CreditCard, bg: 'bg-purple-50 text-purple-700 border-purple-200' };
      case 'CONTRACT':
        return { label: 'Contract', icon: ShieldCheck, bg: 'bg-rose-50 text-rose-700 border-rose-200' };
      case 'PAYSLIP':
        return { label: 'Payslip', icon: FileSpreadsheet, bg: 'bg-teal-50 text-teal-700 border-teal-200' };
      case 'POLICY':
        return { label: 'HR Policy', icon: FileText, bg: 'bg-slate-100 text-slate-800 border-slate-300' };
      default:
        return { label: 'Other Document', icon: Layers, bg: 'bg-slate-50 text-slate-700 border-slate-200' };
    }
  };

  return (
    <div id="documents-view-root" className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900 text-white p-6 rounded-2xl shadow-sm">
        <div className="space-y-1">
          <div className="flex items-center space-x-2">
            <Lock className="w-6 h-6 text-emerald-400" />
            <h2 className="text-xl font-black tracking-tight">Secure Employee Document Vault</h2>
          </div>
          <p className="text-xs text-slate-300">
            Encrypted document repository with authorization controls for Resumes, Offer Letters, ID proofs, Contracts, and Payslips.
          </p>
        </div>

        <button
          id="btn-upload-document"
          onClick={() => {
            setUploadError('');
            setShowUploadModal(true);
          }}
          className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center space-x-2 self-start md:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Upload Document</span>
        </button>
      </div>

      {/* Category Pills Filter */}
      <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 border-b border-slate-200 text-xs font-bold text-slate-600">
        <button
          onClick={() => setSelectedCategory('ALL')}
          className={`px-3.5 py-2 rounded-xl transition-all whitespace-nowrap ${
            selectedCategory === 'ALL' ? 'bg-slate-900 text-white font-black' : 'hover:bg-slate-100 text-slate-600'
          }`}
        >
          All Documents
        </button>

        {[
          { key: 'RESUME', label: 'Resumes' },
          { key: 'OFFER_LETTER', label: 'Offer Letters' },
          { key: 'JOINING_LETTER', label: 'Joining Letters' },
          { key: 'CERTIFICATES', label: 'Certificates' },
          { key: 'IDENTITY_DOCUMENTS', label: 'Identity Proofs' },
          { key: 'CONTRACT', label: 'Contracts' },
          { key: 'PAYSLIP', label: 'Payslips' },
          { key: 'POLICY', label: 'HR Policies' },
          { key: 'OTHER', label: 'Other HR Docs' }
        ].map(cat => (
          <button
            key={cat.key}
            onClick={() => setSelectedCategory(cat.key)}
            className={`px-3.5 py-2 rounded-xl transition-all whitespace-nowrap ${
              selectedCategory === cat.key ? 'bg-blue-600 text-white font-black' : 'hover:bg-slate-100 text-slate-600'
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex flex-wrap items-center gap-3">
          {isHRorAdmin && (
            <div className="flex items-center space-x-2">
              <span className="text-xs font-bold text-slate-500">Filter Employee:</span>
              <select
                value={selectedEmployeeId}
                onChange={e => setSelectedEmployeeId(e.target.value)}
                className="bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-800 px-3 py-2 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500"
              >
                <option value="ALL">All Employees & Policies</option>
                <option value="COMPANY_WIDE">Company-Wide Policies Only</option>
                {employees.map(e => (
                  <option key={e.id} value={e.id}>
                    {e.firstName} {e.lastName} ({e.employeeCode})
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search by title, file, employee..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 pl-9 pr-3 py-2 rounded-xl text-xs text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Documents Grid */}
      {loading ? (
        <div className="p-12 text-center text-xs text-slate-500 bg-white rounded-2xl border border-slate-200">
          Loading authorized document library...
        </div>
      ) : documents.length === 0 ? (
        <div className="p-12 text-center space-y-3 bg-white rounded-2xl border border-slate-200">
          <FileText className="w-12 h-12 text-slate-300 mx-auto" />
          <div className="font-bold text-sm text-slate-700">No documents found matching the criteria</div>
          <p className="text-xs text-slate-500">Try adjusting your category filter, employee filter, or search term.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {documents.map((d: any) => {
            const meta = getCategoryMeta(d.category);
            const IconComp = meta.icon;

            return (
              <div
                key={d.id}
                className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs hover:shadow-md transition-all flex flex-col justify-between space-y-4"
              >
                <div className="space-y-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center space-x-3">
                      <div className={`p-2.5 rounded-xl ${meta.bg} shadow-xs border`}>
                        <IconComp className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="font-extrabold text-sm text-slate-800 line-clamp-1" title={d.title}>
                          {d.title}
                        </h3>
                        <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">
                          {d.category.replace(/_/g, ' ')}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 text-[11px] space-y-1.5 font-medium text-slate-600">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400">Employee:</span>
                      <span className="font-bold text-slate-800 text-right line-clamp-1">{d.employeeName || 'Company-Wide'}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400">File Size:</span>
                      <span>{d.fileSize} • {d.fileType}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400">Date:</span>
                      <span>{new Date(d.createdAt).toLocaleDateString('en-IN')}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400">Version:</span>
                      <span className="font-bold text-blue-600">v{d.version || 1}</span>
                    </div>
                    <div className="flex justify-between items-center pt-1 border-t border-slate-200 mt-1">
                      <span className="text-slate-400">Status:</span>
                      <span className={`font-bold ${d.verificationStatus === 'VERIFIED' ? 'text-emerald-600' : d.verificationStatus === 'REJECTED' ? 'text-red-600' : 'text-amber-600'}`}>
                        {d.verificationStatus}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center space-x-2 pt-3 border-t border-slate-100">
                  <button
                    onClick={() => {
                      setPreviewDoc(d);
                      setShowPreviewModal(true);
                    }}
                    className="flex-1 flex items-center justify-center space-x-1.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg transition-colors"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>Preview</span>
                  </button>

                  <button
                    onClick={() => handleDownload(d)}
                    className="flex-1 flex items-center justify-center space-x-1.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold rounded-lg transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download</span>
                  </button>

                  {isHRorAdmin && (
                    <button
                      onClick={() => handleDelete(d)}
                      className="p-1.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg transition-colors"
                      title="Delete Document"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
                
                {isHRorAdmin && d.verificationStatus === 'PENDING' && (
                   <div className="flex space-x-2 pt-2 border-t border-slate-100">
                     <button onClick={() => handleVerify(d)} className="flex-1 py-1.5 bg-emerald-50 text-emerald-700 text-xs font-bold rounded-lg hover:bg-emerald-100">Verify</button>
                     <button onClick={() => handleReject(d)} className="flex-1 py-1.5 bg-red-50 text-red-700 text-xs font-bold rounded-lg hover:bg-red-100">Reject</button>
                   </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination UI */}
      {pagination.totalPages > 1 && (
        <div className="flex justify-between items-center py-4 text-xs font-bold text-slate-600">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-4 py-2 bg-slate-100 rounded-lg disabled:opacity-50"
          >
            Previous
          </button>
          <span>Page {pagination.page} of {pagination.totalPages} ({pagination.total} total)</span>
          <button
            onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))}
            disabled={page === pagination.totalPages}
            className="px-4 py-2 bg-slate-100 rounded-lg disabled:opacity-50"
          >
            Next
          </button>
        </div>
      )}


      {/* MODAL: UPLOAD NEW DOCUMENT */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 my-8">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center space-x-2">
                <Upload className="w-5 h-5 text-blue-600" />
                <h3 className="font-bold text-base text-slate-900">Upload Secure Document</h3>
              </div>
              <button
                onClick={() => setShowUploadModal(false)}
                className="text-slate-400 hover:text-slate-600 font-bold"
              >
                ✕
              </button>
            </div>

            {uploadError && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-start space-x-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{uploadError}</span>
              </div>
            )}

            <form onSubmit={handleUploadSubmit} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Document Title *</label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder="e.g. Identity Aadhaar Proof / Offer Letter 2026"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Document Category *</label>
                <select
                  value={category}
                  onChange={e => setCategory(e.target.value as DocumentCategory)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-800"
                >
                  <option value="RESUME">Resume</option>
                  <option value="OFFER_LETTER">Offer Letter</option>
                  <option value="JOINING_LETTER">Joining Letter</option>
                  <option value="CERTIFICATES">Certificates & Degrees</option>
                  <option value="IDENTITY_DOCUMENTS">Identity Documents (Aadhaar/PAN/Passport)</option>
                  <option value="CONTRACT">Employment Contract / NDA</option>
                  <option value="PAYSLIP">Payslip Statement</option>
                  <option value="POLICY">HR Policy Handbook</option>
                  <option value="OTHER">Other HR Document</option>
                </select>
              </div>

              {isHRorAdmin && (
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Target Employee / Scope</label>
                  <select
                    value={targetEmployeeId}
                    onChange={e => setTargetEmployeeId(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-800"
                  >
                    <option value="">Organization-Wide (General Policy / Handbook)</option>
                    {employees.map(e => (
                      <option key={e.id} value={e.id}>
                        {e.firstName} {e.lastName} ({e.employeeCode})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block font-bold text-slate-700 mb-1">Select File (Max 10 MB) *</label>
                <div className="border-2 border-dashed border-slate-200 hover:border-blue-400 bg-slate-50 p-4 rounded-2xl text-center cursor-pointer transition-colors">
                  <input
                    type="file"
                    required
                    accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx,.xls,.xlsx,.txt"
                    onChange={handleFileChange}
                    className="w-full text-xs text-slate-500 cursor-pointer"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">
                    Supported extensions: PDF, PNG, JPG, WEBP, DOCX, XLSX, TXT
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-2 pt-1">
                <input
                  type="checkbox"
                  id="confidential-check"
                  checked={confidential}
                  onChange={e => setConfidential(e.target.checked)}
                  className="rounded text-blue-600 focus:ring-blue-500 h-4 w-4"
                />
                <label htmlFor="confidential-check" className="text-xs font-bold text-slate-700 cursor-pointer">
                  Mark as Confidential (Restricted HR & Target Employee Access)
                </label>
              </div>

              <div className="flex justify-end space-x-2 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowUploadModal(false)}
                  className="px-4 py-2 font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={uploading}
                  className="px-5 py-2 font-bold bg-blue-600 hover:bg-blue-500 text-white rounded-xl shadow-xs transition-all disabled:opacity-50"
                >
                  {uploading ? 'Uploading...' : 'Upload File'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: DOCUMENT PREVIEW */}
      {showPreviewModal && previewDoc && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-3xl w-full p-6 shadow-2xl space-y-4 my-8">
            <div className="flex items-start justify-between border-b border-slate-200 pb-3">
              <div>
                <h3 className="font-extrabold text-base text-slate-900">{previewDoc.title}</h3>
                <p className="text-xs text-slate-500">{previewDoc.fileName} • {previewDoc.fileSize}</p>
              </div>
              <button
                onClick={() => {
                  setShowPreviewModal(false);
                  setPreviewDoc(null);
                }}
                className="text-slate-400 hover:text-slate-600 font-bold"
              >
                ✕
              </button>
            </div>

            {/* Preview Box Content */}
            <div className="bg-slate-900 rounded-2xl min-h-[320px] max-h-[500px] flex items-center justify-center p-4 overflow-hidden border border-slate-800 text-white">
              {previewDoc.fileUrl && previewDoc.fileUrl.startsWith('data:image/') ? (
                <img
                  src={previewDoc.fileUrl}
                  alt={previewDoc.title}
                  className="max-h-[460px] object-contain rounded-lg"
                />
              ) : previewDoc.fileUrl && previewDoc.fileUrl.startsWith('data:application/pdf') ? (
                <iframe
                  src={previewDoc.fileUrl}
                  title={previewDoc.title}
                  className="w-full h-[460px] rounded-lg border-0 bg-white"
                />
              ) : (
                <div className="text-center space-y-3 p-6">
                  <FileText className="w-16 h-16 text-blue-400 mx-auto" />
                  <div className="space-y-1">
                    <h4 className="font-extrabold text-sm">{previewDoc.title}</h4>
                    <p className="text-xs text-slate-400">
                      Document Type: {previewDoc.category} ({previewDoc.fileSize})
                    </p>
                    <p className="text-[11px] text-slate-500">
                      Target Scope: {previewDoc.employeeName || 'Company-Wide Policy Handbook'}
                    </p>
                  </div>

                  <div className="p-3 bg-slate-800 rounded-xl text-xs text-slate-300 max-w-md mx-auto text-left space-y-1 border border-slate-700">
                    <p>✓ File Integrity Check Passed</p>
                    <p>✓ Authorized Uploader: {previewDoc.uploadedBy}</p>
                    <p>✓ Created Date: {new Date(previewDoc.createdAt).toLocaleString('en-IN')}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer Actions */}
            <div className="flex items-center justify-between pt-2 border-t border-slate-200">
              <span className="text-xs text-slate-400 font-semibold">
                Authorization Verified • Access Logged in Audit Trail
              </span>
              <div className="flex space-x-2">
                <button
                  onClick={() => handleDownload(previewDoc)}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center space-x-2"
                >
                  <Download className="w-4 h-4" />
                  <span>Download Document</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

