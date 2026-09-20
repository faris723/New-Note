package com.catatanpintar.app;

import android.Manifest;
import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;

import androidx.core.content.ContextCompat;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.PluginMethod;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;

@CapacitorPlugin(name = "FileExport")
public class FileExportPlugin extends Plugin {
    private File tempFile;
    private FileOutputStream tempOut;
    private String exportName;
    private String exportMime;
    private long exportSize;
    private boolean exporting;

    private static String safeName(String name) {
        String value = name == null ? "catatan-pintar.bin" : name.trim();
        value = value.replaceAll("[\\\\/:*?\"<>|\\r\\n]", "_");
        while (value.startsWith(".")) value = value.substring(1);
        return value.isEmpty() ? "catatan-pintar.bin" : value;
    }

    @PluginMethod
    public synchronized void startExport(PluginCall call) {
        if (exporting) { call.reject("Ekspor lain sedang berjalan."); return; }
        String name = safeName(call.getString("name", "catatan-pintar.bin"));
        String mime = call.getString("mime", "application/octet-stream");
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q &&
            ContextCompat.checkSelfPermission(getContext(), Manifest.permission.WRITE_EXTERNAL_STORAGE) != PackageManager.PERMISSION_GRANTED) {
            call.reject("Izin penyimpanan belum diberikan. Silakan izinkan akses penyimpanan lalu coba lagi.");
            return;
        }
        try {
            File dir = new File(getContext().getCacheDir(), "exports");
            if (!dir.exists() && !dir.mkdirs()) throw new IllegalStateException("Folder sementara tidak dapat dibuat.");
            tempFile = File.createTempFile("export_", ".tmp", dir);
            tempOut = new FileOutputStream(tempFile);
            exportName = name;
            exportMime = mime;
            exportSize = 0;
            exporting = true;
            call.resolve();
        } catch (Exception e) {
            cleanupTemp();
            call.reject("Gagal memulai ekspor: " + e.getMessage(), e);
        }
    }

    @PluginMethod
    public synchronized void appendExportChunk(PluginCall call) {
        if (!exporting || tempOut == null) { call.reject("Sesi ekspor tidak aktif."); return; }
        String base64 = call.getString("base64", "");
        if (base64 == null || base64.isEmpty()) { call.reject("Potongan data ekspor kosong."); return; }
        try {
            byte[] bytes = Base64.decode(base64, Base64.DEFAULT);
            tempOut.write(bytes);
            exportSize += bytes.length;
            call.resolve();
        } catch (Exception e) {
            call.reject("Gagal menulis potongan ekspor: " + e.getMessage(), e);
        }
    }

    @PluginMethod
    public synchronized void finishExport(PluginCall call) {
        if (!exporting || tempFile == null) { call.reject("Sesi ekspor tidak aktif."); return; }
        Uri uri = null;
        try {
            if (tempOut != null) { tempOut.flush(); tempOut.close(); tempOut = null; }
            if (!tempFile.exists() || tempFile.length() != exportSize) throw new IllegalStateException("Ukuran berkas sementara tidak valid.");

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                ContentResolver resolver = getContext().getContentResolver();
                ContentValues values = new ContentValues();
                values.put(MediaStore.Downloads.DISPLAY_NAME, exportName);
                values.put(MediaStore.Downloads.MIME_TYPE, exportMime);
                values.put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS + "/Catatan Pintar");
                values.put(MediaStore.Downloads.IS_PENDING, 1);
                uri = resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);
                if (uri == null) throw new IllegalStateException("MediaStore tidak dapat membuat berkas Download.");
                try (InputStream in = new FileInputStream(tempFile); OutputStream out = resolver.openOutputStream(uri)) {
                    if (out == null) throw new IllegalStateException("OutputStream tidak tersedia.");
                    copy(in, out);
                } catch (Exception e) {
                    try { resolver.delete(uri, null, null); } catch (Exception ignored) {}
                    throw e;
                }
                ContentValues done = new ContentValues();
                done.put(MediaStore.Downloads.IS_PENDING, 0);
                resolver.update(uri, done, null, null);
            } else {
                File publicDownloads = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS);
                File dir = new File(publicDownloads, "Catatan Pintar");
                if (!dir.exists() && !dir.mkdirs()) throw new IllegalStateException("Folder Download tidak dapat dibuat.");
                File outFile = uniqueFile(dir, exportName);
                try (InputStream in = new FileInputStream(tempFile); OutputStream out = new FileOutputStream(outFile)) { copy(in, out); }
                if (outFile.length() != exportSize) throw new IllegalStateException("Verifikasi ukuran berkas gagal.");
                uri = Uri.fromFile(outFile);
                android.media.MediaScannerConnection.scanFile(getContext(), new String[]{outFile.getAbsolutePath()}, new String[]{exportMime}, null);
            }

            JSObject result = new JSObject();
            result.put("success", true);
            result.put("uri", uri.toString());
            result.put("name", exportName);
            result.put("location", "Download/Catatan Pintar/" + exportName);
            result.put("size", exportSize);
            call.resolve(result);
            cleanupTemp();
        } catch (Exception e) {
            cleanupTemp();
            call.reject("Gagal menyimpan hasil ekspor: " + e.getMessage(), e);
        }
    }

    @PluginMethod
    public synchronized void cancelExport(PluginCall call) {
        cleanupTemp();
        call.resolve();
    }

    private static void copy(InputStream in, OutputStream out) throws Exception {
        byte[] buffer = new byte[64 * 1024];
        int n;
        while ((n = in.read(buffer)) != -1) out.write(buffer, 0, n);
        out.flush();
    }

    private static File uniqueFile(File dir, String name) {
        File file = new File(dir, name);
        if (!file.exists()) return file;
        String base = name;
        String ext = "";
        int dot = name.lastIndexOf('.');
        if (dot > 0) { base = name.substring(0, dot); ext = name.substring(dot); }
        int i = 2;
        do { file = new File(dir, base + " (" + i++ + ")" + ext); } while (file.exists());
        return file;
    }

    private void cleanupTemp() {
        try { if (tempOut != null) tempOut.close(); } catch (Exception ignored) {}
        tempOut = null;
        try { if (tempFile != null) tempFile.delete(); } catch (Exception ignored) {}
        tempFile = null;
        exportName = null;
        exportMime = null;
        exportSize = 0;
        exporting = false;
    }
}
