/* eslint-disable react/react-in-jsx-scope */
import { useState } from 'react';
import { Upload, Loader2, CheckCircle, XCircle, Music, FileAudio, Clock } from 'lucide-react';
import { PDFViewer } from './PDFViewer';
import { DeveloperCredits } from './DeveloperCredits';

const API_BASE_URL = 'http://localhost:5000';

type OutputFormat = 'text' | 'srt' | 'vtt' | 'json';

export function TranscribeFile() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [transcriptionStatus, setTranscriptionStatus] = useState<string>('');
  const [progress, setProgress] = useState<number>(0);
  const [outputFormat, setOutputFormat] = useState<OutputFormat>('text');
  const [transcriptionTime, setTranscriptionTime] = useState<number>(0);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setResponse(null);
      setError(null);
      setTranscriptionStatus('');
      setTranscriptionTime(0);
      setProgress(0);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setFile(e.dataTransfer.files[0]);
      setResponse(null);
      setError(null);
      setTranscriptionStatus('');
      setTranscriptionTime(0);
      setProgress(0);
    }
  };

  /**
   * Polling del estado de la transcripción.
   * Recibe `uploadStartTime` como parámetro para evitar el problema de closure
   * con el estado de React (que siempre leería el valor inicial 0).
   */
  const pollTranscriptionStatus = async (
    transcriptId: string,
    uploadStartTime: number   // ← parámetro en lugar de leer el estado
  ) => {
    const maxAttempts = 300;
    let attempts = 0;

    const checkStatus = async (): Promise<void> => {
      try {
        attempts++;
        setProgress(Math.min((attempts / maxAttempts) * 100, 95));

        console.log(`🔍 [POLLING ${attempts}] transcript_id: ${transcriptId}`);

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000);

        const statusRes = await fetch(`${API_BASE_URL}/status/${transcriptId}`, {
          headers: { 'Accept': 'application/json' },
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        const statusData = await statusRes.json();
        console.log(`📊 [POLLING ${attempts}] Estado: ${statusData.status}`);

        if (statusData.status === 'completed') {
          setProgress(100);
          setTranscriptionStatus('✅ Transcripción completada');

          // ✅ CORRECCIÓN: usar el parámetro, no el estado de React
          const elapsed = (Date.now() - uploadStartTime) / 1000;
          setTranscriptionTime(elapsed);
          console.log(`🎉 [COMPLETADO] Tiempo total: ${elapsed.toFixed(2)}s`);

          setResponse({ status: 200, data: statusData });
          setLoading(false);

        } else if (statusData.status === 'error') {
          console.error('❌ [ERROR]', statusData.error);
          setError(statusData.error || 'Error en la transcripción');
          setLoading(false);

        } else {
          // Aún procesando
          const elapsed = Math.floor(attempts * 3);
          const minutes = Math.floor(elapsed / 60);
          const seconds = elapsed % 60;
          const timeStr = minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
          setTranscriptionStatus(`⏳ Procesando... (${timeStr} transcurridos)`);

          if (attempts >= maxAttempts) {
            setError('Timeout: La transcripción está tardando demasiado. Intenta con un audio más corto.');
            setLoading(false);
          } else {
            setTimeout(() => checkStatus(), 3000);
          }
        }
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') {
          console.warn('⚠️ Poll timeout, reintentando...');
          if (attempts < maxAttempts) {
            setTimeout(() => checkStatus(), 3000);
          } else {
            setError('Timeout: No se pudo conectar con el servidor');
            setLoading(false);
          }
        } else {
          console.error('❌ [ERROR POLLING]', err);
          setError(err instanceof Error ? err.message : 'Error al verificar el estado');
          setLoading(false);
        }
      }
    };

    await checkStatus();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;

    console.log('🚀 Iniciando transcripción:', file.name, `${(file.size / 1024 / 1024).toFixed(2)} MB`);

    setLoading(true);
    setError(null);
    setResponse(null);
    setProgress(0);

    // ✅ Guardar el tiempo de inicio en una variable local, NO solo en estado
    const uploadStartTime = Date.now();

    try {
      // Paso 1: Despertar servidor
      setTranscriptionStatus('🔄 Conectando con el servidor...');
      const wakeUpController = new AbortController();
      const wakeUpTimeout = setTimeout(() => wakeUpController.abort(), 120000); // 2 min para wake-up
      try {
        await fetch(`${API_BASE_URL}/health`, { signal: wakeUpController.signal });
        clearTimeout(wakeUpTimeout);
        console.log('✅ Servidor activo');
      } catch {
        clearTimeout(wakeUpTimeout);
        console.warn('⚠️ No se pudo hacer wake-up, continuando de todas formas...');
      }

      // Paso 2: Subir archivo
      const fileSizeMB = (file.size / 1024 / 1024).toFixed(1);
      setTranscriptionStatus(`📤 Subiendo archivo (${fileSizeMB} MB)... esto puede tardar si el archivo es grande`);
      const formData = new FormData();
      formData.append('audio', file);

      const uploadController = new AbortController();
      const uploadTimeout = setTimeout(() => uploadController.abort(), 600000); // 10 min para archivos grandes

      const res = await fetch(`${API_BASE_URL}/transcribe-async`, {
        method: 'POST',
        headers: { 'Accept': 'application/json' },
        body: formData,
        signal: uploadController.signal,
      });
      clearTimeout(uploadTimeout);

      if (!res.ok) throw new Error(`Error del servidor: ${res.status}`);

      const data = await res.json();
      console.log('📦 Respuesta:', data);

      if (res.status === 202 && data.transcript_id) {
        setTranscriptionStatus('🎙️ Transcripción iniciada, procesando...');
        setProgress(5);

        // ✅ Pasar uploadStartTime como parámetro para evitar el closure bug
        await pollTranscriptionStatus(data.transcript_id, uploadStartTime);
      } else {
        setError(data.message || 'Error al iniciar la transcripción');
        setLoading(false);
      }
    } catch (err) {
      console.error('❌ Error crítico:', err);
      if (err instanceof Error && err.name === 'AbortError') {
        setError('Timeout al subir el archivo. Si es un archivo grande (>100MB) puede tardar varios minutos. Intenta de nuevo.');
      } else if (err instanceof TypeError && err.message.includes('Failed to fetch')) {
        setError('No se pudo conectar al servidor. Puede estar iniciando, espera 30 segundos e intenta de nuevo.');
      } else {
        setError(err instanceof Error ? err.message : 'Error al transcribir el archivo');
      }
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFile(null);
    setResponse(null);
    setError(null);
    setTranscriptionStatus('');
    setProgress(0);
    setOutputFormat('text');
    setTranscriptionTime(0);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  };

  /** Formatea segundos como "Xm Ys" para el banner de completado */
  const formatTime = (seconds: number): string => {
    const total = Math.round(seconds);
    if (total < 60) return `${total} seg`;
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${m} min ${s} seg`;
  };

  return (
    <div className="space-y-6">
      {/* Developer Watermark */}
      <DeveloperCredits variant="watermark" />

      {/* Upload Card */}
      <div className="bg-white rounded-2xl shadow-lg p-8">
        <div className="mb-6">
          <h2 className="mb-2 flex items-center gap-2">
            <Upload className="w-6 h-6 text-[var(--color-accent)]" />
            Sube tu archivo de audio
          </h2>
          <p className="text-[var(--color-secondary)]">
            Arrastra y suelta tu archivo aquí, o haz clic para seleccionarlo
          </p>
          <p className="text-xs text-[var(--color-secondary)] mt-1">
            ⚡ Soporta audios de hasta 4 horas de duración
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Drag & Drop Zone */}
          <div
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            className={`relative border-2 border-dashed rounded-xl p-12 text-center transition-all ${
              dragActive
                ? 'border-[var(--color-accent)] bg-blue-50'
                : 'border-gray-300 hover:border-[var(--color-accent)] bg-[var(--color-background)]'
            }`}
          >
            <input
              type="file"
              id="file-input"
              onChange={handleFileChange}
              accept=".mp3,.wav,.m4a,.flac,.ogg,.webm,audio/*"
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              disabled={loading}
            />

            {!file ? (
              <div className="pointer-events-none">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-[var(--color-accent)] to-[var(--color-primary)] rounded-full mb-4">
                  <Music className="w-8 h-8 text-white" />
                </div>
                <p className="mb-2">
                  <span className="text-[var(--color-accent)] underline cursor-pointer">
                    Selecciona un archivo
                  </span>{' '}
                  o arrástralo aquí
                </p>
                <p className="text-sm text-[var(--color-secondary)]">
                  Formatos: MP3, WAV, M4A, FLAC, OGG, WEBM
                </p>
              </div>
            ) : (
              <div className="pointer-events-none">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4">
                  <FileAudio className="w-8 h-8 text-green-600" />
                </div>
                <p className="mb-1"><strong>{file.name}</strong></p>
                <p className="text-sm text-[var(--color-secondary)]">{formatFileSize(file.size)}</p>
              </div>
            )}
          </div>

          {/* Botones */}
          <div className="flex gap-3">
            {file && !loading && (
              <button
                type="button"
                onClick={resetForm}
                className="px-6 py-3 rounded-xl bg-gray-200 text-[var(--color-secondary)] hover:bg-gray-300 transition-all"
              >
                Cambiar archivo
              </button>
            )}
            <button
              type="submit"
              disabled={!file || loading}
              className="flex-1 bg-gradient-to-r from-[var(--color-accent)] to-[var(--color-primary)] text-white px-8 py-3 rounded-xl hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <><Loader2 className="w-5 h-5 animate-spin" /> Procesando...</>
              ) : (
                <><Upload className="w-5 h-5" /> Transcribir Audio</>
              )}
            </button>
          </div>
        </form>

        {/* Indicador de progreso */}
        {loading && (
          <div className="mt-6 space-y-4">
            <div className="bg-blue-50 border-2 border-[#1976D2] rounded-xl p-4">
              <div className="flex items-start gap-3 mb-3">
                <Clock className="w-5 h-5 text-[#1976D2] mt-0.5 flex-shrink-0 animate-pulse" />
                <div className="flex-1">
                  <p className="text-sm text-[#003B7E]"><strong>{transcriptionStatus}</strong></p>
                  <p className="text-xs text-[#1976D2] mt-1">
                    El tiempo depende de la duración del audio. Archivos largos pueden tardar varios minutos.
                  </p>
                </div>
              </div>
              <div className="w-full bg-blue-100 rounded-full h-2.5 overflow-hidden">
                <div
                  className="bg-gradient-to-r from-[#1976D2] to-[#00BCD4] h-2.5 rounded-full transition-all duration-500"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-xs text-[#1976D2] text-right mt-1">{progress.toFixed(0)}%</p>
            </div>
          </div>
        )}

        {/* Banner de completado */}
        {!loading && response && response.data.status === 'completed' && transcriptionTime > 0 && (
          <div className="mt-6">
            <div className="bg-green-50 border border-green-200 rounded-xl p-4">
              <div className="flex items-center gap-3">
                <CheckCircle className="w-6 h-6 text-green-600 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-sm text-green-800"><strong>✅ Transcripción completada exitosamente</strong></p>
                  <p className="text-xs text-green-700 mt-1">
                    Tiempo de procesamiento: <strong>{formatTime(transcriptionTime)}</strong>
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* PDFViewer */}
      {response && response.data.status === 'completed' && (
        <PDFViewer
          text={response.data.text}
          fileName={file?.name || 'audio'}
          languageCode={response.data.language_code}
          confidence={response.data.confidence}
          transcriptionTime={transcriptionTime}
          outputFormat={outputFormat}
          onFormatChange={setOutputFormat}
        />
      )}

      {/* Error */}
      {(error || (response && response.data.status !== 'completed')) && (
        <div className="bg-white rounded-2xl shadow-lg p-8 border-2 border-red-200">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex items-center justify-center w-12 h-12 bg-red-100 rounded-full">
              <XCircle className="w-6 h-6 text-red-600" />
            </div>
            <div>
              <h3 className="text-red-800">Error en la transcripción</h3>
              <p className="text-sm text-red-600">
                {error || response?.data?.message || response?.data?.error || 'Ocurrió un error inesperado'}
              </p>
            </div>
          </div>
          {response && (
            <details className="cursor-pointer">
              <summary className="text-sm text-[var(--color-secondary)] hover:text-[var(--color-accent)]">
                Ver detalles técnicos
              </summary>
              <pre className="mt-3 bg-[var(--color-background)] p-4 rounded-lg overflow-x-auto text-xs">
                {JSON.stringify(response.data, null, 2)}
              </pre>
            </details>
          )}
          <button
            onClick={resetForm}
            className="mt-4 w-full py-3 bg-gray-200 text-[var(--color-secondary)] rounded-lg hover:bg-gray-300 transition-all"
          >
            Intentar de nuevo
          </button>
        </div>
      )}

      {/* Info cards */}
      <div className="grid md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-3">
            <CheckCircle className="w-6 h-6 text-[var(--color-accent)]" />
          </div>
          <h3 className="mb-2">Precisión Alta</h3>
          <p className="text-sm text-[var(--color-secondary)]">
            Tecnología avanzada de IA para transcripciones precisas
          </p>
        </div>
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-3">
            <Music className="w-6 h-6 text-[var(--color-accent)]" />
          </div>
          <h3 className="mb-2">Audios Largos</h3>
          <p className="text-sm text-[var(--color-secondary)]">
            Soporta archivos de hasta 4 horas de duración
          </p>
        </div>
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-3">
            <FileAudio className="w-6 h-6 text-[var(--color-accent)]" />
          </div>
          <h3 className="mb-2">Múltiples Formatos</h3>
          <p className="text-sm text-[var(--color-secondary)]">
            MP3, WAV, M4A, FLAC, OGG y WEBM compatibles
          </p>
        </div>
      </div>
    </div>
  );
}