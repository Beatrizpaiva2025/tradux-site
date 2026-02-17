import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import Professionals from "./pages/Professionals";
import Success from "./pages/Success";
import Cancel from "./pages/Cancel";
import Admin from "./pages/Admin";
import Review from "./pages/Review";
import TranslationTest from "./pages/TranslationTest";


function Router() {
  return (
    <Switch>
      <Route path={"/"} component={Home} />
      <Route path={"/professionals"} component={Professionals} />
      <Route path={"/success"} component={Success} />
      <Route path={"/cancel"} component={Cancel} />
      <Route path={"/admin"} component={Admin} />
      <Route path={"/translate"} component={TranslationTest} />
      <Route path={"/review/:orderId"} component={Review} />
      <Route path={"/404"} component={NotFound} />
      {/* Final fallback route */}
      <Route component={NotFound} />
    </Switch>
  );
}

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
