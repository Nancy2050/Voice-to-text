/** @odoo-module **/

import { Component, onWillUnmount, useState } from "@odoo/owl";
import { registry } from "@web/core/registry";
import { useService } from "@web/core/utils/hooks";

export class VoiceRecorderSystray extends Component {
    static template = "voice_to_text.VoiceRecorderSystray";

    setup() {
        this.orm = useService("orm");
        this.action = useService("action");
        this.notification = useService("notification");
        this.state = useState({
            recording: false, reviewing: false, saving: false,
            transcript: "", interimTranscript: "", duration: 0,
        });
        this.mediaRecorder = null;
        this.recognition = null;
        this.stream = null;
        this.audioChunks = [];
        this.audioBlob = null;
        this.startedAt = null;
        onWillUnmount(() => this.cleanup());
    }

    async toggleRecording() {
        if (this.state.recording) {
            this.stopRecording();
        } else {
            await this.startRecording();
        }
    }

    async startRecording() {
        if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
            this.notification.add(
                "Este navegador no permite grabar audio. Usa Chrome o Edge mediante HTTPS.",
                { type: "danger" }
            );
            return;
        }
        try {
            this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            this.audioChunks = [];
            this.state.transcript = "";
            this.state.interimTranscript = "";
            const preferredType = this.getSupportedMimeType();
            const options = preferredType ? { mimeType: preferredType } : undefined;
            this.mediaRecorder = new MediaRecorder(this.stream, options);
            this.mediaRecorder.ondataavailable = (event) => {
                if (event.data.size) this.audioChunks.push(event.data);
            };
            this.mediaRecorder.onstop = () => this.prepareReview();
            this.mediaRecorder.start();
            this.startRecognition();
            this.startedAt = Date.now();
            this.state.recording = true;
        } catch {
            this.cleanup();
            this.notification.add(
                "No fue posible activar el micrófono. Revisa el permiso del navegador.",
                { type: "danger" }
            );
        }
    }

    startRecognition() {
        const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!Recognition) {
            this.notification.add(
                "El audio se guardará, pero este navegador no ofrece transcripción automática.",
                { type: "warning" }
            );
            return;
        }
        this.recognition = new Recognition();
        this.recognition.lang = "es-MX";
        this.recognition.continuous = true;
        this.recognition.interimResults = true;
        this.recognition.onresult = (event) => {
            let finalText = "";
            let interimText = "";
            for (let index = event.resultIndex; index < event.results.length; index++) {
                const text = event.results[index][0].transcript;
                if (event.results[index].isFinal) finalText += text;
                else interimText += text;
            }
            if (finalText) {
                this.state.transcript = `${this.state.transcript} ${finalText}`.trim();
            }
            this.state.interimTranscript = interimText;
        };
        this.recognition.onerror = () => { this.state.interimTranscript = ""; };
        try {
            this.recognition.start();
        } catch {
            this.recognition = null;
        }
    }

    stopRecording() {
        if (!this.state.recording) return;
        this.state.recording = false;
        this.state.duration = Math.max(1, Math.round((Date.now() - this.startedAt) / 1000));
        if (this.recognition) this.recognition.stop();
        if (this.mediaRecorder?.state !== "inactive") this.mediaRecorder.stop();
        this.stopTracks();
    }

    prepareReview() {
        const mimeType = this.mediaRecorder?.mimeType || this.audioChunks[0]?.type || "audio/webm";
        this.audioBlob = new Blob(this.audioChunks, { type: mimeType });
        this.state.transcript = `${this.state.transcript} ${this.state.interimTranscript}`.trim();
        this.state.interimTranscript = "";
        this.state.reviewing = true;
    }

    updateTranscript(event) {
        this.state.transcript = event.target.value;
    }

    async saveRecording() {
        if (!this.audioBlob || !this.state.transcript.trim()) {
            this.notification.add("Escribe o confirma el texto antes de guardar.", { type: "warning" });
            return;
        }
        this.state.saving = true;
        try {
            const audio = await this.blobToBase64(this.audioBlob);
            const extension = this.audioBlob.type.includes("ogg") ? "ogg" : "webm";
            const timestamp = new Date().toISOString().replace(/:/g, "-").replace(".", "-");
            await this.orm.create("voice.instruction", [{
                transcript: this.state.transcript.trim(), audio,
                audio_filename: `instruccion-${timestamp}.${extension}`,
                audio_mimetype: this.audioBlob.type || `audio/${extension}`,
                duration: this.state.duration,
            }]);
            this.notification.add("La grabación y su texto fueron guardados.", { type: "success" });
            this.discardReview();
        } catch {
            this.notification.add("No fue posible guardar la grabación.", { type: "danger" });
        } finally {
            this.state.saving = false;
        }
    }

    discardReview() {
        this.state.reviewing = false;
        this.state.transcript = "";
        this.state.interimTranscript = "";
        this.audioBlob = null;
        this.audioChunks = [];
    }

    openRecords() {
        this.action.doAction("voice_to_text.action_voice_instruction");
    }

    getSupportedMimeType() {
        return ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus"]
            .find((type) => MediaRecorder.isTypeSupported(type));
    }

    blobToBase64(blob) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result.split(",")[1]);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    }

    stopTracks() {
        for (const track of this.stream?.getTracks() || []) track.stop();
        this.stream = null;
    }

    cleanup() {
        if (this.recognition) {
            try { this.recognition.abort(); } catch { }
        }
        if (this.mediaRecorder?.state === "recording") this.mediaRecorder.stop();
        this.stopTracks();
    }
}

registry.category("systray").add("voice_to_text.VoiceRecorderSystray", {
    Component: VoiceRecorderSystray,
}, { sequence: 5 });
