/**
 * Voice & Audio Service
 * Hardware microphone recording via MediaRecorder, clean audio stream releasing,
 * and speech-to-text dictation via Web SpeechRecognition API.
 */

import { AttachmentService } from './attachment.js';

export const AudioVoiceService = {
  mediaRecorder: null,
  recordedChunks: [],
  mediaStream: null,
  speechRecognition: null,
  isRecordingAudio: false,
  isRecordingSpeech: false,

  startAudioRecording(callbacks) {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      callbacks.onError('Perangkat atau peramban ini tidak mendukung perekaman mikrofon.');
      return;
    }

    navigator.mediaDevices.getUserMedia({ audio: true })
      .then(stream => {
        this.mediaStream = stream;
        this.recordedChunks = [];

        let mimeType = '';
        if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
          mimeType = 'audio/webm;codecs=opus';
        } else if (MediaRecorder.isTypeSupported('audio/webm')) {
          mimeType = 'audio/webm';
        } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
          mimeType = 'audio/mp4';
        }

        try {
          this.mediaRecorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
        } catch (e) {
          this.mediaRecorder = new MediaRecorder(stream);
        }

        this.mediaRecorder.ondataavailable = (e) => {
          if (e.data && e.data.size > 0) {
            this.recordedChunks.push(e.data);
          }
        };

        this.mediaRecorder.onstop = async () => {
          const mime = this.mediaRecorder.mimeType || 'audio/webm';
          const blob = new Blob(this.recordedChunks, { type: mime });
          try {
            const dataURL = await AttachmentService.blobToDataURL(blob);
            const ext = (mime.split('/')[1] || 'webm').split(';')[0];
            callbacks.onSuccess({
              dataURL,
              size: blob.size,
              mime,
              ext
            });
          } catch (err) {
            callbacks.onError('Gagal menyimpan rekaman: ' + err.message);
          } finally {
            // Important: Release all microphone tracks to turn off the hardware mic indicator
            if (this.mediaStream) {
              this.mediaStream.getTracks().forEach(track => track.stop());
              this.mediaStream = null;
            }
          }
        };

        this.mediaRecorder.start();
        this.isRecordingAudio = true;
        callbacks.onStart();
      })
      .catch(err => {
        callbacks.onError('Akses mikrofon ditolak atau tidak tersedia: ' + err.message);
      });
  },

  stopAudioRecording() {
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      try {
        this.mediaRecorder.stop();
      } catch (e) {
        console.warn('Error stopping mediaRecorder:', e);
      }
    }
    this.isRecordingAudio = false;
  },

  startSpeechRecognition(callbacks) {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      callbacks.onError('Peramban ini tidak mendukung pengenalan ucapan ke teks bawaan (SpeechRecognition).');
      return;
    }

    try {
      this.speechRecognition = new SR();
      this.speechRecognition.lang = 'id-ID';
      this.speechRecognition.continuous = true;
      this.speechRecognition.interimResults = true;

      this.speechRecognition.onresult = (e) => {
        let interim = '';
        let final = '';
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const res = e.results[i];
          const transcript = res[0].transcript;
          if (res.isFinal) {
            final += transcript + ' ';
          } else {
            interim += transcript;
          }
        }
        callbacks.onResult({ final, interim });
      };

      this.speechRecognition.onerror = (e) => {
        callbacks.onError('Kesalahan suara: ' + (e.error || 'Terjadi gangguan'));
      };

      this.speechRecognition.onend = () => {
        this.isRecordingSpeech = false;
        callbacks.onEnd();
      };

      this.speechRecognition.start();
      this.isRecordingSpeech = true;
      callbacks.onStart();
    } catch (e) {
      callbacks.onError('Tidak bisa memulai pengenalan suara: ' + e.message);
    }
  },

  stopSpeechRecognition() {
    if (this.speechRecognition) {
      try {
        this.speechRecognition.stop();
      } catch (e) {}
    }
    this.isRecordingSpeech = false;
  }
};
