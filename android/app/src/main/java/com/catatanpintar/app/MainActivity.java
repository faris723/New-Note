package com.catatanpintar.app;

import android.Manifest;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Bundle;

import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private static final int STORAGE_PERMISSION_REQUEST = 41021;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(PdfViewerPlugin.class);
        registerPlugin(FileExportPlugin.class);
        registerPlugin(FileOpenPlugin.class);
        super.onCreate(savedInstanceState);
        requestLegacyStoragePermissionIfNeeded();
    }

    private void requestLegacyStoragePermissionIfNeeded() {
        if (Build.VERSION.SDK_INT <= Build.VERSION_CODES.P &&
            ContextCompat.checkSelfPermission(this, Manifest.permission.WRITE_EXTERNAL_STORAGE) != PackageManager.PERMISSION_GRANTED) {
            ActivityCompat.requestPermissions(this, new String[]{Manifest.permission.WRITE_EXTERNAL_STORAGE}, STORAGE_PERMISSION_REQUEST);
        }
    }
}
