package com.catatanpintar.app;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.os.ParcelFileDescriptor;
import android.util.Base64;
import java.io.FileOutputStream;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import androidx.activity.result.ActivityResult;

@CapacitorPlugin(name = "FileExport")
public class FileExportPlugin extends Plugin {

    @PluginMethod
    public void exportFile(PluginCall call) {
        String fileName = call.getString("fileName", "Catatan_Pintar.txt");
        String mimeType = call.getString("mimeType", "text/plain"); 
        
        // Mencegah OS mematikan plugin ini saat jendela file manager terbuka
        call.setKeepAlive(true); 

        Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.setType(mimeType); 
        intent.putExtra(Intent.EXTRA_TITLE, fileName);

        startActivityForResult(call, intent, "saveFileResult");
    }

    @ActivityCallback
    private void saveFileResult(PluginCall call, ActivityResult result) {
        if (result.getResultCode() == Activity.RESULT_OK) {
            Intent dataIntent = result.getData();
            
            if (dataIntent != null && dataIntent.getData() != null) {
                Uri uri = dataIntent.getData();
                String dataToWrite = call.getString("data", "");
                Boolean isBase64 = call.getBoolean("isBase64", false);

                ParcelFileDescriptor pfd = null;
                FileOutputStream fileOutputStream = null;

                try {
                    pfd = getContext().getContentResolver().openFileDescriptor(uri, "w");
                    if (pfd != null) {
                        fileOutputStream = new FileOutputStream(pfd.getFileDescriptor());
                        
                        if (Boolean.TRUE.equals(isBase64)) {
                            // Proses file biner asli (ZIP/PDF)
                            byte[] decodedBytes = Base64.decode(dataToWrite, Base64.DEFAULT);
                            fileOutputStream.write(decodedBytes);
                        } else {
                            // Proses teks murni (JSON/TXT/Word) dengan jaminan karakter UTF-8
                            fileOutputStream.write(dataToWrite.getBytes("UTF-8"));
                        }
                        
                        fileOutputStream.flush(); // Pastikan seluruh bit tertulis
                        
                        JSObject ret = new JSObject();
                        ret.put("success", true);
                        ret.put("uri", uri.toString());
                        call.resolve(ret);
                    } else {
                        call.reject("Gagal mendapatkan akses penulisan ke memori perangkat.");
                    }
                } catch (Exception e) {
                    call.reject("Kesalahan saat merakit file: " + e.getMessage());
                } finally {
                    // Jaring pengaman mutlak untuk mencegah memory leak (kebocoran RAM)
                    try {
                        if (fileOutputStream != null) fileOutputStream.close();
                        if (pfd != null) pfd.close();
                    } catch (Exception ignored) {
                        // Abaikan error saat proses penutupan paksa
                    }
                }
            } else {
                call.reject("Sistem tidak mengembalikan alamat file yang valid.");
            }
        } else {
            // Ditangkap sebagai error.message === 'USER_CANCELLED' di JavaScript
            call.reject("USER_CANCELLED"); 
        }
    }
}
