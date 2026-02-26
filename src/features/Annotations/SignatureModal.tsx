import React, { useRef, useEffect, useState } from 'react';
import { usePDFStore } from '../../store/usePDFStore';
import { X, Check } from 'lucide-react';

interface SignatureModalProps {
    pageId: string | null;
}

export function SignatureModal({ pageId }: SignatureModalProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const { settings, setActiveTool, addAnnotation } = usePDFStore();
    const [isDrawing, setIsDrawing] = useState(false);
    const [hasDrawn, setHasDrawn] = useState(false);

    // Auto-focus canvas context
    useEffect(() => {
        if (settings.activeTool === 'signature' && canvasRef.current) {
            const ctx = canvasRef.current.getContext('2d');
            if (ctx) {
                ctx.strokeStyle = '#000';
                ctx.lineWidth = 3;
                ctx.lineCap = 'round';
                ctx.lineJoin = 'round';
            }
        }
    }, [settings.activeTool]);

    if (settings.activeTool !== 'signature' || !pageId) return null;

    const handleClose = () => {
        setActiveTool('pointer');
    };

    const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
        e.preventDefault();
        setIsDrawing(true);
        setHasDrawn(true);
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const rect = canvas.getBoundingClientRect();
        const x = ('touches' in e) ? e.touches[0].clientX - rect.left : (e as React.MouseEvent).clientX - rect.left;
        const y = ('touches' in e) ? e.touches[0].clientY - rect.top : (e as React.MouseEvent).clientY - rect.top;

        ctx.beginPath();
        ctx.moveTo(x, y);
    };

    const draw = (e: React.MouseEvent | React.TouchEvent) => {
        e.preventDefault();
        if (!isDrawing || !canvasRef.current) return;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const rect = canvas.getBoundingClientRect();
        const x = ('touches' in e) ? e.touches[0].clientX - rect.left : (e as React.MouseEvent).clientX - rect.left;
        const y = ('touches' in e) ? e.touches[0].clientY - rect.top : (e as React.MouseEvent).clientY - rect.top;

        ctx.lineTo(x, y);
        ctx.stroke();
    };

    const stopDrawing = () => {
        setIsDrawing(false);
    };

    const handleClear = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (ctx) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            setHasDrawn(false);
        }
    };

    const handleSave = () => {
        if (!canvasRef.current) return;
        const dataUrl = canvasRef.current.toDataURL('image/png');

        // Insert into center of page
        addAnnotation(pageId, {
            id: crypto.randomUUID(),
            type: 'image', // Treat signature as an image slice
            x: 50,
            y: 50,
            width: 40,
            payload: dataUrl
        });

        handleClose();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="bg-[var(--color-bg-panel)] rounded-xl shadow-[var(--shadow-floating)] max-w-xl w-full p-6 mx-4 relative">
                <button
                    onClick={handleClose}
                    className="absolute top-4 right-4 text-[var(--color-text-muted)] hover:text-[var(--color-text-main)]"
                >
                    <X size={24} />
                </button>

                <h2 className="text-xl font-semibold text-[var(--color-text-main)] mb-2">Draw Your Signature</h2>
                <p className="text-sm text-[var(--color-text-muted)] mb-6">Use your mouse or finger to sign.</p>

                <div className="border-2 border-dashed border-[var(--color-border-hover)] rounded-lg bg-white overflow-hidden mb-6">
                    <canvas
                        ref={canvasRef}
                        width={500}
                        height={200}
                        className="w-full h-[200px] touch-none cursor-crosshair"
                        onMouseDown={startDrawing}
                        onMouseMove={draw}
                        onMouseUp={stopDrawing}
                        onMouseLeave={stopDrawing}
                        onTouchStart={startDrawing}
                        onTouchMove={draw}
                        onTouchEnd={stopDrawing}
                    />
                </div>

                <div className="flex justify-between items-center">
                    <button
                        className="text-[var(--color-text-muted)] hover:text-red-500 font-medium transition-colors"
                        onClick={handleClear}
                    >
                        Clear Signature
                    </button>

                    <div className="flex gap-3">
                        <button className="btn-secondary" onClick={handleClose}>Cancel</button>
                        <button
                            className="btn-primary flex items-center gap-2"
                            onClick={handleSave}
                            disabled={!hasDrawn}
                            style={{ opacity: hasDrawn ? 1 : 0.5 }}
                        >
                            <Check size={18} />
                            Insert Signature
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
