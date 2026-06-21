import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Camera, Upload, X, RotateCw, ZoomIn, ZoomOut, FileImage, Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { Bill } from "@/lib/store";
import { newId } from "@/lib/store";
import {
  BILL_PIPELINE_STEPS,
  type BillPipelineStepId,
  detectBillInFrame,
  frameMotionScore,
  runBillPipeline,
  sampleVideoFrame,
} from "@/lib/bill-scan";

const STABLE_FRAMES = 8;
const MOTION_THRESHOLD = 10;

type StepStatus = "pending" | "active" | "done";

function stepIndex(id: BillPipelineStepId) {
  return BILL_PIPELINE_STEPS.findIndex((s) => s.id === id);
}

function BillPipelineProgress({
  activeStep,
  completedThrough,
}: {
  activeStep: BillPipelineStepId | null;
  completedThrough: BillPipelineStepId | null;
}) {
  const doneIdx = completedThrough ? stepIndex(completedThrough) : -1;
  const activeIdx = activeStep ? stepIndex(activeStep) : -1;

  const statusFor = (idx: number): StepStatus => {
    if (activeIdx === idx) return "active";
    if (doneIdx >= idx) return "done";
    return "pending";
  };

  return (
    <ol className="space-y-1.5 text-xs">
      {BILL_PIPELINE_STEPS.map((step, idx) => {
        const status = statusFor(idx);
        return (
          <li
            key={step.id}
            className={`flex items-center gap-2 rounded-md px-2 py-1 ${
              status === "active"
                ? "bg-secondary/20 font-medium text-foreground"
                : status === "done"
                  ? "text-muted-foreground"
                  : "text-muted-foreground/60"
            }`}
          >
            <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full border">
              {status === "done" ? (
                <Check className="h-3 w-3 text-success" />
              ) : status === "active" ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <span className="text-[10px]">{idx + 1}</span>
              )}
            </span>
            <span>{step.label}</span>
            {idx < BILL_PIPELINE_STEPS.length - 1 && status === "done" && (
              <span className="ml-auto text-[10px] text-success">✓</span>
            )}
          </li>
        );
      })}
    </ol>
  );
}

async function processAndAttachBill(
  bills: Bill[],
  onChange: (b: Bill[]) => void,
  name: string,
  rawUrl: string,
  type: Bill["type"],
  onStep: (step: BillPipelineStepId, status: "active" | "done" | "pending") => void,
) {
  try {
    const result = await runBillPipeline(rawUrl, (stepId, status) => onStep(stepId, status));

    onStep("attach_expense", "active");
    await new Promise((r) => setTimeout(r, 80));
    const bill: Bill = {
      id: newId(),
      name,
      url: result.processedUrl,
      originalUrl: result.originalUrl,
      type,
    };
    onChange([...bills, bill]);
    onStep("attach_expense", "done");

    onStep("generate_pdf", "active");
    await new Promise((r) => setTimeout(r, 80));
    onStep("generate_pdf", "done");

    return bill;
  } catch {
    const bill: Bill = { id: newId(), name, url: rawUrl, originalUrl: rawUrl, type };
    onChange([...bills, bill]);
    onStep("attach_expense", "done");
    onStep("generate_pdf", "done");
    return bill;
  }
}

export function BillManager({
  bills,
  onChange,
  readOnly = false,
}: {
  bills: Bill[];
  onChange: (b: Bill[]) => void;
  readOnly?: boolean;
}) {
  const [scanOpen, setScanOpen] = useState(false);
  const [processOpen, setProcessOpen] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<Bill | null>(null);
  const [previewMode, setPreviewMode] = useState<"processed" | "original">("processed");
  const [rotate, setRotate] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [capturing, setCapturing] = useState(false);
  const [scanStatus, setScanStatus] = useState("Opening front camera…");
  const [activeStep, setActiveStep] = useState<BillPipelineStepId | null>("scan");
  const [completedThrough, setCompletedThrough] = useState<BillPipelineStepId | null>(null);
  const prevFrameRef = useRef<ImageData | null>(null);
  const stableCountRef = useRef(0);
  const capturedRef = useRef(false);
  const billsRef = useRef(bills);
  const streamRef = useRef<MediaStream | null>(null);
  billsRef.current = bills;

  const resetPipeline = useCallback(() => {
    setActiveStep(null);
    setCompletedThrough(null);
  }, []);

  const markStep = useCallback((stepId: BillPipelineStepId, status: "active" | "done" | "pending") => {
    if (status === "active") setActiveStep(stepId);
    if (status === "done") {
      setActiveStep(null);
      setCompletedThrough(stepId);
    }
  }, []);

  const closeScan = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setStream(null);
    setScanOpen(false);
    prevFrameRef.current = null;
    stableCountRef.current = 0;
    capturedRef.current = false;
    setScanStatus("Opening front camera…");
    if (!processOpen) resetPipeline();
  }, [processOpen, resetPipeline]);

  const finishProcessing = useCallback(() => {
    setProcessOpen(false);
    resetPipeline();
  }, [resetPipeline]);

  const capture = useCallback(async () => {
    if (!videoRef.current || readOnly || capturedRef.current) return;
    capturedRef.current = true;
    setCapturing(true);
    markStep("capture", "active");
    setScanStatus("Auto capturing…");
    try {
      const video = videoRef.current;
      const c = document.createElement("canvas");
      c.width = video.videoWidth || 1920;
      c.height = video.videoHeight || 1080;
      const ctx = c.getContext("2d");
      if (!ctx) return;
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.translate(c.width, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(video, 0, 0, c.width, c.height);
      const rawUrl = c.toDataURL("image/jpeg", 0.98);
      markStep("capture", "done");
      closeScan();
      setProcessOpen(true);
      await processAndAttachBill(
        billsRef.current,
        onChange,
        `scan-${Date.now()}.jpg`,
        rawUrl,
        "scanned",
        markStep,
      );
      toast.success("Bill scanned — original & processed copies saved. Ready for PDF.");
      setTimeout(finishProcessing, 1200);
    } finally {
      setCapturing(false);
    }
  }, [closeScan, finishProcessing, markStep, onChange, readOnly]);

  const openScan = async () => {
    capturedRef.current = false;
    stableCountRef.current = 0;
    prevFrameRef.current = null;
    resetPipeline();
    setScanOpen(true);
    markStep("scan", "active");
    setScanStatus("Allow camera access…");
    try {
      const s = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "user" },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      });
      setStream(s);
      streamRef.current = s;
      markStep("scan", "done");
      markStep("detect", "active");
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = s;
          void videoRef.current.play();
          setScanStatus("Show bill to front camera");
        }
      }, 50);
    } catch {
      toast.error("Camera access denied. Use Upload instead.");
      closeScan();
    }
  };

  useEffect(() => {
    if (!scanOpen || !stream || capturing || capturedRef.current) return;

    const timer = window.setInterval(() => {
      const video = videoRef.current;
      if (!video || capturedRef.current) return;

      const frame = sampleVideoFrame(video);
      if (!frame) return;

      const detected = detectBillInFrame(frame);
      if (!detected) {
        stableCountRef.current = 0;
        prevFrameRef.current = frame;
        markStep("detect", "active");
        setScanStatus("Show bill inside the frame");
        return;
      }

      markStep("detect", "done");

      if (prevFrameRef.current) {
        const motion = frameMotionScore(prevFrameRef.current, frame);
        if (motion < MOTION_THRESHOLD) {
          stableCountRef.current += 1;
        } else {
          stableCountRef.current = 0;
        }
      }
      prevFrameRef.current = frame;

      if (stableCountRef.current >= STABLE_FRAMES) {
        setScanStatus("Bill detected — auto capturing…");
        void capture();
        return;
      }

      setScanStatus(`Hold bill steady (${stableCountRef.current}/${STABLE_FRAMES})`);
    }, 300);

    return () => window.clearInterval(timer);
  }, [scanOpen, stream, capturing, capture, markStep]);

  const onUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (readOnly) return;
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;

    setProcessOpen(true);
    resetPipeline();
    markStep("scan", "done");
    markStep("detect", "done");
    markStep("capture", "done");

    let next = [...bills];
    for (const f of files) {
      const rawUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error("Read failed"));
        reader.readAsDataURL(f);
      });
      try {
        const result = await runBillPipeline(rawUrl, markStep);
        markStep("attach_expense", "active");
        const bill: Bill = {
          id: newId(),
          name: f.name,
          url: result.processedUrl,
          originalUrl: result.originalUrl,
          type: "uploaded",
        };
        next = [...next, bill];
        markStep("attach_expense", "done");
        markStep("generate_pdf", "done");
      } catch {
        next = [...next, { id: newId(), name: f.name, url: rawUrl, originalUrl: rawUrl, type: "uploaded" as const }];
        markStep("attach_expense", "done");
        markStep("generate_pdf", "done");
      }
    }
    onChange(next);
    toast.success(`${files.length} bill(s) processed and attached`);
    setTimeout(finishProcessing, 1200);
    if (fileRef.current) fileRef.current.value = "";
  };

  const previewUrl = preview
    ? previewMode === "original" && preview.originalUrl
      ? preview.originalUrl
      : preview.url
    : "";

  return (
    <div className="space-y-3">
      {!readOnly && (
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
            <Upload className="h-4 w-4" /> Upload Bill
          </Button>
          <Button type="button" size="sm" className="bg-secondary text-secondary-foreground hover:bg-secondary/90" onClick={openScan}>
            <Camera className="h-4 w-4" /> Scan Bill
          </Button>
          <input ref={fileRef} type="file" accept="image/*,.pdf" multiple className="hidden" onChange={onUpload} />
        </div>
      )}

      {bills.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {bills.map((b) => (
            <div key={b.id} className="group relative aspect-[3/4] overflow-hidden rounded-lg border border-border bg-white shadow-sm">
              {b.url ? (
                <img src={b.url} alt={b.name} className="h-full w-full object-contain bg-white p-1" />
              ) : (
                <div className="grid h-full w-full place-items-center bg-white text-muted-foreground"><FileImage className="h-8 w-8" /></div>
              )}
              <div className="absolute inset-x-0 bottom-0 bg-white/95 px-1.5 py-1 text-[10px] text-foreground shadow-sm">
                <span className="line-clamp-1">{b.name}</span>
                {b.originalUrl && b.originalUrl !== b.url && (
                  <span className="text-[9px] text-muted-foreground">Original + Processed</span>
                )}
              </div>
              <div className="absolute inset-0 flex items-center justify-center gap-1 bg-black/30 opacity-0 transition-opacity group-hover:opacity-100">
                <Button type="button" size="icon" variant="secondary" className="h-7 w-7" onClick={() => { setPreview(b); setPreviewMode("processed"); setRotate(0); setZoom(1); }}>
                  <ZoomIn className="h-3.5 w-3.5" />
                </Button>
                {!readOnly && (
                  <Button type="button" size="icon" variant="destructive" className="h-7 w-7" onClick={() => onChange(bills.filter((x) => x.id !== b.id))}>
                    <X className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={scanOpen} onOpenChange={(o) => !o && closeScan()}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Camera className="h-5 w-5" /> Bill Scan Pipeline</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 md:grid-cols-[1fr_220px]">
            <div>
              <div className="relative aspect-video overflow-hidden rounded-lg bg-black">
                <video ref={videoRef} autoPlay playsInline muted className="h-full w-full scale-x-[-1] object-cover" />
                <div className="pointer-events-none absolute inset-6 rounded-lg border-2 border-dashed border-white/90 shadow-[inset_0_0_0_9999px_rgba(0,0,0,0.4)]" />
                <div className="pointer-events-none absolute inset-x-0 bottom-3 text-center text-xs font-medium text-white drop-shadow">
                  {scanStatus}
                </div>
              </div>
            </div>
            <BillPipelineProgress activeStep={activeStep} completedThrough={completedThrough} />
          </div>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="outline" onClick={closeScan}>Cancel</Button>
            <Button disabled={capturing} onClick={() => void capture()} className="bg-secondary text-secondary-foreground hover:bg-secondary/90">
              <Camera className="h-4 w-4" /> {capturing ? "Capturing…" : "Capture Now"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={processOpen} onOpenChange={(o) => !o && finishProcessing()}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Processing Bill</DialogTitle>
          </DialogHeader>
          <BillPipelineProgress activeStep={activeStep} completedThrough={completedThrough} />
        </DialogContent>
      </Dialog>

      <Dialog open={!!preview} onOpenChange={(o) => !o && setPreview(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between gap-2">
              <span className="truncate">{preview?.name}</span>
              <span className="flex shrink-0 gap-1">
                {preview?.originalUrl && preview.originalUrl !== preview.url && (
                  <>
                    <Button size="sm" variant={previewMode === "processed" ? "default" : "outline"} className="h-7 text-xs" onClick={() => setPreviewMode("processed")}>Processed</Button>
                    <Button size="sm" variant={previewMode === "original" ? "default" : "outline"} className="h-7 text-xs" onClick={() => setPreviewMode("original")}>Original</Button>
                  </>
                )}
                <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => setZoom((z) => Math.min(3, z + 0.25))}><ZoomIn className="h-3.5 w-3.5" /></Button>
                <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))}><ZoomOut className="h-3.5 w-3.5" /></Button>
                <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => setRotate((r) => r + 90)}><RotateCw className="h-3.5 w-3.5" /></Button>
              </span>
            </DialogTitle>
          </DialogHeader>
          <div className="grid max-h-[70vh] place-items-center overflow-auto rounded-lg bg-white p-4">
            {previewUrl ? (
              <img src={previewUrl} alt={preview?.name} style={{ transform: `rotate(${rotate}deg) scale(${zoom})` }} className="max-h-[65vh] object-contain bg-white transition-transform" />
            ) : (
              <div className="grid h-40 w-full place-items-center text-muted-foreground"><FileImage className="h-12 w-12" /></div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
