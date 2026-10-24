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
            if (dataIntent != null) {
                Uri uri = dataIntent.getData();
                String dataToWrite = call.getString("data", "");
                Boolean isBase64 = call.getBoolean("isBase64", false);

                try {
                    ParcelFileDescriptor pfd = getContext().getContentResolver().openFileDescriptor(uri, "w");
                    FileOutputStream fileOutputStream = new FileOutputStream(pfd.getFileDescriptor());
                    
                    // Decode Base64 jika data berupa PDF/ZIP biner
                    if (isBase64) {
                        byte[] decodedBytes = Base64.decode(dataToWrite, Base64.DEFAULT);
                        fileOutputStream.write(decodedBytes);
                    } else {
                        fileOutputStream.write(dataToWrite.getBytes());
                    }
                    
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
}
