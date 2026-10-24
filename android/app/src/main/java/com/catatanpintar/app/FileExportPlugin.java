package com.catatanpintar.app;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.os.ParcelFileDescriptor;
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
        String fileName = call.getString("fileName", "catatan_pintar_backup.json");
        
        // Simpan state 'call' agar tidak dihancurkan oleh memori saat dialog OS terbuka
        call.setKeepAlive(true); 

        // Menggunakan Storage Access Framework (SAF) untuk meminta izin buat file
        Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.setType("application/json"); 
        intent.putExtra(Intent.EXTRA_TITLE, fileName);

        // Panggil activity dan arahkan hasilnya ke fungsi saveFileResult
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
                    // Gunakan ContentResolver untuk menulis ke URI yang diizinkan sistem
                    ParcelFileDescriptor pfd = getContext().getContentResolver().openFileDescriptor(uri, "w");
                    FileOutputStream fileOutputStream = new FileOutputStream(pfd.getFileDescriptor());
                    fileOutputStream.write(dataToWrite.getBytes());
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
            // Ini akan memicu blok catch() di JavaScript dan menampilkan "Ekspor dibatalkan"
            call.reject("USER_CANCELLED");
        }
    }
}
