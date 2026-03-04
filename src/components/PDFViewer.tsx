/* eslint-disable react/react-in-jsx-scope */
import {
  Download,
  FileText,
  Clock,
  FileCode,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import jsPDF from "jspdf";
import { useState, useEffect } from "react";
import pdfLogo from "/images/Logo_STA_Slogan.png";
import { DeveloperCredits, useDevelopers } from './DeveloperCredits';

interface PDFViewerProps {
  text: string;
  fileName?: string;
  languageCode?: string;
  confidence?: number;
  transcriptionTime?: number;
  outputFormat: "text" | "srt" | "vtt" | "json";
  onFormatChange: (format: "text" | "srt" | "vtt" | "json") => void;
}

export function PDFViewer({
  text,
  fileName = "audio",
  languageCode,
  confidence,
  transcriptionTime,
  outputFormat,
  onFormatChange,
}: PDFViewerProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const [pages, setPages] = useState<string[]>([]);
  const { developers } = useDevelopers();

  // ─── Helpers ────────────────────────────────────────────────────────────────

  /**
   * Convierte segundos totales a "Xm Ys" o "Ys" de forma legible.
   * Recibe un número float (ej. 125.4) y devuelve "2 min 5 seg".
   */
  const formatTimeElapsed = (seconds: number): string => {
    const total = Math.round(seconds); // redondear al entero más cercano
    if (total < 60) return `${total} seg`;
    const minutes = Math.floor(total / 60);
    const remainingSeconds = total % 60;
    return `${minutes} min ${remainingSeconds} seg`;
  };

  /**
   * Divide el texto en párrafos usando saltos de línea o, si no los hay,
   * agrupa oraciones cada N palabras para dar respiración visual al texto.
   */
  const textToParagraphs = (raw: string): string[] => {
    // Si el texto ya tiene saltos de línea reales los usamos
    const byNewLine = raw
      .split(/\n{1,}/)
      .map((p) => p.trim())
      .filter(Boolean);

    if (byNewLine.length > 1) return byNewLine;

    // Si no hay saltos, dividir por oraciones y agrupar de a 4
    const sentences = raw.match(/[^.!?]+[.!?]+["']?/g) || [raw];
    const grouped: string[] = [];
    const chunkSize = 4; // oraciones por párrafo
    for (let i = 0; i < sentences.length; i += chunkSize) {
      grouped.push(
        sentences
          .slice(i, i + chunkSize)
          .map((s) => s.trim())
          .join(" ")
      );
    }
    return grouped.length ? grouped : [raw];
  };

  // ─── Paginación para vista previa ────────────────────────────────────────────
  useEffect(() => {
    if (outputFormat === "text") {
      const paragraphs = textToParagraphs(text);
      const wordsPerPage = 300;
      const pageArray: string[] = [];
      let currentWords: string[] = [];
      let currentParas: string[] = [];

      for (const para of paragraphs) {
        const words = para.split(" ");
        if (currentWords.length + words.length > wordsPerPage && currentParas.length) {
          pageArray.push(currentParas.join("\n\n"));
          currentParas = [];
          currentWords = [];
        }
        currentParas.push(para);
        currentWords.push(...words);
      }
      if (currentParas.length) pageArray.push(currentParas.join("\n\n"));

      setPages(pageArray.length ? pageArray : [text]);
      setCurrentPage(1);
    }
  }, [text, outputFormat]);

  // ─── Conversiones de formato ─────────────────────────────────────────────────
  const convertToSRT = (text: string) => {
    const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
    let srt = "";
    sentences.forEach((sentence, index) => {
      const startSeconds = index * 3;
      const endSeconds = (index + 1) * 3;
      const formatTime = (totalSeconds: number) => {
        const h = Math.floor(totalSeconds / 3600);
        const m = Math.floor((totalSeconds % 3600) / 60);
        const s = totalSeconds % 60;
        return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")},000`;
      };
      srt += `${index + 1}\n${formatTime(startSeconds)} --> ${formatTime(endSeconds)}\n${sentence.trim()}\n\n`;
    });
    return srt;
  };

  const convertToVTT = (text: string) => {
    const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
    let vtt = "WEBVTT\n\n";
    sentences.forEach((sentence, index) => {
      const startSeconds = index * 3;
      const endSeconds = (index + 1) * 3;
      const formatTime = (totalSeconds: number) => {
        const h = Math.floor(totalSeconds / 3600);
        const m = Math.floor((totalSeconds % 3600) / 60);
        const s = totalSeconds % 60;
        return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.000`;
      };
      vtt += `${index + 1}\n${formatTime(startSeconds)} --> ${formatTime(endSeconds)}\n${sentence.trim()}\n\n`;
    });
    return vtt;
  };

  const convertToJSON = () => {
    return JSON.stringify(
      {
        fileName,
        languageCode,
        confidence,
        transcriptionTime,
        text,
        timestamp: new Date().toISOString(),
      },
      null,
      2
    );
  };

  const getFormattedContent = () => {
    switch (outputFormat) {
      case "srt":  return convertToSRT(text);
      case "vtt":  return convertToVTT(text);
      case "json": return convertToJSON();
      default:     return text;
    }
  };

  // ─── Generación del PDF ───────────────────────────────────────────────────────
  const downloadAsPDF = async () => {
    const pdf = new jsPDF("p", "mm", "a4");
    const pageWidth  = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin       = 20;
    const contentWidth = pageWidth - 2 * margin;
    let currentY = 20;

    // ── Logo ──────────────────────────────────────────────────────────────────
    const logoImg = new Image();
    logoImg.src = pdfLogo;
    await new Promise((resolve) => { logoImg.onload = resolve; });

    // ── Header con gradiente simulado ─────────────────────────────────────────
    const numStrips = 20;
    const stripWidth = pageWidth / numStrips;
    for (let i = 0; i < numStrips; i++) {
      const ratio = i / (numStrips - 1);
      const g = Math.round(59  + (188 - 59)  * ratio);
      const b = Math.round(126 + (212 - 126) * ratio);
      pdf.setFillColor(0, g, b);
      pdf.rect(i * stripWidth, 0, stripWidth + 1, 50, "F");
    }

    const logoWidth  = 60;
    const logoHeight = 35;
    pdf.addImage(logoImg, "PNG", pageWidth - margin - logoWidth, 8, logoWidth, logoHeight);

    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(26);
    pdf.setFont("helvetica", "bold");
    pdf.text("Transcripción de Audio", margin, 24);

    pdf.setFontSize(12);
    pdf.setFont("helvetica", "normal");
    pdf.text("Sistema de Transcripción Automática", margin, 35);

    currentY = 60;

    // ── Metadata: SOLO la fecha en el PDF ────────────────────────────────────
    const metadataY = currentY;
    pdf.setFillColor(245, 247, 250);
    pdf.roundedRect(margin, metadataY, 70, 18, 2, 2, "F");
    pdf.setTextColor(74, 85, 104);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9);
    pdf.text("Fecha de transcripción", margin + 3, metadataY + 6);
    pdf.setFont("helvetica", "bold");
    pdf.setTextColor(26, 32, 44);
    pdf.setFontSize(10);
    pdf.text(
      new Date().toLocaleDateString("es-ES", { year: "numeric", month: "long", day: "numeric" }),
      margin + 3,
      metadataY + 13
    );

    currentY = metadataY + 28;

    // ── Divisor y título de sección ───────────────────────────────────────────
    pdf.setDrawColor(226, 232, 240);
    pdf.setLineWidth(0.5);
    pdf.line(margin, currentY, pageWidth - margin, currentY);
    currentY += 8;

    pdf.setTextColor(31, 58, 95);
    pdf.setFontSize(14);
    pdf.setFont("helvetica", "bold");
    pdf.text("Transcripción", margin, currentY);
    currentY += 10;

    // ── Cuerpo del texto: párrafo por párrafo ─────────────────────────────────
    pdf.setTextColor(26, 32, 44);
    pdf.setFontSize(11);
    pdf.setFont("helvetica", "normal");

    const lineHeight      = 6;   // mm por línea
    const paragraphSpacing = 4;  // mm extra entre párrafos
    const paragraphs = textToParagraphs(text);

    for (const para of paragraphs) {
      // Sangría de primera línea (4 mm)
      const indentedPara = `    ${para}`;
      const lines = pdf.splitTextToSize(indentedPara, contentWidth);

      for (let li = 0; li < lines.length; li++) {
        if (currentY + lineHeight > pageHeight - 30) {
          pdf.addPage();
          currentY = 20;
        }
        pdf.text(lines[li], margin, currentY);
        currentY += lineHeight;
      }
      // Espacio adicional al final de cada párrafo
      currentY += paragraphSpacing;
    }

    // ── Footer con créditos ───────────────────────────────────────────────────
    const footerY = pageHeight - 25;
    pdf.setDrawColor(226, 232, 240);
    pdf.setLineWidth(0.3);
    pdf.line(margin, footerY - 5, pageWidth - margin, footerY - 5);

    pdf.setTextColor(74, 85, 104);
    pdf.setFontSize(9);
    pdf.setFont("helvetica", "normal");
    pdf.text("Desarrollado por:", pageWidth / 2, footerY, { align: "center" });

    pdf.setFontSize(8);
    developers.forEach((dev, index) => {
      pdf.text(dev, pageWidth / 2, footerY + 5 + index * 5, { align: "center" });
    });

    pdf.save(`transcripcion-${Date.now()}.pdf`);
  };

  // ─── Descarga genérica ────────────────────────────────────────────────────────
  const downloadFile = () => {
    if (outputFormat === "text") {
      downloadAsPDF();
    } else {
      const content = getFormattedContent();
      const extensions = { text: "pdf", srt: "srt", vtt: "vtt", json: "json" };
      const mimeTypes = {
        text: "application/pdf",
        srt: "text/srt",
        vtt: "text/vtt",
        json: "application/json",
      };
      const blob = new Blob([content], { type: mimeTypes[outputFormat] });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href     = url;
      a.download = `transcripcion-${Date.now()}.${extensions[outputFormat]}`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  const totalPages = pages.length;

  // ─── Render ───────────────────────────────────────────────────────────────────
  return (
    <div
      className="bg-white shadow-lg rounded-lg overflow-hidden"
      style={{ maxWidth: "900px", margin: "0 auto" }}
    >
      {/* Selector de formato */}
      <div className="px-6 py-4 bg-white border-b border-gray-200">
        <label className="block mb-2 text-sm">
          <strong>Formato de exportación:</strong>
        </label>
        <div className="grid grid-cols-4 gap-2">
          {(["text", "srt", "vtt", "json"] as const).map((fmt) => (
            <button
              key={fmt}
              type="button"
              onClick={() => onFormatChange(fmt)}
              className={`px-3 py-2 rounded-lg text-sm border-2 transition-all ${
                outputFormat === fmt
                  ? "border-[var(--color-accent)] bg-blue-50 text-[var(--color-accent)]"
                  : "border-gray-300 hover:border-[var(--color-accent)]"
              }`}
            >
              {fmt === "json" ? (
                <FileCode className="w-4 h-4 mx-auto mb-1" />
              ) : (
                <FileText className="w-4 h-4 mx-auto mb-1" />
              )}
              {fmt === "text" ? "PDF" : fmt.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Vista previa */}
      <div className="px-6 py-6 bg-[var(--color-background)]">
        <div className="mb-4">
          <h3 className="pb-2">Vista previa del documento</h3>
          <p className="text-xs text-[var(--color-secondary)]">
            Esta es una representación de cómo se verá tu documento al descargarlo
          </p>
        </div>

        <div className="bg-gray-400 p-4 rounded-lg">
          {outputFormat === "text" ? (
            <div className="space-y-4">
              {/* ── Página 1: con header y metadata ── */}
              {currentPage === 1 && (
                <div
                  className="bg-white shadow-2xl mx-auto"
                  style={{ width: "210mm", minHeight: "297mm", aspectRatio: "210/297" }}
                >
                  <div className="p-8 h-full flex flex-col" style={{ fontSize: "11pt" }}>
                    {/* Header degradado */}
                    <div className="-mx-8 -mt-8 mb-6 relative h-[50px] overflow-hidden">
                      <div className="absolute inset-0 flex">
                        {Array.from({ length: 20 }).map((_, i) => {
                          const ratio = i / 19;
                          const g = Math.round(59  + (188 - 59)  * ratio);
                          const b = Math.round(126 + (212 - 126) * ratio);
                          return (
                            <div
                              key={i}
                              style={{ backgroundColor: `rgb(0, ${g}, ${b})`, width: "5%" }}
                            />
                          );
                        })}
                      </div>
                      <div className="relative z-10 flex items-start justify-between px-6 py-6 text-white">
                        <div>
                          <h2
                            className="text-white mb-1"
                            style={{ fontSize: "26pt", fontWeight: "bold", fontFamily: "Helvetica, Arial, sans-serif" }}
                          >
                            Transcripción de Audio
                          </h2>
                          <p className="text-blue-100" style={{ fontSize: "12pt", fontFamily: "Helvetica, Arial, sans-serif" }}>
                            Sistema de Transcripción Automática
                          </p>
                        </div>
                        <div className="flex-shrink-0">
                          <img src={pdfLogo} alt="STA Logo" className="h-16 w-auto object-contain" />
                        </div>
                      </div>
                    </div>

                    {/* Metadata: SOLO fecha + idioma (confianza y tiempo solo en vista) */}
                    <div className="flex gap-3 mb-4 flex-wrap">
                      <div className="bg-[#F5F7FA] p-3 rounded-lg">
                        <p className="text-xs text-[#4A5568] mb-1">Fecha de transcripción</p>
                        <p className="font-semibold text-sm text-[#1A202C]">
                          {new Date().toLocaleDateString("es-ES", { year: "numeric", month: "long", day: "numeric" })}
                        </p>
                      </div>
                      {languageCode && (
                        <div className="bg-[#F5F7FA] p-3 rounded-lg">
                          <p className="text-xs text-[#4A5568] mb-1">Idioma detectado</p>
                          <p className="font-semibold text-sm text-[#1A202C]">{languageCode.toUpperCase()}</p>
                        </div>
                      )}
                    </div>

                    {/* Confianza y tiempo — solo vista previa, NO en el PDF descargado */}
                    <div className="flex gap-3 mb-4 flex-wrap">
                      {confidence && (
                        <div className="bg-blue-50 border border-blue-200 p-3 rounded-lg">
                          <p className="text-xs text-[#4A5568] mb-1">Confianza</p>
                          <p className="font-semibold text-sm text-[#1A202C]">
                            {(confidence * 100).toFixed(0)}%
                          </p>
                        </div>
                      )}
                      {transcriptionTime && transcriptionTime > 0 && (
                        <div className="bg-blue-50 border border-blue-200 p-3 rounded-lg">
                          <p className="text-xs text-[#4A5568] mb-1 flex items-center gap-1">
                            <Clock className="w-3 h-3" /> Tiempo de procesamiento
                          </p>
                          <p className="font-semibold text-sm text-[#2B6CB0]">
                            {formatTimeElapsed(transcriptionTime)}
                          </p>
                        </div>
                      )}
                      {(confidence || (transcriptionTime && transcriptionTime > 0)) && (
                        <p className="text-xs text-gray-400 self-end mb-1">
                          * estos datos no se incluyen en el PDF
                        </p>
                      )}
                    </div>

                    {/* Divisor */}
                    <div className="border-t-2 border-gray-200 my-4" />

                    {/* Título sección */}
                    <h3
                      className="mb-4"
                      style={{ color: "#1F3A5F", fontSize: "14pt", fontWeight: "bold", fontFamily: "Helvetica, Arial, sans-serif" }}
                    >
                      Transcripción
                    </h3>

                    {/* Texto con párrafos */}
                    <div
                      className="flex-1 text-[#1A202C] overflow-hidden"
                      style={{ fontSize: "11pt", fontFamily: "Helvetica, Arial, sans-serif" }}
                    >
                      {pages[0]?.split("\n\n").map((para, i) => (
                        <p
                          key={i}
                          className="mb-3 text-justify leading-relaxed"
                          style={{ textIndent: "1.5em" }}
                        >
                          {para}
                        </p>
                      ))}
                    </div>

                    {/* Footer */}
                    <div className="border-t border-gray-200 mt-4 pt-3">
                      <DeveloperCredits variant="compact" />
                    </div>
                    <div className="text-center mt-2">
                      <p className="text-xs text-[#4A5568]">Página 1 de {totalPages}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* ── Páginas siguientes ── */}
              {currentPage > 1 && (
                <div
                  className="bg-white shadow-2xl mx-auto"
                  style={{ width: "210mm", minHeight: "297mm", aspectRatio: "210/297" }}
                >
                  <div className="p-8 h-full flex flex-col" style={{ fontSize: "11pt" }}>
                    <div
                      className="flex-1 text-[#1A202C]"
                      style={{ fontSize: "11pt", fontFamily: "Helvetica, Arial, sans-serif" }}
                    >
                      {pages[currentPage - 1]?.split("\n\n").map((para, i) => (
                        <p
                          key={i}
                          className="mb-3 text-justify leading-relaxed"
                          style={{ textIndent: "1.5em" }}
                        >
                          {para}
                        </p>
                      ))}
                    </div>
                    <div className="border-t border-gray-200 mt-4 pt-3">
                      <DeveloperCredits variant="compact" />
                    </div>
                    <div className="text-center mt-2">
                      <p className="text-xs text-[#4A5568]">Página {currentPage} de {totalPages}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            // Vista previa otros formatos
            <div
              className="bg-white shadow-2xl mx-auto p-6"
              style={{ width: "210mm", minHeight: "297mm" }}
            >
              <pre className="whitespace-pre-wrap font-mono text-sm text-[var(--color-text)] leading-relaxed">
                {getFormattedContent()}
              </pre>
            </div>
          )}
        </div>

        {/* Controles de paginación */}
        {outputFormat === "text" && totalPages > 1 && (
          <div className="flex items-center justify-center gap-4 mt-4">
            <button
              onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              <ChevronLeft className="w-4 h-4" />
              Anterior
            </button>
            <div className="text-sm text-[var(--color-secondary)]">
              Página <strong>{currentPage}</strong> de <strong>{totalPages}</strong>
            </div>
            <button
              onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage === totalPages}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              Siguiente
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}

        <p className="text-xs text-[var(--color-secondary)] mt-3 text-center">
          Navega entre las páginas para ver cómo se verá tu documento completo
        </p>
      </div>

      {/* Botón de descarga */}
      <div className="px-6 py-4 bg-white border-t border-gray-200">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          <DeveloperCredits variant="footer" className="text-center md:text-left" />
          <button
            onClick={downloadFile}
            className="flex items-center gap-2 px-6 py-3 bg-[var(--color-accent)] text-white rounded-lg hover:bg-[var(--color-primary)] transition-all shadow-md hover:shadow-lg whitespace-nowrap"
          >
            <Download className="w-4 h-4" />
            Descargar {outputFormat === "text" ? "PDF" : outputFormat.toUpperCase()}
          </button>
        </div>
      </div>
    </div>
  );
}