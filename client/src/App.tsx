import { lazy, Suspense } from "react";
import { Route, Switch, Redirect, useLocation } from "wouter";
import { AuthProvider, useAuth } from "./lib/auth";
import { trpc } from "./lib/trpc";

// העורך טוען את מאגר הליקויים — נטען רק כשצריך, כדי שקישור לדוח ייפתח מהר
const VisitEditorPage = lazy(() => import("./pages/VisitEditorPage"));
import { Spinner } from "./components/ui";
import { LoginPage, SignupPage, ForgotPage, ResetPage } from "./pages/AuthPages";
import HomePage from "./pages/HomePage";
import SiteFormPage from "./pages/SiteFormPage";
import SitePage from "./pages/SitePage";
import NewVisitPage from "./pages/NewVisitPage";
import { OwnerReportPage, PublicReportPage } from "./pages/ReportPage";
import SettingsPage from "./pages/SettingsPage";
import { BillingPage } from "./pages/BillingPage";
import AdminPage from "./pages/AdminPage";

function Private({ children }: { children: JSX.Element }) {
  const auth = useAuth();
  const utils = trpc.useUtils();
  // אחרי כניסה המטמון כבר מעודכן, גם אם ההקשר עוד לא רונדר מחדש
  const me = auth.me ?? utils.account.me.getData() ?? null;
  const loading = auth.loading && !me;
  const [loc] = useLocation();
  if (loading) return <Spinner />;
  if (!me) return <Redirect to={`/login?next=${encodeURIComponent(loc)}`} />;
  return children;
}

export default function App() {
  return (
    <AuthProvider>
      <Switch>
        <Route path="/r/:token">{(p) => <PublicReportPage token={p.token} />}</Route>
        <Route path="/login" component={LoginPage} />
        <Route path="/signup" component={SignupPage} />
        <Route path="/forgot" component={ForgotPage} />
        <Route path="/reset/:token">{(p) => <ResetPage token={p.token} />}</Route>

        <Route path="/">{() => <Private><HomePage /></Private>}</Route>
        <Route path="/sites/new">{() => <Private><SiteFormPage /></Private>}</Route>
        <Route path="/sites/:id/edit">{(p) => <Private><SiteFormPage id={Number(p.id)} /></Private>}</Route>
        <Route path="/sites/:id">{(p) => <Private><SitePage id={Number(p.id)} /></Private>}</Route>
        <Route path="/visit/new">{() => <Private><NewVisitPage /></Private>}</Route>
        <Route path="/visit/:id/report">{(p) => <Private><OwnerReportPage id={p.id} /></Private>}</Route>
        <Route path="/visit/:id">{(p) => <Private><Suspense fallback={<Spinner />}><VisitEditorPage id={p.id} /></Suspense></Private>}</Route>
        <Route path="/settings">{() => <Private><SettingsPage /></Private>}</Route>
        <Route path="/billing">{() => <Private><BillingPage /></Private>}</Route>
        <Route path="/admin">{() => <Private><AdminPage /></Private>}</Route>
        <Route>
          <Redirect to="/" />
        </Route>
      </Switch>
    </AuthProvider>
  );
}
