"use client";

import { useState, useTransition } from "react";
import { Copy, Check, RefreshCw, Code } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { generateWidgetToken } from "./actions";

interface WidgetIntegrationProps {
  projectId: number;
  widgetToken: string | null;
  appUrl: string;
}

export function WidgetIntegration({
  projectId,
  widgetToken,
  appUrl,
}: WidgetIntegrationProps) {
  const [isPending, startTransition] = useTransition();
  const [copied, setCopied] = useState<"token" | "code" | null>(null);
  const [token, setToken] = useState(widgetToken);

  const integrationCode = token
    ? `<script>\n  window.CinqConfig = { token: '${token}' };\n</script>\n<script src="${appUrl}/widget.js" async></script>`
    : null;

  async function handleCopy(text: string, type: "token" | "code") {
    await navigator.clipboard.writeText(text);
    setCopied(type);
    setTimeout(() => setCopied(null), 2000);
  }

  function handleGenerate() {
    startTransition(async () => {
      const newToken = await generateWidgetToken(projectId);
      setToken(newToken);
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Code className="h-4 w-4" />
          Widget d&apos;intégration
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {token ? (
          <>
            {/* Token */}
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground">Token</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 rounded bg-muted px-3 py-2 text-xs font-mono truncate">
                  {token.slice(0, 12)}...{token.slice(-8)}
                </code>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleCopy(token, "token")}
                >
                  {copied === "token" ? (
                    <Check className="h-3.5 w-3.5" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                </Button>
              </div>
            </div>

            {/* Integration code */}
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground">
                Code d&apos;intégration
              </p>
              <p className="text-xs text-muted-foreground">
                Collez ce code juste avant la balise{" "}
                <code className="rounded bg-muted px-1 py-0.5 text-[11px]">
                  {"</body>"}
                </code>{" "}
                de votre site.
              </p>
              <div className="relative">
                <pre className="rounded bg-muted p-3 text-xs font-mono overflow-x-auto whitespace-pre-wrap text-foreground">
                  {integrationCode}
                </pre>
                <Button
                  variant="outline"
                  size="sm"
                  className="absolute top-2 right-2"
                  onClick={() => handleCopy(integrationCode!, "code")}
                >
                  {copied === "code" ? (
                    <Check className="h-3 w-3" />
                  ) : (
                    <Copy className="h-3 w-3" />
                  )}
                </Button>
              </div>
            </div>

            {/* Regenerate */}
            <Button
              variant="outline"
              size="sm"
              onClick={handleGenerate}
              disabled={isPending}
            >
              <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
              Régénérer le token
            </Button>
          </>
        ) : (
          <div className="text-center py-4">
            <p className="text-sm text-muted-foreground mb-3">
              Aucun token de widget configuré pour ce projet.
            </p>
            <Button size="sm" onClick={handleGenerate} disabled={isPending}>
              Générer un token
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
