import { useEffect } from "react";
import { Footer } from "./layout/Footer";
import { Header } from "./layout/Header";
import { PreviewBanner } from "./layout/PreviewBanner";
import { ConfigurePage } from "./pages/configure/ConfigurePage";
import { HomePage } from "./pages/home/HomePage";
import { ToolboxPage } from "./pages/toolbox/ToolboxPage";
import { NotFoundPage } from "./pages/not-found/NotFoundPage";
import { useRoute } from "./router";
import { useTheme } from "./theme";

const TITLES = { home: "", configure: "Configure", toolbox: "Developer Toolbox", "not-found": "Not found" } as const;

export function App() {
  const route = useRoute();
  const [theme, toggleTheme] = useTheme();
  useEffect(() => {
    const title = TITLES[route.page];
    document.title = title ? `${title} | Eclipse Tractus-X Starter Kit` : "Eclipse Tractus-X Starter Kit";
  }, [route.page]);
  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <PreviewBanner />
      <Header route={route} theme={theme} onToggleTheme={toggleTheme} />
      {route.page === "home" && (
        <main id="main">
          <HomePage />
        </main>
      )}
      {route.page === "toolbox" && (
        <main id="main">
          <ToolboxPage />
        </main>
      )}
      {route.page === "configure" && <ConfigurePage key={route.target ?? "configure"} target={route.target} />}
      {route.page === "not-found" && (
        <main id="main">
          <NotFoundPage path={route.path} />
        </main>
      )}
      <Footer />
    </>
  );
}
