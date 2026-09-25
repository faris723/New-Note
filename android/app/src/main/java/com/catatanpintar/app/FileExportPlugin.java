package com.catatanpintar.app;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;

import androidx.activity.result.ActivityResult;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.PluginMethod;

import android.util.Base64;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;

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
        try {
            File dir = new File(getContext().getCacheDir(), "exports");
            if (!dir.exists() && !dir.mkdirs()) throw new IllegalStateException("Folder sementara tidak dapat dibuat.");
            tempFile = File.createTempFile("export_", ".tmp", dir);
            tempOut = new FileOutputStream(tempFile);
            exportName = safeName(call.getString("name", "catatan-pintar.bin"));
            exportMime = call.getString("mime", "application/octet-stream");
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
        try {
            if (tempOut != null) { tempOut.flush(); tempOut.close(); tempOut = null; }
            if (!tempFile.exists() || tempFile.length() != exportSize) {
                throw new IllegalStateException("Verifikasi berkas sementara gagal.");
            }
            Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
            intent.addCategory(Intent.CATEGORY_OPENABLE);
            intent.setType(exportMime == null || exportMime.isEmpty() ? "application/octet-stream" : exportMime);
            intent.putExtra(Intent.EXTRA_TITLE, exportName);
            startActivityForResult(call, intent, "fileSaveResult");
        } catch (Exception e) {
            cleanupTemp();
            call.reject("Gagal membuka pemilih lokasi penyimpanan: " + e.getMessage(), e);
        }
    }

    @ActivityCallback
    private synchronized void fileSaveResult(PluginCall call, ActivityResult result) {
        if (result.getResultCode() != Activity.RESULT_OK || result.getData() == null || result.getData().getData() == null) {
            cleanupTemp();
            if (call != null) call.reject("Penyimpanan dibatalkan oleh pengguna.", "USER_CANCELLED");
            return;
        }
        Uri uri = result.getData().getData();
        try {
            getContext().getContentResolver().takePersistableUriPermission(
                uri,
                Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_WRITE_URI_PERMISSION
            );
        } catch (Exception ignored) {
            // Not all document providers grant persistable permissions; the URI
            // is still valid for the current write operation.
        }
        try (InputStream in = new FileInputStream(tempFile);
             OutputStream out = getContext().getContentResolver().openOutputStream(uri)) {
            if (out == null) throw new IllegalStateException("Tidak dapat membuka lokasi penyimpanan yang dipilih.");
            copy(in, out);
        } catch (Exception e) {
            cleanupTemp();
            call.reject("Gagal menulis file ke lokasi yang dipilih: " + e.getMessage(), e);
            return;
        }

        JSObject resultData = new JSObject();
        resultData.put("success", true);
        resultData.put("uri", uri.toString());
        resultData.put("name", exportName);
        resultData.put("location", "Lokasi yang dipilih pengguna");
        resultData.put("size", exportSize);
        call.resolve(resultData);
        cleanupTemp();
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
