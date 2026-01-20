import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useSearchParams } from "react-router-dom";

interface PreviewModeContextType {
  isPreviewMode: boolean;
  enablePreviewMode: () => void;
  disablePreviewMode: () => void;
}

const PreviewModeContext = createContext<PreviewModeContextType | undefined>(undefined);

const PREVIEW_MODE_KEY = "app_preview_mode";

export function PreviewModeProvider({ children }: { children: ReactNode }) {
  const [searchParams] = useSearchParams();
  const [isPreviewMode, setIsPreviewMode] = useState(false);

  useEffect(() => {
    // Check URL parameter first
    const previewParam = searchParams.get("preview");
    if (previewParam === "true") {
      setIsPreviewMode(true);
      // Store in session storage so it persists during navigation
      sessionStorage.setItem(PREVIEW_MODE_KEY, "true");
      return;
    }

    // Check session storage for persisted preview mode
    const storedPreviewMode = sessionStorage.getItem(PREVIEW_MODE_KEY);
    if (storedPreviewMode === "true") {
      setIsPreviewMode(true);
    }
  }, [searchParams]);

  const enablePreviewMode = () => {
    setIsPreviewMode(true);
    sessionStorage.setItem(PREVIEW_MODE_KEY, "true");
  };

  const disablePreviewMode = () => {
    setIsPreviewMode(false);
    sessionStorage.removeItem(PREVIEW_MODE_KEY);
  };

  return (
    <PreviewModeContext.Provider value={{ isPreviewMode, enablePreviewMode, disablePreviewMode }}>
      {children}
    </PreviewModeContext.Provider>
  );
}

export function usePreviewMode() {
  const context = useContext(PreviewModeContext);
  if (context === undefined) {
    throw new Error("usePreviewMode must be used within a PreviewModeProvider");
  }
  return context;
}
