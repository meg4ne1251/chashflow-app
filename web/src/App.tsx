import { Routes, Route, Navigate } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import { CircularProgress, Box } from '@mui/material';
import ProtectedRoute from '@/components/ProtectedRoute';
import AppLayout from '@/components/AppLayout';

// Lazy-loaded pages
const LoginPage = lazy(() => import('@/pages/Login/LoginPage'));
const SetupPage = lazy(() => import('@/pages/Login/SetupPage'));
const DashboardPage = lazy(() => import('@/pages/Dashboard/DashboardPage'));
const TransactionListPage = lazy(() => import('@/pages/Transactions/TransactionListPage'));
const TransactionFormPage = lazy(() => import('@/pages/Transactions/TransactionFormPage'));
const TransferListPage = lazy(() => import('@/pages/Transfers/TransferListPage'));
const CategoryListPage = lazy(() => import('@/pages/Categories/CategoryListPage'));
const AccountListPage = lazy(() => import('@/pages/Accounts/AccountListPage'));
const TagListPage = lazy(() => import('@/pages/Tags/TagListPage'));
const TemplateListPage = lazy(() => import('@/pages/Templates/TemplateListPage'));
const RecurringTransactionListPage = lazy(() => import('@/pages/RecurringTransactions/RecurringTransactionListPage'));
const AnalysisPage = lazy(() => import('@/pages/Analysis/AnalysisPage'));
const BudgetPage = lazy(() => import('@/pages/Budgets/BudgetPage'));
const SettingsPage = lazy(() => import('@/pages/Settings/SettingsPage'));
const NotificationHistoryPage = lazy(() => import('@/pages/Notifications/NotificationHistoryPage'));
const MoreMenuPage = lazy(() => import('@/pages/More/MoreMenuPage'));

function PageLoader() {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
      <CircularProgress />
    </Box>
  );
}

export default function App() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        {/* Public routes */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/setup" element={<SetupPage />} />

        {/* Protected routes with app layout */}
        <Route element={<ProtectedRoute />}>
          <Route element={<AppLayout />}>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<DashboardPage />} />

            {/* Transactions */}
            <Route path="/transactions" element={<TransactionListPage />} />
            <Route path="/transactions/new" element={<TransactionFormPage />} />
            <Route path="/transactions/:id/edit" element={<TransactionFormPage />} />

            {/* Transfers */}
            <Route path="/transfers" element={<TransferListPage />} />

            {/* Master management */}
            <Route path="/categories" element={<CategoryListPage />} />
            <Route path="/accounts" element={<AccountListPage />} />
            <Route path="/tags" element={<TagListPage />} />
            <Route path="/templates" element={<TemplateListPage />} />
            <Route path="/recurring" element={<RecurringTransactionListPage />} />

            {/* Analytics & Budgets */}
            <Route path="/analysis" element={<AnalysisPage />} />
            <Route path="/budgets" element={<BudgetPage />} />

            {/* Notifications */}
            <Route path="/notifications" element={<NotificationHistoryPage />} />

            {/* Settings */}
            <Route path="/settings" element={<SettingsPage />} />

            {/* Mobile more menu */}
            <Route path="/more" element={<MoreMenuPage />} />
          </Route>
        </Route>

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </Suspense>
  );
}
