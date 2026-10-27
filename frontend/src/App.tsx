import { lazy, Suspense, type ReactNode } from "react";
import { Navigate, Outlet, Route, Routes } from "react-router-dom";
import { isPlatformAdmin, readSession } from "./api";
import { Layout } from "./Layout";
import { OperationsPage } from "./OperationsPage";
import { LoginPage } from "./LoginPage";
import {
  AcceptInvitationPage,
  ForgotPasswordPage,
  RegistrationPage,
  ResetPasswordPage,
  VerifyEmailPage,
} from "./RegistrationPages";
import {
  AccountDetailPage,
  AccountsPage,
  AdminIntegrationsPage,
  IntegrationDiagnosticsPage,
  MetaConnectPage,
  TemplateDetailPage,
  TemplateEditorPage,
} from "./PhaseTwoPages";
import {
  DashboardPage,
  IntegrationsPage,
  NotFoundPage,
  SettingsPage,
  TemplatesPage,
  WorkspacePage,
} from "./pages";
import {
  AdminCustomerDetailPage,
  AdminCustomersPage,
  AdminOverviewPage,
} from "./AdminPages";
import {
  ApiKeysPage,
  ApiPlaygroundPage,
  ApiUsagePage,
  DeveloperDocumentationPage,
  DeveloperOverviewPage,
  RequestLogsPage,
  SandboxSdkPage,
  WebhookManagementPage,
  AdminApiPlatformPage,
} from "./DeveloperPages";
import {
  AdminInboxHealthPage,
  InboxAnalyticsPage,
  InboxConfigurationPage,
  InboxSettingsPage,
  SharedInboxPage,
  TeamInboxPage,
} from "./InboxPages";
import {
  AdminAutomationsPage,
  AutomationAnalyticsPage,
  AutomationDashboardPage,
  ChatbotRulesPage,
  ExecutionDetailPage,
  WorkflowBuilderPage,
  WorkflowExecutionsPage,
  WorkflowListPage,
  WorkflowSimulatorPage,
} from "./AutomationPages";
const loadEnterprisePage = <T extends keyof typeof import("./EnterprisePages")>(
  name: T,
) =>
  lazy(() =>
    import("./EnterprisePages").then((module) => ({ default: module[name] })),
  );
const loadPhaseThreePage = <T extends keyof typeof import("./PhaseThreePages")>(
  name: T,
) =>
  lazy(() =>
    import("./PhaseThreePages").then((module) => ({ default: module[name] })),
  );
const AudiencePage = loadPhaseThreePage("AudiencePage");
const BulkMessagePage = loadPhaseThreePage("BulkMessagePage");
const CampaignBuilderPage = loadPhaseThreePage("CampaignBuilderPage");
const CampaignDetailPage = loadPhaseThreePage("CampaignDetailPage");
const CampaignManagerPage = loadPhaseThreePage("CampaignManagerPage");
const ContactDetailPage = loadPhaseThreePage("ContactDetailPage");
const ContactDirectoryPage = loadPhaseThreePage("ContactDirectoryPage");
const ImportDetailPage = loadPhaseThreePage("ImportDetailPage");
const MessageCenterPage = loadPhaseThreePage("MessageCenterPage");
const MessageDetailPage = loadPhaseThreePage("MessageDetailPage");

const loadPhaseFourPage = <T extends keyof typeof import("./PhaseFourPages")>(
  name: T,
) =>
  lazy(() =>
    import("./PhaseFourPages").then((module) => ({ default: module[name] })),
  );
const AdminBillingPage = loadPhaseFourPage("AdminBillingPage");
const AnalyticsDashboardPage = loadPhaseFourPage("AnalyticsDashboardPage");
const BillingHubPage = loadPhaseFourPage("BillingHubPage");
const CampaignAnalyticsDetailPage = loadPhaseFourPage(
  "CampaignAnalyticsDetailPage",
);
const InvoiceDetailPage = loadPhaseFourPage("InvoiceDetailPage");
const ReportCenterPage = loadPhaseFourPage("ReportCenterPage");
const UsageDashboardPage = loadPhaseFourPage("UsageDashboardPage");
const BillingReturnPage = loadPhaseFourPage("BillingReturnPage");
const AdminPlatformHealthPage = loadEnterprisePage("AdminPlatformHealthPage");
const AdminPrivacyOperationsPage = loadEnterprisePage(
  "AdminPrivacyOperationsPage",
);
const AdminRecoveryPage = loadEnterprisePage("AdminRecoveryPage");
const AdminSecurityIncidentsPage = loadEnterprisePage(
  "AdminSecurityIncidentsPage",
);
const EnterpriseOrganizationPage = loadEnterprisePage(
  "EnterpriseOrganizationPage",
);
const EnterpriseSecurityPage = loadEnterprisePage("EnterpriseSecurityPage");
const EnterpriseSsoPage = loadEnterprisePage("EnterpriseSsoPage");
const PrivacyRequestsPage = loadEnterprisePage("PrivacyRequestsPage");
const RetentionSettingsPage = loadEnterprisePage("RetentionSettingsPage");

function ProtectedLayout() {
  return readSession() ? <Layout /> : <Navigate to="/login" replace />;
}

function PlatformAdminOnly({ children }: { children: ReactNode }) {
  return isPlatformAdmin(readSession()) ? (
    children
  ) : (
    <Navigate to="/" replace />
  );
}

function PlatformAdminOutlet() {
  return (
    <PlatformAdminOnly>
      <Outlet />
    </PlatformAdminOnly>
  );
}

function HomePage() {
  return readSession()?.mode === "PLATFORM_ADMIN" ? (
    <AdminOverviewPage />
  ) : (
    <DashboardPage />
  );
}

export default function App() {
  return (
    <Suspense fallback={<div className="state">Loading…</div>}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/admin/login" element={<LoginPage admin />} />
        <Route path="/register" element={<RegistrationPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/verify-email" element={<VerifyEmailPage />} />
        <Route path="/accept-invitation" element={<AcceptInvitationPage />} />
        <Route
          path="/connect"
          element={
            <Navigate
              to={readSession() ? "/integrations/connect" : "/login"}
              replace
            />
          }
        />
        <Route element={<ProtectedLayout />}>
          <Route index element={<HomePage />} />
          <Route path="contacts" element={<ContactDirectoryPage />} />
          <Route path="contacts/audiences" element={<AudiencePage />} />
          <Route path="contacts/imports/:id" element={<ImportDetailPage />} />
          <Route path="contacts/:id" element={<ContactDetailPage />} />
          <Route path="messages" element={<MessageCenterPage />} />
          <Route path="messages/bulk" element={<BulkMessagePage />} />
          <Route path="messages/:id" element={<MessageDetailPage />} />
          <Route path="inbox" element={<SharedInboxPage />} />
          <Route path="inbox/:id" element={<SharedInboxPage />} />
          <Route path="inbox/team" element={<TeamInboxPage />} />
          <Route path="inbox/tools" element={<InboxConfigurationPage />} />
          <Route path="inbox/analytics" element={<InboxAnalyticsPage />} />
          <Route path="inbox/settings" element={<InboxSettingsPage />} />
          <Route path="campaigns" element={<CampaignManagerPage />} />
          <Route path="campaigns/new" element={<CampaignBuilderPage />} />
          <Route path="campaigns/:id" element={<CampaignDetailPage />} />
          <Route path="integrations" element={<IntegrationsPage />} />
          <Route path="integrations/connect" element={<MetaConnectPage />} />
          <Route
            path="integrations/diagnostics"
            element={<IntegrationDiagnosticsPage />}
          />
          <Route path="accounts" element={<AccountsPage />} />
          <Route path="accounts/:id" element={<AccountDetailPage />} />
          <Route path="templates" element={<TemplatesPage />} />
          <Route path="templates/new" element={<TemplateEditorPage />} />
          <Route path="templates/:id" element={<TemplateDetailPage />} />
          <Route path="templates/:id/edit" element={<TemplateEditorPage />} />
          <Route path="analytics" element={<AnalyticsDashboardPage />} />
          <Route
            path="analytics/campaigns/:id"
            element={<CampaignAnalyticsDetailPage />}
          />
          <Route path="reports" element={<ReportCenterPage />} />
          <Route path="billing" element={<BillingHubPage />} />
          <Route path="billing/success" element={<BillingReturnPage />} />
          <Route
            path="billing/cancel"
            element={<BillingReturnPage cancelled />}
          />
          <Route path="billing/invoices/:id" element={<InvoiceDetailPage />} />
          <Route path="usage" element={<UsageDashboardPage />} />
          <Route element={<PlatformAdminOutlet />}>
            <Route
              path="admin/integrations"
              element={<AdminIntegrationsPage />}
            />
            <Route path="admin/billing" element={<AdminBillingPage />} />
            <Route path="admin/customers" element={<AdminCustomersPage />} />
            <Route
              path="admin/customers/:id"
              element={<AdminCustomerDetailPage />}
            />
            <Route path="admin/api" element={<AdminApiPlatformPage />} />
            <Route path="admin/inbox" element={<AdminInboxHealthPage />} />
            <Route
              path="admin/automations"
              element={<AdminAutomationsPage />}
            />
            <Route
              path="admin/platform"
              element={<AdminPlatformHealthPage />}
            />
            <Route
              path="admin/incidents"
              element={<AdminSecurityIncidentsPage />}
            />
            <Route
              path="admin/privacy"
              element={<AdminPrivacyOperationsPage />}
            />
            <Route path="admin/recovery" element={<AdminRecoveryPage />} />
            <Route path="operations" element={<OperationsPage />} />
          </Route>
          <Route path="workspace" element={<WorkspacePage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route
            path="enterprise/security"
            element={<EnterpriseSecurityPage />}
          />
          <Route path="enterprise/sso" element={<EnterpriseSsoPage />} />
          <Route path="enterprise/privacy" element={<PrivacyRequestsPage />} />
          <Route
            path="enterprise/retention"
            element={<RetentionSettingsPage />}
          />
          <Route
            path="enterprise/organization"
            element={<EnterpriseOrganizationPage />}
          />
          <Route path="developer" element={<DeveloperOverviewPage />} />
          <Route path="developer/keys" element={<ApiKeysPage />} />
          <Route
            path="developer/docs"
            element={<DeveloperDocumentationPage />}
          />
          <Route path="developer/playground" element={<ApiPlaygroundPage />} />
          <Route
            path="developer/webhooks"
            element={<WebhookManagementPage />}
          />
          <Route path="developer/usage" element={<ApiUsagePage />} />
          <Route path="developer/logs" element={<RequestLogsPage />} />
          <Route path="developer/sandbox" element={<SandboxSdkPage />} />
          <Route path="automations" element={<AutomationDashboardPage />} />
          <Route path="automations/workflows" element={<WorkflowListPage />} />
          <Route path="automations/new" element={<WorkflowBuilderPage />} />
          <Route
            path="automations/:id/builder"
            element={<WorkflowBuilderPage />}
          />
          <Route path="automations/chatbot" element={<ChatbotRulesPage />} />
          <Route
            path="automations/executions"
            element={<WorkflowExecutionsPage />}
          />
          <Route
            path="automations/executions/:id"
            element={<ExecutionDetailPage />}
          />
          <Route
            path="automations/analytics"
            element={<AutomationAnalyticsPage />}
          />
          <Route
            path="automations/simulator"
            element={<WorkflowSimulatorPage />}
          />
        </Route>
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Suspense>
  );
}
