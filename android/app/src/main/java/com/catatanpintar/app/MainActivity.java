package com.catatanpintar.app;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(android.os.Bundle savedInstanceState) {
        registerPlugin(PdfViewerPlugin.class);
        registerPlugin(FileExportPlugin.class);
        registerPlugin(FileOpenPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
