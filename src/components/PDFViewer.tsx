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
  const { developers } = useDevelopers(); // Hook para obtener nombres de desarrolladores

  // Dividir el texto en páginas simuladas
  useEffect(() => {
    if (outputFormat === "text") {
      const words = text.split(" ");
      const wordsPerPage = 350; // Aproximadamente lo que cabe en una página A4
      const pageArray: string[] = [];

      for (let i = 0; i < words.length; i += wordsPerPage) {
        const pageWords = words.slice(i, i + wordsPerPage);
        pageArray.push(pageWords.join(" "));
      }

      setPages(pageArray);
      setCurrentPage(1);
    }
  }, [text, outputFormat]);

  const formatTimeElapsed = (seconds: number) => {
    if (seconds < 60) {
      return `${Math.floor(seconds)} seg`;
    }
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes} min ${remainingSeconds} seg`;
  };

  const convertToSRT = (text: string) => {
    const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
    let srt = "";
    sentences.forEach((sentence, index) => {
      const startSeconds = index * 3;
      const endSeconds = (index + 1) * 3;

      const formatTime = (totalSeconds: number) => {
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;
        return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")},000`;
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
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;
        return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.000`;
      };

      vtt += `${index + 1}\n${formatTime(startSeconds)} --> ${formatTime(endSeconds)}\n${sentence.trim()}\n\n`;
    });
    return vtt;
  };

  const convertToJSON = () => {
    return JSON.stringify(
      {
        fileName: fileName,
        languageCode: languageCode,
        confidence: confidence,
        transcriptionTime: transcriptionTime,
        text: text,
        timestamp: new Date().toISOString(),
      },
      null,
      2,
    );
  };

  const getFormattedContent = () => {
    switch (outputFormat) {
      case "srt":
        return convertToSRT(text);
      case "vtt":
        return convertToVTT(text);
      case "json":
        return convertToJSON();
      default:
        return text;
    }
  };

  const downloadAsPDF = async () => {
    const pdf = new jsPDF("p", "mm", "a4");
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 20;
    const contentWidth = pageWidth - 2 * margin;
    let currentY = 20;

    // Cargar el logo como imagen
    const logoImg = new Image();
    logoImg.src = pdfLogo;

    await new Promise((resolve) => {
      logoImg.onload = resolve;
    });

    // 🔥 HEADER CON GRADIENTE AZUL SIMULADO (múltiples franjas)
    // Simular gradiente con 20 franjas de color desde azul oscuro a azul claro
    const numStrips = 20;
    const stripWidth = pageWidth / numStrips;

    for (let i = 0; i < numStrips; i++) {
      // Interpolar colores entre #003B7E y #00BCD4
      const ratio = i / (numStrips - 1);

      // Color inicial: #003B7E (0, 59, 126)
      // Color final: #00BCD4 (0, 188, 212)
      const r = Math.round(0 + (0 - 0) * ratio);
      const g = Math.round(59 + (188 - 59) * ratio);
      const b = Math.round(126 + (212 - 126) * ratio);

      pdf.setFillColor(r, g, b);
      pdf.rect(i * stripWidth, 0, stripWidth + 1, 50, "F"); // +1 para evitar gaps
    }

    // 🔥 LOGO MÁS GRANDE Y VISIBLE
    const logoWidth = 60;
    const logoHeight = 35;
    const logoX = pageWidth - margin - logoWidth;
    const logoY = 8;

    pdf.addImage(logoImg, "PNG", logoX, logoY, logoWidth, logoHeight);

    // 🔥 TEXTO DEL HEADER MÁS GRANDE Y LEGIBLE
    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(26);
    pdf.setFont("helvetica", "bold");
    pdf.text("Transcripción de Audio", margin, 24);

    pdf.setFontSize(12);
    pdf.setFont("helvetica", "normal");
    pdf.text("Sistema de Transcripción Automática", margin, 35);

    currentY = 60;

    // Metadata boxes
    pdf.setTextColor(74, 85, 104);
    pdf.setFontSize(9);

    const metadataY = currentY;
    let metadataX = margin;

    // Fecha
    pdf.setFillColor(245, 247, 250);
    pdf.roundedRect(metadataX, metadataY, 55, 18, 2, 2, "F");
    pdf.setFont("helvetica", "normal");
    pdf.text("Fecha", metadataX + 3, metadataY + 6);
    pdf.setFont("helvetica", "bold");
    pdf.setTextColor(26, 32, 44);
    pdf.setFontSize(10);
    pdf.text(
      new Date().toLocaleDateString("es-ES", {
        year: "numeric",
        month: "short",
        day: "numeric",
      }),
      metadataX + 3,
      metadataY + 13,
    );

    metadataX += 60;

    // Idioma
    if (languageCode) {
      pdf.setFillColor(245, 247, 250);
      pdf.roundedRect(metadataX, metadataY, 55, 18, 2, 2, "F");
      pdf.setTextColor(74, 85, 104);
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(9);
      pdf.text("Idioma", metadataX + 3, metadataY + 6);
      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(26, 32, 44);
      pdf.setFontSize(10);
      pdf.text(languageCode.toUpperCase(), metadataX + 3, metadataY + 13);
      metadataX += 60;
    }

    // Confianza
    if (confidence) {
      pdf.setFillColor(245, 247, 250);
      pdf.roundedRect(metadataX, metadataY, 55, 18, 2, 2, "F");
      pdf.setTextColor(74, 85, 104);
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(9);
      pdf.text("Confianza", metadataX + 3, metadataY + 6);
      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(26, 32, 44);
      pdf.setFontSize(10);
      pdf.text(
        `${(confidence * 100).toFixed(0)}%`,
        metadataX + 3,
        metadataY + 13,
      );
    }

    currentY = metadataY + 25;

    // Tiempo de procesamiento
    if (transcriptionTime && transcriptionTime > 0) {
      pdf.setFillColor(245, 247, 250);
      pdf.roundedRect(margin, currentY, 115, 18, 2, 2, "F");
      pdf.setTextColor(74, 85, 104);
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(9);
      pdf.text("Tiempo de procesamiento", margin + 3, currentY + 6);
      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(26, 32, 44);
      pdf.setFontSize(10);
      pdf.text(formatTimeElapsed(transcriptionTime), margin + 3, currentY + 13);
      currentY += 25;
    }

    // Content section
    pdf.setDrawColor(226, 232, 240);
    pdf.setLineWidth(0.5);
    pdf.line(margin, currentY, pageWidth - margin, currentY);
    currentY += 8;

    pdf.setTextColor(31, 58, 95);
    pdf.setFontSize(14);
    pdf.setFont("helvetica", "bold");
    pdf.text("Transcripción", margin, currentY);
    currentY += 8;

    // Content text
    pdf.setTextColor(26, 32, 44);
    pdf.setFontSize(11);
    pdf.setFont("helvetica", "normal");

    const lines = pdf.splitTextToSize(text, contentWidth);

    for (let i = 0; i < lines.length; i++) {
      if (currentY + 10 > pageHeight - 40) {
        pdf.addPage();
        currentY = 20;
      }
      pdf.text(lines[i], margin, currentY);
      currentY += 6;
    }

    // Footer con créditos usando el array de desarrolladores
    const footerY = pageHeight - 25;
    pdf.setDrawColor(226, 232, 240);
    pdf.setLineWidth(0.3);
    pdf.line(margin, footerY - 5, pageWidth - margin, footerY - 5);

    pdf.setTextColor(74, 85, 104);
    pdf.setFontSize(9);
    pdf.setFont("helvetica", "normal");
    pdf.text("Desarrollado por:", pageWidth / 2, footerY, { align: "center" });

    pdf.setFontSize(8);
    // Usar el hook en lugar de nombres hardcodeados
    developers.forEach((dev, index) => {
      pdf.text(dev, pageWidth / 2, footerY + 5 + (index * 5), {
        align: "center",
      });
    });

    // Guardar el PDF
    pdf.save(`transcripcion-${Date.now()}.pdf`);
  };

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
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `transcripcion-${Date.now()}.${extensions[outputFormat]}`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  const totalPages = pages.length;

  return (
    <div
      className="bg-white shadow-lg rounded-lg overflow-hidden"
      style={{ maxWidth: "900px", margin: "0 auto" }}
    >
      {/* Format Selector */}
      <div className="px-6 py-4 bg-white border-b border-gray-200">
        <label className="block mb-2 text-sm">
          <strong>Formato de exportación:</strong>
        </label>
        <div className="grid grid-cols-4 gap-2">
          <button
            type="button"
            onClick={() => onFormatChange("text")}
            className={`px-3 py-2 rounded-lg text-sm border-2 transition-all ${
              outputFormat === "text"
                ? "border-[var(--color-accent)] bg-blue-50 text-[var(--color-accent)]"
                : "border-gray-300 hover:border-[var(--color-accent)]"
            }`}
          >
            <FileText className="w-4 h-4 mx-auto mb-1" />
            PDF
          </button>
          <button
            type="button"
            onClick={() => onFormatChange("srt")}
            className={`px-3 py-2 rounded-lg text-sm border-2 transition-all ${
              outputFormat === "srt"
                ? "border-[var(--color-accent)] bg-blue-50 text-[var(--color-accent)]"
                : "border-gray-300 hover:border-[var(--color-accent)]"
            }`}
          >
            <FileText className="w-4 h-4 mx-auto mb-1" />
            SRT
          </button>
          <button
            type="button"
            onClick={() => onFormatChange("vtt")}
            className={`px-3 py-2 rounded-lg text-sm border-2 transition-all ${
              outputFormat === "vtt"
                ? "border-[var(--color-accent)] bg-blue-50 text-[var(--color-accent)]"
                : "border-gray-300 hover:border-[var(--color-accent)]"
            }`}
          >
            <FileText className="w-4 h-4 mx-auto mb-1" />
            VTT
          </button>
          <button
            type="button"
            onClick={() => onFormatChange("json")}
            className={`px-3 py-2 rounded-lg text-sm border-2 transition-all ${
              outputFormat === "json"
                ? "border-[var(--color-accent)] bg-blue-50 text-[var(--color-accent)]"
                : "border-gray-300 hover:border-[var(--color-accent)]"
            }`}
          >
            <FileCode className="w-4 h-4 mx-auto mb-1" />
            JSON
          </button>
        </div>
      </div>

      {/* Vista previa tipo PDF */}
      <div className="px-6 py-6 bg-[var(--color-background)]">
        <div className="mb-4">
          <h3 className="pb-2">Vista previa del documento</h3>
          <p className="text-xs text-[var(--color-secondary)]">
            Esta es una representación de cómo se verá tu documento al
            descargarlo
          </p>
        </div>

        {/* PDF Preview Container */}
        <div className="bg-gray-400 p-4 rounded-lg">
          {outputFormat === "text" ? (
            // Vista previa estilo PDF con páginas
            <div className="space-y-4">
              {/* Primera página con header y metadata */}
              {currentPage === 1 && (
                <div
                  className="bg-white shadow-2xl mx-auto"
                  style={{
                    width: "210mm",
                    minHeight: "297mm",
                    aspectRatio: "210/297",
                  }}
                >
                  <div
                    className="p-8 h-full flex flex-col"
                    style={{ fontSize: "11pt" }}
                  >
                    {/* PDF Header idéntico al generado en jsPDF */}
                    <div className="-mx-8 -mt-8 mb-6 relative h-[50px] overflow-hidden">
                      {/* Franjas que simulan el gradiente igual que jsPDF */}
                      <div className="absolute inset-0 flex">
                        {Array.from({ length: 20 }).map((_, i) => {
                          const ratio = i / 19;

                          const r = 0;
                          const g = Math.round(59 + (188 - 59) * ratio);
                          const b = Math.round(126 + (212 - 126) * ratio);

                          return (
                            <div
                              key={i}
                              style={{
                                backgroundColor: `rgb(${r}, ${g}, ${b})`,
                                width: "5%",
                              }}
                            />
                          );
                        })}
                      </div>

                      {/* Contenido del header */}
                      <div className="relative z-10 flex items-start justify-between px-6 py-6 text-white">
                        {/* Texto izquierda */}
                        <div>
                          <h2
                            className="text-white mb-1"
                            style={{
                              fontSize: "26pt",
                              fontWeight: "bold",
                              fontFamily: "Helvetica, Arial, sans-serif",
                            }}
                          >
                            Transcripción de Audio
                          </h2>
                          <p
                            className="text-blue-100"
                            style={{
                              fontSize: "12pt",
                              fontFamily: "Helvetica, Arial, sans-serif",
                            }}
                          >
                            Sistema de Transcripción Automática
                          </p>
                        </div>

                        {/* Logo derecha */}
                        <div className="flex-shrink-0">
                          <img
                            src={pdfLogo}
                            alt="STA Logo"
                            className="h-16 w-auto object-contain"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Metadata Grid */}
                    <div className="grid grid-cols-3 gap-3 mb-4">
                      <div className="bg-[#F5F7FA] p-3 rounded-lg">
                        <p className="text-xs text-[#4A5568] mb-1">Fecha</p>
                        <p className="font-semibold text-sm text-[#1A202C]">
                          {new Date().toLocaleDateString("es-ES", {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                          })}
                        </p>
                      </div>
                      {languageCode && (
                        <div className="bg-[#F5F7FA] p-3 rounded-lg">
                          <p className="text-xs text-[#4A5568] mb-1">Idioma</p>
                          <p className="font-semibold text-sm text-[#1A202C]">
                            {languageCode.toUpperCase()}
                          </p>
                        </div>
                      )}
                      {confidence && (
                        <div className="bg-[#F5F7FA] p-3 rounded-lg">
                          <p className="text-xs text-[#4A5568] mb-1">
                            Confianza
                          </p>
                          <p className="font-semibold text-sm text-[#1A202C]">
                            {(confidence * 100).toFixed(0)}%
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Tiempo de procesamiento */}
                    {transcriptionTime && transcriptionTime > 0 && (
                      <div className="bg-[#F5F7FA] p-3 rounded-lg mb-4 inline-block">
                        <p className="text-xs text-[#4A5568] mb-1">
                          Tiempo de procesamiento
                        </p>
                        <p className="font-semibold text-sm text-[#2B6CB0]">
                          {formatTimeElapsed(transcriptionTime)}
                        </p>
                      </div>
                    )}

                    {/* Divider */}
                    <div className="border-t-2 border-gray-200 my-4"></div>

                    {/* Content Title */}
                    <h3
                      className="mb-4"
                      style={{
                        color: "#1F3A5F",
                        fontSize: "14pt",
                        fontWeight: "bold",
                        fontFamily: "Helvetica, Arial, sans-serif",
                      }}
                    >
                      Transcripción
                    </h3>

                    {/* Content Text - Primera página */}
                    <div
                      className="flex-1 text-[#1A202C] leading-relaxed text-justify overflow-hidden"
                      style={{
                        fontSize: "11pt",
                        lineHeight: "1.6",
                        fontFamily: "Helvetica, Arial, sans-serif",
                      }}
                    >
                      {pages[0]}
                    </div>

                    {/* Footer usando el componente DeveloperCredits */}
                    <div className="border-t border-gray-200 mt-4 pt-3">
                      <DeveloperCredits variant="compact" />
                    </div>

                    {/* Número de página */}
                    <div className="text-center mt-2">
                      <p className="text-xs text-[#4A5568]">
                        Página 1 de {totalPages}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Páginas siguientes - solo contenido */}
              {currentPage > 1 && (
                <div
                  className="bg-white shadow-2xl mx-auto"
                  style={{
                    width: "210mm",
                    minHeight: "297mm",
                    aspectRatio: "210/297",
                  }}
                >
                  <div
                    className="p-8 h-full flex flex-col"
                    style={{ fontSize: "11pt" }}
                  >
                    {/* Content Text */}
                    <div
                      className="flex-1 text-[#1A202C] leading-relaxed text-justify"
                      style={{
                        fontSize: "11pt",
                        lineHeight: "1.8",
                        fontFamily: "Georgia, serif",
                      }}
                    >
                      {pages[currentPage - 1]}
                    </div>

                    {/* Footer usando el componente DeveloperCredits */}
                    <div className="border-t border-gray-200 mt-4 pt-3">
                      <DeveloperCredits variant="compact" />
                    </div>

                    {/* Número de página */}
                    <div className="text-center mt-2">
                      <p className="text-xs text-[#4A5568]">
                        Página {currentPage} de {totalPages}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            // Vista previa para otros formatos
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

        {/* Controles de navegación de páginas */}
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
              Página <strong>{currentPage}</strong> de{" "}
              <strong>{totalPages}</strong>
            </div>

            <button
              onClick={() =>
                setCurrentPage(Math.min(totalPages, currentPage + 1))
              }
              disabled={currentPage === totalPages}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              Siguiente
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}

        <p className="text-xs text-[var(--color-secondary)] mt-3 text-center">
          💡 Navega entre las páginas para ver cómo se verá tu documento
          completo
        </p>
      </div>

      {/* Download Button */}
      <div className="px-6 py-4 bg-white border-t border-gray-200">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          {/* Usar el componente DeveloperCredits en lugar de texto hardcodeado */}
          <DeveloperCredits variant="footer" className="text-center md:text-left" />
          
          <button
            onClick={downloadFile}
            className="flex items-center gap-2 px-6 py-3 bg-[var(--color-accent)] text-white rounded-lg hover:bg-[var(--color-primary)] transition-all shadow-md hover:shadow-lg whitespace-nowrap"
          >
            <Download className="w-4 h-4" />
            Descargar{" "}
            {outputFormat === "text" ? "PDF" : outputFormat.toUpperCase()}
          </button>
        </div>
      </div>
    </div>
  );
}