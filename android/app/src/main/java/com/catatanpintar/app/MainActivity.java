package com.catatanpintar.app;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(android.os.Bundle savedInstanceState) {
        registerPlugin(PdfViewerPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
