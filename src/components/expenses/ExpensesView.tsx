import React, { useEffect, useState } from 'react';
import {
  Receipt,
  Plus,
  CheckCircle2,
  XCircle,
  FileText,
  DollarSign,
  Check,
  CreditCard,
  Upload,
  Eye,
  Trash2,
  Edit,
  AlertCircle,
  Clock,
  Send,
  X,
  Search,
  Filter,
  FileCheck
} from 'lucide-react';
import { hrmsApi, getStoredToken } from '../../lib/api-client';
import { Expense, ExpenseCategory } from '../../types/hrms';

interface ExpensesViewProps {
  userRole: string;
}

export const ExpensesView: React.FC<ExpensesViewProps> = ({ userRole }) => {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'ALL' | 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED' | 'REIMBURSED'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals
  const [showClaimModal, setShowClaimModal] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [rejectionModalExp, setRejectionModalExp] = useState<Expense | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [viewingReceipt, setViewingReceipt] = useState<{ url: string; title: string; mimeType?: string } | null>(null);
  const [receiptBlobUrl, setReceiptBlobUrl] = useState<string | null>(null);

  // Claim Form State
  const [categoryId, setCategoryId] = useState('');
  const [amount, setAmount] = useState<number | ''>('');
  const [expenseDate, setExpenseDate] = useState(new Date().toISOString().split('T')[0]);
  const [description, setDescription] = useState('');
  const [receiptFile, setReceiptFile] = useState<{ name: string; mimeType: string; base64: string; sizeBytes: number } | null>(null);
  const [uploadingReceipt, setUploadingReceipt] = useState(false);
  const [uploadedReceiptInfo, setUploadedReceiptInfo] = useState<{ id: string; url: string; name: string } | null>(null);
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Category Form State
  const [catName, setCatName] = useState('');
  const [catCode, setCatCode] = useState('');
  const [catMaxLimit, setCatMaxLimit] = useState<number | ''>('');
  const [catRequiresReceipt, setCatRequiresReceipt] = useState(true);

  const isManagerOrAdmin = ['SUPER_ADMIN', 'ADMIN', 'HR_MANAGER', 'MANAGER'].includes(userRole);
  const isFinanceOrHR = ['SUPER_ADMIN', 'ADMIN', 'HR_MANAGER'].includes(userRole);

  useEffect(() => {
    loadExpenseData();
  }, []);

  const loadExpenseData = async () => {
    try {
      setLoading(true);
      const [expRes, catRes] = await Promise.all([
        hrmsApi.getExpenses(),
        hrmsApi.getExpenseCategories()
      ]);
      setExpenses(expRes);
      setCategories(catRes);
      if (catRes.length > 0 && !categoryId) {
        setCategoryId(catRes[0].id);
      }
    } catch (err: any) {
      console.error('Failed to load expense data:', err);
    } finally {
      setLoading(false);
    }
  };

  const openNewClaimModal = () => {
    setEditingExpense(null);
    setCategoryId(categories.length > 0 ? categories[0].id : '');
    setAmount('');
    setExpenseDate(new Date().toISOString().split('T')[0]);
    setDescription('');
    setReceiptFile(null);
    setUploadedReceiptInfo(null);
    setFormError('');
    setShowClaimModal(true);
  };

  const openEditClaimModal = (exp: Expense) => {
    setEditingExpense(exp);
    setCategoryId(exp.categoryId);
    setAmount(exp.amount);
    setExpenseDate(exp.expenseDate);
    setDescription(exp.description);
    setReceiptFile(null);
    if (exp.receiptUrl) {
      setUploadedReceiptInfo({
        id: exp.receiptId || '',
        url: exp.receiptUrl,
        name: exp.receiptName || 'Attached Receipt'
      });
    } else {
      setUploadedReceiptInfo(null);
    }
    setFormError('');
    setShowClaimModal(true);
  };

  const handleReceiptFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFormError('');
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    if (!allowedTypes.includes(file.type)) {
      setFormError('Invalid file format. Only JPEG, PNG, WEBP images and PDF files are allowed.');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setFormError('File size exceeds the 5MB maximum limit.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(',')[1];
      setReceiptFile({
        name: file.name,
        mimeType: file.type,
        base64,
        sizeBytes: file.size
      });
      setUploadedReceiptInfo(null);
    };
    reader.readAsDataURL(file);
  };

  const handleSaveExpense = async (targetStatus: 'DRAFT' | 'SUBMITTED') => {
    setFormError('');
    if (!categoryId) {
      setFormError('Please select an expense category.');
      return;
    }
    if (!amount || Number(amount) <= 0) {
      setFormError('Please enter a valid expense amount in ₹ INR.');
      return;
    }
    if (!expenseDate) {
      setFormError('Please select the date on which expense occurred.');
      return;
    }
    if (!description.trim()) {
      setFormError('Please provide a business justification or description.');
      return;
    }

    const selectedCategory = categories.find(c => c.id === categoryId);

    // If submitting, check receipt requirement
    let finalReceiptUrl = uploadedReceiptInfo?.url;
    let finalReceiptName = uploadedReceiptInfo?.name;
    let finalReceiptId = uploadedReceiptInfo?.id;

    try {
      setSubmitting(true);

      // Upload receipt file if newly selected
      if (receiptFile) {
        setUploadingReceipt(true);
        const uploaded = await hrmsApi.uploadReceipt(
          receiptFile.name,
          receiptFile.mimeType,
          receiptFile.base64
        );
        finalReceiptUrl = uploaded.receiptUrl;
        finalReceiptName = uploaded.fileName;
        finalReceiptId = uploaded.receiptId;
        setUploadingReceipt(false);
      }

      if (targetStatus === 'SUBMITTED' && selectedCategory?.requiresReceipt && !finalReceiptUrl && !finalReceiptId) {
        setFormError(`Receipt upload is required for category '${selectedCategory.name}'.`);
        setSubmitting(false);
        return;
      }

      const payload = {
        categoryId,
        amount: Number(amount),
        expenseDate,
        description: description.trim(),
        receiptUrl: finalReceiptUrl,
        receiptName: finalReceiptName,
        receiptId: finalReceiptId,
        status: targetStatus
      };

      if (editingExpense) {
        await hrmsApi.updateExpense(editingExpense.id, payload);
      } else {
        await hrmsApi.createExpense(payload);
      }

      setShowClaimModal(false);
      loadExpenseData();
    } catch (err: any) {
      setFormError(err.message || 'Failed to process expense claim.');
    } finally {
      setSubmitting(false);
      setUploadingReceipt(false);
    }
  };

  const handleSubmitDraft = async (id: string) => {
    try {
      await hrmsApi.submitDraftExpense(id);
      loadExpenseData();
    } catch (err: any) {
      alert(err.message || 'Failed to submit draft expense');
    }
  };

  const handleDeleteExpense = async (id: string) => {
    if (!confirm('Are you sure you want to delete this expense claim draft?')) return;
    try {
      await hrmsApi.deleteExpense(id);
      loadExpenseData();
    } catch (err: any) {
      alert(err.message || 'Failed to delete expense claim');
    }
  };

  const handleApprove = async (id: string) => {
    try {
      await hrmsApi.approveExpense(id);
      loadExpenseData();
    } catch (err: any) {
      alert(err.message || 'Failed to approve expense claim');
    }
  };

  const handleOpenRejectModal = (exp: Expense) => {
    setRejectionModalExp(exp);
    setRejectionReason('');
  };

  const handleConfirmReject = async () => {
    if (!rejectionModalExp) return;
    if (!rejectionReason.trim()) {
      alert('Please provide a reason for rejecting the expense claim.');
      return;
    }

    try {
      await hrmsApi.rejectExpense(rejectionModalExp.id, rejectionReason.trim());
      setRejectionModalExp(null);
      loadExpenseData();
    } catch (err: any) {
      alert(err.message || 'Failed to reject expense claim');
    }
  };

  const handleReimburse = async (id: string) => {
    try {
      await hrmsApi.reimburseExpense(id);
      loadExpenseData();
    } catch (err: any) {
      alert(err.message || 'Failed to mark expense claim as reimbursed');
    }
  };

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!catName.trim() || !catCode.trim()) return;
    try {
      await hrmsApi.createExpenseCategory({
        name: catName.trim(),
        code: catCode.trim(),
        maxLimit: catMaxLimit ? Number(catMaxLimit) : undefined,
        requiresReceipt: catRequiresReceipt
      });
      setShowCategoryModal(false);
      setCatName('');
      setCatCode('');
      setCatMaxLimit('');
      loadExpenseData();
    } catch (err: any) {
      alert(err.message || 'Failed to create expense category');
    }
  };

  const handleViewReceipt = async (receiptUrl: string, title: string) => {
    try {
      const token = getStoredToken();
      const res = await fetch(receiptUrl, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!res.ok) {
        alert('Unable to load receipt file. You may not have authorization.');
        return;
      }

      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      if (receiptBlobUrl) {
        URL.revokeObjectURL(receiptBlobUrl);
      }
      setReceiptBlobUrl(objectUrl);
      setViewingReceipt({ url: objectUrl, title, mimeType: blob.type });
    } catch (err: any) {
      alert('Error viewing receipt: ' + err.message);
    }
  };

  const closeReceiptModal = () => {
    if (receiptBlobUrl) {
      URL.revokeObjectURL(receiptBlobUrl);
      setReceiptBlobUrl(null);
    }
    setViewingReceipt(null);
  };

  // Filter logic
  const filteredExpenses = expenses.filter(exp => {
    if (activeTab !== 'ALL' && exp.status !== activeTab) {
      return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchEmp = exp.employeeName?.toLowerCase().includes(q);
      const matchDesc = exp.description?.toLowerCase().includes(q);
      const matchCat = exp.categoryName?.toLowerCase().includes(q);
      const matchAmt = exp.amount.toString().includes(q);
      return matchEmp || matchDesc || matchCat || matchAmt;
    }
    return true;
  });

  // Analytics Stats
  const totalAmount = expenses.reduce((acc, e) => acc + e.amount, 0);
  const pendingAmount = expenses.filter(e => e.status === 'SUBMITTED').reduce((acc, e) => acc + e.amount, 0);
  const approvedAmount = expenses.filter(e => e.status === 'APPROVED').reduce((acc, e) => acc + e.amount, 0);
  const reimbursedAmount = expenses.filter(e => e.status === 'REIMBURSED').reduce((acc, e) => acc + e.amount, 0);

  return (
    <div id="expenses-view-root" className="space-y-6 pb-12">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <Receipt className="w-6 h-6 text-blue-600" />
            <span>Expense Claims & Reimbursements</span>
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Submit, track, and manage official business expense claims and receipts
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {isFinanceOrHR && (
            <button
              id="btn-add-category"
              onClick={() => setShowCategoryModal(true)}
              className="px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>Add Category</span>
            </button>
          )}

          <button
            id="btn-new-expense-claim"
            onClick={openNewClaimModal}
            className="bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-xs transition-all flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            <span>New Expense Claim</span>
          </button>
        </div>
      </div>

      {/* Analytics Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Total Claims Value</span>
            <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <p className="text-xl font-black text-slate-900 mt-2">₹ {totalAmount.toLocaleString('en-IN')}</p>
          <span className="text-[11px] text-slate-400 mt-0.5 block">{expenses.length} claims submitted</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-amber-200/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-amber-700">Pending Manager Review</span>
            <div className="p-2 bg-amber-50 text-amber-600 rounded-xl">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <p className="text-xl font-black text-amber-900 mt-2">₹ {pendingAmount.toLocaleString('en-IN')}</p>
          <span className="text-[11px] text-amber-600 mt-0.5 block">
            {expenses.filter(e => e.status === 'SUBMITTED').length} awaiting approval
          </span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-emerald-200/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-emerald-700">Approved (Ready for Payout)</span>
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <p className="text-xl font-black text-emerald-900 mt-2">₹ {approvedAmount.toLocaleString('en-IN')}</p>
          <span className="text-[11px] text-emerald-600 mt-0.5 block">
            {expenses.filter(e => e.status === 'APPROVED').length} approved claims
          </span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-purple-200/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-purple-700">Total Reimbursed</span>
            <div className="p-2 bg-purple-50 text-purple-600 rounded-xl">
              <CreditCard className="w-4 h-4" />
            </div>
          </div>
          <p className="text-xl font-black text-purple-900 mt-2">₹ {reimbursedAmount.toLocaleString('en-IN')}</p>
          <span className="text-[11px] text-purple-600 mt-0.5 block">
            {expenses.filter(e => e.status === 'REIMBURSED').length} claims settled
          </span>
        </div>
      </div>

      {/* Main Expense Table Section */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {/* Controls Header */}
        <div className="p-4 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Status Tabs */}
          <div className="flex items-center gap-1 overflow-x-auto pb-1 md:pb-0">
            {(['ALL', 'DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'REIMBURSED'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                  activeTab === tab
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                {tab === 'ALL' ? 'All Claims' : tab}
              </button>
            ))}
          </div>

          {/* Search Box */}
          <div className="relative min-w-[220px]">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              placeholder="Search expenses..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500/20"
            />
          </div>
        </div>

        {/* Expenses List */}
        {loading ? (
          <div className="p-12 text-center text-xs text-slate-500 font-medium">Loading expense claims data...</div>
        ) : filteredExpenses.length === 0 ? (
          <div className="p-12 text-center text-xs text-slate-400">
            No expense claims found matching the current tab and filter criteria.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase text-[10px] tracking-wider font-bold">
                <tr>
                  <th className="px-4 py-3">Employee</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3">Description</th>
                  <th className="px-4 py-3">Amount</th>
                  <th className="px-4 py-3">Receipt</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredExpenses.map(e => (
                  <tr key={e.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-4 py-3 font-bold text-slate-900">
                      <div>{e.employeeName || 'You'}</div>
                      <span className="text-[10px] text-slate-400 font-normal">{e.employeeCode || ''}</span>
                    </td>

                    <td className="px-4 py-3 text-slate-600 font-semibold">{e.expenseDate}</td>

                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 bg-slate-100 text-slate-700 font-semibold rounded text-[10px]">
                        {e.categoryName || 'General'}
                      </span>
                    </td>

                    <td className="px-4 py-3 text-slate-700 max-w-xs">
                      <div className="truncate font-medium">{e.description}</div>
                      {e.rejectionReason && (
                        <div className="text-[10px] text-red-600 mt-0.5 flex items-center gap-1 font-semibold">
                          <AlertCircle className="w-3 h-3 shrink-0" />
                          <span>Rejection: {e.rejectionReason}</span>
                        </div>
                      )}
                    </td>

                    <td className="px-4 py-3 font-black text-slate-900">
                      ₹ {e.amount.toLocaleString('en-IN')}
                    </td>

                    <td className="px-4 py-3">
                      {e.receiptUrl ? (
                        <button
                          onClick={() => handleViewReceipt(e.receiptUrl!, e.receiptName || 'Receipt')}
                          className="px-2.5 py-1 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg text-[10px] font-bold inline-flex items-center gap-1 transition-colors"
                        >
                          <Eye className="w-3 h-3" />
                          <span>View Receipt</span>
                        </button>
                      ) : (
                        <span className="text-slate-400 text-[10px] italic">No Receipt</span>
                      )}
                    </td>

                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider inline-flex items-center gap-1 ${
                        e.status === 'REIMBURSED' ? 'bg-purple-100 text-purple-800' :
                        e.status === 'APPROVED' ? 'bg-emerald-100 text-emerald-800' :
                        e.status === 'REJECTED' ? 'bg-red-100 text-red-800' :
                        e.status === 'SUBMITTED' ? 'bg-amber-100 text-amber-800' :
                        'bg-slate-100 text-slate-600'
                      }`}>
                        {e.status}
                      </span>
                    </td>

                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {/* Draft actions */}
                        {e.status === 'DRAFT' && (
                          <>
                            <button
                              onClick={() => openEditClaimModal(e)}
                              className="p-1.5 text-slate-600 hover:text-blue-600 hover:bg-slate-100 rounded-lg transition-colors"
                              title="Edit Draft"
                            >
                              <Edit className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleSubmitDraft(e.id)}
                              className="px-2 py-1 bg-amber-500 hover:bg-amber-600 text-white font-bold text-[10px] rounded-lg transition-colors flex items-center gap-1"
                              title="Submit for Approval"
                            >
                              <Send className="w-3 h-3" />
                              <span>Submit</span>
                            </button>
                            <button
                              onClick={() => handleDeleteExpense(e.id)}
                              className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              title="Delete Draft"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}

                        {/* Manager / Admin review actions */}
                        {e.status === 'SUBMITTED' && isManagerOrAdmin && (
                          <>
                            <button
                              onClick={() => handleApprove(e.id)}
                              className="px-2 py-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[10px] rounded-lg shadow-2xs transition-colors flex items-center gap-1"
                              title="Approve Claim"
                            >
                              <Check className="w-3 h-3" />
                              <span>Approve</span>
                            </button>
                            <button
                              onClick={() => handleOpenRejectModal(e)}
                              className="px-2 py-1 bg-red-100 hover:bg-red-200 text-red-700 font-bold text-[10px] rounded-lg transition-colors flex items-center gap-1"
                              title="Reject Claim"
                            >
                              <X className="w-3 h-3" />
                              <span>Reject</span>
                            </button>
                          </>
                        )}

                        {/* Finance Reimbursement action */}
                        {e.status === 'APPROVED' && isFinanceOrHR && (
                          <button
                            onClick={() => handleReimburse(e.id)}
                            className="px-2.5 py-1 bg-purple-600 hover:bg-purple-500 text-white font-bold text-[10px] rounded-lg shadow-2xs transition-colors flex items-center gap-1"
                            title="Mark as Reimbursed"
                          >
                            <CreditCard className="w-3 h-3" />
                            <span>Mark Reimbursed</span>
                          </button>
                        )}

                        {/* Rejected edit action */}
                        {e.status === 'REJECTED' && (
                          <button
                            onClick={() => openEditClaimModal(e)}
                            className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-[10px] rounded-lg transition-colors flex items-center gap-1"
                          >
                            <Edit className="w-3 h-3" />
                            <span>Edit & Resubmit</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Claim Submission / Editing Modal */}
      {showClaimModal && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 my-8">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
                <Receipt className="w-5 h-5 text-blue-600" />
                <span>{editingExpense ? 'Edit Expense Claim' : 'Submit New Expense Claim'}</span>
              </h3>
              <button
                onClick={() => setShowClaimModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-center gap-2 font-medium">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <div className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Expense Category *</label>
                <select
                  value={categoryId}
                  onChange={e => setCategoryId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 font-medium text-slate-800"
                >
                  {categories.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.maxLimit ? `(Limit: ₹${c.maxLimit.toLocaleString('en-IN')})` : ''} {c.requiresReceipt ? '• Receipt Required' : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Amount (₹ INR) *</label>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    required
                    placeholder="e.g. 2500"
                    value={amount}
                    onChange={e => setAmount(e.target.value ? Number(e.target.value) : '')}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 font-bold text-slate-900"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Expense Date *</label>
                  <input
                    type="date"
                    required
                    value={expenseDate}
                    onChange={e => setExpenseDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 font-medium text-slate-800"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Description / Business Purpose *</label>
                <textarea
                  rows={3}
                  required
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="Describe the business rationale, client details, or project purpose..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 text-xs font-medium text-slate-800"
                ></textarea>
              </div>

              {/* Secure Receipt Upload Component */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Receipt Upload {categories.find(c => c.id === categoryId)?.requiresReceipt ? '(Required)' : '(Optional)'}
                </label>

                <div className="border-2 border-dashed border-slate-200 hover:border-blue-400 rounded-2xl p-4 text-center transition-colors bg-slate-50/50">
                  <input
                    type="file"
                    id="receipt-file-input"
                    accept="image/jpeg,image/png,image/webp,application/pdf"
                    onChange={handleReceiptFileChange}
                    className="hidden"
                  />
                  <label htmlFor="receipt-file-input" className="cursor-pointer block">
                    <Upload className="w-6 h-6 text-slate-400 mx-auto mb-2" />
                    <span className="text-xs font-bold text-blue-600 hover:underline">Click to upload receipt file</span>
                    <span className="text-[10px] text-slate-400 block mt-0.5">JPEG, PNG, WEBP, or PDF (Max 5MB)</span>
                  </label>
                </div>

                {receiptFile && (
                  <div className="mt-2 p-2.5 bg-blue-50 border border-blue-200 rounded-xl flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2 overflow-hidden">
                      <FileCheck className="w-4 h-4 text-blue-600 shrink-0" />
                      <span className="font-semibold text-blue-900 truncate">{receiptFile.name}</span>
                      <span className="text-[10px] text-blue-600 font-normal">({(receiptFile.sizeBytes / 1024).toFixed(1)} KB)</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setReceiptFile(null)}
                      className="text-blue-500 hover:text-red-600 p-1"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}

                {uploadedReceiptInfo && !receiptFile && (
                  <div className="mt-2 p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <span className="font-semibold text-emerald-900">{uploadedReceiptInfo.name}</span>
                    </div>
                    <span className="text-[10px] text-emerald-700 font-bold">Attached</span>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowClaimModal(false)}
                  className="px-4 py-2 font-semibold text-slate-600 hover:text-slate-900 rounded-xl"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  disabled={submitting || uploadingReceipt}
                  onClick={() => handleSaveExpense('DRAFT')}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-colors disabled:opacity-50"
                >
                  Save Draft
                </button>

                <button
                  type="button"
                  disabled={submitting || uploadingReceipt}
                  onClick={() => handleSaveExpense('SUBMITTED')}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl shadow-xs transition-colors flex items-center gap-1.5 disabled:opacity-50"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Submit Claim</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Category Creation Modal (HR / Admin) */}
      {showCategoryModal && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="font-bold text-base text-slate-900">Add Expense Category</h3>
              <button onClick={() => setShowCategoryModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateCategory} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Category Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Internet & Wifi Allowance"
                  value={catName}
                  onChange={e => setCatName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Category Code *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. INTERNET"
                  value={catCode}
                  onChange={e => setCatCode(e.target.value.toUpperCase())}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono uppercase"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Max Monthly Limit (₹ INR) (Optional)</label>
                <input
                  type="number"
                  placeholder="e.g. 5000"
                  value={catMaxLimit}
                  onChange={e => setCatMaxLimit(e.target.value ? Number(e.target.value) : '')}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="catRequiresReceipt"
                  checked={catRequiresReceipt}
                  onChange={e => setCatRequiresReceipt(e.target.checked)}
                  className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="catRequiresReceipt" className="font-bold text-slate-700 cursor-pointer">
                  Require receipt upload for claims in this category
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowCategoryModal(false)}
                  className="px-4 py-2 font-semibold text-slate-600 hover:text-slate-900"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 font-bold bg-blue-600 hover:bg-blue-500 text-white rounded-xl"
                >
                  Create Category
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Rejection Reason Dialog */}
      {rejectionModalExp && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <h3 className="font-bold text-base text-slate-900 border-b border-slate-200 pb-3 flex items-center gap-2">
              <XCircle className="w-5 h-5 text-red-600" />
              <span>Reject Expense Claim</span>
            </h3>

            <p className="text-xs text-slate-600">
              Please state the justification or reason for rejecting the expense claim of ₹{rejectionModalExp.amount.toLocaleString('en-IN')}:
            </p>

            <textarea
              rows={3}
              required
              value={rejectionReason}
              onChange={e => setRejectionReason(e.target.value)}
              placeholder="e.g. Missing detailed receipt invoice or expense outside policy limits..."
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-red-500/20 font-medium"
            ></textarea>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-200 text-xs">
              <button
                onClick={() => setRejectionModalExp(null)}
                className="px-4 py-2 font-semibold text-slate-600 hover:text-slate-900"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmReject}
                className="px-5 py-2 font-bold bg-red-600 hover:bg-red-500 text-white rounded-xl shadow-xs"
              >
                Confirm Rejection
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Secure Receipt Preview Viewer Modal */}
      {viewingReceipt && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-4 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="font-bold text-base text-slate-900 truncate pr-4">{viewingReceipt.title}</h3>
              <button onClick={closeReceiptModal} className="text-slate-400 hover:text-slate-600 p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 bg-slate-100 rounded-xl overflow-hidden min-h-[350px] flex items-center justify-center">
              {viewingReceipt.mimeType?.includes('pdf') ? (
                <iframe
                  src={viewingReceipt.url}
                  className="w-full h-[450px] border-none"
                  title="Receipt PDF Preview"
                />
              ) : (
                <img
                  src={viewingReceipt.url}
                  alt="Receipt Document"
                  className="max-h-[450px] max-w-full object-contain mx-auto"
                />
              )}
            </div>

            <div className="flex justify-end">
              <button
                onClick={closeReceiptModal}
                className="px-5 py-2 font-bold bg-slate-900 hover:bg-slate-800 text-white text-xs rounded-xl"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
