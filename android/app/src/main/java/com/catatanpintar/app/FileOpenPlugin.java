package com.catatanpintar.app;

import android.content.ContentResolver;
import android.net.Uri;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.PluginMethod;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;

@CapacitorPlugin(name = "FileOpen")
public class FileOpenPlugin extends Plugin {
    @PluginMethod
    public void readText(PluginCall call) {
        String uriString = call.getString("uri", "");
        if (uriString == null || uriString.isEmpty()) {
            call.reject("URI berkas kosong.");
            return;
        }
        try {
            Uri uri = Uri.parse(uriString);
            ContentResolver resolver = getContext().getContentResolver();
            try (InputStream in = resolver.openInputStream(uri); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
                if (in == null) throw new IllegalStateException("Berkas tidak dapat dibuka.");
                byte[] buffer = new byte[8192];
                int read;
                while ((read = in.read(buffer)) != -1) {
                    out.write(buffer, 0, read);
                    if (out.size() > 10 * 1024 * 1024) throw new IllegalStateException("Berkas terlalu besar untuk dibuka sebagai catatan.");
                }
                JSObject result = new JSObject();
                result.put("text", out.toString(StandardCharsets.UTF_8.name()));
                call.resolve(result);
            }
        } catch (Exception e) {
            call.reject("Gagal membaca berkas eksternal: " + e.getMessage(), e);
        }
    }
}
