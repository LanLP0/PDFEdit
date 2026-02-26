import { PDFDocument, PDFPage, degrees, rgb, StandardFonts, LineCapStyle } from 'pdf-lib';
import type { DocumentState, Annotation } from '../../store/usePDFStore';

// Parse hex color to rgb values 0-1
function hexToRgb(hex: string): { r: number; g: number; b: number } {
    const h = hex.replace('#', '');
    return {
        r: parseInt(h.substring(0, 2), 16) / 255,
        g: parseInt(h.substring(2, 4), 16) / 255,
        b: parseInt(h.substring(4, 6), 16) / 255,
    };
}

export class PdfEngine {

    static async exportDocument(state: DocumentState): Promise<Uint8Array> {
        if (!state.originalBytes) {
            throw new Error("No document loaded");
        }

        const originalPdf = await PDFDocument.load(state.originalBytes);
        const newPdf = await PDFDocument.create();

        const mods = state.modifications;

        for (const pageId of mods.pageOrder) {
            const pageIndex = parseInt(pageId.split('-')[1], 10) - 1;
            const [copiedPage] = await newPdf.copyPages(originalPdf, [pageIndex]);

            const rotationDeg = mods.rotations[pageId];
            if (rotationDeg) {
                const currentRot = copiedPage.getRotation().angle;
                copiedPage.setRotation(degrees(currentRot + rotationDeg));
            }

            const pageAnnotations = mods.annotations[pageId] || [];
            await this.applyAnnotations(newPdf, copiedPage, pageAnnotations);

            newPdf.addPage(copiedPage);
        }

        return await newPdf.save();
    }

    // TODO: Fix annotation rendering: text properties, highlight/draw color, opacity, stroke width
    private static async applyAnnotations(doc: PDFDocument, page: PDFPage, annotations: Annotation[]) {
        const { width, height } = page.getSize();

        // Embed standard fonts for text
        const helveticaFont = await doc.embedFont(StandardFonts.Helvetica);
        const helveticaBoldFont = await doc.embedFont(StandardFonts.HelveticaBold);
        const helveticaObliqueFont = await doc.embedFont(StandardFonts.HelveticaOblique);
        const helveticaBoldObliqueFont = await doc.embedFont(StandardFonts.HelveticaBoldOblique);
        const timesFont = await doc.embedFont(StandardFonts.TimesRoman);
        const timesBoldFont = await doc.embedFont(StandardFonts.TimesRomanBold);
        const courierFont = await doc.embedFont(StandardFonts.Courier);
        const courierBoldFont = await doc.embedFont(StandardFonts.CourierBold);

        for (const ann of annotations) {
            // Text annotations
            if (ann.type === 'text') {
                const style = ann.textStyle;
                const fontSize = style?.fontSize || 16;
                const color = style?.color ? hexToRgb(style.color) : { r: 0, g: 0, b: 0 };
                const isBold = style?.bold || false;
                const isItalic = style?.italic || false;

                // Select font based on family and style
                let font = helveticaFont;
                const family = (style?.fontFamily || 'Inter').toLowerCase();
                if (family.includes('times') || family.includes('georgia')) {
                    font = isBold ? timesBoldFont : timesFont;
                } else if (family.includes('courier')) {
                    font = isBold ? courierBoldFont : courierFont;
                } else {
                    // Helvetica family for Inter, Arial, Helvetica, Verdana, etc.
                    if (isBold && isItalic) font = helveticaBoldObliqueFont;
                    else if (isBold) font = helveticaBoldFont;
                    else if (isItalic) font = helveticaObliqueFont;
                    else font = helveticaFont;
                }

                const text = ann.payload as string;
                const textWidth = font.widthOfTextAtSize(text, fontSize);
                const textHeight = font.heightAtSize(fontSize);

                // React translates by -50% -50%, so ann.x and ann.y represents the center.
                // pdf-lib drawText Y is the baseline (bottom).
                const xPt = ((ann.x / 100) * width) - (textWidth / 2);
                const centerY = height - ((ann.y / 100) * height);
                // Baseline is roughly textHeight/3 below the center for most fonts
                const yPt = centerY - (textHeight * 0.25);

                page.drawText(text, {
                    x: xPt,
                    y: yPt,
                    size: fontSize,
                    font,
                    color: rgb(color.r, color.g, color.b),
                });

                // Underline: draw a line under the text
                if (style?.underline) {
                    page.drawLine({
                        start: { x: xPt, y: yPt - 2 },
                        end: { x: xPt + textWidth, y: yPt - 2 },
                        thickness: 1,
                        color: rgb(color.r, color.g, color.b),
                    });
                }
            }

            // Image/Signature annotations
            if (ann.type === 'image' || ann.type === 'signature') {
                if (typeof ann.payload !== 'string') continue;

                let imageEmbed;
                if (ann.payload.startsWith('data:image/png')) {
                    imageEmbed = await doc.embedPng(ann.payload);
                } else if (ann.payload.startsWith('data:image/jpeg')) {
                    imageEmbed = await doc.embedJpg(ann.payload);
                } else {
                    continue;
                }

                // React translates by -50% -50%
                const imgWidth = ann.width ? (ann.width / 100) * width : 100;
                const imgDims = imageEmbed.scaleToFit(imgWidth, height);

                const xPt = ((ann.x / 100) * width) - (imgDims.width / 2);
                const yPt = height - ((ann.y / 100) * height) - (imgDims.height / 2);

                page.drawImage(imageEmbed, {
                    x: xPt,
                    y: yPt,
                    width: imgDims.width,
                    height: imgDims.height,
                });
            }

            // Highlight / Draw stroke annotations
            if (ann.type === 'highlight' || ann.type === 'draw') {
                const points = ann.points || [];
                if (points.length < 2) continue;

                const strokeColor = ann.strokeColor ? hexToRgb(ann.strokeColor) : { r: 0, g: 0, b: 0 };
                const strokeWidth = ann.strokeWidth || 3;
                const opacity = ann.strokeOpacity ?? 1;

                for (let i = 0; i < points.length - 1; i++) {
                    const start = {
                        x: (points[i].x / 100) * width,
                        y: height - ((points[i].y / 100) * height),
                    };
                    const end = {
                        x: (points[i + 1].x / 100) * width,
                        y: height - ((points[i + 1].y / 100) * height),
                    };

                    page.drawLine({
                        start,
                        end,
                        thickness: strokeWidth,
                        color: rgb(strokeColor.r, strokeColor.g, strokeColor.b),
                        opacity,
                        lineCap: LineCapStyle.Round,
                    });
                }
            }
        }
    }

    static async mergeDocuments(files: File[]): Promise<Uint8Array> {
        const mergedPdf = await PDFDocument.create();
        for (const file of files) {
            const bytes = await file.arrayBuffer();
            const pdf = await PDFDocument.load(bytes);
            const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
            copiedPages.forEach((page) => mergedPdf.addPage(page));
        }
        return await mergedPdf.save();
    }
}
