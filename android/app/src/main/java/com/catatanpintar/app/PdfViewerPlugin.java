package com.catatanpintar.app;

import android.graphics.Bitmap;
import android.graphics.Color;
import android.graphics.pdf.PdfRenderer;
import android.os.ParcelFileDescriptor;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.PluginMethod;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import android.util.Base64;

@CapacitorPlugin(name = "PdfViewer")
public class PdfViewerPlugin extends Plugin {
    private static final int MAX_PAGES = 20;
    private static final int MAX_WIDTH = 1200;

    @PluginMethod
    public void render(PluginCall call) {
        String base64 = call.getString("base64", "");
        if (base64 == null || base64.isEmpty()) {
            call.reject("Data PDF kosong.");
            return;
        }

        File temp = null;
        try {
            byte[] bytes = Base64.decode(base64, Base64.DEFAULT);
            temp = File.createTempFile("catatan-pintar-pdf-", ".pdf", getContext().getCacheDir());
            try (FileOutputStream out = new FileOutputStream(temp)) {
                out.write(bytes);
            }

            try (ParcelFileDescriptor fd = ParcelFileDescriptor.open(temp, ParcelFileDescriptor.MODE_READ_ONLY);
                 PdfRenderer renderer = new PdfRenderer(fd)) {
                int totalPages = renderer.getPageCount();
                int count = Math.min(totalPages, MAX_PAGES);
                JSArray pages = new JSArray();

                for (int i = 0; i < count; i++) {
                    try (PdfRenderer.Page page = renderer.openPage(i)) {
                        int width = page.getWidth();
                        int height = page.getHeight();
                        float scale = Math.min(1f, (float) MAX_WIDTH / Math.max(1, width));
                        int bitmapWidth = Math.max(1, Math.round(width * scale));
                        int bitmapHeight = Math.max(1, Math.round(height * scale));

                        Bitmap bitmap = Bitmap.createBitmap(bitmapWidth, bitmapHeight, Bitmap.Config.ARGB_8888);
                        bitmap.eraseColor(Color.WHITE);
                        page.render(bitmap, null, null, PdfRenderer.Page.RENDER_MODE_FOR_DISPLAY);

                        ByteArrayOutputStream png = new ByteArrayOutputStream();
                        bitmap.compress(Bitmap.CompressFormat.PNG, 100, png);
                        bitmap.recycle();

                        pages.put("data:image/png;base64," + Base64.encodeToString(png.toByteArray(), Base64.NO_WRAP));
                    }
                }

                JSObject result = new JSObject();
                result.put("pages", pages);
                result.put("totalPages", totalPages);
                result.put("shownPages", count);
                call.resolve(result);
            }
        } catch (Exception e) {
            call.reject("Gagal merender PDF di dalam aplikasi: " + e.getMessage(), e);
        } finally {
            if (temp != null) {
                try { temp.delete(); } catch (Exception ignored) {}
            }
        }
    }
}
