import { PDFDocument, PDFPage, degrees, rgb, StandardFonts } from 'pdf-lib';
import type { DocumentState, Annotation, LinkPayload } from '../../store/usePDFStore';

// Parse hex color to rgb values 0-1
function hexToRgb(hex: string): { r: number; g: number; b: number } {
    const h = hex.replace('#', '');
    return {
        r: parseInt(h.substring(0, 2), 16) / 255,
        g: parseInt(h.substring(2, 4), 16) / 255,
        b: parseInt(h.substring(4, 6), 16) / 255,
    };
}

// Font variant map: fontFamily -> { regular, bold, italic, boldItalic }
const fontVariantMap: Record<string, {
    regular: StandardFonts;
    bold: StandardFonts;
    italic: StandardFonts;
    boldItalic: StandardFonts;
}> = {
    'Helvetica': {
        regular: StandardFonts.Helvetica,
        bold: StandardFonts.HelveticaBold,
        italic: StandardFonts.HelveticaOblique,
        boldItalic: StandardFonts.HelveticaBoldOblique,
    },
    'Times Roman': {
        regular: StandardFonts.TimesRoman,
        bold: StandardFonts.TimesRomanBold,
        italic: StandardFonts.TimesRomanItalic,
        boldItalic: StandardFonts.TimesRomanBoldItalic,
    },
    'Courier': {
        regular: StandardFonts.Courier,
        bold: StandardFonts.CourierBold,
        italic: StandardFonts.CourierOblique,
        boldItalic: StandardFonts.CourierBoldOblique,
    },
};

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

    private static async applyAnnotations(doc: PDFDocument, page: PDFPage, annotations: Annotation[]) {
        const { width, height } = page.getSize();

        // Pre-embed all font variants we'll need
        const embeddedFonts: Record<string, Awaited<ReturnType<typeof doc.embedFont>>> = {};
        for (const [family, variants] of Object.entries(fontVariantMap)) {
            embeddedFonts[`${family}-regular`] = await doc.embedFont(variants.regular);
            embeddedFonts[`${family}-bold`] = await doc.embedFont(variants.bold);
            embeddedFonts[`${family}-italic`] = await doc.embedFont(variants.italic);
            embeddedFonts[`${family}-boldItalic`] = await doc.embedFont(variants.boldItalic);
        }

        const getFont = (family: string, bold: boolean, italic: boolean) => {
            const key = bold && italic ? 'boldItalic' : bold ? 'bold' : italic ? 'italic' : 'regular';
            const fontKey = `${family}-${key}`;
            return embeddedFonts[fontKey] || embeddedFonts['Helvetica-regular'];
        };

        for (const ann of annotations) {
            // Text annotations
            if (ann.type === 'text') {
                const style = ann.textStyle;
                const fontSize = style?.fontSize || 16;
                const color = style?.color ? hexToRgb(style.color) : { r: 0, g: 0, b: 0 };
                const isBold = style?.bold || false;
                const isItalic = style?.italic || false;
                const fontFamily = style?.fontFamily || 'Helvetica';

                const font = getFont(fontFamily, isBold, isItalic);
                const text = ann.payload as string;
                const textWidth = font.widthOfTextAtSize(text, fontSize);
                const textHeight = font.heightAtSize(fontSize);

                // React translates by -50% -50%, so ann.x/y is the center
                const xPt = ((ann.x / 100) * width) - (textWidth / 2);
                const centerY = height - ((ann.y / 100) * height);
                const yPt = centerY - (textHeight * 0.25);

                page.drawText(text, {
                    x: xPt,
                    y: yPt,
                    size: fontSize,
                    font,
                    color: rgb(color.r, color.g, color.b),
                });

                if (style?.underline) {
                    page.drawLine({
                        start: { x: xPt, y: yPt - 2 },
                        end: { x: xPt + textWidth, y: yPt - 2 },
                        thickness: 1,
                        color: rgb(color.r, color.g, color.b),
                    });
                }
            }

            // Link annotations
            if (ann.type === 'link') {
                const payload = ann.payload as LinkPayload;
                const font = getFont('Helvetica', false, false);
                const fontSize = 14;
                const text = payload.text;
                const textWidth = font.widthOfTextAtSize(text, fontSize);
                const textHeight = font.heightAtSize(fontSize);

                const xPt = ((ann.x / 100) * width) - (textWidth / 2);
                const centerY = height - ((ann.y / 100) * height);
                const yPt = centerY - (textHeight * 0.25);

                // Draw the link text in blue with underline
                page.drawText(text, {
                    x: xPt,
                    y: yPt,
                    size: fontSize,
                    font,
                    color: rgb(0.098, 0.325, 0.878), // blue-600
                });

                // Draw underline
                page.drawLine({
                    start: { x: xPt, y: yPt - 2 },
                    end: { x: xPt + textWidth, y: yPt - 2 },
                    thickness: 0.75,
                    color: rgb(0.098, 0.325, 0.878),
                });

                // Add clickable link annotation to the PDF using context.obj
                const context = doc.context;

                const linkAnnotDict = context.obj({
                    Type: 'Annot',
                    Subtype: 'Link',
                    Rect: [xPt, yPt - 4, xPt + textWidth, yPt + textHeight],
                    Border: [0, 0, 0],
                    F: 4,
                    A: {
                        Type: 'Action',
                        S: 'URI',
                        URI: payload.url,
                    },
                });

                const linkAnnotRef = context.register(linkAnnotDict);

                // Add annotation reference to the page's Annots array
                const existingAnnots = page.node.Annots();
                if (existingAnnots) {
                    existingAnnots.push(linkAnnotRef);
                } else {
                    page.node.set(
                        context.obj('Annots') as any,
                        context.obj([linkAnnotRef]),
                    );
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

            // Highlight / Draw stroke annotations — render as transparent PNG image
            if (ann.type === 'highlight' || ann.type === 'draw') {
                const points = ann.points || [];
                if (points.length < 2) continue;

                const strokeColor = ann.strokeColor || '#000000';
                const strokeWidth = ann.strokeWidth || 3;
                const opacity = ann.strokeOpacity ?? 1;

                // Create offscreen canvas at PDF page resolution
                const canvas = new OffscreenCanvas(Math.round(width), Math.round(height));
                const ctx = canvas.getContext('2d')!;

                // Parse hex color
                const colorHex = strokeColor.replace('#', '');
                const r = parseInt(colorHex.substring(0, 2), 16);
                const g = parseInt(colorHex.substring(2, 4), 16);
                const b = parseInt(colorHex.substring(4, 6), 16);

                ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${opacity})`;
                ctx.lineWidth = strokeWidth;
                ctx.lineCap = 'round';
                ctx.lineJoin = 'round';

                // Draw stroke path — points are in percentage coords, convert to canvas pixels
                ctx.beginPath();
                ctx.moveTo(
                    (points[0].x / 100) * width,
                    (points[0].y / 100) * height,
                );
                for (let i = 1; i < points.length; i++) {
                    ctx.lineTo(
                        (points[i].x / 100) * width,
                        (points[i].y / 100) * height,
                    );
                }
                ctx.stroke();

                // Convert to PNG blob and embed
                const blob = await canvas.convertToBlob({ type: 'image/png' });
                const arrayBuffer = await blob.arrayBuffer();
                const pngBytes = new Uint8Array(arrayBuffer);
                const pngImage = await doc.embedPng(pngBytes);

                // Draw as full-page overlay (transparent background, only stroke visible)
                page.drawImage(pngImage, {
                    x: 0,
                    y: 0,
                    width,
                    height,
                });
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
