import { useState } from "react";
import { invokeEdgeFunction } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Loader2, Check, AlertCircle } from "lucide-react";

interface RunButtonProps {
  label: string;
  functionName: string;
  body?: Record<string, unknown>;
  variant?: "default" | "outline" | "secondary";
}

export default function RunButton({ label, functionName, body, variant = "default" }: RunButtonProps) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; data?: any } | null>(null);

  const run = async () => {
    setLoading(true);
    setResult(null);
    try {
      const data = await invokeEdgeFunction(functionName, body);
      setResult({ ok: data.ok !== false, data });
    } catch (err) {
      setResult({ ok: false, data: { error: String(err) } });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="runner-card space-y-3">
      <Button
        onClick={run}
        disabled={loading}
        variant={variant}
        className="w-full font-mono text-xs"
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
        {label}
      </Button>
      {result && (
        <div className={`text-xs font-mono p-2 rounded ${result.ok ? "bg-primary/10 text-primary" : "bg-destructive/10 text-destructive"}`}>
          <div className="flex items-center gap-1 mb-1">
            {result.ok ? <Check className="h-3 w-3" /> : <AlertCircle className="h-3 w-3" />}
            {result.ok ? "Success" : "Error"}
          </div>
          <pre className="whitespace-pre-wrap text-[10px] opacity-80 max-h-32 overflow-auto">
            {JSON.stringify(result.data, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}
