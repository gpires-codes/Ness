import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useTr } from "@/core/i18n";
import { deleteApiKey, getApiKeyStatus, saveApiKey } from "@/core/secrets";
import type { SecretField } from "@/core/settings/types";

type Status = "loading" | "configured" | "missing" | "error";
type Feedback = { key: string; error: boolean } | null;

export function SecretControl({
  field,
  id,
}: {
  field: SecretField;
  id: string;
}) {
  const tr = useTr();
  const [apiKey, setApiKey] = useState("");
  const [status, setStatus] = useState<Status>("loading");
  const [lastFour, setLastFour] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);

  useEffect(() => {
    let active = true;

    getApiKeyStatus(field.provider)
      .then((keyStatus) => {
        if (active) {
          setStatus(keyStatus.configured ? "configured" : "missing");
          setLastFour(keyStatus.lastFour);
        }
      })
      .catch(() => {
        if (active) setStatus("error");
      });

    return () => {
      active = false;
    };
  }, [field.provider]);

  async function save() {
    setBusy(true);
    setFeedback(null);
    try {
      const savedLastFour = await saveApiKey(field.provider, apiKey);
      setApiKey("");
      setStatus("configured");
      setLastFour(savedLastFour);
      setFeedback({ key: "settings.secret.saved", error: false });
    } catch {
      setFeedback({ key: "settings.secret.saveError", error: true });
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    setFeedback(null);
    try {
      await deleteApiKey(field.provider);
      setStatus("missing");
      setLastFour(null);
      setFeedback({ key: "settings.secret.removed", error: false });
    } catch {
      setFeedback({ key: "settings.secret.removeError", error: true });
    } finally {
      setBusy(false);
    }
  }

  const statusKey: Record<Exclude<Status, "configured">, string> = {
    loading: "settings.secret.loading",
    missing: "settings.secret.notConfigured",
    error: "settings.secret.statusError",
  };
  const placeholder =
    status === "configured"
      ? `••••••••${lastFour ?? ""}`
      : tr("settings.secret.placeholder");

  return (
    <div className="flex w-full max-w-xs flex-col gap-2 ">
      <div className="flex gap-2">
        <Input
          id={id}
          type="password"
          value={apiKey}
          placeholder={placeholder}
          autoComplete="new-password"
          onChange={(event) => setApiKey(event.target.value)}
        />
        <Button
          type="button"
          disabled={busy || status === "loading" || !apiKey.trim()}
          onClick={save}
        >
          {tr("settings.secret.save")}
        </Button>
      </div>
      <div className="flex items-center gap-2">
        <p
          className="min-w-0 flex-1 text-sm text-muted-foreground"
          aria-live="polite"
        >
          {status === "configured" ? "" : tr(statusKey[status])}
        </p>
        <Button
          type="button"
          variant="destructive"
          disabled={busy || status !== "configured"}
          onClick={remove}
        >
          {tr("settings.secret.remove")}
        </Button>
      </div>
      {feedback && (
        <p
          className={
            feedback.error
              ? "text-sm text-destructive"
              : "text-sm text-muted-foreground"
          }
          role={feedback.error ? "alert" : "status"}
        >
          {tr(feedback.key)}
        </p>
      )}
    </div>
  );
}
