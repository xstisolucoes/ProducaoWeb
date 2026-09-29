import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import DashboardLayout from "./components/DashboardLayout";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import Pointing from "./pages/Pointing";
import ManualPointing from "./pages/ManualPointing";
import ProductReleasePointing from "./pages/ProductReleasePointing";
import Programming from "./pages/Programming";
import XPaperPortal from "./pages/XPaperPortal";

function Router() {
  // make sure to consider if you need authentication for certain routes
  return (
    <Switch>
      <Route path={"/"}><DashboardLayout><Home /></DashboardLayout></Route>
      <Route path={"/producao"}><DashboardLayout><Programming /></DashboardLayout></Route>
      <Route path={"/xpaper/cadastros"}><DashboardLayout><XPaperPortal /></DashboardLayout></Route>
      <Route path={"/apontamento/:opCodigo/:mpCodigo"}><Pointing /></Route>
      <Route path={"/apontamento-manual/:opCodigo/:mpCodigo"}><ManualPointing /></Route>
      <Route path={"/liberacao-produto/:opCodigo/:mpCodigo"}><ProductReleasePointing /></Route>
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
