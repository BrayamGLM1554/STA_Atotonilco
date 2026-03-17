/* eslint-disable react/react-in-jsx-scope */
import { useState } from 'react';
import {
  Upload, Loader2, CheckCircle, XCircle, Music, FileAudio,
  Clock, Video, FileVideo, AlertTriangle, WifiOff, TimerOff,
  ServerCrash, FileX, ShieldAlert,
} from 'lucide-react';
import { PDFViewer } from './PDFViewer';
import { DeveloperCredits } from './DeveloperCredits';

const API_BASE_URL = 'https://api-transcription-assemblyai.onrender.com';

// Archivos por encima de este umbral se suben directo a AssemblyAI
// sin pasar por Render (evita el error 413).
const DIRECT_UPLOAD_THRESHOLD = 80 * 1024 * 1024; // 80 MB (margen de seguridad)

type OutputFormat = 'text' | 'srt' | 'vtt' | 'json';
type MediaType = 'audio' | 'video';

// ── Tipos de error estructurado ──────────────────────────────────────────────
type AppError = {
  title: string;
  message: string;
  detail?: string;
  icon: 'wifi' | 'timeout' | 'server' | 'file' | 'transcription' | 'unknown';
};

// ── Configuracion por tipo de medio ─────────────────────────────────────────
const MEDIA_CONFIG = {
  audio: {
    accept: '.mp3,.mp4,.wav,.m4a,.flac,.ogg,.webm,.aac,.amr,.opus,.wma,.mpeg,.mpga,.mp2,audio/*',
    extensions: ['MP3', 'WAV', 'M4A', 'FLAC', 'OGG', 'WEBM', 'AAC', 'AMR', 'OPUS', 'WMA', 'MPEG'],
    allowedExt: ['.mp3', '.wav', '.m4a', '.flac', '.ogg', '.webm', '.aac', '.amr', '.opus', '.wma', '.mpeg', '.mpga', '.mp2'],
    label: 'audio',
    Icon: Music,
    FileIcon: FileAudio,
    uploadLabel: 'Sube tu archivo de audio',
    dropLabel: 'Selecciona un archivo de audio',
    hint: 'Audios pequeños (<80 MB) se procesan por el servidor. Audios grandes se suben directo a AssemblyAI.',
  },
  video: {
    accept: '.mp4,.mov,.avi,.mkv,.wmv,.flv,.webm,.m4v,.3gp,.ts,.mts,video/*',
    extensions: ['MP4', 'MOV', 'AVI', 'MKV', 'WMV', 'FLV', 'WEBM', 'M4V', '3GP', 'TS'],
    allowedExt: ['.mp4', '.mov', '.avi', '.mkv', '.wmv', '.flv', '.webm', '.m4v', '.3gp', '.ts', '.mts'],
    label: 'video',
    Icon: Video,
    FileIcon: FileVideo,
    uploadLabel: 'Sube tu archivo de video',
    dropLabel: 'Selecciona un archivo de video',
    hint: 'Los videos se suben directo a AssemblyAI (sin limite de tamaño en Render). El audio se extrae automaticamente.',
  },
} as const;

// ── Determina si el archivo debe ir directo a AssemblyAI ─────────────────────
const needsDirectUpload = (file: File, mediaType: MediaType): boolean =>
  mediaType === 'video' || file.size > DIRECT_UPLOAD_THRESHOLD;

// ── Icono segun tipo de error ────────────────────────────────────────────────
function ErrorIcon({ type }: { type: AppError['icon'] }) {
  const cls = 'w-6 h-6 text-red-600';
  switch (type) {
    case 'wifi':          return <WifiOff className={cls} />;
    case 'timeout':       return <TimerOff className={cls} />;
    case 'server':        return <ServerCrash className={cls} />;
    case 'file':          return <FileX className={cls} />;
    case 'transcription': return <ShieldAlert className={cls} />;
    default:              return <AlertTriangle className={cls} />;
  }
}

export function TranscribeFile() {
  const [mediaType, setMediaType] = useState<MediaType>('audio');
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<any>(null);
  const [appError, setAppError] = useState<AppError | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [transcriptionStatus, setTranscriptionStatus] = useState<string>('');
  const [progress, setProgress] = useState<number>(0);
  const [outputFormat, setOutputFormat] = useState<OutputFormat>('text');
  const [transcriptionTime, setTranscriptionTime] = useState<number>(0);

  const config = MEDIA_CONFIG[mediaType];

  // ── Helpers de error ─────────────────────────────────────────────────────
  const setNetworkError = (rawMessage?: string) =>
    setAppError({
      icon: 'wifi',
      title: 'Sin conexion al servidor',
      message: 'No se pudo establecer conexion con el servidor. Verifica que el servidor este corriendo y vuelve a intentarlo.',
      detail: rawMessage,
    });

  const setUploadTimeoutError = (fileSizeMB: string) =>
    setAppError({
      icon: 'timeout',
      title: 'Tiempo de espera agotado al subir el archivo',
      message: `El archivo (${fileSizeMB} MB) tardo demasiado en subirse. Esto puede ocurrir con archivos grandes o conexiones lentas. Intenta de nuevo o usa un archivo mas pequeno.`,
    });

  const setPollTimeoutError = () =>
    setAppError({
      icon: 'timeout',
      title: 'Tiempo de espera agotado durante la transcripcion',
      message: 'El servidor dejo de responder mientras se procesaba el archivo. El archivo puede ser demasiado largo o el servidor esta sobrecargado.',
      detail: 'Intenta con un archivo mas corto o espera unos minutos antes de volver a intentarlo.',
    });

  const setServerError = (statusCode: number, body?: string) =>
    setAppError({
      icon: 'server',
      title: `Error del servidor (HTTP ${statusCode})`,
      message: getServerErrorMessage(statusCode),
      detail: body || undefined,
    });

  const setTranscriptionApiError = (apiMessage?: string) =>
    setAppError({
      icon: 'transcription',
      title: 'Error durante la transcripcion',
      message: 'AssemblyAI reporto un error al procesar el archivo. Puede ser que el archivo este corrupto, en silencio total o en un formato no soportado correctamente.',
      detail: apiMessage,
    });

  const setFileError = (fileName: string, allowedList: string) =>
    setAppError({
      icon: 'file',
      title: 'Formato de archivo no valido',
      message: `El archivo "${fileName}" no es compatible con el modo ${config.label}.`,
      detail: `Formatos aceptados: ${allowedList}`,
    });

  const setUnknownError = (err: unknown) => {
    const message = err instanceof Error ? err.message : String(err);
    setAppError({
      icon: 'unknown',
      title: 'Error inesperado',
      message: 'Ocurrio un error que no fue anticipado. Revisa la consola del navegador para mas informacion.',
      detail: message,
    });
  };

  // ── Mensajes HTTP especificos ────────────────────────────────────────────
  const getServerErrorMessage = (code: number): string => {
    switch (code) {
      case 400: return 'La solicitud enviada al servidor no es valida. Es posible que el archivo este malformado o que falten datos requeridos.';
      case 401: return 'No autorizado. La API Key de AssemblyAI puede ser incorrecta o haber expirado.';
      case 403: return 'Acceso denegado. Verifica que la API Key tenga permisos suficientes.';
      case 404: return 'El endpoint solicitado no existe en el servidor. Verifica que la URL de la API sea correcta.';
      case 413: return 'El archivo es demasiado grande para el servidor. Para archivos grandes usa el modo de subida directa (videos o >80 MB).';
      case 429: return 'Se excedio el limite de solicitudes de AssemblyAI. Espera unos minutos antes de intentar de nuevo.';
      case 500: return 'Error interno del servidor. El backend encontro un problema al procesar la solicitud.';
      case 502: return 'El servidor no pudo comunicarse con AssemblyAI (Bad Gateway). Puede ser un problema temporal.';
      case 503: return 'El servidor no esta disponible en este momento. Puede estar iniciando o sobrecargado. Espera 30 segundos.';
      case 504: return 'El servidor tardo demasiado en responder (Gateway Timeout). Intenta de nuevo en unos momentos.';
      default:  return `El servidor respondio con un codigo de error desconocido (${code}). Revisa los logs del backend.`;
    }
  };

  // ── Cambio de tipo de medio ───────────────────────────────────────────────
  const handleMediaTypeChange = (type: MediaType) => {
    setMediaType(type);
    resetForm();
  };

  // ── Validacion de archivo ────────────────────────────────────────────────
  const isValidFile = (f: File): boolean => {
    const name = f.name.toLowerCase();
    return config.allowedExt.some(ext => name.endsWith(ext));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      if (!isValidFile(selectedFile)) {
        setFileError(selectedFile.name, config.extensions.join(', '));
        return;
      }
      setFile(selectedFile);
      setResponse(null);
      setAppError(null);
      setTranscriptionStatus('');
      setTranscriptionTime(0);
      setProgress(0);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') setDragActive(true);
    else if (e.type === 'dragleave') setDragActive(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const dropped = e.dataTransfer.files[0];
      if (!isValidFile(dropped)) {
        setFileError(dropped.name, config.extensions.join(', '));
        return;
      }
      setFile(dropped);
      setResponse(null);
      setAppError(null);
      setTranscriptionStatus('');
      setTranscriptionTime(0);
      setProgress(0);
    }
  };

  // ── Polling ───────────────────────────────────────────────────────────────
  const pollTranscriptionStatus = async (transcriptId: string, uploadStartTime: number) => {
    const maxAttempts = 300;
    let attempts = 0;

    const checkStatus = async (): Promise<void> => {
      try {
        attempts++;
        setProgress(Math.min(10 + (attempts / maxAttempts) * 85, 95));

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000);

        const statusRes = await fetch(`${API_BASE_URL}/status/${transcriptId}`, {
          headers: { Accept: 'application/json' },
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        if (!statusRes.ok) {
          let body: string | undefined;
          try { body = await statusRes.text(); } catch { /* ignorar */ }
          setServerError(statusRes.status, body);
          setLoading(false);
          return;
        }

        const statusData = await statusRes.json();

        if (statusData.status === 'completed') {
          setProgress(100);
          setTranscriptionStatus('Transcripcion completada');
          const elapsed = (Date.now() - uploadStartTime) / 1000;
          setTranscriptionTime(elapsed);
          setResponse({ status: 200, data: statusData });
          setLoading(false);
        } else if (statusData.status === 'error') {
          setTranscriptionApiError(statusData.error);
          setLoading(false);
        } else {
          const elapsed = Math.floor(attempts * 3);
          const minutes = Math.floor(elapsed / 60);
          const seconds = elapsed % 60;
          const timeStr = minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
          setTranscriptionStatus(`Procesando ${config.label}... (${timeStr} transcurridos)`);

          if (attempts >= maxAttempts) {
            setPollTimeoutError();
            setLoading(false);
          } else {
            setTimeout(() => checkStatus(), 3000);
          }
        }
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') {
          if (attempts < maxAttempts) {
            setTranscriptionStatus(`Sin respuesta del servidor, reintentando... (intento ${attempts})`);
            setTimeout(() => checkStatus(), 3000);
          } else {
            setPollTimeoutError();
            setLoading(false);
          }
        } else if (err instanceof TypeError && err.message.includes('Failed to fetch')) {
          setNetworkError(err.message);
          setLoading(false);
        } else {
          setUnknownError(err);
          setLoading(false);
        }
      }
    };

    await checkStatus();
  };

  // ── Subida directa a AssemblyAI (videos y archivos grandes) ─────────────
  const handleDirectUpload = async (
    file: File,
    fileSizeMB: string,
    uploadStartTime: number,
  ): Promise<void> => {
    // 1. Obtener credenciales del backend
    setTranscriptionStatus('Preparando subida directa a AssemblyAI...');
    setProgress(2);

    let uploadUrl: string;
    let apiKey: string;

    try {
      const credRes = await fetch(`${API_BASE_URL}/get-upload-url`, { method: 'POST' });
      if (!credRes.ok) {
        setServerError(credRes.status, await credRes.text());
        setLoading(false);
        return;
      }
      const credData = await credRes.json();
      uploadUrl = credData.upload_url;
      apiKey = credData.api_key;
    } catch (err) {
      if (err instanceof TypeError && err.message.includes('Failed to fetch')) {
        setNetworkError((err as TypeError).message);
      } else {
        setUnknownError(err);
      }
      setLoading(false);
      return;
    }

    // 2. Subir el archivo directo a AssemblyAI (sin pasar por Render)
    setTranscriptionStatus(
      mediaType === 'video'
        ? `Subiendo video (${fileSizeMB} MB) directo a AssemblyAI... El audio se extraera automaticamente`
        : `Subiendo audio grande (${fileSizeMB} MB) directo a AssemblyAI...`
    );
    setProgress(5);

    const uploadController = new AbortController();
    // 30 minutos para archivos muy grandes
    const uploadTimeout = setTimeout(() => uploadController.abort(), 30 * 60 * 1000);

    let assemblyUploadRes: Response;
    try {
      assemblyUploadRes = await fetch(uploadUrl, {
        method: 'POST',
        headers: {
          authorization: apiKey,
          'Content-Type': 'application/octet-stream',
        },
        body: file,                  // binario directo, sin FormData
        signal: uploadController.signal,
      });
      clearTimeout(uploadTimeout);
    } catch (fetchErr) {
      clearTimeout(uploadTimeout);
      if (fetchErr instanceof Error && fetchErr.name === 'AbortError') {
        setUploadTimeoutError(fileSizeMB);
      } else if (fetchErr instanceof TypeError) {
        setNetworkError((fetchErr as TypeError).message);
      } else {
        setUnknownError(fetchErr);
      }
      setLoading(false);
      return;
    }

    if (!assemblyUploadRes.ok) {
      setServerError(assemblyUploadRes.status, await assemblyUploadRes.text());
      setLoading(false);
      return;
    }

    const { upload_url: audioUrl } = await assemblyUploadRes.json();

    // 3. Iniciar transcripcion en el backend con la URL ya subida (async)
    setTranscriptionStatus('Iniciando transcripcion...');
    setProgress(8);

    let transcriptId: string;

    try {
      const transcribeRes = await fetch(`${API_BASE_URL}/transcribe-url-async`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({ audio_url: audioUrl, quality: 'maximum' }),
      });

      if (!transcribeRes.ok) {
        setServerError(transcribeRes.status, await transcribeRes.text());
        setLoading(false);
        return;
      }

      const transcribeData = await transcribeRes.json();

      if (transcribeData.transcript_id) {
        transcriptId = transcribeData.transcript_id;
      } else {
        setAppError({
          icon: 'server',
          title: 'Respuesta inesperada del servidor',
          message: 'El servidor no devolvio un ID de transcripcion.',
          detail: JSON.stringify(transcribeData),
        });
        setLoading(false);
        return;
      }
    } catch (err) {
      if (err instanceof TypeError && err.message.includes('Failed to fetch')) {
        setNetworkError((err as TypeError).message);
      } else {
        setUnknownError(err);
      }
      setLoading(false);
      return;
    }

    // 4. Polling
    setTranscriptionStatus('Transcripcion iniciada, procesando...');
    setProgress(10);
    await pollTranscriptionStatus(transcriptId, uploadStartTime);
  };

  // ── Subida por Render (audios pequeños < 80 MB) ───────────────────────────
  const handleRenderUpload = async (
    file: File,
    fileSizeMB: string,
    uploadStartTime: number,
  ): Promise<void> => {
    setTranscriptionStatus(`Subiendo audio (${fileSizeMB} MB)...`);
    setProgress(2);

    const formData = new FormData();
    formData.append('audio', file);

    const uploadController = new AbortController();
    const uploadTimeout = setTimeout(() => uploadController.abort(), 600000); // 10 min

    let res: Response;
    try {
      res = await fetch(`${API_BASE_URL}/transcribe-async`, {
        method: 'POST',
        headers: { Accept: 'application/json' },
        body: formData,
        signal: uploadController.signal,
      });
      clearTimeout(uploadTimeout);
    } catch (fetchErr) {
      clearTimeout(uploadTimeout);
      if (fetchErr instanceof Error && fetchErr.name === 'AbortError') {
        setUploadTimeoutError(fileSizeMB);
      } else if (fetchErr instanceof TypeError) {
        setNetworkError((fetchErr as TypeError).message);
      } else {
        setUnknownError(fetchErr);
      }
      setLoading(false);
      return;
    }

    if (!res.ok) {
      let body: string | undefined;
      try { body = await res.text(); } catch { /* ignorar */ }
      setServerError(res.status, body);
      setLoading(false);
      return;
    }

    const data = await res.json();

    if (res.status === 202 && data.transcript_id) {
      setTranscriptionStatus('Transcripcion iniciada, procesando...');
      setProgress(10);
      await pollTranscriptionStatus(data.transcript_id, uploadStartTime);
    } else {
      setAppError({
        icon: 'server',
        title: 'Respuesta inesperada del servidor',
        message: 'El servidor respondio sin un ID de transcripcion.',
        detail: data.message || JSON.stringify(data),
      });
      setLoading(false);
    }
  };

  // ── Submit ────────────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;

    setLoading(true);
    setAppError(null);
    setResponse(null);
    setProgress(0);

    const uploadStartTime = Date.now();
    const fileSizeMB = (file.size / 1024 / 1024).toFixed(1);
    const useDirect = needsDirectUpload(file, mediaType);

    console.log(`[STA] Archivo: ${file.name} | ${fileSizeMB} MB | mediaType: ${mediaType}`);
    console.log(`[STA] Ruta: ${useDirect ? 'DIRECTA (AssemblyAI)' : 'RENDER (<80 MB)'}`);

    try {
      // Wake-up del servidor (falla silenciosa)
      setTranscriptionStatus('Conectando con el servidor...');
      const wakeUpController = new AbortController();
      const wakeUpTimeout = setTimeout(() => wakeUpController.abort(), 120000);
      try {
        await fetch(`${API_BASE_URL}/health`, { signal: wakeUpController.signal });
        clearTimeout(wakeUpTimeout);
      } catch {
        clearTimeout(wakeUpTimeout);
      }

      if (useDirect) {
        await handleDirectUpload(file, fileSizeMB, uploadStartTime);
      } else {
        await handleRenderUpload(file, fileSizeMB, uploadStartTime);
      }
    } catch (err) {
      setUnknownError(err);
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFile(null);
    setResponse(null);
    setAppError(null);
    setTranscriptionStatus('');
    setProgress(0);
    setOutputFormat('text');
    setTranscriptionTime(0);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  };

  const formatTime = (seconds: number): string => {
    const total = Math.round(seconds);
    if (total < 60) return `${total} seg`;
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${m} min ${s} seg`;
  };

  const { Icon, FileIcon } = config;

  // Badge que muestra la ruta que se usara
  const UploadRouteBadge = ({ file }: { file: File }) => {
    const direct = needsDirectUpload(file, mediaType);
    return (
      <div className={`mt-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${
        direct
          ? 'bg-purple-100 text-purple-700 border border-purple-200'
          : 'bg-green-100 text-green-700 border border-green-200'
      }`}>
        <span className={`w-1.5 h-1.5 rounded-full ${direct ? 'bg-purple-500' : 'bg-green-500'}`} />
        {direct
          ? 'Subida directa a AssemblyAI (sin limite de tamaño)'
          : 'Subida por servidor Render (<80 MB)'}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Developer Watermark */}
      <DeveloperCredits variant="watermark" />

      {/* Toggle Audio / Video */}
      <div className="bg-white rounded-2xl shadow-lg p-2 flex gap-2">
        {(['audio', 'video'] as MediaType[]).map((type) => {
          const cfg = MEDIA_CONFIG[type];
          const Ico = cfg.Icon;
          const active = mediaType === type;
          return (
            <button
              key={type}
              type="button"
              onClick={() => handleMediaTypeChange(type)}
              className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm transition-all ${
                active
                  ? 'bg-gradient-to-r from-[var(--color-accent)] to-[var(--color-primary)] text-white shadow-md'
                  : 'text-[var(--color-secondary)] hover:bg-gray-100'
              }`}
            >
              <Ico className="w-5 h-5" />
              {type === 'audio' ? 'Audio' : 'Video'}
            </button>
          );
        })}
      </div>

      {/* Upload Card */}
      <div className="bg-white rounded-2xl shadow-lg p-8">
        <div className="mb-6">
          <h2 className="mb-2 flex items-center gap-2">
            <Upload className="w-6 h-6 text-[var(--color-accent)]" />
            {config.uploadLabel}
          </h2>
          <p className="text-[var(--color-secondary)]">
            Arrastra y suelta tu archivo aqui, o haz clic para seleccionarlo
          </p>
          <p className="text-xs text-[var(--color-secondary)] mt-1">{config.hint}</p>
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
              accept={config.accept}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              disabled={loading}
            />

            {!file ? (
              <div className="pointer-events-none">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-[var(--color-accent)] to-[var(--color-primary)] rounded-full mb-4">
                  <Icon className="w-8 h-8 text-white" />
                </div>
                <p className="mb-2">
                  <span className="text-[var(--color-accent)] underline cursor-pointer">
                    {config.dropLabel}
                  </span>{' '}
                  o arrastralo aqui
                </p>
                <p className="text-sm text-[var(--color-secondary)]">
                  Formatos: {config.extensions.join(', ')}
                </p>
              </div>
            ) : (
              <div className="pointer-events-none">
                <div className={`inline-flex items-center justify-center w-16 h-16 rounded-full mb-4 ${
                  mediaType === 'video' ? 'bg-purple-100' : 'bg-green-100'
                }`}>
                  <FileIcon className={`w-8 h-8 ${mediaType === 'video' ? 'text-purple-600' : 'text-green-600'}`} />
                </div>
                <p className="mb-1"><strong>{file.name}</strong></p>
                <p className="text-sm text-[var(--color-secondary)]">{formatFileSize(file.size)}</p>
                {mediaType === 'video' && (
                  <p className="text-xs text-purple-500 mt-1">
                    El audio del video sera extraido automaticamente
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Badge de ruta */}
          {file && !loading && (
            <div className="flex justify-center">
              <UploadRouteBadge file={file} />
            </div>
          )}

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
                <><Upload className="w-5 h-5" /> Transcribir {mediaType === 'video' ? 'Video' : 'Audio'}</>
              )}
            </button>
          </div>
        </form>

        {/* Progreso */}
        {loading && (
          <div className="mt-6">
            <div className="bg-blue-50 border-2 border-[#1976D2] rounded-xl p-4">
              <div className="flex items-start gap-3 mb-3">
                <Clock className="w-5 h-5 text-[#1976D2] mt-0.5 flex-shrink-0 animate-pulse" />
                <div className="flex-1">
                  <p className="text-sm text-[#003B7E]"><strong>{transcriptionStatus}</strong></p>
                  <p className="text-xs text-[#1976D2] mt-1">
                    {mediaType === 'video'
                      ? 'El video se sube directo a AssemblyAI. El tiempo depende de tu conexion y la duracion del video.'
                      : 'El tiempo depende de la duracion del audio. Archivos largos pueden tardar varios minutos.'}
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

        {/* Banner completado */}
        {!loading && response && response.data.status === 'completed' && transcriptionTime > 0 && (
          <div className="mt-6">
            <div className="bg-green-50 border border-green-200 rounded-xl p-4">
              <div className="flex items-center gap-3">
                <CheckCircle className="w-6 h-6 text-green-600 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-sm text-green-800">
                    <strong>Transcripcion completada exitosamente</strong>
                  </p>
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
          fileName={file?.name || config.label}
          languageCode={response.data.language_code}
          confidence={response.data.confidence}
          transcriptionTime={transcriptionTime}
          outputFormat={outputFormat}
          onFormatChange={setOutputFormat}
        />
      )}

      {/* Panel de error estructurado */}
      {appError && (
        <div className="bg-white rounded-2xl shadow-lg p-8 border-2 border-red-200">
          <div className="flex items-start gap-4 mb-5">
            <div className="flex items-center justify-center w-12 h-12 bg-red-100 rounded-full flex-shrink-0">
              <ErrorIcon type={appError.icon} />
            </div>
            <div className="flex-1">
              <h3 className="text-red-800 font-semibold mb-1">{appError.title}</h3>
              <p className="text-sm text-red-700 leading-relaxed">{appError.message}</p>
            </div>
          </div>

          {appError.detail && (
            <details className="cursor-pointer mb-4">
              <summary className="text-sm text-[var(--color-secondary)] hover:text-[var(--color-accent)] select-none">
                Ver detalle tecnico
              </summary>
              <pre className="mt-3 bg-gray-50 border border-gray-200 p-4 rounded-lg overflow-x-auto text-xs text-gray-700 whitespace-pre-wrap">
                {appError.detail}
              </pre>
            </details>
          )}

          <button
            onClick={resetForm}
            className="w-full py-3 bg-gray-200 text-[var(--color-secondary)] rounded-lg hover:bg-gray-300 transition-all"
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
          <h3 className="mb-2">Precision Alta</h3>
          <p className="text-sm text-[var(--color-secondary)]">
            Tecnologia avanzada de IA para transcripciones precisas
          </p>
        </div>
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-3">
            <Video className="w-6 h-6 text-[var(--color-accent)]" />
          </div>
          <h3 className="mb-2">Audio y Video</h3>
          <p className="text-sm text-[var(--color-secondary)]">
            Soporta archivos de audio y video. El audio se extrae automaticamente
          </p>
        </div>
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-3">
            <FileAudio className="w-6 h-6 text-[var(--color-accent)]" />
          </div>
          <h3 className="mb-2">Multiples Formatos</h3>
          <p className="text-sm text-[var(--color-secondary)]">
            MP3, WAV, MP4, MOV, MKV, AVI y muchos mas compatibles
          </p>
        </div>
      </div>
    </div>
  );
}