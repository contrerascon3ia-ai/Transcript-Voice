import { pipeline } from 'https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2';

// 1. REFERENCIAS A ELEMENTOS DEL DOM
const output = document.getElementById('output');
const status = document.getElementById('status');
const progressFill = document.getElementById('progressFill');
const progressContainer = document.getElementById('progressContainer');
const fileInput = document.getElementById('fileInput');
const audioPreview = document.getElementById('audioPreview');
const startBtn = document.getElementById('startBtn');
const clearBtn = document.getElementById('clearBtn');
const copyBtn = document.getElementById('copyBtn');
const dropZone = document.getElementById('dropZone');
const filePreview = document.getElementById('filePreview');

let transcriber = null;
let currentBlob = null;
let mediaRecorder;
let chunks = [];
let isTranscribing = false; // Variable de control para el Switch

// --- 2. FUNCIÓN PARA MANEJAR ARCHIVOS (UNIFICADA) ---
function handleFile(file) {
    if (!file) return;
    
    const isOgg = file.name.endsWith('.ogg');
    if (file.type.startsWith('audio/') || isOgg) {
        currentBlob = file;
        audioPreview.src = URL.createObjectURL(file);
        filePreview.classList.remove('hidden');
        status.textContent = "🎯 Audio listo - Step Line. Pulsa INICIAR.";
    } else {
        alert("Por favor, sube un archivo de audio válido (.mp3, .wav, .ogg)");
    }
}

// --- 3. LÓGICA DE PESTAÑAS (TABS) ---
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.onclick = () => {
        document.querySelectorAll('.tab-btn, .tab-content').forEach(el => el.classList.remove('active'));
        btn.classList.add('active');
        const target = document.getElementById(`${btn.dataset.tab}Tab`);
        if (target) target.classList.add('active');
    };
});

// --- 4. MOTOR DE INTELIGENCIA ARTIFICIAL ---
async function transcribe(blob) {
    try {
        if (!transcriber) {
            status.textContent = "⏳ Iniciando motor Step Line...";
            progressContainer.classList.remove('hidden');
            
            transcriber = await pipeline('automatic-speech-recognition', document.getElementById('modelSelect').value, {
                progress_callback: (p) => {
                    if (p.status === 'progress') {
                        progressFill.style.width = `${p.progress}%`;
                        document.getElementById('progressText').textContent = `Descargando IA: ${Math.round(p.progress)}%`;
                    }
                }
            });
            progressContainer.classList.add('hidden');
        }

        // Si el usuario detuvo el proceso mientras cargaba el modelo
        if (!isTranscribing) return;

        status.textContent = "⚙️ Transcribiendo... espera.";
        output.textContent = "Analizando ondas de audio...";

        const audioCtx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
        const arrayBuffer = await blob.arrayBuffer();
        const decoded = await audioCtx.decodeAudioData(arrayBuffer);
        
        // Verificamos nuevamente antes de la inferencia pesada
        if (!isTranscribing) return;

        const result = await transcriber(decoded.getChannelData(0), { 
            task: 'transcribe', 
            language: 'spanish' 
        });

        // Solo mostramos el resultado si no se ha cancelado el proceso
        if (isTranscribing) {
            output.textContent = result.text;
            status.textContent = "✅ Finalizado por Step Line";
        }
        
    } catch (err) {
        console.error(err);
        if (isTranscribing) {
            status.textContent = "❌ Error en el proceso";
            output.textContent = "Error al procesar. Intenta con otro archivo.";
        }
    } finally {
        // Al terminar, el botón vuelve a su estado original automáticamente
        isTranscribing = false;
        updateStartButton(false);
    }
}

// --- 5. FUNCIÓN PARA ACTUALIZAR EL BOTÓN (ESTILO SWITCH) ---
function updateStartButton(active) {
    if (active) {
        startBtn.textContent = "⏹️ DETENER PROCESO";
        startBtn.classList.add('active'); // Asegúrate de tener el estilo .btn-start.active en tu CSS
    } else {
        startBtn.textContent = "🚀 INICIAR TRANSCRIPCIÓN";
        startBtn.classList.remove('active');
    }
}

// --- 6. EVENTOS DE CARGA Y DROP-ZONE ---

dropZone.onclick = () => fileInput.click();
fileInput.onchange = (e) => handleFile(e.target.files[0]);

['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
    dropZone.addEventListener(eventName, (e) => { e.preventDefault(); e.stopPropagation(); }, false);
});

['dragenter', 'dragover'].forEach(eventName => {
    dropZone.addEventListener(eventName, () => dropZone.classList.add('dragover'), false);
});

['dragleave', 'drop'].forEach(eventName => {
    dropZone.addEventListener(eventName, () => dropZone.classList.remove('dragover'), false);
});

dropZone.addEventListener('drop', (e) => {
    const file = e.dataTransfer.files[0];
    handleFile(file);
}, false);

// --- 7. BOTONES DE ACCIÓN ---

startBtn.onclick = async () => { 
    if (!currentBlob) {
        alert("Primero carga un archivo de audio.");
        return;
    }

    if (!isTranscribing) {
        // MODO: INICIAR
        isTranscribing = true;
        updateStartButton(true);
        await transcribe(currentBlob);
    } else {
        // MODO: DETENER
        isTranscribing = false;
        updateStartButton(false);
        status.textContent = "⏹️ Proceso detenido por el usuario.";
        progressContainer.classList.add('hidden');
        output.textContent = "Proceso cancelado. Puedes volver a iniciar.";
    }
};

clearBtn.onclick = () => {
    output.textContent = "";
    status.textContent = "🧹 Cuadro despejado";
};

copyBtn.onclick = () => {
    if (output.textContent) {
        navigator.clipboard.writeText(output.textContent);
        alert("¡Copiado!");
    }
};

// --- 8. MICRÓFONO ---
document.getElementById('recordBtn').onclick = async function() {
    if (!mediaRecorder || mediaRecorder.state === "inactive") {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorder = new MediaRecorder(stream);
            chunks = [];
            mediaRecorder.ondataavailable = e => chunks.push(e.data);
            mediaRecorder.onstop = () => {
                currentBlob = new Blob(chunks, { type: 'audio/wav' });
                // Al grabar, el proceso de transcripción inicia automáticamente
                isTranscribing = true;
                updateStartButton(true);
                transcribe(currentBlob);
            };
            mediaRecorder.start();
            this.textContent = "⏹️ Detener";
            status.textContent = "🔴 Grabando...";
        } catch (err) {
            alert("No hay acceso al micrófono.");
        }
    } else {
        mediaRecorder.stop();
        this.textContent = "🔴 Grabar";
    }
};