package com.catatanpintar.app;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.os.ParcelFileDescriptor;
import android.util.Base64;
import java.io.FileOutputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import androidx.activity.result.ActivityResult;

@CapacitorPlugin(name = "FileExport")
public class FileExportPlugin extends Plugin {

    // Status sesi ekspor biner berjalan (dipakai oleh startExport/appendExportChunk/
    // finishExport/cancelExport di bawah). Hanya satu sesi ekspor aktif dalam satu waktu,
    // sesuai cara pemanggilannya dari src/modules/attachment.js (saveOrDownloadBlob).
    private Uri activeExportUri;
    private OutputStream activeExportStream;
    private long activeExportBytesWritten = 0;

    @PluginMethod
    public void exportFile(PluginCall call) {
        String fileName = call.getString("fileName", "Catatan_Pintar.txt");
        // Terima MIME type dari JavaScript, default ke teks biasa jika kosong
        String mimeType = call.getString("mimeType", "text/plain"); 
        
        call.setKeepAlive(true); 

        Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        
        // Atur tipe file secara dinamis berdasarkan pilihan pengguna
        intent.setType(mimeType); 
        intent.putExtra(Intent.EXTRA_TITLE, fileName);

        startActivityForResult(call, intent, "saveFileResult");
    }

    @ActivityCallback
    private void saveFileResult(PluginCall call, ActivityResult result) {
        if (result.getResultCode() == Activity.RESULT_OK) {
            Intent dataIntent = result.getData();
            if (dataIntent != null) {
                Uri uri = dataIntent.getData();
                String dataToWrite = call.getString("data", "");

                try {
                    ParcelFileDescriptor pfd = getContext().getContentResolver().openFileDescriptor(uri, "w");
                    FileOutputStream fileOutputStream = new FileOutputStream(pfd.getFileDescriptor());
                    fileOutputStream.write(dataToWrite.getBytes(StandardCharsets.UTF_8));
                    fileOutputStream.close();
                    pfd.close();

                    JSObject ret = new JSObject();
                    ret.put("success", true);
                    ret.put("uri", uri.toString());
                    call.resolve(ret);
                } catch (Exception e) {
                    call.reject("Gagal menulis file: " + e.getMessage());
                }
            } else {
                call.reject("URI file tidak ditemukan.");
            }
        } else {
            call.reject("USER_CANCELLED");
        }
    }

    // --- EKSPOR BINER BERTAHAP (chunked) ---
    // Dipakai untuk berkas biner (PDF, ZIP, gambar, dll) yang bisa berukuran besar.
    // Data dikirim dari JavaScript sedikit demi sedikit (per potongan base64) lewat
    // appendExportChunk, supaya tidak perlu mengirim satu string base64 raksasa
    // sekaligus lewat jembatan plugin Capacitor.

    @PluginMethod
    public void startExport(PluginCall call) {
        String name = call.getString("name", "Catatan_Pintar.bin");
        String mime = call.getString("mime", "application/octet-stream");

        call.setKeepAlive(true);

        Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.setType(mime);
        intent.putExtra(Intent.EXTRA_TITLE, name);

        startActivityForResult(call, intent, "startExportResult");
    }

    @ActivityCallback
    private void startExportResult(PluginCall call, ActivityResult result) {
        if (result.getResultCode() == Activity.RESULT_OK && result.getData() != null) {
            Uri uri = result.getData().getData();
            if (uri == null) {
                call.reject("URI tujuan ekspor tidak ditemukan.");
                return;
            }
            try {
                closeActiveExportQuietly();
                OutputStream stream = getContext().getContentResolver().openOutputStream(uri, "w");
                if (stream == null) throw new Exception("Tidak bisa membuka aliran tulis ke berkas tujuan.");
                activeExportUri = uri;
                activeExportStream = stream;
                activeExportBytesWritten = 0;
                call.resolve(new JSObject());
            } catch (Exception e) {
                call.reject("Gagal memulai sesi ekspor: " + e.getMessage());
            }
        } else {
            call.reject("USER_CANCELLED");
        }
    }

    @PluginMethod
    public void appendExportChunk(PluginCall call) {
        if (activeExportStream == null) {
            call.reject("Sesi ekspor belum dimulai. Panggil startExport terlebih dahulu.");
            return;
        }
        String base64Chunk = call.getString("base64", "");
        try {
            byte[] bytes = Base64.decode(base64Chunk, Base64.DEFAULT);
            activeExportStream.write(bytes);
            activeExportBytesWritten += bytes.length;
            call.resolve(new JSObject());
        } catch (Exception e) {
            call.reject("Gagal menulis bagian berkas: " + e.getMessage());
        }
    }

    @PluginMethod
    public void finishExport(PluginCall call) {
        try {
            if (activeExportStream != null) {
                activeExportStream.flush();
                activeExportStream.close();
            }
            JSObject ret = new JSObject();
            ret.put("uri", activeExportUri != null ? activeExportUri.toString() : "");
            ret.put("location", activeExportUri != null ? activeExportUri.toString() : "");
            ret.put("size", activeExportBytesWritten);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Gagal menyelesaikan ekspor: " + e.getMessage());
        } finally {
            activeExportStream = null;
            activeExportUri = null;
            activeExportBytesWritten = 0;
        }
    }

    @PluginMethod
    public void cancelExport(PluginCall call) {
        closeActiveExportQuietly();
        // Hapus berkas kosong/sebagian yang sudah dibuat SAF, supaya tidak ada sampah berkas 0 byte.
        if (activeExportUri != null) {
            try { getContext().getContentResolver().delete(activeExportUri, null, null); } catch (Exception ignored) {}
        }
        activeExportUri = null;
        activeExportBytesWritten = 0;
        call.resolve(new JSObject());
    }

    private void closeActiveExportQuietly() {
        if (activeExportStream != null) {
            try { activeExportStream.close(); } catch (Exception ignored) {}
            activeExportStream = null;
        }
    }
}
