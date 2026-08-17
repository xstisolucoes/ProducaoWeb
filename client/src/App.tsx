import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import DashboardLayout from "./components/DashboardLayout";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import Orders from "./pages/Orders";
import Pointing from "./pages/Pointing";
import Products from "./pages/Products";
import Requests from "./pages/Requests";
import Stock from "./pages/Stock";

function Router() {
  // make sure to consider if you need authentication for certain routes
  return (
    <Switch>
      <Route path={"/"}><DashboardLayout><Home /></DashboardLayout></Route>
      <Route path={"/ordens"}><DashboardLayout><Orders /></DashboardLayout></Route>
      <Route path={"/produtos"}><DashboardLayout><Products /></DashboardLayout></Route>
      <Route path={"/estoque"}><DashboardLayout><Stock /></DashboardLayout></Route>
      <Route path={"/solicitacoes"}><DashboardLayout><Requests /></DashboardLayout></Route>
      <Route path={"/apontamento/:opCodigo/:mpCodigo"}><Pointing /></Route>
      <Route path={"/404"} component={NotFound} />
      {/* Final fallback route */}
      <Route component={NotFound} />
    </Switch>
  );
}

// NOTE: About Theme
// - First choose a default theme according to your design style (dark or light bg), than change color palette in index.css
//   to keep consistent foreground/background color across components
// - If you want to make theme switchable, pass `switchable` ThemeProvider and use `useTheme` hook

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider
        defaultTheme="light"
      >
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
