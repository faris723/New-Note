package com.catatanpintar.app;

import android.content.ContentResolver;
import android.content.ContentValues;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.PluginMethod;

import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;

@CapacitorPlugin(name = "FileExport")
public class FileExportPlugin extends Plugin {
    @PluginMethod
    public void saveBase64(PluginCall call) {
        String name = call.getString("name", "catatan-pintar.bin");
        String mime = call.getString("mime", "application/octet-stream");
        String base64 = call.getString("base64", "");
        if (base64 == null || base64.isEmpty()) {
            call.reject("Data ekspor kosong.");
            return;
        }
        try {
            byte[] bytes = Base64.decode(base64, Base64.DEFAULT);
            Uri uri = null;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                ContentResolver resolver = getContext().getContentResolver();
                ContentValues values = new ContentValues();
                values.put(MediaStore.Downloads.DISPLAY_NAME, name);
                values.put(MediaStore.Downloads.MIME_TYPE, mime);
                values.put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS + "/Catatan Pintar");
                values.put(MediaStore.Downloads.IS_PENDING, 1);
                uri = resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);
                if (uri == null) throw new IllegalStateException("MediaStore tidak dapat membuat berkas Download.");
                try (OutputStream out = resolver.openOutputStream(uri)) {
                    if (out == null) throw new IllegalStateException("OutputStream tidak tersedia.");
                    out.write(bytes);
                }
                ContentValues done = new ContentValues();
                done.put(MediaStore.Downloads.IS_PENDING, 0);
                resolver.update(uri, done, null, null);
            } else {
                File base = getContext().getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS);
                File dir = new File(base, "Catatan Pintar");
                if (!dir.exists() && !dir.mkdirs()) throw new IllegalStateException("Folder Download tidak dapat dibuat.");
                File outFile = new File(dir, name);
                try (FileOutputStream out = new FileOutputStream(outFile)) { out.write(bytes); }
                uri = Uri.fromFile(outFile);
            }
            JSObject result = new JSObject();
            result.put("success", true);
            result.put("uri", uri.toString());
            result.put("name", name);
            result.put("size", bytes.length);
            call.resolve(result);
        } catch (Exception e) {
            call.reject("Gagal menyimpan hasil ekspor: " + e.getMessage(), e);
        }
    }
}
